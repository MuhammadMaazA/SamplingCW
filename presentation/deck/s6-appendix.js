"use strict";
// Slides 48 to 52, the appendix after the Questions slide, kept for the question time.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, content, chartFrame, axes } = k;

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
  // every recording in date order, from session.json, plan.json and capture.log of each session folder, and the analysed groups in the report appendix
  const PH = DATA.physical, got = PH.layouts.reduce((t, l) => t + l.valid.filter(Boolean).length, 0);
  const rows = [
    ["26 Oct 16:33", "Lab, reflection", "Dim, glare", "4", "rep-3", "15", "143 to 188", "2 of 15, G22 to G26"],
    ["26 Oct 17:24", "Lab, reflection", "Dim, glare", "2", "rep-3", "3", "182", "2 of 3, G27"],
    ["27 Oct 16:22", "Pipeline test", "Not logged", "n/a", "None", "0", "n/a", "Not a result"],
    ["27 Oct 16:39", "Lab, reflection", "No glare", "4", "rep-3", "3", "95", "3 of 3, G29"],
    ["27 Oct 17:07", "Outside lab", "Dim, glare", "2", "All 7", "21", "93", "1 of 21, only 3 filmed"],
    ["27 Oct 17:32", "Lab, facing", "No glare", "4", "rep-3", "2", "65", "1 of 2, G28"],
    ["27 Oct 17:44", "Lab, reflection", "No glare", "4", "All 7", "21", "59", "20 of 21, G15 to G21"],
    ["30 Oct 18:03", "Room, facing", "No glare", "3", "All 7", "21", "n/a", "None, stopped at 16.7 s"],
    ["30 Oct 18:04", "Room, facing", "No glare", "3", "All 7", "21", "114", "14 of 21, G01 to G07"],
    ["31 Oct 15:03", "Facing", "No glare", "8", "All 7", "21", "142", "9 of 21, G08 to G14"],
    ["6 Nov 02:19", "Room, reflection", "Dim, glare", String(PH.bit_rate), "6 layouts", String(PH.trials), String(PH.threshold), `${got} of ${PH.trials}, physical test`],
  ];
  const { s, top } = content({
    title: "Every recording, in full",
    notes: "Backup for question time. Every recording we made in date order, with where it was, the light, the bit rate, the codes, the number of trials, the calibrated threshold on a 0 to 255 scale and how many frames were delivered. Laptop 1 sends and laptop 2 records. The payload was 16 bits, or 32 on 26 October and in the physical test. The last row is the physical test of the new layouts.",
    secs: 0,
  });
  table(s, ["When", "Where", "Light", "bps", "Codes", "Trials", "Threshold", "Frames delivered"], rows, [1.55, 1.4, 1.0, 0.45, 0.9, 0.6, 1.0, 1.9], top, 0.3, 12);
}

function setupNumbers() {
  const SHORT = { "Facing screen, 3 bps": "Facing, 3 bps", "Facing screen, 8 bps": "Facing, 8 bps", "Reflection, 4 bps": "Reflection, 4 bps",
    "Reflection with glare, 4 bps": "Glare, 4 bps", "Reflection with glare, 2 bps": "Glare, 2 bps" };
  const range = (a, b, d = 1) => (a === b ? a.toFixed(d) : `${a.toFixed(d)} to ${b.toFixed(d)}`);
  const { s, top } = content({
    title: "The setup in numbers",
    take: "At 8 bps the camera gave about 4 samples per bit, at 2 bps about 14.",
    notes: "Backup. The measured conditions per setup, from the saved camera logs. The camera ran at 22 to 30 frames per second, so 8 bits per second gives about 4 samples per bit, 3 and 4 bits per second about 7, and 2 bits per second about 14. That is why we chose those rates. White and black are medians at symbol centres, not thrown off by a few odd frames, with thresholds fixed at calibration. The glare runs in the dim lab had bright blacks of 100 to 126, and their box covered the whole iPad, so room reflections were averaged in.",
    secs: 0,
  });
  s.addChart(pres.charts.BAR, [{ name: "Camera samples per bit", labels: STATS.setup.map((r) => SHORT[r.env]), values: STATS.setup.map((r) => (r.spb_min + r.spb_max) / 2) }], {
    x: M, y: top, w: 4.4, h: 5.12 - top, barDir: "col", barGapWidthPct: 45, chartColors: [X.ink], showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", valAxisMinVal: 0, valAxisMajorUnit: 4,
    ...chartFrame, ...axes("Camera samples per bit"), objectName: "samples per bit chart",
  });
  const rows = STATS.setup.map((r) => [SHORT[r.env], range(r.fps_min, r.fps_max), range(r.thr_min, r.thr_max, 0), `${r.white_med} and ${r.black_med}`]);
  s.addTable([
    ["Setup", "fps", "Threshold", "White, black"].map((t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 } } })),
    ...rows.map((r) => r.map((c, j) => ({ text: c, options: { bold: j === 0 } }))),
  ], {
    x: 5.2, y: top + 0.1, w: 4.2, colW: [1.3, 0.75, 1.0, 1.15], fontFace: "Gill Sans MT", fontSize: 12, color: C.text1, valign: "middle",
    border: { type: "solid", pt: 0.5, color: X.g3 }, rowH: 0.46, margin: [0.02, 0.06, 0.02, 0.06], objectName: "setup table",
  });
}

