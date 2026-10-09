import {
  RigidBody,
  CapsuleCollider,
  CylinderCollider,
  CuboidCollider,
} from "@react-three/rapier";

const COLLIDERS = {
  capsule: CapsuleCollider,
  cylinder: CylinderCollider,
  cuboid: CuboidCollider,
};

/*
 * A single pill: one dynamic body, one collider shaped like the pill, one
 * mesh sharing a cached geometry and material set.
 *
 * The collider is declared explicitly rather than letting Rapier infer a
 * convex hull from the mesh -- hull generation would run per body at spawn
 * time, and these four primitives already match the silhouettes exactly.
 *
 * Scale is applied to the mesh and folded into the collider args by hand,
 * because scaling the RigidBody itself would desynchronise the two.
 */
export function Pill({
  species,
  position,
  rotation,
  scale = 1,
  linearVelocity,
  angularVelocity,
}) {
  const { collider, geometry, materials } = species;
  const Collider = COLLIDERS[collider.type];
  const args = collider.args.map((value) => value * scale);

  return (
    <RigidBody
      position={position}
      rotation={rotation}
      linearVelocity={linearVelocity}
      angularVelocity={angularVelocity}
      colliders={false}
      restitution={0.16}
      friction={0.86}
      linearDamping={0.17}
      angularDamping={0.55}
      density={1.15}
    >
      <Collider args={args} rotation={collider.rotation} />
      <mesh
        geometry={geometry}
        material={materials}
        scale={scale}
        castShadow
        receiveShadow
      />
    </RigidBody>
  );
}
