"use strict";
// The slides that explain how the link was built and run. Each one is a plain diagram of rectangles and hairline
// arrows, and every number on them is read from the code or the data (DATA.code, DATA.hamming_check and so on,
// written by extract_deck_data.py), never typed here.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, DATA, text, hline, vline, arrow, cell, content, chartFrame, axes } = k;

const CODE = DATA.code;

// a rectangle with a bold heading and a grey detail line inside it
function box(s, x, y, w, h, head, detail, o = {}) {
  const runs = [{ text: head, options: { bold: true, fontSize: o.hs ?? 14, color: o.ink ?? C.text1, breakLine: !!detail, fontFace: o.mono ? FONT.mono : undefined } }];
  if (detail) runs.push({ text: detail, options: { fontSize: o.ds ?? 12, color: o.dink ?? C.text2, fontFace: o.dmono ? FONT.mono : undefined } });
  s.addText(runs, {
    shape: SH.RECTANGLE, x, y, w, h, fill: { color: o.fill ?? WHITE }, line: { color: o.line ?? C.text1, width: o.lw ?? 1.25, dashType: o.dash },
    align: "center", valign: "middle", margin: 4, objectName: o.name ?? `${head} box`,
  });
}
// a short grey label next to an arrow or under a picture
function label(s, t, x, y, w, o = {}) {
  text(s, t, { x, y, w, h: o.h ?? 0.26, fontSize: o.fs ?? 12, color: o.color ?? C.text2, align: o.align ?? "center", fontFace: o.mono ? FONT.mono : undefined, bold: o.bold, objectName: o.name ?? `${t} label` });
}
// an arrow that leaves one box, turns twice and ends on the next row, for a chain that wraps
function elbow(s, x1, y1, x2, y2, ymid, o = {}) {
  vline(s, x1, y1, ymid - y1, { color: C.text2, w: 1.25, name: `${o.name ?? "elbow"} down` });
  hline(s, Math.min(x1, x2), ymid, Math.abs(x2 - x1), { color: C.text2, w: 1.25, name: `${o.name ?? "elbow"} across` });
  arrow(s, x2, ymid, x2, y2, { color: C.text2, w: 1.25, name: `${o.name ?? "elbow"} into box` });
}

// a small laptop with a line of words beside it and a hairline under, so the boxes below sit next to the device they run on
function deviceBand(s, y, name, what, o = {}) {
  k.laptop(s, M + 0.08, y + 0.04, 0.6, `${name} drawing`, o);
  text(s, [{ text: name, options: { bold: true, fontSize: 16 } }, { text: `  ${what}`, options: { fontSize: 15, color: C.text2 } }], { x: M + 0.95, y: y + 0.02, w: 7.0, h: 0.4, valign: "middle", objectName: `${name} band` });
  hline(s, M, y + 0.55, 8.8, { name: `${name} band rule` });
}

