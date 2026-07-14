import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "data", "news_cache.json");
const CACHE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

function cleanTitle(title) {
  let cleaned = title.trim();
  // Remove CDATA wrapper if present
  if (cleaned.startsWith("<![CDATA[")) {
    cleaned = cleaned.substring(9);
  }
  if (cleaned.endsWith("]]>")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú");

  // Remove source suffix if added by Google News (e.g. " - Infobae")
  if (cleaned.endsWith(" - Infobae")) {
    cleaned = cleaned.substring(0, cleaned.length - 10).trim();
  }
  if (cleaned.endsWith(" - La Nación")) {
    cleaned = cleaned.substring(0, cleaned.length - 12).trim();
  }
  if (cleaned.endsWith(" - Ámbito")) {
    cleaned = cleaned.substring(0, cleaned.length - 9).trim();
  }

  return cleaned;
}

function parseRss(xmlText, sourceName, limit = 4) {
  const items = [];
  const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
  
  for (const itemXml of itemMatches) {
    if (items.length >= limit) break;
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    if (titleMatch) {
      const rawTitle = titleMatch[1];
      const cleaned = cleanTitle(rawTitle);
      if (cleaned) {
        items.push(`[${sourceName}] ${cleaned}`);
      }
    }
  }
  return items;
}

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        ...options.headers
      }
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function GET() {
  // Ensure data folder exists
  const dataDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Check if cache is valid
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const stats = fs.statSync(CACHE_FILE);
      const cacheAge = Date.now() - stats.mtimeMs;
      if (cacheAge < CACHE_DURATION_MS) {
        const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
        if (Array.isArray(cachedData) && cachedData.length > 0) {
          return NextResponse.json({ success: true, news: cachedData, source: "cache" });
        }
      }
    } catch (e) {
      console.error("Error reading cache file:", e);
    }
  }

  // Cache is missing or expired, fetch fresh RSS feeds
  console.log("RSS cache expired or missing. Fetching fresh feeds...");
  const feeds = [
    {
      name: "Ámbito",
      url: "https://www.ambito.com/rss/ultimas-noticias.xml"
    },
    {
      name: "La Nación",
      url: "https://rss.lanacion.com.ar/lanacion.xml"
    },
    {
      name: "Infobae",
      url: "https://news.google.com/rss/search?q=site:infobae.com&hl=es-419&gl=AR&ceid=AR:es-419"
    }
  ];

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const res = await fetchWithTimeout(feed.url, {}, 6000);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const xmlText = await res.text();
      return parseRss(xmlText, feed.name, 4);
    })
  );

  let allNews = [];
  const feedLists = [];

  results.forEach((result, idx) => {
    if (result.status === "fulfilled" && Array.isArray(result.value) && result.value.length > 0) {
      feedLists.push(result.value);
      console.log(`Successfully parsed ${result.value.length} news items from ${feeds[idx].name}`);
    } else {
      console.warn(`Failed to fetch/parse feed for ${feeds[idx].name}:`, result.reason);
    }
  });

  // Interleave/zip news from different feeds to alternate sources
  const maxLength = Math.max(...feedLists.map(list => list.length), 0);
  for (let i = 0; i < maxLength; i++) {
    for (const list of feedLists) {
      if (list[i]) {
        allNews.push(list[i]);
      }
    }
  }

  // Fallback if all feeds failed
  if (allNews.length === 0) {
    console.warn("All RSS feeds failed. Checking last cached news...");
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
        if (Array.isArray(cachedData) && cachedData.length > 0) {
          // Touch the mtime of cache file so we don't spam RSS feeds on failures
          fs.utimesSync(CACHE_FILE, new Date(), new Date());
          return NextResponse.json({ success: true, news: cachedData, source: "expired-cache-fallback" });
        }
      } catch (e) {
        console.error("Error reading cache fallback:", e);
      }
    }

    // Solid default news list as absolute fallback
    allNews = [
      "[Ámbito] ARCA (ex AFIP) prorroga el vencimiento del Monotributo.",
      "[La Nación] Nuevas escalas y topes de facturación vigentes para Autónomos.",
      "[Infobae] El BCRA mantiene estables las tasas de referencia bancaria.",
      "[Ámbito] Reducción de aranceles impositivos para insumos de PyMEs importadoras."
    ];
  }

  // Write new cache file
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(allNews, null, 2), "utf-8");
    console.log("Successfully wrote news cache file.");
  } catch (e) {
    console.error("Error writing cache file:", e);
  }

  return NextResponse.json({ success: true, news: allNews, source: "live" });
}
