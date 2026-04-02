import { getLocalIdentity, githubAuth } from "./auth.js";
import {
  initStore,
  appendLogIfNew,
  getAllLogs,
  saveSnapshot,
} from "./store.js";
import { initP2P, subscribeToPweets, broadcastPweet } from "./p2p.js";
import { fetchBootstrapSnapshot } from "./github.js";
import { initiateSnapshotConsensus } from "./consensus.js";

let identity = null;

async function init() {
  const statusEl = document.getElementById("status");
  statusEl.innerText = "⏳ Instantiating Identity...";

  try {
    identity = await getLocalIdentity();

    // Get or Set Username
    let username = localStorage.getItem("pweeter_username");
    if (!username) {
      username =
        prompt("Welcome to Pweeter! Choose a username:") || "Anonymous";
      localStorage.setItem("pweeter_username", username);
    }
    identity.username = username;

    await initStore();

    statusEl.innerText = "⏳ Initializing P2P...";
    const node = await initP2P();

    statusEl.innerText =
      "✅ Node " +
      node.peerId.toString().substring(0, 8) +
      "... (@" +
      identity.username +
      ")";

    // Check if Github auth is required
    const githubToken = localStorage.getItem("github_token");
    if (!githubToken) {
      document.querySelector(".auth-banner").style.display = "block";
    }

    // Attach global functions to window
    window.authenticateGithub = () => {
      githubAuth().then(() => {
        const token = localStorage.getItem("github_token");
        const repo = localStorage.getItem("github_target_repo");
        if (token && repo) {
          document.querySelector(".auth-banner").style.display = "none";
          statusEl.innerText += ` [Target: ${repo}]`;
        }
      });
    };

    const timeline = document.getElementById("timeline");

    // Fetch upstream records from GitHub Snapshot PR Hub
    statusEl.innerText = "⏳ Bootstrapping local timeline...";
    const upstreamData = await fetchBootstrapSnapshot();
    await saveSnapshot(upstreamData);

    // Setup initial state from Store
    const logs = await getAllLogs();
    logs.forEach((tweet) => renderTweet(tweet));

    statusEl.innerText += " [Ready]";

    // Listen to real-time gossipsub events from other peers
    subscribeToPweets(async (incomingTweet) => {
      console.log("Incoming Pweet from GossipSub!", incomingTweet);
      const newlySaved = await appendLogIfNew(incomingTweet);
      if (newlySaved) {
        renderTweet(newlySaved);
      }
    });

    // Start 5-minute automated PR consensus heartbeat
    setInterval(() => {
      initiateSnapshotConsensus();
    }, 5 * 60 * 1000);

    window.postTweet = async () => {
      const input = document.getElementById("tweetInput");

      const content = input.value.trim();
      if (!content) return;

      statusEl.innerText = "⏳ Pweeting to P2P network...";

      const tweet = {
        id: Date.now().toString(),
        content,
        author: identity.publicKey,
        username: identity.username, // Attach local name to events
        timestamp: Date.now(),
      };

      // Check CRDT
      const saved = await appendLogIfNew(tweet);

      if (saved) {
        renderTweet(saved);
        // Gossip it to the peer-to-peer room
        await broadcastPweet(saved);
      }

      input.value = "";
      statusEl.innerText = statusEl.innerText.replace(
        "⏳ Pweeting to P2P network...",
        ""
      );
    };

    /** Wait for click on a static button if you want rather than adding inline */
    document
      .getElementById("postBtn")
      ?.addEventListener("click", window.postTweet);

    function renderTweet(tweet) {
      if (document.getElementById(`pweet-${tweet.id}`)) return; // Don't duplicate render

      const displayName = tweet.username || "Anonymous";

      const tweetEl = document.createElement("div");
      tweetEl.className = "tweet";
      tweetEl.id = `pweet-${tweet.id}`;

      tweetEl.innerHTML = `
        <div class="author">
          @${displayName} 
          <span style="font-weight: normal; color: #999; font-size: 0.8rem;" title="${
            tweet.author
          }">
            (${tweet.author?.substring(0, 5)}...)
          </span>
        </div>
        <div class="content">${tweet.content}</div>
      `;
      // Prepend to timeline
      timeline.prepend(tweetEl);
    }
  } catch (err) {
    statusEl.innerText = "❌ Error loading identity";
    console.error(err);
  }
}

// Start app
document.addEventListener("DOMContentLoaded", init);