// ---------- how the transmitter works ----------
function transmitter() {
  const E = CODE.example, T = DATA.plan.symbol_duration, bps = Math.round(1 / T), frameSecs = Math.round(E.frame_bits * T);
  const { s, top } = content({
    title: "How the transmitter works",
    take: "Deadlines count from the start, so display delays do not add up.",
    notes: `The message becomes bytes, we add a CRC, which is a check value, and apply the code. Then we put the sync word and three copies of the header in front. Each bit is shown as one colour, white for 1 and black for 0. Every colour is held until a deadline counted from the start of the frame, so one slow redraw never pushes the later colours back.`,
  });
  deviceBand(s, top - 0.05, "Laptop 1", "runs the transmitter", { patch: true });
  const y = top + 0.65, h = 0.85;
  const xs = [M, 1.975, 3.65, 5.175, 7.9], ws = [1.15, 1.45, 1.3, 2.5, 1.5], mid = y + h / 2;
  box(s, xs[0], y, ws[0], h, "Message", "as bytes", { hs: 15, ds: 13 });
  box(s, xs[1], y, ws[1], h, "Add CRC-16", "a check value", { hs: 15, ds: 13 });
  box(s, xs[2], y, ws[2], h, "Apply the code", "adds extra bits", { hs: 15, ds: 13 });
  const parts = [["sync", 0.55, HEX.dk2, C.background1], ["header ×3", 1.1, HEX.lt2, C.text1], ["data", 0.85, HEX.dk1, C.background1]];
  let px = xs[3];
  parts.forEach(([name, w, fill, ink], i) => {
    cell(s, px, y, w, h, name, { fill, line: HEX.lt1, lw: 1.5, color: ink, fs: 14, bold: true, name: `frame part ${i + 1}` });
    px += w;
  });
  box(s, xs[4], y, ws[4], h, "One colour per bit", "white 1, black 0", { hs: 15, ds: 13 });
  [0, 1, 2, 3].forEach((i) => arrow(s, xs[i] + ws[i] + 0.03, mid, xs[i + 1] - 0.03, mid, { color: C.text2, w: 1.5, name: `transmitter arrow ${i + 1}` }));
  // how big each step is for the 2 byte message of the experiments
  const sizes = [`${E.message_bits} bits`, `${E.protected_bits} bits`, `${E.coded_bits} bits`, `${CODE.sync_bits} + ${CODE.header_coded_bits} + ${E.coded_bits} = ${E.frame_bits} bits`, `${frameSecs} s at ${bps} bps`];
  sizes.forEach((t, i) => label(s, t, xs[i] - (i === 3 ? 0.2 : 0), y + h + 0.06, ws[i] + (i === 3 ? 0.4 : 0), { fs: 13, name: `size after step ${i + 1}` }));
  // the colours of the first byte of the sync word, with the deadline of each one
  const cs = 0.5, pitch = 0.6, sy = top + 2.3;
  [1, 0, 1, 0, 1, 0, 1, 0].forEach((b, i) => cell(s, M + i * pitch, sy, cs, cs, "", { fill: b ? WHITE : HEX.dk1, line: C.text1, lw: 1, name: `colour ${i + 1}` }));
  const ly = sy + cs + 0.14;
  arrow(s, M, ly, M + 8 * pitch + 0.1, ly, { color: C.text2, w: 1, name: "time arrow" });
  for (let i = 0; i <= 8; i++) {
    const tx = M + i * pitch - (i ? 0.05 : 0);
    vline(s, tx, ly - 0.06, 0.12, { color: C.text2, w: 1, name: `deadline tick ${i}` });
    label(s, i === 0 ? "start" : `${i}T`, tx - 0.35, ly + 0.1, 0.7, { name: `deadline ${i}`, fs: 13 });
  }
  text(s, "A late colour does not move the next deadline.", { x: 5.9, y: sy - 0.04, w: 3.5, h: 0.75, fontSize: 17, bold: true, objectName: "deadline point" });
  text(s, [{ text: "T is the time for one bit,", options: { breakLine: true } }, { text: `${T} s at ${bps} bps.` }], { x: 5.9, y: sy + 0.8, w: 3.5, h: 0.55, fontSize: 14, color: C.text2, objectName: "symbol time" });
}

// ---------- how the receiver works ----------
function receiver() {
  const S = STATS.setup, fps = [Math.round(Math.min(...S.map((r) => r.fps_min))), Math.round(Math.max(...S.map((r) => r.fps_max)))];
  const { s, top } = content({
    title: "How the receiver works",
    take: "Each camera frame gives one reading, and the readings give back the message.",
    notes: `Each camera frame gives one number, the median brightness of the box, with its time. We compare it with the threshold to get a bit. We find the sync word, even if up to ${CODE.max_sync_mismatches} of its ${CODE.sync_bits} bits are wrong, then sample each symbol at its centre. Then we vote on the header copies, check the header CRC, decode the payload and check its CRC.`,
  });
  deviceBand(s, top - 0.05, "Laptop 2", "runs the receiver, its webcam films the iPad", { webcam: true, ring: false });
  const bw = 1.55, gap = (8.8 - 5 * bw) / 4, h = 1.0, y1 = top + 0.65, y2 = y1 + h + 0.6;
  const row1 = [["Camera frame", `${fps[0]} to ${fps[1]} a second`], ["Median of the box", "one number, with its time"], ["Compare with the threshold", "brighter means 1"],
    ["Find the sync word", `up to ${CODE.max_sync_mismatches} of ${CODE.sync_bits} bits may be wrong`], ["Sample each symbol centre", "middle of its time slot"]];
  const row2 = [["Vote on the header", `${CODE.header_copies} copies`], ["Check the header CRC", "tries the spread layout too"], ["Decode the payload", "with the code from the header"],
    ["Check the payload CRC", "a bad CRC loses the frame"], ["Message", "the bytes we sent"]];
  [[row1, y1], [row2, y2]].forEach(([row, y], r) => {
    row.forEach(([head, detail], i) => {
      const x = M + i * (bw + gap);
      box(s, x, y, bw, h, head, detail, { name: `receiver step ${r * 5 + i + 1}`, hs: 14, ds: 12, line: r === 1 && i === 4 ? HEX.dk1 : C.text1, lw: r === 1 && i === 4 ? 2 : 1.25 });
      if (i < 4) arrow(s, x + bw + 0.03, y + h / 2, x + bw + gap - 0.03, y + h / 2, { color: C.text2, w: 1.5, name: `receiver arrow ${r * 5 + i + 1}` });
    });
  });
  elbow(s, M + 4 * (bw + gap) + bw / 2, y1 + h, M + bw / 2, y2, y1 + h + 0.3, { name: "receiver wrap" });
}

