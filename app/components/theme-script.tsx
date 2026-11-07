"use client";

// Runs while the HTML is parsed so the saved (or system) theme is applied before first paint.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

/**
 * Only the server HTML needs this script. On a 404, Next sends an empty shell
 * and React builds the page in the browser, where it never runs a <script> it
 * creates and warns about it. In the browser the tag is marked as plain text
 * (React doesn't warn about those) and ThemeToggle applies the theme instead.
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? undefined : "text/plain"}
      // The type differs from the server HTML on purpose; hydration keeps the server's.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}
