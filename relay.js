import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { circuitRelayServer } from "@libp2p/circuit-relay-v2";
import { identify } from "@libp2p/identify";

async function main() {
  const server = await createLibp2p({
    addresses: {
      listen: [
        "/ip4/0.0.0.0/tcp/9090/ws", // Listen on port 9090 for WebSockets
      ],
    },
    transports: [webSockets()],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      relay: circuitRelayServer({
        // Relax limits for local testing
        reservations: {
          maxReservations: Infinity,
          applyDefaultLimit: false,
        },
      }),
    },
  });

  console.log("🚀 Dedicated Pweeter Relay Server is booting up...");

  const addresses = server.getMultiaddrs();
  for (const addr of addresses) {
    console.log(
      `📡 Local Binding: ${addr.toString()}/p2p/${server.peerId.toString()}`
    );
  }

  console.log("\n=======================================================");
  console.log("✅ Relay is ready! Run `ngrok http 9090` in a new terminal.");
  console.log(`Send me the ngrok URL (e.g. https://xyz.ngrok-free.app) `);
  console.log(`and I'll wire it into your frontend!`);
  console.log("=======================================================\n");
}

main();
