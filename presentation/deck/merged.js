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
    notes: `This slide shows the structure of one frame for our two byte message, which has ${total} bits. It begins with the ${SYNC} bit sync word, which marks the start. Next comes the header with ${HEADER} bits, made of three copies of 64 bits, and then the ${payload} bit payload, which is the message with its own check value. The red bracket shows that ${over} of the ${total} bits are overhead. The lower row shows one copy of the header, which ends with a CRC. A CRC is a cyclic redundancy check, a 16 bit check value, and if the receiver calculates a different value, the header is discarded.`,
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
    take: `One glare recording: ${(glareKey.wrong_side_share * 100).toFixed(1)} percent of its symbols are on the wrong side.`,
    notes: `This slide shows what the camera measures over time. Charts a and b show the brightness over thirty seconds, in normal light above and in one glare frame below. The grey bands are white symbols, the dashed line is the threshold and the red ticks are errors. In normal light there are no errors, but in that glare frame the brightness sags after each white flash and this window contains ${w47} errors. Charts c and d show the brightness at the centre of each symbol. In normal light the two groups are far apart, so only ${(cleanKey.wrong_side_share * 100).toFixed(2)} percent of symbols fall on the wrong side. Chart d shows one glare recording, not all of them, and in it ${(glareKey.wrong_side_share * 100).toFixed(1)} percent of the symbols fall on the wrong side. Across the five dim runs the channel error rate ranged from 7.3 to 31.5 percent.`,
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
    notes: `This slide shows two kinds of noise. On the left, each row is one trial and each tick is a wrong bit, with the setups stacked by channel BER. At 8 bits per second the wrong bits mostly occur on their own, whereas in glare they come in bursts of up to ${STATS.noise_regimes.longest_burst} bits. On the right, a run is several wrong bits in a row, and the dashed lines show what independent flips would give. In glare, ${pct(GL.burst_share, 0)} percent of errors lie in runs of 3 or more, compared with ${pct(GL.burst_share_null, 0)} percent for independent flips, and a shuffle test gives a p value, the chance of such a result arising by luck, below 0.001. At 8 bits per second the figure is ${pct(F8.burst_share)} percent.`,
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
    notes: `This slide shows the three changes that we made. The left charts show the frames delivered, and the right charts show the channel BER. In the first panel the speed rises from 3 to 8 bits per second, and the frames delivered fall from ${fr(sf.a)} to ${fr(sf.b)}. These two sessions were on different days. In the second panel the light is dimmer, and at 4 bits per second the frames delivered fall from ${fr(li.a)} to ${fr(li.b)}, with channel BER between ${lo} and ${hi} percent. The glare runs only used repetition 3, so the fair comparison is ${r3ok} against ${fr(li.b)}. In the third panel the speed falls to 2 bits per second in glare, which delivered ${fr(sg.b)} frames, and channel BER fell to ${g27} percent.`,
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
    notes: `This slide shows which planned trials failed and why. The left chart counts the ${total} planned trials, where black means that the frame decoded correctly. In glare, ${glare.header_crc_failures} of ${glare.trials} frames failed the header CRC. At 8 bits per second, ${fast.payload_crc_failures} of ${fast.trials} failed the payload CRC, and at 3 bits per second ${slow.truncated} frames were cut short. Two runs failed because of our own mistakes. In one session we recorded in a different place at ${O.bit_rate} bits per second, and the plan needed ${(O.planned_s / 60).toFixed(0)} minutes but we stopped after ${(O.recorded_s / 60).toFixed(0)}, so only 3 of ${O.trials} trials were filmed. In the other, laptop 1 was started with the codes in a different order, so ${B.differ} of ${n} trials did not match.`,
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
    notes: `This slide compares a clean channel with a noisy one. The left panel shows normal light at 4 bits per second, where each bar is the delivery rate, and uncoded transmission is the highest at ${T[0].throughput.toFixed(3)}. Every code decoded with zero errors, so the delivery rate follows the code rate, and the extra bits only slow the link down. The right panel shows 8 bits per second, where each bar is the decoded BER, the share of errors left after decoding. Uncoded transmission scores ${F.none.decoded_ber.toFixed(3)} and Hamming scores ${F.Hamming.decoded_ber.toFixed(3)}, because two flips in one codeword make Hamming flip a third bit that was correct.`,
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
    notes: `This slide explains why the order of the bits matters. In the top row, a burst of 3 bits meets copies that sit side by side, so it takes all three copies of bit a, and the vote goes wrong. With spread repetition, the whole message is sent three times in a row, so the same burst flips at most one copy of each bit. The bottom row shows interleaving, which means sending the bits in a shuffled order. If we send one codeword at a time, a burst of 8 wipes out most of one codeword. If we send one column at a time, each codeword takes only one hit, and Hamming corrects it. We chose depth 8 because ${pct(DATA.glare_runs.share_le8, 0)} percent of our glare error runs were 8 bits or shorter.`,
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
    notes: `This slide presents our simulations, which we ran because our recorded runs gave too few frames to compare the layouts. On the left, up to ${zeroTo} bits of burst, depth 8 makes no errors, whereas plain Hamming already fails at ${firstFail}. From ${zeroTo + 1} bits some codewords take two hits, and beyond ${cross} bits interleaving does worse. On the right, the bars show the share of payloads that decode for nine layouts, each simulated with 3000 frames. With copies side by side, more copies make things worse, giving ${D["rep-3 adjacent"].payload.toFixed(3)}, ${D["rep-5 adjacent"].payload.toFixed(3)} and ${D["rep-7 adjacent"].payload.toFixed(3)} for 3, 5 and 7 copies. Spreading the copies gives ${D["rep-3 spread"].payload.toFixed(3)} with three copies and ${D["rep-7 spread"].payload.toFixed(2)} with seven, and spreading the header raised whole frame success from ${pct(H.frame)} to ${pct(HS.frame)} percent.`,
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
    notes: `This slide shows the layout test, which was one recorded session in which we sent six layouts through the link, two as first built and four that use the new layouts. We sent ${per} trials of each, ${n} in all, over ${mins} minutes. In each row a black square is a delivered frame and a red square is a lost frame, followed by the count out of ${per}, a 95 percent interval, the Fisher p value against the baseline, and the channel BER, the bit error rate. The baselines are repetition 3 and depth 8, and p is the chance of a gap this large if the layout made no difference. The counts ran from ${lo} to ${hi}, and the four p values are ${stats[1].fisher_p.toFixed(2)}, ${stats[2].fisher_p.toFixed(2)}, ${stats[4].fisher_p.toFixed(2)} and ${stats[5].fisher_p.toFixed(2)}. Channel BER stayed between ${(R.ranges.channel_ber[0] * 100).toFixed(1)} and ${(R.ranges.channel_ber[1] * 100).toFixed(1)} percent, because the glare was mild.`,
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
