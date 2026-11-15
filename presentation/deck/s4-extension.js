"use strict";
// The extension, spread copies and interleaving, the simulations and the layout test.
const k = require("./kit");
const built = require("./built");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, plot, content, divider, chartFrame, axes, findKey } = k;

const pct = (x, d = 1) => (x * 100).toFixed(d);

function neighbours() {
  const { s, top } = content({
    title: "Neighbouring copies fail together",
    take: "A burst of 3 bits flips all three copies of a bit when the copies sit side by side.",
    notes: "With plain repetition the three copies of a bit sit next to each other, so one burst can flip all of them and the vote goes wrong. Spread repetition sends the whole message three times in a row. A burst shorter than the message flips at most one copy of each bit, so the vote still works. Only the order changes.",
  });
  const size = 0.58, gap = 0.07, pitch = size + gap, x0 = 3.45;
  const rows = [
    { name: "Copies side by side", sub: "as we first built it", seq: "aaabbbccc", y: top + 0.72, out: "Bit a loses all three copies, so it is wrong.", bad: true },
    { name: "Copies spread apart", sub: "the new layout", seq: "abcabcabc", y: top + 2.3, out: "Each bit keeps two of its three copies, so all are right.", bad: false },
  ];
  rows.forEach((r, ri) => {
    text(s, r.name, { x: M, y: r.y - 0.02, w: 2.75, h: 0.34, fontSize: 17, fontFace: FONT.semi, color: ri === 1 ? C.accent2 : C.text1, objectName: `${r.name} head` });
    text(s, r.sub, { x: M, y: r.y + 0.34, w: 2.6, h: 0.3, fontSize: 14, color: C.text2, objectName: `${r.name} sub` });
    [...r.seq].forEach((ch, i) => cell(s, x0 + i * pitch, r.y, size, size, ch, { fill: i < 3 ? HEX.accent2 : WHITE, line: i < 3 ? HEX.accent2 : C.text2, color: i < 3 ? C.background1 : C.text1, bold: i < 3, fs: 20, name: `${r.name} ${i + 1}` }));
    hline(s, x0, r.y - 0.12, 3 * pitch - gap, { color: C.accent2, w: 1.5, name: `${r.name} burst bracket` });
    text(s, "burst of 3 bits", { x: x0, y: r.y - 0.42, w: 3 * pitch, h: 0.28, fontSize: 14, color: C.accent2, objectName: `${r.name} burst label` });
    text(s, r.out, { x: x0, y: r.y + size + 0.1, w: 5.95, h: 0.3, fontSize: 16, fontFace: FONT.semi, color: r.bad ? C.accent2 : C.text1, objectName: `${r.name} outcome` });
  });
}

function interleaving() {
  const { s, top } = content({
    title: "Interleaving",
    take: "Same bits and rate in a different order. An 8 bit burst now hits each codeword once.",
    notes: `Interleaving means sending the bits in a shuffled order. We send the Hamming bits one column at a time across 8 codewords, so a burst of up to 8 bits hits each codeword once and Hamming fixes every one. We chose depth 8 because ${pct(DATA.glare_runs.share_le8, 0)} percent of our glare error runs were 8 bits or shorter. Depth 16 handles bursts of up to 16 bits. In our recorded runs we saw no difference from plain Hamming.`,
  });
  const cs = 0.27, gap = 0.03, pitch = cs + gap, gy = top + 0.5;
  [["Sent one codeword at a time", 1.1, (r, c) => r * 7 + c < 8, "7 errors in one codeword, which Hamming cannot fix", true],
   ["Sent one column at a time", 5.7, (r, c) => c === 0, "1 error in each codeword, which Hamming fixes", false]].forEach(([label, gx, hit, verdict, bad]) => {
    text(s, label, { x: gx - 0.3, y: top + 0.05, w: 3.7, h: 0.34, fontSize: 18, fontFace: FONT.semi, objectName: `${label} label` });
    for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
      const on = hit(r, c);
      cell(s, gx + c * pitch, gy + r * pitch, cs, cs, "", { fill: on ? HEX.accent2 : WHITE, line: on ? HEX.accent2 : HEX.lt2, name: `${label} r${r + 1} c${c + 1}` });
    }
    text(s, verdict, { x: gx - 0.3, y: gy + 8 * pitch + 0.08, w: 3.9, h: 0.55, fontSize: 16, fontFace: FONT.semi, color: bad ? C.accent2 : C.text1, objectName: `${label} verdict` });
  });
}

