import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import pLimit from "p-limit";

import { buildThbActions, SEGMENT_ORDER } from "./content-utils.js";
import {
  addDays,
  enumerateIssueWindows,
  formatLongDate,
  getIssueStatus,
  sortDatesDesc
} from "./date-utils.js";
import { extractArticle, getSourceCandidates } from "./extractors.js";
import { getSourceRegistry } from "./source-registry.js";

function uniqueBy(items, keySelector) {
  const map = new Map();
  for (const item of items) {
    const key = keySelector(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function normalizeTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .join(" ");
}

function storyFingerprint(article) {
  return normalizeTitle(article.title) || article.canonicalUrl || article.originalUrl || article.id;
}

function articleSourcePriority(article) {
  const source = (article.source || "").toLowerCase();
  if (source.includes("reuters")) return 5;
  if (source.includes("et healthworld") || source.includes("economic times")) return 4;
  if (source.includes("express healthcare")) return 3;
  return 2;
}

function dedupeStories(items) {
  const deduped = [];
  const seen = new Set();

  for (const item of items) {
    const urlKey = item.canonicalUrl || item.originalUrl;
    const storyKey = storyFingerprint(item);

    if (urlKey && seen.has(urlKey)) {
      continue;
    }

    if (storyKey && seen.has(`story:${storyKey}`)) {
      continue;
    }

    deduped.push(item);
    if (urlKey) {
      seen.add(urlKey);
    }
    if (storyKey) {
      seen.add(`story:${storyKey}`);
    }
  }

  return deduped;
}

async function writeJsonFile(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function loadExistingIssues(outputDir) {
  const index = await readJsonFile(path.join(outputDir, "issues", "index.json"));
  if (!index?.issues?.length) {
    return new Map();
  }

  const issueEntries = await Promise.all(
    index.issues.map(async (issueMeta) => {
      const issue = await readJsonFile(path.join(outputDir, "issues", `${issueMeta.key}.json`));
      return issue ? [issueMeta.key, issue] : null;
    })
  );

  return new Map(issueEntries.filter(Boolean));
}

function createIssueSkeleton(windowInfo, now) {
  return {
    key: windowInfo.key,
    issueNumber: windowInfo.issueNumber,
    rangeLabel: windowInfo.rangeLabel,
    startDate: windowInfo.start.toISOString(),
    endDate: windowInfo.end.toISOString(),
    status: getIssueStatus(windowInfo, now),
    updatedAt: now.toISOString(),
    coverage: {
      pharma: 0,
      providers: 0,
      diagnostics: 0,
      healthtech: 0
    },
    sourcesUsed: [],
    segments: {
      pharma: [],
      providers: [],
      diagnostics: [],
      healthtech: []
    },
    thbActions: []
  };
}

function createIssueArticleSummary(article) {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    source: article.source,
    sourceHost: article.sourceHost,
    region: article.region,
    country: article.country,
    publishedAt: article.publishedAt,
    publishedLabel: formatLongDate(new Date(article.publishedAt)),
    category: article.category,
    image: article.image,
    thbAction: article.thbAction,
    justIn: Boolean(article.justIn),
    originalUrl: article.originalUrl,
    articlePath: `/article.html?issue=${article.issueKey}&article=${article.id}`
  };
}

function createArticleDetail(article) {
  return {
    id: article.id,
    issueKey: article.issueKey,
    segment: article.segment,
    title: article.title,
    summary: article.summary,
    source: article.source,
    sourceHost: article.sourceHost,
    region: article.region,
    country: article.country,
    publishedAt: article.publishedAt,
    publishedLabel: formatLongDate(new Date(article.publishedAt)),
    category: article.category,
    image: article.image,
    thbAction: article.thbAction,
    justIn: Boolean(article.justIn),
    originalUrl: article.originalUrl,
    canonicalUrl: article.canonicalUrl,
    contentHtml: article.bodyHtml
  };
}

export async function generateNewsletter({
  weeks = 8,
  outputDir = path.resolve("data"),
  now = new Date()
} = {}) {
  const existingIssues = await loadExistingIssues(outputDir);
  const sources = getSourceRegistry();

  const sourceLimit = pLimit(6);
  const candidateGroups = await Promise.all(
    sources.map((source) => sourceLimit(() => getSourceCandidates(source)))
  );

  const candidates = uniqueBy(candidateGroups.flat(), (candidate) => candidate.url);
  const articleLimit = pLimit(8);
  const extractedArticles = (
    await Promise.all(candidates.map((candidate) => articleLimit(() => extractArticle(candidate))))
  ).filter(Boolean);

  const latestArticleDate = extractedArticles.reduce((latest, article) => {
    const articleDate = new Date(article.publishedAt);
    if (!latest || articleDate > latest) {
      return articleDate;
    }
    return latest;
  }, null);

  const effectiveNow =
    latestArticleDate && latestArticleDate < addDays(now, -14) ? latestArticleDate : now;
  const windows = enumerateIssueWindows({ weeks, now: effectiveNow });
  if (windows.length === 0) {
    throw new Error("No issue windows available for generation.");
  }

  const earliestDate = windows[0].start;
  const latestDate = windows[windows.length - 1].end;

  const issues = new Map(windows.map((windowInfo) => [windowInfo.key, createIssueSkeleton(windowInfo, now)]));
  const articleWritePayloads = [];

  for (const article of extractedArticles) {
    const articleDate = new Date(article.publishedAt);
    if (articleDate < earliestDate || articleDate > addDays(latestDate, 1)) {
      continue;
    }

    const issue = issues.get(article.issueKey);
    if (!issue) {
      continue;
    }

    issue.sourcesUsed.push(article.source);
    issue.segments[article.segment].push(article);
  }

  for (const issue of issues.values()) {
    issue.sourcesUsed = [...new Set(issue.sourcesUsed)].sort();

    for (const segment of SEGMENT_ORDER) {
      const previousIssue = existingIssues.get(issue.key);
      const previousStories = new Set(
        (previousIssue?.segments?.[segment] || []).map((article) => storyFingerprint(article))
      );

      const sorted = dedupeStories(
        issue.segments[segment].sort((left, right) => {
          const sourceDelta = articleSourcePriority(right) - articleSourcePriority(left);
          if (sourceDelta !== 0) {
            return sourceDelta;
          }

          if (right.score !== left.score) {
            return right.score - left.score;
          }
          return sortDatesDesc(new Date(left.publishedAt), new Date(right.publishedAt));
        })
      ).slice(0, 50);

      sorted.forEach((article) => {
        article.justIn = issue.status === "live" && previousStories.size > 0
          ? !previousStories.has(storyFingerprint(article))
          : false;
      });

      issue.coverage[segment] = sorted.length;
      issue.segments[segment] = sorted.map(createIssueArticleSummary);

      for (const article of sorted) {
        articleWritePayloads.push({
          filePath: path.join(outputDir, "articles", issue.key, `${article.id}.json`),
          payload: createArticleDetail(article)
        });
      }
    }

    issue.thbActions = buildThbActions(issue);
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await Promise.all(articleWritePayloads.map((entry) => writeJsonFile(entry.filePath, entry.payload)));

  const orderedIssues = windows
    .map((windowInfo) => issues.get(windowInfo.key))
    .filter(Boolean);

  await Promise.all(
    orderedIssues.map((issue) =>
      writeJsonFile(path.join(outputDir, "issues", `${issue.key}.json`), issue)
    )
  );

  await writeJsonFile(path.join(outputDir, "issues", "index.json"), {
    updatedAt: now.toISOString(),
    latestIssueKey: orderedIssues[orderedIssues.length - 1]?.key || null,
    issues: orderedIssues.map((issue) => ({
      key: issue.key,
      issueNumber: issue.issueNumber,
      rangeLabel: issue.rangeLabel,
      status: issue.status,
      coverage: issue.coverage
    }))
  });

  return {
    windows: orderedIssues.length,
    sources: sources.length,
    candidates: candidates.length,
    articles: extractedArticles.length,
    issues: orderedIssues
  };
}
