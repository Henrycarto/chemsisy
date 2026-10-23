import { useEffect } from "react";
import { DataProvider } from "./data.tsx";
import { Link, matchRoute, usePath } from "./router.tsx";
import { Footer, Header } from "../components/Header.tsx";
import { TourProvider } from "../components/Tour.tsx";
import { Home } from "../pages/Home.tsx";
import { DrugPage } from "../pages/DrugPage.tsx";
import { ComparePage } from "../pages/ComparePage.tsx";
import { About } from "../pages/About.tsx";

function Routes() {
  const route = matchRoute(usePath());
  switch (route.name) {
    case "home":
      return <Home />;
    case "drug":
      return <DrugPage key={route.slug} slug={route.slug} />;
    case "compare":
      return <ComparePage a={route.a} b={route.b} />;
    case "about":
      return <About />;
    default:
      return (
        <div className="page prose">
          <h1>This page does not exist</h1>
          <p>
            <Link href="/">Go to all drugs</Link> or search above.
          </p>
        </div>
      );
  }
}

export function App() {
  // "/" jumps to the search field, unless the reader is typing somewhere already.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest("input, textarea, select, [contenteditable='true'], [role='application']")) return;
      e.preventDefault();
      document.getElementById("search")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <DataProvider>
      <TourProvider>
        <Header />
        <main id="main" tabIndex={-1}>
          <Routes />
        </main>
        <Footer />
      </TourProvider>
    </DataProvider>
  );
}
