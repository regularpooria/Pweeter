import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { kadDHT } from "@libp2p/kad-dht";
import { identify } from "@libp2p/identify";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { ping } from "@libp2p/ping";

let node = null;

export async function initP2P() {
  if (node) return node;

  try {
    const bootstrapNodes = [
      "/dns4/node0.delegate.ipfs.io/tcp/443/wss/p2p/QmZMxNdpMkewiVBMj6H8K4bB1wzLwWkXYs24K8Q4XYR9c7",
      // more bootstrap nodes if needed...
    ];

    node = await createLibp2p({
      addresses: {
        listen: ["/webrtc"],
      },
      transports: [webSockets(), webRTC(), circuitRelayTransport()],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: [
        bootstrap({
          list: bootstrapNodes,
          timeout: 1000,
        }),
      ],
      services: {
        dht: kadDHT({
          protocol: "/pweeter/kad/1.0.0",
          clientMode: true,
        }),
        identify: identify(),
        ping: ping(),
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
