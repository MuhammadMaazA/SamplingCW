"use strict";
// Slides 15 to 24, how the experiments were run, every session, the four changes, the failures.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, plot, content, divider, chartFrame, axes } = k;

function plan() {
  const P = DATA.plan, n = P.labels.length, codes = new Set(P.labels).size, bps = Math.round(1 / P.symbol_duration);
  const SHORT = { none: "U", "rep-3": "r3", "rep-5": "r5", "rep-7": "r7", Ham: "H", "2-D": "2D", "H-int": "HI" };
  const { s, top } = content({
    title: "One plan, two laptops",
    take: "One seed shuffles the same order on both laptops, so no return channel is needed.",
    notes: `Every session starts from a plan file that fixes the codes, payloads, repeats, bit rate and a random seed. The order is shuffled, so slow drift in light is spread over every code. The same seed rebuilds the same order on laptop 2, so we need no return channel. This is the real order of the ${n} trials in the 31 October session.`,
    secs: 35,
  });
  const w = 0.39, gap = 0.03, pitch = w + gap, y1 = top + 0.7, y2 = top + 1.75;
  const strip = (y, name) => P.labels.forEach((l, i) => cell(s, M + i * pitch, y, w, 0.5, SHORT[l], { fs: 14, bold: true, name: `${name} trial ${i + 1}` }));
  text(s, "Laptop 1 sends", { x: M, y: y1 - 0.4, w: 4, h: 0.32, fontSize: 17, fontFace: FONT.semi, objectName: "laptop 1 strip label" });
  text(s, "Laptop 2 rebuilds the same order from the seed", { x: M, y: y2 + 0.6, w: 8, h: 0.32, fontSize: 17, fontFace: FONT.semi, objectName: "laptop 2 strip label" });
  P.labels.forEach((l, i) => vline(s, M + i * pitch + w / 2, y1 + 0.5, y2 - y1 - 0.5, { name: `link ${i + 1}` }));
  strip(y1, "sent");
  strip(y2, "rebuilt");
  cell(s, 4.1, (y1 + 0.5 + y2) / 2 - 0.17, 1.6, 0.34, "", { fill: HEX.lt1, line: HEX.lt1, name: "seed backing" });
  text(s, [{ text: "seed ", options: {} }, { text: String(P.seed), options: { fontFace: FONT.mono } }], { x: 4.1, y: (y1 + 0.5 + y2) / 2 - 0.17, w: 1.6, h: 0.34, fontSize: 15, color: C.text2, align: "center", valign: "middle", objectName: "seed label" });
  text(s, "U uncoded.  r3, r5, r7 repetition 3, 5, 7.  H Hamming.  2D 2-D parity.  HI Hamming interleaved.", { x: M, y: y2 + 1.05, w: 8.8, h: 0.28, fontSize: 14, color: C.text2, objectName: "plan key" });
  text(s, `${n} trials, 3 for each of ${codes} codes, ${P.payload_bits} bit payloads, ${bps} bps, ${P.gap} s between trials`, { x: M, y: y2 + 1.37, w: 8.8, h: 0.28, fontSize: 14, color: C.text2, objectName: "plan facts" });
}

