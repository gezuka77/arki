// Run only while the application is stopped. The backup is created before changes.
const fs = require("fs"),
  path = require("path"),
  Database = require("better-sqlite3");
const migrate = require("../legacy-migration");
async function main() {
  const [filename, configFile, backupFile] = process.argv.slice(2);
  if (
    !filename ||
    !configFile ||
    !backupFile ||
    path.resolve(filename) === path.resolve(backupFile)
  )
    throw Error(
      "Usage: node scripts/migrate-legacy.js DATABASE CONFIG_JSON NEW_BACKUP_FILE",
    );
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  const db = new Database(filename, { fileMustExist: true });
  db.pragma("foreign_keys=ON");
  try {
    fs.closeSync(fs.openSync(backupFile, "wx", 0o600));
    await db.backup(backupFile);
    console.log("Backup created; migrating database.");
    console.log(JSON.stringify(migrate(db, config)));
  } finally {
    db.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
