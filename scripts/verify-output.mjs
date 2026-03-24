import { readFile } from "node:fs/promises";
import path from "node:path";

const indexPath = path.resolve("data/issues/index.json");
const issueIndex = JSON.parse(await readFile(indexPath, "utf8"));
const verifiedSegments = ["pharma", "providers", "diagnostics"];

const findings = [];

for (const item of issueIndex.issues) {
  const issuePath = path.resolve(`data/issues/${item.key}.json`);
  const issue = JSON.parse(await readFile(issuePath, "utf8"));

  for (const segment of verifiedSegments) {
    const count = issue.coverage[segment] ?? 0;
    if (count > 50) {
      findings.push(`[error] ${item.key} ${segment} has ${count} stories`);
    }
    if (count < 20) {
      findings.push(`[warn] ${item.key} ${segment} has only ${count} verified stories`);
    }
  }

  for (const segment of verifiedSegments) {
    for (const article of issue.segments[segment]) {
      if (!article.originalUrl.startsWith("http")) {
        findings.push(`[error] ${item.key} ${segment} article ${article.id} has invalid originalUrl`);
      }
      if (!article.articlePath.startsWith("/article.html")) {
        findings.push(`[error] ${item.key} ${segment} article ${article.id} has invalid articlePath`);
      }
    }
  }
}

if (findings.length === 0) {
  console.log("Verification passed without findings.");
  process.exit(0);
}

for (const finding of findings) {
  console.log(finding);
}

process.exit(findings.some((finding) => finding.startsWith("[error]")) ? 1 : 0);
