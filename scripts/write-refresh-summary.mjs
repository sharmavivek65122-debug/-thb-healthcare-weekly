import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

const indexPath = path.resolve("data/issues/index.json");
const issueIndex = JSON.parse(await readFile(indexPath, "utf8"));
const latestIssueMeta = issueIndex.issues.find((issue) => issue.key === issueIndex.latestIssueKey);

if (!latestIssueMeta) {
  const message = "No latest issue metadata was found in data/issues/index.json.";
  console.error(message);
  process.exit(1);
}

const issuePath = path.resolve(`data/issues/${latestIssueMeta.key}.json`);
const issue = JSON.parse(await readFile(issuePath, "utf8"));
const segments = [
  { key: "providers", label: "Hospitals" },
  { key: "diagnostics", label: "Diagnostics" },
  { key: "pharma", label: "Pharma" }
];

const totalStories = segments.reduce((total, segment) => total + (issue.coverage?.[segment.key] ?? 0), 0);
const lines = [
  "# THB Newsletter Refresh Summary",
  "",
  `- Trigger: \`${process.env.GITHUB_EVENT_NAME || "manual"}\``,
  `- Generated At: \`${new Date().toISOString()}\``,
  `- Latest Issue: \`Issue #${issue.issueNumber} | ${issue.rangeLabel}\``,
  `- Issue Window: \`${issue.key}\` to \`${formatIso(issue.endDate)}\``,
  `- Status: \`${issue.status}\``,
  `- Total Validated Stories: \`${totalStories}\``
];

for (const segment of segments) {
  const articles = issue.segments?.[segment.key] || [];
  const count = issue.coverage?.[segment.key] ?? articles.length;
  lines.push(`- ${segment.label}: \`${count}\``);

  if (articles.length > 0) {
    lines.push(`  Top Story: ${articles[0].title}`);
  } else {
    lines.push(`  Top Story: No validated story yet in this section.`);
  }
}

const summary = `${lines.join("\n")}\n`;
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
}

if (process.env.GITHUB_ACTIONS && totalStories === 0) {
  console.log(
    `::warning title=No validated stories added::Latest issue ${issue.rangeLabel} currently has 0 validated stories across hospitals, diagnostics, and pharma.`
  );
}

function formatIso(value) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(new Date(value));
}
