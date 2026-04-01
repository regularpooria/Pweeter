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

/**
 * Stub for GitHub Auth flow.
 * In a real scenario, this delegates to an OAuth app to get an access token.
 */
export async function githubAuth() {
  const token = prompt('Enter a GitHub Personal Access Token (with "repo" scope) to enable snapshot PRs:\n(You can generate one at https://github.com/settings/tokens)');
  
  if (token && token.trim() !== '') {
    localStorage.setItem('github_token', token.trim());
    
    // Ask for the repo they want to sync to
    let targetRepo = localStorage.getItem('github_target_repo');
    if (!targetRepo) {
      targetRepo = prompt('Enter the target GitHub repository (e.g., your-username/pweeter):');
      if (targetRepo) {
        localStorage.setItem('github_target_repo', targetRepo.trim());
      }
    }
  } else {
    alert('Authentication cancelled.');
  }
}
