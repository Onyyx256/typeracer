"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { RaceDictionary } from "@/lib/i18n/dictionaries/fr";
import { backToLobbyAction, type BackToLobbyActionResult } from "../../actions";

type NewGameError = Extract<BackToLobbyActionResult, { ok: false }>["error"];

export function NewGame({ dict }: { dict: RaceDictionary }) {
  const router = useRouter();
  const [error, setError] = useState<NewGameError | null>(null);
  const [pending, startTransition] = useTransition();

  function newGame() {
    setError(null);
    startTransition(async () => {
      const result = await backToLobbyAction();
      if (result.ok || result.error === "notOnResults") {
        // The live update does this too; this covers a missing socket.
        router.refresh();
      }
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid justify-items-center gap-2 text-center">
      <button
        type="button"
        onClick={newGame}
        disabled={pending}
        className="h-12 cursor-pointer bg-primary px-8 text-lg font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf"
      >
        {dict.newGame}
      </button>
      <p role="status" className="min-h-5 font-mono text-sm text-muted">
        {error && <span className="text-danger">&gt; {dict.newGameErrors[error]}</span>}
      </p>
    </div>
  );
}
