import { getLocalIdentity, githubAuth } from "./auth.js";
import { initStore, appendLog, getAllLogs } from "./store.js";
import { initP2P } from "./p2p.js";

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

    // Setup initial state from Store
    const logs = await getAllLogs();
    logs.forEach((tweet) => {
      renderTweet(tweet);
    });

    window.postTweet = async () => {
      const input = document.getElementById("tweetInput");
      const content = input.value.trim();
      if (!content) return;

      const tweet = {
        id: Date.now().toString(),
        content,
        author: identity.publicKey,
        username: identity.username, // Attach local name to events
        timestamp: Date.now(),
      };

      // In real scenario, we sign this and add to Hash Log via OrbitDB/CRDT
      const saved = await appendLog(tweet);

      renderTweet(saved);
      input.value = "";
    };

    /** Wait for click on a static button if you want rather than adding inline */
    document
      .getElementById("postBtn")
      ?.addEventListener("click", window.postTweet);

    function renderTweet(tweet) {
      const displayName = tweet.username || "Anonymous";

      const tweetEl = document.createElement("div");
      tweetEl.className = "tweet";
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
