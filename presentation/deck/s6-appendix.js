"use strict";
// Slides 50 to 54, the appendix after the Questions slide, kept for question time.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, content, chartFrame, axes, setupRow } = k;

// a simple table in the deck style, dark header row and hairline rules
function table(s, head, rows, colW, y, rowH, fs = 13) {
  const hdr = head.map((t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 } } }));
  const body = rows.map((r) => r.map((c, j) => ({ text: String(c), options: { bold: j === 0 } })));
  s.addTable([hdr, ...body], {
    x: M, y, w: colW.reduce((a, b) => a + b, 0), colW, fontFace: "Gill Sans MT", fontSize: fs, color: C.text1, valign: "middle",
    border: { type: "solid", pt: 0.5, color: X.g3 }, rowH, margin: [0.02, 0.08, 0.02, 0.08], objectName: "appendix table",
  });
}

function sessions() {
  // one row for each session, facts from the session folders (DATA.sessions) and the delivered counts from the timeline stats (STATS.sessions)
  const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const when = (iso) => `${Number(iso.slice(8, 10))} ${MONTH[Number(iso.slice(5, 7)) - 1]} ${iso.slice(11, 16)}`;
  const place = (v) => (v === "lab" || v === "room" ? "Room" : v === "laboutside" ? "A different place" : "Not logged");
  const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const thr = (d) => (d.threshold == null ? "None" : d.threshold_hi !== d.threshold ? `${Math.round(d.threshold)} to ${Math.round(d.threshold_hi)}` : num(d.threshold));
  const codes = (d) => (d.methods === 1 ? "rep-3" : d.methods === 7 ? "All 7" : `${d.methods} layouts`);
  const rows = [];
  STATS.sessions.forEach((r) => {
    const d = DATA.sessions.find((x) => x.start === r.start);
    if (!d) { rows.push([when(r.start), "Not logged", "Not logged", "n/a", "None", "0", "None", "Pipeline test only"]); return; }
    const light = d.glare ? "Dim with glare" : "Normal light";
    let got = `${r.valid} of ${r.planned}`;
    if (r.filmed > 0 && r.filmed * 2 < r.planned) got += `, ${r.filmed} filmed`;
    if (r.filmed === 0) got = r.label.charAt(0).toUpperCase() + r.label.slice(1);
    rows.push([when(r.start), place(d.venue), light, num(d.bit_rate), codes(d), String(d.trials), d.threshold == null ? (r.filmed === 0 ? "None" : num(setupRow(STATS.setup, "n3").thr_min)) : thr(d), got]);
  });
  const PH = DATA.physical, got = PH.layouts.reduce((t, l) => t + l.valid.filter(Boolean).length, 0);
  DATA.sessions.filter((d) => d.start >= "2026-11-01").forEach((d) => {
    const last = d.folder.endsWith("294106Z");
    rows.push([when(d.start), place(d.venue), last ? "Dim with glare, mild" : "Dim with glare", num(d.bit_rate), codes(d), String(d.trials), num(d.threshold), last ? `${got} of ${PH.trials}` : `Stopped at ${Math.round(d.elapsed)} s`]);
  });
  const { s, top } = content({
    title: "All recordings in a table",
    notes: "Backup for questions. Every recording in date order, with the place, the light, the bit rate, the codes, the number of trials, the calibrated threshold on a scale of 0 to 255, and how many frames were delivered. Laptop 1 sends and laptop 2 records. The payload was 16 bits, or 32 on 26 October and in the physical test. The last three rows are the physical test of the new layouts, and the first two were stopped by hand.",
    secs: 0,
  });
  table(s, ["When (UTC)", "Place", "Light", "bps", "Codes", "Trials", "Threshold", "Frames delivered"], rows, [1.3, 1.4, 1.65, 0.5, 0.85, 0.6, 1.0, 1.5], top - 0.05, 0.27, 12);
}

function physicalNumbers() {
  const R = RSTATS.physical, L = R.layouts, H = R.header;
  const names = { "rep-3 adjacent": "rep-3 side by side", "rep-3 spread": "rep-3 spread apart", "rep-3 spread + header": "rep-3 spread apart and spread header", "Ham-int depth 8": "Hamming depth 8", "Ham-int depth 16": "Hamming depth 16", "Ham-int depth 16 + header": "Hamming depth 16 and spread header" };
  const rows = Object.keys(L).map((key) => {
    const l = L[key];
    return [names[key] ?? key, `${l.ok} of ${l.trials}`, String(l.header_failures), `${(l.channel_ber * 100).toFixed(2)} percent`, `${(l.decoded_ber * 100).toFixed(2)} percent`, l.fisher_p === undefined ? "baseline" : l.fisher_p.toFixed(2)];
  });
  const { s, top } = content({
    title: "Numbers from the physical test",
    take: `Each layout had ${L[Object.keys(L)[0]].trials} trials. The p values compare with the baseline of its family.`,
    notes: "Backup for questions. Every number of the physical test. Each layout had 12 trials. The last column is the Fisher exact p against the baseline of its family, which is repetition-3 side by side or Hamming with depth 8. The header failures column counts frames that failed the header CRC. The two spread header layouts failed it 3 and 2 times, the four others never.",
    secs: 0,
  });
  table(s, ["Layout", "Frames delivered", "Header CRC failures", "Channel BER", "Decoded BER", "p against baseline"], rows, [3.0, 1.2, 1.2, 1.2, 1.1, 1.1], top + 0.1, 0.45, 13);
}

