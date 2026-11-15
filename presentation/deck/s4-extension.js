"use strict";
// Slides 34 to 41, the extension, spread copies and interleaving, the design study and the physical test.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, plot, content, divider, chartFrame, axes } = k;

const pct = (x, d = 1) => (x * 100).toFixed(d);

function neighbours() {
  const { s, top } = content({
    title: "Why neighbours fail together",
    take: "A burst that fits inside one copy of the message cannot beat the majority vote.",
    notes: "Plain repetition sends the copies of each bit next to each other, so one burst can flip all three and win the vote. Spread repetition sends the whole message, then again, then a third time. A burst no longer than one copy now flips at most one copy of each bit, so the vote still wins. Same bits, same rate, only the order changes. The spread header uses the same idea.",
    secs: 40,
  });
  const size = 0.62, gap = 0.08, pitch = size + gap, x0 = 3.0;
  const rows = [
    { name: "Adjacent copies", sub: "as built", seq: "aaabbbccc", y: top + 0.8, out: "a is lost, all three of its copies flipped", bad: true },
    { name: "Spread copies", sub: "the new layout", seq: "abcabcabc", y: top + 2.65, out: "a, b and c each keep two copies, all recovered", bad: false },
  ];
  rows.forEach((r, ri) => {
    text(s, r.name, { x: M, y: r.y + 0.02, w: 2.3, h: 0.34, fontSize: 19, fontFace: FONT.semi, color: ri === 1 ? C.accent2 : C.text1, objectName: `${r.name} head` });
    text(s, r.sub, { x: M, y: r.y + 0.38, w: 2.3, h: 0.3, fontSize: 15, color: C.text2, objectName: `${r.name} sub` });
    [...r.seq].forEach((ch, i) => cell(s, x0 + i * pitch, r.y, size, size, ch, { fill: i < 3 ? HEX.accent2 : WHITE, line: i < 3 ? HEX.accent2 : C.text2, color: i < 3 ? C.background1 : C.text1, bold: i < 3, fs: 20, name: `${r.name} ${i + 1}` }));
    hline(s, x0, r.y - 0.14, 3 * pitch - gap, { color: C.accent2, w: 1.5, name: `${r.name} burst bracket` });
    text(s, "burst of 3 bits", { x: x0, y: r.y - 0.46, w: 3 * pitch, h: 0.28, fontSize: 14, color: C.accent2, objectName: `${r.name} burst label` });
    text(s, r.out, { x: x0, y: r.y + size + 0.12, w: 6.4, h: 0.3, fontSize: 17, fontFace: FONT.semi, color: r.bad ? C.accent2 : C.text1, objectName: `${r.name} outcome` });
  });
}

function interleaving() {
  const { s, top } = content({
    title: "Interleaving",
    take: "Same bits and rate, only the order changes, so an 8 bit burst hits each word once.",
    notes: `We built interleaving first. Laptop 1 sends the Hamming bits column by column across 8 codewords and laptop 2 undoes it, so a burst of up to 8 bits hits each codeword once and every one is fixed. It adds no bits. We chose depth 8 because ${pct(DATA.glare_runs.share_le8, 0)} percent of our glare error runs were 8 bits or shorter. The new depth 16 layout doubles that reach. Physically depth 8 matched plain Hamming and the intervals overlap, so we claim no physical difference.`,
    secs: 40,
  });
  const cs = 0.3, gap = 0.03, pitch = cs + gap, gy = top + 0.55;
  [["Word first", 1.1, (r, c) => r * 7 + c < 8, "7 errors in one codeword, Hamming cannot fix it", true],
   ["Column first", 5.7, (r, c) => c === 0, "1 error in every codeword, all fixed", false]].forEach(([label, gx, hit, verdict, bad], gi) => {
    text(s, label, { x: gx, y: top + 0.05, w: 3.2, h: 0.34, fontSize: 19, fontFace: FONT.semi, objectName: `${label} label` });
    for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
      const on = hit(r, c);
      cell(s, gx + c * pitch, gy + r * pitch, cs, cs, "", { fill: on ? HEX.accent2 : WHITE, line: on ? HEX.accent2 : HEX.lt2, name: `${label} r${r + 1} c${c + 1}` });
    }
    text(s, verdict, { x: gx - 0.1, y: gy + 8 * pitch + 0.1, w: 3.7, h: 0.55, fontSize: 16, fontFace: FONT.semi, color: bad ? C.accent2 : C.text1, objectName: `${label} verdict` });
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
    title: "Bursts up to 8 bits",
    take: `Depth 8 corrects every burst up to ${zeroTo} bits, while plain Hamming fails from ${firstFail}.`,
    notes: `The physical glare runs gave too few frames to compare Hamming with interleaving, so we ran a controlled test where we set the burst length. 64 bit payloads, every bit in the burst flipped, 400 trials per point. Depth 8 gives zero errors up to ${zeroTo} bits while plain Hamming fails from ${firstFail}. Past ${cross} bits each codeword takes two hits and interleaving does worse. It is a simulation and we say so.`,
    secs: 40,
  });
  s.addChart(pres.charts.LINE, [
    { name: "Hamming", labels: L, values: ham },
    { name: "Hamming-interleaved", labels: L, values: il },
    { name: "repetition-3", labels: L, values: rep },
  ], {
    x: M, y: top, w: 8.8, h: 5.12 - top - 0.35, chartColors: [X.ink, X.accent, X.g2], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 5,
    showLegend: true, legendPos: "t", valAxisMinVal: 0, valAxisMaxVal: 0.2, valAxisMajorUnit: 0.05, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Mean decoded errors per bit", "Burst length in bits, 400 trials per point"), objectName: "burst sweep chart",
  });
  text(s, `Simulated. Past ${cross} bits each codeword takes two hits and interleaving does worse.`, { x: M, y: 4.82, w: 8.0, h: 0.3, fontSize: 14, color: C.text2, objectName: "burst sweep note" });
}