function burstSweep() {
  const B = RSTATS.controlled_burst, ham = B.Hamming, il = B["Hamming-interleaved"], rep = B["repetition-3"];
  const L = ham.map((_, i) => String(i + 1));
  const firstFail = ham.findIndex((v) => v > 0) + 1;
  const zeroTo = il.findIndex((v) => v > 0);
  const cross = il.findIndex((v, i) => v > ham[i]) + 1;
  k.lineStyle("Hamming", "solid", "circle");
  k.lineStyle("Hamming-interleaved", "dash", "square");
  k.lineStyle("repetition-3", "sysDot", "triangle");
  const { s, top } = content({
    title: "Bursts of up to 8 bits",
    take: `In simulation depth 8 fixes bursts up to ${zeroTo} bits. Plain Hamming fails from ${firstFail} bits.`,
    notes: `Our recorded glare runs gave too few frames to compare Hamming with interleaving, so we simulated bursts of a length we chose. Each point is 400 trials with a 64 bit payload. Depth 8 makes no errors up to ${zeroTo} bits, while plain Hamming already fails at ${firstFail} bits. From ${zeroTo + 1} bits some codewords take two hits, and past ${cross} bits interleaving does worse.`,
  });
  s.addChart(pres.charts.LINE, [
    { name: "Hamming", labels: L, values: ham },
    { name: "Hamming-interleaved", labels: L, values: il },
    { name: "repetition-3", labels: L, values: rep },
  ], {
    x: M, y: top, w: 8.8, h: 5.15 - top - 0.35, chartColors: [X.ink, X.accent, X.g2], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 5,
    showLegend: true, legendPos: "t", valAxisMinVal: 0, valAxisMaxVal: 0.2, valAxisMajorUnit: 0.05, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Decoded errors per bit", "Burst length in bits, 400 trials per point"), objectName: "burst sweep chart",
  });
  text(s, `Simulated. From ${zeroTo + 1} bits some codewords take two hits, and past ${cross} bits interleaving does worse.`, { x: M, y: 4.84, w: 8.0, h: 0.3, fontSize: 14, color: C.text2, objectName: "burst sweep note" });
}

function placement() {
  const D = RSTATS.design[k.findKey(RSTATS.design, 4, true)];
  const keys = ["rep-3 adjacent", "rep-5 adjacent", "rep-7 adjacent", "rep-3 spread", "rep-7 spread", "Hamming", "Ham-int d4", "Ham-int d8", "Ham-int d16"];
  const labels = ["rep-3 side by side", "rep-5 side by side", "rep-7 side by side", "rep-3 spread apart", "rep-7 spread apart", "Hamming", "Hamming depth 4", "Hamming depth 8", "Hamming depth 16"];
  const H = D["header adjacent"], HS = D["header spread"];
  const { s, top } = content({
    title: "Spreading helps more than copies",
    take: `In simulation, spreading the copies raised correct payloads from ${pct(D["rep-3 adjacent"].payload, 0)} to ${pct(D["rep-3 spread"].payload, 0)} percent.`,
    notes: `We simulated 3000 whole frames per layout on the two-state model fitted to our glare data. With the copies side by side, adding copies makes it worse, because longer runs make longer bursts. Spreading the copies gives ${D["rep-3 spread"].payload.toFixed(3)} with three copies and ${D["rep-7 spread"].payload.toFixed(2)} with seven. Spreading the header raised whole frame success from ${pct(H.frame)} to ${pct(HS.frame)} percent. This ranks the designs and does not predict exact rates.`,
  });
  s.addChart(pres.charts.BAR, [{ name: "Payload success", labels, values: keys.map((key) => D[key].payload) }], {
    x: M, y: top, w: 5.7, h: 5.15 - top - 0.3, barDir: "bar", barGapWidthPct: 35, catAxisOrientation: "maxMin",
    chartColors: [X.g2, X.g2, X.g2, X.accent, X.accent, X.ink, X.ink, X.ink, X.accent], showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Share of payloads that decode correctly"), objectName: "placement chart",
  });
  s.addChart(pres.charts.BAR, [
    { name: "Header together", labels: ["Header survives", "Whole frame survives"], values: [H.header, H.frame] },
    { name: "Header spread", labels: ["Header survives", "Whole frame survives"], values: [HS.header, HS.frame] },
  ], {
    x: 6.5, y: top, w: 2.9, h: 5.15 - top - 0.3, barDir: "col", barGrouping: "clustered", barGapWidthPct: 40, chartColors: [X.g2, X.accent],
    showLegend: true, legendPos: "t", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0%", valAxisMinVal: 0, valAxisMaxVal: 0.3, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0%",
    ...chartFrame, ...axes("Share of frames"), objectName: "header chart",
  });
  text(s, "Simulated on the two-state model fitted to our glare data, 3000 frames per layout.", { x: M, y: 4.88, w: 8.0, h: 0.28, fontSize: 13, color: C.text2, objectName: "placement caption" });
}

