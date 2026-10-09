import { useEffect, useState } from "react";

/*
 * One place that decides how expensive the scene is allowed to be.
 * Everything downstream (pill count, shadow resolution, whether contact
 * shadows render at all, how far back the camera sits) reads from here,
 * so tuning performance never means hunting through the scene graph.
 */

/*
 * `frameWidth` / `frameHeight` are the world-space box the camera must keep
 * in shot. The rig solves distance from them against the live aspect ratio
 * rather than hard-coding a distance, because a fixed distance that frames
 * the pile beautifully on a 16:9 laptop crops it in half on a portrait
 * phone. Narrower tiers also drop pills into a tighter disc, so the mound
 * they build is proportionally taller and still fills a tall frame.
 *
 * Quality settings live here; the framing offsets do not. Those are derived
 * from the layout breakpoint instead (see framingFor), because they answer a
 * layout question -- "is the headline beside the pile or above it?" -- and a
 * 768px tablet is a fast device using the stacked layout. Keying them off
 * device tier put the two out of step and slid the pile sideways on a
 * portrait tablet where the copy was already stacked above it.
 */
/*
 * Drop length is governed by pillCount, not by speed: bodies are released in
 * batches of `spawnBatch` every `spawnInterval` ms, so the release phase runs
 * for ceil(pillCount / spawnBatch) * spawnInterval, and the fall, bounce and
 * settle that follow are unchanged physics.
 *
 * Each tier below sheds enough pills to end roughly 1.8s sooner while leaving
 * gravity, restitution, damping and cadence exactly as they were:
 *
 *   desktop  118 -> 67   40 -> 23 batches  x 105ms  = 1785ms shorter
 *   tablet    74 -> 42   37 -> 21 batches  x 115ms  = 1840ms shorter
 *   mobile    58 -> 30   29 -> 15 batches  x 130ms  = 1820ms shorter
 */
const TIERS = {
  desktop: {
    name: "desktop",
    pillCount: 67,
    dpr: [1, 1.75],
    shadowMapSize: 2048,
    contactShadows: true,
    frameWidth: 5.0,
    frameHeight: 4.3,
    targetY: 0.62,
    spawnRadius: 1.05,
    spawnBatch: 3,
    spawnInterval: 105,
  },
  tablet: {
    name: "tablet",
    pillCount: 42,
    dpr: [1, 1.5],
    shadowMapSize: 1024,
    contactShadows: true,
    frameWidth: 5.2,
    frameHeight: 4.2,
    targetY: 0.66,
    spawnRadius: 0.68,
    spawnBatch: 2,
    spawnInterval: 115,
  },
  mobile: {
    name: "mobile",
    pillCount: 30,
    dpr: [1, 1.25],
    shadowMapSize: 512,
    contactShadows: false,
    frameWidth: 3.0,
    frameHeight: 4.4,
    targetY: 0.84,
    spawnRadius: 0.52,
    spawnBatch: 2,
    spawnInterval: 130,
  },
};

/*
 * Must stay in step with the 860px breakpoint in hero.css. Below it the copy
 * stacks above the pile, so the framing drops the pile into the lower half;
 * above it the copy sits in the left third, so the framing slides left to
 * clear it.
 */
const STACKED_BREAKPOINT = 860;

function framingFor(width) {
  if (width <= STACKED_BREAKPOINT) {
    return { frameOffsetX: 0, frameOffsetY: 0.9 };
  }
  return { frameOffsetX: width < 1180 ? -0.8 : -1.15, frameOffsetY: 0 };
}

function detect() {
  if (typeof window === "undefined") return TIERS.desktop;

  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  let tier = TIERS.desktop;
  if (width < 700 || (coarse && width < 900)) tier = TIERS.mobile;
  else if (width < 1180 || cores <= 4) tier = TIERS.tablet;

  const framing = framingFor(width);
  // Identity covers quality *and* framing, so a resize that only crosses the
  // layout breakpoint still re-frames without re-seeding the drop needlessly.
  return { ...tier, ...framing, key: `${tier.name}:${framing.frameOffsetX}` };
}

export function useDeviceTier() {
  const [tier, setTier] = useState(detect);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      // Debounced: a phone rotating shouldn't re-seed the whole drop mid-fall.
      frame = requestAnimationFrame(() => {
        const next = detect();
        setTier((current) => (current.key === next.key ? current : next));
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return tier;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** Cheap WebGL capability probe, so we can fall back before mounting a Canvas. */
export function detectWebGL() {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}
