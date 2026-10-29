// Tokyo trip planner: shared store (v4).
// One row per document in the "Picks" tab of the Japan Trip Google Sheet: item picks/notes, custom items,
// spend entries (ids s-…), settings (_settings). Works attached to the sheet or as a standalone project.
// Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
// Update an existing deployment: Deploy > Manage deployments > pencil > Version: New version > Deploy (URL stays the same).

var SPREADSHEET_ID = '19674j1NJG51B-U5pZ0D3a33-IOIyUw9jJYAzmvfVAlc'; // Japan Trip
var SHEET_NAME = 'Picks';
var HEADER = ['id', 'state', 'booked', 'time', 'day', 'at', 'by', 'doc'];
var COL = { id: 0, state: 1, booked: 2, time: 3, day: 4, at: 5, by: 6, doc: 7 };

// what a document may contain: key -> [type, max length]
var FIELDS = {
  state: ['s', 10], booked: ['b'], time: ['s', 20], day: ['s', 10], note: ['s', 600], who: ['s', 20], done: ['s', 10], reserved: ['b'], resv: ['s', 10],
  custom: ['b'], name: ['s', 140], cat: ['s', 40], link: ['s', 500], address: ['s', 240], phone: ['s', 40], lat: ['n'], lng: ['n'], deleted: ['b'],
  spend: ['b'], amount: ['n'], label: ['s', 140],
  fridayDate: ['s', 10]
};

function sheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.setFrozenRows(1); }
  var cur = sh.getRange(1, 1, 1, HEADER.length).getValues()[0];
  if (String(cur[COL.doc] || '') !== 'doc' || String(cur[COL.at] || '') !== 'at') migrate_(sh);
  return sh;
}

// Old layout was id,state,booked,at,by.
function migrate_(sh) {
  var last = sh.getLastRow();
  if (last >= 2 && String(sh.getRange(1, 4).getValue() || '') === 'at') {
    var old = sh.getRange(2, 1, last - 1, 5).getValues();
    var rows = old.map(function (r) { return [r[0], r[1], r[2], '', '', r[3], r[4], '']; });
    sh.getRange(2, 1, rows.length, HEADER.length).setValues(rows);
  }
  sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
}

function clean_(doc) {
  var out = {};
  for (var k in FIELDS) {
    if (!(k in doc)) continue;
    var v = doc[k], t = FIELDS[k][0];
    if (t === 's') { if (v === null || v === undefined || v === '') continue; out[k] = String(v).slice(0, FIELDS[k][1]); }
    else if (t === 'b') { if (v === true || v === false) out[k] = v; }
    else if (t === 'n') { var n = Number(v); if (isFinite(n)) out[k] = n; }
  }
  return out;
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
  var sh = sheet_(); var last = sh.getLastRow(); var out = {};
  if (last < 2) return out;
  var rows = sh.getRange(2, 1, last - 1, HEADER.length).getValues();
  for (var i = 0; i < rows.length; i++) { var id = String(rows[i][COL.id] || ''); if (id) out[id] = docFromRow_(rows[i]); }
  return out;
}

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) { return json_({ ok: true, picks: readAll_(), serverTime: new Date().toISOString() }); }

// Body: {"writes":[{"id":"goku","doc":{"state":"yes","booked":true,"note":"...","at":"2026-...","by":"Philipp"}}]}
// Newest "at" wins; an older write never overwrites a newer row. A doc with no fields is a cleared pick (tombstone).
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var writes = body.writes || [];
    var sh = sheet_(); var last = sh.getLastRow();
    var rows = last >= 2 ? sh.getRange(2, 1, last - 1, HEADER.length).getValues() : [];
    var rowOf = {};
    for (var i = 0; i < rows.length; i++) if (rows[i][COL.id]) rowOf[String(rows[i][COL.id])] = i + 2;
    writes.forEach(function (w) {
      if (!w || !w.id || typeof w.id !== 'string' || w.id.length > 80) return;
      var doc = (w.doc && typeof w.doc === 'object') ? w.doc : {};
      var at = String(doc.at || new Date().toISOString());
      var row = rowOf[w.id];
      if (row && String(rows[row - 2][COL.at] || '') >= at) return;
      var c = clean_(doc);
      c.at = at; c.by = String(doc.by || '').slice(0, 40);
      var vals = [w.id, c.state || '', c.booked === undefined ? '' : c.booked, c.time || '', c.day || '', at, c.by, JSON.stringify(c)];
      if (row) sh.getRange(row, 1, 1, HEADER.length).setValues([vals]);
      else { sh.appendRow(vals); rowOf[w.id] = sh.getLastRow(); }
    });
    return json_({ ok: true, picks: readAll_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}
