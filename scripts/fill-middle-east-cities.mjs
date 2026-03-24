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

function countBlankCities(rows) {
  return rows.filter((row) => cleanValue(row.City) === "").length;
}

function duplicateGroups(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = `${cleanValue(row["Hospital Name"]).toLowerCase()}||${cleanValue(row.Country).toLowerCase()}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

const mappings = [
  {
    name: "Al Dhafra Hospitals",
    country: "UAE",
    city: "Madinat Zayed",
    sourceUrl: "https://docarabia.ae/hospitals/33",
    note: "Directory lists the Al Dhafra Hospitals administration office in Madinat Zayed; used the main administrative city."
  },
  {
    name: "Al Garhoud Private Hospital",
    country: "UAE",
    city: "Dubai",
    sourceUrl: "https://www.dubaihealthcareguide.com/item/al-garhoud-private-hospital/",
    note: "Directory lists Al Garhoud Private Hospital in Dubai."
  },
  {
    name: "Al Mouwasat Medical Services",
    country: "Saudi Arabia",
    city: "Dammam",
    sourceUrl: "https://www.mouwasat.com/en/Mission-Vision-Vlaues",
    note: "Official company page states Mouwasat Medical Services was established in Dammam."
  },
  {
    name: "Al Salam Hospital",
    country: "Saudi Arabia",
    city: "Al Khobar",
    sourceUrl: "https://alsalamhospital.com.sa/en/media/al-salam-hospital",
    note: "Official hospital page lists the location in Al Khobar."
  },
  {
    name: "Aldara Hospital",
    country: "Saudi Arabia",
    city: "Riyadh",
    sourceUrl: "https://www.top-rated.online/cities/Ar%2BRafi%60ah/place/p/6164291/Aldara%2BHospital",
    note: "Public listing gives Aldara Hospital's address in Riyadh."
  },
  {
    name: "Amana Healthcare",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://new.graceslist.org/directory-listing/united-arab-emirates/abu-dhabi/amana-healthcare-medical-and-rehabilitation-hospital/",
    note: "Public hospital listing places Amana Healthcare in Abu Dhabi; used Abu Dhabi as the main city for the brand row."
  },
  {
    name: "Aster DM Healthcare",
    country: "UAE",
    city: "Dubai",
    sourceUrl: "https://www.asterdmhealthcare.com/contactus",
    note: "Official contact page lists the corporate headquarters in Business Bay, Dubai."
  },
  {
    name: "Behman Psychiatric Hospital",
    country: "Egypt",
    city: "Cairo",
    sourceUrl: "https://behman.com/contact/",
    note: "Official contact page lists The Behman in Helwan, Cairo."
  },
  {
    name: "Bupa Arabia",
    country: "Saudi Arabia",
    city: "Jeddah",
    sourceUrl: "https://www.bupa.com.sa/en/contactus",
    note: "Official contact page lists the company address in Al Khalidiyah, Jeddah."
  },
  {
    name: "Capital Health - Mubadala",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://uems.ae/?page_id=3205",
    note: "About Mubadala Health positions Capital Health within Mubadala Health's Abu Dhabi network; used Abu Dhabi as the corporate city."
  },
  {
    name: "Capital Health Screening Centre",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://capitalhealth.ae/about-us/who-we-are/",
    note: "Official page describes CHSC as an Abu Dhabi screening network."
  },
  {
    name: "dallah hospital(health)",
    country: "Saudi Arabia",
    city: "Riyadh",
    sourceUrl: "https://www.dallahhealth.com/english/overview",
    note: "Official overview says Dallah launched its first facility in Riyadh; used Riyadh as the main city."
  },
  {
    name: "Dar Al Kamal Hospital",
    country: "UAE",
    city: "Sharjah",
    sourceUrl: "https://daralkamal.ae/",
    note: "Official site describes Dar Al Kamal as a hospital in Sharjah."
  },
  {
    name: "Dr. Abanamy Hospital",
    country: "Saudi Arabia",
    city: "Riyadh",
    sourceUrl: "https://www.mihnati.com/EN/company/abanamy-hospital/about",
    note: "Company profile describes Dr. Ahmed Abanamy Hospital as a private general hospital in Riyadh."
  },
  {
    name: "Dr. Mohammad Alfagih Hospital",
    country: "Saudi Arabia",
    city: "Riyadh",
    sourceUrl: "https://sehaguide.com/ar/gmap/34258/%D9%85%D8%B3%D8%AA%D8%B4%D9%81%D9%89-%D8%A7%D9%84%D8%AF%D9%83%D8%AA%D9%88%D8%B1-%D9%85%D8%AD%D9%85%D8%AF-%D8%A7%D9%84%D9%81%D9%82%D9%8A%D9%87-%D8%A8%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6/%D9%8A%D9%88%D8%B3%D9%81-%D8%A8%D9%86-%D8%B9%D9%8A%D8%B3%D9%89-%D8%A7%D9%84%D8%B4%D9%86%D8%AA%D9%85%D9%8A%D8%B1%D9%8A-%D8%8C-%D8%A7%D9%84%D8%AE%D9%84%D9%8A%D8%AC-%D8%8C-%D8%B7%D8%B1%D9%8A%D9%82-%D8%A7%D9%84%D9%85%D9%84%D9%83-%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%84%D9%87-%D8%8C-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6-13223-%D8%8C-%D8%A7%D9%84%D9%85%D9%85%D9%84%D9%83%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9-%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6-%D8%A7%D9%84%D8%AE%D9%84%D9%8A%D8%AC",
    note: "Sehaguide map page identifies the hospital in Riyadh."
  },
  {
    name: "Dr. Mohd Al Fagih",
    country: "Saudi Arabia",
    city: "Riyadh",
    sourceUrl: "https://sehaguide.com/ar/gmap/34258/%D9%85%D8%B3%D8%AA%D8%B4%D9%81%D9%89-%D8%A7%D9%84%D8%AF%D9%83%D8%AA%D9%88%D8%B1-%D9%85%D8%AD%D9%85%D8%AF-%D8%A7%D9%84%D9%81%D9%82%D9%8A%D9%87-%D8%A8%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6/%D9%8A%D9%88%D8%B3%D9%81-%D8%A8%D9%86-%D8%B9%D9%8A%D8%B3%D9%89-%D8%A7%D9%84%D8%B4%D9%86%D8%AA%D9%85%D9%8A%D8%B1%D9%8A-%D8%8C-%D8%A7%D9%84%D8%AE%D9%84%D9%8A%D8%AC-%D8%8C-%D8%B7%D8%B1%D9%8A%D9%82-%D8%A7%D9%84%D9%85%D9%84%D9%83-%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%84%D9%87-%D8%8C-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6-13223-%D8%8C-%D8%A7%D9%84%D9%85%D9%85%D9%84%D9%83%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9-%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9-%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6-%D8%A7%D9%84%D8%AE%D9%84%D9%8A%D8%AC",
    note: "Mapped the shortened name variant to the same Riyadh hospital."
  },
  {
    name: "Dr. Suleiman Fakeeh Hospital",
    country: "Saudi Arabia",
    city: "Jeddah",
    sourceUrl: "https://www.medicalfakeeh.com/en/about-us-pre/about-fakeeh-care",
    note: "Official Fakeeh Care page lists DSFH Jeddah as one of its facilities."
  },
  {
    name: "Emirates European Hospital",
    country: "UAE",
    city: "Sharjah",
    sourceUrl: "https://eehospital.com/contact-us/",
    note: "Official contact page lists the hospital in Sharjah."
  },
  {
    name: "Emirates Specialty Hospital",
    country: "UAE",
    city: "Dubai",
    sourceUrl: "https://emirates.okadoc.com/en-ae/clinic/dubai/emirates-specialty-hospital",
    note: "Hospital directory lists Emirates Specialty Hospital in Dubai Healthcare City."
  },
  {
    name: "Erfan Hospital",
    country: "Saudi Arabia",
    city: "Jeddah",
    sourceUrl: "https://www.ebgh.med.sa/",
    note: "Official hospital site says Dr. Erfan & Bagedo General Hospital is in Jeddah."
  },
  {
    name: "King's College Hospital KSA",
    country: "Saudi Arabia",
    city: "Jeddah",
    sourceUrl: "https://kch.sa/contact-us/",
    note: "Official contact page lists the hospital in Ash Shati, Jeddah."
  },
  {
    name: "Lifecare Hospital L.L.C.",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://burjeelholdings.com/company/brands/lifecare-hospital/",
    note: "Official brand page says Lifecare Hospitals serve Abu Dhabi's Musaffah and Baniyas areas; used Abu Dhabi as the main city."
  },
  {
    name: "Lifeline hospital",
    country: "Oman",
    city: "Sohar",
    sourceUrl: "https://www.lifelineoman.com/contact-us",
    note: "Official contact page lists Lifeline Hospital LLC in Sohar."
  },
  {
    name: "M42 Health",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://m42.ae/contact-us/",
    note: "Official contact page lists M42 at Mubadala Tower, Abu Dhabi."
  },
  {
    name: "Malaffi",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://www.malaffi.ae/contact-us/",
    note: "Official contact page lists the Malaffi office in Abu Dhabi."
  },
  {
    name: "Mohammad Dossary Hospital",
    country: "Saudi Arabia",
    city: "Al Khobar",
    sourceUrl: "https://sehaguide.com/en/Item/9402/Al-Dossary-Hospital",
    note: "Sehaguide lists the hospital in Al Khobar."
  },
  {
    name: "Mubadala Health",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://uems.ae/?page_id=3205",
    note: "About Mubadala Health and related releases position the network in Abu Dhabi; used Abu Dhabi as the corporate city."
  },
  {
    name: "NMC",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://nmc.ae/en/contactus",
    note: "Official contact page lists the NMC corporate office in Abu Dhabi."
  },
  {
    name: "NMC Health",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://nmc.ae/en/contactus",
    note: "Official contact page lists the NMC corporate office in Abu Dhabi."
  },
  {
    name: "NMC Health PLC",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://nmc.ae/en/contactus",
    note: "Official contact page lists the NMC corporate office in Abu Dhabi."
  },
  {
    name: "NMC Healthcare",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://nmc.ae/en/contactus",
    note: "Official contact page lists the NMC corporate office in Abu Dhabi."
  },
  {
    name: "Oriana Hospital",
    country: "UAE",
    city: "Sharjah",
    sourceUrl: "https://orianahospital.ae/contact/",
    note: "Official contact page lists Oriana Specialty Hospital in Sharjah."
  },
  {
    name: "Prince Fahd Bin Sultan Hospital",
    country: "Saudi Arabia",
    city: "Tabuk",
    sourceUrl: "https://sehaguide.com/en/Item/21776/Prince-Fahd-bin-Sultan-Hospital---Tabuk",
    note: "Sehaguide lists Prince Fahd bin Sultan Hospital in Tabuk."
  },
  {
    name: "Procare Riaya Hospital",
    country: "Saudi Arabia",
    city: "Al Khobar",
    sourceUrl: "https://sehaguide.com/en/Item/34528/Riaya-Hospital---Procare",
    note: "Sehaguide lists Riaya Hospital - Procare in Al Khobar."
  },
  {
    name: "PureHealth",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://purehealth.ae/about-us/",
    note: "Official site lists PureHealth Headquarters in Al Rahah, Abu Dhabi."
  },
  {
    name: "Salma Hospital",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://www.salmahospital.com/facility",
    note: "Official facility page places Salma Rehabilitation Hospital in Abu Dhabi."
  },
  {
    name: "Sultan Bin Abdulaziz Humanitarian City (SBAHC)",
    country: "Saudi Arabia",
    city: "Riyadh",
    sourceUrl: "https://mu.linkedin.com/company/sultan_city",
    note: "Company page lists the headquarters in Riyadh."
  },
  {
    name: "Thumbay Hospital",
    country: "UAE",
    city: "Ajman",
    sourceUrl: "https://thumbayhospital.com/ajman/about-us/",
    note: "Official Ajman page describes Ajman as the first and flagship Thumbay hospital; used Ajman for the generic brand row."
  },
  {
    name: "UEMedical",
    country: "UAE",
    city: "Abu Dhabi",
    sourceUrl: "https://uems.ae/?page_id=2399",
    note: "Official about page describes UEMedical as Abu Dhabi-based and lists its Khalifa Street office."
  },
  {
    name: "Valiant Clinic and Hospital",
    country: "UAE",
    city: "Dubai",
    sourceUrl: "https://www.citywalk.ae/en/outlets/valiant-clinic-and-hospital",
    note: "City Walk lists Valiant Clinic & Hospital in Dubai."
  },
  {
    name: "Al-Qassim National Hospital",
    country: "Saudi Arabia",
    city: "Buraidah",
    sourceUrl: "https://www.cybo.com/SA-biz/al-qassim-national-hospital",
    note: "Directory lists Al Qassim National Hospital in Buraidah."
  }
];

const inputPath = path.resolve(
  readArg(
    "input",
    "C:/Users/VivekSharma/OneDrive - THB c o Sekhmet Technologies Private Limited/Desktop/Middle_East_Hospitals_Deduped_WebMapped.xlsx"
  )
);
const outputPath = path.resolve(readArg("output", inputPath));
const sheetName = readArg("sheet", "Cleaned_Unique");
const batch = Number(readArg("batch", "17"));
const dataDir = path.resolve(readArg("data-dir", "data"));

const workbook = XLSX.readFile(inputPath, { cellDates: false });
const targetSheetName = workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0];
const worksheet = workbook.Sheets[targetSheetName];
const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 })[0].map((value) => cleanValue(value));
const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }).map((row) => ({
  ...row,
  "Hospital Name": cleanValue(row["Hospital Name"]),
  Country: cleanValue(row.Country),
  City: cleanValue(row.City),
  Beds: cleanValue(row.Beds)
}));

const cityBlanksBefore = countBlankCities(rows);
const duplicateGroupsBefore = duplicateGroups(rows);
const updates = [];
const skippedMappings = [];

for (const mapping of mappings) {
  const matches = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row["Hospital Name"] === mapping.name && row.Country === mapping.country);

  if (matches.length === 0) {
    skippedMappings.push({
      name: mapping.name,
      country: mapping.country,
      reason: "not_found"
    });
    continue;
  }

  let updatedAny = false;
  for (const { row, index } of matches) {
    if (cleanValue(row.City) !== "") {
      skippedMappings.push({
        name: mapping.name,
        country: mapping.country,
        excelRow: index + 2,
        reason: "already_has_city",
        currentCity: row.City
      });
      continue;
    }

    row.City = mapping.city;
    updatedAny = true;
    updates.push({
      excelRowBefore: index + 2,
      name: mapping.name,
      country: mapping.country,
      oldCity: "",
      newCity: mapping.city,
      sourceType: "web",
      source: mapping.sourceUrl,
      note: mapping.note
    });
  }

  if (!updatedAny && matches.length > 0) {
    continue;
  }
}

const updatedWorksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
workbook.Sheets[targetSheetName] = updatedWorksheet;

fs.mkdirSync(dataDir, { recursive: true });

XLSX.writeFile(workbook, outputPath);

const baseName = path.basename(outputPath, path.extname(outputPath));
const backupPath = path.join(dataDir, `${baseName}.batch${batch}.backup.xlsx`);
const auditPath = path.join(dataDir, `${baseName}.batch${batch}.audit.json`);
fs.copyFileSync(outputPath, backupPath);

const cityBlanksAfter = countBlankCities(rows);
const duplicateGroupsAfter = duplicateGroups(rows);

const audit = {
  batch,
  timestamp: new Date().toISOString(),
  sourceWorkbookPath: inputPath,
  workbookPath: outputPath,
  rowsBefore: rows.length,
  rowsAfter: rows.length,
  removedDuplicateRows: 0,
  duplicateGroupsBefore,
  duplicateGroupsAfter,
  cityBlanksBefore,
  cityBlanksAfter,
  cityUpdatesCount: updates.length,
  cityUpdates: updates,
  skippedMappings
};

fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));

console.log(JSON.stringify({
  sourceWorkbookPath: inputPath,
  workbookPath: outputPath,
  backupPath,
  auditPath,
  rows: rows.length,
  cityBlanksBefore,
  cityBlanksAfter,
  cityUpdatesCount: updates.length,
  duplicateGroupsBefore,
  duplicateGroupsAfter
}, null, 2));
