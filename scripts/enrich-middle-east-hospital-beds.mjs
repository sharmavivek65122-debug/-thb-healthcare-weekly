import fs from "node:fs";
import path from "node:path";

import * as cheerio from "cheerio";
import pLimit from "p-limit";
import XLSX from "xlsx";

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] || fallback;
}

function cleanValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/\u00a0/g, " ").trim();
}

function normalizeText(value) {
  return cleanValue(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bcentre\b/g, "center")
    .replace(/\bhospitals\b/g, "hospital")
    .replace(/\bclinics\b/g, "clinic")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(value) {
  const stopwords = new Set([
    "the", "hospital", "medical", "center", "clinic", "group", "health", "healthcare",
    "company", "holding", "national", "international", "general", "specialist",
    "specialized", "city", "care", "services", "of", "for", "and", "in"
  ]);

  return normalizeText(value)
    .split(" ")
    .filter((token) => token && !stopwords.has(token));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeDuckDuckGoUrl(url) {
  try {
    const parsed = new URL(url, "https://duckduckgo.com");
    return parsed.searchParams.get("uddg") || url;
  } catch {
    return url;
  }
}

function extractBedMatches(text) {
  const matches = [];
  const patterns = [
    /(\d{1,4})\s*[- ]?beds?\b/gi,
    /capacity of\s+(\d{1,4})\s*beds?\b/gi,
    /with\s+(\d{1,4})\s*beds?\b/gi,
    /bed capacity of\s+(\d{1,4})\b/gi,
    /(\d{1,4})\s*patient beds?\b/gi,
    /houses?\s+[^.]{0,80}?(\d{1,4})\s*beds?\b/gi,
    /(\d{1,4})\s*bed capacity\b/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = Number(match[1]);
      if (value > 5 && value < 3000) {
        matches.push({
          beds: value,
          index: match.index
        });
      }
    }
  }

  return matches;
}

function bedBand(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "NA";
  }
  if (value <= 50) {
    return "0-50";
  }
  if (value <= 100) {
    return "50-100";
  }
  if (value <= 200) {
    return "100-200";
  }
  if (value <= 500) {
    return "200-500";
  }
  return ">500";
}

function fitsExistingBand(value, band) {
  const cleaned = cleanValue(band);
  if (!cleaned || cleaned === "NA") {
    return false;
  }
  if (/^\d+$/.test(cleaned)) {
    return Number(cleaned) === value;
  }
  if (cleaned === "0-50") {
    return value <= 50;
  }
  if (cleaned === "50-100") {
    return value > 50 && value <= 100;
  }
  if (cleaned === "100-200") {
    return value > 100 && value <= 200;
  }
  if (cleaned === "200-500") {
    return value > 200 && value <= 500;
  }
  if (cleaned === ">500") {
    return value > 500;
  }
  return false;
}

function scoreCandidate({ row, title, snippet, context, sourceRank, sourceUrl, beds, fromSnippet }) {
  const combined = normalizeText(`${title} ${snippet} ${context} ${sourceUrl}`);
  const nameTokens = significantTokens(row["Hospital Name"]);
  const cityTokens = significantTokens(row.City);
  const countryTokens = significantTokens(row.Country);

  let score = 0;
  const matchedNameTokens = nameTokens.filter((token) => combined.includes(token)).length;
  score += matchedNameTokens * 4;
  if (matchedNameTokens >= Math.min(2, Math.max(1, nameTokens.length))) {
    score += 4;
  }

  const matchedCityTokens = cityTokens.filter((token) => combined.includes(token)).length;
  score += matchedCityTokens * 2;

  const matchedCountryTokens = countryTokens.filter((token) => combined.includes(token)).length;
  score += matchedCountryTokens;

  if (fromSnippet) {
    score += 3;
  }

  score += Math.max(0, 3 - sourceRank);

  if (fitsExistingBand(beds, row.Beds)) {
    score += 6;
  }

  if (sourceUrl && normalizeText(sourceUrl).includes(nameTokens[0] || "")) {
    score += 1;
  }

  return score;
}

