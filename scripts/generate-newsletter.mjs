import path from "node:path";

import { generateNewsletter } from "../lib/generator.js";

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] || fallback;
}

const weeks = Number(readArg("weeks", "8"));
const outputDir = path.resolve(readArg("output", "data"));
const nowArg = readArg("now", "");
const now = nowArg ? new Date(nowArg) : new Date();

const result = await generateNewsletter({
  weeks,
  outputDir,
  now
});

console.log(JSON.stringify({
  generatedIssues: result.windows,
  scannedSources: result.sources,
  discoveredCandidates: result.candidates,
  extractedArticles: result.articles
}, null, 2));
