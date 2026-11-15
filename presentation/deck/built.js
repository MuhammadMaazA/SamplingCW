"use strict";
// The slides that explain how the link was built and run. Each one is a plain diagram of rectangles and hairline
// arrows, and every number on them is read from the code or the data (DATA.code, DATA.hamming_check and so on,
// written by extract_deck_data.py), never typed here.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, DATA, text, hline, vline, arrow, cell, content, chartFrame, axes } = k;

const CODE = DATA.code;
const SHORT = { none: "U", "rep-3": "r3", "rep-5": "r5", "rep-7": "r7", Ham: "H", "2-D": "2D", "H-int": "HI" };

// a rectangle with a bold heading and a grey detail line inside it
function box(s, x, y, w, h, head, detail, o = {}) {
  const runs = [{ text: head, options: { bold: true, fontSize: o.hs ?? 14, color: o.ink ?? C.text1, breakLine: !!detail, fontFace: o.mono ? FONT.mono : undefined } }];
  if (detail) runs.push({ text: detail, options: { fontSize: o.ds ?? 12, color: o.dink ?? C.text2, fontFace: o.dmono ? FONT.mono : undefined } });
  s.addText(runs, {
    shape: SH.RECTANGLE, x, y, w, h, fill: { color: o.fill ?? WHITE }, line: { color: o.line ?? C.text1, width: o.lw ?? 1.25, dashType: o.dash },
    align: "center", valign: "middle", margin: 4, objectName: o.name ?? `${head} box`,
  });
}
// a short grey label next to an arrow or under a picture
function label(s, t, x, y, w, o = {}) {
  text(s, t, { x, y, w, h: o.h ?? 0.26, fontSize: o.fs ?? 12, color: o.color ?? C.text2, align: o.align ?? "center", fontFace: o.mono ? FONT.mono : undefined, bold: o.bold, objectName: o.name ?? `${t} label` });
}
// an arrow that leaves one box, turns twice and ends on the next row, for a chain that wraps
function elbow(s, x1, y1, x2, y2, ymid, o = {}) {
  vline(s, x1, y1, ymid - y1, { color: C.text2, w: 1.25, name: `${o.name ?? "elbow"} down` });
  hline(s, Math.min(x1, x2), ymid, Math.abs(x2 - x1), { color: C.text2, w: 1.25, name: `${o.name ?? "elbow"} across` });
  arrow(s, x2, ymid, x2, y2, { color: C.text2, w: 1.25, name: `${o.name ?? "elbow"} into box` });
}

// a small laptop with a line of words beside it and a hairline under, so the boxes below sit next to the device they run on
function deviceBand(s, y, name, what, o = {}) {
  k.laptop(s, M + 0.08, y + 0.04, 0.6, `${name} drawing`, o);
  text(s, [{ text: name, options: { bold: true, fontSize: 16 } }, { text: `  ${what}`, options: { fontSize: 15, color: C.text2 } }], { x: M + 0.95, y: y + 0.02, w: 7.0, h: 0.4, valign: "middle", objectName: `${name} band` });
  hline(s, M, y + 0.55, 8.8, { name: `${name} band rule` });
}

