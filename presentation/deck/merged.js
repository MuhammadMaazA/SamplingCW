"use strict";
// Slides that join two earlier slides into one. Each one reads left to right or top to bottom, and each has one takeaway line.
// The pictures that come from make_merged.py live in deck/figs. Everything else is drawn here from the data.
const path = require("path");
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, plot, content, chartFrame, axes, findKey, setupKey, setupRow } = k;
const { label } = require("./built");

const FIGS = path.join(__dirname, "figs");
const pct = (x, d = 1) => (x * 100).toFixed(d);

// Hamming (7,4) with even parity at positions 1 to 7, the same arrangement as src/gridlink/coding/hamming.py
function hammingWord(data) {
  const code = [0, 0, 0, 0, 0, 0, 0, 0];
  [3, 5, 6, 7].forEach((pos, i) => { code[pos] = data[i]; });
  [1, 2, 4].forEach((p) => { code[p] = [1, 2, 3, 4, 5, 6, 7].filter((q) => q & p).reduce((t, q) => t + code[q], 0) % 2; });
  return code.slice(1);
}

// ---------- the frame and the header ----------
function frameAndHeader() {
  const SYNC = 48, HEADER = 192; // bits, from src/gridlink/protocol.py, SYNC_BITS and HEADER_CODED_BITS
  const total = RSTATS.design[findKey(RSTATS.design, 8, false)]["rep-3 adjacent"].bits;
  const payload = total - SYNC - HEADER, over = SYNC + HEADER;
  const fields = [["Version", 8], ["Coding id", 8], ["Repeats", 8], ["Sequence", 8], ["Payload length", 16], ["CRC-16", 16]];
  const { s, top } = content({
    title: "One message is one frame",
    take: `The sync word and header take ${over} of ${total} bits, and a CRC checks the header.`,
    notes: `The top bar is one whole frame for a two byte message, ${total} bits, read from left to right. A ${SYNC} bit sync word marks the start, and the header, which says which code we used, is sent three times, so it takes ${HEADER} bits. The payload is the message with its own check value. So ${over} of the ${total} bits are overhead, and if the header is lost the whole frame goes. Below is one copy of the header, with the version, the code we used, the repeats, the frame number, the payload length and a CRC. A CRC is a 16 bit check value worked out from the other fields. The receiver works it out again, and if it differs, the header is thrown away.`,
  });
  const scale = 8.8 / total, y = top + 0.5, h = 0.75;
  const segs = [
    ["Sync word", SYNC, HEX.dk2, "start marker", `${SYNC} bits`, C.background1],
    ["Header", HEADER, HEX.lt2, "which code was used", `${HEADER} bits, three copies of 64`, C.text1],
    ["Payload and check value", payload, HEX.dk1, "the message", `${payload} bits, three copies of 32`, C.background1],
  ];
  let x = M;
  segs.forEach(([name, bits, fill, role, cap, ink], i) => {
    const w = bits * scale;
    cell(s, x, y, w, h, name, { fill, line: HEX.lt1, lw: 1.5, color: ink, fs: i === 0 ? 13 : 17, font: FONT.semi, name: `frame segment ${i + 1}` });
    const tw = i === 0 ? w + 0.3 : Math.max(w - 0.2, 1.9), tx = x + (i === 0 ? 0 : 0.15);
    text(s, role, { x: tx, y: y + h + 0.06, w: tw, h: 0.28, fontSize: 14, fontFace: FONT.semi, objectName: `frame segment ${i + 1} role` });
    text(s, cap, { x: tx, y: y + h + 0.34, w: tw, h: 0.26, fontSize: 13, color: C.text2, objectName: `frame segment ${i + 1} caption` });
    x += w;
  });
  const bx = M + over * scale;
  hline(s, M, y - 0.2, over * scale, { color: C.accent2, w: 1.25, name: "overhead bracket" });
  vline(s, M, y - 0.2, 0.12, { color: C.accent2, w: 1.25, name: "overhead bracket left" });
  vline(s, bx, y - 0.2, 0.12, { color: C.accent2, w: 1.25, name: "overhead bracket right" });
  text(s, `${over} bits before the payload`, { x: M, y: y - 0.52, w: over * scale, h: 0.3, fontSize: 16, fontFace: FONT.semi, color: C.accent2, align: "center", objectName: "overhead label" });
  // inside the header
  const hy = top + 1.98;
  hline(s, M, hy, 8.8, { name: "header rule" });
  text(s, "Inside the header, 64 bits. If the CRC comes out different, the receiver throws the header away.", { x: M, y: hy + 0.08, w: 8.8, h: 0.3, fontSize: 14, color: C.text2, objectName: "crc note" });
  const fw = 6.6, fs = fw / 64, fy = hy + 0.48;
  let fx = M;
  fields.forEach(([name, bits], i) => {
    const w = bits * fs, last = name === "CRC-16";
    cell(s, fx, fy, w, 0.55, name, { fill: last ? HEX.dk1 : i % 2 ? HEX.accent5 : HEX.lt2, line: HEX.lt1, lw: 1.5, color: last ? C.background1 : C.text1, fs: 12, bold: true, name: `header field ${i + 1}` });
    text(s, `${bits} bits`, { x: fx, y: fy + 0.6, w, h: 0.24, fontSize: 12, color: C.text2, align: "center", objectName: `header field ${i + 1} bits` });
    fx += w;
  });
  const cx = 7.5;
  text(s, "Sent three times", { x: cx, y: hy + 0.42, w: 1.95, h: 0.26, fontSize: 13, bold: true, objectName: "sent three times" });
  for (let i = 0; i < 3; i++) cell(s, cx, hy + 0.72 + i * 0.28, 1.9, 0.24, `copy ${i + 1}`, { fill: HEX.accent5, line: HEX.lt2, color: C.text1, fs: 12, name: `header copy ${i + 1}` });
}