// ---------- how a code plugs into the link ----------
function plugin() {
  const ids = CODE.coding_ids, isNew = (n) => n === "repetition-spread" || n === "hamming-interleaved-16";
  const { s, top } = content({
    title: "How a code plugs into the link",
    take: "A coding id in the header picks the code, so a new layout is one new entry.",
    notes: `The header carries a coding id from ${ids[0].id} to ${ids[ids.length - 1].id}. Both sides look the id up in one table, and every code offers the same two functions, encode and decode. So adding a layout meant adding an entry. Spread repetition is id 5 and interleaving with depth 16 is id 6. The spread header is a frame option, so it has no id.`,
  });
  const rh = 0.34, ty = top + 0.45, tx = 3.1, idw = 0.5, nw = 2.75;
  box(s, M, ty + (ids.length * rh) / 2 - 0.45, 1.75, 0.9, "Header", `coding id, ${ids[0].id} to ${ids[ids.length - 1].id}`);
  arrow(s, M + 1.78, ty + (ids.length * rh) / 2, tx - 0.05, ty + (ids.length * rh) / 2, { color: C.text2, w: 1.5, name: "header to table" });
  text(s, "Table of codes", { x: tx, y: top + 0.05, w: 3.2, h: 0.32, fontSize: 16, bold: true, objectName: "table heading" });
  ids.forEach((r, i) => {
    const y = ty + i * rh, fresh = isNew(r.name), ink = fresh ? C.accent2 : C.text1, line = fresh ? HEX.accent2 : C.text2;
    cell(s, tx, y, idw, rh, r.id, { fill: WHITE, line, lw: fresh ? 1.5 : 0.75, color: ink, fs: 14, bold: true, font: FONT.mono, name: `code id ${r.id}` });
    cell(s, tx + idw, y, nw, rh, "", { fill: WHITE, line, lw: fresh ? 1.5 : 0.75, name: `code name cell ${r.id}` });
    text(s, r.name, { x: tx + idw + 0.1, y, w: nw - 0.12, h: rh, fontSize: 12, color: ink, fontFace: FONT.mono, valign: "middle", wrap: false, objectName: `code name ${r.id}` });
    if (fresh) text(s, "new", { x: tx + idw + nw - 0.55, y: y + 0.04, w: 0.45, h: 0.26, fontSize: 13, color: C.accent2, bold: true, align: "right", objectName: `new layout ${r.id}` });
  });
  const tmid = ty + (ids.length * rh) / 2, bx = 7.2, bw = 2.2;
  label(s, "transmitter", bx, ty - 0.05, bw, { name: "transmitter side" });
  box(s, bx, ty + 0.2, bw, 0.75, "encode", "message bits in, coded bits out", { hs: 15, mono: true });
  label(s, "receiver", bx, ty + 2.0, bw, { name: "receiver side" });
  box(s, bx, ty + 2.25, bw, 0.75, "decode", "coded bits in, message bits out", { hs: 15, mono: true });
  arrow(s, tx + idw + nw + 0.04, tmid - 0.15, bx - 0.04, ty + 0.575, { color: C.text2, w: 1.5, name: "table to encode" });
  arrow(s, tx + idw + nw + 0.04, tmid + 0.15, bx - 0.04, ty + 2.625, { color: C.text2, w: 1.5, name: "table to decode" });
  text(s, "The spread header is a frame option, not an id.", { x: tx, y: ty + ids.length * rh + 0.12, w: 5.2, h: 0.3, fontSize: 14, color: C.text2, objectName: "spread header note" });
}

