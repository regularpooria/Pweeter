import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { kadDHT } from "@libp2p/kad-dht";
import { identify } from "@libp2p/identify";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { ping } from "@libp2p/ping";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { fromString, toString } from "uint8arrays";

const PUBSUB_TOPIC = "pweeter-global-v1";
let node = null;

export async function initP2P() {
  if (node) return node;

  try {
    const relayNgrokHost = "b1d7-130-15-35-7.ngrok-free.app";
    const relayPeerId = "12D3KooWCtkGntWJD1mMkMvzrtqBqz32xGpHzBx5bj1xW5NqstN7";

    const bootstrapNodes = [
      `/dns4/${relayNgrokHost}/tcp/443/wss/p2p/${relayPeerId}`,
    ];

    node = await createLibp2p({
      addresses: {
        listen: ["/webrtc"],
      },
      transports: [
        webSockets(),
        webTransport(),
        webRTC(),
        circuitRelayTransport({
          discoverRelays: 1,
        }),
      ],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: [
        bootstrap({
          list: bootstrapNodes,
        }),
      ],
      services: {
        dht: kadDHT({
          protocol: "/pweeter/kad/1.0.0",
          clientMode: true,
        }),
        identify: identify(),
        ping: ping(),
        pubsub: gossipsub({
          allowPublishToZeroPeers: true,
          allowPublishToZeroTopicPeers: true,
        }),
      },
    });

    await node.start();
    console.log("libp2p node started with ID:", node.peerId.toString());

    return node;
  } catch (error) {
    console.error("Failed to start libp2p node:", error);
    throw error;
  }
}

export function getP2PNode() {
  return node;
}

export function subscribeToPweets(onPweetReceived) {
  if (!node) return;
  node.services.pubsub.addEventListener("message", (event) => {
    if (event.detail.topic === PUBSUB_TOPIC) {
      try {
        const tweetStr = toString(event.detail.data);
        const tweetObj = JSON.parse(tweetStr);
        console.log("📥 P2P Received:", tweetObj);
        onPweetReceived(tweetObj);
      } catch (e) {
        console.error("Failed to parse incoming P2P message", e);
      }
    }
  });

  // Join the topic channel
  node.services.pubsub.subscribe(PUBSUB_TOPIC);
  console.log(`📡 Subscribed to P2P network: ${PUBSUB_TOPIC}`);
}

export async function broadcastPweet(tweetObj) {
  if (!node) return;
  try {
    const data = fromString(JSON.stringify(tweetObj));
    await node.services.pubsub.publish(PUBSUB_TOPIC, data);
    console.log("📤 P2P Broadcasted:", tweetObj.id);
  } catch (e) {
    if (
      e.name === "PublishError" &&
      e.message.includes("NoPeersSubscribedToTopic")
    ) {
      console.log(
        "⚠️ Saved locally! (No active peers currently subscribed to receive the broadcast)."
      );
    } else {
      console.error("Failed to broadcast to P2P network", e);
    }
  }
}
