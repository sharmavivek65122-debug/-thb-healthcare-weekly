const RAW_SOURCE_LINES = `
Abbott Mediaroom|https://abbott.mediaroom.com/press-releases
Akumentis Healthcare|https://akumentishealthcare.com/awards-accreditation/
Alkem Labs|https://www.alkemlabs.com/press-release.php
Allergan Newsroom|https://allergan-web-us-prod.azurewebsites.net/news/newsroom
AstraZeneca Media Centre|https://www.astrazeneca.com/media-centre.html
AuroLab|https://aurolab.com/aboutus.asp
Bayer Zydus Pharma|https://www.bayerzyduspharma.com/en/media
BeatO Blog|https://www.beatoapp.com/blog/
Bharat Biotech|https://www.bharatbiotech.com/press_releases.html
BSV Group|https://bsvgroup.com/media/bharat-serum-accepts-challenge-against-COVID/
Biocon|https://www.biocon.com/news-biocon/
Boehringer Ingelheim Press|https://www.boehringer-ingelheim.com/press/all-press-releases
BMS Press Releases|https://www.bms.com/media/press-releases.html
Cadila Pharma|https://www.cadilapharma.com/media/news-releases/
Cipla Media Centre|https://www.cipla.com/media-centre/media-releases
Dabur Press Releases|https://www.dabur.com/in/en-us/media/corporate-press-releases
Dr Reddy's In The News|https://www.drreddys.com/media/dr-reddys-in-the-news/
Lilly Impact News|https://www.lilly.com/news/press-releases/tags/impact
Emcure Newsroom|https://www.emcure.com/newsroom/
Eris In The News|https://eris.co.in/in-the-news/
Glenmark Newsroom|https://glenmarkpharma.com/media/newsroom/
GSK India Media|https://india-pharma.gsk.com/en-in/media/
Intas Media|https://www.intaspharma.com/media/
Ipca Laboratories Notices|https://m.moneycontrol.com/company-notices/ipcalaboratories/notices/IL
Fresenius Kabi News|https://www.fresenius-kabi.com/news
Janssen India Media|https://www.janssen.com/india/media
Johnson & Johnson Latest News|https://www.jnj.com/latest-news
LifeScan News|https://www.lifescan.com/news-and-updates
Lupin Updates|https://economictimes.indiatimes.com/lupin-ltd/stocksupdate/companyid-10743.cms?from=mdr
Macleods Pharma|https://www.macleodspharma.com/about/
Mankind Pharma|https://www.mankindpharma.com/
Umesh Modi Group|https://umeshmodigroup.com/
Merck Media News|https://www.merck.com/media/news/
Mylan India|https://www.mylan.in/
Natco Pharma|https://www.natcopharma.co.in/
Novartis News|https://www.novartis.com/news
Oaknet Healthcare|https://oaknethealthcare.com/
Pfizer Newsroom|https://www.pfizer.com/newsroom/press-releases
Pharmed Limited|https://www.pharmedlimited.com/
Reckitt|https://www.reckitt.com/
Roche Media|https://www.roche.com/media
Health With Diagnostics|https://healthwithdiagnostics.com/
Sanofi India|https://www.sanofi.in/
Seagull Pharma|http://seagullpharma.com/
Serum Institute|https://www.seruminstitute.com/
Sun Pharma|https://sunpharma.com/
Takeda India|https://www.takeda.com/en-in/
Torrent Pharma|https://www.torrentpharma.com/
USV India|https://www.usvindia.com/
Zydus Life|https://www.zyduslife.com/zyduslife/
BioSpectrum India Healthcare|https://www.biospectrumindia.com/category/healthcare
Reuters Healthcare & Pharma|https://www.reuters.com/business/healthcare-pharmaceuticals/
AP Health|https://apnews.com/hub/health
WSJ Health Industry|https://www.wsj.com/news/business/health-industry
BBC Health|https://www.bbc.com/news/health
Healthcare IT News|https://www.healthcareitnews.com/news
WebMD News|https://www.webmd.com/news/default.htm
CNN Health|https://edition.cnn.com/health
Forbes Healthcare|https://www.forbes.com/healthcare/
ET Healthworld Pharma|https://health.economictimes.indiatimes.com/news/pharma
ET Healthworld Pharma Page 2|https://health.economictimes.indiatimes.com/news/pharma/page/2/
ET Healthworld Hospitals|https://health.economictimes.indiatimes.com/news/hospitals
ET Healthworld Hospitals Page 2|https://health.economictimes.indiatimes.com/news/hospitals/page/2/
ET Healthworld Hospitals Page 3|https://health.economictimes.indiatimes.com/news/hospitals/page/3/
ET Healthworld Diagnostics|https://health.economictimes.indiatimes.com/news/diagnostics
ET Healthworld Diagnostics Page 2|https://health.economictimes.indiatimes.com/news/diagnostics/page/2/
ET Healthworld Diagnostics Page 3|https://health.economictimes.indiatimes.com/news/diagnostics/page/3/
World Pharma News|https://www.worldpharmanews.com/
Business Today|https://www.businesstoday.in/
PharmaTimes|https://www.pharmatimes.com/news
NDTV Business Pharma|https://www.ndtv.com/business/pharma
PharmaTutor News|https://www.pharmatutor.org/pharma-news
ScienceDaily Pharmaceuticals|https://www.sciencedaily.com/news/health_medicine/pharmaceuticals/
Economic Times Pharma|https://economictimes.indiatimes.com/industry/healthcare/biotech/pharmaceuticals
Pharmaceutical Journal News|https://pharmaceutical-journal.com/news
PharmTech News|https://www.pharmtech.com/news
Financial Express Healthcare|https://www.financialexpress.com/healthcare/pharma-healthcare/
Fierce Pharma|https://www.fiercepharma.com/pharma
PharmaFocus Asia|https://www.pharmafocusasia.com/news
BioPharm International News|https://www.biopharminternational.com/news
Times of India Pharma|https://timesofindia.indiatimes.com/topic/pharma
PharmaCompass News|https://www.pharmacompass.com/pharma-news
GabiOnline News|https://www.gabionline.net/news
Contract Pharma News|https://www.contractpharma.com/contents/list_news/
Fierce Biotech|https://www.fiercebiotech.com/
ET Healthworld|https://health.economictimes.indiatimes.com/
Business Standard|https://www.business-standard.com
Express Healthcare|https://www.expresshealthcare.in
Express Healthcare Posts|https://www.expresshealthcare.in/post-sitemap20.xml
Express Healthcare Posts Page 19|https://www.expresshealthcare.in/post-sitemap19.xml
Pharmaceutical Technology News|https://www.pharmaceutical-technology.com/news/
Fierce Healthcare Providers|https://www.fiercehealthcare.com/providers
The Hindu BusinessLine News|https://www.thehindubusinessline.com/news/
Livemint Companies|https://www.livemint.com/companies/news/
Medical Dialogues Pharma|https://medicaldialogues.in/news/industry/pharma/
Pharmabiz|http://pharmabiz.com
European Society of Cardiology|https://www.escardio.org/
The Lancet|https://www.thelancet.com/
American Diabetes Association|https://diabetes.org/
BW Healthcare World Providers|http://bwhealthcareworld.businessworld.in/category/Healthcare-service-providers-234/
Medical Buyer Headlines|https://www.medicalbuyer.co.in/category/daily-news/headlines-of-the-day/
Medical Buyer Posts|https://medicalbuyer.co.in/post-sitemap78.xml
Medical Buyer Posts Page 77|https://medicalbuyer.co.in/post-sitemap77.xml
Gulf News Health|https://gulfnews.com/uae/health
Arabian Business Healthcare|https://www.arabianbusiness.com/industries/healthcare
GCC Business News Healthcare|https://www.gccbusinessnews.com/category/industry/health-care/
BioSpectrum Asia Middle East|https://www.biospectrumasia.com/category/country/middle-east-countries
Healthcare Radius|https://www.healthcareradius.in/
Healthcare Radius Infrastructure|https://www.healthcareradius.in/infrastructure/
Zawya Pharmaceuticals|https://www.zawya.com/primarykeyword/PHARMACEUTICAL
BioPharma APAC Research|https://www.biopharmaapac.com/category/biopharma/pharma-research
Nikkei Pharmaceuticals|https://asia.nikkei.com/Business/Pharmaceuticals
Healthcare Asia Magazine|https://healthcareasiamagazine.com/news
Healthcare MEA Hospitals|https://www.healthcaremea.com/category/hospitals/
Healthcare MEA Hospitals Page 2|https://www.healthcaremea.com/category/hospitals/page/2/
Healthcare MEA Pharma|https://www.healthcaremea.com/category/pharma/
Healthcare MEA Pharma Page 2|https://www.healthcaremea.com/category/pharma/page/2/
Livemint|https://www.livemint.com/
Digital Health News|https://www.digitalhealthnews.com/
MedCity News Biopharma|https://medcitynews.com/category/channel/biopharma/
Dharab News|https://dharab.com/news/
Healthcare MEA|https://www.healthcaremea.com/
`;

