/**
 * SEMrush Keyword Cleaner - Advanced Professional Edition (Confronto URL / Brand vs Outlet)
 */

const COLUMN_ALIASES = {
  keyword:       ["keyword", "parola chiave", "keywords", "kw"],
  position:      ["position", "posizione", "pos"],
  search_volume: ["search volume", "volume", "volume di ricerca", "searches", "sv"],
  url:           ["url", "landing page", "pagina di destinazione", "search result"]
};

const MARKET_NAMES = {
  "it": "Italia", "es": "Spagna", "fr": "Francia", "de": "Germania",
  "uk": "UK", "us": "USA", "pt": "Portogallo", "nl": "Olanda",
  "be": "Belgio", "ch": "Svizzera", "at": "Austria", "pl": "Polonia"
};

const HEADER_COLORS = ["#1F4E79", "#1A5276", "#154360", "#0E3250", "#1B4F72", "#21618C"];

// Riferimento globale al nuovo SS per i log
let _logSS = null;
let _logRows = [];

function initLog(ss) {
  _logSS = ss;
  _logRows = [];
}

function log(message) {
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm:ss");
  const entry = "[" + ts + "] " + message;
  console.log(entry);
  _logRows.push([ts, message]);

  // Scrivi nel foglio LOG del nuovo SS se disponibile
  if (_logSS) {
    try {
      let logSheet = _logSS.getSheetByName("LOG");
      if (!logSheet) {
        logSheet = _logSS.insertSheet("LOG");
        logSheet.getRange(1, 1, 1, 2).setValues([["Timestamp", "Messaggio"]]);
        logSheet.getRange(1, 1, 1, 2)
          .setBackground("#2C3E50")
          .setFontColor("#FFFFFF")
          .setFontWeight("bold")
          .setFontFamily("Arial")
          .setFontSize(10);
        logSheet.setColumnWidth(1, 90);
        logSheet.setColumnWidth(2, 700);
      }
      logSheet.appendRow([ts, message]);
    } catch(e) {
      console.log("⚠ Impossibile scrivere nel foglio LOG: " + e.message);
    }
  }

  // Toast sul foglio sorgente (mainSS è ancora accessibile via getActiveSpreadsheet)
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(message, "📋 Log", 4);
    SpreadsheetApp.flush();
  } catch(e) {}
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📊 SEMrush Script")
    .addItem("🚀 Avvia Pulizia Keyword", "launchSemrushCleaner")
    .addItem("🔍 Trova Varianti Brand Mancanti", "findMissingBrandVariants")
    .addToUi();
}

