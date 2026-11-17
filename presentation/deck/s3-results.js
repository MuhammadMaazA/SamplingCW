"use strict";
// Slides 26 to 35, results for the basic codes and what the noise looked like.
const k = require("./kit");
const merged = require("./merged");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, text, hline, vline, arrow, cell, plot, content, divider, chartFrame, axes, setupKey, setupRow, findKey } = k;

const pct = (x, d = 1) => (x * 100).toFixed(d);

async function wilson() {
  const pmin = Math.min(...Object.values(RSTATS.fisher)).toFixed(2);
  const { s, top } = content({
    title: "What 3 trials can tell us",
    take: `With 3 trials per method, no method differs from the best one, p of ${pmin} or more.`,
    notes: `Before reading too much into those differences, we should be honest about how little data we have. With only 3 trials per method, our error bars are wide. We used a 95 percent Wilson interval, which stays sensible even at 0 of 3 or 3 of 3. A p value asks how often chance alone would give a gap this large if the methods made no difference, and below about 0.05 we treat chance as unlikely. Comparing each code with the best one, repetition 5, on pooled trials, the smallest p value is 0.13, and for repetition 7 against Hamming at 8 bits per second it is 0.10. Neither is below 0.05, so we read these results as trends.`,
  });
  await plot(s, "wilson.png", { y: top, maxW: 9.4, maxH: 5.15 - top, name: "frames delivered with Wilson intervals", alt: "Frames delivered per method with 95 percent Wilson intervals for three setups" });
}

function pattern() {
  const N = RSTATS.noise, F8 = N[findKey(N, 8, false)], GL = N[findKey(N, 4, true)], fd = F8.flip_direction;
  const L = ["1", "2", "3", "4", "5", "6+"];
  const rate = (o) => L.map((_, i) => { const [e, n] = o.run_position_rate[String(i + 1)]; return e / n; });
  const r = (a) => a[0] / a[1], el = GL.early_late;
  k.lineStyle("Normal light, 8 bps", "solid", "circle");
  k.lineStyle("Dim with glare, 4 bps", "dash", "square");
  const { s, top } = content({
    title: "Which bits go wrong",
    take: "At 8 bps black bits fail after white ones. In glare, later bits of a run fail more.",
    notes: `Looking inside a frame, the same positions keep going wrong, which tells us why. At 8 bits per second, 256 of the 260 errors are a black bit read as white. A black bit fails 15.3 percent of the time after a white bit, against 3.3 percent after a black bit, because the screen and camera have not finished fading from white. In glare the first two bits of a run of one colour are mostly fine, with 3.5 percent errors, but from the third bit on the error rate is 17.8 percent, which fits the camera slowly drifting its exposure. So the errors depend on what was sent just before.`,
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
    notes: `To describe those bursts, we use a model with two states. In the good state about 1 percent of bits flip, and in the bad state almost every bit flips. Fitted to our dim glare frames at 4 bits per second, the bad state lasts 4.4 bits on average and covers 12 percent of the time. We compare it with a model that has no memory using BIC, the Bayesian information criterion, where a lower score is better, and the two-state model wins, with 2261 against 3824. It also predicts that 81 percent of errors fall in runs of 3 or more, close to the 87 percent we observed, where the model with no memory predicts 5 percent.`,
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
    title: "Repetition does worse than theory",
    take: `One glare recording: rep-3 left ${R.G25.decoded.toFixed(3)} of bits wrong, theory says ${R.G25.theory.toFixed(3)}.`,
    notes: `This clustering explains why repetition does worse than the textbook says. Theory assumes each copy flips independently, so for repetition 3 the decoded error should be tiny. But in one glare recording, repetition 3 left 0.198 of the bits wrong, where theory predicts 0.015. The three copies of a bit are sent next to each other, so a single burst hits all of them. Across the dim runs, 77 of 624 bits sent three times lost all three copies, where independent flips would have lost about 3. So our extension had to deal with bursts.`,
  });
  await plot(s, "repetition-theory.png", { x: M, y: top, h: Math.min(3.6, 5.15 - top), name: "repetition theory against measured runs", alt: "Majority vote theory curves for repetition 3, 5 and 7 with every measured repetition run overlaid" });
  text(s, String(RSTATS.rep3_all_copies.observed), { x: 6.65, y: top + 0.1, w: 2.8, h: 1.2, fontSize: 80, bold: true, color: C.accent2, fontFace: FONT.head, objectName: "lost copies callout" });
  text(s, `of ${RSTATS.rep3_all_copies.groups} bits sent three times in glare lost all three copies, against ${RSTATS.rep3_all_copies.memoryless.toFixed(0)} expected by chance`, { x: 6.65, y: top + 1.4, w: 2.75, h: 1.3, fontSize: 18, color: C.text1, objectName: "lost copies label" });
  text(s, "Decoded BER counts the payload bits of frames we could decode.", { x: 6.65, y: top + 2.85, w: 2.75, h: 0.7, fontSize: 14, color: C.text2, objectName: "decoded ber caveat" });
}

async function build() {
  k.speaker("Kanav");
  k.section("Results and noise", "03");
  merged.normalLight();
  await wilson();
  await merged.noise();
  pattern();
  await twoState();
  await repetitionTheory();
}

module.exports = { build };
