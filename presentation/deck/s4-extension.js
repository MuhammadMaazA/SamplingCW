"use strict";
// The extension, spread copies and interleaving, the simulations and the layout test.
const k = require("./kit");
const built = require("./built");
const merged = require("./merged");
const { box, label } = built;
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, plot, content, divider, chartFrame, axes, findKey } = k;

const pct = (x, d = 1) => (x * 100).toFixed(d);

// the three new layouts on top, how the receiver finds the header layout below
function layoutsAndFlow() {
  const CODE = DATA.code;
  const { s, top } = content({
    title: "The three new layouts",
    take: "Each layout only reorders the bits, and the receiver tries the normal header first.",
    notes: `This slide describes the three new layouts and how the receiver handles them. A layout is a way of ordering the same bits. Spread repetition sends the whole message three times in a row, and interleaving at depth 16 mixes 16 Hamming codewords instead of 8, so a burst of up to 16 bits hits each codeword once. The spread header sends its three copies a whole header apart. In the lower part, the receiver reads the ${CODE.header_coded_bits} header bits and tries the normal layout first. If the header CRC fails, it undoes the spread and tries again, and if both attempts fail, the frame is lost.`,
  });
  const cw = 2.8, cx = (i) => M + i * 3.0, cs = 0.2, pitch = 0.22;
  const strips = (x, y, a, b, la, lb) => {
    [[a, y, la, C.text2], [b, y + 0.29, lb, C.accent2]].forEach(([seq, yy, lab, col]) => {
      const parts = Array.isArray(seq) ? seq : [...seq];
      const w = parts.length === 6 ? 0.3 : cs, p = parts.length === 6 ? 0.32 : pitch;
      parts.forEach((ch, i) => cell(s, x + i * p, yy, w, cs, ch, { fs: 12, name: `${lab} ${i + 1}` }));
      text(s, lab, { x: x + parts.length * p + 0.06, y: yy - 0.02, w: 0.9, h: cs + 0.04, fontSize: 12, color: col, valign: "middle", objectName: `${lab} label` });
    });
  };
  const item = (i, name, desc) => {
    text(s, name, { x: cx(i), y: top - 0.04, w: cw, h: 0.3, fontSize: 15, fontFace: FONT.semi, objectName: `layout ${i + 1} name` });
    text(s, desc, { x: cx(i), y: top + 0.26, w: cw, h: 0.66, fontSize: 13, color: C.text2, objectName: `layout ${i + 1} text` });
    if (i) vline(s, cx(i) - 0.1, top, 1.5, { name: `layout rule ${i}` });
  };
  item(0, "Spread repetition", "The whole message is sent three times in a row, not each bit three times.");
  strips(cx(0), top + 0.98, "aaabbbccc", "abcabcabc", "together", "spread");
  item(1, "Interleaving, depth 16", "Sixteen Hamming codewords are mixed, not eight, so a burst of up to 16 bits hits each once.");
  [[8, "depth 8", top + 0.98, false], [16, "depth 16", top + 1.27, true]].forEach(([n, lab, y, fresh]) => {
    for (let i = 0; i < n; i++) cell(s, cx(1) + i * 0.125, y, 0.11, cs, "", { fill: fresh ? HEX.accent2 : WHITE, line: fresh ? HEX.accent2 : C.text2, name: `${lab} codeword ${i + 1}` });
    text(s, lab, { x: cx(1) + 16 * 0.125 + 0.06, y: y - 0.02, w: 0.8, h: cs + 0.04, fontSize: 12, color: fresh ? C.accent2 : C.text2, valign: "middle", objectName: `${lab} label` });
  });
  item(2, "Spread header", "The three copies of the header are sent a whole header apart.");
  strips(cx(2), top + 0.98, ["h1", "h1", "h1", "h2", "h2", "h2"], ["h1", "h2", "h1", "h2", "h1", "h2"], "together", "spread");
  // the receiver's way through the header layouts
  const bw = 1.6, g = (8.8 - 4 * bw) / 3, bx = (i) => M + i * (bw + g), y = top + 1.92, bh = 0.95, my = y + bh / 2;
  box(s, bx(0), y, bw, bh, "Read the header", `${CODE.header_coded_bits} bits after the sync word`, { name: "read header", hs: 13, ds: 12 });
  box(s, bx(1), y, bw, bh, "Try the normal layout", "vote, check CRC", { name: "try normal layout", hs: 13, ds: 12 });
  box(s, bx(2), y, bw, bh, "Try the spread layout", "undo spread, vote, check", { name: "try spread layout", line: HEX.accent2, lw: 1.5, hs: 13, ds: 12 });
  box(s, bx(3), y, bw, bh, "Header found", "reported as normal or spread", { name: "header found", hs: 13, ds: 12 });
  [0, 1, 2].forEach((i) => arrow(s, bx(i) + bw + 0.03, my, bx(i + 1) - 0.03, my, { color: C.text2, w: 1.5, name: `flow arrow ${i + 1}` }));
  label(s, "CRC fails", bx(1) + bw - 0.1, my - 0.27, g + 0.2, { name: "normal fails label" });
  label(s, "CRC passes", bx(2) + bw - 0.1, my - 0.27, g + 0.2, { name: "spread passes label" });
  const oy = top + 1.74;
  vline(s, bx(1) + bw / 2, oy, y - oy, { color: C.text2, w: 1.25, name: "normal passes up" });
  hline(s, bx(1) + bw / 2, oy, bx(3) - bx(1), { color: C.text2, w: 1.25, name: "normal passes across" });
  arrow(s, bx(3) + bw / 2, oy, bx(3) + bw / 2, y - 0.03, { color: C.text2, w: 1.25, name: "normal passes down" });
  label(s, "CRC passes", bx(1) + bw / 2 + 0.2, oy - 0.26, 1.2, { align: "left", name: "normal passes label" });
  arrow(s, bx(2) + bw / 2, y + bh + 0.03, bx(2) + bw / 2, y + bh + 0.27, { color: C.text2, w: 1.25, name: "spread fails" });
  label(s, "CRC fails", bx(2) + bw / 2 + 0.12, y + bh + 0.05, 1.0, { align: "left", name: "spread fails label" });
  box(s, bx(2), y + bh + 0.3, bw, 0.38, "Frame lost", "", { name: "frame lost", ink: C.accent2, hs: 13 });
  text(s, "One flag on the transmitter picks the layout. Frames built the old way still decode.", { x: M, y: y + bh + 0.25, w: 4.6, h: 0.5, fontSize: 13, color: C.text2, objectName: "layout flag note" });
}

