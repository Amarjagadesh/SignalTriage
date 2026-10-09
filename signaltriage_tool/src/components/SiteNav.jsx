import { useEffect, useState } from "react";

/*
 * Minimal top navigation, floating over the 3D scene.
 *
 * Branding is the existing SignalTriage mark and wordmark lifted out of the
 * old dashboard header -- same bolt glyph, same amber accent, same version
 * pill. Nothing new was invented here; it just moved somewhere it can
 * breathe.
 */

const LINKS = [
  { id: "analysis", label: "Analysis" },
  { id: "method", label: "Method" },
];

export function SiteNav({ onNavigate }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id) => {
    setMenuOpen(false);
    onNavigate(id);
  };

  return (
    <nav className={`site-nav${scrolled ? " site-nav--scrolled" : ""}`}>
      <button
        type="button"
        className="site-nav__brand"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <span className="site-nav__logo" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </span>
        <span className="site-nav__wordmark">
          Signal<span className="site-nav__wordmark-accent">Triage</span>
        </span>
        <span className="site-nav__version mono">v1.2</span>
      </button>

      <div className={`site-nav__links${menuOpen ? " site-nav__links--open" : ""}`}>
        {LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            className="site-nav__link"
            onClick={() => go(link.id)}
          >
            {link.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="site-nav__toggle"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
      </button>
    </nav>
  );
}
