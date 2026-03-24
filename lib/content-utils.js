import { load } from "cheerio";

const INDIA_TERMS = [
  "india",
  "indian",
  "delhi",
  "mumbai",
  "hyderabad",
  "bengaluru",
  "bangalore",
  "chennai",
  "pune",
  "gujarat",
  "maharashtra",
  "apollo",
  "fortis",
  "cipla",
  "sun pharma",
  "dr reddy",
  "dr. reddy",
  "biocon",
  "zydus",
  "lupin",
  "mankind pharma",
  "torrent pharma",
  "serum institute",
  "ayushman bharat"
];

const MIDDLE_EAST_TERMS = [
  "middle east",
  "gulf",
  "gcc",
  "uae",
  "united arab emirates",
  "dubai",
  "abu dhabi",
  "saudi",
  "riyadh",
  "jeddah",
  "qatar",
  "doha",
  "oman",
  "kuwait",
  "bahrain",
  "oman",
  "emirates"
];

export const SEGMENT_KEYWORDS = {
  pharma: [
    "pharma",
    "pharmaceutical",
    "drug",
    "therapy",
    "biotech",
    "biopharma",
    "clinical trial",
    "approval",
    "molecule",
    "biosimilar",
    "formulation",
    "manufacturing",
    "api",
    "vaccine"
  ],
  providers: [
    "hospital",
    "provider",
    "clinic",
    "care network",
    "bed",
    "patient",
    "surgery",
    "health system",
    "medical center",
    "medical city",
    "care delivery",
    "outpatient"
  ],
  diagnostics: [
    "diagnostic",
    "diagnostics",
    "lab",
    "pathology",
    "screening",
    "assay",
    "test",
    "testing",
    "radiology",
    "imaging",
    "mri",
    "ct scan",
    "liquid biopsy",
    "genomic"
  ],
  healthtech: [
    "digital health",
    "healthtech",
    "telehealth",
    "telemedicine",
    "software",
    "saas",
    "platform",
    "wearable",
    "ai",
    "app",
    "ehr",
    "emr",
    "digital therapeutics",
    "virtual care"
  ]
};

const STRONG_SEGMENT_TERMS = {
  pharma: ["pharma", "drug", "vaccine", "clinical", "approval", "biosimilar", "therapy", "manufacturing"],
  providers: ["hospital", "provider", "clinic", "health system", "medical city", "patient care", "transplant", "bed"],
  diagnostics: ["diagnostic", "testing", "screening", "laboratory", "pathology", "imaging", "radiology", "genomic"],
  healthtech: ["digital health", "telehealth", "wearable", "ehr", "emr", "virtual care", "healthtech", "medtech ai"]
};

const NEGATIVE_GENERAL_TERMS = [
  "accident",
  "arrest",
  "attack",
  "crime",
  "war",
  "missile",
  "oil",
  "gas",
  "tax",
  "nightclub",
  "police",
  "speedboat",
  "geopolitics"
];

const PROVIDER_TITLE_EXCLUDES = [
  "panel discussion",
  "fireside chat",
  "digital health rests on data privacy",
  "tourism africa meeting",
  "vice-president",
  "reproductive health issues"
];

const DIAGNOSTICS_TITLE_EXCLUDES = [
  "panel discussion"
];

const HEALTHCARE_CORE_KEYWORDS = [
  "health",
  "healthcare",
  "hospital",
  "provider",
  "patient",
  "clinic",
  "medical",
  "medicine",
  "drug",
  "therapy",
  "pharma",
  "pharmaceutical",
  "diagnostic",
  "testing",
  "screening",
  "lab",
  "biotech",
  "biosimilar",
  "vaccine",
  "digital health",
  "care delivery"
];

