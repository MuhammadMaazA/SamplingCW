"use strict";
// Slides 26 to 35, results for the basic codes and what the noise looked like.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, text, hline, vline, arrow, cell, plot, content, divider, chartFrame, axes, setupKey, setupRow, findKey } = k;
const { hammingWord } = require("./s1-channel");

const pct = (x, d = 1) => (x * 100).toFixed(d);

function cleanChannel() {
  const T = STATS.tradeoff.filter((r) => setupKey(r.env) === "n4").sort((a, b) => b.throughput - a.throughput);
  const NAME = { none: "uncoded", "Ham-interl.": "Ham-int", "2-D parity": "2-D parity" };
  const { s, top } = content({
    title: "Results on a clean channel",
    take: "Every code decoded with no errors, so the extra bits only made it slower.",
    notes: "This is normal light at 4 bits per second with all seven codes, 3 trials each. Every code decoded with no errors, including no code at all. So throughput, the message bits delivered per second, follows the code rate. Hamming is low because one frame lost its header, which is a lost frame and not a bit error.",
  });
  s.addChart(pres.charts.BAR, [{ name: "Throughput", labels: T.map((r) => NAME[r.method] ?? r.method), values: T.map((r) => r.throughput) }], {
    x: M, y: top, w: 6.2, h: 5.15 - top, barDir: "col", barGapWidthPct: 45, chartColors: [X.ink], showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", valAxisMinVal: 0, valAxisMaxVal: 0.28, valAxisMajorUnit: 0.07, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Throughput, message bits delivered per second", "Normal light at 4 bps, 3 trials per code"), objectName: "clean channel throughput",
  });
  text(s, "0", { x: 7.15, y: top + 0.4, w: 2.2, h: 1.3, fontSize: 96, bold: true, color: C.text1, fontFace: FONT.head, objectName: "zero callout" });
  text(s, "decoded errors for every code, the uncoded one included", { x: 7.15, y: top + 1.75, w: 2.25, h: 1.2, fontSize: 18, color: C.text2, objectName: "zero callout label" });
}

function hammingBackfires() {
  const F = RSTATS.fast;
  const order = ["none", "rep-3", "rep-5", "rep-7", "Hamming", "2-D parity", "Ham-interl."];
  const NAME = { none: "uncoded", "Ham-interl.": "Ham-int" };
  const { s, top } = content({
    title: "High noise at 8 bps",
    take: `At 8 bps Hamming made more errors than no code at all, ${F.Hamming.decoded_ber.toFixed(3)} against ${F.none.decoded_ber.toFixed(3)}.`,
    notes: `This is 8 bits per second in normal light. The labels show how many of the 3 frames were delivered. Hamming made more errors than sending nothing, ${F.Hamming.decoded_ber.toFixed(3)} against ${F.none.decoded_ber.toFixed(3)}. Two flips in one codeword make Hamming flip a third bit that was correct, so three bits end up wrong. 2-D parity shows zero errors only because it accepted one frame.`,
  });
  s.addChart(pres.charts.BAR, [{ name: "Decoded BER", labels: order.map((m) => `${NAME[m] ?? m}, ${F[m].ok} of ${F[m].trials} frames`), values: order.map((m) => F[m].decoded_ber) }], {
    x: M, y: top, w: 5.5, h: 5.15 - top, barDir: "bar", barGapWidthPct: 40, catAxisOrientation: "maxMin",
    chartColors: order.map((m) => (m === "Hamming" ? X.accent : m === "none" ? X.g2 : X.ink)), showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000", valAxisMinVal: 0, valAxisMaxVal: 0.09, valAxisMajorUnit: 0.03, valAxisLabelFormatCode: "0.00",
    ...chartFrame, ...axes("Decoded errors per bit, normal light at 8 bps"), objectName: "high noise decoded ber",
  });
  const sent = hammingWord([1, 0, 1, 1]), got = sent.slice(), flips = [0, 4];
  flips.forEach((i) => { got[i] ^= 1; });
  const syn = [1, 2, 4].reduce((t, c) => t + ((([1, 2, 3, 4, 5, 6, 7].filter((q) => q & c).reduce((a, q) => a + got[q - 1], 0) % 2) ? c : 0)), 0);
  const fixed = got.slice();
  fixed[syn - 1] ^= 1;
  const size = 0.38, gap = 0.04, x0 = 6.5;
  [["Sent", sent, []], ["Received, two bits flipped", got, flips], ["After Hamming", fixed, fixed.map((b, i) => (b !== sent[i] ? i : -1)).filter((i) => i >= 0)]].forEach(([label, row, bad], r) => {
    const y = top + 0.5 + r * 0.92;
    text(s, label, { x: x0, y: y - 0.34, w: 2.9, h: 0.3, fontSize: 15, color: C.text2, objectName: `${label} label` });
    row.forEach((b, i) => cell(s, x0 + i * (size + gap), y, size, size, b, { fill: bad.includes(i) ? HEX.accent2 : WHITE, line: bad.includes(i) ? HEX.accent2 : C.text2, color: bad.includes(i) ? C.background1 : C.text1, bold: bad.includes(i), fs: 15, name: `${label} bit ${i + 1}` }));
  });
  text(s, "Two flips become three wrong bits", { x: x0, y: top + 3.2, w: 2.9, h: 0.6, fontSize: 18, bold: true, color: C.accent2, objectName: "flip verdict" });
}

