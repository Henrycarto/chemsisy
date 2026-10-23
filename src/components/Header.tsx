import { Link, usePath } from "../app/router.tsx";
import { setTheme, useEffectiveTheme } from "../lib/hooks.ts";
import { Icon } from "./Icon.tsx";
import { Search } from "./Search.tsx";
import { Tooltip } from "./Tooltip.tsx";
import { useTour } from "./Tour.tsx";

export function Header() {
  const path = usePath();
  const theme = useEffectiveTheme();
  const { start } = useTour();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <header className="bar">
      <a className="skip-link" href="#main">Skip to content</a>
      <Link className="wordmark" href="/">Chemsisy</Link>
      <div data-tour="search" style={{ display: "contents" }}>
        <Search id="search" />
      </div>
      <nav className="nav" aria-label="Main">
        <Tooltip content="All drugs, by class" placement="bottom">
          <Link className="hide-md" href="/" aria-current={path === "/" ? "page" : undefined}>Browse</Link>
        </Tooltip>
        <Tooltip content="Two drugs side by side, with the core they share" placement="bottom">
          <Link href="/compare" data-tour="compare" aria-current={path.startsWith("/compare") ? "page" : undefined}>Compare</Link>
        </Tooltip>
        <Tooltip content="What Chemsisy is, its sources and licences" placement="bottom">
          <Link className="hide-md" href="/about" aria-current={path === "/about" ? "page" : undefined}>About</Link>
        </Tooltip>
        <Tooltip content={`Switch to the ${next} theme`} placement="bottom">
          <button type="button" className="icon-btn" aria-label={`Switch to the ${next} theme`} onClick={() => setTheme(next)}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </Tooltip>
        <Tooltip content="Take the short tour again" placement="bottom">
          <button type="button" className="icon-btn" aria-label="Open the tour" data-tour="help" onClick={start}>
            <Icon name="help" />
          </button>
        </Tooltip>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-foot">
      <span>For education. Not medical advice.</span>
      <span>Code MIT, notes CC BY 4.0</span>
      <Link href="/about">Sources and licences</Link>
      <a href="https://github.com/Henrycarto/chemsisy">Source code</a>
    </footer>
  );
}