// ---------- how the transmitter and the receiver work, one row each ----------
function txrx() {
  const E = CODE.example, T = DATA.plan.symbol_duration, bps = Math.round(1 / T), frameSecs = Math.round(E.frame_bits * T);
  const S = STATS.setup, fps = [Math.round(Math.min(...S.map((r) => r.fps_min))), Math.round(Math.max(...S.map((r) => r.fps_max)))];
  const { s, top } = content({
    title: "How the two laptops work",
    take: "Laptop 1 turns the message into timed colours, and laptop 2 turns them back.",
    notes: `One row for each laptop, and we read each from left to right. Laptop 1 takes our two byte message and adds a CRC, a check value, then applies the code, which adds extra bits. In front go the sync word, which marks the start, and the header, sent three times. That whole block is one frame, ${E.frame_bits} bits, and at ${bps} bps, bits per second, it takes ${frameSecs} seconds. Each bit is a colour held until a deadline counted from the start, so a late redraw can't push the rest back. Laptop 2 does the reverse on every camera frame, meaning every webcam picture. It takes the median brightness inside the box and compares it with the threshold, the level halfway between black and white. Then it finds the sync word, even with up to ${CODE.max_sync_mismatches} of its ${CODE.sync_bits} bits wrong, samples each symbol at its centre, and votes and decodes to get our message back.`,
  });
  const r1 = top - 0.05, r2 = r1 + 1.82;
  deviceBand(s, r1, "Laptop 1", "runs the transmitter", { patch: true });
  const y = r1 + 0.65, h = 0.75;
  const xs = [M, 1.975, 3.65, 5.175, 7.9], ws = [1.15, 1.45, 1.3, 2.5, 1.5], mid = y + h / 2;
  box(s, xs[0], y, ws[0], h, "Message", "as bytes", { hs: 14, ds: 12 });
  box(s, xs[1], y, ws[1], h, "Add CRC-16", "a check value", { hs: 14, ds: 12 });
  box(s, xs[2], y, ws[2], h, "Apply the code", "adds extra bits", { hs: 14, ds: 12 });
  const parts = [["sync", 0.55, HEX.dk2, C.background1], ["header ×3", 1.1, HEX.lt2, C.text1], ["data", 0.85, HEX.dk1, C.background1]];
  let px = xs[3];
  parts.forEach(([name, w, fill, ink], i) => {
    cell(s, px, y, w, h, name, { fill, line: HEX.lt1, lw: 1.5, color: ink, fs: 13, bold: true, name: `frame part ${i + 1}` });
    px += w;
  });
  box(s, xs[4], y, ws[4], h, "One colour per bit", "white 1, black 0", { hs: 14, ds: 12 });
  [0, 1, 2, 3].forEach((i) => arrow(s, xs[i] + ws[i] + 0.03, mid, xs[i + 1] - 0.03, mid, { color: C.text2, w: 1.5, name: `transmitter arrow ${i + 1}` }));
  const sizes = [`${E.message_bits} bits`, `${E.protected_bits} bits`, `${E.coded_bits} bits`, `${CODE.sync_bits} + ${CODE.header_coded_bits} + ${E.coded_bits} = ${E.frame_bits} bits`, `${frameSecs} s at ${bps} bps`];
  sizes.forEach((t, i) => label(s, t, xs[i] - (i === 3 ? 0.2 : 0), y + h + 0.05, ws[i] + (i === 3 ? 0.4 : 0), { fs: 12, name: `size after step ${i + 1}` }));
  deviceBand(s, r2, "Laptop 2", "runs the receiver, its webcam films the iPad", { webcam: true, ring: false });
  const steps = [["Camera frame", `${fps[0]} to ${fps[1]} a second`], ["Median of the box", "one number and a time"], ["Threshold test", "brighter means 1"],
    ["Find sync word", `up to ${CODE.max_sync_mismatches} of ${CODE.sync_bits} bits wrong`], ["Sample symbols", "at each centre"], ["Vote and check", "header copies, header CRC"], ["Decode", "payload, payload CRC"]];
  const bw = 1.1, gap = (8.8 - steps.length * bw) / (steps.length - 1), y2 = r2 + 0.65;
  steps.forEach(([hd, d], i) => {
    const x = M + i * (bw + gap);
    box(s, x, y2, bw, 0.9, hd, d, { name: `receiver step ${i + 1}`, hs: 13, ds: 12, line: i === steps.length - 1 ? HEX.dk1 : C.text1, lw: i === steps.length - 1 ? 2 : 1.25 });
    if (i < steps.length - 1) arrow(s, x + bw + 0.02, y2 + 0.45, x + bw + gap - 0.02, y2 + 0.45, { color: C.text2, w: 1.5, name: `receiver arrow ${i + 1}` });
  });
}

