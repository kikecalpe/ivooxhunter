import fs from "fs";
import url from "url";
import path from "path";
import prompt from "prompt";
import axios from "axios";
import sanitize from "sanitize-filename";
import colors from "colors/safe.js";
import ivoox from "./ivoox.js";

const basePath = url.fileURLToPath(new URL("..", import.meta.url));
let config = {};

prompt.start();
prompt.message = "";
prompt.delimiter = "";

// Leer configuración
const configUrl = path.join(basePath, "config.json");
try {
  config = JSON.parse(fs.readFileSync(configUrl));
} catch (e) {
  console.log("\nArchivo de configuración no encontrado.\n");
  process.exit(1);
}

if (!path.isAbsolute(config.downloadPath)) {
  config.downloadPath = path.join(basePath, config.downloadPath);
}

// Mostrar nombre del script
const packageJsonUrl = path.join(basePath, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonUrl));
console.log(`\n${packageJson.name} ${packageJson.version}\n`);

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
    console.log("\nSaliendo...\n");
    break;
  }

  const selectedPodcast = podcasts[podcastNum - 1];
  let currentPage = selectedPodcast.url;
  let episodes = [];
  let morePages = true;

  while (morePages) {
    console.log(`\nConsultando: ${selectedPodcast.name}\n`);
    const newEpisodes = await ivoox.getEpisodes(currentPage, null, config.requestWait);

    if (newEpisodes.length === 0) {
      console.log("\nNo se encontraron episodios.\n");
      break;
    }

    newEpisodes.forEach(ep => ep.podcast = selectedPodcast.name);
    episodes = episodes.concat(newEpisodes);

    // Mostrar episodios
    episodes.forEach((episode, idx) => {
      const title = episode.title.length > 65 ? episode.title.slice(0, 62) + "..." : episode.title;
      const premiumMark = episode.premium ? colors.red("[PREMIUM] ") : "";
      console.log(`  ${String(idx + 1).padStart(2, " ")}. ${premiumMark}${title} (${episode.dateRelative})`);
    });

    // Preguntar qué hacer
    const { action } = await prompt.get({
      properties: {
        action: {
          description: "\nIntroduce números para descargar (ej: 1 3 5) o escribe 'siguiente', 'otro', 'salir':",
          type: "string",
          required: true
        }
      }
    });

    if (action.toLowerCase() === "salir") {
      morePages = false;
      continueApp = false;
      break;
    } else if (action.toLowerCase() === "otro") {
      break;
    } else if (action.toLowerCase() === "siguiente") {
      currentPage = await ivoox.getNextPageUrl(currentPage); // debes implementar esta función
      if (!currentPage) {
        console.log("\nNo hay más páginas disponibles.");
        morePages = false;
      }
    } else {
      // Descargar episodios seleccionados
      const selectedIndexes = action.split(" ")
        .map(n => parseInt(n))
        .filter(n => !isNaN(n) && n > 0 && n <= episodes.length);

      for (const idx of selectedIndexes) {
        const episode = episodes[idx - 1];
        await downloadEpisode(episode);
      }

      // Preguntar si continuar en la misma página
      const { nextAction } = await prompt.get({
        properties: {
          nextAction: {
            description: "\n¿Descargar más de esta página (m), siguiente página (s), otro podcast (o), salir (x)?",
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
        currentPage = await ivoox.getNextPageUrl(currentPage); // debes implementar esta función
      }
    }
  }
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

      console.log(`Descarga completada: ${fileName}`);
      return; // Éxito → salir de la función

    } catch (error) {
      attempts++;
      console.log(`Error descargando "${episode.title}" (intento ${attempts}/${maxAttempts}): ${error.code || error.message}`);
      if (attempts < maxAttempts) {
        console.log("Reintentando en 20 segundos...");
        await new Promise(res => setTimeout(res, 20000));
      } else {
        console.log(`Falló la descarga de: ${fileName}. Se salta este episodio.`);
      }
    }
  }
}