function placement() {
  const D = RSTATS.design["4 bps glare"];
  const keys = ["rep-3 adjacent", "rep-5 adjacent", "rep-7 adjacent", "rep-3 spread", "rep-7 spread", "Hamming", "Ham-int d4", "Ham-int d8", "Ham-int d16"];
  const labels = ["rep-3 adjacent", "rep-5 adjacent", "rep-7 adjacent", "rep-3 spread", "rep-7 spread", "Hamming plain", "Hamming depth 4", "Hamming depth 8", "Hamming depth 16"];
  const H = D["header adjacent"], HS = D["header spread"];
  const { s, top } = content({
    title: "Placement beats quantity",
    take: "Placing copies apart lifts payload success, and a spread header lifts whole frames.",
    notes: `We pushed whole frames through the fitted glare model, as the receiver decodes them. With copies adjacent, more repetition makes it worse, ${D["rep-3 adjacent"].payload.toFixed(3)} down to ${D["rep-7 adjacent"].payload.toFixed(3)}, because longer runs mean longer bursts. The same message three times, spread, gives ${D["rep-3 spread"].payload.toFixed(3)}, and seven spread copies ${D["rep-7 spread"].payload.toFixed(2)}. The header is the bottleneck, only ${pct(H.header)} percent survive as built, ${pct(HS.header, 0)} percent when spread. It ranks designs, it does not forecast rates.`,
    secs: 45,
  });
  s.addChart(pres.charts.BAR, [{ name: "Payload success", labels, values: keys.map((key) => D[key].payload) }], {
    x: M, y: top, w: 5.7, h: 5.12 - top - 0.3, barDir: "bar", barGapWidthPct: 35, catAxisOrientation: "maxMin",
    chartColors: [X.g2, X.g2, X.g2, X.accent, X.accent, X.ink, X.ink, X.ink, X.accent], showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Payload success"), objectName: "placement chart",
  });
  s.addChart(pres.charts.BAR, [
    { name: "As built", labels: ["Header survives", "Whole frame"], values: [H.header, H.frame] },
    { name: "Header spread", labels: ["Header survives", "Whole frame"], values: [HS.header, HS.frame] },
  ], {
    x: 6.5, y: top, w: 2.9, h: 5.12 - top - 0.3, barDir: "col", barGrouping: "clustered", barGapWidthPct: 40, chartColors: [X.g2, X.accent],
    showLegend: true, legendPos: "t", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0%", valAxisMinVal: 0, valAxisMaxVal: 0.3, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0%",
    ...chartFrame, ...axes("Share of frames"), objectName: "header chart",
  });
  text(s, "Simulated on the two-state model fitted to our glare data, 3000 frames per layout", { x: M, y: 4.84, w: 8.0, h: 0.28, fontSize: 13, color: C.text2, objectName: "placement caption" });
}