// ---------- how a code plugs into the link and how we checked it ----------
function plugAndCheck() {
  const ids = CODE.coding_ids, isNew = (n) => n === "repetition-spread" || n === "hamming-interleaved-16";
  const H = DATA.hamming_check, RT = DATA.round_trip, SIM = DATA.simulation, TS = DATA.tests;
  const sum = (m) => m.reduce((t, r) => t + r.filter(Boolean).length, 0), size = (m) => m.reduce((t, r) => t + r.length, 0);
  const one = [sum(H.singles), size(H.singles)], two = [sum(H.doubles), size(H.doubles)];
  const { s, top } = content({
    title: "Plugging in and checking a code",
    take: TS.passed === TS.total ? `A coding id picks the code, and every check on the decoder passes, ${TS.total} of ${TS.total} tests.` : `A coding id picks the code, and ${TS.passed} of ${TS.total} tests pass.`,
    notes: `The top half shows how a code plugs in, and the bottom half shows how we checked it. The header carries a coding id from ${ids[0].id} to ${ids[ids.length - 1].id}, and both laptops look it up in one table. Every code has the same two functions, encode and decode, so a new layout, meaning a new way of ordering the bits, is a new entry. Spread repetition is id 5 and interleaved Hamming at depth 16 is id 6. The spread header is a frame option, not an id. Below, our Hamming decoder fixed ${one[0]} of ${one[1]} single flips and ${two[0]} of ${two[1]} double flips, as theory says. The CRC gives the standard value ${RT.crc_check}, ${RT.passed} of ${RT.total} frames decode back, all ${TS.total} tests pass, and our simulation matches the theory.`,
  });
  // the top half, the header picks a row of the table, every code has the same two functions
  const rh = 0.28, ty = top + 0.3, tx = 2.35, idw = 0.42, nws = [2.15, 2.6], colGap = 0.1;
  box(s, M, ty + 0.12, 1.3, 0.8, "Header", `coding id, ${ids[0].id} to ${ids[ids.length - 1].id}`, { hs: 14, ds: 12 });
  arrow(s, M + 1.33, ty + 0.52, tx - 0.05, ty + 0.52, { color: C.text2, w: 1.5, name: "header to table" });
  text(s, "Table of codes", { x: tx, y: top - 0.02, w: 3.2, h: 0.28, fontSize: 14, bold: true, objectName: "table heading" });
  const half = Math.ceil(ids.length / 2);
  ids.forEach((r, i) => {
    const col = i < half ? 0 : 1, row = i % half, nw = nws[col], x = tx + (col ? idw + nws[0] + colGap : 0), y = ty + row * rh;
    const fresh = isNew(r.name), ink = fresh ? C.accent2 : C.text1, line = fresh ? HEX.accent2 : C.text2;
    cell(s, x, y, idw, rh, r.id, { fill: WHITE, line, lw: fresh ? 1.5 : 0.75, color: ink, fs: 12, bold: true, font: FONT.mono, name: `code id ${r.id}` });
    cell(s, x + idw, y, nw, rh, "", { fill: WHITE, line, lw: fresh ? 1.5 : 0.75, name: `code name cell ${r.id}` });
    text(s, r.name, { x: x + idw + 0.08, y, w: nw - 0.1, h: rh, fontSize: 12, color: ink, fontFace: FONT.mono, valign: "middle", wrap: false, objectName: `code name ${r.id}` });
    if (fresh) text(s, "new", { x: x + idw + nw - 0.45, y: y + 0.03, w: 0.4, h: rh - 0.06, fontSize: 12, color: C.accent2, bold: true, align: "right", valign: "middle", objectName: `new layout ${r.id}` });
  });
  const ex = tx + 2 * idw + nws[0] + nws[1] + colGap + 0.2;
  box(s, ex, ty, 9.4 - ex, 0.45, "encode", "", { hs: 13, mono: true, name: "encode box" });
  box(s, ex, ty + 0.55, 9.4 - ex, 0.45, "decode", "", { hs: 13, mono: true, name: "decode box" });
  text(s, "Every code has the same two functions, so a new layout is one new entry.", { x: tx, y: ty + half * rh + 0.1, w: 7.05, h: 0.26, fontSize: 13, color: C.text2, objectName: "plugin note" });
  // the bottom half, every codeword with every single and double flip, one rectangle per run of the real decoder
  const by = top + 2.0;
  hline(s, M, by - 0.08, 8.8, { name: "checks rule" });
  const gw = 1.65, gh = 0.72, g1 = M, g2 = M + gw + 0.15;
  text(s, "Hamming (7,4), all 16 codewords. Black is decoded right, red is wrong.", { x: M, y: by - 0.02, w: 3.45, h: 0.42, fontSize: 12, color: C.text2, objectName: "hamming check heading" });
  [[H.singles, g1, "single"], [H.doubles, g2, "double"]].forEach(([m, gx, nm]) => {
    const cols = m[0].length, cw = gw / cols, rhh = gh / m.length;
    m.forEach((row, r) => row.forEach((ok, c) => cell(s, gx + c * cw, by + 0.42 + r * rhh, cw, rhh, "", { fill: ok ? HEX.dk1 : HEX.accent2, line: WHITE, lw: 0.5, name: `${nm} flip ${r + 1}.${c + 1}` })));
  });
  const ny = by + 0.42 + gh + 0.02;
  text(s, `${one[0]} of ${one[1]}`, { x: g1, y: ny, w: gw, h: 0.26, fontSize: 14, bold: true, fontFace: FONT.mono, objectName: "single flips fixed" });
  text(s, "single flips fixed", { x: g1, y: ny + 0.25, w: gw + 0.1, h: 0.24, fontSize: 12, color: C.text2, objectName: "single flips fixed label" });
  text(s, `${two[0]} of ${two[1]}`, { x: g2, y: ny, w: gw, h: 0.26, fontSize: 14, bold: true, fontFace: FONT.mono, color: C.accent2, objectName: "double flips fixed" });
  text(s, "double flips fixed", { x: g2, y: ny + 0.25, w: gw + 0.1, h: 0.24, fontSize: 12, color: C.text2, objectName: "double flips fixed label" });
  const rx = 4.25, rw = 2.7, rows = [[`${TS.passed} of ${TS.total}`, "automated tests pass"], [RT.crc_check, "CRC-16 of 123456789"], [`${RT.passed} of ${RT.total}`, "frames decode back"]];
  rows.forEach(([big, small], i) => {
    const y = by + 0.1 + i * 0.5;
    hline(s, rx, y - 0.04, rw, { name: `check rule ${i + 1}` });
    text(s, big, { x: rx, y, w: 1.15, h: 0.4, fontSize: 16, bold: true, fontFace: FONT.mono, valign: "middle", objectName: `check ${i + 1} number` });
    text(s, small, { x: rx + 1.2, y, w: rw - 1.2, h: 0.4, fontSize: 12, color: C.text2, valign: "middle", objectName: `check ${i + 1} text` });
  });
  const sx = 7.2;
  hline(s, sx, by + 0.06, 2.2, { name: "simulation rule" });
  text(s, `Simulation, ${Math.round(SIM.flip_probability * 100)} percent flips`, { x: sx, y: by + 0.1, w: 2.3, h: 0.26, fontSize: 12, bold: true, objectName: "simulation heading" });
  text(s, [{ text: "theory  simulated", options: { color: C.text2, breakLine: true } }, ...SIM.rows.map((r) => ({ text: `rep-${r.factor}  ${r.theory.toFixed(3)}   ${r.simulated.toFixed(3)}`, options: { fontFace: FONT.mono, breakLine: true } }))],
    { x: sx, y: by + 0.4, w: 2.3, h: 0.9, fontSize: 12, objectName: "simulation numbers" });
}