async function wilson() {
  const pmin = Math.min(...Object.values(RSTATS.fisher)).toFixed(2);
  const { s, top } = content({
    title: "What 3 trials can tell us",
    take: `With 3 trials per method, no method differs from the best one, p of ${pmin} or more.`,
    notes: `With 3 trials per cell we need careful statistics. A Wilson interval is a 95 percent range for a proportion, and it works even at 0 of 3. A Fisher exact test compares two groups exactly with small counts. Our biggest gap, repetition-7 against Hamming at 8 bits per second, gives p of ${RSTATS.fisher_fast_rep7_vs_hamming.toFixed(2)}. Pooling three sessions gives 9 trials per method, and still no method differs from the best.`,
  });
  await plot(s, "wilson.png", { y: top, maxW: 9.4, maxH: 5.15 - top, name: "frames delivered with Wilson intervals", alt: "Frames delivered per method with 95 percent Wilson intervals for three setups" });
}

async function raster() {
  const { s, top } = content({
    title: "Two kinds of noise",
    take: `At 8 bps most errors are single bits. In glare they come in bursts of up to ${STATS.noise_regimes.longest_burst} bits.`,
    notes: `Each row is one trial and each mark is a wrong bit. At 8 bits per second the wrong bits are mostly on their own. In glare they come in bursts, up to ${STATS.noise_regimes.longest_burst} bits long. The next slides measure this.`,
  });
  await plot(s, "fig-error-raster.png", { y: top - 0.05, maxW: 9.4, maxH: 5.15 - top + 0.05, name: "error positions in every trial", alt: "Error positions in every trial, one row per trial, grouped by setup" });
}

