"use strict";
// Slides 17 to 25, how the experiments were run, every session, the three changes and the failures.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, plot, content, divider, chartFrame, axes, setupKey, setupLabel, setupRow } = k;

const SHORT = { none: "U", "rep-3": "r3", "rep-5": "r5", "rep-7": "r7", Ham: "H", "2-D": "2D", "H-int": "HI" };

function plan() {
  const P = DATA.plan, n = P.labels.length, codes = new Set(P.labels).size, bps = Math.round(1 / P.symbol_duration);
  const { s, top } = content({
    title: "How the plan works",
    take: "Both laptops make the same shuffled order from one seed, so nothing is sent back.",
    notes: `A plan fixes the codes, the payloads, the repeats, the bit rate and a random seed. Laptop 2, which records, saves the plan. Laptop 1, which sends, builds the same shuffled order from the same seed and settings, so nothing is sent back. Laptop 2 can then match every recording to what laptop 1 sent. The strips show the ${n} trials of the 31 October session.`,
  });
  const w = 0.39, gap = 0.03, pitch = w + gap, sh = 0.45;
  const yA = top + 0.42, yBox = yA + sh + 0.45, yB = yBox + 0.6 + 0.43;
  const strip = (y, name) => P.labels.forEach((l, i) => cell(s, M + i * pitch, y, w, sh, SHORT[l], { fs: 14, bold: true, name: `${name} trial ${i + 1}` }));
  text(s, "Laptop 2 records and saves the plan", { x: M, y: yA - 0.37, w: 8, h: 0.32, fontSize: 17, fontFace: FONT.semi, objectName: "laptop 2 strip label" });
  strip(yA, "laptop 2");
  const cx = M + 4.4;
  arrow(s, cx, yBox - 0.02, cx, yA + sh + 0.06, { color: C.text2, w: 1.5, name: "seed to laptop 2" });
  cell(s, M + 1.7, yBox, 5.4, 0.6, "", { fill: WHITE, line: C.text1, lw: 1.25, name: "seed box" });
  text(s, `Seed ${P.seed} and the same settings`, { x: M + 1.7, y: yBox + 0.05, w: 5.4, h: 0.28, fontSize: 17, fontFace: FONT.semi, align: "center", objectName: "seed box head" });
  text(s, `${n} trials, 3 for each of ${codes} codes, ${P.payload_bits} bit payloads, ${bps} bps`, { x: M + 1.7, y: yBox + 0.32, w: 5.4, h: 0.26, fontSize: 14, color: C.text2, align: "center", objectName: "seed box facts" });
  arrow(s, cx, yBox + 0.6 + 0.02, cx, yB - 0.06, { color: C.text2, w: 1.5, name: "seed to laptop 1" });
  strip(yB, "laptop 1");
  text(s, "Laptop 1 builds the same order and sends it", { x: M, y: yB + sh + 0.07, w: 8, h: 0.32, fontSize: 17, fontFace: FONT.semi, objectName: "laptop 1 strip label" });
  text(s, "U uncoded.  r3, r5, r7 repetition with 3, 5, 7 copies.  H Hamming.  2D 2-D parity.  HI Hamming with interleaving.", { x: M, y: yB + sh + 0.5, w: 8.8, h: 0.26, fontSize: 13, color: C.text2, objectName: "plan key" });
}