// ---------- how we checked the code ----------
function checked() {
  const H = DATA.hamming_check, RT = DATA.round_trip, SIM = DATA.simulation, TS = DATA.tests;
  const sum = (m) => m.reduce((t, r) => t + r.filter(Boolean).length, 0), size = (m) => m.reduce((t, r) => t + r.length, 0);
  const one = [sum(H.singles), size(H.singles)], two = [sum(H.doubles), size(H.doubles)];
  const { s, top } = content({
    title: "How we checked the code",
    take: TS.passed === TS.total ? `We ran our decoder on every case, and all ${TS.total} tests pass.` : `We ran our decoder on every case, and ${TS.passed} of ${TS.total} tests pass.`,
    notes: `We checked the code in four ways, and every number is computed. Our Hamming decoder fixed ${one[0]} of ${one[1]} single flips and ${two[0]} of ${two[1]} double flips. The CRC gives the standard check value ${RT.crc_check}, and ${RT.passed} of ${RT.total} frames decode back, every code with both header layouts. All ${TS.total} automated tests pass, and a simulation of repetition agrees with the theory.`,
  });
  // every codeword with every single flip and every double flip, one square for each run of the real decoder
  const cs = 0.12, pitch = 0.12, gy = top + 0.62, g1 = M, g2 = M + 1.55;
  text(s, "Hamming (7,4), all 16 codewords", { x: M, y: top - 0.02, w: 4.2, h: 0.3, fontSize: 16, bold: true, objectName: "hamming check heading" });
  text(s, "Black is decoded right, red is wrong.", { x: M, y: top + 0.3, w: 4.2, h: 0.26, fontSize: 13, color: C.text2, objectName: "hamming check key" });
  [[H.singles, g1], [H.doubles, g2]].forEach(([m, gx], gi) => m.forEach((row, r) => row.forEach((ok, c) => {
    cell(s, gx + c * pitch, gy + r * pitch, cs, cs, "", { fill: ok ? HEX.dk1 : HEX.accent2, line: WHITE, lw: 1, name: `${gi ? "double" : "single"} flip ${r + 1}.${c + 1}` });
  })));
  const cy = gy + 16 * pitch + 0.1;
  text(s, `${one[0]} of ${one[1]}`, { x: g1, y: cy, w: 1.5, h: 0.3, fontSize: 15, bold: true, fontFace: FONT.mono, objectName: "single flips fixed" });
  text(s, "single flips fixed", { x: g1, y: cy + 0.3, w: 1.5, h: 0.26, fontSize: 13, color: C.text2, objectName: "single flips fixed label" });
  text(s, `${two[0]} of ${two[1]}`, { x: g2, y: cy, w: 2.5, h: 0.3, fontSize: 15, bold: true, fontFace: FONT.mono, color: C.accent2, objectName: "double flips fixed" });
  text(s, "double flips fixed", { x: g2, y: cy + 0.3, w: 2.6, h: 0.26, fontSize: 13, color: C.text2, objectName: "double flips fixed label" });
  // the three plain checks and the simulation
  const rx = 5.05, rw = 4.35, rows = [
    [`${TS.passed} of ${TS.total}`, "automated tests pass"],
    [RT.crc_check, "CRC-16 of 123456789, the standard value"],
    [`${RT.passed} of ${RT.total}`, "frames decode back, every code and header layout"],
  ];
  rows.forEach(([big, small], i) => {
    const y = top - 0.02 + i * 0.52;
    hline(s, rx, y - 0.04, rw, { name: `check rule ${i + 1}` });
    text(s, big, { x: rx, y, w: 1.35, h: 0.4, fontSize: 20, bold: true, fontFace: FONT.mono, valign: "middle", objectName: `check ${i + 1} number` });
    text(s, small, { x: rx + 1.45, y, w: rw - 1.45, h: 0.4, fontSize: 13, color: C.text2, valign: "middle", objectName: `check ${i + 1} text` });
  });
  const sy = top + 1.65;
  hline(s, rx, sy - 0.04, rw, { name: "simulation rule" });
  text(s, `Simulation against theory, ${Math.round(SIM.flip_probability * 100)} percent flips`, { x: rx, y: sy, w: rw, h: 0.3, fontSize: 14, bold: true, objectName: "simulation heading" });
  const names = SIM.rows.map((r) => `rep-${r.factor}`);
  s.addChart(pres.charts.BAR, [
    { name: "Theory", labels: names, values: SIM.rows.map((r) => r.theory) },
    { name: "Simulation", labels: names, values: SIM.rows.map((r) => r.simulated) },
  ], {
    x: rx, y: sy + 0.3, w: rw, h: 5.15 - (sy + 0.3), barDir: "col", barGrouping: "clustered", barGapWidthPct: 35, chartColors: [X.g2, X.ink],
    showLegend: true, legendPos: "t", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", valAxisMinVal: 0, valAxisMaxVal: 0.14, valAxisHidden: true,
    ...chartFrame, valGridLine: { style: "none" }, objectName: "simulation against theory",
  });
}

