import fs from "fs";
import url from "url";
import path from "path";
import prompt from "prompt";
import axios from "axios";
import sanitize from "sanitize-filename";
import NodeID3 from 'node-id3';
import colors from "colors/safe.js";
import ivoox from "./ivoox.js";
import { debugLog, infoLog, warnLog, errorLog } from "./logger.js";


let config = {};
let isDebug = true; //inicializamos según interese y luego leemos de config.json
const basePath = url.fileURLToPath(new URL("..", import.meta.url));
debugLog(isDebug, `basePath: ${basePath}`);

prompt.start();
prompt.message = "";
prompt.delimiter = "";

// Leer configuración
const configUrl = path.join(basePath, "config.json");
debugLog(isDebug, `configURl: ${configUrl}`);
try {
  config = JSON.parse(fs.readFileSync(configUrl));
  // Leemos config.debug de config.json
  isDebug = config.debug;
  debugLog(isDebug, `config.isDebug: ${isDebug}\n`);
} catch (err) {
  errorLog(isDebug, err, "\nArchivo de configuración no encontrado.\n");
  process.exit(1);
}
debugLog(isDebug, `config.downloadPath: ${colors.green(config.downloadPath)}\n`);

// mensajes log de ejemplo, borrar luego
infoLog("Proceso iniciado correctamente");
warnLog("Este es un aviso");
try {
  throw new Error("Algo salió mal");
} catch (err) {
  errorLog(isDebug, err, "Ocurrió un error mientras se descargaba el archivo");
}

if (!path.isAbsolute(config.downloadPath)) {
  config.downloadPath = path.join(basePath, config.downloadPath);
}

// Mostrar nombre del script
const packageJsonUrl = path.join(basePath, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonUrl));
infoLog(`\n${packageJson.name} ${packageJson.version}\n`);
infoLog(`Los episodios se descargarán en: ${colors.green(config.downloadPath)}\n`);

let continueApp = true;

