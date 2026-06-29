// Quest engine (Track 15). Assigns daily quests, tracks progress against gameplay
// metrics, and awards gold/XP on completion. Shared by both servers.

const { DAILY_QUESTS } = require('../shared/quests');

function assign(player) {
  player.activeQuests = player.activeQuests || {};
  DAILY_QUESTS.forEach((q) => {
    if (!player.activeQuests[q.id]) player.activeQuests[q.id] = { progress: 0, completed: false };
  });
}

function getList(player) {
  player.activeQuests = player.activeQuests || {};
  return DAILY_QUESTS.map((q) => ({
    id: q.id, name: q.name, desc: q.desc, target: q.target,
    progress: (player.activeQuests[q.id] && player.activeQuests[q.id].progress) || 0,
    completed: (player.activeQuests[q.id] && player.activeQuests[q.id].completed) || false,
    rewardGold: q.rewardGold, rewardXp: q.rewardXp
  }));
}

// Track progress on a metric. awardXp(amount) optionally grants XP via the caller's
// progression helper. `mode` of 'set' (e.g. wave reached) uses max instead of add.
function track(io, socket, player, metric, amount, awardXp, mode) {
  if (!player) return;
  assign(player);
  let changed = false;
  DAILY_QUESTS.forEach((q) => {
    if (q.metric !== metric) return;
    const st = player.activeQuests[q.id];
    if (st.completed) return;
    st.progress = mode === 'set' ? Math.max(st.progress || 0, amount) : Math.min(q.target, (st.progress || 0) + amount);
    if (st.progress > q.target) st.progress = q.target;
    changed = true;
    if (st.progress >= q.target) {
      st.completed = true;
      player.gold = (player.gold || 0) + q.rewardGold;
      if (typeof awardXp === 'function') awardXp(q.rewardXp);
      if (socket) socket.emit('questCompleted', { id: q.id, name: q.name, rewardGold: q.rewardGold, rewardXp: q.rewardXp });
    }
  });
  if (changed && socket) socket.emit('questUpdate', { quests: getList(player) });
}

function register(io, socket, ctx) {
  socket.on('requestQuests', () => {
    const player = ctx.gameState.players[socket.id];
    if (!player) return;
    assign(player);
    socket.emit('questUpdate', { quests: getList(player) });
  });
}

module.exports = { assign, getList, track, register };