async function runs() {
  const N = RSTATS.noise, GL = N[findKey(N, 4, true)], F8 = N[findKey(N, 8, false)], F3 = N[findKey(N, 3, false)];
  const { s, top } = content({
    title: "Runs of wrong bits",
    take: `In glare ${pct(GL.burst_share, 0)} percent of errors are in runs of 3 or more. Chance gives ${pct(GL.burst_share_null, 0)} percent.`,
    notes: `A run is several wrong bits in a row. The left figure compares run lengths with what independent flips would give. The right chart shows the share of errors in runs of 3 or more. In glare it is ${pct(GL.burst_share, 0)} percent, against ${pct(GL.burst_share_null, 0)} percent for independent flips, and a permutation test gives p below 0.001. At 8 bits per second it is ${pct(F8.burst_share)} percent.`,
  });
  await plot(s, "fig-run-lengths.png", { x: M, y: top, h: Math.min(3.55, 5.15 - top), name: "error run lengths", alt: "Share of error runs by length against the independent flip expectation" });
  s.addChart(pres.charts.BAR, [
    { name: "Observed", labels: ["3 bps", "8 bps", "Glare"], values: [F3.burst_share, F8.burst_share, GL.burst_share] },
    { name: "By chance", labels: ["3 bps", "8 bps", "Glare"], values: [F3.burst_share_null, F8.burst_share_null, GL.burst_share_null] },
  ], {
    x: 5.6, y: top, w: 3.8, h: 5.15 - top, barDir: "col", barGrouping: "clustered", barGapWidthPct: 50, chartColors: [X.accent, X.g3],
    showLegend: true, legendPos: "t", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0%", valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: "0%",
    ...chartFrame, ...axes("Errors in runs of 3 or more"), objectName: "share of errors in runs",
  });
}

function pattern() {
  const N = RSTATS.noise, F8 = N[findKey(N, 8, false)], GL = N[findKey(N, 4, true)], fd = F8.flip_direction;
  const L = ["1", "2", "3", "4", "5", "6+"];
  const rate = (o) => L.map((_, i) => { const [e, n] = o.run_position_rate[String(i + 1)]; return e / n; });
  const r = (a) => a[0] / a[1], el = GL.early_late;
  k.lineStyle("Normal light, 8 bps", "solid", "circle");
  k.lineStyle("Dim with glare, 4 bps", "dash", "square");
  const { s, top } = content({
    title: "Errors and the bit pattern",
    take: "At 8 bps black bits fail after white ones. In glare, later bits of a run fail more.",
    notes: `At 8 bits per second, ${fd["black read white"]} of the ${fd["black read white"] + fd["white read black"]} errors are a black bit read as white. A black bit fails ${pct(r(F8.black_after_white))} percent of the time right after a white bit, against ${pct(r(F8.black_after_black))} percent after a black bit, because brightness carries over. In glare, errors are rare in the first two bits of a run, ${pct(el[0] / el[1])} percent, and common from the third, ${pct(el[2] / el[3])} percent, which fits exposure drift.`,
  });
  s.addChart(pres.charts.LINE, [
    { name: "Normal light, 8 bps", labels: L, values: rate(F8) },
    { name: "Dim with glare, 4 bps", labels: L, values: rate(GL) },
  ], {
    x: M, y: top, w: 4.9, h: 5.15 - top, chartColors: [X.ink, X.accent], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    showLegend: true, legendPos: "t", valAxisMinVal: 0, valAxisMaxVal: 0.3, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0%",
    ...chartFrame, ...axes("Error rate", "Position of the bit in a run of one colour"), objectName: "run position chart",
  });
  s.addChart(pres.charts.BAR, [{
    name: "Error rate", labels: ["8 bps, after white", "8 bps, after black", "Glare, bits 1 to 2", "Glare, bit 3 onward"],
    values: [r(F8.black_after_white), r(F8.black_after_black), el[0] / el[1], el[2] / el[3]],
  }], {
    x: 5.65, y: top, w: 3.75, h: 5.15 - top, barDir: "bar", barGapWidthPct: 40, catAxisOrientation: "maxMin", chartColors: [X.ink, X.g2, X.g2, X.accent], showLegend: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0%", valAxisMinVal: 0, valAxisMaxVal: 0.22, valAxisMajorUnit: 0.05, valAxisLabelFormatCode: "0%",
    ...chartFrame, ...axes("Error rate of black bits"), objectName: "mechanism chart",
  });
}

