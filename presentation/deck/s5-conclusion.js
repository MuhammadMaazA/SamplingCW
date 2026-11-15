"use strict";
// Slides 42 to 47, the trade-off, the wider context, what to send when, the limits and the questions slide.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, circle, plot, content, divider, chartFrame, axes, note, count } = k;

const H2 = (p) => (p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p));

async function tradeoff() {
  const T = STATS.tradeoff.filter((r) => r.env === "Facing screen, 8 bps"), best = T.sort((a, b) => b.throughput - a.throughput)[0];
  const { s, top } = content({
    title: "Rate against reliability",
    take: `Throughput follows code rate when clean, but at 8 bps ${best.method} moved the most data.`,
    notes: `The headline compromise in one picture. Useful throughput counts only message bits that arrived intact, per second of airtime. On the clean reflection, no coding is fastest at 0.235. At 8 bits per second facing the screen it flips. No coding and Hamming delivered nothing, while repetition-7, the slowest on paper, moved the most data at ${best.throughput.toFixed(3)} because it got all three frames through. With 3 trials this is a trend, not a ranking.`,
    secs: 40,
  });
  await plot(s, "tradeoff.png", { y: top, maxW: 8.8, maxH: 5.12 - top, name: "throughput against code rate", alt: "Useful throughput against code rate for every method, reflection at 4 bps and facing the screen at 8 bps" });
}