function physicalGrid() {
  const PH = DATA.physical, n = PH.trials, per = PH.layouts[0].valid.length, mins = Math.round(PH.planned_s / 60);
  const { s, top } = content({
    title: "Physical test, 72 real trials",
    take: `Six layouts, ${per} trials each, one ${mins} minute session in the same room.`,
    notes: `We built all three new layouts into the live link and ran them for real. Six layouts, ${per} trials each, ${n} trials in one ${mins} minute session, same room, same lamp, one calibrated threshold. Each square is one trial, black if the frame was delivered and red if lost. Plain repetition-3 and depth 8 are the baselines. Spread repetition, the spread header and depth 16 are new.`,
    secs: 40,
  });
  const cs = 0.38, gap = 0.04, pitch = cs + gap, x0 = 3.6, y0 = top + 0.02, rp = 0.52;
  PH.layouts.forEach((l, ri) => {
    const y = y0 + ri * rp;
    text(s, l.label, { x: M, y: y - 0.02, w: 2.9, h: rp - 0.04, fontSize: 15, valign: "middle", objectName: `${l.label} row label` });
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
  const P = STATS.physical, [lo, hi] = P.frames_range, pmin = Math.floor(P.fisher_p_range[0] * 10) / 10;
  const f = P.layouts;
  const p = (i) => (f[i].fisher_p_vs_baseline ?? 0).toFixed(2);
  const { s, top } = content({
    title: "Physical test, results",
    take: `Frames delivered ranged from ${lo} to ${hi} of 12, and no comparison reached p below ${pmin.toFixed(1)}.`,
    notes: `Frames delivered ranged from ${lo} to ${hi} of 12. Against their baselines the Fisher p values were ${p(1)} and ${p(2)} for the spread repetition layouts, ${p(4)} and ${p(5)} for depth 16, so nothing came near significance. Channel BER was ${P.channel_ber_range_pct[0]} to ${P.channel_ber_range_pct[1]} percent for every layout. Twelve trials can separate very little, as the intervals show.`,
    secs: 40,
  });
  const gap = 0.15, avail = 8.8 - gap, wA = 5.6, wB = 3.6, sc = Math.min(1, avail / (wA + wB), (5.12 - top) / 3.5);
  const a = await plot(s, "fig-physical-frames.png", { x: M, y: top, w: wA * sc, name: "frames delivered per layout", alt: "Frames delivered of 12 for the six layouts with Wilson intervals" });
  await plot(s, "fig-physical-ber.png", { x: M + a.w + gap, y: top, w: wB * sc, name: "channel error per layout", alt: "Channel error rate for the six layouts in the physical session" });
}

function physicalReading() {
  const P = STATS.physical, orig = STATS.repetition.filter((r) => ["G22", "G23", "G24", "G25", "G26"].includes(r.group));
  const rows = [...orig.map((r, i) => [`Glare run ${i + 1}`, r.channel * 100, X.accent]), ...P.layouts.map((l) => [l.short, l.channel_ber * 100, X.g2])];
  const { s, top } = content({
    title: "Physical test, an honest reading",
    take: "This session's glare was mild, so no layout faced a real burst.",
    notes: `The reason is in the data. The channel BER that night was ${P.channel_ber_range_pct[0]} to ${P.channel_ber_range_pct[1]} percent against ${P.original_glare_channel_ber_range_pct[0]} to ${P.original_glare_channel_ber_range_pct[1]} in our original glare runs, so no layout met a real burst. The test confirms the layouts work on the real link at no measurable cost. It does not show they beat heavy bursts, which still rests on the simulation. Next we would repeat it with the lamp closer.`,
    secs: 45,
  });
  s.addChart(pres.charts.BAR, [{ name: "Channel BER", labels: rows.map((r) => r[0]), values: rows.map((r) => r[1]) }], {
    x: M, y: top, w: 5.7, h: 5.12 - top, barDir: "bar", barGapWidthPct: 35, chartColors: rows.map((r) => r[2]), catAxisOrientation: "maxMin", showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", valAxisMinVal: 0, valAxisMaxVal: 36, valAxisMajorUnit: 10,
    ...chartFrame, ...axes("Channel BER, percent"), objectName: "channel ber comparison",
  });
  text(s, "Original glare runs", { x: 6.55, y: top + 0.2, w: 2.85, h: 0.3, fontSize: 16, bold: true, color: C.accent2, objectName: "original glare label" });
  text(s, `${P.original_glare_channel_ber_range_pct[0]} to ${P.original_glare_channel_ber_range_pct[1]} percent`, { x: 6.55, y: top + 0.52, w: 2.85, h: 0.4, fontSize: 22, bold: true, objectName: "original glare range" });
  text(s, "This session", { x: 6.55, y: top + 1.2, w: 2.85, h: 0.3, fontSize: 16, bold: true, color: C.text2, objectName: "this session label" });
  text(s, `${P.channel_ber_range_pct[0]} to ${P.channel_ber_range_pct[1]} percent`, { x: 6.55, y: top + 1.52, w: 2.85, h: 0.4, fontSize: 22, bold: true, objectName: "this session range" });
  text(s, "The layouts work at no cost. Beating bursts still rests on the simulation.", { x: 6.55, y: top + 2.3, w: 2.85, h: 1.2, fontSize: 17, objectName: "reading verdict" });
}

async function build() {
  k.speaker("Kanav");
  divider({ index: 4, title: "The extension", sub: "Spread copies and interleave, from simulation to a real test",
    notes: "With the noise characterised, here is the extension. The idea is to put redundancy where the bursts are not, then test it in simulation and on the real link." });
  neighbours();
  interleaving();
  burstSweep();
  placement();
  physicalGrid();
  await physicalResults();
  physicalReading();
}

module.exports = { build };