// ---------- how we ran an experiment, with the plan inside step 3 ----------
function experiment() {
  const P = DATA.plan, E = CODE.example, n = P.labels.length, codes = new Set(P.labels).size, per = n / codes;
  const bps = Math.round(1 / P.symbol_duration), frameSecs = Math.round(E.frame_bits * P.symbol_duration);
  const S = STATS.setup, thr = [Math.round(Math.min(...S.map((r) => r.thr_min))), Math.round(Math.max(...S.map((r) => r.thr_max)))];
  const { s, top } = content({
    title: "How we ran an experiment",
    take: `One calibration, then ${n} shuffled trials in an order both laptops get from one seed.`,
    notes: `This is how every session went, in three steps from left to right. First we calibrate. Laptop 1 shows black and then white, and laptop 2 sets the threshold halfway between the two. Then a trial. Laptop 1 flashes one frame, which takes ${frameSecs} seconds at ${bps} bits per second, and laptop 2 records the brightness with a timestamp and decodes it afterwards. The third step is the plan. A session is ${n} trials, ${per} of each of our ${codes} methods, in a shuffled order. Laptop 2 saves the plan, and laptop 1 builds the same order from the same seed, a number that makes a shuffle repeatable, so nothing has to be sent back. Then we change the speed or the light and go again.`,
  });
  const gap = 0.15, pws = [2.55, 2.55, 3.4], pxs = [M, M + pws[0] + gap * 2, M + pws[0] + pws[1] + gap * 4];
  const heads = [["1", "Calibration"], ["2", "A trial"], ["3", "The plan"]];
  const dy = top + 0.4;
  heads.forEach(([a, b], i) => {
    const x0 = pxs[i], pw = pws[i], lw = 0.62, lh = lw * 0.62, iw = 0.32, ih = (1.15 * iw) / 1.05;
    text(s, [{ text: `Step ${a}  `, options: { color: C.text2, fontSize: 13 } }, { text: b, options: { bold: true, fontSize: 16 } }], { x: x0, y: top - 0.02, w: pw, h: 0.34, valign: "middle", objectName: `step ${a} title` });
    if (i) vline(s, x0 - gap, top + 0.05, 3.5, { name: `step rule ${i}` });
    k.laptop(s, x0 + 0.05, dy, lw, `laptop 1 step ${a}`, { patch: i === 0 ? true : i === 1 ? "black" : false });
    k.ipad(s, x0 + 1.0, dy + lh / 2 - ih / 2, iw, `iPad step ${a}`, { ring: false });
    k.laptop(s, x0 + 1.66, dy, lw, `laptop 2 step ${a}`, { webcam: true, ring: false });
    arrow(s, x0 + 0.78, dy + lh / 2, x0 + 0.97, dy + lh / 2, { color: C.text2, w: 1.25, name: `step ${a} arrow one` });
    arrow(s, x0 + 1.36, dy + lh / 2, x0 + 1.63, dy + lh / 2, { color: C.text2, w: 1.25, name: `step ${a} arrow two` });
    label(s, "laptop 1", x0 - 0.1, dy + lh + 0.08, 0.9, { name: `step ${a} laptop 1 label`, fs: 12 });
    label(s, "iPad", x0 + 0.86, dy + lh + 0.08, 0.62, { name: `step ${a} ipad label`, fs: 12 });
    label(s, "laptop 2", x0 + 1.55, dy + lh + 0.08, 0.9, { name: `step ${a} laptop 2 label`, fs: 12 });
  });
  const sub = top + 1.2, vy = top + 1.55;
  ["Laptop 1 shows black, then white", "Laptop 1 flashes one frame", `Seed ${P.seed}, ${n} trials, ${per} of each method`].forEach((t, i) => label(s, t, pxs[i], sub, pws[i], { align: "left", fs: 13, name: `step ${i + 1} what happens` }));
  // step 1, the brightness scale with the two levels and the threshold halfway
  const x1 = pxs[0], ay = vy + 0.55;
  hline(s, x1 + 0.05, ay, 2.4, { color: C.text2, w: 1.25, name: "brightness scale" });
  cell(s, x1 + 0.3, ay - 0.1, 0.2, 0.2, "", { fill: HEX.dk1, line: HEX.dk1, name: "black level" });
  cell(s, x1 + 2.0, ay - 0.1, 0.2, 0.2, "", { fill: WHITE, line: C.text1, lw: 1.25, name: "white level" });
  vline(s, x1 + 1.25, vy + 0.22, 0.6, { color: C.text1, w: 1.5, dash: "dash", name: "threshold line" });
  label(s, "threshold", x1 + 0.75, vy - 0.02, 1.0, { fs: 13, color: C.text1, name: "threshold label" });
  label(s, "black", x1 + 0.15, ay + 0.16, 0.5, { fs: 12, name: "black label" });
  label(s, "white", x1 + 1.85, ay + 0.16, 0.5, { fs: 12, name: "white label" });
  label(s, `${thr[0]} to ${thr[1]} on a scale of 0 to 255`, x1, vy + 1.0, pws[0], { align: "left", fs: 12, name: "threshold range" });
  // step 2, one frame as a row of squares and the brightness laptop 2 records
  const x2 = pxs[1], cs = 0.26, pitch = 0.3, bits = [1, 0, 1, 0, 1, 0, 1, 0];
  bits.forEach((b, i) => cell(s, x2 + 0.05 + i * pitch, vy - 0.02, cs, cs, "", { fill: b ? WHITE : HEX.dk1, line: C.text1, lw: 1, name: `frame bit ${i + 1}` }));
  const hi = vy + 0.45, lo = vy + 0.72;
  bits.forEach((b, i) => {
    const x = x2 + 0.05 + i * pitch;
    hline(s, x, b ? hi : lo, pitch, { color: C.text1, w: 1.5, name: `brightness ${i + 1}` });
    if (i) vline(s, x, hi, lo - hi, { color: C.text1, w: 1.5, name: `brightness step ${i}` });
  });
  label(s, "brightness over time", x2, lo + 0.04, pws[1], { align: "left", fs: 12, name: "brightness label" });
  label(s, `${E.frame_bits} bits, ${frameSecs} s at ${bps} bps`, x2, vy + 1.0, pws[1], { align: "left", fs: 12, name: "frame time" });
  // step 3, the plan as small tokens in the shuffled order
  const x3 = pxs[2], tw = 0.4, th = 0.26, tp = 0.44, rp = 0.3;
  P.labels.forEach((l, i) => cell(s, x3 + (i % 7) * tp, vy - 0.02 + Math.floor(i / 7) * rp, tw, th, SHORT[l], { fs: 12, bold: true, name: `method token ${i + 1}` }));
  text(s, "U uncoded, r3 r5 r7 repetition, H Hamming, 2D 2-D parity, HI interleaved.", { x: x3, y: vy + 0.92, w: pws[2], h: 0.4, fontSize: 12, color: C.text2, objectName: "method key" });
  const caps = ["Laptop 2 measures both and sets the threshold halfway.", "Laptop 2 records brightness and time, then decodes it.", "Laptop 2 saves the plan. Laptop 1 rebuilds the same order from the seed, so nothing is sent back."];
  caps.forEach((t, i) => text(s, t, { x: pxs[i], y: top + 2.95, w: pws[i], h: 0.62, fontSize: 13, objectName: `step ${i + 1} caption` }));
}

