// Server-side ability + class handling (Track 4), shared by both game servers.
//
// Usage in each server:
//   const abilities = require('./server/abilities');
//   io.on('connection', socket => abilities.register(io, socket, { gameState, Player }));
//   // in join handler, after the player object exists: abilities.applyClassPassive(player);
//   // in bullet damage calc: dmg = abilities.applyDamageBoost(player, dmg);

const { getClass, BASE_MAX_HEALTH } = require('../shared/classes');

// Apply a class's passive max-health bonus to a freshly-joined player.
function applyClassPassive(player) {
  if (!player) return;
  const cls = getClass(player.classId);
  const bonus = (cls.passive && cls.passive.maxHealthBonus) || 0;
  const newMax = BASE_MAX_HEALTH + bonus;
  player.maxHealth = newMax;
  if (player.stats) player.stats.maxHealth = newMax;
  // Don't reduce current health below new max unexpectedly; clamp up to max on spawn.
  if (player.health == null || player.health > newMax) player.health = newMax;
}

// Multiply outgoing damage if the player has an active damage-boost buff.
function applyDamageBoost(player, damage) {
  if (player && player.damageBoostUntil && Date.now() < player.damageBoostUntil) {
    return Math.floor(damage * (player.damageBoostMult || 1.5));
  }
  return damage;
}

function register(io, socket, ctx) {
  const { gameState, Player } = ctx;

  socket.on('selectClass', ({ classId }) => {
    const player = gameState.players[socket.id];
    if (!player) return;
    if (!getClass(classId)) return;
    player.classId = classId;
    applyClassPassive(player);
    if (Player) Player.updateOne({ username: player.username }, { $set: { classId } }).catch(() => {});
    socket.emit('classSelected', { classId, maxHealth: player.maxHealth, health: player.health });
  });

  socket.on('useAbility', () => {
    const player = gameState.players[socket.id];
    if (!player) return;
    const cls = getClass(player.classId);
    const ab = cls.ability;
    const now = Date.now();
    player._abilityReadyAt = player._abilityReadyAt || 0;
    if (now < player._abilityReadyAt) {
      socket.emit('abilityCooldown', { remaining: player._abilityReadyAt - now });
      return;
    }
    player._abilityReadyAt = now + ab.cooldown;

    if (ab.type === 'heal') {
      healTarget(io, gameState, player, socket.id, ab.amount);
      if (ab.radius > 0) {
        // Heal nearby allies too.
        for (const sid in gameState.players) {
          if (sid === socket.id) continue;
          const other = gameState.players[sid];
          if (!other || other.isDead) continue;
          const dx = (other.x || 0) - (player.x || 0);
          const dy = (other.y || 0) - (player.y || 0);
          if (Math.sqrt(dx * dx + dy * dy) <= ab.radius) {
            healTarget(io, gameState, other, sid, Math.floor(ab.amount * 0.6));
          }
        }
      }
    } else if (ab.type === 'damageBoost') {
      player.damageBoostUntil = now + ab.duration;
      player.damageBoostMult = ab.mult;
    }

    io.emit('abilityUsed', { playerId: socket.id, abilityId: ab.id, type: ab.type, x: player.x, y: player.y });
    socket.emit('abilityCooldown', { remaining: ab.cooldown, abilityId: ab.id });
  });
}

function healTarget(io, gameState, target, sid, amount) {
  const max = target.maxHealth || (target.stats && target.stats.maxHealth) || 100;
  target.health = Math.min(max, (target.health || 0) + amount);
  if (target.stats) target.stats.health = target.health;
  io.emit('abilityHeal', { targetId: sid, health: target.health, maxHealth: max });
}

module.exports = { register, applyClassPassive, applyDamageBoost };
