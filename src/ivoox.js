import axios from "axios";
import jsdom from "jsdom";
import https from "https";
import { debugLog, infoLog, warnLog, errorLog } from "./logger.js";

function page(pageNum, url) {
  const splitUrl = url.split("_");
  if (pageNum === "next") {
    splitUrl[3] = `${ Number(splitUrl[3].split(".")[0]) + 1 }.html`;
  } else {
    splitUrl[3] = `${ pageNum }.html`;
  }
  return splitUrl.join("_");
}

function parseIvoox(isDebug, document) {
  const parsed = [];
  let elements; 
  try { //portada
    const img = document.querySelector("div.image-wrapper img");
    const match = img.src.match(/[?&]url=([^&]+)/);
    const coverUrl = match ? decodeURIComponent(match[1]) : null;
  } catch (err) {
    errorLog(isDebug, err, `Error obteniendo URL portada: ${err.message}`);
    coverUrl = null;
  }
  try {
    elements = document.querySelectorAll("div.pr-lg-4");
  } catch (err) {
    errorLog(isDebug, err, `Falló el selector de elements = document.querySelectorAll("div.pr-lg-4"): ${elements}`);
    elements = []; // Evitar que rompa más abajo
  }
  debugLog(isDebug, `Encontrados ${elements.length} episodios del podcast.`);
  
  elements.forEach(element => {
    let titleElement, title, fileCode, url, relativeDate, premium, coverUrl, description;
    try {  
      titleElement = element.querySelector("h3 a");
      if (!titleElement) debugLog(isDebug, "titleElement no encontrado");
    } catch (err) {
      errorLog(isDebug, err, `Falló el selector de titleElement = element.querySelector("h3 a"): ${titleElement}`);
    }
  
    try { //título y código
      title = titleElement.textContent.trim();
      fileCode = titleElement.href.split("_")[2];
      if (!fileCode) debugLog(isDebug, `fileCode no encontrado en href: ${titleElement.href}`);
    } catch (err) {
      errorLog(isDebug, err, `Falló el selector de title: ${title} o la operación para obtener el filecode: ${filecode}`);
    }

    url = `http://ivoox.com/listen_mn_${fileCode}_1.mp3`;
    if (!url) debugLog(isDebug, `mp3 url: ${url}`);

    try { //fecha
      relativeDate = element.querySelector("span.text-gray").textContent.trim();
      if (!relativeDate) debugLog(isDebug, `relativeDate no encontrado para ${title}`);
    } catch (err) {
      errorLog(isDebug, err, `Falló el selector de relativeDate = element.querySelector("span.text-gray").textContent.trim(): ${relativeDate}`);
    }
    try { //premium 
      const row = element.closest("div.d-flex.mb-3");
      const premiumBtn = row.querySelector(".round-play.btn-fans");
      premium = premiumBtn !== null;
    } catch (err) {
      errorLog(isDebug, err, `Falló el selector de premium: ${premium}`);
    }
    /*try { //portada
      const row = element.closest("div.d-flex.mb-3");
      debugLog(isDebug, `row: ${row}`);
      
      const coverElement = row?.querySelector("img.img-hover");
      debugLog(isDebug, `coverElement: ${coverElement}`);
      debugLog(isDebug, `coverElement?.src: ${coverElement?.src}`);
      if (coverElement?.src) {
        debugLog(isDebug, `Imagen cruda encontrada: ${coverElement.src}`);
        // Si viene como https://img-static.ivoox.com/index.php?...&url=REAL
        const match = coverElement?.src.match(/url=(https:\/\/static-1\.ivoox\.com\/.*?\.jpg)/);
        coverUrl = match ? decodeURIComponent(match[1]) : null;
        debugLog(isDebug, `coverUrl: ${coverUrl}`);
      } else {
        coverUrl = null;
        debugLog(isDebug, `Portada no encontrada para: ${title}`);
      }
      const coverElement = row?.querySelector("img.img-hover");
      let rawSrc = coverElement?.getAttribute("src") || coverElement?.getAttribute("data-src") || coverElement?.getAttribute("data-src");
      if (rawSrc) {
        debugLog(isDebug, `Imagen cruda encontrada: ${rawSrc}`);
        // Extraer lo que venga después de ?url= o &url=
        const match = rawSrc.match(/[?&]url=([^&]+)/);
        coverUrl = match ? decodeURIComponent(match[1]) : rawSrc;
        debugLog(isDebug, `coverUrl final: ${coverUrl}`);
      } else {
        coverUrl = null;
        debugLog(isDebug, `Portada no encontrada para: ${title}`);
      }
    } catch (err) {
      errorLog(isDebug, err, `Error obteniendo URL portada: ${err.message}`);
      coverUrl = null;
    } */
    try { //descripción
      const descriptionElement = element.querySelector("div.description.mb-05");
      description = descriptionElement?.textContent?.trim() ?? null;
      if (!description) debugLog(isDebug, `Descripción no encontrada para: ${title}`);
    } catch (err) {
      errorLog(isDebug, err, `Error obteniendo descripción: ${err.message}`);
      description = null;
    }


    parsed.push({ title, url, relativeDate, premium, coverUrl, description });
  });

  debugLog(isDebug, `Se parsearon ${parsed.length} episodios`);
  return parsed;
}



async function getEpisodes(isDebug, url, date) {
  try {
    const response = await axios.get(url, {
      timeout: 20000, // máximo 20 segundos
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });

    const dom = new jsdom.JSDOM(response.data);
    const document = dom.window.document;

    // usamos tu parser
    const pageEpisodes = parseIvoox(isDebug, document);

    return pageEpisodes;
  } catch (err) {
    errorLog(isDebug, err, "Error al consultar Ivoox:");
    return [];
  }
}

export default { getEpisodes, page, };