function metrics() {
  const sent = [[1, 1, 1], [0, 0, 0], [1, 1, 1], [1, 1, 1]];
  const got = [[1, 0, 1], [0, 0, 0], [1, 1, 1], [0, 1, 1]];
  const vote = got.map((g) => (g.reduce((a, b) => a + b, 0) >= 2 ? 1 : 0));
  const wrongChannel = got.flat().filter((b, i) => b !== sent.flat()[i]).length;
  const wrongDecoded = vote.filter((v, i) => v !== sent[i][0]).length;
  const { s, top } = content({
    title: "Four numbers per trial",
    take: "A trial can show channel errors and still decode perfectly, so we report both.",
    notes: `Four numbers for every trial. Channel BER counts wrong bits as received. Decoded BER counts wrong message bits after decoding. Throughput is delivered message bits per second of airtime. Frame success is frames fully decoded out of frames planned. In the example ${wrongChannel} of 12 bits were wrong on the channel, yet repetition decoded all four message bits, so we report both.`,
    secs: 40,
  });
  const size = 0.4, gap = 0.06, gg = 0.14, pitch = size + gap, x0 = 1.95, y = top + 0.2;
  const gx = (g, j) => x0 + g * (3 * pitch + gg) + j * pitch;
  text(s, "Sent", { x: M, y, w: 1.3, h: size, fontSize: 18, fontFace: FONT.semi, valign: "middle", objectName: "sent label" });
  text(s, "Received", { x: M, y: y + 0.62, w: 1.3, h: size, fontSize: 18, fontFace: FONT.semi, valign: "middle", objectName: "received label" });
  text(s, "Decoded", { x: M, y: y + 1.5, w: 1.3, h: size, fontSize: 18, fontFace: FONT.semi, valign: "middle", objectName: "decoded label" });
  sent.forEach((g, gi) => g.forEach((b, j) => {
    cell(s, gx(gi, j), y, size, size, b, { fs: 15, name: `sent ${gi + 1}.${j + 1}` });
    const bad = got[gi][j] !== b;
    cell(s, gx(gi, j), y + 0.62, size, size, got[gi][j], { fill: bad ? HEX.accent2 : WHITE, line: bad ? HEX.accent2 : C.text2, color: bad ? C.background1 : C.text1, bold: bad, fs: 15, name: `received ${gi + 1}.${j + 1}` });
  }));
  vote.forEach((v, gi) => {
    const mid = gx(gi, 1) + size / 2;
    arrow(s, mid, y + 1.08, mid, y + 1.44, { color: C.text2, w: 1.25, name: `vote arrow ${gi + 1}` });
    cell(s, mid - size / 2, y + 1.5, size, size, v, { fill: HEX.accent3, line: HEX.accent3, color: C.background1, bold: true, fs: 15, name: `decoded ${gi + 1}` });
  });
  text(s, `${wrongChannel} of 12 wrong`, { x: gx(3, 2) + size + 0.25, y: y + 0.62, w: 1.7, h: size, fontSize: 18, color: C.accent2, fontFace: FONT.semi, valign: "middle", objectName: "channel result" });
  text(s, `${wrongDecoded} of 4 wrong`, { x: gx(3, 2) + size + 0.25, y: y + 1.5, w: 1.7, h: size, fontSize: 18, color: C.accent3, fontFace: FONT.semi, valign: "middle", objectName: "decoded result" });
  const defs = [["Channel BER", "wrong bits received"], ["Decoded BER", "wrong bits after decoding"], ["Throughput", "message bits delivered per second"], ["Frame success", "frames fully decoded"]];
  defs.forEach(([h, d], i) => {
    const x = M + i * 2.2;
    hline(s, x, y + 2.35, 2.0, { color: C.text2, w: 0.75, name: `definition ${i + 1} rule` });
    text(s, h, { x, y: y + 2.45, w: 2.0, h: 0.32, fontSize: 18, fontFace: FONT.semi, objectName: `definition ${i + 1} name` });
    text(s, d, { x, y: y + 2.82, w: 2.0, h: 0.55, fontSize: 14, color: C.text2, objectName: `definition ${i + 1} text` });
  });
}

async function timeline() {
  const { s, top } = content({
    title: "Every recording session",
    take: "Ten recordings in six days, failures and abandoned runs included.",
    notes: "This is every recording we made, in date order, taken from each session log. Marker area is the number of planned trials. Black is mostly delivered, red mostly lost, grey unusable. On 26 October we ran the glare runs, on 27 October the pipeline test, the reflection runs and the outside lab session, then the facing runs on 30 and 31 October.",
    secs: 40,
  });
  await plot(s, "fig-sessions-timeline.png", { y: top, maxW: 8.8, maxH: 5.12 - top, ar: 2.5, name: "all recording sessions", alt: "Every recording session by date and setup, with frames delivered and the sessions that could not be used" });
}

