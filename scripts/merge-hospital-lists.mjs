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
  if (typeof value === "string") {
    return value.replace(/\u00a0/g, " ").trim();
  }
  return value;
}

function normalizeText(value) {
  return String(cleanValue(value))
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bcentre\b/g, "center")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const countryAliases = new Map([
  ["uae", "united arab emirates"],
  ["u a e", "united arab emirates"],
  ["ksa", "saudi arabia"],
  ["uk", "united kingdom"],
  ["usa", "united states"]
]);

const countryDisplay = new Map([
  ["united arab emirates", "United Arab Emirates"],
  ["saudi arabia", "Saudi Arabia"],
  ["united kingdom", "United Kingdom"],
  ["united states", "United States"]
]);

function normalizeCountry(value) {
  const normalized = normalizeText(value);
  return countryAliases.get(normalized) || normalized;
}

function displayCountry(value) {
  const normalized = normalizeCountry(value);
  if (!normalized) {
    return "";
  }
  return countryDisplay.get(normalized)
    || normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "number") {
      return value;
    }
    const cleaned = cleanValue(value);
    if (cleaned !== "") {
      return cleaned;
    }
  }
  return "";
}

function listUnique(values) {
  return [...new Set(values.filter((value) => cleanValue(value) !== ""))];
}

function makeDetailedKey(row, config) {
  return [
    normalizeCountry(row[config.countryCol]),
    normalizeText(row[config.nameCol]),
    normalizeText(row[config.cityCol])
  ].join("||");
}

function makeProviderKey(row, config) {
  return [
    normalizeCountry(row[config.countryCol]),
    normalizeText(row[config.nameCol])
  ].join("||");
}

function stripTokens(base, tokens) {
  const tokenSet = new Set(tokens.filter(Boolean));
  return base
    .split(" ")
    .filter((token) => !tokenSet.has(token))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function findStrictLocationMatches(row, recordIds, providerConfig, allRecords) {
  const providerName = normalizeText(row[providerConfig.nameCol]);
  const providerCountry = normalizeCountry(row[providerConfig.countryCol]);
  const countryTokens = providerCountry.split(" ").filter(Boolean);
  const matches = [];

  for (const recordId of recordIds) {
    const record = allRecords.get(recordId);
    const detailedName = normalizeText(firstNonEmpty(
      record.gccRow?.["Hospital Name"],
      record.top500Row?.["Hospital Name"]
    ));
    const city = normalizeText(firstNonEmpty(record.gccRow?.City, record.top500Row?.City));
    const stripped = stripTokens(stripTokens(providerName, city.split(" ")), countryTokens);

    if (stripped === detailedName) {
      matches.push(recordId);
    }
  }

  return matches;
}

function toPrefixedRow(row, prefix, columns) {
  const result = {};
  for (const column of columns) {
    result[`${prefix} | ${column}`] = cleanValue(row?.[column] ?? "");
  }
  return result;
}

function readWorkbookRows(config) {
  const workbook = XLSX.readFile(config.path, { cellDates: false });
  const sheetName = config.sheetName || workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" })
    .map((row, index) => ({
      ...Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, cleanValue(value)])
      ),
      __rowNumber: index + 2
    }));

  return {
    ...config,
    sheetName,
    rows
  };
}

function createRecord(recordId, entityKey, granularity) {
  return {
    recordId,
    entityKey,
    granularity,
    gccRow: null,
    top500Row: null,
    providerRows: [],
    providerVariants: new Set(),
    providerCountries: new Set(),
    providerRowNumbers: [],
    providerMergeMode: "",
    providerAmbiguousCities: "",
    sourceFiles: new Set(),
    auditNotes: []
  };
}

function addAuditRow(auditRows, entry) {
  auditRows.push({
    "Source File": entry.sourceFile,
    "Source Sheet": entry.sourceSheet,
    "Source Row Number": entry.sourceRowNumber,
    "Source Action": entry.sourceAction,
    "Integrated Record ID": entry.recordId,
    "Integrated Entity Key": entry.entityKey,
    "Name": entry.name,
    "Country": entry.country,
    "City": entry.city || "",
    "Notes": entry.notes || ""
  });
}