function threeLayouts() {
  const { s, top } = content({
    title: "The three new layouts",
    take: "Each layout changes only the order in which the same bits are sent.",
    notes: "These are the three layouts we added to the transmitter and the receiver. Spread repetition sends the whole message three times in a row. Depth 16 mixes 16 Hamming codewords instead of 8, so a burst of up to 16 bits hits each codeword once. The spread header sends its three copies a whole header apart. The next slides test them.",
  });
  const row = (i) => top + 0.05 + i * 1.18;
  const cs = 0.3, gp = 0.04, pitch = cs + gp, dx = 5.0;
  const item = (i, name, desc) => {
    hline(s, M, row(i) - 0.06, 8.8, { name: `layout ${i + 1} rule` });
    text(s, name, { x: M, y: row(i), w: 3.9, h: 0.32, fontSize: 18, fontFace: FONT.semi, objectName: `layout ${i + 1} name` });
    text(s, desc, { x: M, y: row(i) + 0.36, w: 3.9, h: 0.7, fontSize: 14, color: C.text2, objectName: `layout ${i + 1} text` });
  };
  const letters = (seq, y, label) => {
    [...seq].forEach((ch, i) => cell(s, dx + i * pitch, y, cs, cs, ch, { fs: 14, name: `${label} ${i + 1}` }));
  };
  item(0, "Spread repetition", "The whole message is sent three times in a row, instead of each bit three times.");
  letters("aaabbbccc", row(0) + 0.08, "side by side");
  text(s, "side by side", { x: dx + 9 * pitch + 0.1, y: row(0) + 0.08, w: 1.6, h: cs, fontSize: 13, color: C.text2, valign: "middle", objectName: "side by side label" });
  letters("abcabcabc", row(0) + 0.58, "spread");
  text(s, "spread apart", { x: dx + 9 * pitch + 0.1, y: row(0) + 0.58, w: 1.6, h: cs, fontSize: 13, color: C.accent2, valign: "middle", objectName: "spread apart label" });
  item(1, "Interleaving with depth 16", "Sixteen Hamming codewords are mixed instead of eight, so a burst of up to 16 bits hits each codeword once.");
  [[8, "depth 8", row(1) + 0.08], [16, "depth 16", row(1) + 0.58]].forEach(([n, lab, y]) => {
    for (let i = 0; i < n; i++) cell(s, dx + i * 0.22, y, 0.19, cs, "", { fill: n === 16 ? HEX.accent2 : WHITE, line: n === 16 ? HEX.accent2 : C.text2, name: `${lab} codeword ${i + 1}` });
    text(s, lab, { x: dx + 16 * 0.22 + 0.1, y, w: 1.2, h: cs, fontSize: 13, color: n === 16 ? C.accent2 : C.text2, valign: "middle", objectName: `${lab} label` });
  });
  item(2, "Spread header", "The three copies of the header are sent a whole header apart.");
  [["h1h1h1h2h2h2", "side by side", row(2) + 0.08, C.text2], ["h1h2h1h2h1h2", "spread apart", row(2) + 0.58, C.accent2]].forEach(([seq, lab, y, col], ri) => {
    const parts = seq.match(/h\d/g);
    parts.forEach((p, i) => cell(s, dx + i * 0.5, y, 0.45, cs, p, { fs: 13, name: `${lab} ${i + 1}` }));
    text(s, lab, { x: dx + 6 * 0.5 + 0.1, y, w: 1.6, h: cs, fontSize: 13, color: col, valign: "middle", objectName: `header ${lab} label` });
  });
}

