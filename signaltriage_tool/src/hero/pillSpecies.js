import {
  createCapsuleGeometry,
  createTabletGeometry,
  createCapletGeometry,
  createSoftgelGeometry,
  measure,
} from "./pillGeometry";
import { pillMaterial } from "./pillMaterials";

/*
 * The catalogue. Each species pairs one shared geometry with one shared
 * material set and a physics collider that actually matches its silhouette
 * -- a capsule collider for capsules, a cylinder for tablets, a box for
 * caplets. Matching the collider to the shape is what makes the settled
 * pile look like it obeys the objects in it rather than floating on
 * invisible spheres.
 *
 * `weight` biases the random mix: mostly blue/white capsules and white
 * tablets with accent colours sprinkled through, which is what a real
 * spilled handful looks like.
 */

// ---------- shared geometries ----------
const CAPSULE_LG = createCapsuleGeometry({ radius: 0.165, bodyLength: 0.46 });
const CAPSULE_MD = createCapsuleGeometry({ radius: 0.142, bodyLength: 0.38 });
const CAPSULE_SM = createCapsuleGeometry({ radius: 0.12, bodyLength: 0.3 });

const TABLET_WIDE = createTabletGeometry({ radius: 0.3, thickness: 0.115, crown: 0.03 });
const TABLET_MD = createTabletGeometry({ radius: 0.235, thickness: 0.13, crown: 0.05 });
const TABLET_SM = createTabletGeometry({ radius: 0.175, thickness: 0.1, crown: 0.038 });
const TABLET_XS = createTabletGeometry({ radius: 0.125, thickness: 0.085, crown: 0.03 });

const CAPLET_LG = createCapletGeometry({ radius: 0.175, bodyLength: 0.42 });
const CAPLET_MD = createCapletGeometry({ radius: 0.145, bodyLength: 0.34 });

const SOFTGEL_LG = createSoftgelGeometry({ radius: 0.175, stretch: 1.5 });
const SOFTGEL_SM = createSoftgelGeometry({ radius: 0.13, stretch: 1.4 });

// ---------- collider descriptors ----------
function capsuleCollider(geometry) {
  const { x, y } = measure(geometry);
  return { type: "capsule", args: [y - x, x] }; // [halfHeight, radius], Y axis
}

function tabletCollider(geometry) {
  const { x, y } = measure(geometry);
  return { type: "cylinder", args: [y, x] }; // [halfHeight, radius], Y axis
}

function capletCollider(geometry) {
  const { x, y, z } = measure(geometry);
  // Inscribed rather than circumscribed: a box that hugs the rounded ends
  // too tightly is invisible in a pile, whereas one that is too loose makes
  // pills visibly hover.
  return { type: "cuboid", args: [x * 0.86, y * 0.94, z * 0.9] };
}

function softgelCollider(geometry) {
  const { x, z } = measure(geometry);
  return { type: "capsule", args: [x - z, z], rotation: [0, 0, Math.PI / 2] };
}

// ---------- palette (sampled from the reference composition) ----------
const WHITE = "#EDF0F3";
const OFF_WHITE = "#E2E6EA";
const CLINICAL_BLUE = "#2F80C4";
const SKY = "#59A7DF";
const NAVY = "#1E3A5C";
const CORAL = "#D14A3D";
const SALMON = "#DE8B7E";
const LAVENDER = "#B7A4D9";
const BLUSH = "#E3B7CE";
const AMBER = "#D98A16";
const GOLD = "#E2B23C";
const TERRACOTTA = "#B5714A";
const MINT = "#A8CFC2";
const SLATE = "#7C93A6";
const SAND = "#D9C9A8";

