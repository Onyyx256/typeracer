import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** False in the server HTML and until React has taken over the page, then true. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
