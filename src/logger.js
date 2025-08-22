// logger.js
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Obtiene la ruta absoluta de config.json relativa a logger.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, "config.json");

// Carga y parsea config.json manualmente
const config = JSON.parse(readFileSync(configPath, "utf-8"));

// Colores ANSI
const COLORS = {
  reset: "\x1b[0m",
  debug: "\x1b[97m",  // Blanco brillante
  info: "\x1b[36m",   // Cian
  warn: "\x1b[33m",   // Amarillo
  error: "\x1b[91m",  // Rojo brillante
};

// Genera la marca de tiempo [HH:MM:SS]
function timestamp() {
  return new Date().toISOString().substr(11, 8);
}

export function debugLog(...args) {
  if (config.debug) {
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
  if (config.debug && error?.stack) {
    console.error(`${COLORS.error}STACK TRACE:${COLORS.reset}`);
    console.error(error.stack);
  }
}
