"use client";

import { useEffect } from "react";
import { setIdentity } from "@/lib/realtime/identity";

/**
 * An open tab is how the server knows a member is still there. Rendered for
 * guests too (null), so logging out reconnects the socket as a guest. A guest
 * only needs a socket on pages that watch something, so the socket client is
 * loaded for members only.
 */
export function Presence({ userId }: { userId: string | null }) {
  useEffect(() => {
    setIdentity(userId);
    if (userId !== null) {
      void import("@/lib/realtime/client").then(({ getSocket }) => getSocket());
    }
  }, [userId]);
  return null;
}
