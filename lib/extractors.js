import { Readability } from "@mozilla/readability";
import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { parseHTML } from "linkedom";

import {
  SEGMENT_KEYWORDS,
  buildThbActionForArticle,
  chooseCategory,
  classifySegment,
  cleanText,
  detectRegionAndCountry,
  isHealthcareRelevantArticle,
  isIndustryRelevantArticle,
  isRegionRelevant,
  sanitizeContent,
  scoreArticle,
  slugify,
  summarizeText
} from "./content-utils.js";
import { addDays, getWeekStartForDate, isIssueDay, toIsoDate } from "./date-utils.js";

const REQUEST_HEADERS = {
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (compatible; THBWeeklyNewsletter/1.0; +https://neuralink-weekly-newsletter.pages.dev)"
};

const FEED_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true
});

const BLOCKED_PATH_HINTS = [
  "/about",
  "/contact",
  "/careers",
  "/privacy",
  "/terms",
  "/tag/",
  "/tags/",
  "/category/",
  "/categories/",
  "/topics/",
  "/topic/",
  "/search",
  "/newsroom",
  "/media",
  "/media-centre",
  "/press-release",
  "/press-releases",
  "/latest-news",
  "/latest"
];

const BLOCKED_PATH_CONTAINS = [
  "/brand-solutions/",
  "/guest-post-guidelines",
  "/terms_conditions",
  "/fact-check/",
  "/healthcare-videos/",
  "/mdtv/",
  "/our-story/",
  "/board-of-directors",
  "/management",
  "/investor",
  "/sustainability",
  "/clinical-trials/",
  "/science/",
  "/download",
  "/app"
];

const ARTICLE_PATH_HINTS = [
  "/news/",
  "/press/",
  "/stories/",
  "/article",
  "/articles/",
  "/story/",
  "/release",
  "/releases/",
  "/blog/",
  "/updates/",
  "/insights/",
  "/media/"
];

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function titleFromUrl(url) {
  const pathname = new URL(url).pathname;
  const slug = pathname.split("/").filter(Boolean).pop() || "";
  return cleanText(
    slug
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/-\d+$/, "")
      .replace(/[-_]+/g, " ")
  );
}

function safeUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  const keepParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (!key.toLowerCase().startsWith("utm_")) {
      keepParams.append(key, value);
    }
  }
  url.search = keepParams.toString();
  url.hash = "";
  return url.toString();
}

function parseLooseDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const cleaned = cleanText(value)
    .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
    .replace(/\u2013|\u2014/g, "-");

  const direct = new Date(cleaned);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const monthMatch = cleaned.match(
    /\b(\d{1,2})[\/\-. ]([A-Za-z]{3,9}|\d{1,2})[\/\-. ,]+(\d{2,4})\b/
  );
  if (monthMatch) {
    const rebuilt = `${monthMatch[1]} ${monthMatch[2]} ${monthMatch[3]}`;
    const candidate = new Date(rebuilt);
    if (!Number.isNaN(candidate.getTime())) {
      return candidate;
    }
  }

  const ymdMatch = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (ymdMatch) {
    return new Date(`${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}T00:00:00Z`);
  }

  return null;
}

function extractDateFromUrl(url) {
  const match = url.match(/(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function discoverFeedUrl($, baseUrl) {
  const selectors = [
    'link[type="application/rss+xml"]',
    'link[type="application/atom+xml"]',
    'a[href*="rss"]',
    'a[href*="feed"]'
  ];

  for (const selector of selectors) {
    const href = $(selector).first().attr("href");
    const resolved = href ? safeUrl(href, baseUrl) : null;
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function extractFeedLink(entry) {
  if (!entry) {
    return null;
  }

  if (typeof entry.link === "string") {
    return entry.link;
  }

  const linkCandidates = asArray(entry.link);
  for (const link of linkCandidates) {
    if (typeof link === "string") {
      return link;
    }
    if (link?.href) {
      return link.href;
    }
  }

  return entry.guid || entry.id || null;
}

function isLikelyListingPage(url, source) {
  const normalizedUrl = normalizeUrl(url);
  const listingUrl = normalizeUrl(source.url);

  if (normalizedUrl === listingUrl) {
    return true;
  }

  const parsed = new URL(normalizedUrl);
  const path = parsed.pathname.toLowerCase();
  const segmentCount = path.split("/").filter(Boolean).length;

  if (segmentCount <= 1 && !ARTICLE_PATH_HINTS.some((hint) => path.includes(hint))) {
    return true;
  }

  return (
    BLOCKED_PATH_HINTS.some((hint) => path === hint || path.endsWith(hint)) ||
    BLOCKED_PATH_CONTAINS.some((hint) => path.includes(hint))
  );
}

function extractJsonLd($) {
  const blocks = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html();
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw.trim());
      blocks.push(parsed);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });

  return blocks;
}

function extractDateFromJsonLd(blocks) {
  const queue = [...blocks];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current === "object") {
      for (const key of ["datePublished", "dateCreated", "dateModified", "uploadDate"]) {
        if (current[key]) {
          const parsed = parseLooseDate(current[key]);
          if (parsed) {
            return parsed;
          }
        }
      }
      queue.push(...Object.values(current));
    }
  }

  return null;
}

