import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
try {
  writeFileSync(
    new URL("../.env", import.meta.url),
    `JWT_SECRET=${randomBytes(32).toString("hex")}\nSETUP_TOKEN=${randomBytes(32).toString("hex")}\nHOST_PORT=8080\nTRUST_PROXY=0\nSHOP_DIRECTORY_BBOX=\nMAP_USER_AGENT=Arki/1.0\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .env with unique secrets. Read SETUP_TOKEN locally for the first-run wizard. Never commit or share .env.",
  );
} catch (e) {
  if (e.code === "EEXIST") {
    console.error(".env already exists; it was left unchanged.");
    process.exitCode = 1;
  } else throw e;
}
