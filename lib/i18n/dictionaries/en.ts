import type { Dictionary } from "./fr";

export const en: Dictionary = {
  metadata: {
    description: "Typing races where every word grows your flower.",
  },
  header: {
    logout: "Log out",
    themeLabel: "Switch theme (light or dark)",
    themeTitle: "Switch theme",
    language: "Language",
  },
  home: {
    greeting: "Hello {name}",
    guest: "guest",
    login: "Log in",
  },
  loginPage: {
    title: "Log in",
    description: "Log in or create your NelumboType account.",
  },
  auth: {
    login: {
      tab: "Log in",
      title: "Welcome back to the garden",
      lead: "Log in to get back to your races and stats.",
      submit: "Log in",
      oauth: "Continue with",
    },
    signup: {
      tab: "Sign up",
      title: "Plant your first seed",
      lead: "Open rooms and keep your history.",
      submit: "Create my account",
      oauth: "Sign up with",
    },
    tagline: "Every word makes the flower grow.",
    inBloom: "in bloom",
    orPassword: "or with a password",
    username: "Username",
    password: "Password",
    confirm: "Confirm",
    usernameHint: "{usernameMin} to {usernameMax} characters",
    passwordHint: "{passwordMin} characters min.",
    show: "show",
    hide: "hide",
    justVisiting: "Just passing through?",
    playAsGuest: "Play as a guest",
    oauthSoon: "sign-in coming soon",
    steps: {
      username: "username: {remaining}",
      password: "password: {remaining}",
      confirm: "confirm your password",
      remaining: {
        one: "{count} more character",
        other: "{count} more characters",
      },
    },
    errors: {
      usernameLength: "Enter {usernameMin} to {usernameMax} characters.",
      usernameChars: "Letters, numbers, . _ - only.",
      required: "Required.",
      passwordMin: "At least {passwordMin} characters.",
      passwordMax: "At most {passwordMax} characters.",
      confirmMismatch: "Doesn't match.",
      usernameTaken: "This name is already taken.",
      badCredentials: "incorrect username or password",
      signupUnavailable: "sign-up unavailable right now, try again later",
      loginUnavailable: "log-in unavailable right now, try again later",
    },
  },
};