async function twoState() {
  const N = RSTATS.noise, GL = N[findKey(N, 4, true)], g = STATS.ge_fit, MC = RSTATS.glare_model_check;
  const { s, top } = content({
    title: "A two-state model of glare",
    take: `The bad state lasts ${g.mean_bad_length.toFixed(1)} bits on average and covers ${pct(g.bad_fraction, 0)} percent of the time.`,
    notes: `We fitted a model with two states. In the good state it flips about ${pct(g.error_good, 0)} percent of bits, in the bad state almost all of them. In glare the bad state lasts ${g.mean_bad_length.toFixed(1)} bits on average and covers ${pct(g.bad_fraction, 0)} percent of the time. On BIC, where lower is better, it does far better than flips with no memory. It also predicts the share of errors in runs of 3 or more, which we did not fit.`,
  });
  const p = await plot(s, "fig-ge-fit.png", { y: top, maxW: 9.4, maxH: 5.15 - top - 0.75, name: "recorded glare frame against the fitted model", alt: "One recorded glare frame, three frames from the two state model and one draw with no memory" });
  const by = p.y + p.h + 0.14;
  text(s, "BIC, lower is better", { x: M, y: by, w: 4.2, h: 0.26, fontSize: 14, color: C.text2, objectName: "bic label" });
  text(s, `${Math.round(GL.bic_bsc)} no memory, ${Math.round(GL.bic_ge)} two-state`, { x: M, y: by + 0.28, w: 3.9, h: 0.32, fontSize: 16, bold: true, objectName: "bic line" });
  text(s, "Errors in runs of 3 or more, not used in the fit", { x: 4.6, y: by, w: 4.8, h: 0.26, fontSize: 14, color: C.text2, objectName: "model check label" });
  text(s, `${MC.GE[0].toFixed(2)} model, ${GL.burst_share.toFixed(2)} observed, ${MC.memoryless[0].toFixed(2)} no memory`, { x: 4.6, y: by + 0.28, w: 4.8, h: 0.32, fontSize: 16, bold: true, objectName: "model check line" });
}

async function repetitionTheory() {
  const R = Object.fromEntries(STATS.repetition.map((r) => [r.group, r]));
  const { s, top } = content({
    title: "Repetition against theory",
    take: `In glare rep-3 left ${R.G25.decoded.toFixed(3)} of bits wrong. Theory for independent flips says ${R.G25.theory.toFixed(3)}.`,
    notes: `If flips were independent, majority voting would follow these curves, but in glare our runs are far above them. One recording left ${R.G25.decoded.toFixed(3)} of the bits wrong where theory says ${R.G25.theory.toFixed(3)}. Neighbouring copies share one burst. Of ${RSTATS.rep3_all_copies.groups} bits sent three times in glare, ${RSTATS.rep3_all_copies.observed} lost all three copies, where we would expect ${RSTATS.rep3_all_copies.memoryless.toFixed(0)} without bursts. So the extension had to deal with bursts.`,
  });
  await plot(s, "repetition-theory.png", { x: M, y: top, h: Math.min(3.6, 5.15 - top), name: "repetition theory against measured runs", alt: "Majority vote theory curves for repetition 3, 5 and 7 with every measured repetition run overlaid" });
  text(s, String(RSTATS.rep3_all_copies.observed), { x: 6.65, y: top + 0.1, w: 2.8, h: 1.2, fontSize: 80, bold: true, color: C.accent2, fontFace: FONT.head, objectName: "lost copies callout" });
  text(s, `of ${RSTATS.rep3_all_copies.groups} bits sent three times in glare lost all three copies, against ${RSTATS.rep3_all_copies.memoryless.toFixed(0)} expected by chance`, { x: 6.65, y: top + 1.4, w: 2.75, h: 1.3, fontSize: 18, color: C.text1, objectName: "lost copies label" });
  text(s, "Decoded BER counts the payload bits of frames we could decode.", { x: 6.65, y: top + 2.85, w: 2.75, h: 0.7, fontSize: 14, color: C.text2, objectName: "decoded ber caveat" });
}

async function build() {
  k.speaker("Kanav");
  divider({ index: 3, title: "Results and noise", sub: "What the codes did and what the noise looked like.",
    notes: "Now the results, and what the noise looked like." });
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