// ---------- how the new layouts were built into the link ----------
function layoutsFlow() {
  const { s, top } = content({
    title: "How the new layouts fit the link",
    take: "The receiver tries the normal header first, then the spread one.",
    notes: `The receiver does not know the header layout in advance. It reads the ${CODE.header_coded_bits} header bits and tries the normal layout. If the header CRC fails, it undoes the spread and tries again, and the result says which layout worked. In the experiments the plan says which layout was sent, so the analysis passes that in. Frames built the old way still decode.`,
  });
  const bh = 0.8, ax = M, aw = 2.0, bx = 3.45, bw = 2.5, cx = 6.9, cw = 2.5;
  const r1 = top + 0.15, r2 = r1 + 1.25, r3 = r2 + 1.25;
  box(s, ax, r1, aw, bh, "Read the header bits", `${CODE.header_coded_bits} bits after the sync word`, { name: "read header" });
  box(s, bx, r1, bw, bh, "Try the normal layout", "vote, then check the CRC", { name: "try normal layout" });
  box(s, bx, r2, bw, bh, "Try the spread layout", "undo the spread, vote, check", { name: "try spread layout", line: HEX.accent2, lw: 1.5 });
  box(s, cx, r1, cw, bh, "Header found", "reported as normal", { name: "found normal" });
  box(s, cx, r2, cw, bh, "Header found", "reported as spread", { name: "found spread", line: HEX.accent2, lw: 1.5 });
  box(s, bx, r3, bw, bh, "Frame lost", "the header CRC failed twice", { name: "frame lost", ink: C.accent2 });
  arrow(s, ax + aw + 0.03, r1 + bh / 2, bx - 0.03, r1 + bh / 2, { color: C.text2, w: 1.5, name: "read to normal" });
  arrow(s, bx + bw + 0.03, r1 + bh / 2, cx - 0.03, r1 + bh / 2, { color: C.text2, w: 1.5, name: "normal to found" });
  arrow(s, bx + bw + 0.03, r2 + bh / 2, cx - 0.03, r2 + bh / 2, { color: C.text2, w: 1.5, name: "spread to found" });
  arrow(s, bx + bw / 2, r1 + bh + 0.03, bx + bw / 2, r2 - 0.03, { color: C.text2, w: 1.5, name: "normal fails" });
  arrow(s, bx + bw / 2, r2 + bh + 0.03, bx + bw / 2, r3 - 0.03, { color: C.text2, w: 1.5, name: "spread fails" });
  label(s, "CRC passes", bx + bw, r1 + bh / 2 - 0.3, cx - bx - bw, { name: "normal passes" });
  label(s, "CRC passes", bx + bw, r2 + bh / 2 - 0.3, cx - bx - bw, { name: "spread passes" });
  label(s, "CRC fails", bx + bw / 2 + 0.12, r1 + bh + 0.15, 1.0, { align: "left", name: "normal fails label" });
  label(s, "CRC fails", bx + bw / 2 + 0.12, r2 + bh + 0.15, 1.0, { align: "left", name: "spread fails label" });
  text(s, "One flag on the transmitter picks the layout. Frames built the old way still decode.", { x: ax, y: r2 + 0.1, w: 2.5, h: 1.2, fontSize: 14, color: C.text2, objectName: "layout flag note" });
}