function headerBits() {
  const fields = [["Version", 8], ["Coding id", 8], ["Repeats", 8], ["Sequence", 8], ["Payload length", 16], ["CRC-16", 16]];
  const total = fields.reduce((t, f) => t + f[1], 0), scale = 8.8 / total;
  const { s, top } = content({
    title: "Header bits and the CRC",
    take: "The header is 64 bits that check themselves, then sent three times.",
    notes: "Backup. The header is six bytes plus a two byte CRC, 64 bits in all. It names the version, the coding scheme, the repeat factor, the sequence number and the payload length, then a CRC-16 over those six bytes. The whole 64 bits are sent as repetition-3, so 192 bits, and with the spread header option the three copies are sent a whole header apart. The payload carries its own CRC-16 as well. Both use polynomial 0x1021 with a start value of 0xFFFF. The coding ids are the numbers in the small table.",
    secs: 0,
  });
  let x = M;
  fields.forEach(([name, bits], i) => {
    const w = bits * scale, last = name === "CRC-16";
    cell(s, x, top + 0.2, w, 0.7, name, { fill: last ? HEX.dk1 : i % 2 ? HEX.accent5 : HEX.lt2, line: HEX.lt1, lw: 1.5, color: last ? C.background1 : C.text1, fs: 16, bold: true, name: `header field ${i + 1}` });
    text(s, `${bits} bits`, { x, y: top + 0.96, w, h: 0.28, fontSize: 14, color: C.text2, align: "center", objectName: `header field ${i + 1} bits` });
    x += w;
  });
  arrow(s, M + 4.4, top + 1.35, M + 4.4, top + 1.7, { color: C.text2, w: 1.5, name: "sent three times arrow" });
  text(s, "sent three times, 192 bits", { x: M + 4.6, y: top + 1.36, w: 3.5, h: 0.3, fontSize: 15, color: C.text2, objectName: "sent three times" });
  for (let i = 0; i < 3; i++) cell(s, M + i * (8.8 / 3), top + 1.8, 8.8 / 3 - 0.06, 0.45, `copy ${i + 1}`, { fill: HEX.accent5, line: HEX.lt2, color: C.text1, fs: 14, name: `header copy ${i + 1}` });
  const ids = [["0", "none"], ["1", "repetition"], ["2", "hamming"], ["3", "hamming-interleaved"], ["4", "parity2d"], ["5", "repetition-spread"], ["6", "hamming-interleaved-16"]];
  text(s, "Coding ids", { x: M, y: top + 2.5, w: 3, h: 0.3, fontSize: 15, bold: true, objectName: "coding ids heading" });
  [ids.slice(0, 4), ids.slice(4)].forEach((col, ci) => {
    text(s, col.map(([i, n], j) => ({ text: `${i}  ${n}`, options: { breakLine: j < col.length - 1, fontFace: FONT.mono } })), { x: M + ci * 2.5, y: top + 2.85, w: 2.5, h: 1.0, fontSize: 12, color: C.text1, objectName: `coding ids ${ci + 1}` });
  });
  text(s, "CRC-16", { x: 6.4, y: top + 2.5, w: 3, h: 0.3, fontSize: 15, bold: true, objectName: "crc heading" });
  text(s, "Polynomial 0x1021, start value 0xFFFF. One CRC covers the header, another the payload.", { x: 6.4, y: top + 2.85, w: 3.0, h: 1.2, fontSize: 15, objectName: "crc text" });
}

function statistics() {
  const rows = [
    ["Wilson interval", "How sure is a frame success rate at 0 of 3 or 3 of 3", "Frame success figures"],
    ["Fisher exact test", "Do two methods or two conditions differ, exact at small counts", "Method comparisons, the physical test"],
    ["Permutation test", "Are errors in runs more than chance, 5000 shuffles of each trial", "Burst share, p below 0.001 in glare"],
    ["BIC", "Flips with no memory against a two-state model, penalising parameters", "Choosing the noise model"],
    ["Trial bootstrap", "BER intervals that resample whole trials, errors in a frame are correlated", "The report tables"],
  ];
  const { s, top } = content({
    title: "Statistics we used",
    notes: "Backup. Wilson intervals for frame success, because the normal interval collapses to a point at 0 of 3 and 3 of 3. Fisher exact tests for comparing methods and conditions, because they stay exact at counts this small. A permutation test for burstiness, scattering each trial's errors uniformly 5000 times and asking how often errors sit in runs of 3 or more by chance. BIC to choose between flips with no memory and the two state Gilbert Elliott model, because it penalises the extra parameters. And a trial level bootstrap for BER intervals, because errors within one frame are correlated, so resampling bits would be too optimistic.",
    secs: 0,
  });
  table(s, ["Method", "What it answers", "Where we used it"], rows, [2.0, 4.4, 2.4], top + 0.1, 0.62, 15);
}

function codeMap() {
  const { s, top } = content({
    title: "Map of the code",
    take: "A screen side, a camera side, and one shared protocol and coding layer.",
    notes: "Backup, for the code walkthrough. cli.py holds the commands. The transmitter draws the patch on the screen, the receiver reads the camera, and both use protocol.py for the frame, the CRC and the sync word. The coding package holds repetition, Hamming, 2-D parity, interleaving and spreading behind one pipeline. The optical package holds calibration, detection and the timing recovery. The experiments package holds the plan, the recording, the analysis, the statistics, the burst model and the simulation, and report slash design sim rebuilds every figure and number from the saved results.",
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

async function build() {
  k.speaker("Both");
  k.section("Appendix");
  sessions();
  setupNumbers();
  headerBits();
  statistics();
  codeMap();
}

module.exports = { build };