// ---------- what the camera sees, the traces and the levels ----------
async function camera() {
  const L = STATS.levels, glareKey = L.glare_c ?? Object.values(L)[1], cleanKey = L.reflect4 ?? Object.values(L)[0];
  const w47 = STATS.traces[1].errors_in_window;
  const { s, top } = content({
    title: "What the camera sees",
    take: `In glare ${(glareKey.wrong_side_share * 100).toFixed(1)} percent of symbols fall on the wrong side of the threshold.`,
    notes: `On the left is brightness over thirty seconds, and on the right is a histogram of the brightness at the centre of each symbol, with normal light on top and the dim room with glare below. At the start of a session we show black, then white, and set the threshold halfway between them. In normal light the two levels are far apart, so only ${(cleanKey.wrong_side_share * 100).toFixed(2)} percent of symbols land on the wrong side. In glare the brightness drops after each white flash and climbs back, so the levels overlap, ${(glareKey.wrong_side_share * 100).toFixed(1)} percent land on the wrong side, and this window has ${w47} errors. That overlap is where the errors come from.`,
  });
  const p = await plot(s, "fig-camera.png", { full: path.join(FIGS, "fig-camera.png"), x: 0.3, y: top - 0.05, maxW: 9.4, maxH: 4.98 - top, name: "brightness traces and levels", alt: "Camera brightness over 30 seconds and the brightness at symbol centres, in normal light and in dim light with glare, with the threshold and the bit errors marked" });
  text(s, "Grey bands are white sent, the dashed line is the threshold, red ticks are bit errors.", { x: M, y: p.y + p.h + 0.02, w: 8.0, h: 0.24, fontSize: 12, color: C.text2, objectName: "camera key" });
}

// ---------- two kinds of noise and the runs of wrong bits ----------
async function noise() {
  const N = RSTATS.noise, GL = N[findKey(N, 4, true)], F8 = N[findKey(N, 8, false)];
  const { s, top } = content({
    title: "Two kinds of noise",
    take: `At 8 bps most errors are alone. In glare ${pct(GL.burst_share, 0)} percent are in runs of 3 or more.`,
    notes: `On the left every row is one trial and every mark is a wrong bit, grouped by setup. At 8 bits per second the wrong bits mostly sit on their own. In glare they come in bursts, up to ${STATS.noise_regimes.longest_burst} bits long. On the right we measure that. A run is several wrong bits in a row, and the dashed lines are what independent flips would give. In glare ${pct(GL.burst_share, 0)} percent of errors are in runs of 3 or more, against ${pct(GL.burst_share_null, 0)} percent for independent flips, and a shuffle test gives p below 0.001. At 8 bits per second it's ${pct(F8.burst_share)} percent.`,
  });
  await plot(s, "fig-noise.png", { full: path.join(FIGS, "fig-noise.png"), x: 0.3, y: top - 0.05, maxW: 9.4, maxH: 5.12 - top, name: "error positions in every trial and error run lengths", alt: "Error positions in every trial, and the share of error runs by length against the independent flip expectation" });
}