async function headerFinding() {
  const H = RSTATS.physical.header;
  const { s, top } = content({
    title: "Spreading the header cost frames",
    take: `The header CRC failed in ${H.spread.failed} of ${H.spread.frames} spread header frames and ${H.other.failed} of ${H.other.frames} others.`,
    notes: `This slide shows the one clear effect in the layout test, which went against our expectation. The bars show header CRC failures for each layout, with the spread header layouts in red. The header CRC failed in ${H.spread.failed} of ${H.spread.frames} frames with a spread header, compared with ${H.other.failed} of ${H.other.frames} for the others. If spreading made no difference, a gap this large would occur by chance about ${Math.round(H.fisher_p * 1000)} times in 1000, which is a p value of ${H.fisher_p.toFixed(3)}. Without one short burst, the result is still ${H.mild_spread.failed} of ${H.mild_spread.frames} against ${H.adjacent.observed} of ${H.adjacent.frames}. In simulation spreading the header helped, and we have not found the reason for this difference.`,
  });
  const trimmed = await k.withoutLastLine("fig-physical-header.png");
  const pic = await plot(s, "fig-physical-header.png", { full: trimmed, y: top - 0.08, maxW: 9.4, maxH: 5.15 - top - 0.55, ar: 2.2, name: "header CRC failures by layout", alt: "Header CRC failures for the layouts with the header together and with the header spread" });
  text(s, `p = ${H.fisher_p.toFixed(3)}. If spreading the header made no difference, a gap this big would happen by chance about ${Math.round(H.fisher_p * 1000)} times in 1000.`, { x: M, y: pic.y + pic.h + 0.08, w: 8.8, h: 0.55, fontSize: 16, bold: true, align: "center", objectName: "p in words" });
}

async function physicalReading() {
  const P = STATS.physical, orig = STATS.repetition.filter((r) => ["G22", "G23", "G24", "G25", "G26"].includes(r.group));
  const SHORTL = ["rep-3 side by side", "rep-3 spread apart", "rep-3 spread + header", "Hamming depth 8", "Hamming depth 16", "Hamming depth 16 + header"];
  const rows = [...orig.map((r, i) => [`Glare run ${i + 1}`, r.channel * 100, X.accent]), ...P.layouts.map((l, i) => [SHORTL[i] ?? l.short, l.channel_ber * 100, X.g2])];
    const { s, top } = content({
    title: "What the layout test shows",
    take: "Glare was mild, so heavy bursts went untested. The one clear effect was negative.",
    notes: `This slide compares the layout test with our earlier glare runs, using the channel BER. The red bars are the earlier glare runs, and the grey bars are the six layouts. In the layout test the channel BER was between ${P.channel_ber_range_pct[0]} and ${P.channel_ber_range_pct[1]} percent, compared with ${P.original_glare_channel_ber_range_pct[0]} to ${P.original_glare_channel_ber_range_pct[1]} percent before, so the glare was mild and heavy bursts were not tested. Whether spreading helps against heavy bursts therefore still rests on the simulation.`,
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
  k.section("Extension", "04");
  merged.order();
  merged.simulations();
  layoutsAndFlow();
  merged.layoutTest();
  await headerFinding();
  await physicalReading();
}

module.exports = { build };
