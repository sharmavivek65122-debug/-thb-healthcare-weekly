import fs from "node:fs";
import path from "node:path";

const issuePath = process.argv[2];

if (!issuePath) {
  console.error("Usage: node newsletter/scripts/validate-newsletter-links.mjs <issue-file>");
  process.exit(1);
}

const absolutePath = path.resolve(issuePath);
const markdown = fs.readFileSync(absolutePath, "utf8");
const urls = [...markdown.matchAll(/\[.*?\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => match[1]);
const uniqueUrls = [...new Set(urls)];

if (uniqueUrls.length === 0) {
  console.error("No URLs found in issue file.");
  process.exit(1);
}

const failures = [];

for (const url of uniqueUrls) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "THBNewsletterLinkValidator/1.0"
      }
    });

    const finalUrl = response.url;
    const contentType = response.headers.get("content-type") || "";
    const html = await response.text();

    if (!response.ok) {
      failures.push({ url, reason: `HTTP ${response.status}` });
      continue;
    }

    if (!contentType.includes("text/html")) {
      failures.push({ url, reason: `Unexpected content type: ${contentType}` });
      continue;
    }

    const landingReason = getLandingPageReason(finalUrl, html);
    if (landingReason) {
      failures.push({ url, reason: landingReason });
      continue;
    }

    const articleReason = getArticleSignalReason(html);
    if (articleReason) {
      failures.push({ url, reason: articleReason });
      continue;
    }
  } catch (error) {
    failures.push({ url, reason: error.message });
  }
}

if (failures.length > 0) {
  console.error("Link validation failed:");
  failures.forEach((failure) => {
    console.error(`- ${failure.url}`);
    console.error(`  Reason: ${failure.reason}`);
  });
  process.exit(1);
}

console.log(`Link check passed for ${absolutePath}`);

function getLandingPageReason(finalUrl, html) {
  const normalizedUrl = finalUrl.toLowerCase();
  const normalizedHtml = html.toLowerCase();
  const disallowedPaths = [
    /^https?:\/\/[^/]+\/?$/,
    /\/about\/?$/,
    /\/aboutus\/?$/,
    /\/awards(?:-accreditation)?\/?$/,
    /\/blog\/?$/,
    /\/category\/?/,
    /\/defaultinterstitial/,
    /\/events\/?$/,
    /\/home\/?$/,
    /\/hub\/health\/?$/,
    /\/latest-news\/?$/,
    /\/media(?:-centre)?\/?$/,
    /\/news\/?$/,
    /\/newsroom\/?$/,
    /\/press-releases\/?$/,
    /\/press-release\.php\/?$/,
    /\/search\/?/,
    /\/tag\/?/
  ];

  if (disallowedPaths.some((pattern) => pattern.test(normalizedUrl))) {
    return `Final URL looks like a landing page: ${finalUrl}`;
  }

  const disallowedPageText = [
    "about us",
    "advertorial",
    "awards & accreditation",
    "brand connect initiative",
    "partner content",
    "sponsored"
  ];

  const matchedText = disallowedPageText.find((token) => normalizedHtml.includes(token));
  if (matchedText) {
    return `Page content suggests non-editorial or generic content: "${matchedText}"`;
  }

  return "";
}

function getArticleSignalReason(html) {
  const normalizedHtml = html.toLowerCase();
  const signals = [
    "application/ld+json",
    "\"@type\":\"newsarticle\"",
    "\"@type\":\"article\"",
    "property=\"og:type\" content=\"article\"",
    "<article"
  ];

  const hasSignal = signals.some((signal) => normalizedHtml.includes(signal));
  if (!hasSignal) {
    return "No strong article signal found in final page HTML.";
  }

  const visibleText = normalizedHtml
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (visibleText.length < 800) {
    return "Final page does not appear to contain enough readable article text.";
  }

  return "";
}