// one slide for each change, the figure on the left and three short lines on the right
async function change(i, c) {
  const { s, top } = content({ title: c.title, notes: c.notes, secs: 35 });
  await plot(s, c.fig, { x: M, y: top + 0.25, h: Math.min(3.2, 5.1 - top - 0.25), ar: 4.3 / 3.2, name: `change ${i} figure`, alt: c.alt });
  text(s, `Change ${i} of 4`, { x: 5.45, y: top + 0.25, w: 3.9, h: 0.28, fontSize: 14, color: C.text2, objectName: "change counter" });
  [["What changed", c.changed], ["What we saw", c.saw], ["Why we think so", c.why]].forEach(([h, t], j) => {
    const y = top + 0.75 + j * 1.05;
    hline(s, 5.45, y - 0.08, 3.95, { name: `change line ${j + 1}` });
    text(s, h, { x: 5.45, y, w: 3.9, h: 0.26, fontSize: 14, color: C.text2, objectName: `change label ${j + 1}` });
    text(s, t, { x: 5.45, y: y + 0.3, w: 3.95, h: 0.66, fontSize: 18, objectName: `change text ${j + 1}` });
  });
}

async function changes() {
  const CH = STATS.changes, fr = (o) => `${o.frames} of ${o.trials}`;
  const sf = CH["speed-facing"], pa = CH.path, li = CH.lighting, sg = CH["speed-glare"];
  const glare = li.b.channel_ber_pct, lo = Math.min(...glare).toFixed(1), hi = Math.max(...glare).toFixed(1);
  const g27 = sg.b.channel_ber_pct[0].toFixed(1);
  await change(1, {
    title: "Speed, facing the screen", fig: "fig-change-speed-facing.png", alt: "Frames delivered and channel error rate at 3 and 8 bps facing the screen",
    changed: "Speed, 3 then 8 bps, facing the screen", saw: `Frames delivered fell from ${fr(sf.a)} to ${fr(sf.b)}`, why: "At 8 bps white smears into the next bit",
    notes: `Change one is speed, facing the screen. At 3 bits per second we delivered ${fr(sf.a)} frames, at 8 bits per second ${fr(sf.b)}. At 8 bits per second the camera gets only about 4 samples per bit, so white smears into the next symbol. The two days also differ in room, so speed is not the only change.`,
  });
  await change(2, {
    title: "Camera path at 4 bps", fig: "fig-change-path.png", alt: "Frames delivered and channel error rate for the reflection and the facing path at 4 bps",
    changed: "Camera path, reflection or facing", saw: `Both clean, ${fr(pa.a)} against ${fr(pa.b)}`, why: "Facing has only 2 trials, so we make no claim",
    notes: `Change two is the camera path in the lab at 4 bits per second. Reflection delivered ${fr(pa.a)} frames and facing ${fr(pa.b)}, both with no meaningful bit errors. The facing run has only 2 trials, so we make no claim from it.`,
  });
  await change(3, {
    title: "Dimming the lab", fig: "fig-change-lighting.png", alt: "Channel error rate of each reflection group in normal light and in the dimmed lab with glare",
    changed: "Lighting, normal then dim with glare", saw: `BER rose to ${lo} to ${hi} percent, frames fell to ${fr(li.b)}`, why: "Glare lifts the black level after each flash",
    notes: `Change three is dimming the lab. With normal light the reflection delivered ${fr(li.a)} frames. With the lights down and glare, channel BER rose to between ${lo} and ${hi} percent and ${fr(li.b)} frames got through. The dim runs used only repetition-3, so compare repetition-3 with repetition-3.`,
  });
  await change(4, {
    title: "Speed in glare", fig: "fig-change-speed-glare.png", alt: "Frames delivered and channel error rate in glare at 4 bps and at 2 bps",
    changed: "Speed in glare, 4 then 2 bps", saw: `Frames delivered rose to ${fr(sg.b)}, channel BER fell to ${g27} percent`, why: "More samples per bit, or milder glare",
    notes: `Change four is halving the speed in glare. At 4 bits per second we delivered ${fr(sg.a)} frames, at 2 bits per second ${fr(sg.b)}, with channel BER down to ${g27} percent. Halving the rate doubles the samples per bit, but the glare that session may simply have been milder. One session cannot separate the two, so it is a confound, not a result.`,
  });
}