export const SPECIES = [
  // --- two-tone gelatin capsules ---
  {
    id: "cap-blue-white",
    geometry: CAPSULE_LG,
    materials: [pillMaterial("gelatin", CLINICAL_BLUE), pillMaterial("gelatin", WHITE)],
    collider: capsuleCollider(CAPSULE_LG),
    weight: 12,
  },
  {
    id: "cap-white-blue",
    geometry: CAPSULE_LG,
    materials: [pillMaterial("gelatin", WHITE), pillMaterial("gelatin", NAVY)],
    collider: capsuleCollider(CAPSULE_LG),
    weight: 7,
  },
  {
    id: "cap-coral-white",
    geometry: CAPSULE_LG,
    materials: [pillMaterial("gelatin", CORAL), pillMaterial("gelatin", WHITE)],
    collider: capsuleCollider(CAPSULE_LG),
    weight: 6,
  },
  {
    id: "cap-navy-sky",
    geometry: CAPSULE_MD,
    materials: [pillMaterial("gelatin", NAVY), pillMaterial("gelatin", SKY)],
    collider: capsuleCollider(CAPSULE_MD),
    weight: 5,
  },
  {
    id: "cap-salmon",
    geometry: CAPSULE_MD,
    materials: [pillMaterial("gelatin", SALMON), pillMaterial("gelatin", "#E9A79B")],
    collider: capsuleCollider(CAPSULE_MD),
    weight: 5,
  },
  {
    id: "cap-gold-blue",
    geometry: CAPSULE_MD,
    materials: [pillMaterial("gelatin", GOLD), pillMaterial("gelatin", CLINICAL_BLUE)],
    collider: capsuleCollider(CAPSULE_MD),
    weight: 4,
  },
  {
    id: "cap-lavender",
    geometry: CAPSULE_SM,
    materials: [pillMaterial("gelatin", LAVENDER), pillMaterial("gelatin", WHITE)],
    collider: capsuleCollider(CAPSULE_SM),
    weight: 4,
  },
  {
    id: "cap-sky-white",
    geometry: CAPSULE_SM,
    materials: [pillMaterial("gelatin", SKY), pillMaterial("gelatin", OFF_WHITE)],
    collider: capsuleCollider(CAPSULE_SM),
    weight: 6,
  },

  // --- compressed tablets ---
  {
    id: "tab-white-lg",
    geometry: TABLET_MD,
    materials: pillMaterial("matte", WHITE),
    collider: tabletCollider(TABLET_MD),
    weight: 11,
  },
  {
    id: "tab-terracotta",
    geometry: TABLET_WIDE,
    materials: pillMaterial("coated", TERRACOTTA),
    collider: tabletCollider(TABLET_WIDE),
    weight: 4,
  },
  {
    id: "tab-sky",
    geometry: TABLET_MD,
    materials: pillMaterial("coated", SKY),
    collider: tabletCollider(TABLET_MD),
    weight: 5,
  },
  {
    id: "tab-blush",
    geometry: TABLET_SM,
    materials: pillMaterial("matte", BLUSH),
    collider: tabletCollider(TABLET_SM),
    weight: 5,
  },
  {
    id: "tab-mint",
    geometry: TABLET_SM,
    materials: pillMaterial("matte", MINT),
    collider: tabletCollider(TABLET_SM),
    weight: 3,
  },
  {
    id: "tab-coral-sm",
    geometry: TABLET_XS,
    materials: pillMaterial("coated", CORAL),
    collider: tabletCollider(TABLET_XS),
    weight: 4,
  },
  {
    id: "tab-lavender-xs",
    geometry: TABLET_XS,
    materials: pillMaterial("matte", LAVENDER),
    collider: tabletCollider(TABLET_XS),
    weight: 4,
  },

  // --- oblong caplets ---
  {
    id: "caplet-white",
    geometry: CAPLET_LG,
    materials: pillMaterial("coated", WHITE),
    collider: capletCollider(CAPLET_LG),
    weight: 8,
  },
  {
    id: "caplet-slate",
    geometry: CAPLET_MD,
    materials: pillMaterial("coated", SLATE),
    collider: capletCollider(CAPLET_MD),
    weight: 4,
  },
  {
    id: "caplet-sand",
    geometry: CAPLET_MD,
    materials: pillMaterial("matte", SAND),
    collider: capletCollider(CAPLET_MD),
    weight: 3,
  },

  // --- softgels ---
  {
    id: "gel-amber",
    geometry: SOFTGEL_LG,
    materials: pillMaterial("gel", AMBER),
    collider: softgelCollider(SOFTGEL_LG),
    weight: 5,
  },
  {
    id: "gel-gold-sm",
    geometry: SOFTGEL_SM,
    materials: pillMaterial("gel", GOLD),
    collider: softgelCollider(SOFTGEL_SM),
    weight: 3,
  },
];

const TOTAL_WEIGHT = SPECIES.reduce((sum, s) => sum + s.weight, 0);

/** Weighted pick, driven by an injected RNG so drops are reproducible. */
export function pickSpecies(random) {
  let roll = random() * TOTAL_WEIGHT;
  for (const species of SPECIES) {
    roll -= species.weight;
    if (roll <= 0) return species;
  }
  return SPECIES[0];
}
