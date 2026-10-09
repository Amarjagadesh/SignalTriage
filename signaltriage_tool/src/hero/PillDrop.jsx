import { useEffect, useMemo, useState } from "react";
import { Pill } from "./Pill";
import { pickSpecies } from "./pillSpecies";
import { PILE_CENTER } from "./sceneLayout";

/* Small deterministic PRNG, so the pile is different-looking but repeatable. */
function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
 * Plans the whole drop up front: where each pill starts, how fast, how it
 * tumbles. Two details do most of the work in making the result look like
 * a spilled bottle rather than a particle emitter:
 *
 *  - Spawn angles advance by the golden angle, so consecutive pills never
 *    stack in the same column and never overlap at birth (an overlap makes
 *    Rapier shove them apart hard, which reads as an explosion).
 *  - Spawn radius follows sqrt(random), which distributes evenly over the
 *    disc instead of clumping at the middle, so the pile spreads into a
 *    natural mound with irregular spillover at the edges.
 */
function buildDropPlan(tier, reducedMotion) {
  const random = mulberry32(20260830);
  const count = tier.pillCount;
  const specs = [];

  for (let i = 0; i < count; i++) {
    const species = pickSpecies(random);

    const theta = i * 2.39996 + random() * 0.6;
    const radius = tier.spawnRadius * Math.sqrt(random());

    // Later pills arrive from slightly higher, so the tail of the drop is
    // still visibly falling once the base of the pile has formed.
    const baseHeight = reducedMotion ? 1.4 : 6.4 + (i / count) * 1.8;
    const height = baseHeight + random() * 2.1 + (i % 3) * 0.5;

    specs.push({
      key: `${species.id}-${i}`,
      species,
      position: [
        PILE_CENTER[0] + Math.cos(theta) * radius,
        height,
        PILE_CENTER[2] + Math.sin(theta) * radius * 0.85,
      ],
      rotation: [
        random() * Math.PI * 2,
        random() * Math.PI * 2,
        random() * Math.PI * 2,
      ],
      scale: 0.9 + random() * 0.24,
      linearVelocity: reducedMotion
        ? [0, 0, 0]
        : [(random() - 0.5) * 0.32, -1.4 - random() * 1.8, (random() - 0.5) * 0.32],
      angularVelocity: reducedMotion
        ? [0, 0, 0]
        : [
            (random() - 0.5) * 4.6,
            (random() - 0.5) * 4.6,
            (random() - 0.5) * 4.6,
          ],
    });
  }

  return specs;
}

/*
 * Bodies are mounted progressively rather than all at once. Beyond looking
 * right, it keeps Rapier's island count climbing gradually instead of
 * spiking on the first frame, so the drop starts smoothly even on a cold
 * JIT.
 */
export function PillDrop({ tier, reducedMotion }) {
  // Deliberately narrow deps: the tier object's identity also changes when
  // only the camera framing does (crossing the layout breakpoint), and
  // rebuilding the plan then would remount every body mid-fall.
  const specs = useMemo(
    () => buildDropPlan(tier, reducedMotion),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tier.pillCount, tier.spawnRadius, reducedMotion]
  );
  const [spawned, setSpawned] = useState(0);

  useEffect(() => {
    const batch = reducedMotion ? 6 : tier.spawnBatch;
    const interval = reducedMotion ? 32 : tier.spawnInterval;

    const timer = setInterval(() => {
      setSpawned((current) => {
        const next = Math.min(current + batch, specs.length);
        if (next >= specs.length) clearInterval(timer);
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [specs, tier.spawnBatch, tier.spawnInterval, reducedMotion]);

  return specs
    .slice(0, spawned)
    .map(({ key, ...spec }) => <Pill key={key} {...spec} />);
}
