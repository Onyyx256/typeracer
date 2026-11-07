/**
 * Starts Next.js and Socket.IO on one HTTP server (ADR 1 in docs/ARCHITECTURE.md).
 *
 * Node runs this file directly (type stripping), outside Next's bundler, so
 * it stays minimal and imports no app code. The Socket.IO server is shared
 * on globalThis; the app attaches its handlers in instrumentation.ts and
 * broadcasts from server actions (lib/realtime/).
 *   dev:  bun run dev
 *   prod: NODE_ENV=production node --experimental-strip-types server.ts
 */
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "localhost";
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname, port });
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
