import nacl from "tweetnacl";
import { fromString, toString } from "uint8arrays";

/**
 * Initializes local P2P identity.
 * If no keypair exists in localStorage, generates a new one.
 */
export async function getLocalIdentity() {
  const existingPrivKeyStr = localStorage.getItem("pweeter_priv_key");
  const existingPubKeyStr = localStorage.getItem("pweeter_pub_key");

  if (existingPrivKeyStr && existingPubKeyStr) {
    return {
      publicKey: existingPubKeyStr,
      privateKey: fromString(existingPrivKeyStr, "base64url"),
    };
  }

  // Generate new keypair
  const keypair = nacl.sign.keyPair();
  const privKeyStr = toString(keypair.secretKey, "base64url");
  const pubKeyStr = toString(keypair.publicKey, "base64url");

  localStorage.setItem("pweeter_priv_key", privKeyStr);
  localStorage.setItem("pweeter_pub_key", pubKeyStr);

  return {
    publicKey: pubKeyStr,
    privateKey: keypair.secretKey,
  };
}

/**
 * Signs a message object using local private key.
 */
export function signMessage(messageObj, privateKey) {
  const msgUint8 = fromString(JSON.stringify(messageObj));
  const signature = nacl.sign.detached(msgUint8, privateKey);
  return toString(signature, "base64url");
}

/**
 * Verifies a message object against a provided signature and public key.
 */
export function verifyMessage(messageObj, signatureStr, publicKeyBase64Url) {
  const msgUint8 = fromString(JSON.stringify(messageObj));
  const signature = fromString(signatureStr, "base64url");
  const publicKey = fromString(publicKeyBase64Url, "base64url");

  return nacl.sign.detached.verify(msgUint8, signature, publicKey);
}

const GITHUB_CLIENT_ID = "Ov23liuPLEQ7NAFZLELD";
// Using corsproxy because GitHub OAuth endpoints block browser CORS requests
const CORS_PROXY = "https://corsproxy.io/?";

/**
 * GitHub Device Flow Authentication.
 * Native frontend OAuth without needing a backend server for client_secrets!
 */
export async function githubAuth() {
  const statusEl = document.getElementById("status");
  statusEl.innerText = "⏳ Requesting GitHub Login...";

  try {
    // 1. Request device code
    const res = await fetch(
      `${CORS_PROXY}${encodeURIComponent(
        "https://github.com/login/device/code"
      )}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          scope: "public_repo",
        }),
      }
    );

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(
        data.error_description ||
          data.error ||
          "Failed to request device flow code"
      );
    }

    // 2. Instruct the user
    const userCode = data.user_code;
    const verificationUri = data.verification_uri;

    try {
      await navigator.clipboard.writeText(userCode);
    } catch (err) {}

    statusEl.innerText = `⏳ Waiting for GitHub Auth (Code: ${userCode})...`;

    // Attempt to open the auth window directly to prevent popup blockers
    const popup = window.open(verificationUri, "_blank");

    if (!popup) {
      window.prompt(
        `Popup blocked! Please manually open ${verificationUri} and paste this code:`,
        userCode
      );
    } else {
      setTimeout(() => {
        alert(
          `🔑 Your code is: ${userCode}\n(Copied to your clipboard!)\n\nPlease paste it in the GitHub tab that just opened. Pweeter will wait in the background.`
        );
      }, 500);
    }

    // 3. Poll for the access token to be granted
    let authSuccess = false;
    let interval = (data.interval || 5) * 1000;

    while (!authSuccess) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      const pollRes = await fetch(
        `${CORS_PROXY}${encodeURIComponent(
          "https://github.com/login/oauth/access_token"
        )}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            device_code: data.device_code,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }),
        }
      );

      const pollData = await pollRes.json();

      if (pollData.access_token) {
        localStorage.setItem("github_token", pollData.access_token);

        // Lock the repo to yours for everyone syncing
        localStorage.setItem("github_target_repo", "regularpooria/pweeter");

        alert("✅ GitHub Authentication successful!");
        authSuccess = true;
      } else if (pollData.error && pollData.error !== "authorization_pending") {
        if (pollData.error === "slow_down") {
          interval += 5000;
        } else {
          throw new Error(pollData.error_description || pollData.error);
        }
      }
    }
  } catch (err) {
    console.error("GitHub Auth Error:", err);
    alert("Authentication failed: " + err.message);
    statusEl.innerText = "❌ Auth Failed";
  }
}