function extractMetaDate($) {
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="publish-date"]',
    'meta[name="pubdate"]',
    'meta[name="date"]',
    'meta[itemprop="datePublished"]',
    "time[datetime]"
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    const value = element.attr("content") || element.attr("datetime") || element.text();
    const parsed = parseLooseDate(value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function extractReadableArticle(html, url) {
  try {
    const { document } = parseHTML(html);
    return new Readability(document, {
      charThreshold: 280
    }).parse();
  } catch {
    return null;
  }
}

function fallbackBodyHtml($) {
  const containers = [
    "article",
    "main article",
    '[itemprop="articleBody"]',
    ".article-body",
    ".story-body",
    ".post-content",
    ".entry-content",
    ".news-detail"
  ];

  for (const selector of containers) {
    const html = $(selector).first().html();
    if (cleanText($(selector).first().text()).length > 400) {
      return sanitizeContent(html || "");
    }
  }

  const paragraphs = $("p")
    .map((_, paragraph) => $.html(paragraph))
    .get()
    .filter(Boolean)
    .slice(0, 20)
    .join("");

  return sanitizeContent(paragraphs);
}

function extractHtmlCandidates(html, source) {
  const $ = load(html);
  const candidates = [];

  $("article a[href], main a[href], h1 a[href], h2 a[href], h3 a[href], li a[href], section a[href]").each(
    (_, element) => {
      const href = $(element).attr("href");
      const resolved = href ? safeUrl(href, source.url) : null;
      if (!resolved) {
        return;
      }

      if (!/^https?:/i.test(resolved) || isLikelyListingPage(resolved, source)) {
        return;
      }

      const title = cleanText($(element).text());
      if (title.length < 18 || title.length > 220) {
        return;
      }

      const parent = $(element).closest("article, li, div, section");
      const context = cleanText(parent.text()).slice(0, 500);
      const path = new URL(resolved).pathname.toLowerCase();

      const combinedText = `${title} ${context}`.toLowerCase();
      let score = source.pool === "mixed" ? 0 : 1;
      if (ARTICLE_PATH_HINTS.some((hint) => path.includes(hint))) {
        score += 4;
      }
      if (/\d{4}\/\d{2}\/\d{2}/.test(path)) {
        score += 3;
      }
      if (/\d{5,}$/.test(path)) {
        score += 4;
      }
      if (context.length > title.length) {
        score += 1;
      }
      for (const keyword of SEGMENT_KEYWORDS[source.pool] || []) {
        if (combinedText.includes(keyword)) {
          score += 1;
        }
      }

      if (score < 1) {
        return;
      }

      candidates.push({
        url: normalizeUrl(resolved),
        title,
        summaryHint: summarizeText(context, 260),
        dateHint: parseLooseDate(parent.find("time").attr("datetime") || context),
        score,
        source
      });
    }
  );

  const deduped = new Map();
  for (const candidate of candidates) {
    if (!deduped.has(candidate.url)) {
      deduped.set(candidate.url, candidate);
    }
  }

  return [...deduped.values()];
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} for ${url}`);
    }

    return {
      finalUrl: response.url,
      text: await response.text()
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractFeedCandidates(xml, source) {
  const parsed = FEED_PARSER.parse(xml);
  const items = [
    ...asArray(parsed?.rss?.channel?.item),
    ...asArray(parsed?.feed?.entry)
  ];

  return items
    .map((item) => {
      const url = extractFeedLink(item);
      const resolved = url ? safeUrl(url, source.url) : null;
      if (!resolved || isLikelyListingPage(resolved, source)) {
        return null;
      }

      const title = cleanText(item.title?.["#text"] || item.title || "");
      if (title.length < 18) {
        return null;
      }

      return {
        url: normalizeUrl(resolved),
        title,
        summaryHint: summarizeText(
          cleanText(item.description || item.summary?.["#text"] || item.summary || item.content || ""),
          260
        ),
        dateHint: parseLooseDate(item.pubDate || item.published || item.updated),
        source
      };
    })
    .filter(Boolean);
}

function extractSitemapCandidates(xml, source) {
  const parsed = FEED_PARSER.parse(xml);
  const entries = asArray(parsed?.urlset?.url);

  return entries
    .map((entry) => {
      const resolved = entry?.loc ? safeUrl(entry.loc, source.url) : null;
      if (!resolved || isLikelyListingPage(resolved, source)) {
        return null;
      }

      return {
        url: normalizeUrl(resolved),
        title: titleFromUrl(resolved),
        summaryHint: "",
        dateHint: parseLooseDate(entry.lastmod),
        score: 6,
        source
      };
    })
    .filter(Boolean);
}

export async function getSourceCandidates(source, earliestDate = null, latestDate = null) {
  try {
    const listing = await fetchText(source.url);
    const $ = load(listing.text);
    const discoveredFeed = discoverFeedUrl($, source.url);

    let candidates = [];
    if (discoveredFeed && discoveredFeed !== source.url) {
      try {
        const feed = await fetchText(discoveredFeed);
        candidates = extractFeedCandidates(feed.text, source);
      } catch {
        candidates = [];
      }
    }

    if (candidates.length === 0) {
      candidates = extractHtmlCandidates(listing.text, source);
    }

    if (candidates.length === 0 && /<urlset[\s>]/i.test(listing.text)) {
      candidates = extractSitemapCandidates(listing.text, source);
    }

    return candidates
      .filter((candidate) => {
        if (!candidate.dateHint || !earliestDate || !latestDate) {
          return true;
        }
        return candidate.dateHint >= addDays(earliestDate, -2) && candidate.dateHint <= addDays(latestDate, 2);
      })
      .sort((left, right) => {
        if ((right.score || 0) !== (left.score || 0)) {
          return (right.score || 0) - (left.score || 0);
        }
        if (left.dateHint && right.dateHint) {
          return new Date(right.dateHint).getTime() - new Date(left.dateHint).getTime();
        }
        if (right.dateHint) {
          return 1;
        }
        if (left.dateHint) {
          return -1;
        }
        return 0;
      })
      .slice(0, 20);
  } catch {
    return [];
  }
}

export async function extractArticle(candidate, earliestDate = null, latestDate = null) {
  try {
    const response = await fetchText(candidate.url);
    const finalUrl = normalizeUrl(response.finalUrl);
    if (isLikelyListingPage(finalUrl, candidate.source)) {
      return null;
    }

    const $ = load(response.text);
    const readable = extractReadableArticle(response.text, finalUrl);
    const jsonLd = extractJsonLd($);
    const publishedAt =
      parseLooseDate(candidate.dateHint) ||
      extractDateFromJsonLd(jsonLd) ||
      extractMetaDate($) ||
      extractDateFromUrl(finalUrl);

    if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
      return null;
    }

    if (
      (earliestDate && publishedAt < earliestDate) ||
      (latestDate && publishedAt > addDays(latestDate, 1)) ||
      !isIssueDay(publishedAt)
    ) {
      return null;
    }

    const title = cleanText(
      readable?.title ||
        $('meta[property="og:title"]').attr("content") ||
        $("title").text() ||
        candidate.title
    );
    const bodyHtml = sanitizeContent(readable?.content || fallbackBodyHtml($));
    const bodyText = cleanText(readable?.textContent || load(bodyHtml).text());
    const summary = summarizeText(
      cleanText(
        readable?.excerpt ||
          $('meta[name="description"]').attr("content") ||
          $('meta[property="og:description"]').attr("content") ||
          candidate.summaryHint ||
          title
      ),
      260
    );

    if (title.length < 12 || (bodyText.length < 80 && summary.length < 50)) {
      return null;
    }

    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $("article img").first().attr("src") ||
      $("img").first().attr("src") ||
      "";

    const canonicalHref = $('link[rel="canonical"]').attr("href");
    const canonicalUrl = canonicalHref ? safeUrl(canonicalHref, finalUrl) : finalUrl;

    const article = {
      id: `${toIsoDate(getWeekStartForDate(publishedAt))}-${slugify(title)}`,
      source: candidate.source.name,
      sourceHost: candidate.source.hostname,
      title,
      summary,
      originalUrl: finalUrl,
      canonicalUrl: canonicalUrl ? normalizeUrl(canonicalUrl) : finalUrl,
      publishedAt: publishedAt.toISOString(),
      image: image ? safeUrl(image, finalUrl) || image : "",
      bodyHtml,
      bodyText
    };

    article.segment = classifySegment(article, candidate.source);
    if (!article.segment || !isHealthcareRelevantArticle(article) || !isIndustryRelevantArticle(article, article.segment)) {
      return null;
    }

    if (!isRegionRelevant(article, candidate.source)) {
      return null;
    }

    article.category = chooseCategory(article, article.segment);
    article.score = scoreArticle(article, candidate.source);
    article.issueKey = toIsoDate(getWeekStartForDate(publishedAt));
    Object.assign(article, detectRegionAndCountry(article, candidate.source));
    article.thbAction = buildThbActionForArticle(article, article.segment)?.pitch || "";

    return article;
  } catch {
    return null;
  }
}
