import { Environment, Lightformer, ContactShadows } from "@react-three/drei";

/*
 * A four-light product-photography rig, plus an environment built from
 * lightformers instead of a downloaded HDRI.
 *
 * The environment matters more than the lights here: glossy capsule shells
 * are almost entirely reflection, so what you actually see on them is the
 * shape of the softbox. Building that rig in-scene means no CDN fetch, no
 * loading state, and complete control over where the highlights land --
 * and with frames={1} it bakes once and costs nothing afterwards.
 */
export function Lighting({ tier }) {
  return (
    <>
      {/* Cool ambient bounce, standing in for light off the cyclorama. */}
      <ambientLight intensity={0.26} color="#8FAEC2" />

      {/* Key: high front-right, the only shadow caster. Bounds are drawn
          tight around the pile so the 2k map isn't wasted on empty floor. */}
      <directionalLight
        castShadow
        position={[4.6, 8.2, 5.4]}
        intensity={3.6}
        color="#FFF4E6"
        shadow-mapSize={[tier.shadowMapSize, tier.shadowMapSize]}
        shadow-bias={-0.0007}
        shadow-normalBias={0.022}
        shadow-camera-near={1}
        shadow-camera-far={24}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />

      {/* Cool rim from behind-left: separates the pile from the backdrop. */}
      <directionalLight position={[-6.5, 3.4, -4.5]} intensity={1.5} color="#5E94CC" />

      {/* Warm kicker, low and behind: catches the underside of the capsules. */}
      <directionalLight position={[5.2, 1.1, -5]} intensity={0.85} color="#FFB271" />

      <Environment resolution={256} frames={1}>
        {/* Large overhead softbox -- the primary highlight on every gloss surface. */}
        <Lightformer
          form="rect"
          intensity={5}
          position={[0.5, 7, 3]}
          scale={[9, 5, 1]}
          rotation-x={Math.PI / 2}
          color="#FFFFFF"
        />
        {/* Cool side panel. */}
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[-7, 2.5, 1]}
          scale={[5, 7, 1]}
          rotation-y={Math.PI / 2}
          color="#A8CDE8"
        />
        {/* Warm opposite panel, dimmer -- keeps the shadow side from going flat. */}
        <Lightformer
          form="rect"
          intensity={1.9}
          position={[7, 2, -1]}
          scale={[5, 7, 1]}
          rotation-y={-Math.PI / 2}
          color="#FFD3A1"
        />
        {/* Small bright ring: the crisp specular dot on the softgels. */}
        <Lightformer
          form="ring"
          intensity={4}
          position={[2.5, 4.5, -5]}
          scale={3}
          color="#FFFFFF"
        />
      </Environment>

      {/*
        Grounding occlusion under the pile. The shadow map handles cast
        shadows, but contact darkening is what actually makes objects read
        as resting on a surface rather than hovering above one.
      */}
      {tier.contactShadows && (
        <ContactShadows
          position={[0.45, 0.012, 0]}
          scale={11}
          resolution={512}
          blur={2.4}
          opacity={0.62}
          far={1.6}
          color="#02080B"
        />
      )}
    </>
  );
}
