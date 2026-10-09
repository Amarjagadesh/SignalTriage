import * as THREE from "three";

/*
 * Four surface finishes, because real pharmaceuticals only have four:
 * a gelatin capsule shell, a film-coated tablet, a bare compressed tablet,
 * and a liquid-filled softgel. Getting the roughness/clearcoat split right
 * between them is most of what separates "pills" from "coloured plastic".
 *
 * Materials are cached by (finish + colour) and shared across every pill,
 * so a 120-pill scene compiles a handful of shader programs, not 120.
 */

const cache = new Map();

const FINISHES = {
  /* Hard gelatin capsule: deep gloss over a slightly soft base. */
  gelatin: (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.24,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.09,
      envMapIntensity: 1.15,
    }),

  /* Film-coated tablet: satin sheen, not mirror. */
  coated: (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.36,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.95,
    }),

  /* Uncoated compressed powder: chalky, almost no specular. */
  matte: (color) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0,
      envMapIntensity: 0.7,
    }),

  /*
   * Softgel. True transmission would cost a full extra scene render per
   * frame for maybe eight objects, so instead we fake the light that
   * scatters through the shell: near-mirror clearcoat plus a low emissive
   * of the same hue. Reads as liquid-filled at a fraction of the cost.
   */
  gel: (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.07,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 2.4,
      emissive: new THREE.Color(color).multiplyScalar(0.22),
    }),
};

export function pillMaterial(finish, color) {
  const key = `${finish}:${color}`;
  let material = cache.get(key);
  if (!material) {
    material = FINISHES[finish](color);
    cache.set(key, material);
  }
  return material;
}

/** Dark, faintly metallic studio floor -- picks up the lightformer rig. */
export function createFloorMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#17272F",
    roughness: 0.52,
    metalness: 0.28,
    envMapIntensity: 1.1,
  });
}

export function disposeMaterialCache() {
  cache.forEach((material) => material.dispose());
  cache.clear();
}
