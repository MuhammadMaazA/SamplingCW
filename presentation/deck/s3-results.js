"use strict";
// Slides 25 to 33, results for the basic codes and what the noise really looks like.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, text, hline, vline, arrow, cell, plot, content, divider, chartFrame, axes } = k;
const { hammingWord } = require("./s1-channel");

const pct = (x, d = 1) => (x * 100).toFixed(d);

function cleanChannel() {
  const T = STATS.tradeoff.filter((r) => r.env === "Reflection, 4 bps").sort((a, b) => b.throughput - a.throughput);
  const NAME = { none: "uncoded", "Ham-interl.": "Ham-int", "2-D parity": "2-D parity" };
  const { s, top } = content({
    title: "On a clean channel, do not code",
    take: "Every method decoded without errors, so extra bits only cost throughput.",
    notes: "The clean slice is the reflection in normal light at 4 bits per second, all seven codes. Every code reached zero decoded errors, uncoded included, so throughput simply follows code rate and extra bits only cost speed. Hamming sits low because one of its three frames lost its header, a frame failure, not a bit error.",
    secs: 30,
  });
  s.addChart(pres.charts.BAR, [{ name: "Useful throughput", labels: T.map((r) => NAME[r.method] ?? r.method), values: T.map((r) => r.throughput) }], {
    x: M, y: top, w: 6.2, h: 5.12 - top, barDir: "col", barGapWidthPct: 45, chartColors: [X.ink], showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", valAxisMinVal: 0, valAxisMaxVal: 0.28, valAxisMajorUnit: 0.07, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Useful throughput, bits per second", "Reflection at 4 bps, 3 trials per method"), objectName: "clean channel throughput",
  });
  text(s, "0", { x: 7.15, y: top + 0.4, w: 2.2, h: 1.3, fontSize: 96, bold: true, color: C.text1, fontFace: FONT.head, objectName: "zero callout" });
  text(s, "decoded errors for every method, uncoded included", { x: 7.15, y: top + 1.75, w: 2.2, h: 1.2, fontSize: 18, color: C.text2, objectName: "zero callout label" });
}

function hammingBackfires() {
  const F = RSTATS.fast;
  const order = ["none", "rep-3", "rep-5", "rep-7", "Hamming", "2-D parity", "Ham-interl."];
  const NAME = { none: "uncoded", "Ham-interl.": "Ham-int" };
  const { s, top } = content({
    title: "At high noise, Hamming backfires",
    take: `At 8 bps Hamming decoded worse than sending nothing, ${F.Hamming.decoded_ber.toFixed(3)} against ${F.none.decoded_ber.toFixed(3)}.`,
    notes: `High noise is facing the screen at 8 bits per second. The labels give frames delivered out of 3. Hamming decoded worse than sending nothing, ${F.Hamming.decoded_ber.toFixed(3)} against ${F.none.decoded_ber.toFixed(3)}, because two flips in one codeword make it flip a third, correct bit, as the diagram shows. 2-D parity reaches zero error only on the one frame it accepted, so every label carries its frame count.`,
    secs: 40,
  });
  s.addChart(pres.charts.BAR, [{ name: "Decoded BER", labels: order.map((m) => `${NAME[m] ?? m}` + String.fromCharCode(10) + `${F[m].ok}/${F[m].trials}`), values: order.map((m) => F[m].decoded_ber) }], {
    x: M, y: top, w: 5.5, h: 5.12 - top, barDir: "col", barGapWidthPct: 40,
    chartColors: order.map((m) => (m === "Hamming" ? X.accent : m === "none" ? X.g2 : X.ink)), showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", valAxisMinVal: 0, valAxisMaxVal: 0.09, valAxisMajorUnit: 0.03, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Decoded errors per bit", "Code, frames delivered of 3, facing at 8 bps"), objectName: "high noise decoded ber",
  });
  // two flips in one codeword, Hamming then flips a third bit
  const sent = hammingWord([1, 0, 1, 1]), got = sent.slice(), flips = [0, 4];
  flips.forEach((i) => { got[i] ^= 1; });
  const syn = [1, 2, 4].reduce((t, c) => t + ((([1, 2, 3, 4, 5, 6, 7].filter((q) => q & c).reduce((a, q) => a + got[q - 1], 0) % 2) ? c : 0)), 0);
  const fixed = got.slice();
  fixed[syn - 1] ^= 1;
  const size = 0.38, gap = 0.04, x0 = 6.5;
  [["Sent", sent, []], ["Received, two flips", got, flips], ["After Hamming", fixed, fixed.map((b, i) => (b !== sent[i] ? i : -1)).filter((i) => i >= 0)]].forEach(([label, row, bad], r) => {
    const y = top + 0.5 + r * 0.92;
    text(s, label, { x: x0, y: y - 0.34, w: 2.9, h: 0.3, fontSize: 15, color: C.text2, objectName: `${label} label` });
    row.forEach((b, i) => cell(s, x0 + i * (size + gap), y, size, size, b, { fill: bad.includes(i) ? HEX.accent2 : WHITE, line: bad.includes(i) ? HEX.accent2 : C.text2, color: bad.includes(i) ? C.background1 : C.text1, bold: bad.includes(i), fs: 15, name: `${label} bit ${i + 1}` }));
  });
  text(s, "Two flips became three wrong bits", { x: x0, y: top + 3.2, w: 2.9, h: 0.6, fontSize: 18, bold: true, color: C.accent2, objectName: "backfire verdict" });
}

