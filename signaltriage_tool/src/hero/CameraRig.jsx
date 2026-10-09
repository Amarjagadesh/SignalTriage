import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { PILE_CENTER } from "./sceneLayout";

/*
 * Camera choreography, all of it deliberately restrained.
 *
 * Three things happen: an opening dolly that settles as the pile forms, a
 * very shallow mouse parallax, and an almost imperceptible drift so the
 * frame never feels frozen once everything has come to rest. The whole
 * budget is under half a world unit -- enough to feel alive, not enough to
 * read as an effect.
 *
 * Distance is solved every frame from the live aspect ratio rather than
 * fixed, which is what keeps the pile correctly framed from ultrawide down
 * to a portrait phone.
 */

const INTRO_SECONDS = 3.4;
const PITCH = 0.26; // camera rise per unit of distance -> ~15 degrees of downward tilt

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function solveDistance(camera, tier) {
  const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const tanHalf = Math.tan(halfFov);
  const forHeight = tier.frameHeight / 2 / tanHalf;
  const forWidth = tier.frameWidth / 2 / (tanHalf * Math.max(camera.aspect, 0.2));
  return Math.max(forHeight, forWidth);
}

export function CameraRig({ tier, reducedMotion }) {
  const { camera, pointer } = useThree();
  const intro = useRef(0);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.05);

    intro.current = Math.min(intro.current + step / INTRO_SECONDS, 1);
    const t = reducedMotion ? 1 : easeOutCubic(intro.current);

    const settled = solveDistance(camera, tier);
    // Opens wider and higher, then pulls in and tilts down as the pile builds.
    const distance = THREE.MathUtils.lerp(settled * 1.28, settled, t);
    const aimY = tier.targetY + tier.frameOffsetY;
    const height = aimY + distance * THREE.MathUtils.lerp(0.34, PITCH, t);

    const parallaxX = reducedMotion ? 0 : pointer.x * 0.42;
    const parallaxY = reducedMotion ? 0 : pointer.y * 0.2;
    const drift = reducedMotion
      ? 0
      : Math.sin(state.clock.elapsedTime * 0.17) * 0.11;

    // Both offsets are applied to camera and target together, which slides
    // the framing rather than swinging the camera around the pile -- the
    // viewing angle is preserved, only the composition moves. X clears the
    // left third for the headline on wide screens; Y drops the pile into the
    // lower half on portrait phones, where the copy sits above it instead.
    const offsetX = PILE_CENTER[0] + tier.frameOffsetX;

    desired.set(offsetX + parallaxX + drift, height + parallaxY, distance);
    target.set(offsetX, aimY, PILE_CENTER[2]);

    // Frame-rate independent damping -- a raw lerp factor would glide faster
    // on a 144Hz display than on a 60Hz one.
    const k = 1 - Math.exp(-5.5 * step);
    camera.position.lerp(desired, k);
    camera.lookAt(target);
  });

  return null;
}