while (continueApp) {
  let podcasts = config.podcasts;
  console.log("Mis podcasts:\n");

  const longestIndex = String(podcasts.length).length;
  podcasts.forEach((podcast, idx) => {
    const indexSpaces = ' '.repeat(longestIndex - String(idx + 1).length);
    console.log(`  ${indexSpaces}${idx + 1}. ${podcast.name}`);
  });

  const indexSpaces = ' '.repeat(longestIndex - 1);
  console.log(`  ${indexSpaces}0. Salir`);

  const { podcastNum } = await prompt.get({
    properties: {
      podcastNum: {
        description: "\n¿Qué podcast quieres consultar?",
        default: 0,
        type: "integer"
      }
    }
  });

  if (podcastNum === 0) {
    infoLog("\nSaliendo...\n");
    break;
  }

  const selectedPodcast = podcasts[podcastNum - 1];
  let currentPage = selectedPodcast.url;
  let episodes = [];
  let morePages = true;

  while (morePages) {
    infoLog(`\nConsultando: ${selectedPodcast.name}\n`);
    const newEpisodes = await ivoox.getEpisodes(isDebug, currentPage, null, config.requestWait);

    if (newEpisodes.length === 0) {
      warnLog("\nNo se encontraron episodios.\n");
      break;
    }

    newEpisodes.forEach(ep => ep.podcast = selectedPodcast.name);
    episodes = episodes.concat(newEpisodes);

    // Mostrar episodios
    episodes.forEach((episode, idx) => {
      const title = episode.title;
      const premiumMark = episode.premium ? colors.red("[PREMIUM] ") : "";
      console.log(`  ${String(idx + 1).padStart(2, " ")}. ${premiumMark}${title} (${episode.dateRelative})`);
    });

    // Preguntar qué hacer
    const { action } = await prompt.get({
      properties: {
        action: {
          description: 
            "\n\x1b[97mIntroduce números para descargar separados por espacios (ej: 1 3 5)\x1b[0m, " +
            "para \x1b[97msiguiente\x1b[0m página pulsa \x1b[97m(s)\x1b[0m, " +
            "para ver \x1b[97motro\x1b[0m podcast pulsa \x1b[97m(o)\x1b[0m, " +
            "para \x1b[97msalir\x1b[0m pulsa \x1b[97m(x)\x1b[0m:",
          default: "x",
          type: "string",
          required: true
        }
      }
    });

    if (action.toLowerCase() === "x") {
      morePages = false;
      continueApp = false;
      break;
    } else if (action.toLowerCase() === "o") {
      break;
    } else if (action.toLowerCase() === "s") {
      currentPage = await ivoox.page("next", currentPage);
      if (!currentPage) {
        warnLog("\nNo hay más páginas disponibles.");
        morePages = false;
      }
    } else {
      // Descargar episodios seleccionados
      const selectedIndexes = action.split(" ")
        .map(n => parseInt(n))
        .filter(n => !isNaN(n) && n > 0 && n <= episodes.length);

      for (const idx of selectedIndexes) {
        const episode = episodes[idx - 1];
        debugLog(isDebug, "Episodio a descargar:", episode);
        await downloadEpisode(episode);
      }

      // Preguntar si continuar en la misma página
      const { nextAction } = await prompt.get({
        properties: {
          nextAction: {
            description: 
              "\n\x1b[97mPara descargar \x1b[97mmás\x1b[0m de esta página pulsa \x1b[97m(m)\x1b[0m, " +
              "para pasar a la \x1b[97msiguiente\x1b[0m página pulsa \x1b[97m(s)\x1b[0m, " +
              "para ver \x1b[97motro\x1b[0m podcast pulsa \x1b[97m(o)\x1b[0m, " +
              "para \x1b[97msalir\x1b[0m pulsa \x1b[97m(x)\x1b[0m?",
            default: "x",
            type: "string"
          }
        }
      });

      if (nextAction.toLowerCase() === "x") {
        morePages = false;
        continueApp = false;
      } else if (nextAction.toLowerCase() === "o") {
        morePages = false;
      } else if (nextAction.toLowerCase() === "s") {
        currentPage = await ivoox.page("next", currentPage);
      }
    }
  }
}

// Función para descargar carátulas
async function downloadCoverImage(url, tempPath) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "arraybuffer"
  });
  fs.writeFileSync(tempPath, response.data);
}

// Función para descargar un episodio
async function downloadEpisode(episode) {
  const fileName = sanitize(episode.title, { replacement: "_" }) + ".mp3";
  const podcastDir = sanitize(episode.podcast, { replacement: "_" });
  const filePath = path.join(config.downloadPath, podcastDir, fileName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await axios({
        url: episode.url,
        method: "GET",
        responseType: "stream",
        timeout: 15000 // 15s por intento
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // Descargar imagen de portada si no existe ya
      const coverPath = path.join(config.downloadPath, podcastDir, "cover.jpg");
      debugLog(isDebug, `coverPath: ${coverPath}`);
      if (!fs.existsSync(coverPath)) {
        debugLog(isDebug, `Portada no existe en ${coverPath}`);
        if (episode.coverUrl) {
          await downloadCoverImage(episode.coverUrl, coverPath);
          infoLog(`Se descargo nueva portada de ${selectedPodcast} en ${coverPath}`);
        }
      }
      
      // actualizar tags id3
      const tags = {
        title: episode.title,
        artist: episode.podcast,
        image: coverPath
      };
      NodeID3.update(tags, filePath);
      
      infoLog(`Descarga completada: ${fileName}`);
      return; 

    } catch (error) {
      attempts++;
      errorLog(isDebug, error, `Error descargando "${episode.title}" (intento ${attempts}/${maxAttempts})`);
      if (attempts < maxAttempts) {
        warnLog("Reintentando en 20 segundos...");
        await new Promise(res => setTimeout(res, 20000));
      } else {
        errorLog(isDebug, error, `Falló la descarga de: ${fileName}. Se salta este episodio.`);
      }
    }
  }
}