async function wilson() {
  const pmin = Math.min(...Object.values(RSTATS.fisher)).toFixed(2);
  const { s, top } = content({
    title: "What 3 trials can tell us",
    take: `With 3 trials per method no method differs from the best, p of ${pmin} or more.`,
    notes: `With 3 trials per cell the statistics need care. We use Wilson intervals for frame success, because at 0 of 3 or 3 of 3 the normal interval collapses, and Fisher exact tests, which stay exact at small counts. Our widest gap, repetition-7 against Hamming at 8 bits per second, gives p of ${RSTATS.fisher_fast_rep7_vs_hamming.toFixed(2)}. Pooling gives 9 trials per method and nothing differs from the best. So frame rankings are suggestive only.`,
    secs: 35,
  });
  await plot(s, "wilson.png", { y: top, maxW: 8.8, maxH: 5.12 - top, name: "frame success with Wilson intervals", alt: "Frames delivered per method with 95 percent Wilson intervals for three setups" });
}

async function raster() {
  const { s, top } = content({
    title: "Two kinds of noise",
    take: `At 8 bps flips are isolated, in glare they arrive in bursts up to ${STATS.noise_regimes.longest_burst} bits.`,
    notes: `Every error in every trial of every analysed group, one row per trial, grouped by setup. At 8 bits per second the errors are mostly alone. In glare they arrive in solid bursts up to ${STATS.noise_regimes.longest_burst} bits long. The next slides measure this properly.`,
    secs: 35,
  });
  await plot(s, "fig-error-raster.png", { y: top, maxW: 8.8, maxH: 5.12 - top, name: "every error in every trial", alt: "Error positions in every trial, one row per trial, grouped by setup" });
}

async function runs() {
  const N = RSTATS.noise, GL = N["4 bps glare"], F8 = N["8 bps facing"], F3 = N["3 bps facing"];
  const { s, top } = content({
    title: "Runs of wrong bits",
    take: `In glare ${pct(GL.burst_share, 0)} percent of errors sit in runs of 3 or more, against ${pct(GL.burst_share_null, 0)} by chance.`,
    notes: `Two views of one fact. On the left, the share of error runs by length against independent flips. On the right, the share of errors in runs of 3 or more. In glare it is ${pct(GL.burst_share, 0)} percent against ${pct(GL.burst_share_null, 0)} by chance, with a permutation test p below 0.001. At 8 bits per second it is ${pct(F8.burst_share)} percent, at 3 bits per second none. So glare is not independent flips.`,
    secs: 40,
  });
  await plot(s, "fig-run-lengths.png", { x: M, y: top, h: Math.min(3.4, 5.12 - top), name: "error run lengths", alt: "Share of error runs by length against the independent flip expectation" });
  s.addChart(pres.charts.BAR, [
    { name: "Observed", labels: ["3 bps", "8 bps", "Glare"], values: [F3.burst_share, F8.burst_share, GL.burst_share] },
    { name: "By chance", labels: ["3 bps", "8 bps", "Glare"], values: [F3.burst_share_null, F8.burst_share_null, GL.burst_share_null] },
  ], {
    x: 5.6, y: top, w: 3.8, h: 5.12 - top, barDir: "col", barGrouping: "clustered", barGapWidthPct: 50, chartColors: [X.accent, X.g3],
    showLegend: true, legendPos: "t", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0%", valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: "0%",
    ...chartFrame, ...axes("Errors in runs of 3 or more"), objectName: "share of errors in runs",
  });
}

