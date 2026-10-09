import * as THREE from "three";

/*
 * Real pharmaceutical solids, built as lathed profiles rather than
 * primitives. A BoxGeometry or a bare CapsuleGeometry reads instantly as
 * "3D debugging object"; what sells a pill is the silhouette -- the ledge
 * where a capsule's cap slides over its body, and the biconvex crown of a
 * compressed tablet. Both are profile curves, so LatheGeometry is the
 * right tool and costs us nothing at runtime.
 *
 * Every geometry here is built once at module scope and shared across all
 * pill instances (see pillSpecies.js), so 120 pills cost 18 geometries.
 */

/**
 * Splits an indexed geometry into two material groups along a horizontal
 * plane, so a single mesh can be two-coloured. Triangles are bucketed by
 * their centroid; the capsule profile always places a vertex ring exactly
 * at `splitY`, so no triangle straddles the boundary and the seam is clean.
 */
function assignTwoToneGroups(geometry, splitY) {
  const position = geometry.attributes.position;
  const index = geometry.index;

  const lower = [];
  const upper = [];

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const centroidY =
      (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    (centroidY > splitY ? upper : lower).push(a, b, c);
  }

  const ordered = new index.array.constructor([...lower, ...upper]);
  geometry.setIndex(new THREE.BufferAttribute(ordered, 1));
  geometry.clearGroups();
  geometry.addGroup(0, lower.length, 0); // material 0 -> capsule body
  geometry.addGroup(lower.length, upper.length, 1); // material 1 -> capsule cap
  return geometry;
}

/**
 * A two-piece gelatin capsule.
 *
 * The `capOverlap` step is the detail that matters: on a real capsule the
 * cap is very slightly wider than the body and slides down over it, leaving
 * a visible ledge partway along. Without it you get a smooth pill-shaped
 * blob; with it you get something that reads as manufactured.
 */
export function createCapsuleGeometry({
  radius = 0.16,
  bodyLength = 0.44,
  capOverlap = 0.07,
  capFlare = 1.035,
  radialSegments = 26,
  arcSegments = 9,
  twoTone = true,
} = {}) {
  const half = bodyLength / 2;
  const capRadius = radius * capFlare;
  const points = [];

  // Bottom pole -> up around the lower hemisphere.
  for (let i = 0; i <= arcSegments; i++) {
    const angle = -Math.PI / 2 + (i / arcSegments) * (Math.PI / 2);
    points.push(
      new THREE.Vector2(radius * Math.cos(angle), -half + radius * Math.sin(angle))
    );
  }

  // Straight body wall up to the point where the cap begins.
  points.push(new THREE.Vector2(radius, -capOverlap));

  if (twoTone) {
    // The ledge: same height, wider radius. Creates the annular step.
    points.push(new THREE.Vector2(capRadius, -capOverlap));
  }

  const outerRadius = twoTone ? capRadius : radius;
  points.push(new THREE.Vector2(outerRadius, half));

  // Upper hemisphere -> top pole.
  for (let i = 1; i <= arcSegments; i++) {
    const angle = (i / arcSegments) * (Math.PI / 2);
    points.push(
      new THREE.Vector2(
        outerRadius * Math.cos(angle),
        half + outerRadius * Math.sin(angle)
      )
    );
  }

  // LatheGeometry derives normals from the profile tangents and handles the
  // degenerate pole triangles itself -- recomputing them would pinch the tips.
  const geometry = new THREE.LatheGeometry(points, radialSegments);

  if (twoTone) assignTwoToneGroups(geometry, -capOverlap);

  return geometry;
}

/**
 * A compressed tablet: biconvex faces meeting a straight rim band.
 *
 * `crown` controls how domed the faces are (0 = flat punch, high = deeply
 * convex). `rimRatio` is how much of the total thickness is the flat edge.
 */
export function createTabletGeometry({
  radius = 0.24,
  thickness = 0.12,
  crown = 0.045,
  rimRatio = 0.55,
  radialSegments = 30,
  faceSegments = 8,
} = {}) {
  const rimHalf = (thickness * rimRatio) / 2;
  const points = [];

  // Bottom face: rim edge inward to the bottom pole (profile runs bottom-up,
  // so we walk this face from its outer edge to its centre in reverse).
  for (let i = faceSegments; i >= 0; i--) {
    const t = (i / faceSegments) * (Math.PI / 2);
    points.push(
      new THREE.Vector2(radius * Math.sin(t), -rimHalf - crown * Math.cos(t))
    );
  }
  points.reverse(); // now runs bottom pole -> lower rim edge

  // Straight rim band (the lower edge is already the last point above).
  points.push(new THREE.Vector2(radius, rimHalf));

  // Top face: rim edge up to the crown.
  for (let i = 1; i <= faceSegments; i++) {
    const t = (i / faceSegments) * (Math.PI / 2);
    points.push(
      new THREE.Vector2(radius * Math.cos(t), rimHalf + crown * Math.sin(t))
    );
  }

  return new THREE.LatheGeometry(points, radialSegments);
}

/**
 * An oblong caplet -- a capsule profile laid on its side and flattened,
 * which is exactly how the real thing is pressed.
 */
export function createCapletGeometry({
  radius = 0.18,
  bodyLength = 0.4,
  flatten = 0.62,
  radialSegments = 24,
  arcSegments = 8,
} = {}) {
  const geometry = createCapsuleGeometry({
    radius,
    bodyLength,
    radialSegments,
    arcSegments,
    twoTone: false,
  });
  geometry.rotateZ(Math.PI / 2); // long axis -> X
  geometry.scale(1, flatten, 1); // press it flat
  return geometry;
}

/**
 * A liquid-filled softgel: a stretched ellipsoid lying on its side.
 */
export function createSoftgelGeometry({
  radius = 0.17,
  stretch = 1.5,
  squash = 0.92,
  widthSegments = 28,
  heightSegments = 20,
} = {}) {
  const geometry = new THREE.SphereGeometry(
    radius,
    widthSegments,
    heightSegments
  );
  geometry.scale(stretch, squash, squash);
  return geometry;
}

/** Half-extents of a geometry, used to derive matching physics colliders. */
export function measure(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  return {
    x: (box.max.x - box.min.x) / 2,
    y: (box.max.y - box.min.y) / 2,
    z: (box.max.z - box.min.z) / 2,
  };
}