function statistics() {
  const rows = [
    ["Wilson interval", "A 95 percent range for a proportion, for example 2 frames out of 3.", "Frames delivered"],
    ["Fisher exact test", "Tests whether two groups differ, and stays exact with small counts.", "Comparing codes, conditions and layouts"],
    ["Permutation test", "Shuffles the errors of each trial 5000 times to see how often runs of 3 or more appear by chance.", "Burst share in glare"],
    ["BIC", "A score for comparing models. Lower is better, and extra parameters are charged for.", "No memory against the two-state model"],
    ["Trial bootstrap", "Resamples whole trials to get BER intervals, because errors inside one frame depend on each other.", "The report tables"],
  ];
  const { s, top } = content({
    title: "The statistics we used",
    notes: "Backup for questions. Wilson intervals for frames delivered, because the usual interval fails at 0 of 3 and 3 of 3. Fisher exact tests for comparing methods, conditions and layouts, because they stay exact at small counts. A permutation test for bursts, which shuffles each trial's errors 5000 times and counts how often runs of 3 or more appear by chance. BIC to choose between the model with no memory and the two-state model. And a bootstrap over whole trials for BER intervals, because the errors in one frame are not independent.",
    secs: 0,
  });
  table(s, ["Method", "What it does", "Where we used it"], rows, [2.0, 4.6, 2.2], top, 0.6, 14);
}

function codeMap() {
  const { s, top } = content({
    title: "Map of the code",
    take: "A screen side, a camera side, and one shared protocol and coding layer.",
    notes: "Backup for the code walkthrough. cli.py holds the commands. The transmitter draws the patch on the screen, the receiver reads the camera, and both use protocol.py for the frame, the CRC and the sync word. The coding package holds repetition, Hamming, 2-D parity, interleaving and spreading behind one pipeline. The optical package holds calibration, detection and the timing recovery. The experiments package holds the plan, the recording, the analysis, the statistics, the burst model and the simulation. The report folder rebuilds every figure and number from the saved results.",
    secs: 0,
  });
  const box = (x, y, w, h, title, lines) => {
    cell(s, x, y, w, h, "", { fill: WHITE, line: C.text1, lw: 1.25, name: `${title} box` });
    text(s, title, { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: 0.32, fontSize: 17, bold: true, objectName: `${title} title` });
    text(s, lines.map((l, i) => ({ text: l, options: { breakLine: i < lines.length - 1, fontFace: FONT.mono } })), { x: x + 0.15, y: y + 0.5, w: w - 0.3, h: h - 0.55, fontSize: 12, color: C.text2, objectName: `${title} files` });
  };
  const w = 2.7, gap = 0.35, y1 = top + 0.15, h1 = 1.55;
  box(M, y1, w, h1, "Screen side", ["transmitter.py", "optical/patterns.py"]);
  box(M + w + gap, y1, w, h1, "Shared", ["protocol.py", "coding/ pipeline.py", "repetition hamming parity2d", "interleaving spreading"]);
  box(M + 2 * (w + gap), y1, w, h1, "Camera side", ["receiver.py", "optical/ calibration", "detection synchronization"]);
  arrow(s, M + w, y1 + h1 / 2, M + w + gap, y1 + h1 / 2, { color: C.text1, w: 1.5, name: "screen to shared" });
  arrow(s, M + 2 * w + 2 * gap, y1 + h1 / 2, M + 2 * w + gap, y1 + h1 / 2, { color: C.text1, w: 1.5, name: "camera to shared" });
  const y2 = y1 + h1 + 0.5;
  box(M, y2, 8.8, 1.3, "Experiments and report", ["experiments/ plan recording analysis stats channel_model simulation metrics", "report/ make_figures.py design_sim.py   cli.py holds every command"]);
  arrow(s, M + 4.4, y2, M + 4.4, y1 + h1, { color: C.text1, w: 1.5, name: "experiments to shared" });
}

function codingIds() {
  const ids = [["0", "none"], ["1", "repetition"], ["2", "hamming"], ["3", "hamming-interleaved"], ["4", "parity2d"], ["5", "repetition-spread"], ["6", "hamming-interleaved-16"]];
  const { s, top } = content({
    title: "Coding ids and the CRC",
    notes: "Backup for questions. The header stores the coding scheme as a number, and these are the numbers. The CRC is 16 bits long. It uses the polynomial 0x1021 and starts from 0xFFFF. One CRC covers the six header bytes and another covers the payload. The receiver recomputes it and compares, so it detects damage but cannot repair it.",
    secs: 0,
  });
  text(s, "Coding ids in the header", { x: M, y: top + 0.1, w: 4, h: 0.34, fontSize: 18, bold: true, objectName: "coding ids heading" });
  text(s, ids.map(([i, n], j) => ({ text: `${i}   ${n}`, options: { breakLine: j < ids.length - 1, fontFace: FONT.mono } })), { x: M, y: top + 0.6, w: 4.2, h: 2.2, fontSize: 15, color: C.text1, objectName: "coding ids" });
  text(s, "The CRC", { x: 5.4, y: top + 0.1, w: 4, h: 0.34, fontSize: 18, bold: true, objectName: "crc heading" });
  text(s, "A 16 bit check value computed from the data. Polynomial 0x1021, start value 0xFFFF. One CRC covers the header and another covers the payload. A CRC detects damage, it cannot repair it.", { x: 5.4, y: top + 0.6, w: 4.0, h: 2.4, fontSize: 16, objectName: "crc text" });
}

async function build() {
  k.speaker("Both");
  k.section("Appendix");
  sessions();
  physicalNumbers();
  statistics();
  codeMap();
  codingIds();
}

module.exports = { build };