function pattern() {
  const N = RSTATS.noise, F8 = N["8 bps facing"], GL = N["4 bps glare"], fd = F8.flip_direction;
  const L = ["1", "2", "3", "4", "5", "6+"];
  const rate = (o) => L.map((_, i) => { const [e, n] = o.run_position_rate[String(i + 1)]; return e / n; });
  const r = (a) => a[0] / a[1], el = GL.early_late;
  k.lineStyle("Facing screen, 8 bps", "solid", "circle");
  k.lineStyle("Reflection with glare, 4 bps", "dash", "square");
  const { s, top } = content({
    title: "Errors follow the bit pattern",
    take: "At 8 bps white smears into the next bit, in glare errors grow as a colour is held.",
    notes: `Conditioning errors on what we sent separates two mechanisms. At 8 bits per second, ${fd["black read white"]} of ${fd["black read white"] + fd["white read black"]} errors are black read as white, and black fails ${pct(r(F8.black_after_white))} percent of the time right after white, against ${pct(r(F8.black_after_black))} after black. White smears into the next symbol. Glare reverses the pattern. Errors are rare in the first two symbols of a run and common from the third, which fits auto exposure drifting while a colour is held.`,
    secs: 45,
  });
  s.addChart(pres.charts.LINE, [
    { name: "Facing screen, 8 bps", labels: L, values: rate(F8) },
    { name: "Reflection with glare, 4 bps", labels: L, values: rate(GL) },
  ], {
    x: M, y: top, w: 5.2, h: 5.12 - top, chartColors: [X.ink, X.accent], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    showLegend: true, legendPos: "t", valAxisMinVal: 0, valAxisMaxVal: 0.3, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0%",
    ...chartFrame, ...axes("Error rate", "Position of the symbol in a run of one colour"), objectName: "run position chart",
  });
  s.addChart(pres.charts.BAR, [{
    name: "Error rate", labels: ["After white", "After black", "Symbols 1 to 2", "Symbol 3 on"],
    values: [r(F8.black_after_white), r(F8.black_after_black), el[0] / el[1], el[2] / el[3]],
  }], {
    x: 6.0, y: top, w: 3.4, h: 5.12 - top - 0.35, barDir: "col", barGapWidthPct: 45, chartColors: [X.ink, X.g2, X.g2, X.accent], showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0%", valAxisMinVal: 0, valAxisMaxVal: 0.22, valAxisMajorUnit: 0.05, valAxisLabelFormatCode: "0%",
    ...chartFrame, ...axes("Error rate", "8 bps black, then glare"), objectName: "mechanism chart",
  });
  text(s, "Both contrasts, Fisher exact p below 10 to the minus 10", { x: 6.0, y: 4.85, w: 3.4, h: 0.3, fontSize: 13, color: C.text2, objectName: "fisher note" });
}