function physicalGrid() {
  const PH = DATA.physical, n = PH.trials, per = PH.layouts[0].valid.length, mins = Math.round(PH.planned_s / 60);
  const { s, top } = content({
    title: "The layout test had 72 trials",
    take: `Six layouts with ${per} trials each, recorded in one ${mins} minute session.`,
    notes: `We tested the layouts in the room. There were six layouts and ${per} trials each, ${n} trials in one ${mins} minute session with one calibrated threshold. Each square is one trial, black if the frame was delivered and red if it was lost. Plain repetition-3 and depth 8 are the baselines. Spread repetition, the spread header and depth 16 are new.`,
  });
  const cs = 0.38, gap = 0.04, pitch = cs + gap, x0 = 3.7, y0 = top + 0.02, rp = 0.52;
  PH.layouts.forEach((l, ri) => {
    const y = y0 + ri * rp;
    text(s, l.label, { x: M, y: y - 0.02, w: 3.0, h: rp - 0.04, fontSize: 15, valign: "middle", objectName: `${l.label} row label` });
    l.valid.forEach((ok, ci) => cell(s, x0 + ci * pitch, y, cs, cs, "", { fill: ok ? HEX.dk1 : HEX.accent2, line: ok ? HEX.dk1 : HEX.accent2, name: `${l.label} trial ${ci + 1}` }));
    text(s, `${l.valid.filter(Boolean).length} of ${l.valid.length}`, { x: x0 + per * pitch + 0.15, y: y - 0.02, w: 1.1, h: rp - 0.04, fontSize: 17, fontFace: FONT.semi, valign: "middle", objectName: `${l.label} count` });
  });
  const ly = y0 + PH.layouts.length * rp + 0.08;
  cell(s, x0, ly + 0.05, 0.2, 0.18, "", { fill: HEX.dk1, line: HEX.dk1, name: "legend delivered" });
  text(s, "frame delivered", { x: x0 + 0.3, y: ly, w: 1.8, h: 0.28, fontSize: 14, color: C.text2, objectName: "legend delivered label" });
  cell(s, x0 + 2.2, ly + 0.05, 0.2, 0.18, "", { fill: HEX.accent2, line: HEX.accent2, name: "legend lost" });
  text(s, "frame lost", { x: x0 + 2.5, y: ly, w: 1.8, h: 0.28, fontSize: 14, color: C.text2, objectName: "legend lost label" });
}

async function physicalResults() {
  const R = RSTATS.physical, [lo, hi] = R.ranges.frames, pmin = Math.floor(R.ranges.fisher_p[0] * 10) / 10;
  const L = R.layouts, p = (name) => L[name].fisher_p.toFixed(2);
  const cb = R.ranges.channel_ber.map((v) => (v * 100).toFixed(1));
  const { s, top } = content({
    title: "Results of the layout test",
    take: `Frames delivered ranged from ${lo} to ${hi} of 12, and no comparison gave p below ${pmin.toFixed(1)}.`,
    notes: `Every layout delivered between ${lo} and ${hi} of 12 frames. We compared each new layout with its baseline using a Fisher exact test. The p values are ${p("rep-3 spread")} and ${p("rep-3 spread + header")} for the spread repetition layouts, and ${p("Ham-int depth 16")} and ${p("Ham-int depth 16 + header")} for depth 16. None is significant. With 12 trials per layout, this test could only show large differences.`,
  });
  const gap = 0.15, avail = 9.4 - M - gap, wA = 5.6, wB = 3.6, sc = Math.min(1.05, avail / (wA + wB), (5.15 - top) / 3.5);
  const a = await plot(s, "fig-physical-frames.png", { x: M, y: top, w: wA * sc, name: "frames delivered per layout", alt: "Frames delivered of 12 for the six layouts with Wilson intervals" });
  await plot(s, "fig-physical-ber.png", { x: M + a.w + gap, y: top, w: wB * sc, name: "channel BER per layout", alt: "Channel BER for the six layouts in the layout test" });
}

