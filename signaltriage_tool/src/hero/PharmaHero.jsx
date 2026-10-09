import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  useDeviceTier,
  usePrefersReducedMotion,
  detectWebGL,
} from "./useDeviceTier";
import "./hero.css";

/*
 * three.js plus the Rapier WASM runtime is by far the heaviest thing this
 * app ships. Loading it lazily keeps it out of the entry chunk, so the nav
 * and headline paint on the first pass and the scene streams in behind
 * them, rather than the whole page waiting on a megabyte of physics engine.
 */
const PharmaScene = lazy(() =>
  import("./PharmaScene").then((module) => ({ default: module.PharmaScene }))
);

/*
 * The hero shell: DOM copy layered over the WebGL scene.
 *
 * The 3D layer is the hero, so everything here stays out of its way -- no
 * panels, no cards, just a headline in the left third and two small markers
 * at the bottom edge, matching how the composition is framed in-scene.
 */

function HeroCopy({ onExplore }) {
  return (
    <div className="hero__copy">
      <h1 className="hero__title">
        <span className="hero__title-accent">Post-Market</span>
        <span className="hero__title-main">Signal Intelligence</span>
      </h1>
      <p className="hero__lede">
        Ranking FAERS adverse-event reports by disproportionality, so a safety
        reviewer sees what actually warrants a closer look &mdash; first.
      </p>
      <button type="button" className="hero__cta" onClick={onExplore}>
        <span>Run an analysis</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

/*
 * Shown when WebGL is unavailable. Not an error state -- it keeps the same
 * composition and typography so the page still reads as intended, just
 * without the scene.
 */
function HeroFallback() {
  return <div className="hero__fallback" aria-hidden="true" />;
}

export function PharmaHero({ onExplore }) {
  const tier = useDeviceTier();
  const reducedMotion = usePrefersReducedMotion();
  const [webgl] = useState(detectWebGL);
  const sectionRef = useRef(null);

  // Simulating a hundred rigid bodies for someone who has scrolled down to
  // read the signal table is pure waste, so the render loop halts entirely
  // once the hero leaves the viewport.
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="hero" ref={sectionRef}>
      <div className="hero__scene">
        {webgl ? (
          // The fallback doubles as the loading state: the same lit backdrop
          // the scene opens on, so the hand-off is invisible.
          <Suspense fallback={<HeroFallback />}>
            <PharmaScene
              tier={tier}
              reducedMotion={reducedMotion}
              active={inView}
            />
          </Suspense>
        ) : (
          <HeroFallback />
        )}
      </div>

      <div className="hero__scrim" aria-hidden="true" />

      <HeroCopy onExplore={onExplore} />

      <div className="hero__footer">
        <button type="button" className="hero__scroll" onClick={onExplore}>
          <span className="hero__scroll-mouse" aria-hidden="true">
            <span className="hero__scroll-wheel" />
          </span>
          Scroll to explore
        </button>
        <p className="hero__source mono">
          FAERS &middot; openFDA &middot; PRR DISPROPORTIONALITY
        </p>
      </div>
    </section>
  );
}
