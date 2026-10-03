import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("..", import.meta.url));
const skip = new Set([
  ".git",
  "node_modules",
  "dist",
  "data",
  "backups",
  "Issues",
  "test-results",
]);
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (
      skip.has(e.name) ||
      e.name === ".env" ||
      (e.name.startsWith(".env.") && e.name !== ".env.example")
    )
      return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [path.relative(root, p)];
  });
}
let files;
try {
  const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: root,
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
  if (gitRoot !== path.resolve(root)) throw Error();
  files = execFileSync("git", ["ls-files", "-z"], { cwd: root })
    .toString()
    .split("\0")
    .filter(Boolean);
  if (!files.length) files = walk(root);
} catch {
  files = walk(root);
}
const failures = [];
for (const file of files) {
  if (
    (/(^|\/)(\.env(?:\..+)?|Issues|backups|data)(\/|$)/i.test(file) &&
      !file.endsWith(".env.example")) ||
    /\.(db(?:-wal|-shm)?|sqlite\d*|pem|key|p12|pfx)$/i.test(file)
  ) {
    failures.push(`${file}: private/configuration artifact`);
    continue;
  }
  if (
    !/\.(?:[cm]?js|jsx|json|html|css|md|ya?ml|example)$/.test(file) &&
    !["Dockerfile", "LICENSE", ".gitignore", ".dockerignore"].includes(file)
  )
    continue;
  const text = readFileSync(path.join(root, file), "utf8");
  const rules = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
    [
      /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|glpat-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/,
      "access token",
    ],
    [
      /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/,
      "JWT",
    ],
    [
      /^(?:JWT_SECRET|SETUP_TOKEN)\s*=\s*[A-Za-z0-9_-]{24,}\s*$/m,
      "literal installation secret",
    ],
  ];
  for (const [pattern, label] of rules)
    if (pattern.test(text)) failures.push(`${file}: possible ${label}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Public-file checks passed (${files.length} files). Review the staged diff before publishing.`,
  );
