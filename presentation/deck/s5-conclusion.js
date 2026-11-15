"use strict";
// Slides 44 to 49, error against rate, where this fits, what to send, the limits and the questions slide.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, circle, plot, content, divider, chartFrame, axes, note, count, setupKey } = k;

const H2 = (p) => (p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p));

async function tradeoff() {
  const T = STATS.tradeoff.filter((r) => setupKey(r.env) === "n8").sort((a, b) => b.throughput - a.throughput), best = T[0];
  const clean = STATS.tradeoff.filter((r) => setupKey(r.env) === "n4").sort((a, b) => b.throughput - a.throughput)[0];
  const { s, top } = content({
    title: "Throughput against code rate",
    take: `In normal light throughput follows the code rate. At 8 bps ${best.method} delivered the most.`,
    notes: `Throughput is the message bits delivered per second, counting only frames that arrived intact. In normal light at 4 bits per second it follows the code rate, and no coding is fastest at ${clean.throughput.toFixed(3)} bits per second. At 8 bits per second no coding and Hamming delivered nothing, while repetition-7, the slowest code on paper, delivered the most at ${best.throughput.toFixed(3)} because all three frames arrived. With 3 trials this is a trend, not a ranking.`,
  });
  await plot(s, "tradeoff.png", { y: top, maxW: 9.4, maxH: 5.15 - top, name: "throughput against code rate", alt: "Throughput against code rate for every code, in normal light at 4 bps and at 8 bps" });
}

