const UPSTREAM_REPO = "regularpooria/pweeter";

/**
 * Helper to fetch from GitHub API
 */
async function ghFetch(endpoint, token, options = {}, isFullUrl = false) {
  const url = isFullUrl ? endpoint : `https://api.github.com${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API Error (${res.status}): ${err}`);
  }

  return res.json();
}

/**
 * Fetches the bootstrap snapshot JSON off GitHub Pages
 */
export async function fetchBootstrapSnapshot() {
  console.log(`Fetching bootstrap snapshot from upstream...`);
  try {
    const rawRes = await fetch(
      `https://raw.githubusercontent.com/${UPSTREAM_REPO}/main/snapshot.json?t=${Date.now()}`
    );
    if (rawRes.ok) {
      return await rawRes.json();
    }
  } catch (e) {
    console.error(
      "Failed to fetch snapshot on bootstrap. Initializing genesis state.",
      e
    );
  }
  return [];
}
export async function createSnapshotPR(logs, token) {
  if (!token) throw new Error("Not authorized for PR creation");

  try {
    console.log("1. Fetching your GitHub username...");
    const user = await ghFetch("/user", token);
    const username = user.login;

    console.log(`2. Forking ${UPSTREAM_REPO} to ${username}...`);
    await ghFetch(`/repos/${UPSTREAM_REPO}/forks`, token, { method: "POST" });

    // Wait a moment for GitHub to process the fork
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const forkRepo = `${username}/pweeter`;
    console.log(`3. Crafting snapshot update on ${forkRepo}...`);

    // 1. Get the current main branch reference SHA from the fork
    const refData = await ghFetch(
      `/repos/${forkRepo}/git/refs/heads/main`,
      token
    );
    const mainSha = refData.object.sha;

    // 2. Create the blob for `snapshot.json`
    const blobData = await ghFetch(`/repos/${forkRepo}/git/blobs`, token, {
      method: "POST",
      body: JSON.stringify({
        content: JSON.stringify(logs, null, 2),
        encoding: "utf-8",
      }),
    });

    // 3. Create a tree containing the new blob
    const treeData = await ghFetch(`/repos/${forkRepo}/git/trees`, token, {
      method: "POST",
      body: JSON.stringify({
        base_tree: mainSha,
        tree: [
          {
            path: "snapshot.json",
            mode: "100644", // File
            type: "blob",
            sha: blobData.sha,
          },
        ],
      }),
    });

    // 4. Create a commit
    const commitData = await ghFetch(`/repos/${forkRepo}/git/commits`, token, {
      method: "POST",
      body: JSON.stringify({
        message: `chore: Snapshot update (${logs.length} Pweets)`,
        tree: treeData.sha,
        parents: [mainSha],
      }),
    });

    // 5. Create a new branch pointing to the new commit
    const newBranchName = `snapshot-${Date.now()}`;
    await ghFetch(`/repos/${forkRepo}/git/refs`, token, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${newBranchName}`,
        sha: commitData.sha,
      }),
    });

    console.log(`4. Opening Pull Request to ${UPSTREAM_REPO}...`);
    // 6. Create a Pull Request from the fork's new branch to upstream main
    const prData = await ghFetch(`/repos/${UPSTREAM_REPO}/pulls`, token, {
      method: "POST",
      body: JSON.stringify({
        title: `P2P Snapshot Sync (${logs.length} events)`,
        head: `${username}:${newBranchName}`,
        base: "main",
        body: `Automated PR from Pweeter node.\n\nContains **${logs.length}** decentralized log entries.`,
      }),
    });

    return prData;
  } catch (err) {
    console.error("Snapshot PR Creation Failed:", err);
    alert(`Failed to create PR: ${err.message}`);
    throw err;
  }
}
