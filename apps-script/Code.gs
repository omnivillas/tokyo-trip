// Tokyo trip planner: shared picks store.
// Keeps one row per item in the "Picks" tab of the Japan Trip Google Sheet.
// Works either attached to that sheet (Extensions > Apps Script) or as a standalone
// project at script.google.com, because it opens the sheet by ID.
// Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
// To update an existing deployment: Deploy > Manage deployments > pencil > Version: New version > Deploy (URL stays the same).

var SPREADSHEET_ID = '19674j1NJG51B-U5pZ0D3a33-IOIyUw9jJYAzmvfVAlc'; // Japan Trip
var SHEET_NAME = 'Picks';
var HEADER = ['id', 'state', 'booked', 'time', 'day', 'at', 'by', 'doc'];
var COL = { id: 0, state: 1, booked: 2, time: 3, day: 4, at: 5, by: 6, doc: 7 };

function sheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.setFrozenRows(1);
  }
  // keep the header current (older versions wrote 5 columns)
  var cur = sh.getRange(1, 1, 1, HEADER.length).getValues()[0];
  if (String(cur[COL.doc] || '') !== 'doc' || String(cur[COL.at] || '') !== 'at') {
    migrate_(sh);
  }
  return sh;
}

// Old layout was id,state,booked,at,by. Move at/by to their new columns and write the header.
function migrate_(sh) {
  var last = sh.getLastRow();
  if (last >= 2) {
    var old = sh.getRange(2, 1, last - 1, 5).getValues();
    var isOld = String(sh.getRange(1, 4).getValue() || '') === 'at';
    if (isOld) {
      var rows = old.map(function (r) {
        return [r[0], r[1], r[2], '', '', r[3], r[4], ''];
      });
      sh.getRange(2, 1, rows.length, HEADER.length).setValues(rows);
    }
  }
  sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
}

function docFromRow_(r) {
  var doc = null;
  try { if (r[COL.doc]) doc = JSON.parse(String(r[COL.doc])); } catch (e) { doc = null; }
  if (!doc || typeof doc !== 'object') {
    doc = {};
    if (r[COL.state]) doc.state = String(r[COL.state]);
    var b = r[COL.booked];
    if (b === true || String(b).toLowerCase() === 'true') doc.booked = true;
    else if (b === false || String(b).toLowerCase() === 'false') doc.booked = false;
    if (r[COL.time]) doc.time = String(r[COL.time]);
    if (r[COL.day]) doc.day = String(r[COL.day]);
  }
  doc.at = String(r[COL.at] || doc.at || '');
  doc.by = String(r[COL.by] || doc.by || '');
  return doc;
}

function readAll_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  var out = {};
  if (last < 2) return out;
  var rows = sh.getRange(2, 1, last - 1, HEADER.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var id = String(rows[i][COL.id] || '');
    if (!id) continue;
    out[id] = docFromRow_(rows[i]);
  }
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_({ ok: true, picks: readAll_(), serverTime: new Date().toISOString() });
}

// Body: {"writes":[{"id":"goku","doc":{"state":"yes","booked":true,"time":"21:30","day":"Fri","at":"2026-...","by":""}}]}
// Newest "at" wins; an older write never overwrites a newer row. A doc with no fields is a cleared pick.
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var writes = body.writes || [];
    var sh = sheet_();
    var last = sh.getLastRow();
    var rows = last >= 2 ? sh.getRange(2, 1, last - 1, HEADER.length).getValues() : [];
    var rowOf = {};
    for (var i = 0; i < rows.length; i++) if (rows[i][COL.id]) rowOf[String(rows[i][COL.id])] = i + 2;
    writes.forEach(function (w) {
      if (!w || !w.id || typeof w.id !== 'string' || w.id.length > 80) return;
      var doc = (w.doc && typeof w.doc === 'object') ? w.doc : {};
      var at = String(doc.at || new Date().toISOString());
      var row = rowOf[w.id];
      if (row && String(rows[row - 2][COL.at] || '') >= at) return; // existing row is newer or equal
      var clean = {};
      if (doc.state) clean.state = String(doc.state).slice(0, 10);
      if (doc.booked === true || doc.booked === false) clean.booked = doc.booked;
      if (doc.time) clean.time = String(doc.time).slice(0, 20);
      if (doc.day) clean.day = String(doc.day).slice(0, 10);
      clean.at = at;
      clean.by = String(doc.by || '').slice(0, 40);
      var vals = [w.id, clean.state || '', clean.booked === undefined ? '' : clean.booked, clean.time || '', clean.day || '', at, clean.by, JSON.stringify(clean)];
      if (row) sh.getRange(row, 1, 1, HEADER.length).setValues([vals]);
      else { sh.appendRow(vals); rowOf[w.id] = sh.getLastRow(); }
    });
    return json_({ ok: true, picks: readAll_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
