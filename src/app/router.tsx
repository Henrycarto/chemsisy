// A small history router: four routes do not need a dependency.
import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("popstate", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("popstate", fn);
  };
};

export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search) return;
  history[replace ? "replaceState" : "pushState"](null, "", to);
  listeners.forEach((fn) => fn());
  if (!replace) window.scrollTo(0, 0);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname, () => "/");
}

export type Route =
  | { name: "home" }
  | { name: "drug"; slug: string }
  | { name: "compare"; a?: string; b?: string }
  | { name: "about" }
  | { name: "missing" };

export function matchRoute(path: string): Route {
  const parts = path.replace(/\/+$/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: "home" };
  if (parts[0] === "drug" && parts.length === 2) return { name: "drug", slug: parts[1] };
  if (parts[0] === "compare" && parts.length <= 3) return { name: "compare", a: parts[1], b: parts[2] };
  if (parts[0] === "about" && parts.length === 1) return { name: "about" };
  return { name: "missing" };
}

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title}, Chemsisy` : "Chemsisy";
  }, [title]);
}
