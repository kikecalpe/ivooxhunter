const COLORS = {
  reset: "\x1b[0m",
  debug: "\x1b[97m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[91m",
};

function timestamp() {
  return new Date().toISOString().substr(11, 8);
}

export function debugLog(enabled, ...args) {
  if (enabled) {
    console.log(`${COLORS.debug}[${timestamp()}] DEBUG:${COLORS.reset}`, ...args);
  }
}

export function infoLog(...args) {
  console.log(`${COLORS.info}[${timestamp()}] INFO:${COLORS.reset}`, ...args);
}

export function warnLog(...args) {
  console.warn(`${COLORS.warn}[${timestamp()}] WARNING:${COLORS.reset}`, ...args);
}

export function errorLog(error, ...args) {
  console.error(`${COLORS.error}[${timestamp()}] ERROR:${COLORS.reset}`, ...args);
  if (error?.stack) {
    console.error(`${COLORS.error}STACK TRACE:${COLORS.reset}`);
    console.error(error.stack);
  }
}