async function twoState() {
  const GL = RSTATS.noise["4 bps glare"], g = STATS.ge_fit, MC = RSTATS.glare_model_check;
  const { s, top } = content({
    title: "A two-state model of glare",
    take: `Bad spells of ${g.mean_bad_length.toFixed(1)} bits, ${pct(g.bad_fraction, 0)} percent of the time, reproduce how glare bursts.`,
    notes: `We fitted a two state Gilbert Elliott model to the glare errors. The good state flips about ${pct(g.error_good, 0)} percent of bits, the bad state nearly all, and bad spells average ${g.mean_bad_length.toFixed(1)} bits and fill ${pct(g.bad_fraction, 0)} percent of the time. BIC prefers it clearly over flips with no memory. As a check it reproduces the share of errors in runs of 3 or more, ${MC.GE[0].toFixed(2)} against ${GL.burst_share.toFixed(2)} observed, a number it was never fitted to.`,
    secs: 40,
  });
  const p = await plot(s, "fig-ge-fit.png", { y: top, maxW: 8.8, maxH: 5.12 - top - 0.75, name: "real glare frame against the fitted model", alt: "One real glare frame, three frames from the two state model and one memoryless draw" });
  const by = p.y + p.h + 0.14;
  text(s, "BIC, lower is better", { x: M, y: by, w: 4.2, h: 0.26, fontSize: 14, color: C.text2, objectName: "bic label" });
  text(s, `${Math.round(GL.bic_bsc)} no memory, ${Math.round(GL.bic_ge)} two-state`, { x: M, y: by + 0.28, w: 4.2, h: 0.32, fontSize: 17, bold: true, objectName: "bic line" });
  text(s, "Errors in runs of 3 or more, not fitted", { x: 4.8, y: by, w: 4.6, h: 0.26, fontSize: 14, color: C.text2, objectName: "model check label" });
  text(s, `${MC.GE[0].toFixed(2)} model, ${GL.burst_share.toFixed(2)} observed, ${MC.memoryless[0].toFixed(2)} none`, { x: 4.8, y: by + 0.28, w: 4.6, h: 0.32, fontSize: 17, bold: true, objectName: "model check line" });
}

async function repetitionTheory() {
  const R = Object.fromEntries(STATS.repetition.map((r) => [r.group, r]));
  const { s, top } = content({
    title: "Repetition, theory against reality",
    take: `In glare, rep-3 left ${R.G25.decoded.toFixed(3)} of bits wrong where theory says ${R.G25.theory.toFixed(3)}.`,
    notes: `If flips were independent, majority voting would follow these curves. Our glare runs land far above them. Group G25 left ${R.G25.decoded.toFixed(3)} of bits wrong where theory says ${R.G25.theory.toFixed(3)}. The reason is adjacency. Of ${RSTATS.rep3_all_copies.groups} groups, ${RSTATS.rep3_all_copies.observed} lost all three copies against ${RSTATS.rep3_all_copies.memoryless.toFixed(0)} expected without memory, because neighbouring copies share one burst. So the extension had to target bursts.`,
    secs: 40,
  });
  await plot(s, "repetition-theory.png", { x: M, y: top, h: Math.min(3.55, 5.12 - top), name: "repetition theory against measured runs", alt: "Majority vote theory curves for repetition 3, 5 and 7 with every measured repetition run overlaid" });
  text(s, String(RSTATS.rep3_all_copies.observed), { x: 6.65, y: top + 0.1, w: 2.8, h: 1.2, fontSize: 80, bold: true, color: C.accent2, fontFace: FONT.head, objectName: "lost copies callout" });
  text(s, `of ${RSTATS.rep3_all_copies.groups} glare rep-3 groups lost all three copies, ${RSTATS.rep3_all_copies.memoryless.toFixed(1)} expected by chance`, { x: 6.65, y: top + 1.4, w: 2.75, h: 1.2, fontSize: 18, color: C.text1, objectName: "lost copies label" });
  text(s, "Decoded BER covers the payload bits of decodable frames only", { x: 6.65, y: top + 2.75, w: 2.75, h: 0.7, fontSize: 14, color: C.text2, objectName: "decoded ber caveat" });
}

async function build() {
  k.speaker("Kanav");
  divider({ index: 3, title: "Results and noise", sub: "Do the basic codes fit the noise we measured",
    notes: "Now the results for the basic codes, and what the noise really looks like. The question is whether repetition and Hamming correct the noise we actually have." });
  cleanChannel();
  hammingBackfires();
  await wilson();
  await raster();
  await runs();
  pattern();
  await twoState();
  await repetitionTheory();
}

module.exports = { build };