// ---------- the three changes ----------
async function changes() {
  const CH = STATS.changes, fr = (o) => `${o.frames} of ${o.trials}`;
  const sf = CH["speed-normal"] ?? CH["speed-facing"] ?? CH.speed, li = CH.lighting, sg = CH["speed-glare"];
  const glare = li.b.channel_ber_pct, lo = Math.min(...glare).toFixed(1), hi = Math.max(...glare).toFixed(1);
  const g27 = sg.b.channel_ber_pct[0].toFixed(1);
  const r3 = STATS.tradeoff.find((r) => setupKey(r.env) === "n4" && r.method === "rep-3");
  const r3ok = r3 ? r3.ok.replace("/", " of ") : "3 of 3";
  const { s, top } = content({
    title: "Three changes we made",
    take: "Going faster or dimmer lost frames. Going slower in glare may have helped.",
    notes: `We changed one thing at a time, and the panels go from left to right. First the speed in normal light. At 3 bits per second we delivered ${fr(sf.a)} frames, and at 8 bits per second ${fr(sf.b)}. At 8 there are only about 4 samples per bit, so a white flash carries into the next bit. The two sessions were on different days, so speed may not be the only difference. Second, the light. At 4 bits per second we delivered ${fr(li.a)} frames in normal light and only ${fr(li.b)} in the dim room with glare, where channel BER was between ${lo} and ${hi} percent. The dim runs only used repetition 3, so the fair comparison is ${r3ok} against ${fr(li.b)}. Third, halving the speed in glare gave ${fr(sg.b)} frames, and channel BER fell to ${g27} percent. That might be more samples per bit or milder glare that day, and one session can't tell us. Okay, I'll hand over to Kanav now.`,
  });
  const pw = 2.95, px = (i) => 0.4 + i * 3.2;
  const panels = [
    ["Faster, 3 to 8 bps", `In normal light, frames delivered fell from ${fr(sf.a)} to ${fr(sf.b)}.`, "At 8 bps only about 4 samples per bit, so a white flash carries over."],
    ["Dimmer, with glare", `At 4 bps, channel BER rose to between ${lo} and ${hi} percent. Frames delivered fell from ${fr(li.a)} to ${fr(li.b)}.`, "Glare raises the black level after each white flash."],
    ["Slower, 4 to 2 bps", `In glare, frames delivered rose from ${fr(sg.a)} to ${fr(sg.b)}, and channel BER fell to ${g27} percent.`, "More samples per bit, or milder glare that day."],
  ];
  panels.forEach(([head, saw, why], i) => {
    text(s, head, { x: px(i), y: top - 0.04, w: pw, h: 0.3, fontSize: 15, bold: true, objectName: `change ${i + 1} title` });
    if (i) vline(s, px(i) - 0.12, top, 3.45, { name: `change rule ${i}` });
    text(s, [{ text: "What we saw  ", options: { bold: true, color: C.text2, fontSize: 12, breakLine: true } }, { text: saw, options: { breakLine: true } },
      { text: "Likely reason  ", options: { bold: true, color: C.text2, fontSize: 12, breakLine: true } }, { text: why }], { x: px(i), y: top + 2.15, w: pw - 0.05, h: 1.4, fontSize: 13, objectName: `change ${i + 1} text` });
  });
  await plot(s, "fig-changes.png", { full: path.join(FIGS, "fig-changes.png"), x: 0.3, y: top + 0.18, maxW: 9.4, name: "three changes", alt: "For each of the three changes, frames delivered with Wilson intervals and channel BER per group" });
}

