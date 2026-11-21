/**
 * Starts Next.js and Socket.IO on one HTTP server (ADR 1 in docs/ARCHITECTURE.md).
 *
 * It runs outside Next's bundler (type stripping in dev, compiled to
 * build/server.mjs for production, since some Node builds lack type
 * stripping), so it stays minimal and imports no app code. The Socket.IO
 * server is shared on globalThis; the app attaches its handlers in
 * instrumentation.ts and broadcasts from server actions (lib/realtime/).
 *   dev:  bun run dev
 *   prod: bun run build && bun run start
 */
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "localhost";
const dev = process.env.NODE_ENV !== "production";

// Next builds the proxy's request URL on "localhost" but checks its rewrites
// against this hostname: any other value (HOST=127.0.0.1 on the VPS) makes
// every proxy rewrite an external fetch, which fails behind HTTPS.
const app = next({ dev, hostname: "localhost", port });
const handle = app.getRequestHandler();

const httpServer = createServer((request, response) => {
  void handle(request, response);
});

// Created before app.prepare(), so it already exists when Next runs
// instrumentation.ts. Other WebSocket upgrades (dev hot reload) go to Next.
const io = new Server(httpServer, { serveClient: false, destroyUpgrade: false });
(globalThis as Record<symbol, unknown>)[Symbol.for("nelumbotype.io")] = io;

await app.prepare();

const upgrade = app.getUpgradeHandler();
httpServer.on("upgrade", (request, socket, head) => {
  if (!request.url?.startsWith("/socket.io/")) {
    void upgrade(request, socket, head);
  }
});

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port} (${dev ? "dev" : "production"})`);
});
