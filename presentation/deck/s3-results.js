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
    notes: `Okay so, a word on statistics. The dot is the share of frames delivered out of 3, the line is a 95 percent Wilson interval, which stays sensible even at 0 of 3, and the label is the count. A p value asks one thing. If the methods made no difference, how often would chance alone give a gap this big? Below about 0.05, chance is unlikely, and a Fisher exact test works p out for small counts. Our biggest gap, repetition 7 against Hamming at 8 bits per second, gives p of ${RSTATS.fisher_fast_rep7_vs_hamming.toFixed(2)}, so we read these as trends.`,
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
    notes: `And here's which bits fail. The left chart plots error rate by position in a run of one colour. At 8 bits per second, ${fd["black read white"]} of the ${fd["black read white"] + fd["white read black"]} errors are a black bit read as white. On the right, a black bit fails ${pct(r(F8.black_after_white))} percent of the time right after a white bit, against ${pct(r(F8.black_after_black))} percent after a black one, because brightness carries over. In glare errors are rare in the first two bits of a run, ${pct(el[0] / el[1])} percent, and common from the third, ${pct(el[2] / el[3])} percent, which fits exposure drift.`,
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
    notes: `Right, so we modelled it. The model has two states. In the good state it flips about ${pct(g.error_good, 0)} percent of bits, in the bad state almost all of them. The bad state lasts ${g.mean_bad_length.toFixed(1)} bits on average and covers ${pct(g.bad_fraction, 0)} percent of the time. BIC, the Bayesian information criterion, is a score where lower is better. No memory scores ${Math.round(GL.bic_bsc)} and the two-state model ${Math.round(GL.bic_ge)}. It also predicts what we did not fit, ${pct(MC.GE[0], 0)} percent of errors in runs of 3 or more, against ${pct(GL.burst_share, 0)} percent observed and ${pct(MC.memoryless[0], 0)} percent with no memory.`,
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
    take: `In glare rep-3 left ${R.G25.decoded.toFixed(3)} of bits wrong. Theory for independent flips says ${R.G25.theory.toFixed(3)}.`,
    notes: `So, if flips were independent, majority voting would follow these curves, the theory for repetition 3, 5 and 7. Each dot is a measured run, red for glare, black for normal light. In glare our runs sit far above the curves. One recording left ${R.G25.decoded.toFixed(3)} of the bits wrong where theory says ${R.G25.theory.toFixed(3)}, because neighbouring copies share one burst. Of ${RSTATS.rep3_all_copies.groups} bits sent three times in glare, ${RSTATS.rep3_all_copies.observed} lost all three copies, where we'd expect ${RSTATS.rep3_all_copies.memoryless.toFixed(0)}. So our extension had to deal with bursts.`,
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
