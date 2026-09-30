import { getVideoStreams } from "./video4k.js";
import { getItalianAudio } from "./audio-it.js";
import { buildDualSyncStreams } from "../core/dualsync.js";

export async function getStreams(
  tmdbId,
  type,
  season,
  episode
) {
  try {
    const [videoStreams, audioStreams] = await Promise.all([
      getVideoStreams(tmdbId, type, season, episode),
      getItalianAudio(tmdbId, type, season, episode)
    ]);

    return buildDualSyncStreams(videoStreams, audioStreams);
  } catch (error) {
    console.log(`[blvck Sync] getStreams error: ${error.message}`);
    return [];
  }
}

export default {
  getStreams
};