const gccPath = path.resolve(readArg(
  "gcc",
  "C:/Users/VivekSharma/OneDrive - THB c o Sekhmet Technologies Private Limited/Desktop/Hospital Market Size/Middle East/GCC_Hospitals_MAIN.xlsx"
));
const providerPath = path.resolve(readArg(
  "provider",
  "C:/Users/VivekSharma/OneDrive - THB c o Sekhmet Technologies Private Limited/Desktop/Hospital Market Size/Middle East/Master Provider List - EMEA.xlsx"
));
const top500Path = path.resolve(readArg(
  "top500",
  "C:/Users/VivekSharma/OneDrive - THB c o Sekhmet Technologies Private Limited/Desktop/Hospital Market Size/Middle East/ME_Top500_Targets_Fresh.xlsx"
));
const outputPath = path.resolve(
  readArg("output", "data/Integrated_Hospital_Providers_Validated.xlsx")
);

const sources = [
  readWorkbookRows({
    label: "GCC",
    fileLabel: "GCC_Hospitals_MAIN.xlsx",
    prefix: "GCC",
    path: gccPath,
    nameCol: "Hospital Name",
    countryCol: "Country",
    cityCol: "City"
  }),
  readWorkbookRows({
    label: "EMEA",
    fileLabel: "Master Provider List - EMEA.xlsx",
    prefix: "EMEA",
    path: providerPath,
    nameCol: "Provider Name",
    countryCol: "Country",
    cityCol: ""
  }),
  readWorkbookRows({
    label: "Top500",
    fileLabel: "ME_Top500_Targets_Fresh.xlsx",
    prefix: "Top500",
    path: top500Path,
    nameCol: "Hospital Name",
    countryCol: "Country",
    cityCol: "City"
  })
];

const gccSource = sources.find((source) => source.label === "GCC");
const providerSource = sources.find((source) => source.label === "EMEA");
const top500Source = sources.find((source) => source.label === "Top500");

const gccColumns = Object.keys(gccSource.rows[0] || {}).filter((column) => !column.startsWith("__"));
const providerColumns = Object.keys(providerSource.rows[0] || {}).filter((column) => !column.startsWith("__"));
const top500Columns = Object.keys(top500Source.rows[0] || {}).filter((column) => !column.startsWith("__"));

const records = new Map();
const detailedKeyToRecordId = new Map();
const nameCountryIndex = new Map();
const countryRecordIndex = new Map();
const auditRows = [];

let recordSequence = 1;

function nextRecordId() {
  const id = String(recordSequence).padStart(4, "0");
  recordSequence += 1;
  return `REC-${id}`;
}

function indexRecord(record, name, country) {
  const key = [normalizeCountry(country), normalizeText(name)].join("||");
  if (!nameCountryIndex.has(key)) {
    nameCountryIndex.set(key, new Set());
  }
  nameCountryIndex.get(key).add(record.recordId);

  const countryKey = normalizeCountry(country);
  if (!countryRecordIndex.has(countryKey)) {
    countryRecordIndex.set(countryKey, new Set());
  }
  countryRecordIndex.get(countryKey).add(record.recordId);
}

for (const row of gccSource.rows) {
  const entityKey = makeDetailedKey(row, gccSource);
  const record = createRecord(nextRecordId(), entityKey, "Hospital (city-specific)");
  record.gccRow = row;
  record.sourceFiles.add(gccSource.fileLabel);
  records.set(record.recordId, record);
  detailedKeyToRecordId.set(entityKey, record.recordId);
  indexRecord(record, row[gccSource.nameCol], row[gccSource.countryCol]);

  addAuditRow(auditRows, {
    sourceFile: gccSource.fileLabel,
    sourceSheet: gccSource.sheetName,
    sourceRowNumber: row.__rowNumber,
    sourceAction: "created_base_record",
    recordId: record.recordId,
    entityKey,
    name: row[gccSource.nameCol],
    country: displayCountry(row[gccSource.countryCol]),
    city: row[gccSource.cityCol]
  });
}

for (const row of top500Source.rows) {
  const entityKey = makeDetailedKey(row, top500Source);
  const recordId = detailedKeyToRecordId.get(entityKey);
  if (!recordId) {
    const record = createRecord(nextRecordId(), entityKey, "Hospital (city-specific)");
    record.top500Row = row;
    record.sourceFiles.add(top500Source.fileLabel);
    records.set(record.recordId, record);
    detailedKeyToRecordId.set(entityKey, record.recordId);
    indexRecord(record, row[top500Source.nameCol], row[top500Source.countryCol]);

    addAuditRow(auditRows, {
      sourceFile: top500Source.fileLabel,
      sourceSheet: top500Source.sheetName,
      sourceRowNumber: row.__rowNumber,
      sourceAction: "created_top500_only_record",
      recordId: record.recordId,
      entityKey,
      name: row[top500Source.nameCol],
      country: displayCountry(row[top500Source.countryCol]),
      city: row[top500Source.cityCol]
    });

    continue;
  }

  const record = records.get(recordId);
  record.top500Row = row;
  record.sourceFiles.add(top500Source.fileLabel);

  addAuditRow(auditRows, {
    sourceFile: top500Source.fileLabel,
    sourceSheet: top500Source.sheetName,
    sourceRowNumber: row.__rowNumber,
    sourceAction: "merged_into_existing_record",
    recordId,
    entityKey,
    name: row[top500Source.nameCol],
    country: displayCountry(row[top500Source.countryCol]),
    city: row[top500Source.cityCol]
  });
}

