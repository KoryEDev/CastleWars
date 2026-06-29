// Minimal structured logger (Track 16). Level-gated, timestamped, tagged output.
// Set LOG_LEVEL=error|warn|info|debug (default info). Existing console.log calls are
// left in place; new code should prefer this logger.

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] != null
  ? LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()]
  : LEVELS.info;

function fmt(level, tag, args) {
  const ts = new Date().toISOString();
  return [`[${ts}] [${level.toUpperCase()}]${tag ? ' [' + tag + ']' : ''}`, ...args];
}

function make(level) {
  return (tag, ...args) => {
    if (LEVELS[level] > current) return;
    const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    out(...fmt(level, tag, args));
  };
}

module.exports = {
  error: make('error'),
  warn: make('warn'),
  info: make('info'),
  debug: make('debug')
};