// ---------- the frames that were lost and the runs that failed ----------
function lostAndFailed() {
  const F = DATA.failures, O = DATA.outside_lab, B = DATA.ordering_bug, n = B.expected.length;
  const total = F.reduce((t, r) => t + r.trials, 0);
  const glare = setupRow(F, "g4", "display"), fast = setupRow(F, "n8", "display"), slow = setupRow(F, "n3", "display");
  const { s, top } = content({
    title: "Lost frames and failed runs",
    take: `In glare ${glare.header_crc_failures} of ${glare.trials} frames fail the header CRC. Two failed runs were our fault.`,
    notes: `Thanks Maaz. On the left is what happened to each of the ${total} planned trials, black being a frame that decoded correctly. In the dim room with glare, ${glare.header_crc_failures} of ${glare.trials} frames failed the header CRC, so the payload code never got used. At 8 bits per second ${fast.payload_crc_failures} of ${fast.trials} failed the payload CRC, and at 3 bits per second ${slow.truncated} frames were cut short when the recording ended. On the right are runs that went wrong, two of them our own fault. In one session we recorded in a different place at ${O.bit_rate} bits per second. The plan needed ${(O.planned_s / 60).toFixed(0)} minutes but we stopped after ${(O.recorded_s / 60).toFixed(0)}, so only 3 of ${O.trials} trials were filmed. In another, the command that started laptop 1 listed the codes in a different order, so ${B.differ} of ${n} trials didn't match. A third run stopped on a repeated timestamp.`,
  });
  const labels = F.map((r) => r.display), maxTrials = Math.max(...F.map((r) => r.trials));
  const series = [
    ["Delivered", "valid_frames", X.ink, X.white], ["Payload CRC failed", "payload_crc_failures", X.accent, X.white],
    ["Header CRC failed", "header_crc_failures", X.tint2, X.ink], ["Uncorrectable", "uncorrectable", X.g1, X.white],
    ["Cut short", "truncated", X.g2, X.ink], ["Sync word not found", "sync_failures", X.g3, X.ink],
  ];
  const cx = M, cy = top, cw = 5.1, ch = 2.3;
  const lay = { x: 0.5, y: 0.03, w: 0.48, h: 0.94 };
  s.addChart(pres.charts.BAR, series.map(([name, key]) => ({ name, labels, values: F.map((r) => r[key]) })), {
    x: cx, y: cy, w: cw, h: ch, barDir: "bar", barGrouping: "stacked", barGapWidthPct: 40, chartColors: series.map((x) => x[2]),
    showLegend: false, catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: maxTrials, valAxisMajorUnit: 3, valAxisHidden: true,
    layout: lay, ...chartFrame, objectName: "frame loss chart",
  });
  const px = cx + lay.x * cw, pw = lay.w * cw, py = cy + lay.y * ch, band = (lay.h * ch) / F.length, unit = pw / maxTrials;
  F.forEach((r, i) => {
    let cum = 0;
    series.forEach(([name, key, , ink]) => {
      const v = r[key];
      if (v > 0) text(s, [{ text: String(v), options: { fontFace: FONT.mono } }], { x: px + (cum + v / 2) * unit - 0.3, y: py + (i + 0.5) * band - 0.12, w: 0.6, h: 0.24, fontSize: 12, bold: true, color: ink, align: "center", valign: "middle", objectName: `${labels[i]} ${name} count` });
      cum += v;
    });
  });
  const ly = cy + ch + 0.05;
  series.forEach(([name, , fill], i) => {
    const lx = M + (i % 2) * 2.45, lyy = ly + Math.floor(i / 2) * 0.25;
    cell(s, lx, lyy + 0.05, 0.18, 0.15, "", { fill, line: fill === X.g3 ? X.g2 : fill, name: `legend ${name}` });
    text(s, name, { x: lx + 0.26, y: lyy, w: 2.1, h: 0.25, fontSize: 12, color: C.text2, valign: "middle", objectName: `legend ${name} label` });
  });
  text(s, "A third run stopped after 16.7 s when the camera repeated timestamps.", { x: M, y: top + 3.12, w: 4.9, h: 0.45, fontSize: 13, color: C.text2, objectName: "timestamp note" });
  // the runs that failed
  const rx = 5.75, rw = 3.65;
  vline(s, rx - 0.2, top, 3.5, { name: "failure divider" });
  text(s, `A different place, ${O.bit_rate} bps`, { x: rx, y: top - 0.04, w: rw, h: 0.3, fontSize: 15, fontFace: FONT.semi, objectName: "airtime head" });
  s.addChart(pres.charts.BAR, [{ name: "Minutes", labels: ["Planned", "Recorded"], values: [O.planned_s / 60, O.recorded_s / 60] }], {
    x: rx, y: top + 0.26, w: rw, h: 1.4, barDir: "bar", barGapWidthPct: 40, chartColors: [X.g2, X.accent], catAxisOrientation: "maxMin",
    showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", valAxisMinVal: 0, valAxisMaxVal: 70, valAxisMajorUnit: 20,
    ...chartFrame, ...axes("Minutes of recording"), objectName: "airtime chart",
  });
  text(s, `Only 3 of ${O.trials} trials were filmed`, { x: rx, y: top + 1.7, w: rw, h: 0.28, fontSize: 14, color: C.accent2, fontFace: FONT.semi, objectName: "airtime verdict" });
  hline(s, rx, top + 2.1, rw, { name: "failure rule" });
  text(s, "A command in the wrong order", { x: rx, y: top + 2.16, w: rw, h: 0.3, fontSize: 15, fontFace: FONT.semi, objectName: "order head" });
  const cw2 = 0.15, cg = 0.02, cp = cw2 + cg;
  text(s, "The trial order laptop 2 expected", { x: rx, y: top + 2.46, w: rw, h: 0.24, fontSize: 12, color: C.text2, objectName: "order strip label" });
  B.expected.forEach((l, i) => {
    const bad = B.expected[i] !== B.sent[i];
    cell(s, rx + i * cp, top + 2.72, cw2, 0.32, "", { fill: bad ? HEX.accent2 : WHITE, line: bad ? HEX.accent2 : C.text2, name: `planned trial ${i + 1}` });
  });
  text(s, `${B.differ} of ${n} trials, in red, were sent at a different position.`, { x: rx, y: top + 3.08, w: rw, h: 0.45, fontSize: 13, color: C.accent2, fontFace: FONT.semi, objectName: "order verdict" });
}