function metrics() {
  const sent = [[1, 1, 1], [0, 0, 0], [1, 1, 1], [1, 1, 1]];
  const got = [[1, 0, 1], [0, 0, 0], [1, 1, 1], [0, 1, 1]];
  const vote = got.map((g) => (g.reduce((a, b) => a + b, 0) >= 2 ? 1 : 0));
  const wrongChannel = got.flat().filter((b, i) => b !== sent.flat()[i]).length;
  const wrongDecoded = vote.filter((v, i) => v !== sent[i][0]).length;
  const { s, top } = content({
    title: "Four numbers for every trial",
    take: `In this example ${wrongChannel} of 12 bits arrive wrong, but all 4 message bits decode correctly.`,
    notes: `We record four numbers for every trial. Channel BER is the share of bits that arrive wrong, where BER means bit error rate. Decoded BER is the share of message bits that are wrong after decoding. Throughput is the message bits delivered per second. Frame success is the share of frames that decode correctly. In the example ${wrongChannel} of 12 bits arrive wrong, but repetition fixes both, so the decoded BER is zero.`,
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
  const defs = [["Channel BER", "share of bits that arrive wrong"], ["Decoded BER", "share of message bits wrong after decoding"], ["Throughput", "message bits delivered per second"], ["Frame success", "share of frames that decode correctly"]];
  defs.forEach(([h, d], i) => {
    const x = M + i * 2.2;
    hline(s, x, y + 2.35, 2.0, { color: C.text2, w: 0.75, name: `definition ${i + 1} rule` });
    text(s, h, { x, y: y + 2.45, w: 2.0, h: 0.32, fontSize: 18, fontFace: FONT.semi, objectName: `definition ${i + 1} name` });
    text(s, d, { x, y: y + 2.82, w: 2.0, h: 0.62, fontSize: 14, color: C.text2, objectName: `definition ${i + 1} text` });
  });
}

async function timeline() {
  const { s, top } = content({
    title: "The recording sessions",
    take: "Every session from 26 to 31 October, in order. Grey dots gave nothing we could use.",
    notes: "Every session from 26 to 31 October, in the order we recorded them. The size of a dot is the number of trials we planned. Black dots delivered most of their frames, red dots lost most of theirs, and grey dots gave us nothing we could use. The 6 November test comes later.",
  });
  await plot(s, "fig-sessions-timeline.png", { y: top, maxW: 9.4, maxH: 5.15 - top, ar: 2.5, name: "all recording sessions", alt: "Every session from 26 to 31 October by date and setup, with frames delivered and the sessions that gave nothing usable" });
}

// one slide for each change, the picture on the left and three short lines on the right
async function change(i, c) {
  const { s, top } = content({ title: c.title, notes: c.notes });
  const p = await plot(s, c.fig, { x: M, y: top - 0.05, h: Math.min(3.65, 5.15 - top + 0.05), ar: 4.3 / 3.2, name: `change ${i} picture`, alt: c.alt });
  const x = M + p.w + 0.3, w = 9.4 - x;
  text(s, `Change ${i} of 3`, { x, y: top - 0.05, w, h: 0.28, fontSize: 14, color: C.text2, objectName: "change counter" });
  [["What changed", c.changed], ["What we saw", c.saw], ["Likely reason", c.why]].forEach(([h, t], j) => {
    const y = top + 0.3 + j * 1.15;
    hline(s, x, y - 0.08, w, { name: `change line ${j + 1}` });
    text(s, h, { x, y, w, h: 0.26, fontSize: 14, color: C.text2, objectName: `change label ${j + 1}` });
    text(s, t, { x, y: y + 0.28, w, h: 0.82, fontSize: 15, objectName: `change text ${j + 1}` });
  });
}

async function changes() {
  const CH = STATS.changes, fr = (o) => `${o.frames} of ${o.trials}`;
  const sf = CH["speed-normal"] ?? CH["speed-facing"] ?? CH.speed, li = CH.lighting, sg = CH["speed-glare"];
  const glare = li.b.channel_ber_pct, lo = Math.min(...glare).toFixed(1), hi = Math.max(...glare).toFixed(1);
  const g27 = sg.b.channel_ber_pct[0].toFixed(1);
  const r3 = STATS.tradeoff.find((r) => setupKey(r.env) === "n4" && r.method === "rep-3");
  const r3ok = r3 ? r3.ok.replace("/", " of ") : "3 of 3";
  await change(1, {
    title: "Changing the speed from 3 to 8 bps", fig: "fig-change-speed-normal.png", alt: "Frames delivered and channel BER at 3 bps and at 8 bps in normal light",
    changed: "The speed went from 3 to 8 bps, in normal light.", saw: `Frames delivered fell from ${fr(sf.a)} to ${fr(sf.b)}.`, why: "At 8 bps the camera gets about 4 samples per bit, so a white flash carries over into the next bit.",
    notes: `Change one is the speed in normal light. At 3 bits per second we delivered ${fr(sf.a)} frames, at 8 bits per second ${fr(sf.b)}. With only about 4 samples per bit at 8 bits per second, a white flash carries into the next bit. The sessions were on different days, so speed may not be the only difference.`,
  });
  await change(2, {
    title: "Dimming the room", fig: "fig-change-lighting.png", alt: "Frames delivered and channel BER of each group in normal light and in dim light with glare, both at 4 bps",
    changed: "The room went from normal light to dim with glare, at 4 bps.", saw: `Channel BER rose to between ${lo} and ${hi} percent. Frames delivered fell from ${fr(li.a)} to ${fr(li.b)}.`, why: "Glare raises the black level after each white flash.",
    notes: `Change two is the light. In normal light at 4 bits per second we delivered ${fr(li.a)} frames. With the room dim and glare on, channel BER rose to between ${lo} and ${hi} percent and ${fr(li.b)} frames were delivered. The dim runs only used repetition-3, so the fair comparison is repetition-3 in normal light, ${r3ok}, against ${fr(li.b)}.`,
  });
  await change(3, {
    title: "Halving the speed in glare", fig: "fig-change-speed-glare.png", alt: "Frames delivered and channel BER in dim light with glare at 4 bps and at 2 bps",
    changed: "The speed went from 4 to 2 bps, in dim light with glare.", saw: `Frames delivered rose from ${fr(sg.a)} to ${fr(sg.b)}, and channel BER fell to ${g27} percent.`, why: "More samples per bit may have helped, or the glare may have been milder that day.",
    notes: `Change three is halving the speed in glare. At 4 bits per second we delivered ${fr(sg.a)} frames, at 2 bits per second ${fr(sg.b)}, with channel BER down to ${g27} percent. More samples per bit may have helped, or the glare may have been milder that day. One session cannot tell which, so we do not claim it.`,
  });
}

function frameLoss() {
  const F = DATA.failures;
  const total = F.reduce((t, r) => t + r.trials, 0);
  const glare = setupRow(F, "g4", "display"), fast = setupRow(F, "n8", "display"), slow = setupRow(F, "n3", "display");
  const { s, top } = content({
    title: "Where the frames were lost",
    take: `In glare ${glare.header_crc_failures} of ${glare.trials} frames fail the header CRC. At 8 bps ${fast.payload_crc_failures} of ${fast.trials} fail the payload CRC.`,
    notes: `This counts what happened to each of the ${total} planned trials. Black is a frame that decoded correctly. In the dim room with glare, ${glare.header_crc_failures} of ${glare.trials} frames failed the header CRC, so the payload code never got used. At 8 bits per second the frames arrived, but ${fast.payload_crc_failures} of ${fast.trials} failed the payload CRC. At 3 bits per second, ${slow.truncated} frames were cut short because the recording ended.`,
  });
  const labels = F.map((r) => r.display), maxTrials = Math.max(...F.map((r) => r.trials));
  const series = [
    ["Delivered", "valid_frames", X.ink, X.white], ["Payload CRC failed", "payload_crc_failures", X.accent, X.white],
    ["Header CRC failed", "header_crc_failures", X.tint2, X.ink], ["Uncorrectable", "uncorrectable", X.g1, X.white],
    ["Cut short", "truncated", X.g2, X.ink], ["Sync word not found", "sync_failures", X.g3, X.ink],
  ];
  const cx = M, cy = top, cw = 8.8, ch = 5.15 - top - 0.62;
  const lay = { x: 0.2, y: 0.04, w: 0.78, h: 0.92 };
  s.addChart(pres.charts.BAR, series.map(([name, key]) => ({ name, labels, values: F.map((r) => r[key]) })), {
    x: cx, y: cy, w: cw, h: ch, barDir: "bar", barGrouping: "stacked", barGapWidthPct: 45, chartColors: series.map((x) => x[2]),
    showLegend: false, catAxisOrientation: "maxMin", valAxisMinVal: 0, valAxisMaxVal: maxTrials, valAxisMajorUnit: 3, valAxisHidden: true,
    layout: lay, ...chartFrame, objectName: "frame loss chart",
  });
  const px = cx + lay.x * cw, pw = lay.w * cw, py = cy + lay.y * ch, band = (lay.h * ch) / F.length, unit = pw / maxTrials;
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
    title: "Runs that failed",
    take: "Two of these failures were our own mistakes, and a third came from the camera.",
    notes: `On 27 October we recorded in a different place at ${O.bit_rate} bits per second. The plan needed ${(O.planned_s / 60).toFixed(0)} minutes but the recording stopped after ${(O.recorded_s / 60).toFixed(0)}, so only 3 of ${O.trials} trials were filmed. Separately, the command that started laptop 1 listed the codes in a different order from the plan on laptop 2, so ${B.differ} of ${n} trials did not match. We fixed that by analysing against what laptop 1 sent. A third run stopped when the camera repeated timestamps.`,
  });
  text(s, `A different place, ${O.bit_rate} bps`, { x: M, y: top + 0.05, w: 4.0, h: 0.34, fontSize: 18, fontFace: FONT.semi, objectName: "airtime head" });
  s.addChart(pres.charts.BAR, [{ name: "Minutes", labels: ["Planned", "Recorded"], values: [O.planned_s / 60, O.recorded_s / 60] }], {
    x: M, y: top + 0.4, w: 4.0, h: 2.2, barDir: "bar", barGapWidthPct: 50, chartColors: [X.g2, X.accent], catAxisOrientation: "maxMin",
    showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0", valAxisMinVal: 0, valAxisMaxVal: 70, valAxisMajorUnit: 20,
    ...chartFrame, ...axes("Minutes of recording"), objectName: "airtime chart",
  });
  text(s, "Only 3 of 21 trials were filmed", { x: M, y: top + 2.7, w: 4.0, h: 0.32, fontSize: 17, color: C.accent2, fontFace: FONT.semi, objectName: "airtime verdict" });
  vline(s, 4.95, top + 0.1, 2.95, { name: "failure divider" });
  text(s, "A command in the wrong order", { x: 5.25, y: top + 0.05, w: 4.15, h: 0.34, fontSize: 18, fontFace: FONT.semi, objectName: "order head" });
  const cw = 0.17, cg = 0.025, cp = cw + cg, rx = 5.25;
  text(s, "The trial order laptop 2 expected", { x: rx, y: top + 0.62, w: 4.15, h: 0.28, fontSize: 14, color: C.text2, objectName: "order strip label" });
  B.expected.forEach((l, i) => {
    const bad = B.expected[i] !== B.sent[i];
    cell(s, rx + i * cp, top + 1.0, cw, 0.6, "", { fill: bad ? HEX.accent2 : WHITE, line: bad ? HEX.accent2 : C.text2, name: `planned trial ${i + 1}` });
  });
  text(s, `${B.differ} of ${n} trials, in red, were sent at a different position.`, { x: rx, y: top + 1.8, w: 4.15, h: 0.6, fontSize: 17, color: C.accent2, fontFace: FONT.semi, objectName: "order verdict" });
  hline(s, M, top + 3.3, 8.8, { name: "failure footer rule" });
  text(s, "A third run stopped after 16.7 s when the camera repeated timestamps.", { x: M, y: top + 3.4, w: 8.8, h: 0.3, fontSize: 15, color: C.text2, objectName: "timestamp note" });
}

async function build() {
  k.speaker("Maaz");
  divider({ index: 2, title: "Experiments", sub: "How we ran the experiments, what we changed and which runs failed.",
    notes: "Now how we ran the sessions and what we changed." });
  plan();
  metrics();
  await timeline();
  await changes();
  frameLoss();
  failures();
}

module.exports = { build };
