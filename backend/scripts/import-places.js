// Import a completed regional download without changing household data.
const fs = require("fs");
const { store, refreshDirectory } = require("../place-service");
(async () => {
  try {
    if (process.argv[2])
      console.log(
        JSON.stringify({
          imported: store.import(
            JSON.parse(fs.readFileSync(process.argv[2], "utf8")),
          ),
        }),
      );
    else await refreshDirectory(true);
    const status = store.status();
    if (!status) throw Error("No usable shop directory available");
    console.log(JSON.stringify(status));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    store.close();
  }
})();
