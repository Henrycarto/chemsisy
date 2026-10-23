import { useEffect, useState, useSyncExternalStore } from "react";

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const motionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");

function subscribeTheme(fn: () => void) {
  const mq = darkQuery();
  mq.addEventListener("change", fn);
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    mq.removeEventListener("change", fn);
    mo.disconnect();
  };
}

/** The theme actually shown: the saved choice, or the system setting. */
export function useEffectiveTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribeTheme,
    () => {
      const t = document.documentElement.dataset.theme;
      if (t === "light" || t === "dark") return t;
      return darkQuery().matches ? "dark" : "light";
    },
    () => "light",
  );
}

export function setTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("chemsisy.theme", theme);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this visit.
  }
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const mq = motionQuery();
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    },
    () => motionQuery().matches,
    () => false,
  );
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const fn = () => setM(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [q]);
  return m;
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener("online", fn);
      window.addEventListener("offline", fn);
      return () => {
        window.removeEventListener("online", fn);
        window.removeEventListener("offline", fn);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

export function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not fatal: the setting simply is not remembered.
  }
}
