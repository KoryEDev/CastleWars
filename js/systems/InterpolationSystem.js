// Remote entity interpolation (Track 2 Netcode).
//
// Smooths remote player sprites between server snapshots instead of hard-snapping,
// which removes jitter during network gaps. Registered with the shared
// systemManager and driven once per frame from GameScene.update().
//
// Design notes:
// - Only affects REMOTE players (the local player stays server-authoritative/snapped).
// - Snaps instantly on large deltas (spawn/teleport) so entities never "slide" across
//   the map.
// - NPC rendering is intentionally left untouched to avoid any risk to PvE.

import { systemManager } from './SystemManager.js';

const LERP = 0.35; // easing per frame (~60fps); higher = snappier
const SNAP_DIST = 300; // px delta above which we snap instead of ease

const InterpolationSystem = {
  id: 'interpolation',

  update(scene) {
    const mp = scene && scene.multiplayer;
    if (!mp || !mp.otherSprites) return;

    for (const id in mp.otherSprites) {
      const s = mp.otherSprites[id];
      if (!s || s._serverX == null) continue;
      const dx = s._serverX - s.x;
      const dy = s._serverY - s.y;
      if (Math.abs(dx) > SNAP_DIST || Math.abs(dy) > SNAP_DIST) {
        s.x = s._serverX;
        s.y = s._serverY;
      } else {
        s.x += dx * LERP;
        s.y += dy * LERP;
      }
      // Keep the nameplate glued to the interpolated position.
      const name = mp.otherUsernames && mp.otherUsernames[id];
      if (name && name.setPosition) name.setPosition(s.x, s.y - 81);
    }
  }
};

systemManager.register(InterpolationSystem);

export default InterpolationSystem;