function launchSemrushCleaner() {
  const mainSS = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  mainSS.toast("Lettura configurazioni e filtri...", "⏳ Inizializzazione", 10);
  SpreadsheetApp.flush();

  const configSheet = mainSS.getSheetByName("Configurazione");
  if (!configSheet) {
    ui.alert("❌ Errore: Non ho trovato il foglio 'Configurazione'.");
    return;
  }

  const folderId          = configSheet.getRange("B2").getValue().toString().trim();
  const tipoRaggruppamento = configSheet.getRange("B3").getValue().toString().trim().toLowerCase();
  const brandVariantiRaw  = configSheet.getRange("B4").getValue().toString().trim().toLowerCase();
  let   tipoQuery         = configSheet.getRange("B5").getValue().toString().trim().toLowerCase();
  const urlEsclusiRaw     = configSheet.getRange("B6").getValue().toString().trim().toLowerCase();
  const urlConfrontoRaw   = configSheet.getRange("B7").getValue().toString().trim().toLowerCase();

  if (!folderId) { ui.alert("❌ Errore: Inserisci l'ID della cartella Drive nella cella B2."); return; }

  if (!tipoQuery) {
    tipoQuery = "tutte";
  } else if (tipoQuery === "not brand") {
    tipoQuery = "not-brand";
  }

  const brandVarianti = brandVariantiRaw ? brandVariantiRaw.split(",").map(v => v.trim()).filter(v => v) : [];
  const urlEsclusi    = urlEsclusiRaw    ? urlEsclusiRaw.split(",").map(u => u.trim()).filter(u => u)    : [];
  const urlConfronto  = urlConfrontoRaw  ? urlConfrontoRaw.split(",").map(c => c.trim()).filter(c => c)  : [];

  if ((tipoQuery === "brand" || tipoQuery === "not-brand") && brandVarianti.length === 0) {
    mainSS.toast("Manca l'elenco dei brand in B4. Estraggo TUTTE le keyword.", "⚠ Filtro query bypassato", 6);
    SpreadsheetApp.flush();
    tipoQuery = "tutte";
  }

  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch(e) {
    ui.alert("❌ Errore: ID cartella in cella B2 non valido o permessi insufficienti.");
    return;
  }

  // ── Crea subito il file di output così i log ci finiscono dentro ──────────
  const dataOggi = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  let filtroSuffisso  = "_Tutte";
  if (tipoQuery === "brand")     filtroSuffisso = "_SoloBrand";
  if (tipoQuery === "not-brand") filtroSuffisso = "_NotBrand";
  const modalitaSuffisso = (tipoRaggruppamento === "separati per data") ? "_Dettagliato" : "_Consolidato";

  // Il nome del brand lo aggiorniamo dopo aver letto il primo file
  const newSheetName = "Report_Temp" + modalitaSuffisso + filtroSuffisso + "_" + dataOggi;
  const newSS = SpreadsheetApp.create(newSheetName);
  DriveApp.getFileById(newSS.getId()).moveTo(folder);

  // Inizializza il sistema di log puntando al nuovo SS
  initLog(newSS);
  log("🚀 Avvio elaborazione — " + new Date().toLocaleString());
  log("📁 Cartella Drive: " + folderId);
  log("⚙ Raggruppamento: " + tipoRaggruppamento + " | Query: " + tipoQuery);
  log("🏷 Brand varianti: " + (brandVarianti.length ? brandVarianti.join(", ") : "nessuna"));
  log("🚫 URL esclusi: "    + (urlEsclusi.length   ? urlEsclusi.join(", ")    : "nessuno"));
  log("🔀 URL confronto: "  + (urlConfronto.length  ? urlConfronto.join(", ")  : "nessuno"));

  // ── Lettura file CSV ───────────────────────────────────────────────────────
  const files = folder.getFiles();
  const groups = {};
  let fileCount = 0;
  let primoBrandRilevato = "SEMrush";

  // Pattern aggiornato: cattura anche il timestamp opzionale dopo la data (es. -2026-06-15T08_02_07Z)
  const pattern = /^(.+?)[-._]organic[-._]Positions[-._]([a-z]{2})[-._](\d{8})([^.]*)/i;

  while (files.hasNext()) {
    const file     = files.next();
    const fileName = file.getName();

    if (!fileName.toLowerCase().endsWith('.csv')) {
      log("⏭ Ignorato (non CSV): " + fileName);
      continue;
    }

    const match = fileName.match(pattern);
    if (!match) {
      log("⏭ Ignorato (pattern non riconosciuto): " + fileName);
      continue;
    }

    fileCount++;
    const brand          = match[1];
    const mercatoCode    = match[2].toLowerCase();
    const dataRaw        = match[3];
    // Timestamp univoco per distinguere export diversi della stessa data (es. "T08_02_07Z")
    const rawSuffix      = match[4] || "";
    const timeMatch = rawSuffix.match(/T(\d{2})_?(\d{2})_?(\d{2})/i);
    const tsPart = timeMatch ? timeMatch[1] + timeMatch[2] + timeMatch[3] : "";

    const mercatoName = MARKET_NAMES[mercatoCode] || mercatoCode.toUpperCase();
    const dataStr     = dataRaw.substring(0,4) + "-" + dataRaw.substring(4,6) + "-" + dataRaw.substring(6,8);

    if (fileCount === 1) primoBrandRilevato = brand.replace(".com", "");

    log("📄 File #" + fileCount + ": " + fileName);
    log("   → Brand: " + brand + " | Mercato: " + mercatoCode.toUpperCase() + " | Data: " + dataStr + " | TS: " + (tsPart || "n/a"));

    const csvString = file.getBlob().getDataAsString("UTF-8");
    let csvData = Utilities.parseCsv(csvString);
    if (csvData.length > 0 && csvData[0].length === 1) {
      csvData = Utilities.parseCsv(csvString, ';');
    }

    if (csvData.length < 2) {
      log("   ⚠ File vuoto o non parsabile, saltato.");
      continue;
    }

    log("   → Righe CSV lette: " + (csvData.length - 1));

    const headers     = csvData[0];
    const colAnalysis = detectColumns(headers);
    if (colAnalysis.missing.length > 0) {
      log("   ⚠ Colonne mancanti (" + colAnalysis.missing.join(", ") + "), file saltato.");
      continue;
    }

    const colMap = colAnalysis.colMap;

    // groupKey include il timestamp per tenere separati export diversi della stessa data
    let groupKey = brand + "|||" + mercatoCode + "|||" + mercatoName;
    if (tipoRaggruppamento === "separati per data") {
      groupKey += "|||" + dataStr + "|||" + tsPart;
    }

    if (!groups[groupKey]) groups[groupKey] = [];

    let righeAggiunte = 0;
    let righeScartate = 0;

    for (let i = 1; i < csvData.length; i++) {
      const row = csvData[i];
      if (row.length <= Math.max(colMap.keyword, colMap.position, colMap.search_volume, colMap.url)) continue;

      const keyword  = row[colMap.keyword].trim();
      const position = parseInt(row[colMap.position], 10);
      if (isNaN(position)) { righeScartate++; continue; }

      let rawVolume = row[colMap.search_volume].replace(/[\s.,]/g, "");
      let volume    = parseInt(rawVolume, 10);
      if (isNaN(volume)) volume = 0;

      const url      = row[colMap.url].trim();
      if (!keyword)  { righeScartate++; continue; }

      const lowerKw  = keyword.toLowerCase();
      const lowerUrl = url.toLowerCase();

      // flag Brand / Not Brand indipendente dal filtro tipoQuery
      const isBrandKw = brandVarianti.length > 0 && brandVarianti.some(v => lowerKw.includes(v));
      const brandFlag = brandVarianti.length > 0 ? (isBrandKw ? "Brand" : "Not Brand") : "";

      if (urlEsclusi.length > 0 && urlEsclusi.some(u => lowerUrl.includes(u))) {
        righeScartate++;
        continue;
      }

      if (tipoQuery === "brand" || tipoQuery === "not-brand") {
        const isBrandQuery = brandVarianti.some(v => lowerKw.includes(v));
        if (tipoQuery === "brand"     && !isBrandQuery) { righeScartate++; continue; }
        if (tipoQuery === "not-brand" &&  isBrandQuery) { righeScartate++; continue; }
      }

      groups[groupKey].push({ brand, mercatoName, mercatoCode: mercatoCode.toUpperCase(), dataStr, tsPart, keyword, position, volume, url, brandFlag });
      righeAggiunte++;
    }

    log("   ✅ Righe valide: " + righeAggiunte + " | Scartate: " + righeScartate + " | Totale gruppo [" + groupKey + "]: " + groups[groupKey].length);
  }

  if (fileCount === 0) {
    log("❌ Nessun file CSV valido trovato.");
    ui.alert("Nessun file CSV valido trovato nella cartella specificata.");
    return;
  }

  log("📦 File elaborati: " + fileCount + " | Gruppi creati: " + Object.keys(groups).length);

  // ── Deduplicazione ─────────────────────────────────────────────────────────
  log("🧹 Avvio deduplicazione...");

  const allDataGlobal = [];
  const sheetsData    = {};

  for (let groupKey in groups) {
    const rows  = groups[groupKey];
    const parts = groupKey.split("|||");
    const currentBrand       = parts[0];
    const currentMercatoCode = parts[1].toUpperCase();
    const currentDataStr     = parts[3] || "";
    const currentTsPart      = parts[4] || "";

    rows.sort((a, b) => {
      if (a.dataStr !== b.dataStr) return a.dataStr.localeCompare(b.dataStr);
      return a.position - b.position;
    });

    const seen        = new Set();
    const cleanedRows = [];

    for (let row of rows) {
      const lowerUrl = row.url.toLowerCase();
      let matchedPattern = "";
      if (urlConfronto.length > 0) {
        for (let p of urlConfronto) {
          if (lowerUrl.includes(p)) { matchedPattern = p; break; }
        }
      }

      const uniqueKey = row.keyword.toLowerCase() + "|||" + row.dataStr + "|||" + matchedPattern;
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        cleanedRows.push(row);
        allDataGlobal.push(row);
      }
    }

    const brandShort = currentBrand.replace(/\.(com|it|es|fr|de|uk|net|org)/g, "");

    let sheetName = "";
    if (currentDataStr) {
      // Se c'è un timestamp, lo accorciamo e lo aggiungiamo per differenziare
      const tsSuffix = currentTsPart ? " " + currentTsPart.substring(0, 6) : "";
      const maxBrandLen = 31 - 18 - tsSuffix.length;
      sheetName = brandShort.substring(0, maxBrandLen) + " - " + currentMercatoCode + " - " + currentDataStr + tsSuffix;
    } else {
      sheetName = (brandShort + " - " + currentMercatoCode).substring(0, 31);
    }

    log("📋 Gruppo [" + groupKey + "] → Foglio: \"" + sheetName + "\" | KW dopo dedup: " + cleanedRows.length + " (da " + rows.length + ")");

    sheetsData[sheetName] = cleanedRows;
  }

  allDataGlobal.sort((a, b) => {
    if (a.brand       !== b.brand)       return a.brand.localeCompare(b.brand);
    if (a.mercatoCode !== b.mercatoCode) return a.mercatoCode.localeCompare(b.mercatoCode);
    if (a.dataStr     !== b.dataStr)     return a.dataStr.localeCompare(b.dataStr);
    return a.position - b.position;
  });

  log("🌍 Totale righe globali (dopo dedup): " + allDataGlobal.length);

  // ── Rinomina il file con il brand corretto ora che lo conosciamo ───────────
  const finalReportName = "Report_" + primoBrandRilevato + modalitaSuffisso + filtroSuffisso + "_" + dataOggi;
  newSS.rename(finalReportName);
  log("📂 File rinominato: " + finalReportName);

  // ── Scrittura fogli ────────────────────────────────────────────────────────
  const headersRow   = ["Mercato", "Mercato Code", "Data", "Keyword", "Position", "Search Volume", "URL", "Brand/Not Brand"];
  const listSheetNames = Object.keys(sheetsData);
  const totalSheets    = listSheetNames.length;

  log("✍ Scrittura tab 'Tutti i Dati' (" + allDataGlobal.length + " righe)...");
  writeToSheet(newSS, "Tutti i Dati", headersRow, allDataGlobal, 0, true);

  let colorIdx = 1;
  for (let sheetName in sheetsData) {
    // Gestione nomi duplicati con suffisso progressivo
    const usedNames = new Set(newSS.getSheets().map(s => s.getName()));
    let finalSheetName = sheetName;
    let suffix = 2;
    while (usedNames.has(finalSheetName)) {
      finalSheetName = sheetName.substring(0, 28) + " " + suffix;
      suffix++;
    }

    log("✍ (" + colorIdx + "/" + totalSheets + ") Scrittura foglio: \"" + finalSheetName + "\" → " + sheetsData[sheetName].length + " righe");
    writeToSheet(newSS, finalSheetName, headersRow, sheetsData[sheetName], colorIdx, false);
    colorIdx++;
  }

  // ── Sposta il foglio LOG in fondo ──────────────────────────────────────────
  log("✅ Elaborazione completata! Fogli creati: " + (totalSheets + 1) + " + LOG");
  try {
    const logSheet = newSS.getSheetByName("LOG");
    if (logSheet) newSS.moveActiveSheet && newSS.setActiveSheet(logSheet) && newSS.moveActiveSheet(newSS.getSheets().length);
  } catch(e) {}

  mainSS.toast("Il report è pronto nella tua cartella Drive!", "✅ Completato", 10);
  SpreadsheetApp.flush();
  ui.alert("✅ Completato!\n\nNuovo file creato:\n\"" + finalReportName + "\"");
}

