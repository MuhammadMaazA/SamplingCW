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
    take: "Throughput is the message bits delivered per second. In normal light it follows the code rate.",
    notes: `Throughput counts only frames that arrived intact. In normal light at 4 bits per second it follows the code rate, and no coding is fastest at ${clean.throughput.toFixed(3)} bits per second. At 8 bits per second no coding and Hamming delivered nothing, while repetition-7, the slowest code on paper, delivered the most at ${best.throughput.toFixed(3)} because all three frames arrived. With 3 trials this is a trend, not a ranking.`,
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
    notes: `Capacity is the highest rate any code could reach with reliable decoding, for a channel that flips bits independently. We worked it out from the measured error rate of each setup. At 8 bits per second it is ${cap[3].toFixed(2)}, above the Hamming rate of 0.57, so better codes exist. Glare has memory, so its ${cap[4].toFixed(2)} is pessimistic. PixNet and COBRA also send data from a screen to a camera.`,
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
    notes: "On a clean channel we should not code, because extra bits only slowed it down. With isolated flips, repetition works but costs rate, and Hamming can make more errors than no code. 2-D parity rejects double errors. With bursts, where the redundancy sits matters more than how much there is. We did not test heavy bursts, and spreading the header cost frames in the layout test.",
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
  const N = RSTATS.noise, GL = N[k.findKey(N, 4, true)], share = Math.round(GL.burst_share * 100);
  const { s } = content({
    title: "What we can and cannot claim",
    notes: `In glare ${share} percent of errors come in runs of 3 or more, and at 8 bits per second Hamming made more errors than no code. Spreading the copies and interleaving worked in simulation. We have not shown whether spreading helps against heavy bursts, because the glare in the layout test was mild, or why the spread header lost frames. With 3 trials per method we do not rank the codes. Next we will repeat the layout test in stronger glare with more trials.`,
  });
  const cols = [
    ["What the data supports", [`In glare ${share} percent of errors come in runs of 3 or more`, "At 8 bps Hamming made more errors than no code", "Spreading the copies and interleaving worked in simulation"]],
    ["What it does not show yet", ["Whether spreading helps against heavy bursts, because the glare in the layout test was mild", "Why the spread header lost frames", "A ranking of the codes, because we had 3 trials per method"]],
  ];
  const colW = 4.2;
  cols.forEach(([head, items], i) => {
    const x = M + i * (colW + 0.4);
    if (i > 0) vline(s, x - 0.2, 1.3, 3.2, { name: "column rule" });
    text(s, head, { x, y: 1.3, w: colW, h: 0.45, fontSize: 22, bold: true, fontFace: FONT.head, objectName: `${head} heading` });
    items.forEach((t2, j) => {
      const y = 1.95 + j * 0.88;
      hline(s, x, y - 0.1, colW, { name: `${head} rule ${j + 1}` });
      text(s, t2, { x, y, w: colW, h: 0.78, fontSize: 16, objectName: `${head} item ${j + 1}` });
    });
  });
  hline(s, M, 4.68, 8.8, { name: "next rule" });
  text(s, "Next we will repeat the layout test in stronger glare with more trials.", { x: M, y: 4.74, w: 8.8, h: 0.4, fontSize: 18, bold: true, objectName: "next line" });
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
  note(s, "Likely questions. Why Hamming made more errors than no code at 8 bps. Why interleaving only helps up to its depth. Whether our numbers are significant. Why spreading the header cost frames. We can explain any file in the code.");
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
