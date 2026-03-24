import fs from "node:fs";
import path from "node:path";

import XLSX from "xlsx";

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] || fallback;
}

function cleanValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/\u00a0/g, " ").trim();
}

function normalizeText(value) {
  return cleanValue(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bcentre\b/g, "center")
    .replace(/\bhospitals\b/g, "hospital")
    .replace(/\bclinics\b/g, "clinic")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCoreText(value) {
  return normalizeText(value)
    .replace(/\b(the|hospital|medical|center|clinic|group|health|healthcare|company|services|general|specialist|city|virtual|national|international)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const cleaned = cleanValue(value);
    if (cleaned !== "") {
      return cleaned;
    }
  }
  return "";
}

function levenshtein(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);

  if (!a || !b) {
    return Math.max(a.length, b.length);
  }

  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarity(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) {
    return 0;
  }

  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

const inputPath = path.resolve(readArg(
  "input",
  "C:/Users/VivekSharma/OneDrive - THB c o Sekhmet Technologies Private Limited/Desktop/Middle East Hospitals.xlsx"
));
const outputPath = path.resolve(
  readArg("output", "data/Middle_East_Hospitals_Deduped_WebMapped.xlsx")
);

const workbook = XLSX.readFile(inputPath, { cellDates: false });
const sheetName = workbook.SheetNames[0];
const sourceRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" })
  .map((row, index) => ({
    ...row,
    Name: cleanValue(row.Name),
    "Country of Orgin": cleanValue(row["Country of Orgin"]),
    "City of Origin": cleanValue(row["City of Origin"]),
    Beds: cleanValue(row.Beds),
    __rowNumber: index + 2
  }));

const mappingRules = [
  {
    id: "al-emadi",
    country: "Qatar",
    variants: ["al emadi hospital", "al imadi hospital"],
    canonicalName: "Al Emadi Hospital",
    canonicalCity: "Doha",
    sourceUrl: "https://www.alemadihospital.com/",
    sourceLabel: "Official hospital website",
    note: "Mapped spelling variation to the official hospital name."
  },
  {
    id: "alosrah",
    country: "Saudi Arabia",
    variants: ["al osrah international hospital", "alosrah international hospital oih"],
    canonicalName: "Alosrah International Hospital",
    canonicalCity: "Riyadh",
    sourceUrl: "https://sehaguide.com/en/itm/34465/Alosrah-International-Hospital/About-the-hospital",
    sourceLabel: "Hospital directory listing",
    note: "Mapped punctuation and acronym variants to the public web listing."
  },
  {
    id: "aspen-medical",
    country: "UAE",
    variants: ["aspen medical", "aspen medical uae"],
    canonicalName: "Aspen Medical",
    sourceUrl: "https://www.aspenmedical.com/",
    sourceLabel: "Official company website",
    note: "Removed country suffix from the same provider name."
  },
  {
    id: "aspetar",
    country: "Qatar",
    variants: ["aspetar", "aspetar hospital"],
    canonicalName: "Aspetar",
    canonicalCity: "Al Rayyan",
    sourceUrl: "https://www.aspetar.com/en/about-us",
    sourceLabel: "Official hospital website",
    note: "Collapsed shorthand and hospital-form variants to the official brand name."
  },
  {
    id: "behman",
    country: "Egypt",
    variants: ["behman hospital", "the behman hospital"],
    canonicalName: "The Behman Hospital",
    canonicalCity: "Cairo",
    sourceUrl: "https://behman.com/",
    sourceLabel: "Official hospital website",
    note: "Mapped to the official hospital name used on the public website."
  },
  {
    id: "buraidah-central",
    country: "Saudi Arabia",
    variants: ["buraidah central hospital", "buraidah central hospital buraidah"],
    canonicalName: "Buraidah Central Hospital",
    canonicalCity: "Buraidah",
    sourceUrl: "https://saudi-arabia.a-hospital.com/hospital/buraidah-central-hospital.html",
    sourceLabel: "Hospital directory listing",
    note: "Collapsed the city-suffixed duplicate into the published hospital name."
  },
  {
    id: "cleveland-clinic-abu-dhabi",
    country: "UAE",
    variants: ["cleveland clinic abu dhabi", "cleveland clinic abudhabi"],
    canonicalName: "Cleveland Clinic Abu Dhabi",
    canonicalCity: "Abu Dhabi",
    sourceUrl: "https://www.clevelandclinicabudhabi.ae/",
    sourceLabel: "Official hospital website",
    note: "Standardized spacing in the official hospital name."
  },
  {
    id: "danat-al-emarat",
    country: "UAE",
    variants: [
      "danat al emarat hospital for woman and children",
      "danat al emarat hospital for women and children"
    ],
    canonicalName: "Danat Al Emarat Hospital for Women & Children",
    sourceUrl: "https://danatalemarat.ae/",
    sourceLabel: "Official hospital website",
    note: "Mapped singular/plural wording to the exact public hospital name."
  },
  {
    id: "dr-sulaiman-habib-group",
    country: "Saudi Arabia",
    variants: [
      "dr sulaiman al habib medical group",
      "dr sulaiman al habib medical group hmg"
    ],
    canonicalName: "Dr. Sulaiman Al Habib Medical Group",
    sourceUrl: "https://drsulaimanalhabib.com/en/pages/home.aspx",
    sourceLabel: "Official group website",
    note: "Removed acronym-only suffix from the official group name."
  },
  {
    id: "dubai-health-authority",
    country: "UAE",
    variants: ["dubai health authority", "dubai health authority dha"],
    canonicalName: "Dubai Health Authority",
    sourceUrl: "https://dha.gov.ae/en/AboutUs",
    sourceLabel: "Official authority website",
    note: "Collapsed the acronym-appended duplicate."
  },
  {
    id: "first-response-healthcare",
    country: "UAE",
    variants: ["first response healthcare", "first response healthcare llc"],
    canonicalName: "First Response Healthcare",
    sourceUrl: "https://firstresponsehealthcare.com/ae/dubai/first-response-healthcare",
    sourceLabel: "Official provider website",
    note: "Removed company suffix from the same healthcare provider."
  },
  {
    id: "health-holding-company",
    country: "Saudi Arabia",
    variants: ["health holding co", "health holding company"],
    canonicalName: "Health Holding Company",
    sourceUrl: "https://www.health.sa/en/about-us",
    sourceLabel: "Official company website",
    note: "Expanded abbreviated company suffix to the official name."
  },
  {
    id: "imc-jeddah",
    country: "Saudi Arabia",
    variants: [
      "international medical center",
      "international medical center imc",
      "international medical center imc jeddah"
    ],
    canonicalName: "International Medical Center",
    canonicalCity: "Jeddah",
    sourceUrl: "https://www.imc.med.sa/",
    sourceLabel: "Official hospital website",
    note: "Collapsed acronym and city-appended variants to the hospital's public name."
  },
  {
    id: "jeddah-clinic-hospital",
    country: "Saudi Arabia",
    variants: ["jeddah clinic hospital", "jeddah clinic hospital kandarah jeddah"],
    canonicalName: "Jeddah Clinic Hospital",
    canonicalCity: "Jeddah",
    sourceUrl: "https://ca.linkedin.com/company/jeddah-clinic-hospital",
    sourceLabel: "Public company profile",
    note: "Collapsed the address-appended duplicate into the hospital name."
  },
  {
    id: "jeddah-national-hospital",
    country: "Saudi Arabia",
    variants: ["jeddah national hospital", "jeddah national hospital jeddah"],
    canonicalName: "Jeddah National Hospital",
    canonicalCity: "Jeddah",
    sourceUrl: "https://www.jnhsa.com/",
    sourceLabel: "Official hospital website",
    note: "Collapsed the city-suffixed duplicate into the hospital's public name."
  },
  {
    id: "magrabi",
    country: "Saudi Arabia",
    variants: ["magrabi hospital and centers", "magrabi hospitals and centers"],
    canonicalName: "Magrabi Hospitals & Centers",
    sourceUrl: "https://magrabi.com.sa/",
    sourceLabel: "Official healthcare group website",
    note: "Mapped singular/plural wording to the public brand name."
  },
  {
    id: "ministry-health-prevention",
    country: "UAE",
    variants: ["ministry of health prevention", "ministry of health and prevention uae"],
    canonicalName: "Ministry of Health & Prevention",
    sourceUrl: "https://mohap.gov.ae/en/about-us",
    sourceLabel: "Official ministry website",
    note: "Standardized punctuation and removed the country suffix."
  },
  {
    id: "moorfields-dubai",
    country: "UAE",
    variants: ["moorfields eye hospital", "moorfields eye hospital dubai"],
    canonicalName: "Moorfields Eye Hospital Dubai",
    canonicalCity: "Dubai",
    sourceUrl: "https://www.moorfields.nhs.uk/Home",
    sourceLabel: "Official hospital website",
    note: "Mapped the generic UAE record to the exact Dubai hospital name."
  },
  {
    id: "mouwasat",
    country: "Saudi Arabia",
    variants: ["mouwasat hospital", "mouwasat hospital saudi"],
    canonicalName: "Mouwasat Hospital",
    sourceUrl: "https://www.mouwasat.com/",
    sourceLabel: "Official hospital website",
    note: "Removed the country suffix from the public hospital brand."
  },
  {
    id: "national-medical-care",
    country: "Saudi Arabia",
    variants: ["national medical care", "national medical care saudi"],
    canonicalName: "National Medical Care",
    sourceUrl: "https://ir.care.med.sa/ar",
    sourceLabel: "Official investor relations website",
    note: "Removed the country suffix from the public company name."
  },
  {
    id: "new-mowasat",
    country: "Kuwait",
    variants: ["new mouwasat hospital", "new mowasat hospital"],
    canonicalName: "New Mowasat Hospital",
    sourceUrl: "https://www.newmowasat.com/about-us",
    sourceLabel: "Official hospital website",
    note: "Mapped spelling variation to the official hospital name."
  },
  {
    id: "purehealth",
    country: "UAE",
    variants: ["pure health", "purehealth"],
    canonicalName: "PureHealth",
    sourceUrl: "https://purehealth.ae/our-story/",
    sourceLabel: "Official company website",
    note: "Mapped spacing variation to the official brand styling."
  },
  {
    id: "riyadh-care",
    country: "Saudi Arabia",
    variants: ["riyadh care hospital", "riyadh care hospital riyadh"],
    canonicalName: "Riyadh Care Hospital",
    canonicalCity: "Riyadh",
    sourceUrl: "https://sehaguide.com/en/Item/9573/Riyadh-Care-Hospital",
    sourceLabel: "Hospital directory listing",
    note: "Collapsed the city-suffixed duplicate into the hospital name."
  },
  {
    id: "riyadh-national",
    country: "Saudi Arabia",
    variants: ["riyadh national hospital", "riyadh national hospital riyadh"],
    canonicalName: "Riyadh National Hospital",
    canonicalCity: "Riyadh",
    sourceUrl: "https://sehaguide.com/en/Item/33837/National-Hospital---Riyadh",
    sourceLabel: "Hospital directory listing",
    note: "Collapsed the city-suffixed duplicate into the hospital name."
  },
  {
    id: "royale-hayat",
    country: "Kuwait",
    variants: ["royal hayat hospital", "royale hayat hospital"],
    canonicalName: "Royale Hayat Hospital",
    sourceUrl: "https://royalehayat.com/",
    sourceLabel: "Official hospital website",
    note: "Mapped spelling variation to the official hospital name."
  },
  {
    id: "saad-specialist",
    country: "Saudi Arabia",
    variants: ["saab speacialist hospital", "saad specialist hospital"],
    canonicalName: "Saad Specialist Hospital",
    canonicalCity: "Al Khobar",
    sourceUrl: "https://en.wikipedia.org/wiki/Saad_Specialist_Hospital",
    sourceLabel: "Public reference page",
    note: "Mapped typo and spelling variation to the published hospital name."
  },
  {
    id: "seha-virtual-hospital",
    country: "Saudi Arabia",
    variants: ["seha virtual hospital", "seha virtual hospital ksa"],
    canonicalName: "SEHA Virtual Hospital",
    sourceUrl: "https://www.moh.gov.sa/en/ministry/projects/pages/seha-virtual-hospital.aspx",
    sourceLabel: "Official ministry project page",
    note: "Removed the country suffix from the official project name."
  },
  {
    id: "sidra-kuwait",
    country: "Kuwait",
    variants: ["sidra hospital", "sidra hospital kuwait"],
    canonicalName: "Sidra Kuwait Hospital",
    sourceUrl: "https://sidrakwhospital.com/about-us/",
    sourceLabel: "Official hospital website",
    note: "Mapped the generic name to the official public hospital name."
  },
  {
    id: "specialized-medical-center",
    country: "Saudi Arabia",
    variants: [
      "specialised medical centre hospital",
      "specialized medical center hospital",
      "specialized medical center hospital riyadh"
    ],
    canonicalName: "Specialized Medical Center Hospital",
    canonicalCity: "Riyadh",
    sourceUrl: "https://www.eyeofriyadh.com/directory/directorydetail.php?dirid=273",
    sourceLabel: "Hospital directory listing",
    note: "Mapped British/American spelling and city-appended variants to the public hospital name."
  },
  {
    id: "thumbay",
    country: "UAE",
    variants: ["thumbay hospital", "thumbway hospital"],
    canonicalName: "Thumbay Hospital",
    sourceUrl: "https://thumbayhospital.com/about/",
    sourceLabel: "Official hospital website",
    note: "Mapped typo variant to the official hospital name."
  }
];

const rulesByCountry = new Map();
for (const rule of mappingRules) {
  const countryKey = normalizeText(rule.country);
  if (!rulesByCountry.has(countryKey)) {
    rulesByCountry.set(countryKey, []);
  }
  rulesByCountry.get(countryKey).push({
    ...rule,
    variantSet: new Set(rule.variants.map((variant) => normalizeText(variant)))
  });
}

function findMapping(row) {
  const countryKey = normalizeText(row["Country of Orgin"]);
  const nameKey = normalizeText(row.Name);
  const rules = rulesByCountry.get(countryKey) || [];
  return rules.find((rule) => rule.variantSet.has(nameKey)) || null;
}

function rowScore(row) {
  return (
    (cleanValue(row["City of Origin"]) !== "" ? 4 : 0)
    + (cleanValue(row.Beds) !== "" ? 3 : 0)
    + (cleanValue(row.__mapping?.canonicalCity) !== "" ? 2 : 0)
    + cleanValue(row.Name).length / 100
  );
}

const enrichedRows = sourceRows.map((row) => {
  const mapping = findMapping(row);
  const canonicalName = mapping ? mapping.canonicalName : row.Name;
  const canonicalCity = firstNonEmpty(mapping?.canonicalCity, row["City of Origin"]);
  const canonicalCountry = row["Country of Orgin"];

  return {
    ...row,
    __mapping: mapping,
    __canonicalName: canonicalName,
    __canonicalCity: canonicalCity,
    __canonicalCountry: canonicalCountry,
    __groupKey: [
      normalizeText(canonicalCountry),
      normalizeText(canonicalName),
      normalizeText(canonicalCity)
    ].join("||")
  };
});

const groupedRows = new Map();
for (const row of enrichedRows) {
  if (!groupedRows.has(row.__groupKey)) {
    groupedRows.set(row.__groupKey, []);
  }
  groupedRows.get(row.__groupKey).push(row);
}

const cleanedRows = [];
const removedRows = [];

let duplicateGroupCounter = 1;

for (const groupRows of groupedRows.values()) {
  const sortedRows = [...groupRows].sort((left, right) => rowScore(right) - rowScore(left));
  const keptRow = sortedRows[0];
  const duplicateGroupId = groupRows.length > 1
    ? `DUP-${String(duplicateGroupCounter).padStart(3, "0")}`
    : "";

  if (groupRows.length > 1) {
    duplicateGroupCounter += 1;
  }

  const mergedNames = [...new Set(groupRows.map((row) => row.Name))];
  const mergedCities = [...new Set(groupRows.map((row) => cleanValue(row["City of Origin"])).filter(Boolean))];
  const mergedBeds = [...new Set(groupRows.map((row) => cleanValue(row.Beds)).filter(Boolean))];
  const sourceUrls = [...new Set(groupRows.map((row) => row.__mapping?.sourceUrl).filter(Boolean))];
  const sourceLabels = [...new Set(groupRows.map((row) => row.__mapping?.sourceLabel).filter(Boolean))];
  const mappingNotes = [...new Set(groupRows.map((row) => row.__mapping?.note).filter(Boolean))];

  cleanedRows.push({
    Name: keptRow.__canonicalName,
    "Country of Orgin": keptRow.__canonicalCountry,
    "City of Origin": firstNonEmpty(
      keptRow.__canonicalCity,
      ...groupRows.map((row) => row["City of Origin"])
    ),
    Beds: firstNonEmpty(keptRow.Beds, ...groupRows.map((row) => row.Beds)),
    "Original Name Kept": keptRow.Name,
    "Original Name Variants": mergedNames.join(" | "),
    "Merged Source Rows": groupRows.map((row) => row.__rowNumber).join(", "),
    "Duplicate Group ID": duplicateGroupId,
    "Web Mapping Applied": sourceUrls.length > 0 ? "Yes" : "No",
    "Web Source URL": sourceUrls.join(" | "),
    "Web Source Type": sourceLabels.join(" | "),
    "Deduplication Note": mappingNotes.join(" | "),
    "Deduplication Confidence": groupRows.length > 1
      ? (sourceUrls.length > 0 ? "High" : "Medium")
      : (sourceUrls.length > 0 ? "Mapped only" : "None"),
    "Merged City Variants": mergedCities.join(" | "),
    "Merged Bed Variants": mergedBeds.join(" | ")
  });

  for (const removedRow of sortedRows.slice(1)) {
    removedRows.push({
      "Removed Row Number": removedRow.__rowNumber,
      "Removed Name": removedRow.Name,
      "Removed Country": removedRow["Country of Orgin"],
      "Removed City": removedRow["City of Origin"],
      "Removed Beds": removedRow.Beds,
      "Kept Canonical Name": keptRow.__canonicalName,
      "Kept Canonical City": firstNonEmpty(
        keptRow.__canonicalCity,
        ...groupRows.map((row) => row["City of Origin"])
      ),
      "Duplicate Group ID": duplicateGroupId,
      "Merged Into Rows": groupRows.map((row) => row.__rowNumber).join(", "),
      "Web Source URL": sourceUrls.join(" | "),
      "Reason": sourceUrls.length > 0
        ? "High-confidence duplicate removed after web-backed name mapping"
        : "Duplicate removed by normalized exact match"
    });
  }
}

const cleanedNameKeys = new Set(cleanedRows.map((row) => [
  normalizeText(row["Country of Orgin"]),
  normalizeText(row.Name),
  normalizeText(row["City of Origin"])
].join("||")));

const reviewCandidates = [];

for (let i = 0; i < cleanedRows.length; i += 1) {
  for (let j = i + 1; j < cleanedRows.length; j += 1) {
    const left = cleanedRows[i];
    const right = cleanedRows[j];

    if (normalizeText(left["Country of Orgin"]) !== normalizeText(right["Country of Orgin"])) {
      continue;
    }

    const leftCity = normalizeText(left["City of Origin"]);
    const rightCity = normalizeText(right["City of Origin"]);
    const cityCompatible = leftCity === rightCity || leftCity === "" || rightCity === "";
    if (!cityCompatible) {
      continue;
    }

    const score = similarity(left.Name, right.Name);
    const leftCore = normalizeCoreText(left.Name);
    const rightCore = normalizeCoreText(right.Name);
    const coreScore = similarity(leftCore, rightCore);
    const sameCity = leftCity !== "" && leftCity === rightCity;
    const leftNorm = normalizeText(left.Name);
    const rightNorm = normalizeText(right.Name);
    const contains = leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm);
    const shorterLength = Math.min(leftNorm.length, rightNorm.length);
    const usableCore = leftCore !== ""
      && rightCore !== ""
      && leftCore !== leftCity
      && rightCore !== rightCity
      && leftCore.length >= 5
      && rightCore.length >= 5;

    const shouldFlag = sameCity
      ? (score >= 0.86 && coreScore >= 0.82)
        || (usableCore && leftCore === rightCore && score >= 0.7)
      : ((score >= 0.9 && coreScore >= 0.82)
        || (contains && shorterLength >= 12 && coreScore >= 0.78)
        || (usableCore && leftCore === rightCore && score >= 0.65 && contains));

    if (shouldFlag && leftNorm !== rightNorm) {
      reviewCandidates.push({
        Country: left["Country of Orgin"],
        "City A": left["City of Origin"],
        "Name A": left.Name,
        "Rows A": left["Merged Source Rows"],
        "City B": right["City of Origin"],
        "Name B": right.Name,
        "Rows B": right["Merged Source Rows"],
        "Similarity Score": Number(score.toFixed(3)),
        "Core Similarity Score": Number(coreScore.toFixed(3)),
        "Why Flagged": sameCity
          ? "Same country and same city with highly similar names"
          : "Same country with one missing city and highly similar names"
      });
    }
  }
}