function detectColumns(headers) {
  const result  = {};
  const missing = [];
  const headersLower = headers.map(h => h.toLowerCase().trim());

  for (let key in COLUMN_ALIASES) {
    let foundIdx = -1;
    for (let alias of COLUMN_ALIASES[key]) {
      foundIdx = headersLower.indexOf(alias);
      if (foundIdx !== -1) break;
    }
    if (foundIdx !== -1) {
      result[key] = foundIdx;
    } else {
      missing.push(key);
    }
  }
  return { colMap: result, missing };
}

function writeToSheet(ss, sheetName, headers, dataObjects, colorIdx, isFirst) {
  const sheet = isFirst ? ss.getSheets()[0].setName(sheetName) : ss.insertSheet(sheetName);
  const matrix = [headers];

  for (let obj of dataObjects) {
    matrix.push([obj.mercatoName, obj.mercatoCode, obj.dataStr, obj.keyword, obj.position, obj.volume, obj.url, obj.brandFlag]);
  }

  const numRows = matrix.length;
  const numCols = headers.length;
  sheet.getRange(1, 1, numRows, numCols).setValues(matrix);

  const headerColor = HEADER_COLORS[colorIdx % HEADER_COLORS.length];
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange
    .setBackground(headerColor)
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontFamily("Arial")
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 26);

  if (numRows > 1) {
    const dataRange = sheet.getRange(2, 1, numRows - 1, numCols);
    dataRange.setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");

    const backgrounds = [];
    const alignments  = [];
    for (let i = 2; i <= numRows; i++) {
      backgrounds.push(new Array(numCols).fill(i % 2 === 0 ? "#EBF3FB" : "#FFFFFF"));
      alignments.push(["left", "center", "center", "left", "center", "center", "left", "center"]);
    }
    dataRange.setBackgrounds(backgrounds);
    dataRange.setHorizontalAlignments(alignments);
    sheet.getRange(1, 1, numRows, numCols).setBorder(true, true, true, true, true, true, "#DDDDDD", SpreadsheetApp.BorderStyle.SOLID);
  }

  sheet.autoResizeColumns(1, numCols);
  for (let c = 1; c <= numCols; c++) {
    let width = sheet.getColumnWidth(c) + 15;
    if (width < 85)  width = 85;
    if (width > 400) width = 400;
    sheet.setColumnWidth(c, width);
  }

  sheet.setFrozenRows(1);
  const fullRange = sheet.getRange(1, 1, numRows, numCols);
  fullRange.createFilter();
}

