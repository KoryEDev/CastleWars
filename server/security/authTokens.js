// In-memory auth token store (Track 1 Security).
//
// Closes the socket-impersonation hole: a token is issued on successful REST
// login/register and must be presented (and matched) on socket verifyLogin/join.
// Per-process map; login and socket happen on the same server process.

const crypto = require('crypto');

const tokens = new Map(); // usernameLower -> { token, expires }
const TTL_MS = 1000 * 60 * 60 * 12; // 12h

function issue(username) {
  const key = String(username).toLowerCase();
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(key, { token, expires: Date.now() + TTL_MS });
  return token;
}

function validate(username, token) {
  if (!username || !token) return false;
  const entry = tokens.get(String(username).toLowerCase());
  if (!entry) return false;
  if (entry.expires < Date.now()) {
    tokens.delete(String(username).toLowerCase());
    return false;
  }
  return entry.token === token;
}

function revoke(username) {
  tokens.delete(String(username).toLowerCase());
}

module.exports = { issue, validate, revoke };
