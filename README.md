# blvck Sync DualSync v0.2

Video provider based on the 4KHDHub code supplied in chat.

## Audio source

This build does not hard-code an unlicensed third-party audio scraper.

Set:

```js
globalThis.BLVCK_SYNC_AUDIO_PROVIDER_BASE =
  "https://your-authorized-provider.example/streams";
```

The endpoint should accept:

- `tmdbId`
- `type`
- `season`
- `episode`

and return either:

```json
{
  "streams": [
    {
      "url": "https://example/master.m3u8",
      "headers": {},
      "duration": 7200
    }
  ]
}
```

or an array of stream objects.

If the URL is a master `.m3u8`, blvck Sync scans `#EXT-X-MEDIA` entries and
selects an Italian audio rendition (`it`, `ita`, `Italiano`, `Italian`).

If the endpoint directly returns an Italian audio stream, tag it with:

```json
{
  "url": "https://example/audio-it.m3u8",
  "language": "it",
  "duration": 7200
}
```

## Sync policy

- `offsetMs` defaults to `0`.
- If both video and audio durations are known, blvck Sync accepts them only
  when the difference is <= 3 seconds.
- If duration is unknown, the match is allowed but marked
  `durationVerified: false`.

This intentionally avoids inventing an offset.
