const manifestPath = "./data/site-manifest.json";
const executiveCopy =
  "This issue uses the highest-confidence article-level links available from the approved India and Middle East source pool. Several source URLs land into generic newsroom pages, company homepages, or interstitials, so this issue favours fewer validated stories over padded volume.";

const issueSelect = document.querySelector("#issue-select");
const refreshButton = document.querySelector("#refresh-issues");
const refreshStatus = document.querySelector("#refresh-status");
const executiveSummary = document.querySelector("#executive-summary");
const sectionNav = document.querySelector("#section-nav");
const sectionsRoot = document.querySelector("#sections-root");
const cadenceCopy = document.querySelector("#cadence-copy");
const progressBar = document.querySelector("#page-progress-bar");

let manifestState = null;
let statusTimer = null;
let sectionObserver = null;
const issueArticleRegistry = new Map();

bootstrap().catch((error) => {
  console.error(error);
  sectionsRoot.innerHTML = `<div class="state-message">Unable to load the newsletter right now.</div>`;
});

async function bootstrap() {
  manifestState = await loadJson(manifestPath);
  cadenceCopy.innerHTML = buildCadenceLine(manifestState.cadence, 0);
  bindEvents();
  renderIssueOptions(manifestState.issues);

  const requestedKey = new URLSearchParams(window.location.search).get("issue");
  const issueMeta = pickIssue(manifestState, requestedKey);

  if (!issueMeta) {
    sectionsRoot.innerHTML = `<div class="state-message">No issues are available yet.</div>`;
    return;
  }

  issueSelect.value = issueMeta.key;
  await renderIssue(issueMeta);
}