// ---------- the clean channel and the high noise at 8 bps ----------
function normalLight() {
  const T = STATS.tradeoff.filter((r) => setupKey(r.env) === "n4").sort((a, b) => b.throughput - a.throughput);
  const NAME = { none: "uncoded", "Ham-interl.": "Ham-int", "2-D parity": "2-D parity" };
  const F = RSTATS.fast;
  const order = ["none", "rep-3", "rep-5", "rep-7", "Hamming", "2-D parity", "Ham-interl."];
  const NAME8 = { none: "uncoded", "Ham-interl.": "Ham-int" };
  const { s, top } = content({
    title: "Clean channel against high noise",
    take: `At 8 bps Hamming made more errors than no code, ${F.Hamming.decoded_ber.toFixed(3)} against ${F.none.decoded_ber.toFixed(3)}.`,
    notes: `The left panel is the clean case, normal light at 4 bits per second, with all seven codes. Every code decoded with zero errors, even with no code at all, so delivery rate, the message bits delivered per second, follows the code rate and extra bits only slow things down. Hamming looks low because one frame lost its header, which is a lost frame, not a bit error. The right panel is the same test at 8 bits per second, with only about 4 samples per bit. Labels show how many of 3 frames each code delivered. Hamming did badly because two flips in one codeword make it flip a third bit that was fine, so its decoded BER, ${F.Hamming.decoded_ber.toFixed(3)}, is worse than sending nothing, ${F.none.decoded_ber.toFixed(3)}.`,
  });
  text(s, "Normal light at 4 bps, 3 trials per code", { x: M, y: top - 0.04, w: 4.1, h: 0.3, fontSize: 14, bold: true, objectName: "clean heading" });
  s.addChart(pres.charts.BAR, [{ name: "Delivery rate", labels: T.map((r) => NAME[r.method] ?? r.method), values: T.map((r) => r.throughput) }], {
    x: M, y: top + 0.26, w: 4.1, h: 2.4, barDir: "bar", barGapWidthPct: 35, catAxisOrientation: "maxMin", chartColors: [X.ink], showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", valAxisMinVal: 0, valAxisMaxVal: 0.3, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0.0",
    ...chartFrame, ...axes("Delivery rate, message bits per second"), objectName: "clean channel delivery rate",
  });
  text(s, "0", { x: M, y: top + 2.72, w: 0.55, h: 0.8, fontSize: 54, bold: true, fontFace: FONT.head, valign: "middle", objectName: "zero callout" });
  text(s, "decoded errors for every code, the uncoded one included", { x: M + 0.6, y: top + 2.75, w: 3.5, h: 0.72, fontSize: 14, color: C.text2, valign: "middle", objectName: "zero callout label" });
  vline(s, 4.9, top, 3.5, { name: "panel rule" });
  const x0 = 5.1, w0 = 4.3;
  text(s, "Normal light at 8 bps, 3 trials per code", { x: x0, y: top - 0.04, w: w0, h: 0.3, fontSize: 14, bold: true, objectName: "noisy heading" });
  s.addChart(pres.charts.BAR, [{ name: "Decoded BER", labels: order.map((m) => `${NAME8[m] ?? m}, ${F[m].ok} of ${F[m].trials} frames`), values: order.map((m) => F[m].decoded_ber) }], {
    x: x0, y: top + 0.26, w: w0, h: 2.25, barDir: "bar", barGapWidthPct: 35, catAxisOrientation: "maxMin",
    chartColors: order.map((m) => (m === "Hamming" ? X.accent : m === "none" ? X.g2 : X.ink)), showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", valAxisMinVal: 0, valAxisMaxVal: 0.1, valAxisMajorUnit: 0.03, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Decoded errors per bit"), objectName: "high noise decoded ber",
  });
  const sent = hammingWord([1, 0, 1, 1]), got = sent.slice(), flips = [0, 4];
  flips.forEach((i) => { got[i] ^= 1; });
  const syn = [1, 2, 4].reduce((t, c) => t + ((([1, 2, 3, 4, 5, 6, 7].filter((q) => q & c).reduce((a, q) => a + got[q - 1], 0) % 2) ? c : 0)), 0);
  const fixed = got.slice();
  fixed[syn - 1] ^= 1;
  const size = 0.19, pitch = 0.2, gx = 1.5, y = top + 2.62;
  [["Sent", sent, []], ["Two bits flipped", got, flips], ["After Hamming", fixed, fixed.map((b, i) => (b !== sent[i] ? i : -1)).filter((i) => i >= 0)]].forEach(([lab, row, bad], r) => {
    const x = x0 + r * gx;
    text(s, lab, { x, y, w: gx, h: 0.24, fontSize: 12, color: C.text2, objectName: `${lab} label` });
    row.forEach((b, i) => cell(s, x + i * pitch, y + 0.26, size, size, b, { fill: bad.includes(i) ? HEX.accent2 : WHITE, line: bad.includes(i) ? HEX.accent2 : C.text2, color: bad.includes(i) ? C.background1 : C.text1, bold: bad.includes(i), fs: 12, name: `${lab} bit ${i + 1}` }));
  });
  text(s, "Two flips become three wrong bits", { x: x0, y: y + 0.52, w: w0, h: 0.26, fontSize: 13, bold: true, color: C.accent2, objectName: "flip verdict" });
}

