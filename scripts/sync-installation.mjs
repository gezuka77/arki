// Public source is canonical. Copy only tracked application files into a private checkout.
import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const source = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const target = process.argv[2] && path.resolve(process.argv[2]);
const git = (dir, ...args) =>
  execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
if (
  !target ||
  target === source ||
  git(target, "rev-parse", "--show-toplevel") !== target
)
  throw Error("Supply a separate installation Git checkout");
if (git(target, "status", "--porcelain", "--untracked-files=no"))
  throw Error("Commit tracked installation changes before syncing");
const allowed = (f) =>
  (f.startsWith("backend/") ||
    f.startsWith("frontend/") ||
    ["Dockerfile", ".dockerignore"].includes(f)) &&
  !/(^|\/)(node_modules|dist|data|backups)(\/|$)|\.db|\.env/.test(f);
const files = git(source, "ls-files", "-z").split("\0").filter(allowed);
if (!files.includes("backend/schema.js"))
  throw Error("Stage new application files before syncing");
const previous = git(target, "ls-files", "-z").split("\0").filter(allowed);
for (const f of previous)
  if (!files.includes(f) && existsSync(path.join(target, f)))
    unlinkSync(path.join(target, f));
for (const f of files) {
  const dest = path.join(target, f);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(path.join(source, f), dest);
}
console.log(
  `Synced ${files.length} application files. Review and commit the installation diff. Deployment configuration and private data were not copied.`,
);
