import config from "./config.json" assert { type: "json" };

// Colores ANSI
const COLORS = {
  reset: "\x1b[0m",
  debug: "\x1b[97m", // blanco brillante
  info: "\x1b[36m",  // cian
  warn: "\x1b[33m",  // amarillo
  error: "\x1b[91m", // rojo brillante
};

export function debugLog(...args) {
  if (config.debug) {
    console.log(`${COLORS.debug}DEBUG:${COLORS.reset}`, ...args);
  }
}

export function infoLog(...args) {
  console.log(`${COLORS.info}INFO:${COLORS.reset}`, ...args);
}

export function warnLog(...args) {
  console.warn(`${COLORS.warn}WARNING:${COLORS.reset}`, ...args);
}

export function errorLog(error, ...args) {
  console.error(`${COLORS.error}ERROR:${COLORS.reset}`, ...args);

  if (config.debug && error?.stack) {
    console.error(`${COLORS.error}STACK TRACE:${COLORS.reset}`);
    console.error(error.stack);
  }
}
