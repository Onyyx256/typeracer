import "server-only";
import type { Server, Socket } from "socket.io";
import { userIdFromCookieHeader } from "@/lib/auth/session";
import { abandonRace, handleKeys, raceStateFor, resetInterruptedRaces } from "@/lib/race/manager";
import { canWatchRoom, leaveRoom, listRoomMemberIds } from "@/lib/rooms/rooms";
import {
  EVENTS,
  LOBBY_CHANNEL,
  raceKeysSchema,
  raceSyncSchema,
  roomChannel,
  userChannel,
  watchRoomSchema,
} from "./events";
import { scheduleGone, socketClosed, socketOpened } from "./presence";
import { realtimeState } from "./state";

type SocketData = { userId: string | null };

/** Logs only the message: errors from the database can embed query parameters. */
function logFailure(action: string, error: unknown): void {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  console.error(`${action} failed:`, cause instanceof Error ? cause.message : "unknown error");
}

/** Counts as leaving: frees the seat and, for a host, hands the role over (SALLE-08). */
function memberGone(userId: string): void {
  leaveRoom(userId).catch((error: unknown) => logFailure("leave after disconnect", error));
}

function leaveRoomChannels(socket: Socket): void {
  for (const channel of socket.rooms) {
    if (channel.startsWith("room:")) {
      void socket.leave(channel);
    }
  }
}

function onConnection(socket: Socket): void {
  const { userId } = socket.data as SocketData;
  if (userId) {
    socketOpened(userId);
    // Lets the server reach this user's tabs, e.g. when they are kicked (SALLE-07).
    void socket.join(userChannel(userId));
    socket.on("disconnect", () => socketClosed(userId, memberGone));
  }

  // TECH-07: payloads are validated; a bad one is ignored.
  socket.on(EVENTS.watchRoom, async (payload: unknown) => {
    const parsed = watchRoomSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }
    try {
      if (await canWatchRoom(userId, parsed.data.code)) {
        // One room page at a time per tab.
        leaveRoomChannels(socket);
        await socket.join(roomChannel(parsed.data.code));
      }
    } catch (error) {
      logFailure("room:watch", error);
    }
  });
  socket.on(EVENTS.unwatchRoom, () => leaveRoomChannels(socket));
  socket.on(EVENTS.watchLobby, () => void socket.join(LOBBY_CHANNEL));
  socket.on(EVENTS.unwatchLobby, () => void socket.leave(LOBBY_CHANNEL));

  // Whoever may watch the room gets the race; a runner also gets their own typing back.
  socket.on(EVENTS.raceSync, async (payload: unknown) => {
    const parsed = raceSyncSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }
    try {
      if (await canWatchRoom(userId, parsed.data.code)) {
        const state = raceStateFor(parsed.data.code, userId);
        if (state) {
          socket.emit(EVENTS.raceState, state);
        }
      }
    } catch (error) {
      logFailure("race:sync", error);
    }
  });
  // The runner is the socket's user, never someone named in the message.
  socket.on(EVENTS.raceKeys, (payload: unknown) => {
    const parsed = raceKeysSchema.safeParse(payload);
    if (!userId || !parsed.success) {
      return;
    }
    const { seq, keys, at } = parsed.data;
    const resync = handleKeys(userId, seq, keys, at);
    if (resync) {
      socket.emit(EVENTS.raceResync, resync);
    }
  });
  socket.on(EVENTS.raceAbandon, () => {
    if (userId) {
      abandonRace(userId);
    }
  });
}

/**
 * Wires the Socket.IO server created by server.ts. Guests may connect (to
 * watch the public room list); the session cookie identifies signed-in users.
 */
export async function attachHandlers(io: Server): Promise<void> {
  const state = realtimeState();
  if (state.handlersAttached) {
    return;
  }
  state.handlersAttached = true;

  io.use((socket, next) => {
    userIdFromCookieHeader(socket.handshake.headers.cookie)
      .then((userId) => {
        socket.data = { userId } satisfies SocketData;
        next();
      })
      .catch(() => next(new Error("unauthorized")));
  });
  io.on("connection", onConnection);

  try {
    await resetInterruptedRaces();
  } catch (error) {
    logFailure("reset interrupted races", error);
  }

  // After a restart nobody is connected yet: members whose browser doesn't
  // reconnect within the grace delay count as gone, like a disconnect.
  try {
    for (const userId of await listRoomMemberIds()) {
      scheduleGone(userId, memberGone);
    }
  } catch (error) {
    logFailure("startup presence check", error);
  }
}