const providerGroups = new Map();

for (const row of providerSource.rows) {
  const providerKey = makeProviderKey(row, providerSource);
  if (!providerGroups.has(providerKey)) {
    providerGroups.set(providerKey, []);
  }
  providerGroups.get(providerKey).push(row);
}

for (const [providerKey, groupedRows] of providerGroups.entries()) {
  const representativeRow = groupedRows[0];
  let matchIds = [...(nameCountryIndex.get(providerKey) || [])];

  if (matchIds.length === 0) {
    const countryMatchIds = [...(countryRecordIndex.get(normalizeCountry(representativeRow[providerSource.countryCol])) || [])];
    matchIds = findStrictLocationMatches(representativeRow, countryMatchIds, providerSource, records);
  }

  if (matchIds.length === 0) {
    const record = createRecord(nextRecordId(), `provider::${providerKey}`, "Provider or hospital (name-level only)");
    record.providerRows = [representativeRow];
    record.providerVariants = new Set(listUnique(groupedRows.map((row) => row[providerSource.nameCol])));
    record.providerCountries = new Set(listUnique(groupedRows.map((row) => displayCountry(row[providerSource.countryCol]))));
    record.providerRowNumbers = groupedRows.map((row) => row.__rowNumber);
    record.sourceFiles.add(providerSource.fileLabel);
    records.set(record.recordId, record);

    addAuditRow(auditRows, {
      sourceFile: providerSource.fileLabel,
      sourceSheet: providerSource.sheetName,
      sourceRowNumber: representativeRow.__rowNumber,
      sourceAction: groupedRows.length > 1 ? "created_provider_only_record_from_duplicate_group" : "created_provider_only_record",
      recordId: record.recordId,
      entityKey: record.entityKey,
      name: representativeRow[providerSource.nameCol],
      country: displayCountry(representativeRow[providerSource.countryCol]),
      notes: groupedRows.length > 1
        ? `Collapsed ${groupedRows.length - 1} duplicate provider row(s): ${groupedRows.slice(1).map((row) => row.__rowNumber).join(", ")}`
        : ""
    });

    for (const duplicateRow of groupedRows.slice(1)) {
      addAuditRow(auditRows, {
        sourceFile: providerSource.fileLabel,
        sourceSheet: providerSource.sheetName,
        sourceRowNumber: duplicateRow.__rowNumber,
        sourceAction: "provider_duplicate_collapsed",
        recordId: record.recordId,
        entityKey: record.entityKey,
        name: duplicateRow[providerSource.nameCol],
        country: displayCountry(duplicateRow[providerSource.countryCol]),
        notes: `Collapsed into ${record.recordId} using normalized country + provider name`
      });
    }

    continue;
  }

  const targetIds = matchIds;
  const action = targetIds.length === 1
    ? [...(nameCountryIndex.get(providerKey) || [])].length > 0
      ? "provider_merged_into_existing_record"
      : "provider_merged_by_location_suffix"
    : "provider_attached_to_multiple_city_records";

  for (const recordId of targetIds) {
    const record = records.get(recordId);
    record.providerRows = [representativeRow];
    record.providerVariants = new Set(listUnique(groupedRows.map((row) => row[providerSource.nameCol])));
    record.providerCountries = new Set(listUnique(groupedRows.map((row) => displayCountry(row[providerSource.countryCol]))));
    record.providerRowNumbers = groupedRows.map((row) => row.__rowNumber);
    record.sourceFiles.add(providerSource.fileLabel);
    record.providerMergeMode = action;

    if (targetIds.length > 1) {
      const cities = targetIds
        .map((id) => records.get(id))
        .map((targetRecord) => firstNonEmpty(targetRecord.gccRow?.City, targetRecord.top500Row?.City))
        .filter(Boolean);
      record.providerAmbiguousCities = cities.join(", ");
    }

    addAuditRow(auditRows, {
      sourceFile: providerSource.fileLabel,
      sourceSheet: providerSource.sheetName,
      sourceRowNumber: representativeRow.__rowNumber,
      sourceAction: action,
      recordId,
      entityKey: record.entityKey,
      name: representativeRow[providerSource.nameCol],
      country: displayCountry(representativeRow[providerSource.countryCol]),
      notes: targetIds.length > 1
        ? `Attached to ${targetIds.length} city-specific records`
        : groupedRows.length > 1
          ? `Merged after collapsing ${groupedRows.length - 1} duplicate provider row(s)`
          : ""
    });
  }

  for (const duplicateRow of groupedRows.slice(1)) {
    for (const recordId of targetIds) {
      addAuditRow(auditRows, {
        sourceFile: providerSource.fileLabel,
        sourceSheet: providerSource.sheetName,
        sourceRowNumber: duplicateRow.__rowNumber,
        sourceAction: "provider_duplicate_collapsed",
        recordId,
        entityKey: records.get(recordId).entityKey,
        name: duplicateRow[providerSource.nameCol],
        country: displayCountry(duplicateRow[providerSource.countryCol]),
        notes: `Collapsed into ${recordId} using normalized country + provider name`
      });
    }
  }
}

