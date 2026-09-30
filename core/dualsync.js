import { qualityScore } from "../core/utils.js";

const MAX_DURATION_DIFF_SECONDS = 3;

function durationCompatible(video, audio) {
  const vd = Number(video && video.duration || 0);
  const ad = Number(audio && audio.duration || 0);

  // Unknown duration: allow, but mark it as unverified.
  if (!vd || !ad) {
    return {
      ok: true,
      verified: false,
      diff: null
    };
  }

  const diff = Math.abs(vd - ad);

  return {
    ok: diff <= MAX_DURATION_DIFF_SECONDS,
    verified: true,
    diff
  };
}

function pickAudioForVideo(video, audioStreams) {
  if (!Array.isArray(audioStreams) || audioStreams.length === 0) {
    return null;
  }

  const candidates = audioStreams
    .map(audio => ({
      audio,
      compat: durationCompatible(video, audio)
    }))
    .filter(x => x.compat.ok);

  if (candidates.length === 0) return null;

  // Prefer duration-verified candidates, then first available.
  candidates.sort((a, b) => {
    if (a.compat.verified !== b.compat.verified) {
      return a.compat.verified ? -1 : 1;
    }

    const ad = a.compat.diff == null ? 999999 : a.compat.diff;
    const bd = b.compat.diff == null ? 999999 : b.compat.diff;

    return ad - bd;
  });

  return candidates[0];
}

export function buildDualSyncStreams(videoStreams, audioStreams) {
  if (!Array.isArray(videoStreams)) return [];

  const videos = [...videoStreams].sort(
    (a, b) => qualityScore(b.quality) - qualityScore(a.quality)
  );

  return videos.map(video => {
    const picked = pickAudioForVideo(video, audioStreams);

    if (!picked) {
      return {
        ...video,
        name: `blvck Sync • ${video.name || "Video"}`,
        title:
          `${video.title || ""}\n` +
          `🎬 ${video.quality || "Unknown"} • Audio originale`
      };
    }

    const audio = picked.audio;

    return {
      ...video,
      name: `blvck Sync DualSync • ${video.quality || "Video"}`,
      title:
        `${video.title || ""}\n` +
        `🇮🇹 ITA + 🌐 Originale` +
        (picked.compat.verified
          ? ` • Δ ${picked.compat.diff.toFixed(2)}s`
          : ` • durata non verificata`),
      dualSync: {
        videoUrl: video.url,
        videoHeaders: video.headers || {},
        audioUrl: audio.url,
        audioHeaders: audio.headers || {},
        audioLanguage: "it",
        audioCodec: audio.codec,
        audioChannels: audio.channels,
        audioSource: audio.source || "ExternalAudio",
        offsetMs: 0,
        durationVerified: picked.compat.verified,
        durationDifferenceSeconds: picked.compat.diff
      }
    };
  });
}