function context() {
  // pooled channel error rate of each setup, from the error positions in every analysed group
  const order = ["Reflection, 4 bps", "Glare, 2 bps", "Facing, 3 bps", "Facing, 8 bps", "Glare, 4 bps"];
  const rows = order.map((n) => STATS.raster.find((r) => r.setup === n));
  const cap = rows.map((r) => 1 - H2(r.channel_ber));
  const labels = ["Reflection 4", "Glare 2", "Facing 3", "Facing 8", "Glare 4"];
  k.lineStyle("Hamming rate 0.571", "dash", "none");
  k.lineStyle("rep-3 rate 0.333", "sysDot", "none");
  const { s, top } = content({
    title: "Our work in a wider context",
    take: "Capacity at each setup's error rate sits well above what our simple codes use.",
    notes: `The bars are Shannon capacity at the measured error rate of each setup. At 8 bits per second capacity is ${cap[3].toFixed(2)}, above the Hamming rate of 0.57, so better codes exist and ours sit far from the limit. Glare has memory, so ${cap[4].toFixed(2)} is pessimistic. Sampling explains our speed results, a 2 byte message carries 240 bits of overhead, CRC framing is the Ethernet link layer, and CDs interleave Reed-Solomon the way we interleave Hamming.`,
    secs: 40,
  });
  s.addChart([
    { type: pres.charts.BAR, data: [{ name: "Capacity", labels, values: cap }], options: { chartColors: [X.ink], barGapWidthPct: 50, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00" } },
    { type: pres.charts.LINE, data: [
      { name: "Hamming rate 0.571", labels, values: labels.map(() => 4 / 7) },
      { name: "rep-3 rate 0.333", labels, values: labels.map(() => 1 / 3) },
    ], options: { chartColors: [X.accent, X.g2], lineSize: 2, lineDataSymbol: "none" } },
  ], {
    x: M, y: top, w: 5.5, h: 5.12 - top, showLegend: true, legendPos: "t", valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Capacity, bits per channel bit", "Setup and bit rate"), objectName: "capacity chart",
  });
  const items = [
    ["Sampling", "4 samples per bit at 8 bps smeared edges, 14 at 2 bps did better"],
    ["Compression", "240 of 336 bits are overhead for a 2 byte message"],
    ["Degree", "CRC framing as in Ethernet, Markov chains, DSP next"],
    ["Beyond", "Reed-Solomon in CDs and QR codes, PixNet and COBRA"],
  ];
  items.forEach(([h, b], i) => {
    const y = top + 0.1 + i * 0.86;
    hline(s, 6.3, y - 0.06, 3.1, { name: `context rule ${i + 1}` });
    text(s, h, { x: 6.3, y, w: 3.1, h: 0.26, fontSize: 14, color: C.text2, objectName: `context label ${i + 1}` });
    text(s, b, { x: 6.3, y: y + 0.26, w: 3.1, h: 0.52, fontSize: 15, objectName: `context text ${i + 1}` });
  });
}

function whatToSend() {
  const { s, top } = content({
    title: "What to send when",
    take: "The right code depends on the shape of the noise, not only how much there is.",
    notes: "On a clean channel, do not code. With isolated flips, repetition works but costs rate, and Hamming can backfire, while 2-D parity is a middle ground that rejects double errors. With bursts, where the redundancy sits matters more than how much, so spread the copies, interleave and protect the header. The right code depends on the shape of the noise.",
    secs: 40,
  });
  const zones = [
    { w: 2.6, fill: HEX.accent5, ink: C.text1, name: "Clean", send: "Do not code", why: "Every method reached zero errors, coding only costs rate" },
    { w: 3.0, fill: HEX.lt2, ink: C.text1, name: "Isolated flips", send: "Repetition, or 2-D parity", why: "Hamming can backfire, two flips make a third wrong bit" },
    { w: 3.2, fill: HEX.accent2, ink: C.background1, name: "Bursts", send: "Spread, interleave, protect the header", why: "Simulated, and not yet shown on a harsh real burst" },
  ];
  arrow(s, M, top + 0.3, M + 8.8, top + 0.3, { color: C.text2, w: 1.5, name: "burstiness arrow" });
  text(s, "noise gets burstier", { x: M, y: top - 0.1, w: 3, h: 0.3, fontSize: 14, color: C.text2, objectName: "burstiness label" });
  let x = M;
  zones.forEach((z, i) => {
    cell(s, x, top + 0.55, z.w, 0.85, z.name, { fill: z.fill, line: HEX.lt1, lw: 2, color: z.ink, fs: 22, bold: true, name: `zone ${i + 1}` });
    text(s, z.send, { x: x + 0.1, y: top + 1.6, w: z.w - 0.25, h: 0.85, fontSize: 19, bold: true, objectName: `zone ${i + 1} send` });
    text(s, z.why, { x: x + 0.1, y: top + 2.6, w: z.w - 0.25, h: 0.95, fontSize: 15, color: C.text2, objectName: `zone ${i + 1} why` });
    if (i > 0) vline(s, x, top + 1.6, 1.85, { name: `zone divider ${i}` });
    x += z.w;
  });
}

function limits() {
  const { s } = content({
    title: "Strengths, limits, next steps",
    notes: "Strengths first. A scripted, seeded pipeline, failure counts beside every metric, and every recording reported. Then limits. Only 3 trials per method, conditions that drifted between days, a burst sweep and design study that are simulated, and a physical test that met only mild glare. Next, repeat the test with harsher glare, run ten or more trials, and lock the camera exposure.",
    secs: 40,
  });
  const cols = [
    ["Strengths", C.text1, ["Seeded, scripted runs", "Failure counts everywhere", "Every recording reported"]],
    ["Limits", C.accent2, ["Only 3 trials per method", "Room light drifted between days", "Physical test met mild glare"]],
    ["Next steps", C.text1, ["Repeat in harsher glare", "10 or more trials per method", "Lock the camera exposure"]],
  ];
  const colW = 8.8 / 3;
  cols.forEach(([head, col, items], i) => {
    const x = M + i * colW;
    if (i > 0) vline(s, x - 0.18, 1.4, 3.3, { name: `column rule ${i}` });
    text(s, head, { x, y: 1.4, w: colW - 0.4, h: 0.5, fontSize: 28, bold: true, color: col, fontFace: FONT.head, objectName: `${head} heading` });
    items.forEach((t, j) => {
      const y = 2.2 + j * 0.95;
      hline(s, x, y - 0.1, colW - 0.4, { name: `${head} rule ${j + 1}` });
      text(s, t, { x, y, w: colW - 0.4, h: 0.75, fontSize: 19, objectName: `${head} item ${j + 1}` });
    });
  });
}

function questions() {
  k.speaker("Both");
  const s = pres.addSlide({ masterName: "Title Dark", sectionTitle: "Conclusion" });
  [..."0110100001101001"].forEach((b, i) => {
    cell(s, M + i * 0.37, 0.75, 0.3, 0.3, "", { fill: b === "1" ? HEX.lt1 : HEX.dk1, line: b === "1" ? HEX.lt1 : HEX.dk2, name: `end bit ${i + 1}` });
  });
  text(s, "The same 16 bits, received", { x: M, y: 1.15, w: 6.5, h: 0.28, fontSize: 13, color: C.accent4, objectName: "end bits caption" });
  s.addText("Questions", { placeholder: "title" });
  s.addText([
    { text: "Muhammad Maaz and Kanav Mehta", options: { breakLine: true } },
    { text: "COMP0228 Coursework 1, University College London", options: { fontSize: 14, color: C.accent4 } },
  ], { placeholder: "body" });
  note(s, "Likely questions. Why Hamming is worse than nothing at high noise. Why interleaving only helps up to its depth. Why 2-D parity. Whether the numbers are significant, and why only 3 trials. What went wrong outside the lab, and why the physical test of the new layouts was inconclusive. Be ready to explain any file in the code. The appendix has every recording, the setup numbers, the header bits, the statistics we used and a map of the code.");
  count(0);
}

async function build() {
  k.speaker("Kanav");
  divider({ index: 5, title: "Conclusion", sub: "Error against rate, the wider context, and the limits",
    notes: "To finish, error against rate in one picture, where this sits in the module and beyond, what to send for each kind of noise, and what we would do differently." });
  await tradeoff();
  context();
  whatToSend();
  limits();
  questions();
}

module.exports = { build };