async function fetchHtml(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
      }
    });

    if (response.ok) {
      return response.text();
    }

    if (![403, 429, 500, 502, 503, 504].includes(response.status) || attempt === 4) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    await sleep(1500 * attempt);
  }
}

function parseLiteSearchResults(html) {
  const $ = cheerio.load(html);
  const results = [];
  const rows = $("tr").toArray();

  for (let index = 0; index < rows.length; index += 1) {
    const anchor = $(rows[index]).find("a").first();
    if (!anchor.length) {
      continue;
    }

    const title = anchor.text().trim().replace(/^\d+\.\s*/, "");
    const url = decodeDuckDuckGoUrl(anchor.attr("href") || "");
    const snippet = cleanValue($(rows[index + 1]).text());
    if (!title || !url) {
      continue;
    }

    results.push({
      rank: results.length,
      title,
      snippet,
      url
    });

    if (results.length >= 4) {
      break;
    }
  }

  return results;
}

function candidatesFromSnippet(result, row) {
  const text = `${result.title} ${result.snippet}`;
  return extractBedMatches(text).map((match) => ({
    beds: match.beds,
    sourceUrl: result.url,
    sourceTitle: result.title,
    evidence: result.snippet.slice(0, 240),
    sourceRank: result.rank,
    fromSnippet: true,
    score: scoreCandidate({
      row,
      title: result.title,
      snippet: result.snippet,
      context: result.snippet,
      sourceRank: result.rank,
      sourceUrl: result.url,
      beds: match.beds,
      fromSnippet: true
    })
  }));
}

function chooseBestCandidate(candidates) {
  if (candidates.length === 0) {
    return null;
  }

  const dedupedCandidates = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = [
      candidate.beds,
      candidate.sourceUrl,
      candidate.sourceTitle,
      candidate.fromSnippet ? "snippet" : "page"
    ].join("||");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    dedupedCandidates.push(candidate);
  }

  const grouped = new Map();
  for (const candidate of dedupedCandidates) {
    if (!grouped.has(candidate.beds)) {
      grouped.set(candidate.beds, []);
    }
    grouped.get(candidate.beds).push(candidate);
  }

  const ranked = [...grouped.entries()]
    .map(([beds, group]) => ({
      beds,
      best: [...group].sort((left, right) => right.score - left.score)[0],
      totalScore: group.reduce((sum, candidate) => sum + candidate.score, 0),
      hits: group.length
    }))
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }
      if (right.hits !== left.hits) {
        return right.hits - left.hits;
      }
      return right.best.score - left.best.score;
    });

  const winner = ranked[0];
  if (!winner || winner.best.score < 7) {
    return null;
  }

  return {
    beds: winner.beds,
    band: bedBand(winner.beds),
    sourceUrl: winner.best.sourceUrl,
    sourceTitle: winner.best.sourceTitle,
    evidence: cleanValue(winner.best.evidence).slice(0, 280),
    hits: winner.hits,
    score: winner.best.score
  };
}

async function searchBedsForRow(row) {
  const queries = unique([
    `${row["Hospital Name"]} ${row.Country} number of beds`,
    row.City ? `${row["Hospital Name"]} ${row.City} ${row.Country} number of beds` : ""
  ]);

  const allCandidates = [];
  const triedUrls = [];

  for (const query of queries) {
    let results = [];
    for (const searchUrl of [
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
    ]) {
      try {
        const searchHtml = await fetchHtml(searchUrl);
        results = parseLiteSearchResults(searchHtml);
        if (results.length > 0) {
          break;
        }
      } catch {
        // Try the next search endpoint.
      }
    }

    if (results.length === 0) {
      continue;
    }

    for (const result of results) {
      triedUrls.push(result.url);
      allCandidates.push(...candidatesFromSnippet(result, row));
    }

    const initialWinner = chooseBestCandidate(allCandidates);
    if (initialWinner && initialWinner.score >= 10) {
      return {
        ...initialWinner,
        query,
        triedUrls: unique(triedUrls)
      };
    }
    await sleep(120);
  }

  const winner = chooseBestCandidate(allCandidates);
  if (winner) {
    return {
      ...winner,
      query: queries[0] || "",
      triedUrls: unique(triedUrls)
    };
  }

  return {
    beds: "NA",
    band: "NA",
    sourceUrl: "",
    sourceTitle: "",
    evidence: "",
    hits: 0,
    score: 0,
    query: queries[0] || "",
    triedUrls: unique(triedUrls)
  };
}