function context() {
  const H2f = H2;
  const order = ["n4", "g2", "n3", "n8", "g4"];
  const names = { n4: "Normal light, 4 bps", g2: "Dim with glare, 2 bps", n3: "Normal light, 3 bps", n8: "Normal light, 8 bps", g4: "Dim with glare, 4 bps" };
  const rows = order.map((key) => STATS.raster.find((r) => setupKey(r.setup) === key));
  const cap = rows.map((r) => 1 - H2f(r.channel_ber));
  const labels = order.map((key) => names[key]);
  k.lineStyle("Hamming rate 0.571", "dash", "none");
  k.lineStyle("rep-3 rate 0.333", "sysDot", "none");
  const { s, top } = content({
    title: "How this links to the module",
    take: `At 8 bps the measured error rate allows a rate of ${cap[3].toFixed(2)}, and Hamming uses ${(4 / 7).toFixed(2)}.`,
    notes: `Capacity is the highest rate any code could reach with reliable decoding, for a channel that flips bits independently. We worked it out from the measured error rate of each setup. At 8 bits per second it is ${cap[3].toFixed(2)}, above the Hamming rate of 0.57, so better codes exist. Glare has memory, so its ${cap[4].toFixed(2)} is pessimistic. The list on the right ties this to the module and beyond. PixNet and COBRA also send data from a screen to a camera.`,
  });
  s.addChart([
    { type: pres.charts.BAR, data: [{ name: "Capacity", labels, values: cap }], options: { chartColors: [X.ink], barGapWidthPct: 50, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00" } },
    { type: pres.charts.LINE, data: [
      { name: "Hamming rate 0.571", labels, values: labels.map(() => 4 / 7) },
      { name: "rep-3 rate 0.333", labels, values: labels.map(() => 1 / 3) },
    ], options: { chartColors: [X.accent, X.g2], lineSize: 2, lineDataSymbol: "none" } },
  ], {
    x: M, y: top, w: 5.0, h: 5.15 - top, showLegend: true, legendPos: "t", valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Capacity, message bits per bit sent", "Setup"), objectName: "capacity chart",
  });
  const sp = [k.setupRow(STATS.setup, "n8").spb_min, k.setupRow(STATS.setup, "g2").spb_min].map((v) => Math.round(v));
  const frameBits = RSTATS.design[k.findKey(RSTATS.design, 8, false)]["rep-3 adjacent"].bits;
  const items = [
    ["Sampling", `At 8 bps we got about ${sp[0]} samples per bit, at 2 bps about ${sp[1]}.`],
    ["Compression", `Only ${DATA.plan.payload_bits} of the ${frameBits} bits we sent for a 2 byte message were the message.`],
    ["Degree", "CRC framing is what Ethernet uses. Our burst model is a Markov chain."],
    ["Beyond the module", "CDs and QR codes use Reed-Solomon codes with interleaving."],
  ];
  items.forEach(([h, b], i) => {
    const y = top + 0.1 + i * 0.86;
    hline(s, 5.9, y - 0.06, 3.5, { name: `context rule ${i + 1}` });
    text(s, h, { x: 5.9, y, w: 3.5, h: 0.26, fontSize: 14, color: C.text2, objectName: `context label ${i + 1}` });
    text(s, b, { x: 5.9, y: y + 0.26, w: 3.5, h: 0.56, fontSize: 14, objectName: `context text ${i + 1}` });
  });
}

function whatToSend() {
  const { s, top } = content({
    title: "What to send for each kind of noise",
    take: "The best code depends on how the errors are arranged, not only how many there are.",
    notes: "On a clean channel we should not code, because extra bits only slowed it down. With isolated flips, repetition works but costs rate, and Hamming can make more errors than no code. 2-D parity is a middle choice that rejects double errors. With bursts, where the redundancy sits matters more than how much there is. Spreading the copies and interleaving helped in simulation. We did not test heavy bursts, and spreading the header cost frames in the physical test.",
  });
  const zones = [
    { w: 2.6, fill: HEX.accent5, ink: C.text1, name: "Clean channel", send: "Do not code", why: "Every code decoded with no errors, so extra bits only slowed it down." },
    { w: 3.0, fill: HEX.lt2, ink: C.text1, name: "Isolated flips", send: "Repetition or 2-D parity", why: "At 8 bps Hamming made more errors than no code at all." },
    { w: 3.2, fill: HEX.accent2, ink: C.background1, name: "Bursts", send: "Spread the copies and interleave", why: "This helped in simulation. We did not test heavy bursts, and spreading the header cost frames." },
  ];
  arrow(s, M, top + 0.3, M + 8.8, top + 0.3, { color: C.text2, w: 1.5, name: "burstiness arrow" });
  text(s, "the errors arrive in longer bursts", { x: M, y: top - 0.1, w: 4, h: 0.3, fontSize: 14, color: C.text2, objectName: "burstiness label" });
  let x = M;
  zones.forEach((z, i) => {
    cell(s, x, top + 0.55, z.w, 0.85, z.name, { fill: z.fill, line: HEX.lt1, lw: 2, color: z.ink, fs: 20, bold: true, name: `zone ${i + 1}` });
    text(s, z.send, { x: x + 0.1, y: top + 1.6, w: z.w - 0.25, h: 0.85, fontSize: 19, bold: true, objectName: `zone ${i + 1} send` });
    text(s, z.why, { x: x + 0.1, y: top + 2.6, w: z.w - 0.25, h: 1.1, fontSize: 15, color: C.text2, objectName: `zone ${i + 1} why` });
    if (i > 0) vline(s, x, top + 1.6, 1.95, { name: `zone divider ${i}` });
    x += z.w;
  });
}

function limits() {
  const { s } = content({
    title: "What worked and what limits us",
    notes: "What worked. Every run was scripted and seeded, we kept failure counts for every result, and we reported every recording, including the failed ones. What limits us. Only 3 trials per method, room light that changed between days, and no test of heavy bursts. Next we would repeat the physical test with stronger glare, find out why the spread header failed, and run at least 10 trials per method.",
  });
  const cols = [
    ["What worked", C.text1, ["Scripted runs with a fixed seed", "Failure counts for every result", "Every recording reported"]],
    ["What limits us", C.accent2, ["Only 3 trials per method", "The room light changed between days", "We did not test heavy bursts"]],
    ["What we would do next", C.text1, ["Test again with stronger glare", "Find out why spread headers failed", "Run 10 or more trials per method"]],
  ];
  const colW = 8.8 / 3;
  cols.forEach(([head, col, items], i) => {
    const x = M + i * colW;
    if (i > 0) vline(s, x - 0.18, 1.4, 3.3, { name: `column rule ${i}` });
    text(s, head, { x, y: 1.4, w: colW - 0.4, h: 0.8, fontSize: 24, bold: true, color: col, fontFace: FONT.head, objectName: `${head} heading` });
    items.forEach((t, j) => {
      const y = 2.3 + j * 0.95;
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
  s.addText("Questions", { placeholder: "title" });
  s.addText([
    { text: "Muhammad Maaz and Kanav Mehta", options: { breakLine: true } },
    { text: "COMP0228 Coursework 1, University College London", options: { fontSize: 14, color: C.accent4 } },
  ], { placeholder: "body" });
  note(s, "Likely questions. Why Hamming made more errors than no code at 8 bps. Why interleaving only helps up to its depth. Why we chose 2-D parity. Whether our numbers are significant, and why only 3 trials. What went wrong in the runs that failed. Why spreading the header cost frames. We can explain any file in the code. The appendix has every recording, every number of the physical test, the statistics we used, a map of the code and the coding ids.");
  count(0);
}

async function build() {
  k.speaker("Kanav");
  divider({ index: 5, title: "Conclusion", sub: "What we learned and where it falls short.",
    notes: "To finish, what we learned and where it falls short." });
  await tradeoff();
  context();
  whatToSend();
  limits();
  questions();
}

module.exports = { build };
