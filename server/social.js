// Social systems (Track 8): clans/guilds, friends, clan chat. Shared by both servers.
// Persistence via models/Clan and models/Friendship; broadcasts via socket events.
//
// Usage: io.on('connection', socket => social.register(io, socket, { gameState, Player }));

const Clan = require('../models/Clan');
const Friendship = require('../models/Friendship');
const Player = require('../models/Player');

function playerFor(gameState, socketId) {
  return gameState.players[socketId] || null;
}

async function sendClanState(socket, username) {
  try {
    const player = await Player.findOne({ username });
    if (!player || !player.clanId) { socket.emit('clanUpdate', { clan: null }); return; }
    const clan = await Clan.findOne({ name: player.clanId });
    socket.emit('clanUpdate', { clan: clan ? { name: clan.name, tag: clan.tag, level: clan.level, members: clan.members } : null });
  } catch (e) { /* ignore */ }
}

function register(io, socket, ctx) {
  const { gameState } = ctx;

  socket.on('createClan', async ({ name, tag }) => {
    const player = playerFor(gameState, socket.id);
    if (!player) return;
    name = String(name || '').trim().slice(0, 24);
    tag = String(tag || '').trim().slice(0, 5).toUpperCase();
    if (!name || !tag) { socket.emit('clanError', { message: 'Name and tag required' }); return; }
    try {
      const existing = await Clan.findOne({ name });
      if (existing) { socket.emit('clanError', { message: 'Clan name taken' }); return; }
      const clan = await Clan.create({ name, tag, owner: player.username, members: [{ username: player.username, rank: 'leader' }] });
      await Player.updateOne({ username: player.username }, { $set: { clanId: name } });
      player.clanId = name;
      socket.emit('clanUpdate', { clan: { name: clan.name, tag: clan.tag, level: clan.level, members: clan.members } });
      socket.emit('clanInfo', { message: `Clan [${tag}] ${name} created!` });
    } catch (e) { socket.emit('clanError', { message: 'Could not create clan' }); }
  });

  socket.on('joinClan', async ({ name }) => {
    const player = playerFor(gameState, socket.id);
    if (!player) return;
    try {
      const clan = await Clan.findOne({ name: String(name || '').trim() });
      if (!clan) { socket.emit('clanError', { message: 'Clan not found' }); return; }
      if (clan.members.some(m => m.username === player.username)) { socket.emit('clanError', { message: 'Already a member' }); return; }
      clan.members.push({ username: player.username, rank: 'member' });
      await clan.save();
      await Player.updateOne({ username: player.username }, { $set: { clanId: clan.name } });
      player.clanId = clan.name;
      socket.emit('clanUpdate', { clan: { name: clan.name, tag: clan.tag, level: clan.level, members: clan.members } });
      socket.emit('clanInfo', { message: `Joined [${clan.tag}] ${clan.name}` });
    } catch (e) { socket.emit('clanError', { message: 'Could not join clan' }); }
  });

  socket.on('leaveClan', async () => {
    const player = playerFor(gameState, socket.id);
    if (!player || !player.clanId) return;
    try {
      const clan = await Clan.findOne({ name: player.clanId });
      if (clan) {
        clan.members = clan.members.filter(m => m.username !== player.username);
        if (clan.members.length === 0) await Clan.deleteOne({ name: clan.name });
        else await clan.save();
      }
      await Player.updateOne({ username: player.username }, { $set: { clanId: null } });
      player.clanId = null;
      socket.emit('clanUpdate', { clan: null });
    } catch (e) { /* ignore */ }
  });

  socket.on('listClans', async () => {
    try {
      const clans = await Clan.find({}).sort({ level: -1 }).limit(20);
      socket.emit('clanList', { clans: clans.map(c => ({ name: c.name, tag: c.tag, level: c.level, members: c.members.length })) });
    } catch (e) { socket.emit('clanList', { clans: [] }); }
  });

  socket.on('requestClan', async () => {
    const player = playerFor(gameState, socket.id);
    if (player) await sendClanState(socket, player.username);
  });

  // Clan chat: relay to all online members of the same clan.
  socket.on('clanChat', ({ message }) => {
    const player = playerFor(gameState, socket.id);
    if (!player || !player.clanId) return;
    const text = String(message || '').slice(0, 200);
    if (!text) return;
    for (const sid in gameState.players) {
      if (gameState.players[sid].clanId === player.clanId) {
        io.to(sid).emit('clanChat', { from: player.username, message: text });
      }
    }
  });

  // Friends.
  socket.on('addFriend', async ({ username }) => {
    const player = playerFor(gameState, socket.id);
    if (!player) return;
    const target = String(username || '').trim().toLowerCase();
    if (!target || target === player.username) { socket.emit('friendError', { message: 'Invalid user' }); return; }
    try {
      const exists = await Player.findOne({ username: target });
      if (!exists) { socket.emit('friendError', { message: 'User not found' }); return; }
      await Friendship.updateOne(
        { requester: player.username, recipient: target },
        { $setOnInsert: { status: 'accepted' } }, // simple mutual-accept model
        { upsert: true }
      );
      socket.emit('friendInfo', { message: `Added ${target} as friend` });
      socket.emit('friendAdded', { username: target });
    } catch (e) { socket.emit('friendError', { message: 'Could not add friend' }); }
  });

  socket.on('listFriends', async () => {
    const player = playerFor(gameState, socket.id);
    if (!player) return;
    try {
      const fs = await Friendship.find({ $or: [{ requester: player.username }, { recipient: player.username }], status: 'accepted' });
      const names = new Set();
      fs.forEach(f => { names.add(f.requester === player.username ? f.recipient : f.requester); });
      const online = new Set(Object.values(gameState.players).map(p => p.username));
      socket.emit('friendList', { friends: Array.from(names).map(n => ({ username: n, online: online.has(n) })) });
    } catch (e) { socket.emit('friendList', { friends: [] }); }
  });
}

module.exports = { register };
