import fs from "node:fs";
import path from "node:path";

const issuePath = process.argv[2];

if (!issuePath) {
  console.error("Usage: node newsletter/scripts/validate-newsletter-structure.mjs <issue-file>");
  process.exit(1);
}

const absolutePath = path.resolve(issuePath);
const markdown = fs.readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");

const sectionRules = [
  { title: "Hospitals & Providers", min: 20, max: 50 },
  { title: "Diagnostics", min: 20, max: 50 },
  { title: "Pharma", min: 20, max: 50 }
];

const requiredFields = [
  "Region:",
  "Country:",
  "Source:",
  "Published:",
  "Read full story:",
  "Summary:",
  "THB Action:"
];

const forbiddenTerms = /\bhealth[- ]?tech\b/i;
const allowedActionTerms = /\b(hospital|hospitals|provider|providers|diagnostic|diagnostics|pharma)\b/i;

let failed = false;

for (const rule of sectionRules) {
  const sectionPattern = new RegExp(
    `## ${escapeRegex(rule.title)}\\n([\\s\\S]*?)(?=\\n## |$)`
  );
  const match = markdown.match(sectionPattern);

  if (!match) {
    console.error(`Missing section: ${rule.title}`);
    failed = true;
    continue;
  }

  const body = match[1];
  const articleBlocks = body
    .split(/\n### /)
    .map((block, index) => (index === 0 ? block : `### ${block}`))
    .filter((block) => block.trim().startsWith("### "));

  const coverageGapMatch = body.match(/Coverage gap:\s*(.+)/i);
  const coverageGap = coverageGapMatch?.[1]?.trim() || "";
  const hasCoverageGapNote =
    coverageGap.length > 0 &&
    !/^`?none`?$/i.test(coverageGap) &&
    !/^none$/i.test(coverageGap);

  const count = articleBlocks.length;

  if (count < rule.min && !hasCoverageGapNote) {
    console.error(
      `${rule.title}: found ${count} articles. Add a Coverage gap note when fewer than ${rule.min} validated items are available.`
    );
    failed = true;
  }

  if (count > rule.max) {
    console.error(
      `${rule.title}: found ${count} articles. Maximum allowed is ${rule.max}.`
    );
    failed = true;
  }

  articleBlocks.forEach((block, index) => {
    for (const field of requiredFields) {
      if (!block.includes(field)) {
        console.error(`${rule.title} article ${index + 1}: missing field "${field}"`);
        failed = true;
      }
    }

    const actionLine = block
      .split("\n")
      .find((line) => line.trim().startsWith("- THB Action:"));

    if (actionLine) {
      if (forbiddenTerms.test(actionLine)) {
        console.error(
          `${rule.title} article ${index + 1}: THB Action must not mention health-tech.`
        );
        failed = true;
      }

      if (!allowedActionTerms.test(actionLine)) {
        console.error(
          `${rule.title} article ${index + 1}: THB Action should tie back to hospitals/providers, diagnostics, or pharma.`
        );
        failed = true;
      }
    }
  });
}

if (!/## QA Log/m.test(markdown)) {
  console.error("Missing section: QA Log");
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(`Structure check passed for ${absolutePath}`);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
