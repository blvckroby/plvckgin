/**
 * Generic Italian audio adapter.
 *
 * Configure AUDIO_PROVIDER_BASE to point to an authorized provider endpoint
 * returning JSON in one of these forms:
 *
 * 1) { "streams": [{ "url": "...", "headers": {...}, "duration": 7200 }] }
 * 2) [{ "url": "...", "headers": {...}, "duration": 7200 }]
 *
 * If a stream URL is an HLS master playlist, this module looks for an
 * Italian EXT-X-MEDIA audio rendition and returns that URL.
 */

const AUDIO_PROVIDER_BASE =
  (typeof globalThis !== "undefined" && globalThis.BLVCK_SYNC_AUDIO_PROVIDER_BASE)
    ? globalThis.BLVCK_SYNC_AUDIO_PROVIDER_BASE
    : "";

function absolutize(uri, base) {
  try {
    return new URL(uri, base).href;
  } catch (_) {
    return uri;
  }
}

function parseAttributes(line) {
  const attrs = {};
  const body = line.replace(/^#EXT-X-MEDIA:/i, "");
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    let v = m[2] || "";
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    attrs[m[1].toUpperCase()] = v;
  }
  return attrs;
}

async function extractItalianAudioFromHls(masterUrl, headers) {
  try {
    const res = await fetch(masterUrl, { headers: headers || {} });
    if (!res.ok) return null;
    const text = await res.text();

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!/^#EXT-X-MEDIA:/i.test(line)) continue;

      const a = parseAttributes(line);
      if (String(a.TYPE || "").toUpperCase() !== "AUDIO") continue;

      const lang = String(a.LANGUAGE || "").toLowerCase();
      const name = String(a.NAME || "").toLowerCase();

      const isItalian =
        lang === "it" ||
        lang === "ita" ||
        lang.startsWith("it-") ||
        name.includes("italiano") ||
        name.includes("italian") ||
        name === "ita";

      if (!isItalian || !a.URI) continue;

      return {
        url: absolutize(a.URI, masterUrl),
        headers: headers || {},
        language: "it",
        source: "ExternalAudio-HLS"
      };
    }
  } catch (e) {
    console.log(`[blvck Sync] HLS audio inspection failed: ${e.message}`);
  }

  return null;
}

async function fetchProviderStreams(tmdbId, type, season, episode) {
  if (!AUDIO_PROVIDER_BASE) return [];

  const params = new URLSearchParams({
    tmdbId: String(tmdbId),
    type: String(type || "movie")
  });

  if (season != null) params.set("season", String(season));
  if (episode != null) params.set("episode", String(episode));

  const url =
    AUDIO_PROVIDER_BASE +
    (AUDIO_PROVIDER_BASE.includes("?") ? "&" : "?") +
    params.toString();

  try {
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.streams)) return data.streams;

    return [];
  } catch (e) {
    console.log(`[blvck Sync] Audio provider failed: ${e.message}`);
    return [];
  }
}

export async function getItalianAudio(
  tmdbId,
  type,
  season,
  episode
) {
  const streams = await fetchProviderStreams(
    tmdbId,
    type,
    season,
    episode
  );

  const results = [];

  for (const stream of streams) {
    if (!stream || !stream.url) continue;

    const url = String(stream.url);
    const headers = stream.headers || {};

    // Direct audio stream already tagged as ITA
    const lang = String(
      stream.language ||
      stream.lang ||
      stream.audioLanguage ||
      ""
    ).toLowerCase();

    if (
      lang === "it" ||
      lang === "ita" ||
      lang.startsWith("it-")
    ) {
      results.push({
        url,
        headers,
        language: "it",
        duration: Number(stream.duration || 0),
        codec: stream.codec,
        channels: stream.channels,
        source: stream.source || "ExternalAudio"
      });
      continue;
    }

    // HLS master: search for an Italian audio rendition.
    if (/\.m3u8(?:$|\?)/i.test(url)) {
      const audio = await extractItalianAudioFromHls(url, headers);
      if (audio) {
        audio.duration = Number(stream.duration || 0);
        results.push(audio);
      }
    }
  }

  return results;
}
