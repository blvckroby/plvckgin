import cheerio from "cheerio-without-node-native";
import { fetchText } from "../core/http.js";
import {
  atobCompat,
  rot13Cipher,
  levenshteinDistance,
  parseBytes,
  formatBytes
} from "../core/utils.js";

const BASE_URL = "https://4khdhub.fans";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

async function getTmdbDetails(tmdbId, type) {
  const isSeries = type === "series" || type === "tv";
  const endpoint = isSeries ? "tv" : "movie";
  const url =
    `https://api.themoviedb.org/3/${endpoint}/${tmdbId}` +
    `?api_key=${TMDB_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (isSeries) {
      return {
        title: data.name,
        year: data.first_air_date
          ? parseInt(data.first_air_date.split("-")[0], 10)
          : 0
      };
    }

    return {
      title: data.title,
      year: data.release_date
        ? parseInt(data.release_date.split("-")[0], 10)
        : 0
    };
  } catch (error) {
    console.log(`[blvck Sync] TMDB error: ${error.message}`);
    return null;
  }
}

async function fetchPageUrl(name, year, isSeries) {
  const searchUrl =
    `${BASE_URL}/?s=${encodeURIComponent(`${name} ${year}`)}`;

  const html = await fetchText(searchUrl);
  if (!html) return null;

  const $ = cheerio.load(html);
  const targetType = isSeries ? "Series" : "Movies";

  const matchingCards = $(".movie-card")
    .filter((_, el) =>
      $(el).find(`.movie-card-format:contains("${targetType}")`).length > 0
    )
    .filter((_, el) => {
      const metaText = $(el).find(".movie-card-meta").text();
      const movieCardYear = parseInt(metaText, 10);
      return (
        !Number.isNaN(movieCardYear) &&
        Math.abs(movieCardYear - year) <= 1
      );
    })
    .filter((_, el) => {
      const movieCardTitle = $(el)
        .find(".movie-card-title")
        .text()
        .replace(/\[.*?]/g, "")
        .trim();

      return (
        levenshteinDistance(
          movieCardTitle.toLowerCase(),
          name.toLowerCase()
        ) < 5
      );
    })
    .map((_, el) => {
      let href = $(el).attr("href");

      if (href && !href.startsWith("http")) {
        href = BASE_URL + (href.startsWith("/") ? "" : "/") + href;
      }

      return href;
    })
    .get();

  return matchingCards[0] || null;
}

async function resolveRedirectUrl(redirectUrl) {
  const redirectHtml = await fetchText(redirectUrl);
  if (!redirectHtml) return null;

  try {
    const redirectDataMatch = redirectHtml.match(/'o','(.*?)'/);
    if (!redirectDataMatch) return null;

    const step1 = atobCompat(redirectDataMatch[1]);
    const step2 = atobCompat(step1);
    const step3 = rot13Cipher(step2);
    const step4 = atobCompat(step3);
    const redirectData = JSON.parse(step4);

    if (redirectData && redirectData.o) {
      return atobCompat(redirectData.o);
    }
  } catch (e) {
    console.log(`[blvck Sync] Redirect error: ${e.message}`);
  }

  return null;
}

async function extractSourceResults($, el) {
  const localHtml = $(el).html() || "";
  const sizeMatch = localHtml.match(/([\d.]+ ?[GM]B)/);
  const heightMatch = localHtml.match(/\d{3,}p/);

  const title = $(el)
    .find(".file-title, .episode-file-title")
    .text()
    .trim();

  let height = heightMatch ? parseInt(heightMatch[0], 10) : 0;

  if (
    height === 0 &&
    (
      title.includes("4K") ||
      title.includes("4k") ||
      localHtml.includes("4K") ||
      localHtml.includes("4k")
    )
  ) {
    height = 2160;
  }

  const meta = {
    bytes: sizeMatch ? parseBytes(sizeMatch[1]) : 0,
    height,
    title
  };

  const hubCloudLink = $(el)
    .find("a")
    .filter((_, a) => $(a).text().includes("HubCloud"))
    .attr("href");

  if (hubCloudLink) {
    const resolved = await resolveRedirectUrl(hubCloudLink);
    return { url: resolved, meta };
  }

  const hubDriveLink = $(el)
    .find("a")
    .filter((_, a) => $(a).text().includes("HubDrive"))
    .attr("href");

  if (hubDriveLink) {
    const resolvedDrive = await resolveRedirectUrl(hubDriveLink);

    if (resolvedDrive) {
      const hubDriveHtml = await fetchText(resolvedDrive);

      if (hubDriveHtml) {
        const $2 = cheerio.load(hubDriveHtml);
        const innerCloudLink = $2('a:contains("HubCloud")').attr("href");

        if (innerCloudLink) {
          return { url: innerCloudLink, meta };
        }
      }
    }
  }

  return null;
}

async function extractHubCloud(hubCloudUrl, baseMeta) {
  if (!hubCloudUrl) return [];

  const redirectHtml = await fetchText(hubCloudUrl, {
    headers: { Referer: hubCloudUrl }
  });

  if (!redirectHtml) return [];

  const redirectUrlMatch = redirectHtml.match(/var url ?= ?'(.*?)'/);
  if (!redirectUrlMatch) return [];

  const finalLinksUrl = redirectUrlMatch[1];

  const linksHtml = await fetchText(finalLinksUrl, {
    headers: { Referer: hubCloudUrl }
  });

  if (!linksHtml) return [];

  const $ = cheerio.load(linksHtml);
  const results = [];

  const sizeText = $("#size").text();
  const titleText = $("title").text().trim();

  const currentMeta = {
    ...baseMeta,
    bytes: parseBytes(sizeText) || baseMeta.bytes,
    title: titleText || baseMeta.title
  };

  $("a").each((_, el) => {
    const text = $(el).text();
    const href = $(el).attr("href");

    if (!href) return;

    if (text.includes("FSL") || text.includes("Download File")) {
      results.push({
        source: "FSL",
        url: href,
        meta: currentMeta
      });
    } else if (text.includes("PixelServer")) {
      results.push({
        source: "PixelServer",
        url: href.replace("/u/", "/api/file/"),
        meta: currentMeta
      });
    }
  });

  return results;
}

export async function getVideoStreams(tmdbId, type, season, episode) {
  const tmdbDetails = await getTmdbDetails(tmdbId, type);
  if (!tmdbDetails) return [];

  const { title, year } = tmdbDetails;
  const isSeries = type === "series" || type === "tv";

  const pageUrl = await fetchPageUrl(title, year, isSeries);
  if (!pageUrl) return [];

  const html = await fetchText(pageUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const itemsToProcess = [];

  if (isSeries && season && episode) {
    const seasonStr = `S${String(season).padStart(2, "0")}`;
    const episodeStr = `Episode-${String(episode).padStart(2, "0")}`;

    $(".episode-item").each((_, el) => {
      if ($(".episode-title", el).text().includes(seasonStr)) {
        $(".episode-download-item", el)
          .filter((_, item) => $(item).text().includes(episodeStr))
          .each((_, item) => itemsToProcess.push(item));
      }
    });
  } else {
    $(".download-item").each((_, el) => {
      itemsToProcess.push(el);
    });
  }

  const resultGroups = await Promise.all(
    itemsToProcess.map(async item => {
      try {
        const sourceResult = await extractSourceResults($, item);

        if (!sourceResult?.url) return [];

        const extractedLinks = await extractHubCloud(
          sourceResult.url,
          sourceResult.meta
        );

        return extractedLinks.map(link => ({
          name:
            `4KHDHub - ${link.source}` +
            (
              sourceResult.meta.height
                ? ` ${sourceResult.meta.height}p`
                : ""
            ),
          title:
            `${link.meta.title}\n` +
            `${formatBytes(link.meta.bytes || 0)}`,
          url: link.url,
          quality: sourceResult.meta.height
            ? `${sourceResult.meta.height}p`
            : undefined,
          bytes: link.meta.bytes || 0,
          source: link.source,
          behaviorHints: {
            bingeGroup: `4khdhub-${link.source}`
          }
        }));
      } catch (err) {
        console.log(`[blvck Sync] Item error: ${err.message}`);
        return [];
      }
    })
  );

  return resultGroups.flat();
}