// ---------- why the order of the bits matters, copies and interleaving ----------
function order() {
  const { s, top } = content({
    title: "Why the order of the bits matters",
    take: "The same bits in a new order, so one burst cannot wipe out a bit or a codeword.",
    notes: `Both rows show a burst hitting bits that sit next to each other. In the top row a burst of 3 bits hits three copies of a bit. With plain repetition the copies sit side by side, so one burst flips all of them and the vote goes wrong. Spread repetition sends the whole message three times in a row, so the burst flips at most one copy of each bit and the vote still works. The bottom row is interleaving, which means sending the bits in a shuffled order. On the left we send one codeword at a time, so a burst of 8 wipes out one codeword and Hamming can't fix it. On the right we send one column at a time across 8 codewords, so each codeword takes one hit and Hamming fixes it. We chose depth 8 because ${pct(DATA.glare_runs.share_le8, 0)} percent of our glare error runs were 8 bits or shorter.`,
  });
  const size = 0.3, pitch = 0.35;
  [{ name: "Copies side by side", sub: "as first built", seq: "aaabbbccc", x: M, out: "Bit a loses all three copies, so it is wrong.", bad: true },
   { name: "Copies spread apart", sub: "the new layout", seq: "abcabcabc", x: 5.1, out: "Each bit keeps two of its three copies, so all are right.", bad: false }].forEach((r, ri) => {
    const y = top + 0.06;
    text(s, [{ text: r.name, options: { bold: true, fontSize: 15, color: ri ? C.accent2 : C.text1 } }, { text: `   ${r.sub}`, options: { fontSize: 12, color: C.text2 } }], { x: r.x, y: top - 0.04, w: 4.3, h: 0.3, objectName: `${r.name} head` });
    hline(s, r.x, y + 0.5, 3 * pitch - 0.05, { color: C.accent2, w: 1.5, name: `${r.name} burst bracket` });
    text(s, "burst of 3 bits", { x: r.x, y: y + 0.24, w: 1.5, h: 0.24, fontSize: 12, color: C.accent2, objectName: `${r.name} burst label` });
    [...r.seq].forEach((ch, i) => cell(s, r.x + i * pitch, y + 0.56, size, size, ch, { fill: i < 3 ? HEX.accent2 : WHITE, line: i < 3 ? HEX.accent2 : C.text2, color: i < 3 ? C.background1 : C.text1, bold: i < 3, fs: 14, name: `${r.name} ${i + 1}` }));
    text(s, r.out, { x: r.x, y: y + 0.92, w: 4.3, h: 0.45, fontSize: 13, fontFace: FONT.semi, color: r.bad ? C.accent2 : C.text1, objectName: `${r.name} outcome` });
  });
  vline(s, 4.9, top, 1.45, { name: "copies rule" });
  hline(s, M, top + 1.55, 8.8, { name: "row rule" });
  const cw = 0.2, chh = 0.155, px = 0.225, py = 0.19, gy = top + 2.05;
  [["Sent one codeword at a time", M, (r, c) => r * 7 + c < 8, "7 errors in one codeword, which Hamming cannot fix", true],
   ["Sent one column at a time", 5.1, (r, c) => c === 0, "1 error in each codeword, which Hamming fixes", false]].forEach(([lab, gx, hit, verdict, bad]) => {
    text(s, lab, { x: gx, y: top + 1.65, w: 4.3, h: 0.3, fontSize: 15, fontFace: FONT.semi, objectName: `${lab} label` });
    for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
      const on = hit(r, c);
      cell(s, gx + c * px, gy + r * py, cw, chh, "", { fill: on ? HEX.accent2 : WHITE, line: on ? HEX.accent2 : HEX.lt2, name: `${lab} r${r + 1} c${c + 1}` });
    }
    text(s, verdict, { x: gx + 1.8, y: gy + 0.4, w: 2.5, h: 0.7, fontSize: 14, fontFace: FONT.semi, color: bad ? C.accent2 : C.text1, objectName: `${lab} verdict` });
  });
  vline(s, 4.9, top + 1.65, 1.4, { name: "grids rule" });
}

