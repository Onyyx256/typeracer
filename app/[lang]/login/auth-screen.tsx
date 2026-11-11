"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import type { FormEvent } from "react";
import * as z from "zod";
import { DiscordIcon, GitHubIcon } from "@/app/components/brand-icons";
import { GrowingStem } from "@/app/components/growing-stem";
import { TextField } from "@/app/components/text-field";
import {
  AUTH_LIMITS,
  OAUTH_ERRORS,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  signupSchema,
  toFieldErrors,
  type AuthError,
  type FieldErrors,
} from "@/lib/auth/validation";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { AuthDictionary } from "@/lib/i18n/dictionaries/fr";
import { formatPercent, interpolate, plural } from "@/lib/i18n/format";
import { login, signup } from "./actions";

type Mode = "login" | "signup";

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
    errors.username = "usernameLength";
  }
  if (password.length === 0) {
    errors.password = "required";
  }
  return errors;
}

function nextStep(
  dict: AuthDictionary,
  locale: Locale,
  mode: Mode,
  username: string,
  password: string,
  confirm: string,
): string | null {
  const remaining = (count: number) =>
    plural(locale, dict.steps.remaining, count);
  const name = username.trim();
  if (name.length < USERNAME_MIN) {
    return interpolate(dict.steps.username, {
      remaining: remaining(USERNAME_MIN - name.length),
    });
  }
  if (password.length < PASSWORD_MIN) {
    return interpolate(dict.steps.password, {
      remaining: remaining(PASSWORD_MIN - password.length),
    });
  }
  if (mode === "signup" && confirm !== password) {
    return dict.steps.confirm;
  }
  return null;
}

type AuthScreenProps = {
  dict: AuthDictionary;
  locale: Locale;
};

export function AuthScreen({ dict, locale }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<AuthError | null>(null);
  // The OAuth callback sends failures back as ?error=, shown until the visitor moves on.
  const [showUrlNotice, setShowUrlNotice] = useState(true);
  const [submitting, startSubmit] = useTransition();
  const router = useRouter();

  const copy = dict[mode];
  const errorText = (code: AuthError | undefined) =>
    code === undefined ? undefined : interpolate(dict.errors[code], AUTH_LIMITS);

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
  const pending = nextStep(dict, locale, mode, username, password, confirm);
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
    setShowUrlNotice(false);
    setConfirm("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowUrlNotice(false);
    const found = validate(mode, username, password, confirm);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      setNotice(null);
      return;
    }
    startSubmit(async () => {
      if (mode === "login") {
        const result = await login({ username, password });
        if (!result.ok) {
          setNotice(result.message);
          return;
        }
      } else {
        const result = await signup({ username, password, confirm });
        if (!result.ok) {
          setErrors(result.errors);
          setNotice(result.message ?? null);
          return;
        }
      }
      router.replace(localePath(locale, "/"));
    });
  }

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-panel text-on-panel lg:flex lg:flex-col lg:justify-between lg:p-12">
        <p className="max-w-xs font-display text-4xl leading-tight font-semibold">
          {dict.tagline}
        </p>
        <GrowingStem
          progress={progress}
          className="mx-auto h-[min(52vh,460px)] w-auto"
        />
        <p className="font-mono text-sm text-on-panel-muted" aria-hidden="true">
          <span className="text-on-panel">&gt;</span>{" "}
          {pending === null
            ? dict.inBloom
            : `${formatPercent(locale, progress)} — ${pending}`}
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
              {dict.login.tab}
            </ModeButton>
            <ModeButton
              active={mode === "signup"}
              onClick={() => switchMode("signup")}
            >
              {dict.signup.tab}
            </ModeButton>
          </div>

          <h1 className="mt-5 font-display text-2xl leading-tight font-semibold sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 text-muted">{copy.lead}</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <OAuthButton
              label={`${copy.oauth} Discord`}
              href={`/api/auth/discord?lang=${locale}`}
            >
              <DiscordIcon className="size-5" />
              Discord
            </OAuthButton>
            <OAuthButton
              label={`${copy.oauth} GitHub`}
              href={`/api/auth/github?lang=${locale}`}
            >
              <GitHubIcon className="size-5" />
              GitHub
            </OAuthButton>
          </div>

          <div className="my-4 flex items-center gap-4 font-mono text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            {dict.orPassword}
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="grid gap-4">
            <TextField
              label={dict.username}
              name="username"
              value={username}
              onChange={setUsername}
              autoComplete="username"
              maxLength={USERNAME_MAX}
              hint={
                mode === "signup"
                  ? interpolate(dict.usernameHint, AUTH_LIMITS)
                  : undefined
              }
              error={errorText(errors.username)}
            />
            <div
              className={`grid gap-4 ${mode === "signup" ? "sm:grid-cols-2" : ""}`}
            >
              <TextField
                label={dict.password}
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={setPassword}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                hint={
                  mode === "signup"
                    ? interpolate(dict.passwordHint, AUTH_LIMITS)
                    : undefined
                }
                error={errorText(errors.password)}
                action={
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-pressed={showPassword}
                    className="cursor-pointer px-3 font-mono text-xs text-primary-text hover:underline"
                  >
                    {showPassword ? dict.hide : dict.show}
                  </button>
                }
              />
              {mode === "signup" && (
                <TextField
                  label={dict.confirm}
                  name="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  error={errorText(errors.confirm)}
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
              {notice ? (
                <NoticeLine text={errorText(notice)} />
              ) : (
                showUrlNotice && (
                  <Suspense fallback={null}>
                    <UrlNotice errorText={errorText} />
                  </Suspense>
                )
              )}
            </p>
          </form>

          <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
            {dict.justVisiting}{" "}
            <Link
              href={localePath(locale, "/")}
              className="font-medium text-primary-text underline-offset-4 hover:underline"
            >
              {dict.playAsGuest}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

const urlErrorSchema = z.enum(OAUTH_ERRORS);

/** In its own Suspense boundary so reading the URL doesn't stop the page from prerendering. */
function UrlNotice({ errorText }: { errorText: (code: AuthError) => string | undefined }) {
  const parsed = urlErrorSchema.safeParse(useSearchParams().get("error"));
  return parsed.success ? <NoticeLine text={errorText(parsed.data)} /> : null;
}

function NoticeLine({ text }: { text: string | undefined }) {
  return (
    <>
      &gt; {text}
      <span className="animate-[caret-blink_1.1s_steps(1)_infinite]">_</span>
    </>
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

// A plain link, not next/link: the route answers with a redirect to another site.
function OAuthButton({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className={`flex h-11 cursor-pointer items-center justify-center gap-3 border border-line bg-background font-medium transition-colors hover:border-primary-text rounded-leaf`}
    >
      {children}
    </a>
  );
}
