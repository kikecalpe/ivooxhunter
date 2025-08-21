import axios from "axios";
import jsdom from "jsdom";
import https from "https";

const reDate = /^(\d{2}):(\d{2}) - (\d{2}) de (\w{3})\. de (\d{4})$/;
const months = ["ene", "feb", "mar", "abr", "may", "jun",
                "jul", "ago", "sep", "oct", "nov", "dic"];

function page(pageNum, url) {
  const splitUrl = url.split("_");
  if (pageNum === "next") {
    splitUrl[3] = `${ Number(splitUrl[3].split(".")[0]) + 1 }.html`;
  } else {
    splitUrl[3] = `${ pageNum }.html`;
  }
  return splitUrl.join("_");
}

// Depuramos función de parseo para ver si se obtienen los datos adecuadamente
function parseIvoox(document) {
  const parsed = [];
  const elements = document.querySelectorAll("div.pr-lg-4");
  console.log(`DEBUG: Encontrados ${elements.length} elementos con clase "modulo-type-episodio"`);

  elements.forEach(element => {
    const titleElement = element.querySelector("h3 a");
    if (!titleElement) {
      console.log("DEBUG: titleElement no encontrado");
      return;
    }

    const title = titleElement.textContent.trim();
    const fileCode = titleElement.href.split("_")[2];
    if (!fileCode) console.log(`DEBUG: fileCode no encontrado en href: ${titleElement.href}`);

    const url = `http://ivoox.com/listen_mn_${fileCode}_1.mp3`;
    if (!url) console.log(`DEBUG: mp3 url: ${url}`);

    const relativeDate = element.querySelector("span.text-gray").textContent.trim();
    if (!dateElement) console.log(`DEBUG: relativeDate no encontrado para ${title}`);

    const row = element.parentElement.parentElement;
    const premiumBtn = row.querySelector(".round-play.btn-fans");
    const premium = premiumBtn !== null;
    console.log(`DEBUG: premium: ${premium}`);

    parsed.push({ title, url, relativeDate, premium });
  });

  console.log(`DEBUG: Se parsearon ${parsed.length} episodios`);
  return parsed;
}



async function getEpisodes(url, date) {
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
    const pageEpisodes = parseIvoox(document);

    // filtramos por fecha
    const filteredEpisodes = pageEpisodes.filter(
      (episode) => episode.date > date
    );

    return filteredEpisodes;
  } catch (error) {
    console.error("Error al consultar Ivoox:", error.message);
    return [];
  }
}

export default { getEpisodes };