function frameLoss() {
  const F = STATS.failures;
  const SHORT = { "Facing screen, 3 bps": "Facing, 3 bps", "Facing screen, 8 bps": "Facing, 8 bps", "Facing screen, 4 bps": "Facing, 4 bps",
    "Reflection, 4 bps": "Reflection, 4 bps", "Reflection with glare, 4 bps": "Glare, 4 bps", "Reflection with glare, 2 bps": "Glare, 2 bps" };
  const total = F.reduce((t, r) => t + r.trials, 0);
  const { s, top } = content({
    title: "Where whole frames were lost",
    take: "Glare kills frames at the header CRC, speed at the payload CRC.",
    notes: `Bit error rate hides the worst failure, losing the whole frame, so this counts all ${total} planned trials. Black is delivered. At 8 bits per second frames arrive but fail the payload CRC, which the codes can fight. In the dim lab with glare, 9 of 15 frames die at the header CRC, so the payload code never gets a chance. At 3 bits per second, 6 frames were cut short.`,
    secs: 40,
  });
  const labels = F.map((r) => SHORT[r.env]);
  // name, key, fill, label colour on that fill
  const series = [
    ["Delivered", "valid_frames", X.ink, X.white], ["Payload CRC failed", "payload_crc_failures", X.accent, X.white],
    ["Header CRC failed", "header_crc_failures", X.tint2, X.ink], ["Uncorrectable", "uncorrectable", X.g1, X.white],
    ["Cut short", "truncated", X.g2, X.ink], ["Sync not found", "sync_failures", X.g3, X.ink],
  ];
  const cx = M, cy = top, cw = 8.8, ch = 5.15 - top - 0.62;
  const lay = { x: 0.18, y: 0.04, w: 0.8, h: 0.92 };
  s.addChart(pres.charts.BAR, series.map(([name, key]) => ({ name, labels, values: F.map((r) => r[key]) })), {
    x: cx, y: cy, w: cw, h: ch, barDir: "bar", barGrouping: "stacked", barGapWidthPct: 45, chartColors: series.map((x) => x[2]),
    showLegend: false, catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: 24, valAxisMajorUnit: 4, valAxisHidden: true,
    layout: lay, ...chartFrame, objectName: "frame loss chart",
  });
  const px = cx + lay.x * cw, pw = lay.w * cw, py = cy + lay.y * ch, band = (lay.h * ch) / F.length, unit = pw / 24;
  F.forEach((r, i) => {
    let cum = 0;
    series.forEach(([name, key, , ink]) => {
      const v = r[key];
      if (v > 0) {
        const num = { text: String(v), options: { fontFace: FONT.mono } };
        const lab = v * unit > 2.0 ? [{ text: `${name}  `, options: {} }, num] : [num];
        text(s, lab, { x: px + (cum + v / 2) * unit - 1.2, y: py + (i + 0.5) * band - 0.14, w: 2.4, h: 0.28, fontSize: 14, bold: true, color: ink, align: "center", valign: "middle", objectName: `${labels[i]} ${name} count` });
      }
      cum += v;
    });
  });
  const ly = cy + ch + 0.08;
  series.forEach(([name, , fill], i) => {
    const lx = M + (i % 3) * 2.95, lyy = ly + Math.floor(i / 3) * 0.28;
    cell(s, lx, lyy + 0.05, 0.2, 0.18, "", { fill, line: fill === X.g3 ? X.g2 : fill, name: `legend ${name}` });
    text(s, name, { x: lx + 0.3, y: lyy, w: 2.5, h: 0.28, fontSize: 14, color: C.text2, valign: "middle", objectName: `legend ${name} label` });
  });
}

