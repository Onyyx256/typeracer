"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { DiscordIcon, GitHubIcon } from "@/app/components/brand-icons";
import { GrowingStem } from "@/app/components/growing-stem";
import { TextField } from "@/app/components/text-field";
import {
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  signupSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/auth/validation";
import { signup } from "./actions";

type Mode = "login" | "signup";

const COPY: Record<
  Mode,
  { title: string; lead: string; submit: string; oauth: string }
> = {
  login: {
    title: "Bon retour au jardin",
    lead: "Connecte-toi pour retrouver tes courses et tes statistiques.",
    submit: "Se connecter",
    oauth: "Continuer avec",
  },
  signup: {
    title: "Plante ta première graine",
    lead: "Ouvre des salles et garde ton historique.",
    submit: "Créer mon compte",
    oauth: "S'inscrire avec",
  },
};

function validate(
  mode: Mode,
  username: string,
  password: string,
  confirm: string,
): FieldErrors {
  if (mode === "signup") {
    const parsed = signupSchema.safeParse({ username, password, confirm });
    return parsed.success ? {} : toFieldErrors(parsed.error);
  }

  const errors: FieldErrors = {};
  const name = username.trim();
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
    errors.username = `Entre ${USERNAME_MIN} à ${USERNAME_MAX} caractères.`;
  }
  if (password.length === 0) {
    errors.password = "Requis.";
  }
  return errors;
}

function remaining(count: number): string {
  return `encore ${count} caractère${count > 1 ? "s" : ""}`;
}

/** What still keeps the flower from blooming, or null when the form is complete. */
function nextStep(
  mode: Mode,
  username: string,
  password: string,
  confirm: string,
): string | null {
  const name = username.trim();
  if (name.length < USERNAME_MIN) {
    return `nom d'utilisateur : ${remaining(USERNAME_MIN - name.length)}`;
  }
  if (password.length < PASSWORD_MIN) {
    return `mot de passe : ${remaining(PASSWORD_MIN - password.length)}`;
  }
  if (mode === "signup" && confirm !== password) {
    return "confirme ton mot de passe";
  }
  return null;
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const copy = COPY[mode];

  // Every keystroke grows the stem, the same way a race will.
  const steps = [
    Math.min(username.trim().length / USERNAME_MIN, 1),
    Math.min(password.length / PASSWORD_MIN, 1),
  ];
  if (mode === "signup") {
    steps.push(
      password.length > 0 && confirm === password
        ? 1
        : Math.min(confirm.length / PASSWORD_MIN, 1) * 0.8,
    );
  }
  const pending = nextStep(mode, username, password, confirm);
  // Bloom exactly when nothing is pending, so the caption and the flower never disagree.
  const progress =
    pending === null
      ? 1
      : Math.min(
          steps.reduce((sum, step) => sum + step, 0) / steps.length,
          0.99,
        );

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    setNotice(null);
    setConfirm("");
  }

  function announcePending() {
    setNotice("authentification bientôt disponible");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(mode, username, password, confirm);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      setNotice(null);
      return;
    }
    if (mode === "login") {
      announcePending();
      return;
    }

    startSubmit(async () => {
      const result = await signup({ username, password, confirm });
      if (!result.ok) {
        setErrors(result.errors);
        setNotice(result.message ?? null);
        return;
      }
      // No session yet: send the new user to the login tab with their name kept.
      setMode("login");
      setPassword("");
      setConfirm("");
      setNotice("compte créé, connecte-toi");
    });
  }

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-panel text-on-panel lg:flex lg:flex-col lg:justify-between lg:p-12">
        <p className="max-w-xs font-display text-4xl leading-tight font-semibold">
          Chaque mot fait pousser la fleur.
        </p>
        <GrowingStem
          progress={progress}
          className="mx-auto h-[min(52vh,460px)] w-auto"
        />
        <p className="font-mono text-sm text-on-panel-muted" aria-hidden="true">
          <span className="text-on-panel">&gt;</span>{" "}
          {pending === null
            ? "en fleur"
            : `${Math.round(progress * 100)} % — ${pending}`}
          <span className="animate-[caret-blink_1.1s_steps(1)_infinite]">
            _
          </span>
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-4 sm:px-8">
        <div className="w-full max-w-md">
          <div
            className={`grid grid-cols-2 gap-1 border border-line bg-background p-1 rounded-leaf`}
          >
            <ModeButton
              active={mode === "login"}
              onClick={() => switchMode("login")}
            >
              Connexion
            </ModeButton>
            <ModeButton
              active={mode === "signup"}
              onClick={() => switchMode("signup")}
            >
              Inscription
            </ModeButton>
          </div>

          <h1 className="mt-5 font-display text-2xl leading-tight font-semibold sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 text-muted">{copy.lead}</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <OAuthButton
              label={`${copy.oauth} Discord`}
              onClick={announcePending}
            >
              <DiscordIcon className="size-5" />
              Discord
            </OAuthButton>
            <OAuthButton
              label={`${copy.oauth} GitHub`}
              onClick={announcePending}
            >
              <GitHubIcon className="size-5" />
              GitHub
            </OAuthButton>
          </div>

          <div className="my-4 flex items-center gap-4 font-mono text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            ou avec un mot de passe
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="grid gap-4">
            <TextField
              label="Nom d'utilisateur"
              name="username"
              value={username}
              onChange={setUsername}
              autoComplete="username"
              maxLength={USERNAME_MAX}
              hint={
                mode === "signup"
                  ? `${USERNAME_MIN} à ${USERNAME_MAX} caractères`
                  : undefined
              }
              error={errors.username}
            />
            {/* Side by side on wider screens so the signup form fits without scrolling. */}
            <div
              className={`grid gap-4 ${mode === "signup" ? "sm:grid-cols-2" : ""}`}
            >
              <TextField
                label="Mot de passe"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={setPassword}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                hint={
                  mode === "signup"
                    ? `${PASSWORD_MIN} caractères min.`
                    : undefined
                }
                error={errors.password}
                action={
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-pressed={showPassword}
                    className="cursor-pointer px-3 font-mono text-xs text-primary-text hover:underline"
                  >
                    {showPassword ? "masquer" : "afficher"}
                  </button>
                }
              />
              {mode === "signup" && (
                <TextField
                  label="Confirmation"
                  name="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  error={errors.confirm}
                />
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`mt-1 h-11 cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-progress disabled:opacity-60 rounded-leaf`}
            >
              {copy.submit}
            </button>

            <p
              role="status"
              className="min-h-5 font-mono text-sm text-accent-text"
            >
              {notice && (
                <>
                  &gt; {notice}
                  <span className="animate-[caret-blink_1.1s_steps(1)_infinite]">
                    _
                  </span>
                </>
              )}
            </p>
          </form>

          <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
            Juste de passage ?{" "}
            <Link
              href="/"
              className="font-medium text-primary-text underline-offset-4 hover:underline"
            >
              Jouer en tant qu&apos;invité
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 cursor-pointer text-sm font-medium transition-colors rounded-leaf ${
        active ? "bg-accent text-on-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function OAuthButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 cursor-pointer items-center justify-center gap-3 border border-line bg-background font-medium transition-colors hover:border-primary-text rounded-leaf`}
    >
      {children}
    </button>
  );
}