const SKIP_SOURCE_HINTS = [
  "businesstoday.in",
  "livemint.com",
  "edition.cnn.com",
  "bbc.com",
  "apnews.com",
  "wsj.com",
  "forbes.com",
  "thehindubusinessline.com",
  "asia.nikkei.com",
  "ndtv.com",
  "business-standard.com"
];

const INDIA_HINTS = [
  "india",
  "indiatimes",
  "livemint",
  "business-standard",
  "financialexpress",
  "medicaldialogues",
  "pharmabiz",
  "expresshealthcare",
  "healthcareradius",
  "biospectrumindia",
  "medicalbuyer",
  "ndtv",
  "businesstoday",
  "beatoapp",
  "mankindpharma",
  "sunpharma",
  "zydus",
  "torrentpharma",
  "usvindia",
  "seruminstitute",
  "pharmatutor"
];

const MIDDLE_EAST_HINTS = [
  "gulfnews",
  "arabianbusiness",
  "gccbusinessnews",
  "healthcaremea",
  "biospectrumasia",
  "zawya",
  "dharab",
  "middle-east",
  "uae",
  "saudi",
  "riyadh",
  "dubai"
];

const DIAGNOSTIC_HINTS = [
  "diagnostic",
  "diagnostics",
  "pathlab",
  "lifescan",
  "lab",
  "healthwithdiagnostics",
  "screening",
  "pathology",
  "imaging"
];

