// Client SystemManager (Track 0 Foundation).
//
// A registry so client feature "systems" can hook the game loop without editing
// the giant GameScene.update() body. A system implements any subset of:
//   { id, init(scene), update(scene, time, delta), shutdown() }
//
// GameScene wires this in three spots only:
//   create():   systemManager.init(this)
//   update():   systemManager.update(this, time, delta)
//   shutdown(): systemManager.shutdown()

export class SystemManager {
  constructor() {
    this.systems = [];
    this._initialized = false;
    this.scene = null;
  }

  // Register a system. Safe to call before or after init().
  register(system) {
    if (!system) return;
    this.systems.push(system);
    if (this._initialized && this.scene && typeof system.init === 'function') {
      try { system.init(this.scene); } catch (e) { console.error('[systems] init', system.id, e); }
    }
  }

  init(scene) {
    this.scene = scene;
    this._initialized = true;
    for (const s of this.systems) {
      if (typeof s.init === 'function') {
        try { s.init(scene); } catch (e) { console.error('[systems] init', s.id, e); }
      }
    }
  }

  update(scene, time, delta) {
    for (const s of this.systems) {
      if (typeof s.update === 'function') {
        try { s.update(scene, time, delta); } catch (e) { /* keep loop alive */ }
      }
    }
  }

  shutdown() {
    for (const s of this.systems) {
      if (typeof s.shutdown === 'function') {
        try { s.shutdown(); } catch (e) { /* ignore */ }
      }
    }
    this._initialized = false;
    this.scene = null;
  }
}

// Shared singleton instance used across the client.
export const systemManager = new SystemManager();
