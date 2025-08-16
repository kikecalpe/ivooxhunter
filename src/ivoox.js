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

function parseIvoox(document) {
  const parsed = [];
  document
    .querySelectorAll("div.modulo-type-episodio")
    .forEach(element => {
      const titleElement = element.querySelector(".content .title-wrapper a");
      const title = titleElement.textContent.trim();
      const fileCode = titleElement.href.split("_")[2];
      const url = `http://ivoox.com/listen_mn_${ fileCode }_1.mp3`;
      const splitDate = element.querySelector(".content .action .date")
                               .title.match(reDate);
      const date = new Date(
        splitDate[5],
        months.indexOf(splitDate[4]),
        splitDate[3],
        splitDate[1],
        splitDate[2]
      );
      const premiumElement = element.querySelector(".content .title-wrapper .fan-title");
      const premium = premiumElement === null ? false : true;
      parsed.push({title, url, date, premium});
    });
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
