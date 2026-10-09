/*
 * Shared world-space anchors. Lives in its own module so the camera rig and
 * the drop planner agree on where the pile is without importing each other.
 */

/** Where pills are dropped, and what the camera frames. */
export const PILE_CENTER = [0.45, 0, 0];
