/**
 * Kept apart from the socket client so the layout can follow the session
 * without loading socket.io on pages that never open a socket.
 */
let current: string | null = null;
let onChange: ((userId: string | null) => void) | null = null;

export function setIdentity(userId: string | null): void {
  if (userId === current) {
    return;
  }
  current = userId;
  onChange?.(userId);
}

export function onIdentityChange(listener: (userId: string | null) => void): void {
  onChange = listener;
}
