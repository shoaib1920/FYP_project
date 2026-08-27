// Boots an ephemeral local MongoDB (no account/cluster needed) with data
// persisted to .devdata/mongo across restarts, then starts the normal server.
// Use `npm run dev:local` for this instead of `npm run dev` when you don't
// have a real MONGO_CONN configured — never point this at production data.
const path = require("path");
const fs = require("fs");
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const dbPath = path.join(__dirname, "..", ".devdata", "mongo");
  fs.mkdirSync(dbPath, { recursive: true });

  const mongod = await MongoMemoryServer.create({
    // Pinned to a small, fast-downloading release (~100MB vs. ~780MB for the
    // newest major) — plenty for local dev/testing, and avoids repeat
    // multi-minute downloads on a slow connection.
    binary: { version: "6.0.14" },
    instance: {
      dbPath,
      port: 27117,
      storageEngine: "wiredTiger",
    },
  });

  process.env.MONGO_CONN = mongod.getUri("FYP_DB");
  console.log(`[dev-local-db] Local MongoDB running at ${process.env.MONGO_CONN}`);
  console.log(`[dev-local-db] Data persisted under ${dbPath}`);

  process.on("SIGINT", async () => {
    await mongod.stop();
    process.exit(0);
  });

  require("../index.js");
})();
