// Tokyo trip planner: shared picks store.
// Keeps one row per item in the "Picks" tab of the Japan Trip Google Sheet.
// Works either attached to that sheet (Extensions > Apps Script) or as a standalone
// project at script.google.com, because it opens the sheet by ID.
// Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
// Paste the resulting /exec URL into index.html as API.

var SPREADSHEET_ID = '19674j1NJG51B-U5pZ0D3a33-IOIyUw9jJYAzmvfVAlc'; // Japan Trip
var SHEET_NAME = 'Picks';
var HEADER = ['id', 'state', 'booked', 'at', 'by'];

function sheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll_() {
  var rows = sheet_().getDataRange().getValues();
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][0] || '');
    if (!id) continue;
    var doc = { at: String(rows[i][3] || ''), by: String(rows[i][4] || '') };
    var state = String(rows[i][1] || '');
    if (state) doc.state = state;
    var booked = rows[i][2];
    if (booked === true || booked === false) doc.booked = booked;
    else if (String(booked).toLowerCase() === 'true') doc.booked = true;
    else if (String(booked).toLowerCase() === 'false') doc.booked = false;
    out[id] = doc;
  }
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_({ ok: true, picks: readAll_(), serverTime: new Date().toISOString() });
}

// Body: {"writes":[{"id":"goku","doc":{"state":"yes","booked":true,"at":"2026-...","by":""}}]}
// A doc with neither state nor booked is a cleared pick (kept as a tombstone with its timestamp).
// Newest "at" wins; an older write never overwrites a newer row.
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var writes = body.writes || [];
    var sh = sheet_();
    var rows = sh.getDataRange().getValues();
    var rowOf = {};
    for (var i = 1; i < rows.length; i++) if (rows[i][0]) rowOf[String(rows[i][0])] = i + 1;
    writes.forEach(function (w) {
      if (!w || !w.id || typeof w.id !== 'string' || w.id.length > 80) return;
      var doc = w.doc || {};
      var at = String(doc.at || new Date().toISOString());
      var row = rowOf[w.id];
      if (row && String(rows[row - 1][3] || '') >= at) return; // existing row is newer or equal
      var vals = [
        w.id,
        doc.state ? String(doc.state).slice(0, 10) : '',
        doc.booked === true ? true : doc.booked === false ? false : '',
        at,
        String(doc.by || '').slice(0, 40)
      ];
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