const PROVIDER_HINTS = [
  "hospital",
  "hospitals",
  "provider",
  "gulfnews",
  "arabianbusiness",
  "gccbusinessnews",
  "clinic",
  "clinics",
  "medical city",
  "health system"
];

const HEALTHTECH_HINTS = [
  "beatoapp",
  "healthcareitnews",
  "digitalhealthnews",
  "medcitynews",
  "software",
  "health-it",
  "tele",
  "app",
  "digital"
];

const MIXED_HINTS = [
  "reuters",
  "apnews",
  "bbc",
  "cnn",
  "forbes",
  "wsj",
  "lancet",
  "escardio",
  "businesstoday",
  "business-standard",
  "livemint",
  "ndtv",
  "nikkei",
  "biospectrumindia",
  "biospectrumasia",
  "healthcaremea",
  "healthcareradius",
  "zawya",
  "medicaldialogues",
  "expresshealthcare",
  "financialexpress",
  "thehindubusinessline"
];

function cleanHost(hostname) {
  return hostname.replace(/^www\./, "");
}

function toTitleCase(value) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeSourceName(value) {
  return value.replace(/\s+Page\s+\d+\s*$/i, "").trim();
}

function detectPool(text) {
  if (DIAGNOSTIC_HINTS.some((hint) => text.includes(hint))) {
    return "diagnostics";
  }
  if (PROVIDER_HINTS.some((hint) => text.includes(hint))) {
    return "providers";
  }
  if (HEALTHTECH_HINTS.some((hint) => text.includes(hint))) {
    return "healthtech";
  }
  if (MIXED_HINTS.some((hint) => text.includes(hint))) {
    return "mixed";
  }
  return "pharma";
}

function detectRegion(text) {
  const hasIndia = INDIA_HINTS.some((hint) => text.includes(hint));
  const hasMiddleEast = MIDDLE_EAST_HINTS.some((hint) => text.includes(hint));

  if (hasIndia && hasMiddleEast) {
    return "multi-region";
  }
  if (hasIndia) {
    return "india";
  }
  if (hasMiddleEast) {
    return "middle-east";
  }
  return "global";
}

function detectPriority({ pool, region, url }) {
  const text = `${pool} ${region} ${url}`;
  if (region !== "global") {
    return 1;
  }
  if (pool !== "mixed") {
    return 2;
  }
  if (text.includes("reuters") || text.includes("healthcaremea") || text.includes("medicaldialogues")) {
    return 1;
  }
  return 3;
}

function createSourceRecord(line) {
  const [providedName, rawUrl] = line.split("|");
  const url = rawUrl.trim();
  const parsed = new URL(url);
  const hostname = cleanHost(parsed.hostname);
  const text = `${providedName} ${hostname} ${parsed.pathname}`.toLowerCase();
  const name = normalizeSourceName(providedName?.trim() || toTitleCase(hostname.split(".")[0]));
  const pool = detectPool(text);
  const region = detectRegion(text);
  const id = `${hostname}${parsed.pathname}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

  return {
    id,
    name,
    url,
    hostname,
    pool,
    region,
    priority: detectPriority({ pool, region, url })
  };
}

export function getSourceRegistry() {
  const deduped = new Map();

  for (const line of RAW_SOURCE_LINES.trim().split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const source = createSourceRecord(line.trim());
    if (!deduped.has(source.url)) {
      deduped.set(source.url, source);
    }
  }

  return [...deduped.values()]
    .filter(
      (source) =>
        !SKIP_SOURCE_HINTS.some((hint) => source.url.includes(hint)) &&
        source.pool !== "healthtech" &&
        source.priority <= 1
    )
    .sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.name.localeCompare(right.name);
    });
}