const inputPath = path.resolve(readArg(
  "input",
  "C:/Users/VivekSharma/OneDrive - THB c o Sekhmet Technologies Private Limited/Desktop/Middle_East_Hospitals_Deduped_WebMapped.xlsx"
));
const outputPath = path.resolve(readArg("output", inputPath));
const cachePath = path.resolve(readArg("cache", "data/middle-east-bed-search-cache.json"));
const backupPath = path.resolve(readArg("backup", "data/Middle_East_Hospitals_Deduped_WebMapped.backup.xlsx"));
const offset = Number(readArg("offset", "0"));
const limitRows = Number(readArg("limit", "0"));

const workbook = XLSX.readFile(inputPath, { cellDates: false });
const sheetName = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" })
  .map((row, index) => ({
    "Hospital Name": cleanValue(row["Hospital Name"]),
    Country: cleanValue(row.Country),
    City: cleanValue(row.City),
    "Number of beds from search": cleanValue(row["Number of beds from search"]),
    Beds: cleanValue(row.Beds),
    __rowNumber: index + 2
  }));

let cache = {};
if (fs.existsSync(cachePath)) {
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    cache = {};
  }
}

fs.mkdirSync(path.dirname(cachePath), { recursive: true });
fs.mkdirSync(path.dirname(backupPath), { recursive: true });
fs.copyFileSync(inputPath, backupPath);

const limit = pLimit(Number(readArg("concurrency", "4")));
const auditRows = [];

let completed = 0;

await Promise.all(rows.map((row, index) => limit(async () => {
  if (index < offset) {
    return;
  }
  if (limitRows > 0 && index >= offset + limitRows) {
    return;
  }

  const cacheKey = `${normalizeText(row["Hospital Name"])}||${normalizeText(row.Country)}||${normalizeText(row.City)}`;
  let result = cache[cacheKey];

  if (!result) {
    result = await searchBedsForRow(row);
    cache[cacheKey] = result;
    await sleep(220);

    if ((index + 1) % 20 === 0) {
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    }
  }

  row["Number of beds from search"] = result.beds === "NA" ? "NA" : String(result.beds);
  row.Beds = result.band;

  auditRows.push({
    "Hospital Name": row["Hospital Name"],
    Country: row.Country,
    City: row.City,
    Query: result.query,
    "Resolved Beds": row["Number of beds from search"],
    "Resolved Band": row.Beds,
    "Source URL": result.sourceUrl,
    "Source Title": result.sourceTitle,
    Evidence: result.evidence,
    Hits: result.hits,
    Score: result.score,
    "Tried URLs": (result.triedUrls || []).join(" | ")
  });

  completed += 1;
  if (completed % 25 === 0) {
    const targetTotal = limitRows > 0 ? Math.min(limitRows, rows.length - offset) : rows.length - offset;
    console.log(`Processed ${completed}/${targetTotal}`);
  }
})));

fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

const outputWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(rows.map((row) => ({
  "Hospital Name": row["Hospital Name"],
  Country: row.Country,
  City: row.City,
  "Number of beds from search": row["Number of beds from search"],
  Beds: row.Beds
}))), sheetName);
XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(auditRows), "Search_Audit");
XLSX.writeFile(outputWorkbook, outputPath);

const foundCount = rows.filter((row) => row["Number of beds from search"] !== "NA").length;

console.log(JSON.stringify({
  outputPath,
  backupPath,
  cachePath,
  totalRows: rows.length,
  offset,
  limitRows,
  foundRows: foundCount,
  notFoundRows: rows.length - foundCount
}, null, 2));
