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
    },
  });

  console.log("IndexedDB/OrbitDB initialized");
  return db;
}

/**
 * Iterates through a snapshot array from GitHub and inserts new records.
 */
export async function saveSnapshot(snapshotLogs) {
  if (!snapshotLogs || snapshotLogs.length === 0) return;
  const tx = db.transaction("logs", "readwrite");
  for (const log of snapshotLogs) {
    const existing = await tx.store.get(log.id);
    if (!existing) {
      await tx.store.add(log);
    }
  }
  await tx.done;
  console.log(`💾 Merged ${snapshotLogs.length} logs from repo snapshot.`);
}

/**
 * Appends a signed entry to the log.
 * Provides logical timestamps (CRDT-like)
 */
export async function appendLogIfNew(entry) {
  const existing = await db.get("logs", entry.id);
  if (existing) return false;

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