const integratedRows = [...records.values()]
  .sort((left, right) => {
    const countryCompare = displayCountry(firstNonEmpty(
      left.gccRow?.Country,
      left.top500Row?.Country,
      left.providerRows[0]?.Country
    )).localeCompare(displayCountry(firstNonEmpty(
      right.gccRow?.Country,
      right.top500Row?.Country,
      right.providerRows[0]?.Country
    )));

    if (countryCompare !== 0) {
      return countryCompare;
    }

    return firstNonEmpty(
      left.gccRow?.["Hospital Name"],
      left.top500Row?.["Hospital Name"],
      left.providerRows[0]?.["Provider Name"]
    ).localeCompare(firstNonEmpty(
      right.gccRow?.["Hospital Name"],
      right.top500Row?.["Hospital Name"],
      right.providerRows[0]?.["Provider Name"]
    ));
  })
  .map((record) => {
    const canonicalName = firstNonEmpty(
      record.gccRow?.["Hospital Name"],
      record.top500Row?.["Hospital Name"],
      record.providerRows[0]?.["Provider Name"]
    );
    const canonicalCountry = displayCountry(firstNonEmpty(
      record.gccRow?.Country,
      record.top500Row?.Country,
      record.providerRows[0]?.Country
    ));
    const canonicalCity = firstNonEmpty(record.gccRow?.City, record.top500Row?.City);
    const canonicalAddress = firstNonEmpty(record.gccRow?.Address);
    const publicUrls = listUnique([
      record.gccRow?.["Hospital Source URL"],
      record.gccRow?.["Bed Source URL"],
      record.gccRow?.["Revenue Source URL"]
    ]);
    const selectedBeds = firstNonEmpty(record.gccRow?.["Number of Beds"], record.top500Row?.["Estimated Beds"]);
    const selectedRevenue = firstNonEmpty(record.gccRow?.Revenues, record.top500Row?.["Estimated Annual Revenue (₹ Cr)"]);
    const selectedBedSourceType = cleanValue(record.gccRow?.["Number of Beds"]) !== ""
      ? "Reported in GCC workbook"
      : cleanValue(record.top500Row?.["Estimated Beds"]) !== ""
        ? "Estimated in Top500 workbook"
        : "";
    const selectedRevenueSourceType = cleanValue(record.gccRow?.Revenues) !== ""
      ? "Reported in GCC workbook"
      : cleanValue(record.top500Row?.["Estimated Annual Revenue (₹ Cr)"]) !== ""
        ? "Estimated in Top500 workbook"
        : "";

    let nameValidationStatus = "Single-source supplied record";
    let validationConfidence = "Low";

    if (publicUrls.length > 0 && record.sourceFiles.size >= 2) {
      nameValidationStatus = "Public URL available and matched across multiple supplied files";
      validationConfidence = "High";
    } else if (publicUrls.length > 0) {
      nameValidationStatus = "Public URL available in GCC workbook";
      validationConfidence = "High";
    } else if (record.sourceFiles.size >= 2) {
      nameValidationStatus = "Matched across multiple supplied files";
      validationConfidence = "Medium";
    }

    if (record.granularity === "Provider or hospital (name-level only)" && publicUrls.length === 0) {
      validationConfidence = "Low";
    }

    const validationNotes = [];
    if (publicUrls.length > 0) {
      validationNotes.push("Public source URLs carried over from GCC_Hospitals_MAIN.xlsx");
    }
    if (selectedBedSourceType === "Estimated in Top500 workbook") {
      validationNotes.push("Bed value is an estimate from the Top500 file");
    }
    if (selectedRevenueSourceType === "Estimated in Top500 workbook") {
      validationNotes.push("Revenue value is an estimate from the Top500 file");
    }
    if (record.providerMergeMode === "provider_attached_to_multiple_city_records") {
      validationNotes.push(`Provider list row matched multiple city records: ${record.providerAmbiguousCities}`);
    }
    if (record.granularity === "Provider or hospital (name-level only)" && publicUrls.length === 0) {
      validationNotes.push("No public source URL, bed count, or revenue value was available in the supplied files");
    }

    return {
      "Record ID": record.recordId,
      "Entity Granularity": record.granularity,
      "Canonical Name": canonicalName,
      "Canonical Country": canonicalCountry,
      "Canonical City": canonicalCity,
      "Canonical Address": canonicalAddress,
      "Matched Source Files": [...record.sourceFiles].join("; "),
      "Name Validation Status": nameValidationStatus,
      "Validation Confidence": validationConfidence,
      "Validation Source URLs": publicUrls.join("; "),
      "Selected Beds": selectedBeds,
      "Selected Beds Source Type": selectedBedSourceType,
      "Selected Beds Source URL": firstNonEmpty(record.gccRow?.["Bed Source URL"]),
      "Selected Revenue": selectedRevenue,
      "Selected Revenue Source Type": selectedRevenueSourceType,
      "Selected Revenue Source URL": firstNonEmpty(record.gccRow?.["Revenue Source URL"]),
      "Validation Notes": validationNotes.join("; "),
      "Provider Variants": [...record.providerVariants].join("; "),
      "Provider Source Row Numbers": record.providerRowNumbers.join(", "),
      ...toPrefixedRow(record.gccRow || {}, gccSource.prefix, gccColumns),
      ...toPrefixedRow(record.providerRows[0] || {}, providerSource.prefix, providerColumns),
      ...toPrefixedRow(record.top500Row || {}, top500Source.prefix, top500Columns)
    };
  });