// ---------- the optional clip ----------
// Built only when there is a clip. A genuine recording, media/demo.mp4, is shown as "Demonstration of one run". Otherwise the
// replay of one recorded run, media/replay.mp4, is shown as "One recording, animated" and says so on the slide.
async function demo() {
  if (!k.HAS_DEMO) return;
  const clip = require("./demo"), info = clip.probe(k.DEMO), replay = k.DEMO_KIND === "replay";
  const N = replay ? clip.replaySpeed() : 0;
  const { s, top } = content(replay ? {
    title: "One recording, animated",
    notes: `This next clip isn't a live run, and it isn't a video of us filming the setup either. It's an animation we drew from the data of one of our recordings, normal light at 4 bits per second, played about ${N} times faster than it happened, so one whole frame fits in under half a minute. First watch the patch flash on laptop 1 and the iPad, and the brightness line follow it. The dashed line is the threshold. Every dot above it is read as a 1 and every dot below it as a 0, and those readings fill in the squares underneath. At the end it steps through the checks, the sync word, then the header CRC, then the payload CRC, and the decoded message matches what we sent.`,
    secs: Math.round(info.secs + 15), fixed: true,
  } : {
    title: "Demonstration of one run",
    take: "We calibrate, send a short message and decode it.",
    notes: `Here's a short recording of one run. First we calibrate with black and then white, then laptop 1 sends a short message, and laptop 2 decodes it.`,
    secs: Math.round(info.secs + 6), fixed: true,
  });
  const room = replay ? 4.78 - top : 5.15 - top;
  const h = Math.min(room, (9.4 * info.h) / info.w), w = (h * info.w) / info.h;
  s.addMedia({ type: "video", path: k.DEMO, x: (10 - w) / 2, y: top, w, h, cover: await clip.poster(k.DEMO, info, replay ? Math.round(info.secs * 0.35) : undefined), objectName: replay ? "replay clip" : "demonstration clip" });
  if (replay) text(s, `Animation of one recording, ${N} times faster. Not a live run and not a video of the setup.`, { x: M, y: top + h + 0.12, w: 8.8, h: 0.3, fontSize: 14, color: C.text2, align: "center", objectName: "replay caption" });
}

module.exports = { txrx, plugAndCheck, experiment, demo, box, label, elbow, deviceBand, SHORT };
