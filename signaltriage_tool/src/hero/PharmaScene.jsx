import { Suspense } from "react";
import { PCFShadowMap } from "three";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Stage } from "./Stage";
import { Lighting } from "./Lighting";
import { CameraRig } from "./CameraRig";
import { PillDrop } from "./PillDrop";

/*
 * The WebGL layer. Everything visual composes here and nothing else in the
 * app knows this file exists -- the hero mounts it, the dashboard below is
 * completely unaware.
 *
 * `frameloop` is driven from outside: when the hero scrolls out of view the
 * whole loop, physics included, stops dead. There is no reason to simulate
 * a hundred rigid bodies for someone reading the signal table.
 */
export function PharmaScene({ tier, reducedMotion, active }) {
  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      dpr={tier.dpr}
      frameloop={active ? "always" : "never"}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
      }}
      camera={{ fov: 32, near: 0.5, far: 70, position: [0.3, 4.2, 9] }}
    >
      <fog attach="fog" args={["#152530", 9, 28]} />

      <Suspense fallback={null}>
        <Lighting tier={tier} />
        <CameraRig tier={tier} reducedMotion={reducedMotion} />

        <Physics gravity={[0, -22, 0]}>
          <Stage />
          {/* Keyed so a tier change (resize across a breakpoint) restarts
              the drop cleanly instead of mutating a running simulation. */}
          <PillDrop
            key={`${tier.name}-${reducedMotion}`}
            tier={tier}
            reducedMotion={reducedMotion}
          />
        </Physics>
      </Suspense>
    </Canvas>
  );
}
