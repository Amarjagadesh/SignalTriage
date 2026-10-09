import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { createFloorMaterial } from "./pillMaterials";

/*
 * A studio cyclorama drawn into a 2D canvas rather than a shader.
 *
 * The look we want is the soft halo behind the subject that a lit backdrop
 * gives you in a real product shoot. A radial gradient does that exactly,
 * and painting it once into a texture avoids both a custom shader and any
 * per-frame cost -- the plane is a MeshBasicMaterial that never lights,
 * never fogs and never writes depth.
 */
function createBackdropTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#070E12";
  ctx.fillRect(0, 0, size, size);

  // Squashed horizontally so the halo reads as a wide studio backdrop
  // rather than a spotlight circle.
  ctx.save();
  ctx.translate(size * 0.58, size * 0.52);
  ctx.scale(1.5, 1);
  const gradient = ctx.createRadialGradient(0, 0, size * 0.02, 0, 0, size * 0.5);
  gradient.addColorStop(0, "#54748A");
  gradient.addColorStop(0.3, "#33505F");
  gradient.addColorStop(0.62, "#1B2E3A");
  gradient.addColorStop(1, "#070E12");
  ctx.fillStyle = gradient;
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Backdrop() {
  const texture = useMemo(() => createBackdropTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, 3, -22]} renderOrder={-1}>
      <planeGeometry args={[74, 34]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        fog={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/*
 * The floor is a single fixed body with a thick slab collider under it.
 * A thin collider lets fast bodies tunnel through on the first frame;
 * half a unit of depth costs nothing and makes that impossible.
 */
function Floor() {
  const material = useMemo(() => createFloorMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <>
      <RigidBody type="fixed" friction={1.15} restitution={0.16}>
        <CuboidCollider args={[18, 0.5, 18]} position={[0, -0.5, 0]} />
      </RigidBody>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0, 0]}
        receiveShadow
        material={material}
      >
        <planeGeometry args={[70, 70]} />
      </mesh>
    </>
  );
}

/*
 * Invisible containment, set well outside the framing. Pills almost never
 * reach it -- it exists so a freak bounce can't send one skating out of
 * shot and leave a gap in the pile.
 */
function Bounds() {
  return (
    <RigidBody type="fixed" friction={0.5} restitution={0.1}>
      <CuboidCollider args={[0.5, 8, 12]} position={[-6.5, 8, 0]} />
      <CuboidCollider args={[0.5, 8, 12]} position={[7.4, 8, 0]} />
      <CuboidCollider args={[12, 8, 0.5]} position={[0, 8, -5.5]} />
      <CuboidCollider args={[12, 8, 0.5]} position={[0, 8, 5]} />
    </RigidBody>
  );
}

export function Stage() {
  return (
    <>
      <Backdrop />
      <Floor />
      <Bounds />
    </>
  );
}
