// Client net handler registry (Track 0 Foundation).
//
// Standard place to attach socket.on(...) listeners per feature without editing
// GameScene's large socket-handler block. Each handler module is a function
// (scene, socket) => void that registers its own listeners.
//
// GameScene calls registerNetHandlers(this, socket) once after the socket exists.

const handlerFactories = [];

// Feature tracks call this (at import time) to add a handler registrar.
export function addNetHandler(factory) {
  if (typeof factory === 'function') handlerFactories.push(factory);
}

export function registerNetHandlers(scene, socket) {
  if (!socket) return;
  for (const factory of handlerFactories) {
    try {
      factory(scene, socket);
    } catch (e) {
      console.error('[net] handler registration failed', e);
    }
  }
}