const summaryRows = [
  {
    Metric: "GCC source rows",
    Value: gccSource.rows.length
  },
  {
    Metric: "Provider source rows",
    Value: providerSource.rows.length
  },
  {
    Metric: "Top500 source rows",
    Value: top500Source.rows.length
  },
  {
    Metric: "Integrated unique records",
    Value: integratedRows.length
  },
  {
    Metric: "Integrated hospital records",
    Value: integratedRows.filter((row) => row["Entity Granularity"] === "Hospital (city-specific)").length
  },
  {
    Metric: "Integrated provider-only records",
    Value: integratedRows.filter((row) => row["Entity Granularity"] === "Provider or hospital (name-level only)").length
  },
  {
    Metric: "Records with public validation URL",
    Value: integratedRows.filter((row) => cleanValue(row["Validation Source URLs"]) !== "").length
  },
  {
    Metric: "Records with reported bed count",
    Value: integratedRows.filter((row) => row["Selected Beds Source Type"] === "Reported in GCC workbook").length
  },
  {
    Metric: "Records with estimated bed count",
    Value: integratedRows.filter((row) => row["Selected Beds Source Type"] === "Estimated in Top500 workbook").length
  },
  {
    Metric: "Records with reported revenue",
    Value: integratedRows.filter((row) => row["Selected Revenue Source Type"] === "Reported in GCC workbook").length
  },
  {
    Metric: "Records with estimated revenue",
    Value: integratedRows.filter((row) => row["Selected Revenue Source Type"] === "Estimated in Top500 workbook").length
  },
  {
    Metric: "Audit rows",
    Value: auditRows.length
  }
];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(integratedRows), "Integrated_Unique");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(auditRows), "Merge_Audit");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
XLSX.writeFile(workbook, outputPath);

console.log(JSON.stringify({
  outputPath,
  integratedUniqueRecords: integratedRows.length,
  providerOnlyRecords: integratedRows.filter((row) => row["Entity Granularity"] === "Provider or hospital (name-level only)").length,
  recordsWithPublicUrl: integratedRows.filter((row) => cleanValue(row["Validation Source URLs"]) !== "").length,
  mergeAuditRows: auditRows.length
}, null, 2));
