import { getP2PNode } from "./p2p.js";
import { createSnapshotPR } from "./github.js";
import { getAllLogs } from "./store.js";

/**
 * Calculates deterministic most active node to decide who creates the final GitHub PR.
 * In a real blockchain system, this is a verifiable random function.
 * Here, we use string sorting / tie-breakers over logs authored by the known peers
 * that have the highest score.
 */
export async function determineLeader(peers, latestBlockHash) {
  // Activity Scoring: Map peer to tweet count or interactions.
  // For simulation purposes:
  const rankedBase = [...peers].map((peerId) => {
    return {
      peerId,
      score: Math.floor(Math.random() * 100), // mock scoring logic
      hashKey: peerId + latestBlockHash,
    };
  });

  rankedBase.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score; // Descending by score
    }
    // Deterministic Tie-Breaker
    return a.hashKey.localeCompare(b.hashKey);
  });

  if (rankedBase.length === 0) return null;
  return rankedBase[0];
}

export async function initiateSnapshotConsensus() {
  const node = getP2PNode();
  if (!node) throw new Error("P2P node not started");

  console.log("Initiating periodic consensus...");
  // 1. Gather connected peers
  const connections = node.getConnections();
  const knownPeers = [
    node.peerId.toString(),
    ...connections.map((c) => c.remotePeer.toString()),
  ];

  // 2. Mock a latest hash block
  const mockBlockHash = "abc-123-def";

  // 3. Determine Leader
  const leader = await determineLeader(knownPeers, mockBlockHash);

  if (!leader) return false;

  console.log(
    `Node ${leader.peerId} was selected as leader with score ${leader.score}`
  );

  if (leader.peerId === node.peerId.toString()) {
    console.log("We are the leader! Submitting PR...");
    const token = localStorage.getItem("github_token");
    if (!token) {
      console.warn("But we lack a github_token to finalize the PR!");
      return false;
    }

    const logs = await getAllLogs();
    await createSnapshotPR(logs, token);
    return true;
  } else {
    console.log("We are NOT the leader. Validating remotely...");
    return false;
  }
}

// Add to window for easy demo trigger
window.triggerConsensusRound = initiateSnapshotConsensus;