// ── findMissingBrandVariants ───────────────────────────────────────────────────
function findMissingBrandVariants() {
  const mainSS = SpreadsheetApp.getActiveSpreadsheet();
  const ui     = SpreadsheetApp.getUi();

  mainSS.toast("Inizializzazione scansione varianti...", "⏳ Analisi Brand", 10);
  SpreadsheetApp.flush();

  const configSheet = mainSS.getSheetByName("Configurazione");
  if (!configSheet) { ui.alert("❌ Errore: Non ho trovato il foglio 'Configurazione'."); return; }

  const folderId       = configSheet.getRange("B2").getValue().toString().trim();
  const brandVariantiRaw = configSheet.getRange("B4").getValue().toString().trim().toLowerCase();

  if (!folderId) { ui.alert("❌ Errore: Inserisci l'ID della cartella Drive nella cella B2."); return; }

  const knownBrands = brandVariantiRaw ? brandVariantiRaw.split(/[|,]/).map(v => v.trim()).filter(v => v) : [];

  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch(e) {
    ui.alert("❌ Errore: ID cartella in cella B2 non valido o permessi insufficienti.");
    return;
  }

  const files          = folder.getFiles();
  const missingVariants = new Set();
  let fileCount        = 0;
  const pattern        = /^(.+?)[-._]organic[-._]Positions[-._]([a-z]{2})[-._](\d{8})([^.]*)/i;

  while (files.hasNext()) {
    const file     = files.next();
    const fileName = file.getName();
    if (!fileName.toLowerCase().endsWith('.csv')) continue;

    const match = fileName.match(pattern);
    if (!match) continue;

    fileCount++;
    const fileBrand = match[1].toLowerCase().replace(/\.(com|it|es|fr|de|uk|net|org)/g, "").trim();

    mainSS.toast("Analisi file: " + fileBrand, "🔍 (" + fileCount + ")", 5);
    SpreadsheetApp.flush();

    const isCovered = knownBrands.some(kb => fileBrand.includes(kb) || kb.includes(fileBrand));
    if (!isCovered && fileBrand.length > 0) missingVariants.add(fileBrand);

    try {
      const csvString = file.getBlob().getDataAsString("UTF-8");
      let csvData = Utilities.parseCsv(csvString);
      if (csvData.length > 0 && csvData[0].length === 1) csvData = Utilities.parseCsv(csvString, ';');

      if (csvData.length >= 2) {
        const headersLower = csvData[0].map(h => h.toLowerCase().trim());
        let kwIdx = -1;
        for (let alias of COLUMN_ALIASES.keyword) {
          kwIdx = headersLower.indexOf(alias);
          if (kwIdx !== -1) break;
        }

        if (kwIdx !== -1) {
          const limitRows = Math.min(csvData.length, 300);
          for (let i = 1; i < limitRows; i++) {
            const row = csvData[i];
            if (row.length <= kwIdx) continue;
            const kw = row[kwIdx].trim().toLowerCase();
            if (!kw) continue;

            const containsKnown = knownBrands.some(kb => kw.includes(kb));
            if (!containsKnown) {
              const tokens = kw.split(/\s+/);
              for (let token of tokens) {
                if (token.length < 4) continue;
                for (let kb of knownBrands) {
                  if (kb.length < 4) continue;
                  const distance = getLevenshteinDistance(token, kb);
                  if (distance === 1 || distance === 2) missingVariants.add(token);
                }
              }
            }
          }
        }
      }
    } catch(err) {}
  }

  if (fileCount === 0) { ui.alert("Nessun file CSV valido trovato."); return; }

  const finalMissing = Array.from(missingVariants).filter(v => !knownBrands.includes(v));

  if (finalMissing.length > 0) {
    const resultString = finalMissing.join(", ");
    configSheet.getRange("A15").setValue(resultString);
    mainSS.toast("Varianti inserite in A15!", "✅ Completato", 5);
    ui.alert("🔍 Scansione Completata!\n\nVarianti mancanti trovate:\n\n" + resultString);
  } else {
    configSheet.getRange("A15").setValue("Nessuna variante mancante rilevata");
    mainSS.toast("Nessuna variante trovata.", "✅ Completato", 5);
    ui.alert("🔍 Scansione Completata!\n\nNessuna variante mancante rilevata.");
  }
}

function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i-1) === a.charAt(j-1)
        ? matrix[i-1][j-1]
        : Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
    }
  }
  return matrix[b.length][a.length];
}