function failures() {
  const O = DATA.outside_lab, B = DATA.ordering_bug, n = B.expected.length;
  const { s, top } = content({
    title: "Runs that did not work",
    take: "The failures were ours, a plan too long and a printed command in the wrong order.",
    notes: `Every failed recording and what it taught us. Outside the lab the plan needed ${(O.planned_s / 60).toFixed(0)} minutes of airtime and recording stopped after ${(O.recorded_s / 60).toFixed(0)}, so only 3 of ${O.trials} trials were filmed, a planning failure. On the right, a bug in how the transmit command was printed reordered the codes, so ${B.differ} of ${n} trials were in a different place and the first analysis decoded nothing. A third run stopped when the camera repeated timestamps.`,
    secs: 45,
  });
  // left, planned against recorded airtime
  text(s, `Outside the lab, ${O.bit_rate} bps`, { x: M, y: top + 0.05, w: 4.0, h: 0.34, fontSize: 18, fontFace: FONT.semi, objectName: "airtime head" });
  s.addChart(pres.charts.BAR, [{ name: "Minutes", labels: ["Planned", "Recorded"], values: [O.planned_s / 60, O.recorded_s / 60] }], {
    x: M, y: top + 0.4, w: 4.0, h: 2.2, barDir: "bar", barGapWidthPct: 50, chartColors: [HEX.accent4, HEX.accent2], catAxisOrientation: "maxMin",
    showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", valAxisMinVal: 0, valAxisMaxVal: 70, valAxisMajorUnit: 20,
    ...chartFrame, ...axes("Minutes of airtime"), objectName: "airtime chart",
  });
  text(s, "Only 3 of 21 trials were filmed", { x: M, y: top + 2.7, w: 4.0, h: 0.32, fontSize: 17, color: C.accent2, fontFace: FONT.semi, objectName: "airtime verdict" });
  // right, red marks the trials that sat in a different place on laptop 1 than laptop 2 expected
  vline(s, 4.95, top + 0.1, 2.95, { name: "failure divider" });
  text(s, "A command in the wrong order", { x: 5.25, y: top + 0.05, w: 4.15, h: 0.34, fontSize: 18, fontFace: FONT.semi, objectName: "order head" });
  const cw = 0.17, cg = 0.025, cp = cw + cg, rx = 5.25;
  text(s, "Trial order laptop 2 expected", { x: rx, y: top + 0.62, w: 4.15, h: 0.28, fontSize: 14, color: C.text2, objectName: "order strip label" });
  B.expected.forEach((l, i) => {
    const bad = B.expected[i] !== B.sent[i];
    cell(s, rx + i * cp, top + 1.0, cw, 0.6, "", { fill: bad ? HEX.accent2 : WHITE, line: bad ? HEX.accent2 : C.text2, name: `planned trial ${i + 1}` });
  });
  text(s, `${B.differ} of ${n} trials, in red, were sent in a different place`, { x: rx, y: top + 1.8, w: 4.15, h: 0.6, fontSize: 17, color: C.accent2, fontFace: FONT.semi, objectName: "order verdict" });
  hline(s, M, top + 3.3, 8.8, { name: "failure footer rule" });
  text(s, `A third run stopped after 16.7 s when the camera repeated timestamps`, { x: M, y: top + 3.4, w: 8.8, h: 0.3, fontSize: 15, color: C.text2, objectName: "timestamp note" });
}

async function build() {
  k.speaker("Maaz");
  divider({ index: 2, title: "Experiments", sub: "How we ran them, what changed, and what failed",
    notes: "Now how every session worked and what we changed. Kanav then covers the frames we lost and the runs that failed." });
  plan();
  metrics();
  await timeline();
  await changes();
  k.speaker("Kanav");
  frameLoss();
  failures();
}

module.exports = { build };
