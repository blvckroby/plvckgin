const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

export const HEADERS = {
  "User-Agent": USER_AGENT
};

export async function fetchText(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        ...HEADERS,
        ...(options.headers || {})
      }
    });

    return await response.text();
  } catch (err) {
    console.log(`[blvck Sync] Request failed for ${url}: ${err.message}`);
    return null;
  }
}
