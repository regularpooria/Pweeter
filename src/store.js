import { openDB } from "idb";
// In a full implementation, you would integrate OrbitDB here, backed by IndexedDB.
// For now, we mock the local CRDT Hash-Chained Log using IndexedDB directly.

let db;

export async function initStore() {
  if (db) return db;

  // OrbitDB mock initializing IndexedDB
  db = await openDB("pweeter-store", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("logs")) {
        db.createObjectStore("logs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("media")) {
        db.createObjectStore("media", { keyPath: "cid" });
      }
    },
  });

  console.log("IndexedDB/OrbitDB initialized");
  return db;
}

/**
 * Appends a signed entry to the log.
 * Provides logical timestamps (CRDT-like)
 */
export async function appendLog(entry) {
  // We attach a logical clock and a hash reference
  const latestKeys = await db.getAllKeys("logs");
  const prevHash =
    latestKeys.length > 0 ? latestKeys[latestKeys.length - 1] : "GENESIS";

  const entryWithMetadata = {
    ...entry,
    clock: latestKeys.length + 1,
    prevPointer: prevHash,
  };

  await db.add("logs", entryWithMetadata);
  return entryWithMetadata;
}

export async function getAllLogs() {
  const allLogs = await db.getAll("logs");
  // Sort by logical clock
  return allLogs.sort((a, b) => a.clock - b.clock);
}