// ---------- the simulations, bursts and where the copies go ----------
function simulations() {
  const B = RSTATS.controlled_burst, ham = B.Hamming, il = B["Hamming-interleaved"], rep = B["repetition-3"];
  const L = ham.map((_, i) => String(i + 1));
  const firstFail = ham.findIndex((v) => v > 0) + 1;
  const zeroTo = il.findIndex((v) => v > 0);
  const cross = il.findIndex((v, i) => v > ham[i]) + 1;
  k.lineStyle("Hamming", "solid", "circle");
  k.lineStyle("Hamming-interleaved", "dash", "square");
  k.lineStyle("repetition-3", "sysDot", "triangle");
  const D = RSTATS.design[findKey(RSTATS.design, 4, true)];
  const keys = ["rep-3 adjacent", "rep-5 adjacent", "rep-7 adjacent", "rep-3 spread", "rep-7 spread", "Hamming", "Ham-int d4", "Ham-int d8", "Ham-int d16"];
  const labels = ["rep-3 side by side", "rep-5 side by side", "rep-7 side by side", "rep-3 spread apart", "rep-7 spread apart", "Hamming", "Hamming depth 4", "Hamming depth 8", "Hamming depth 16"];
  const H = D["header adjacent"], HS = D["header spread"];
  const { s, top } = content({
    title: "Simulating bursts and layouts",
    take: `Depth 8 fixes bursts up to ${zeroTo} bits. Spreading raises rep-3 from ${pct(D["rep-3 adjacent"].payload, 0)} to ${pct(D["rep-3 spread"].payload, 0)} percent.`,
    notes: `Both panels are simulations, because our recorded runs gave too few frames to compare Hamming with interleaving, and in those runs we saw no difference. On the left, each point is 400 trials with a 64 bit payload. Up to ${zeroTo} bits of burst, depth 8 makes no errors, while plain Hamming already fails at ${firstFail}. From ${zeroTo + 1} bits some codewords take two hits, and past ${cross} interleaving does worse. On the right we sent 3000 whole frames per layout through the two-state glare model. With copies side by side, more copies makes things worse, because longer runs make longer bursts. Spreading the copies gives ${D["rep-3 spread"].payload.toFixed(3)} with three copies and ${D["rep-7 spread"].payload.toFixed(2)} with seven. Spreading the header raised whole frame success from ${pct(H.frame)} to ${pct(HS.frame)} percent.`,
  });
  s.addChart(pres.charts.LINE, [
    { name: "Hamming", labels: L, values: ham },
    { name: "Hamming-interleaved", labels: L, values: il },
    { name: "repetition-3", labels: L, values: rep },
  ], {
    x: M, y: top - 0.04, w: 4.35, h: 2.85, chartColors: [X.ink, X.accent, X.g2], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 5,
    showLegend: true, legendPos: "t", valAxisMinVal: 0, valAxisMaxVal: 0.2, valAxisMajorUnit: 0.05, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Decoded errors per bit", "Burst length in bits, 400 trials per point"), objectName: "burst sweep chart",
  });
  s.addChart(pres.charts.BAR, [{ name: "Payload success", labels, values: keys.map((key) => D[key].payload) }], {
    x: 5.1, y: top - 0.04, w: 4.3, h: 2.85, barDir: "bar", barGapWidthPct: 30, catAxisOrientation: "maxMin",
    chartColors: [X.g2, X.g2, X.g2, X.accent, X.accent, X.ink, X.ink, X.ink, X.accent], showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisMajorUnit: 0.5, valAxisLabelFormatCode: "0.0",
    ...chartFrame, ...axes("Share of payloads that decode correctly"), objectName: "placement chart",
  });
  vline(s, 4.9, top, 2.8, { name: "simulation rule" });
  text(s, `Simulated. From ${zeroTo + 1} bits some codewords take two hits, and past ${cross} bits interleaving does worse.`, { x: M, y: top + 2.85, w: 4.1, h: 0.62, fontSize: 12, color: C.text2, objectName: "burst sweep note" });
  text(s, `Spreading the header lifted header survival from ${pct(H.header, 0)} to ${pct(HS.header, 0)} percent and whole frame survival from ${pct(H.frame, 0)} to ${pct(HS.frame, 0)} percent. Two state model fitted to our glare data, 3000 frames per layout.`, { x: 5.1, y: top + 2.85, w: 4.3, h: 0.62, fontSize: 12, color: C.text2, objectName: "placement caption" });
}

