// Player classes + abilities (Track 4). Shared so both servers and (a mirror in) the
// client agree. Effects are intentionally limited to two server-safe primitives -
// `heal` and `damageBoost` - so abilities never destabilise movement/physics.

const CLASSES = {
  soldier: {
    name: 'Soldier',
    description: 'Durable frontline fighter.',
    passive: { maxHealthBonus: 25 },
    ability: { id: 'adrenaline', name: 'Adrenaline', cooldown: 12000, type: 'damageBoost', duration: 6000, mult: 1.6 }
  },
  medic: {
    name: 'Medic',
    description: 'Heals self and nearby allies.',
    passive: { maxHealthBonus: 0 },
    ability: { id: 'healpulse', name: 'Heal Pulse', cooldown: 14000, type: 'heal', amount: 60, radius: 320 }
  },
  scout: {
    name: 'Scout',
    description: 'Fragile but recovers fast.',
    passive: { maxHealthBonus: -10 },
    ability: { id: 'secondwind', name: 'Second Wind', cooldown: 9000, type: 'heal', amount: 35, radius: 0 }
  },
  builder: {
    name: 'Builder',
    description: 'Tough defender.',
    passive: { maxHealthBonus: 15 },
    ability: { id: 'patchup', name: 'Patch Up', cooldown: 12000, type: 'heal', amount: 30, radius: 0 }
  },
  engineer: {
    name: 'Engineer',
    description: 'Boosts weapon output.',
    passive: { maxHealthBonus: 10 },
    ability: { id: 'overcharge', name: 'Overcharge', cooldown: 13000, type: 'damageBoost', duration: 5000, mult: 1.5 }
  }
};

const DEFAULT_CLASS = 'soldier';
const BASE_MAX_HEALTH = 100;

function getClass(classId) {
  return CLASSES[classId] || CLASSES[DEFAULT_CLASS];
}

module.exports = { CLASSES, DEFAULT_CLASS, BASE_MAX_HEALTH, getClass };