// ---------- how we ran an experiment ----------
function experiment() {
  const P = DATA.plan, E = CODE.example, n = P.labels.length, codes = new Set(P.labels).size, per = n / codes;
  const bps = Math.round(1 / P.symbol_duration), frameSecs = Math.round(E.frame_bits * P.symbol_duration);
  const S = STATS.setup, thr = [Math.round(Math.min(...S.map((r) => r.thr_min))), Math.round(Math.max(...S.map((r) => r.thr_max)))];
  const { s, top } = content({
    title: "How we ran an experiment",
    take: `Each session calibrates once, then sends ${n} trials, ${per} for each of ${codes} methods.`,
    notes: `Every session starts with calibration. Laptop 1 shows black, then white, and laptop 2 measures both levels and sets the threshold halfway. Then comes a trial. Laptop 1 flashes one frame, which takes ${frameSecs} seconds at ${bps} bits per second, and laptop 2 records the brightness with a timestamp and decodes it. A session sends the ${codes} methods ${per} times each, in shuffled order. Then we change one thing, the speed or the light, and repeat.`,
  });
  const gap = 0.3, pw = (8.8 - 2 * gap) / 3, px = (i) => M + i * (pw + gap);
  const heads = [["Step 1", "Calibration"], ["Step 2", "A trial"], ["Step 3", "The different methods"]];
  const dy = top + 0.6;
  heads.forEach(([a, b], i) => {
    const x0 = px(i), lw = 0.62, lh = lw * 0.62, iw = 0.32, ih = (1.15 * iw) / 1.05;
    label(s, a, x0, top, pw, { align: "left", name: `step ${i + 1} number`, fs: 13 });
    text(s, b, { x: x0, y: top + 0.2, w: pw, h: 0.34, fontSize: 18, bold: true, objectName: `step ${i + 1} title` });
    if (i) vline(s, x0 - gap / 2, top + 0.05, 3.5, { name: `step rule ${i}` });
    // the same three devices as on the channel slide, small
    k.laptop(s, x0 + 0.12, dy, lw, `laptop 1 step ${i + 1}`, { patch: i === 0 ? true : i === 1 ? "black" : false });
    k.ipad(s, x0 + 1.14, dy + lh / 2 - ih / 2, iw, `iPad step ${i + 1}`, { ring: false });
    k.laptop(s, x0 + 1.82, dy, lw, `laptop 2 step ${i + 1}`, { webcam: true, ring: false });
    arrow(s, x0 + 0.9, dy + lh / 2, x0 + 1.1, dy + lh / 2, { color: C.text2, w: 1.25, name: `step ${i + 1} arrow one` });
    arrow(s, x0 + 1.5, dy + lh / 2, x0 + 1.78, dy + lh / 2, { color: C.text2, w: 1.25, name: `step ${i + 1} arrow two` });
    label(s, "laptop 1", x0 - 0.05, dy + lh + 0.1, 0.9, { name: `step ${i + 1} laptop 1 label`, fs: 12 });
    label(s, "iPad", x0 + 0.99, dy + lh + 0.1, 0.62, { name: `step ${i + 1} ipad label`, fs: 12 });
    label(s, "laptop 2", x0 + 1.7, dy + lh + 0.1, 0.9, { name: `step ${i + 1} laptop 2 label`, fs: 12 });
  });
  const sub = top + 1.38, vy = top + 1.73;
  const captions = ["Laptop 2 measures both and sets the threshold halfway.", "Laptop 2 records brightness and time, then decodes it.", "Then we change the speed or the light and repeat."];
  const subs = ["Laptop 1 shows black, then white", "Laptop 1 flashes one frame", `${per} trials of each method, shuffled`];
  subs.forEach((t, i) => label(s, t, px(i), sub, pw, { align: "left", fs: 13, name: `step ${i + 1} what happens` }));
  // step 1, the brightness scale with the two levels and the threshold halfway
  const x1 = px(0), ay = vy + 0.55;
  hline(s, x1 + 0.1, ay, 2.5, { color: C.text2, w: 1.25, name: "brightness scale" });
  cell(s, x1 + 0.4, ay - 0.1, 0.2, 0.2, "", { fill: HEX.dk1, line: HEX.dk1, name: "black level" });
  cell(s, x1 + 2.1, ay - 0.1, 0.2, 0.2, "", { fill: WHITE, line: C.text1, lw: 1.25, name: "white level" });
  vline(s, x1 + 1.35, vy + 0.22, 0.6, { color: C.text1, w: 1.5, dash: "dash", name: "threshold line" });
  label(s, "threshold", x1 + 0.85, vy - 0.02, 1.0, { fs: 13, color: C.text1, name: "threshold label" });
  label(s, "black", x1 + 0.25, ay + 0.16, 0.5, { fs: 12, name: "black label" });
  label(s, "white", x1 + 1.95, ay + 0.16, 0.5, { fs: 12, name: "white label" });
  label(s, `${thr[0]} to ${thr[1]} on a scale of 0 to 255`, x1, vy + 1.03, pw, { align: "left", fs: 13, name: "threshold range" });
  // step 2, one frame as a row of squares and the brightness laptop 2 records
  const x2 = px(1), cs = 0.26, pitch = 0.31, bits = [1, 0, 1, 0, 1, 0, 1, 0];
  bits.forEach((b, i) => cell(s, x2 + 0.1 + i * pitch, vy - 0.02, cs, cs, "", { fill: b ? WHITE : HEX.dk1, line: C.text1, lw: 1, name: `frame bit ${i + 1}` }));
  const hi = vy + 0.45, lo = vy + 0.72;
  bits.forEach((b, i) => {
    const x = x2 + 0.1 + i * pitch;
    hline(s, x, b ? hi : lo, pitch, { color: C.text1, w: 1.5, name: `brightness ${i + 1}` });
    if (i) vline(s, x, hi, lo - hi, { color: C.text1, w: 1.5, name: `brightness step ${i}` });
  });
  label(s, "brightness over time", x2, lo + 0.04, pw, { align: "left", fs: 12, name: "brightness label" });
  label(s, `${E.frame_bits} bits, ${frameSecs} s at ${bps} bps`, x2, vy + 1.03, pw, { align: "left", fs: 13, name: "frame time" });
  // step 3, the methods as small tokens in the order of the plan
  const x3 = px(2), tw = 0.34, th = 0.26, tp = 0.385, rp = 0.3, short = { none: "U", "rep-3": "r3", "rep-5": "r5", "rep-7": "r7", Ham: "H", "2-D": "2D", "H-int": "HI" };
  P.labels.forEach((l, i) => cell(s, x3 + (i % 7) * tp, vy - 0.02 + Math.floor(i / 7) * rp, tw, th, short[l], { fs: 12, bold: true, name: `method token ${i + 1}` }));
  text(s, [{ text: "U no code, r3 r5 r7 repetition,", options: { breakLine: true } }, { text: "H Hamming, 2D parity, HI interleaved" }], { x: x3, y: vy + 0.88, w: pw, h: 0.42, fontSize: 12, color: C.text2, objectName: "method key" });
  captions.forEach((t, i) => text(s, t, { x: px(i), y: top + 3.07, w: pw, h: 0.5, fontSize: 14, objectName: `step ${i + 1} caption` }));
}

// ---------- the optional clip ----------
// Only built when presentation/media/demo.mp4 exists, and it follows the picture of how an experiment runs
async function demo() {
  if (!k.HAS_DEMO) return;
  const clip = require("./demo"), info = clip.probe(k.DEMO);
  const { s, top } = content({
    title: "Demonstration of one run",
    take: "We calibrate, send a short message and decode it.",
    notes: "This is a short recording of one run. First we calibrate with black and then white, then laptop 1 sends a short message, and laptop 2 decodes it.",
    secs: Math.round(info.secs + 6), fixed: true,
  });
  const h = Math.min(5.15 - top, (8.8 * info.h) / info.w), w = (h * info.w) / info.h;
  s.addMedia({ type: "video", path: k.DEMO, x: (10 - w) / 2, y: top, w, h, cover: await clip.poster(k.DEMO, info), objectName: "demonstration clip" });
}

module.exports = { transmitter, receiver, plugin, checked, layoutsFlow, experiment, demo };