const CATEGORY_HINTS = {
  pharma: [
    ["approval", "Approval"],
    ["clinical trial", "Clinical Trial"],
    ["manufacturing", "Manufacturing"],
    ["partnership", "Partnership"],
    ["deal", "Deal"],
    ["market", "Market"],
    ["launch", "Launch"]
  ],
  providers: [
    ["expansion", "Expansion"],
    ["hospital", "Hospital"],
    ["patient", "Patient Care"],
    ["funding", "Funding"],
    ["policy", "Policy"],
    ["ai", "AI Care Delivery"]
  ],
  diagnostics: [
    ["screening", "Screening"],
    ["diagnostic", "Diagnostics"],
    ["lab", "Lab Network"],
    ["genomic", "Genomics"],
    ["imaging", "Imaging"],
    ["cancer", "Cancer Testing"]
  ],
  healthtech: [
    ["ai", "AI"],
    ["platform", "Platform"],
    ["tele", "Telehealth"],
    ["digital", "Digital Health"],
    ["wearable", "Wearables"],
    ["funding", "Funding"]
  ]
};

const THB_SOLUTIONS = {
  pharma: [
    {
      solution: "THB Pharma CRM",
      triggers: ["launch", "approval", "field force", "doctor", "hcp", "engagement", "brand"],
      pitch: "Position THB's pharma CRM and omnichannel HCP engagement workflows to support launch planning, KAM orchestration, and compliant follow-up across India and the Middle East."
    },
    {
      solution: "THB Commercial Analytics",
      triggers: ["market", "growth", "expansion", "revenue", "manufacturing", "export"],
      pitch: "Use the article as an entry point to pitch THB's commercial visibility layer for territory planning, account prioritization, and next-best-action for pharma leadership teams."
    }
  ],
  providers: [
    {
      solution: "THB Provider CRM",
      triggers: ["patient", "hospital", "clinic", "expansion", "network", "experience", "referral"],
      pitch: "Map the news to THB's provider CRM for referral growth, patient lifecycle engagement, and multi-facility relationship management across hospital and provider networks."
    },
    {
      solution: "THB Patient Engagement",
      triggers: ["outpatient", "care delivery", "discharge", "follow-up", "quality", "journey"],
      pitch: "Recommend THB's patient engagement workflows to improve acquisition, follow-up adherence, and post-discharge retention for expanding provider groups."
    }
  ],
  diagnostics: [
    {
      solution: "THB Diagnostics CRM",
      triggers: ["lab", "diagnostic", "testing", "screening", "collection", "pathology"],
      pitch: "Pitch THB's diagnostics CRM to help labs manage doctor outreach, collection-center expansion, and B2B referral relationships while improving conversion and retention."
    },
    {
      solution: "THB Network Growth",
      triggers: ["imaging", "genomic", "network", "expansion", "home collection", "hub-and-spoke"],
      pitch: "Use this signal to position THB for diagnostics network expansion, channel partner onboarding, and visibility across spoke sites, franchises, and enterprise accounts."
    }
  ]
};

const COUNTRY_RULES = [
  { label: "India", region: "India", terms: ["india", "indian", "delhi", "mumbai", "hyderabad", "bengaluru", "bangalore", "chennai", "pune"] },
  { label: "United Arab Emirates", region: "Middle East", terms: ["uae", "united arab emirates", "dubai", "abu dhabi", "emirates"] },
  { label: "Saudi Arabia", region: "Middle East", terms: ["saudi", "riyadh", "jeddah", "kingdom of saudi arabia"] },
  { label: "Qatar", region: "Middle East", terms: ["qatar", "doha"] },
  { label: "Kuwait", region: "Middle East", terms: ["kuwait"] },
  { label: "Oman", region: "Middle East", terms: ["oman", "muscat"] },
  { label: "Bahrain", region: "Middle East", terms: ["bahrain", "manama"] }
];

export const SEGMENT_ORDER = ["pharma", "providers", "diagnostics", "healthtech"];

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