async function headerFinding() {
  const H = RSTATS.physical.header;
  const { s, top } = content({
    title: "Spreading the header cost frames",
    take: `The header CRC failed in ${H.spread.failed} of ${H.spread.frames} spread header frames and ${H.other.failed} of ${H.other.frames} others, p = ${H.fisher_p.toFixed(3)}.`,
    notes: `This was the one clear effect in the layout test, and it goes the wrong way. The header CRC failed in ${H.spread.failed} of ${H.spread.frames} spread header frames and ${H.other.failed} of ${H.other.frames} others, with a Fisher exact p of ${H.fisher_p.toFixed(3)}. In simulation the spread header helped, and in the layout test it cost frames. Two failures came from one short stretch of heavy errors. Without it, it is still ${H.mild_spread.failed} of ${H.mild_spread.frames} against ${H.adjacent.observed} of ${H.adjacent.frames}, p of ${H.mild_fisher_p.toFixed(2)}. We have not found the cause.`,
  });
  await plot(s, "fig-physical-header.png", { y: top - 0.08, maxW: 9.4, maxH: 5.15 - top + 0.08, ar: 2.2, name: "header CRC failures by layout", alt: "Header CRC failures for the layouts with the header together and with the header spread" });
}

async function physicalReading() {
  const P = STATS.physical, orig = STATS.repetition.filter((r) => ["G22", "G23", "G24", "G25", "G26"].includes(r.group));
  const SHORTL = ["rep-3 side by side", "rep-3 spread apart", "rep-3 spread + header", "Hamming depth 8", "Hamming depth 16", "Hamming depth 16 + header"];
  const rows = [...orig.map((r, i) => [`Glare run ${i + 1}`, r.channel * 100, X.accent]), ...P.layouts.map((l, i) => [SHORTL[i] ?? l.short, l.channel_ber * 100, X.g2])];
    const { s, top } = content({
    title: "What the layout test shows",
    take: "Glare was mild, so heavy bursts went untested. The one clear effect was negative.",
    notes: `Channel BER in the layout test was ${P.channel_ber_range_pct[0]} to ${P.channel_ber_range_pct[1]} percent, against ${P.original_glare_channel_ber_range_pct[0]} to ${P.original_glare_channel_ber_range_pct[1]} percent in the earlier glare runs. So the glare was mild and heavy bursts were not tested. The one clear effect was negative, because spreading the header cost frames. Whether spreading helps against heavy bursts still rests on the simulation.`,
  });
  s.addChart(pres.charts.BAR, [{ name: "Channel BER", labels: rows.map((r) => r[0]), values: rows.map((r) => r[1]) }], {
    x: M, y: top, w: 5.7, h: 5.15 - top, barDir: "bar", barGapWidthPct: 35, chartColors: rows.map((r) => r[2]), catAxisOrientation: "maxMin", showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", valAxisMinVal: 0, valAxisMaxVal: 36, valAxisMajorUnit: 10,
    ...chartFrame, ...axes("Channel BER, percent"), objectName: "channel ber comparison",
  });
  text(s, "Earlier glare runs", { x: 6.55, y: top + 0.2, w: 2.85, h: 0.3, fontSize: 16, bold: true, color: C.accent2, objectName: "original glare label" });
  text(s, `${P.original_glare_channel_ber_range_pct[0]} to ${P.original_glare_channel_ber_range_pct[1]} percent`, { x: 6.55, y: top + 0.52, w: 2.85, h: 0.4, fontSize: 22, bold: true, objectName: "original glare range" });
  text(s, "Layout test", { x: 6.55, y: top + 1.2, w: 2.85, h: 0.3, fontSize: 16, bold: true, color: C.text2, objectName: "this session label" });
  text(s, `${P.channel_ber_range_pct[0]} to ${P.channel_ber_range_pct[1]} percent`, { x: 6.55, y: top + 1.52, w: 2.85, h: 0.4, fontSize: 22, bold: true, objectName: "this session range" });
}

async function build() {
  k.speaker("Kanav");
  divider({ index: 4, title: "Extension", sub: "Our extension, which changes the order we send the bits, tested in simulation and then in the layout test.",
    notes: "Now our extension, which changes the order we send the bits." });
  neighbours();
  interleaving();
  burstSweep();
  placement();
  threeLayouts();
  built.layoutsFlow();
  physicalGrid();
  await physicalResults();
  await headerFinding();
  await physicalReading();
}

module.exports = { build };
