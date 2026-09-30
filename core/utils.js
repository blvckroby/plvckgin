export function atobCompat(input) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

  const str = String(input).replace(/=+$/, "");

  if (str.length % 4 === 1) {
    throw new Error("Invalid base64 input.");
  }

  let output = "";

  for (
    let bc = 0, bs, buffer, i = 0;
    (buffer = str.charAt(i++));
    ~buffer &&
    (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }

  return output;
}

export function rot13Cipher(str) {
  return str.replace(/[a-zA-Z]/g, c =>
    String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13)
        ? c
        : c - 26
    )
  );
}

export function levenshteinDistance(s, t) {
  if (s === t) return 0;

  const n = s.length;
  const m = t.length;

  if (n === 0) return m;
  if (m === 0) return n;

  const d = [];

  for (let i = 0; i <= n; i++) {
    d[i] = [];
    d[i][0] = i;
  }

  for (let j = 0; j <= m; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }

  return d[n][m];
}

export function parseBytes(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;

  const match = val.match(/^([0-9.]+)\s*([a-zA-Z]+)$/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  let multiplier = 1;

  if (unit.startsWith("k")) multiplier = 1024;
  else if (unit.startsWith("m")) multiplier = 1024 * 1024;
  else if (unit.startsWith("g")) multiplier = 1024 * 1024 * 1024;
  else if (unit.startsWith("t")) multiplier = 1024 * 1024 * 1024 * 1024;

  return num * multiplier;
}

export function formatBytes(val) {
  if (!val) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  let i = Math.floor(Math.log(val) / Math.log(k));

  if (i < 0) i = 0;

  return `${parseFloat((val / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function qualityScore(quality) {
  const q = parseInt(String(quality || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(q) ? q : 0;
}