function bindEvents() {
  issueSelect.addEventListener("change", async () => {
    const issueMeta = manifestState.issues.find((issue) => issue.key === issueSelect.value);
    if (!issueMeta) return;
    updateIssueQuery(issueMeta.key);
    await renderIssue(issueMeta);
  });

  refreshButton.addEventListener("click", async () => {
    const previousLatest = manifestState?.latestIssueKey;
    const currentKey = issueSelect.value;
    setStatus("Refreshing issues...");

    try {
      manifestState = await loadJson(manifestPath, true);
      renderIssueOptions(manifestState.issues);

      const issueMeta =
        manifestState.issues.find((issue) => issue.key === manifestState.latestIssueKey) ||
        manifestState.issues.find((issue) => issue.key === currentKey) ||
        manifestState.issues[0];

      if (!issueMeta) {
        sectionsRoot.innerHTML = `<div class="state-message">No issues are available yet.</div>`;
        setStatus("No issues are available yet.");
        return;
      }

      issueSelect.value = issueMeta.key;
      updateIssueQuery(issueMeta.key);
      await renderIssue(issueMeta, true, true);

      if (manifestState.latestIssueKey && manifestState.latestIssueKey !== previousLatest) {
        setStatus(`Latest uploaded issue loaded: ${issueMeta.label || issueMeta.key}.`);
      } else {
        setStatus(`Issues refreshed. Showing ${issueMeta.label || issueMeta.key}.`);
      }
    } catch (error) {
      console.error(error);
      setStatus("Refresh failed. Please try again.");
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scroll-target]");
    if (!button) return;
    const target = document.getElementById(button.dataset.scrollTarget);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  window.addEventListener("scroll", updateProgressBar, { passive: true });
  window.addEventListener("resize", updateProgressBar, { passive: true });
}

async function renderIssue(issueMeta, bustCache = false, markNewArticles = false) {
  const markdown = await loadText(issueMeta.file, bustCache);
  const issue = parseIssue(markdown, issueMeta.key, markNewArticles);
  executiveSummary.textContent = executiveCopy;
  const totalStories = issue.sections.reduce((total, section) => total + section.articles.length, 0);
  cadenceCopy.innerHTML = buildCadenceLine(manifestState.cadence, totalStories);

  renderNav(issue.sections);
  renderSections(issue.sections);
  watchSections();
  updateProgressBar();
  rememberIssueArticles(issueMeta.key, issue.sections);
}

function renderIssueOptions(issues) {
  issueSelect.innerHTML = issues
    .map(
      (issue) =>
        `<option value="${escapeHtml(issue.key)}">${escapeHtml(issue.label || issue.key)}</option>`
    )
    .join("");
}

function renderNav(sections) {
  sectionNav.innerHTML = sections
    .map(
      (section) =>
        `<a href="#${section.slug}" class="section-tag section-tag--${section.slug}" data-section-link="${escapeAttribute(section.slug)}">${escapeHtml(section.title)}</a>`
    )
    .join("");
}

function renderSections(sections) {
  const template = document.querySelector("#story-card-template");
  sectionsRoot.innerHTML = "";

  for (const section of sections) {
    const sectionElement = document.createElement("section");
    sectionElement.className = "newsletter-section card";
    sectionElement.id = section.slug;
    sectionElement.innerHTML = `
      <div class="section-heading">
        <h2>${escapeHtml(section.title)}</h2>
        <span class="section-tag section-tag--${section.slug}">${escapeHtml(section.shortLabel)}</span>
      </div>
      <div class="story-grid"></div>
    `;

    const grid = sectionElement.querySelector(".story-grid");
    if (!section.articles.length) {
    grid.innerHTML = `<div class="state-message">Validated stories feature here when published.</div>`;
    }

    section.articles.forEach((article, index) => {
      const fragment = template.content.cloneNode(true);
      const card = fragment.querySelector(".story-card");
      const badge = fragment.querySelector(".story-card__badge");
      card.style.setProperty("--card-delay", `${index * 45}ms`);
      fragment.querySelector(".story-card__country").textContent = article.country || "India / Middle East";
      fragment.querySelector(".story-card__date").textContent = article.published || "Date not listed";
      badge.hidden = !article.justIn;
      fragment.querySelector(".story-card__title").textContent = article.title;
      fragment.querySelector(".story-card__source").textContent = normalizeSourceLabel(article.source);
      fragment.querySelector(".story-card__summary").textContent = article.summary;
      fragment.querySelector(".button").href = article.readMoreUrl;
      grid.appendChild(fragment);
    });

    sectionsRoot.appendChild(sectionElement);
  }
}

function parseIssue(markdown, issueKey, markNewArticles = false) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const issue = {
    sections: [
      parseSection(normalized, ["Hospitals", "Hospitals & Providers"], "hospitals", "Hospitals"),
      parseSection(normalized, ["Diagnostics"], "diagnostics", "Diagnostics"),
      parseSection(normalized, ["Pharma"], "pharma", "Pharma")
    ]
  };

  return markNewArticles ? applyNewArticleFlags(issueKey, issue) : issue;
}

function parseSection(markdown, headings, slug, shortLabel) {
  const body = headings.map((heading) => sectionBody(markdown, heading)).find(Boolean) || "";
  const matches = [
    ...body.matchAll(/###\s+(?:\d+\.\s+)?([^\n]+)\n([\s\S]*?)(?=\n###\s+(?:\d+\.\s+)?|$)/g)
  ];
  const articles = dedupeArticles(matches.map((match) => parseArticle(match[1], match[2])));

  return {
    title: shortLabel,
    slug,
    shortLabel,
    articles
  };
}

function parseArticle(title, block) {
  const fields = Object.fromEntries(
    [...block.matchAll(/^- ([^:]+):\s*(.*)$/gm)].map((match) => [
      match[1].trim().toLowerCase(),
      match[2].trim()
    ])
  );
  const link = parseMarkdownLink(fields["read full story"]) || { url: fields["read full story"] };

  return {
    title: cleanInline(title),
    country: cleanInline(fields.country),
    source: cleanInline(fields.source),
    published: cleanInline(fields.published),
    summary: cleanInline(fields.summary),
    justIn: isTruthy(fields["just in"]),
    readMoreUrl: link.url
  };
}

function dedupeArticles(articles) {
  const unique = [];

  for (const article of articles) {
    const duplicateIndex = unique.findIndex((candidate) => isSameStory(candidate, article));
    if (duplicateIndex === -1) {
      unique.push(article);
      continue;
    }

    if (articleScore(article) > articleScore(unique[duplicateIndex])) {
      unique[duplicateIndex] = article;
    }
  }

  return unique;
}

function isSameStory(left, right) {
  if (!left.title || !right.title) {
    return false;
  }

  if (left.readMoreUrl && right.readMoreUrl && left.readMoreUrl === right.readMoreUrl) {
    return true;
  }

  const leftTokens = normalizeTitle(left.title);
  const rightTokens = normalizeTitle(right.title);

  if (leftTokens.join(" ") === rightTokens.join(" ")) {
    return true;
  }

  const shared = leftTokens.filter((token) => rightTokens.includes(token)).length;
  const smallerSet = Math.min(leftTokens.length, rightTokens.length);
  return smallerSet >= 4 && shared / smallerSet >= 0.8;
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function articleScore(article) {
  const source = (article.source || "").toLowerCase();
  if (source.includes("reuters")) return 5;
  if (source.includes("et healthworld") || source.includes("economic times")) return 4;
  if (source.includes("express healthcare")) return 3;
  return 2;
}

function isTruthy(value = "") {
  return ["yes", "true", "1", "just-in", "just in"].includes(cleanInline(value).toLowerCase());
}

function applyNewArticleFlags(issueKey, issue) {
  const previousArticles = issueArticleRegistry.get(issueKey);
  if (!previousArticles) {
    return issue;
  }

  return {
    ...issue,
    sections: issue.sections.map((section) => ({
      ...section,
      articles: section.articles.map((article) => ({
        ...article,
        justIn: article.justIn || !previousArticles.has(articleIdentity(article))
      }))
    }))
  };
}

function rememberIssueArticles(issueKey, sections) {
  issueArticleRegistry.set(
    issueKey,
    new Set(sections.flatMap((section) => section.articles.map((article) => articleIdentity(article))))
  );
}

function articleIdentity(article) {
  return article.readMoreUrl || `${article.title}|${article.source}|${article.published}`;
}

function sectionBody(markdown, title) {
  const heading = `## ${title}`;
  const start = markdown.indexOf(heading);
  if (start === -1) return "";
  const remainder = markdown.slice(start + heading.length).replace(/^\n+/, "");
  const nextSectionIndex = remainder.search(/\n## /);
  return nextSectionIndex === -1 ? remainder : remainder.slice(0, nextSectionIndex);
}

function parseMarkdownLink(value = "") {
  const match = value.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
  return match ? { label: match[1], url: match[2] } : null;
}

function pickIssue(manifest, requestedKey) {
  return (
    manifest.issues.find((issue) => issue.key === requestedKey) ||
    manifest.issues.find((issue) => issue.key === manifest.latestIssueKey) ||
    manifest.issues[0]
  );
}

function updateIssueQuery(issueKey) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("issue", issueKey);
  window.history.replaceState({}, "", nextUrl);
}

function watchSections() {
  if (sectionObserver) sectionObserver.disconnect();

  const sections = [...document.querySelectorAll(".newsletter-section")];
  if (!sections.length) return;

  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (!visible) return;
      setActiveSection(visible.target.id);
    },
    {
      rootMargin: "-18% 0px -55% 0px",
      threshold: [0.2, 0.45, 0.7]
    }
  );

  sections.forEach((section) => sectionObserver.observe(section));
  setActiveSection(sections[0].id);
}

function setActiveSection(sectionId) {
  document.querySelectorAll("[data-section-link]").forEach((element) => {
    element.classList.toggle("is-active", element.dataset.sectionLink === sectionId);
  });
}

function updateProgressBar() {
  const scrollTop = window.scrollY;
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const percent = scrollableHeight > 0 ? Math.min(scrollTop / scrollableHeight, 1) : 0;
  progressBar.style.width = `${percent * 100}%`;
}

function setStatus(message) {
  refreshStatus.textContent = message;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    if (refreshStatus.textContent === message) refreshStatus.textContent = "";
  }, 4000);
}

function buildCadenceLine(cadence, totalStories) {
  return `${escapeHtml(cadence)} <span id="story-count">${totalStories}</span> validated stories.`;
}

function cleanInline(value = "") {
  return value.replace(/^`|`$/g, "").trim();
}

function normalizeSourceLabel(value = "") {
  return cleanInline(value).replace(/\s+Page\s+\d+\s*$/i, "").trim();
}

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}

function withCacheKey(url, bustCache) {
  if (!bustCache) return url;
  const nextUrl = new URL(url, window.location.origin);
  nextUrl.searchParams.set("refresh", Date.now().toString());
  return nextUrl.toString();
}

async function loadJson(url, bustCache = false) {
  const response = await fetch(withCacheKey(url, bustCache), {
    cache: bustCache ? "no-store" : "default"
  });
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

async function loadText(url, bustCache = false) {
  const response = await fetch(withCacheKey(url, bustCache), {
    cache: bustCache ? "no-store" : "default"
  });
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.text();
}