const uniqueReviewCandidates = [];
const seenReviewPairs = new Set();

for (const candidate of reviewCandidates
  .sort((left, right) => right["Similarity Score"] - left["Similarity Score"])) {
  const key = [
    normalizeText(candidate.Country),
    [normalizeText(candidate["Name A"]), normalizeText(candidate["Name B"])].sort().join("||"),
    [normalizeText(candidate["City A"]), normalizeText(candidate["City B"])].sort().join("||")
  ].join("||");

  if (seenReviewPairs.has(key)) {
    continue;
  }

  seenReviewPairs.add(key);
  uniqueReviewCandidates.push(candidate);
}

const summaryRows = [
  { Metric: "Original rows", Value: sourceRows.length },
  { Metric: "Cleaned unique rows", Value: cleanedRows.length },
  { Metric: "Removed duplicates", Value: removedRows.length },
  { Metric: "Rows touched by web-backed mappings", Value: cleanedRows.filter((row) => row["Web Mapping Applied"] === "Yes").length },
  { Metric: "Review candidates kept for manual check", Value: uniqueReviewCandidates.length }
];

cleanedRows.sort((left, right) => {
  const countryCompare = left["Country of Orgin"].localeCompare(right["Country of Orgin"]);
  if (countryCompare !== 0) {
    return countryCompare;
  }
  return left.Name.localeCompare(right.Name);
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const outputWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(cleanedRows), "Cleaned_Unique");
XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(removedRows), "Removed_Duplicates");
XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(uniqueReviewCandidates), "Review_Candidates");
XLSX.utils.book_append_sheet(outputWorkbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
XLSX.writeFile(outputWorkbook, outputPath);

console.log(JSON.stringify({
  outputPath,
  originalRows: sourceRows.length,
  cleanedUniqueRows: cleanedRows.length,
  removedDuplicates: removedRows.length,
  reviewCandidates: uniqueReviewCandidates.length
}, null, 2));
