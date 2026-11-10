export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { getIo } = await import("@/lib/realtime/state");
  const io = getIo();
  // Null under plain `next dev`/`next build`: the app works, without live updates.
  if (io) {
    const { attachHandlers } = await import("@/lib/realtime/handlers");
    await attachHandlers(io);
  }
}