export function cleanText(value) {
  return (value || "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim();
}

export function summarizeText(text, maxLength = 240) {
  const cleaned = cleanText(text);
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const snippet = cleaned.slice(0, maxLength);
  const lastSpace = snippet.lastIndexOf(" ");
  return `${snippet.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}...`;
}

export function sanitizeContent(html) {
  const $ = load(html || "");
  $("script, style, noscript, iframe, button, form, nav, header, footer, svg").remove();

  const allowed = new Set(["p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "strong", "em", "a", "figure", "figcaption", "img"]);
  $("*").each((_, element) => {
    const tagName = element.tagName?.toLowerCase();
    if (!allowed.has(tagName)) {
      $(element).replaceWith($(element).contents());
      return;
    }

    const attributes = { ...element.attribs };
    for (const [name] of Object.entries(attributes)) {
      const keep =
        (tagName === "a" && name === "href") ||
        (tagName === "img" && ["src", "alt", "title"].includes(name));
      if (!keep) {
        $(element).removeAttr(name);
      }
    }
  });

  $("a[href]").each((_, anchor) => {
    $(anchor).attr("target", "_blank");
    $(anchor).attr("rel", "noopener noreferrer");
  });

  return $.html();
}

export function classifySegment(article, source) {
  const text = `${article.title} ${article.summary} ${article.bodyText}`.toLowerCase();

  if (source.pool !== "mixed") {
    const directHits = countKeywordHits(text, SEGMENT_KEYWORDS[source.pool] || []);
    const strongHits = countKeywordHits(text, STRONG_SEGMENT_TERMS[source.pool] || []);
    if ((source.pool === "pharma" && directHits < 2 && strongHits === 0) || (source.pool !== "pharma" && strongHits === 0)) {
      return null;
    }
    return source.pool;
  }

  let winner = "pharma";
  let winnerScore = -1;

  const providerBaseHits = countKeywordHits(text, SEGMENT_KEYWORDS.providers || []);
  const providerStrongHits = countKeywordHits(text, STRONG_SEGMENT_TERMS.providers || []);
  const diagnosticsBaseHits = countKeywordHits(text, SEGMENT_KEYWORDS.diagnostics || []);
  const diagnosticsStrongHits = countKeywordHits(text, STRONG_SEGMENT_TERMS.diagnostics || []);
  const titleText = `${article.title} ${article.summary}`.toLowerCase();
  const hasProviderAnchor =
    keywordMatches(titleText, "hospital") ||
    keywordMatches(titleText, "hospitals") ||
    keywordMatches(titleText, "clinic") ||
    keywordMatches(titleText, "provider") ||
    keywordMatches(titleText, "centre") ||
    keywordMatches(titleText, "center");
  const hasDiagnosticsAnchor =
    keywordMatches(titleText, "diagnostic") ||
    keywordMatches(titleText, "diagnostics") ||
    keywordMatches(titleText, "lab") ||
    keywordMatches(titleText, "laboratory");

  if (
    hasProviderAnchor &&
    providerStrongHits >= 1 &&
    providerStrongHits >= diagnosticsStrongHits
  ) {
    return "providers";
  }

  if (
    hasDiagnosticsAnchor &&
    diagnosticsStrongHits >= 1 &&
    diagnosticsStrongHits > providerStrongHits
  ) {
    return "diagnostics";
  }

  for (const [segment, keywords] of Object.entries(SEGMENT_KEYWORDS)) {
    const baseHits = countKeywordHits(text, keywords);
    const strongHits = countKeywordHits(text, STRONG_SEGMENT_TERMS[segment] || []);
    const score = baseHits + strongHits * 2;
    if (score > winnerScore) {
      winner = segment;
      winnerScore = score;
    }
  }

  const winnerBaseHits = countKeywordHits(text, SEGMENT_KEYWORDS[winner] || []);
  const winnerStrongHits = countKeywordHits(text, STRONG_SEGMENT_TERMS[winner] || []);
  return winnerScore >= 2 && (winnerStrongHits >= 1 || winnerBaseHits >= 2) ? winner : null;
}

export function chooseCategory(article, segment) {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  const matches = CATEGORY_HINTS[segment] || [];

  for (const [keyword, label] of matches) {
    if (text.includes(keyword)) {
      return label;
    }
  }

  return segment === "providers" ? "Provider Update" : "Industry Update";
}

export function isRegionRelevant(article, source) {
  const text = `${article.title} ${article.summary} ${article.bodyText}`.toLowerCase();
  const hasIndia = INDIA_TERMS.some((term) => text.includes(term));
  const hasMiddleEast = MIDDLE_EAST_TERMS.some((term) => text.includes(term));

  if (source.region === "india") {
    return hasIndia || source.pool === "pharma";
  }
  if (source.region === "middle-east") {
    return hasMiddleEast;
  }
  if (source.region === "multi-region") {
    return hasIndia || hasMiddleEast;
  }

  return hasIndia || hasMiddleEast;
}

export function isHealthcareRelevantArticle(article) {
  const text = `${article.title} ${article.summary} ${article.bodyText}`.toLowerCase();
  return HEALTHCARE_CORE_KEYWORDS.some((keyword) => keywordMatches(text, keyword));
}

export function isIndustryRelevantArticle(article, segment) {
  const text = `${article.title} ${article.summary} ${article.bodyText}`.toLowerCase();
  const title = `${article.title}`.toLowerCase();
  const baseHits = countKeywordHits(text, SEGMENT_KEYWORDS[segment] || []);
  const strongHits = countKeywordHits(text, STRONG_SEGMENT_TERMS[segment] || []);
  const hasNegative = NEGATIVE_GENERAL_TERMS.some((term) => text.includes(term));

  if (hasNegative && strongHits === 0 && baseHits < 2) {
    return false;
  }

  if (segment === "providers" && PROVIDER_TITLE_EXCLUDES.some((term) => title.includes(term))) {
    return false;
  }

  if (segment === "diagnostics" && DIAGNOSTICS_TITLE_EXCLUDES.some((term) => title.includes(term))) {
    return false;
  }

  if (segment === "pharma") {
    return strongHits >= 1 || baseHits >= 2;
  }

  return strongHits >= 1;
}

function countKeywordHits(text, keywords) {
  return keywords.reduce((total, keyword) => total + (keywordMatches(text, keyword) ? 1 : 0), 0);
}

function keywordMatches(text, keyword) {
  if (keyword.includes(" ")) {
    return text.includes(keyword);
  }

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

export function scoreArticle(article, source) {
  const text = `${article.title} ${article.summary} ${article.bodyText}`.toLowerCase();
  let score = 0;

  if (source.priority === 1) {
    score += 20;
  } else if (source.priority === 2) {
    score += 10;
  }

  if (isRegionRelevant(article, source)) {
    score += 30;
  }

  for (const keyword of SEGMENT_KEYWORDS[article.segment] || []) {
    if (text.includes(keyword)) {
      score += 2;
    }
  }

  if (article.summary.length > 120) {
    score += 5;
  }

  if (article.bodyText.length > 1400) {
    score += 5;
  }

  return score;
}

export function buildThbActions(issue) {
  const actions = [];

  for (const segment of ["pharma", "providers", "diagnostics"]) {
    const articles = (issue.segments[segment] || []).slice(0, 5);

    for (const article of articles) {
      const playbook = buildThbActionForArticle(article, segment);

      actions.push({
        segment,
        articleId: article.id,
        title: article.title,
        source: article.source,
        solution: playbook.solution,
        action: playbook.pitch
      });
    }
  }

  return actions;
}

export function buildThbActionForArticle(article, segment) {
  const playbooks = THB_SOLUTIONS[segment] || [];
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return playbooks.find((entry) => entry.triggers.some((trigger) => text.includes(trigger))) || playbooks[0];
}

export function detectRegionAndCountry(article, source) {
  const text = `${article.title} ${article.summary} ${article.bodyText}`.toLowerCase();
  const matchedRule = COUNTRY_RULES.find((rule) => rule.terms.some((term) => text.includes(term)));

  if (matchedRule) {
    return {
      region: matchedRule.region,
      country: matchedRule.label
    };
  }

  if (source.region === "india") {
    return { region: "India", country: "India" };
  }

  if (source.region === "middle-east") {
    return { region: "Middle East", country: "Middle East" };
  }

  if (source.region === "multi-region") {
    return { region: "India + Middle East", country: "Regional" };
  }

  return { region: "India + Middle East", country: "Regional" };
}
