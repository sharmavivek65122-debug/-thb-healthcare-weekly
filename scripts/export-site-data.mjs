import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseIsoDate, toIsoDate } from "../lib/date-utils.js";

const DATA_DIR = path.resolve("data");
const ISSUES_DIR = path.resolve("newsletter/issues");
const MANIFEST_PATH = path.join(DATA_DIR, "site-manifest.json");
const INDEX_PATH = path.join(DATA_DIR, "issues", "index.json");

const issueIndex = JSON.parse(await readFile(INDEX_PATH, "utf8"));

await rm(ISSUES_DIR, { recursive: true, force: true });
await mkdir(ISSUES_DIR, { recursive: true });

const manifest = {
  cadence: "Weekly issue refreshed daily with newly available articles from Sunday to Saturday. Full issue published every Saturday.",
  latestIssueKey: issueIndex.latestIssueKey,
  issues: []
};

for (const issueMeta of issueIndex.issues) {
  const issuePath = path.join(DATA_DIR, "issues", `${issueMeta.key}.json`);
  const issue = JSON.parse(await readFile(issuePath, "utf8"));
  const fileName = `${issue.key}.md`;
  const filePath = path.join(ISSUES_DIR, fileName);
  const markdown = renderIssueMarkdown(issue);

  await writeFile(filePath, `${markdown}\n`, "utf8");
  manifest.issues.push({
    key: issue.key,
    label: `Issue #${issue.issueNumber} | ${issue.rangeLabel}`,
    file: `/newsletter/issues/${fileName}`
  });
}

await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Exported ${manifest.issues.length} markdown issues and site manifest.`);

function renderIssueMarkdown(issue) {
  const executiveSummary = buildExecutiveSummary(issue);
  const startDate = toIsoDate(parseIsoDate(issue.startDate));
  const endDate = toIsoDate(parseIsoDate(issue.endDate));

  return [
    "# THB NeuraLink Weekly Newsletter",
    "",
    `Issue Date: \`${endDate}\``,
    `Coverage Window: \`${startDate}\` to \`${endDate}\``,
    "Regions: `India`, `Middle East`",
    "",
    "## Executive Summary",
    "",
    executiveSummary,
    "",
    renderSection("Hospitals & Providers", issue.segments.providers, issue.coverage.providers),
    "",
    renderSection("Diagnostics", issue.segments.diagnostics, issue.coverage.diagnostics),
    "",
    renderSection("Pharma", issue.segments.pharma, issue.coverage.pharma),
    "",
    "## QA Log",
    ""
  ].join("\n");
}

function renderSection(title, articles, count) {
  const lines = [`## ${title}`, ""];

  if (count < 20) {
    lines.push(
      `Coverage gap: \`Validated ${count} direct-story links for this issue window after rejecting landing pages, weak redirects, and low-confidence articles.\``,
      ""
    );
  } else {
    lines.push("Coverage gap: `None`", "");
  }

  articles.forEach((article, index) => {
    lines.push(`### ${index + 1}. ${article.title}`);
    lines.push(`- Region: ${article.region}`);
    lines.push(`- Country: ${article.country}`);
    lines.push(`- Source: ${article.source}`);
    lines.push(`- Published: ${article.publishedLabel}`);
    lines.push(`- Just In: ${article.justIn ? "Yes" : "No"}`);
    lines.push(`- Read full story: [Source article](${article.originalUrl})`);
    lines.push(`- Summary: ${article.summary}`);
    lines.push(`- THB Action: ${article.thbAction || ""}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

function buildExecutiveSummary(issue) {
  const parts = [
    `${issue.coverage.providers} validated hospitals/providers stories`,
    `${issue.coverage.diagnostics} diagnostics stories`,
    `${issue.coverage.pharma} pharma stories`
  ];

  const topHighlights = [
    issue.segments.providers[0]?.title,
    issue.segments.diagnostics[0]?.title,
    issue.segments.pharma[0]?.title
  ].filter(Boolean);

  const highlightCopy = topHighlights.length
    ? `Top validated headlines include ${topHighlights.map((title) => `"${title}"`).join(", ")}.`
    : "This issue publishes only validated direct-story links for India and Middle East coverage.";

  return `This issue covers ${parts.join(", ")} across India and the Middle East. ${highlightCopy}`;
}