// ---------- the layout test, the squares, the counts and the p values ----------
function layoutTest() {
  const PH = DATA.physical, R = RSTATS.physical, n = PH.trials, per = PH.layouts[0].valid.length, mins = Math.round(PH.planned_s / 60);
  const [lo, hi] = R.ranges.frames, pmin = Math.floor(R.ranges.fisher_p[0] * 10) / 10;
  const stats = Object.values(R.layouts);
  const { s, top } = content({
    title: "The layout test had 72 trials",
    take: `Frames delivered ranged from ${lo} to ${hi} of ${per}, and no comparison gave p below ${pmin.toFixed(1)}.`,
    notes: `By the layout test we mean one recorded session where we sent six layouts through the link, two as first built and four that use the new layouts, ${per} trials of each, ${n} in all, in ${mins} minutes. Reading each row from left to right, every square is one trial, black if the frame was delivered and red if it was lost, then the count out of ${per} and a 95 percent interval. For each new layout we worked out p against its baseline, the chance of a gap this big if the layout made no difference, with repetition 3 and depth 8 as the baselines. The four p values are ${stats[1].fisher_p.toFixed(2)}, ${stats[2].fisher_p.toFixed(2)}, ${stats[4].fisher_p.toFixed(2)} and ${stats[5].fisher_p.toFixed(2)}. None is small enough to count. Channel BER stayed low because the glare was mild.`,
  });
  const cs = 0.19, pitch = 0.215, x0 = 2.85, rp = 0.42, y0 = top + 0.4;
  const cx = x0 + per * pitch + 0.1, ix = 6.4, iw = 1.2, px = 7.8, bx = 8.65;
  [["Each square is one trial", x0, 2.5], ["Delivered", cx, 0.85], ["95% interval", ix, iw], ["Fisher p vs baseline", px, 0.85], ["Channel BER", bx, 0.8]].forEach(([t, x, w], i) => text(s, t, { x, y: top - 0.06, w, h: 0.42, fontSize: 12, color: C.text2, valign: "bottom", objectName: `column head ${i + 1}` }));
  PH.layouts.forEach((l, ri) => {
    const y = y0 + ri * rp, st = stats[ri];
    hline(s, M, y - 0.03, 8.8, { color: HEX.accent5, name: `layout row rule ${ri + 1}` });
    text(s, l.label, { x: M, y, w: 2.15, h: rp - 0.06, fontSize: 13, valign: "middle", objectName: `${l.label} row label` });
    l.valid.forEach((ok, ci) => cell(s, x0 + ci * pitch, y + (rp - 0.06 - cs) / 2, cs, cs, "", { fill: ok ? HEX.dk1 : HEX.accent2, line: ok ? HEX.dk1 : HEX.accent2, name: `${l.label} trial ${ci + 1}` }));
    text(s, `${l.valid.filter(Boolean).length} of ${l.valid.length}`, { x: cx, y, w: 0.85, h: rp - 0.06, fontSize: 14, fontFace: FONT.semi, valign: "middle", objectName: `${l.label} count` });
    const my = y + (rp - 0.06) / 2;
    hline(s, ix + st.frames_ci[0] * iw, my, (st.frames_ci[1] - st.frames_ci[0]) * iw, { color: C.text1, w: 2.25, name: `${l.label} interval` });
    cell(s, ix + (st.ok / st.trials) * iw - 0.06, my - 0.06, 0.12, 0.12, "", { fill: HEX.dk1, line: HEX.dk1, name: `${l.label} interval dot` });
    text(s, st.fisher_p === undefined ? "baseline" : st.fisher_p.toFixed(2), { x: px, y, w: 0.85, h: rp - 0.06, fontSize: 14, fontFace: FONT.semi, color: st.fisher_p === undefined ? C.text2 : C.text1, valign: "middle", objectName: `${l.label} p value` });
    text(s, `${(st.channel_ber * 100).toFixed(1)}%`, { x: bx, y, w: 0.8, h: rp - 0.06, fontSize: 14, valign: "middle", objectName: `${l.label} channel ber` });
  });
  const ey = y0 + PH.layouts.length * rp + 0.05;
  [0, 0.5, 1].forEach((v) => {
    vline(s, ix + v * iw, y0, PH.layouts.length * rp - 0.05, { color: HEX.lt2, w: 0.5, dash: "dash", name: `interval guide ${v}` });
    text(s, v === 0 ? "0" : v === 1 ? "100%" : "50%", { x: ix + v * iw - 0.3, y: ey, w: 0.6, h: 0.22, fontSize: 12, color: C.text2, align: "center", objectName: `interval tick ${v}` });
  });
  cell(s, x0, ey + 0.05, 0.16, 0.14, "", { fill: HEX.dk1, line: HEX.dk1, name: "legend delivered" });
  text(s, "frame delivered", { x: x0 + 0.24, y: ey, w: 1.4, h: 0.24, fontSize: 12, color: C.text2, objectName: "legend delivered label" });
  cell(s, x0 + 1.6, ey + 0.05, 0.16, 0.14, "", { fill: HEX.accent2, line: HEX.accent2, name: "legend lost" });
  text(s, "frame lost", { x: x0 + 1.84, y: ey, w: 1.0, h: 0.24, fontSize: 12, color: C.text2, objectName: "legend lost label" });
  text(s, "p is the chance of a gap this big if the layout made no difference.", { x: M, y: ey + 0.3, w: 8.8, h: 0.24, fontSize: 12, color: C.text2, objectName: "p footnote" });
}

module.exports = { hammingWord, frameAndHeader, camera, noise, changes, lostAndFailed, normalLight, order, simulations, layoutTest };
