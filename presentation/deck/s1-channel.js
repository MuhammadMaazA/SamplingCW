"use strict";
// Slides 1 to 14, the opening, the channel, how a message becomes light, the three codes and the live demo.
const k = require("./kit");
const { pres, C, SH, HEX, FONT, M, WHITE, STATS, RSTATS, text, hline, vline, arrow, cell, circle, plot, photo, content, divider, note, count } = k;

// ---------- 1 and 2, the opening ----------
function opening() {
  k.speaker("Maaz");
  k.section("Opening");
  const s = pres.addSlide({ masterName: "Title Dark", sectionTitle: "Opening" });
  // the bits of hi, the message the live demo sends, as black and white squares
  [..."0110100001101001"].forEach((b, i) => {
    cell(s, M + i * 0.37, 0.75, 0.3, 0.3, "", { fill: b === "1" ? HEX.lt1 : HEX.dk1, line: b === "1" ? HEX.lt1 : HEX.dk2, name: `title bit ${i + 1}` });
  });
  text(s, "The 16 bits of hi, the message we send in the live demo", { x: M, y: 1.15, w: 6.5, h: 0.28, fontSize: 13, color: C.accent4, objectName: "title bits caption" });
  s.addText("Error Correction over a\nScreen-to-Camera Optical Channel", { placeholder: "title" });
  s.addText([
    { text: "Muhammad Maaz and Kanav Mehta", options: { breakLine: true } },
    { text: "COMP0228 Coursework 1, University College London", options: { fontSize: 14, color: C.accent4 } },
  ], { placeholder: "body" });
  note(s, "We are Maaz and Kanav. We built a one way link where laptop 1 flashes bits on its screen and laptop 2 films them, then asked whether the basic error correcting codes fit the noise we really got. Our answer is that the noise came in bursts, so the order bits are sent in matters as much as how much redundancy we add. The squares are the bits of hi, the message in our demo.");
  count(20);

  const r = content({
    title: "What we will cover",
    take: "Five parts and a live demo, with every recording we made, failures included.",
    notes: "Five parts. The channel and the three basic codes, with a short demo. Then how we ran the experiments, failures included. Then the results and what the noise really looks like. Then our extension, tested in simulation and on the real link. We finish with error against rate and our limits. Maaz covers the first two parts, Kanav the rest.",
    secs: 20,
  });
  const stops = [
    ["01", "Channel and codes", "Bits to light, three codes, a demo"],
    ["02", "Experiments", "Plans, sessions, changes, failures"],
    ["03", "Results and noise", "Do the codes fit the noise"],
    ["04", "Extension", "Spread and interleave, then test"],
    ["05", "Conclusion", "Error against rate, and limits"],
  ];
  const colW = 8.8 / 5;
  hline(r.s, M, 3.1, 8.8, { color: C.text2, w: 1, name: "roadmap line" });
  stops.forEach(([n, h, d], i) => {
    const x = M + i * colW;
    text(r.s, n, { x, y: 2.05, w: 1.2, h: 0.8, fontSize: 40, bold: true, color: C.accent4, fontFace: FONT.head, objectName: `stop ${n} number` });
    circle(r.s, x, 3.0, 0.2, { fill: HEX.dk1, line: HEX.dk1, name: `stop ${n} node` });
    text(r.s, h, { x, y: 3.38, w: colW - 0.2, h: 0.66, fontSize: 18, fontFace: FONT.semi, objectName: `stop ${n} name` });
    text(r.s, d, { x, y: 4.18, w: colW - 0.2, h: 0.7, fontSize: 14, color: C.text2, objectName: `stop ${n} detail` });
  });
}

// ---------- 3 to 8, the channel ----------
function laptop(s, x, y, w, label, o = {}) {
  const h = w * 0.62;
  cell(s, x, y, w, h, "", { line: C.text1, lw: 1.25, name: `${label} screen` });
  cell(s, x - 0.14, y + h, w + 0.28, 0.07, "", { fill: HEX.dk1, line: HEX.dk1, lw: 0.5, name: `${label} base` });
  if (o.patch) {
    const p = h * 0.42;
    cell(s, x + w / 2 - p - 0.07, y + (h - p) / 2, p, p, "", { fill: HEX.dk1, line: HEX.dk1, name: `${label} patch black` });
    cell(s, x + w / 2 + 0.07, y + (h - p) / 2, p, p, "", { fill: WHITE, line: C.text1, lw: 1, name: `${label} patch white` });
  }
  if (o.webcam) circle(s, x + w / 2 - 0.05, y + 0.08, 0.1, { fill: HEX.dk1, line: HEX.dk1, name: `${label} webcam` });
  text(s, label, { x: x - 0.4, y: y + h + 0.14, w: w + 0.8, h: 0.28, fontSize: 14, color: C.text2, align: "center", objectName: `${label} label` });
  return h;
}

function twoWays() {
  const { s } = content({
    title: "Two ways to film the screen",
    take: "Two laptops and an iPad, and real noise from light, exposure and drift.",
    notes: "Laptop 1 shows a patch, white for 1 and black for 0, and the webcam on laptop 2 films it. Facing the screen is the clean reference. In the second way it films the screen reflected in a glossy iPad, which also throws room light back as glare. We chose it because it is cheap, needs no extra hardware, and the noise is real, so the kind of error matters, not only how many.",
    secs: 35,
  });
  const lw = 1.35;
  // row 1, facing the screen
  text(s, "Facing the screen", { x: M, y: 1.78, w: 2.8, h: 0.34, fontSize: 19, fontFace: FONT.semi, objectName: "facing head" });
  text(s, "The webcam looks straight at laptop 1", { x: M, y: 2.18, w: 2.7, h: 0.6, fontSize: 14, color: C.text2, objectName: "facing note" });
  laptop(s, 3.6, 1.65, lw, "Laptop 1", { patch: true });
  laptop(s, 8.05, 1.65, lw, "Laptop 2 webcam", { webcam: true });
  arrow(s, 5.15, 2.07, 7.85, 2.07, { color: C.text2, w: 1.5, name: "facing light" });
  hline(s, M, 3.0, 8.8, { name: "row divider" });
  // row 2, reflection in the iPad screen
  text(s, "Reflection in the iPad", { x: M, y: 3.68, w: 2.8, h: 0.34, fontSize: 19, fontFace: FONT.semi, objectName: "reflection head" });
  text(s, "The webcam films laptop 1 as reflected in a glossy iPad", { x: M, y: 4.08, w: 2.7, h: 0.8, fontSize: 14, color: C.text2, objectName: "reflection note" });
  laptop(s, 3.6, 3.55, lw, "Laptop 1", { patch: true });
  laptop(s, 8.05, 3.55, lw, "Laptop 2 webcam", { webcam: true });
  cell(s, 6.0, 3.4, 0.8, 1.08, "", { line: C.text1, lw: 1.25, name: "ipad screen" });
  cell(s, 6.15, 3.62, 0.5, 0.45, "", { fill: HEX.accent5, line: C.background2, name: "ipad reflection" });
  text(s, "iPad screen", { x: 5.6, y: 4.6, w: 1.6, h: 0.28, fontSize: 14, color: C.text2, align: "center", objectName: "ipad label" });
  arrow(s, 5.15, 3.97, 5.9, 3.97, { color: C.text2, w: 1.5, name: "light to ipad" });
  arrow(s, 6.9, 3.97, 7.85, 3.97, { color: C.text2, w: 1.5, name: "light to webcam" });
  circle(s, 6.27, 3.0, 0.26, { line: HEX.accent2, lw: 1.5, name: "room light" });
  arrow(s, 6.4, 3.3, 6.4, 3.38, { color: C.accent2, w: 1.25, dash: "dash", name: "glare ray" });
  text(s, "room light and glare", { x: 6.62, y: 3.03, w: 1.9, h: 0.28, fontSize: 14, color: C.accent2, objectName: "glare label" });
}

async function traces() {
  const { s, top } = content({
    title: "What the camera sees",
    take: "In glare, black never settles, so runs of 0s read as 1s.",
    notes: `Raw brightness from the capture files, thirty seconds of one frame each. The top trace is the clean reflection with no errors, every white above the dashed threshold. The bottom trace is glare, 116 errors in the frame and ${STATS.traces[1].errors_in_window} in this window. After each white flash the reading creeps back above the threshold, so a run of black symbols reads as white. We think auto exposure and room light on the glossy iPad cause it.`,
    secs: 40,
  });
  await plot(s, "raw-traces.png", { y: top, maxW: 8.8, maxH: 5.12 - top, name: "raw brightness traces", alt: "Camera brightness over thirty seconds for a clean frame and a glare frame, with the threshold and bit errors marked" });
}

async function patches() {
  const { s, top } = content({
    title: "The patch the camera averages",
    take: "Clean patches are tiny, and in glare the box takes in the whole iPad.",
    notes: `The receiver only uses the pixels in a box we draw. In the clean runs the box is ${STATS.setup[1].roi_min} pixels facing the screen and ${STATS.crops.reflect4[0]} by ${STATS.crops.reflect4[1]} in the reflection. In glare we boxed the whole iPad, ${STATS.crops.glare_c[0]} by ${STATS.crops.glare_c[1]} pixels, so room reflections came into the average. The last picture is laptop 1 itself showing through the iPad.`,
    secs: 25,
  });
  const items = [
    ["photo-facing.png", "Facing the screen", `${STATS.setup[1].roi_min} pixels`],
    ["photo-reflection.png", "Reflection", `${STATS.crops.reflect4[0]} by ${STATS.crops.reflect4[1]} pixels`],
    ["photo-glare-ipad.png", "Glare, the whole iPad", `${STATS.crops.glare_c[0]} by ${STATS.crops.glare_c[1]} pixels`],
    ["photo-glare-laptop.png", "Laptop 1 in the glare", "its screen shows through"],
  ];
  const H = 2.1, gap = 0.36;
  const widths = [230 / 280, 200 / 250, 647 / 544, 335 / 320].map((a) => a * H);
  let x = M;
  for (let i = 0; i < items.length; i++) {
    const [file, head, sub] = items[i];
    const y = top + 0.15;
    await photo(s, file, { x, y, h: H, name: head, alt: `${head}, a real crop from the camera` });
    text(s, head, { x, y: y + H + 0.14, w: Math.max(widths[i], 1.9), h: 0.3, fontSize: 15, fontFace: FONT.semi, objectName: `${head} caption` });
    text(s, sub, { x, y: y + H + 0.47, w: Math.max(widths[i], 1.9), h: 0.28, fontSize: 14, color: C.text2, objectName: `${head} size` });
    x += widths[i] + gap;
  }
}

// ---------- 7 to 14, bits into light and the three codes ----------
async function calibration() {
  const { s, top } = content({
    title: "Calibration sets the threshold",
    take: `In glare ${(STATS.levels.glare_c.wrong_side_share * 100).toFixed(1)} percent of symbols fall on the wrong side, against ${(STATS.levels.reflect4.wrong_side_share * 100).toFixed(2)} percent clean.`,
    notes: `Calibration shows black, then white, and measures the median brightness of each. The threshold goes halfway, which gives both symbols the same margin, and then it stays fixed for the whole session. In the clean run the two levels are far apart. In glare ${(STATS.levels.glare_c.wrong_side_share * 100).toFixed(1)} percent of symbols land on the wrong side, and that overlap is where the bit errors come from.`,
    secs: 35,
  });
  await plot(s, "fig-levels.png", { y: top, maxW: 8.8, maxH: 5.12 - top, name: "brightness levels", alt: "Brightness at symbol centres for sent zeros and ones with the threshold, clean and glare" });
}

async function sampling() {
  const spb8 = Math.round(STATS.setup[1].spb_min), spb2 = Math.round(STATS.setup[4].spb_min);
  const { s, top } = content({
    title: "Sampling follows the camera clock",
    take: `At 8 bps the camera gives about ${spb8} samples per bit, at 2 bps about ${spb2}.`,
    notes: `The camera does not run at a steady rate, so counting frames would drift. Every frame is timestamped, and each symbol takes the frame nearest its centre. We use the median of the patch rather than the mean, so a few glinting pixels cannot flip a bit. At 8 bits per second there are only about ${spb8} samples per bit, at 2 bits per second about ${spb2}, which is why speed matters so much.`,
    secs: 30,
  });
  await plot(s, "fig-sampling.png", { y: top + 0.1, maxW: 8.8, maxH: 5.12 - top - 0.1, name: "camera frames against symbol centres", alt: "Camera frame timestamps against symbol centres at three bit rates" });
}

function frameAnatomy() {
  const SYNC = 48, HEADER = 192; // bits, from src/gridlink/protocol.py, SYNC_BITS and HEADER_CODED_BITS
  const total = RSTATS.design["8 bps facing"]["rep-3 adjacent"].bits;
  const payload = total - SYNC - HEADER, over = SYNC + HEADER;
  const { s, top } = content({
    title: "One message, one frame",
    take: `Of the ${total} bits sent for a 2 byte message, ${over} are overhead.`,
    notes: `Every message travels in one self describing frame, drawn here to scale. A ${SYNC} bit sync word, a header that is always sent three times, then the payload with its own CRC. For a 2 byte message, ${over} of the ${total} bits are fixed overhead. If the header is lost the payload code never gets a chance, so we fixed the header code at repetition-3.`,
    secs: 35,
  });
  const scale = 8.8 / total, y = top + 1.3, h = 1.0;
  const segs = [
    ["Sync", SYNC, HEX.dk2, `${SYNC} bits`, C.background1],
    ["Header", HEADER, HEX.lt2, `${HEADER} bits, 64 sent three times`, C.text1],
    ["Payload and CRC-16", payload, HEX.dk1, `${payload} bits, 32 sent three times`, C.background1],
  ];
  let x = M;
  segs.forEach(([name, bits, fill, cap, ink], i) => {
    const w = bits * scale;
    cell(s, x, y, w, h, name, { fill, line: HEX.lt1, lw: 1.5, color: ink, fs: 18, font: FONT.semi, name: `frame segment ${i + 1}` });
    text(s, cap, { x, y: y + h + 0.12, w: Math.max(w, 1.9), h: 0.3, fontSize: 14, color: C.text2, objectName: `frame segment ${i + 1} caption` });
    x += w;
  });
  text(s, "AA AA AA AA", { x: M, y: y + h + 0.46, w: 1.3, h: 0.26, fontSize: 12, color: C.text2, fontFace: FONT.mono, objectName: "sync word 1" });
  text(s, "D3 91", { x: M, y: y + h + 0.72, w: 1.3, h: 0.26, fontSize: 12, color: C.text2, fontFace: FONT.mono, objectName: "sync word 2" });
  // bracket over the overhead
  const bx = M + over * scale;
  hline(s, M, y - 0.22, over * scale, { color: C.accent2, w: 1.25, name: "overhead bracket" });
  vline(s, M, y - 0.22, 0.12, { color: C.accent2, w: 1.25, name: "overhead bracket left" });
  vline(s, bx, y - 0.22, 0.12, { color: C.accent2, w: 1.25, name: "overhead bracket right" });
  text(s, `${over} bits of overhead`, { x: M, y: y - 0.56, w: over * scale, h: 0.32, fontSize: 18, fontFace: FONT.semi, color: C.accent2, align: "center", objectName: "overhead label" });
}

function rateBars() {
  const rows = [["Uncoded", 1, "1"], ["2-D parity", 16 / 25, "16/25"], ["Hamming (7,4)", 4 / 7, "4/7"], ["Repetition 3", 1 / 3, "1/3"], ["Repetition 5", 1 / 5, "1/5"], ["Repetition 7", 1 / 7, "1/7"]];
  const { s, top } = content({
    title: "Three codes and their rates",
    take: "A code's rate is the share of the bits sent that carry the message.",
    notes: "These are the codes the brief asks for, plus our own additional method. Rate is the share of the bits sent that carry the message. Uncoded is 1, 2-D parity 16 over 25, Hamming 4 over 7, and repetition by 3, 5 and 7 gives a third, a fifth and a seventh. Together they span the rate axis. 2-D parity is the simplest product code, introduced by Peter Elias in 1954.",
    secs: 25,
  });
  const x0 = 2.7, full = 5.6, rh = 0.34, pitch = 0.5, y0 = top + 0.15;
  rows.forEach(([name, r, frac], i) => {
    const y = y0 + i * pitch;
    text(s, name, { x: M, y: y + 0.02, w: 2.0, h: rh, fontSize: 16, fontFace: FONT.semi, valign: "middle", objectName: `${name} name` });
    cell(s, x0, y, full * r, rh, "", { fill: HEX.dk1, line: HEX.dk1, name: `${name} data share` });
    if (r < 1) cell(s, x0 + full * r, y, full * (1 - r), rh, "", { fill: HEX.accent5, line: HEX.accent5, name: `${name} redundancy` });
    text(s, frac, { x: x0 + full + 0.25, y: y - 0.02, w: 1.0, h: rh + 0.04, fontSize: 20, bold: true, fontFace: FONT.head, valign: "middle", objectName: `${name} rate` });
  });
  cell(s, x0, y0 + rows.length * pitch + 0.05, 0.22, 0.18, "", { fill: HEX.dk1, line: HEX.dk1, name: "legend data" });
  text(s, "bits that carry the message", { x: x0 + 0.32, y: y0 + rows.length * pitch + 0.02, w: 2.3, h: 0.26, fontSize: 13, color: C.text2, objectName: "legend data label" });
  cell(s, x0 + 2.8, y0 + rows.length * pitch + 0.05, 0.22, 0.18, "", { fill: HEX.accent5, line: HEX.accent5, name: "legend redundancy" });
  text(s, "redundancy", { x: x0 + 3.12, y: y0 + rows.length * pitch + 0.02, w: 1.5, h: 0.26, fontSize: 13, color: C.text2, objectName: "legend redundancy label" });
}

// a row of bit cells, flagged cells are the wrong ones
function bits(s, vals, x, y, size, gap, o = {}) {
  vals.forEach((v, i) => {
    const bad = o.bad && o.bad.includes(i);
    cell(s, x + i * (size + gap), y, size, size, v, { fill: bad ? HEX.accent2 : o.fill ?? WHITE, line: bad ? HEX.accent2 : C.text2,
      color: bad ? C.background1 : C.text1, fs: o.fs ?? 16, bold: bad, name: `${o.name ?? "bit"} ${i + 1}` });
  });
}

function repetition() {
  const { s, top } = content({
    title: "Repetition, worked",
    take: "A majority vote outvotes one flipped copy, but not two.",
    notes: "Repetition sends each bit three times and takes a majority vote. One flipped copy is outvoted. Two flipped copies win the vote, so it fails. The cost is rate. Keep this picture in mind, because a burst flips neighbouring copies together, and that is the whole problem later.",
    secs: 25,
  });
  const panels = [
    { x0: M, title: "One copy flipped", sent: [1, 1, 1], got: [1, 0, 1], bad: [1], vote: 1, ok: true },
    { x0: 5.2, title: "Two copies flipped", sent: [1, 1, 1], got: [0, 0, 1], bad: [0, 1], vote: 0, ok: false },
  ];
  const size = 0.58, gap = 0.12;
  panels.forEach((p, pi) => {
    const cx = p.x0 + 1.15;
    text(s, p.title, { x: p.x0, y: top + 0.05, w: 4.0, h: 0.34, fontSize: 18, fontFace: FONT.semi, objectName: `panel ${pi + 1} title` });
    text(s, "Sent", { x: p.x0, y: top + 0.66, w: 1.0, h: 0.3, fontSize: 15, color: C.text2, valign: "middle", objectName: `panel ${pi + 1} sent label` });
    bits(s, p.sent, cx, top + 0.62, size, gap, { name: `panel ${pi + 1} sent` });
    text(s, "Received", { x: p.x0, y: top + 1.44, w: 1.0, h: 0.3, fontSize: 15, color: C.text2, valign: "middle", objectName: `panel ${pi + 1} received label` });
    bits(s, p.got, cx, top + 1.4, size, gap, { bad: p.bad, name: `panel ${pi + 1} received` });
    const mid = cx + (3 * size + 2 * gap) / 2;
    arrow(s, mid, top + 2.1, mid, top + 2.5, { color: C.text2, w: 1.5, name: `panel ${pi + 1} vote arrow` });
    text(s, "Vote", { x: p.x0, y: top + 2.62, w: 1.0, h: 0.3, fontSize: 15, color: C.text2, valign: "middle", objectName: `panel ${pi + 1} vote label` });
    cell(s, mid - size / 2, top + 2.58, size, size, p.vote, { fill: p.ok ? HEX.accent3 : HEX.accent2, line: p.ok ? HEX.accent3 : HEX.accent2, color: C.background1, fs: 16, bold: true, name: `panel ${pi + 1} vote` });
    text(s, p.ok ? "Corrected" : "Wrong", { x: mid + size / 2 + 0.2, y: top + 2.62, w: 1.6, h: 0.3, fontSize: 17, fontFace: FONT.semi, color: p.ok ? C.accent3 : C.accent2, valign: "middle", objectName: `panel ${pi + 1} verdict` });
  });
  vline(s, 4.9, top + 0.1, 3.1, { name: "panel divider" });
}

// Hamming (7,4) with even parity at positions 1 to 7, the same arrangement as src/gridlink/coding/hamming.py
function hammingWord(data) {
  const code = [0, 0, 0, 0, 0, 0, 0, 0];
  [3, 5, 6, 7].forEach((pos, i) => { code[pos] = data[i]; });
  [1, 2, 4].forEach((p) => { code[p] = [1, 2, 3, 4, 5, 6, 7].filter((q) => q & p).reduce((t, q) => t + code[q], 0) % 2; });
  return code.slice(1);
}
const covers = (check, pos) => (pos & check) !== 0;

function hamming() {
  const sent = hammingWord([1, 0, 1, 1]);
  const got = sent.slice();
  got[4] ^= 1; // position 5 flips
  const fails = [1, 2, 4].map((c) => [1, 2, 3, 4, 5, 6, 7].filter((q) => covers(c, q)).reduce((t, q) => t + got[q - 1], 0) % 2 === 1);
  const syndrome = (fails[2] ? 4 : 0) + (fails[1] ? 2 : 0) + (fails[0] ? 1 : 0);
  const { s, top } = content({
    title: "Hamming (7,4), three checks",
    take: "Three parity checks spell out the position of a single flipped bit.",
    notes: "Hamming seven four adds three parity bits to four data bits. Each check covers the positions whose binary index has that bit set. When one bit flips, exactly the checks that cover it fail, and their pattern read as a binary number is its position. Here bit 5 flipped, checks 1 and 3 fail, 1 0 1 is 5, so the decoder flips it back.",
    secs: 40,
  });
  const x0 = 2.6, w = 0.62, g = 0.1, pitch = w + g, y = top + 0.4;
  text(s, "Received", { x: M, y, w: 1.8, h: w, fontSize: 17, fontFace: FONT.semi, valign: "middle", objectName: "received label" });
  got.forEach((b, i) => {
    text(s, String(i + 1), { x: x0 + i * pitch, y: y - 0.3, w, h: 0.26, fontSize: 13, color: C.text2, align: "center", fontFace: FONT.mono, objectName: `position ${i + 1}` });
    cell(s, x0 + i * pitch, y, w, w, b, { fill: i === 4 ? HEX.accent2 : WHITE, line: i === 4 ? HEX.accent2 : C.text2, color: i === 4 ? C.background1 : C.text1, fs: 18, bold: i === 4, name: `received bit ${i + 1}` });
    text(s, [1, 2, 4].includes(i + 1) ? "parity" : "data", { x: x0 + i * pitch - 0.05, y: y + w + 0.04, w: w + 0.1, h: 0.26, fontSize: 12, color: C.text2, align: "center", objectName: `kind ${i + 1}` });
  });
  [1, 2, 4].forEach((c, ci) => {
    const yy = y + w + 0.5 + ci * 0.46;
    hline(s, M, yy - 0.07, 8.8, { name: `check ${ci + 1} rule` });
    text(s, `Check ${ci + 1}`, { x: M, y: yy, w: 1.6, h: 0.32, fontSize: 16, valign: "middle", objectName: `check ${ci + 1} label` });
    [1, 2, 3, 4, 5, 6, 7].forEach((q) => {
      if (covers(c, q)) circle(s, x0 + (q - 1) * pitch + w / 2 - 0.08, yy + 0.08, 0.16, { fill: HEX.dk1, line: HEX.dk1, name: `check ${ci + 1} covers ${q}` });
    });
    text(s, fails[ci] ? "fails" : "holds", { x: 7.85, y: yy, w: 1.2, h: 0.32, fontSize: 17, fontFace: FONT.semi, color: fails[ci] ? C.accent2 : C.accent3, valign: "middle", objectName: `check ${ci + 1} result` });
  });
  text(s, `Checks 3, 2, 1 read ${fails[2] ? 1 : 0} ${fails[1] ? 1 : 0} ${fails[0] ? 1 : 0}, which is ${syndrome}, so bit ${syndrome} is flipped back.`, { x: M, y: y + w + 0.5 + 3 * 0.46 + 0.1, w: 8.8, h: 0.34, fontSize: 17, objectName: "syndrome line" });
}

function parity() {
  const data = [[1, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 1, 1]];
  const rowP = data.map((r) => r.reduce((a, b) => a ^ b, 0));
  const colP = [0, 1, 2, 3].map((c) => data.reduce((a, r) => a ^ r[c], 0));
  const corner = rowP.reduce((a, b) => a ^ b, 0);
  const cases = [
    { title: "One flip", errs: [[1, 2]], verdict: "Fixed", good: true },
    { title: "Three in an L", errs: [[0, 1], [0, 2], [2, 1]], verdict: "Miscorrected", good: false },
    { title: "Four in a rectangle", errs: [[0, 1], [0, 2], [2, 1], [2, 2]], verdict: "Missed, the CRC catches it", good: false },
  ];
  const { s, top } = content({
    title: "2-D parity, where it fails",
    take: "2-D parity fixes one flip, but larger patterns fool it.",
    notes: "We arrange 16 bits in a 4 by 4 grid and add a parity bit to every row and column. One flip makes one row and one column fail, and their crossing is the bad bit. Two flips are rejected, not guessed. But three errors in an L leave a crossing that is a good bit, so it is miscorrected, and four at the corners of a rectangle pass every check. That is why the payload keeps its own CRC.",
    secs: 40,
  });
  const size = 0.44, g = 0.03, pitch = size + g, gridW = 5 * pitch - g;
  cases.forEach((cs, ci) => {
    const gx = M + ci * 3.15, gy = top + 0.45;
    const flip = (r, c) => cs.errs.some(([er, ec]) => er === r && ec === c);
    const badRows = [0, 1, 2, 3].filter((r) => cs.errs.filter(([er]) => er === r).length % 2 === 1);
    const badCols = [0, 1, 2, 3].filter((c) => cs.errs.filter(([, ec]) => ec === c).length % 2 === 1);
    text(s, cs.title, { x: gx - 0.3, y: top + 0.02, w: gridW + 0.6, h: 0.32, fontSize: 18, fontFace: FONT.semi, align: "center", objectName: `case ${ci + 1} title` });
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const isData = r < 4 && c < 4;
        let v = isData ? data[r][c] : r === 4 && c < 4 ? colP[c] : c === 4 && r < 4 ? rowP[r] : corner;
        const wrong = isData && flip(r, c);
        if (wrong) v ^= 1;
        const failing = (r === 4 && badCols.includes(c)) || (c === 4 && badRows.includes(r));
        const fixes = badRows.length === 1 && badCols.length === 1 && r === badRows[0] && c === badCols[0];
        cell(s, gx + c * pitch, gy + r * pitch, size, size, v, {
          fill: wrong ? HEX.accent2 : !isData ? HEX.accent5 : WHITE, line: wrong ? HEX.accent2 : failing ? HEX.accent2 : fixes ? HEX.accent2 : C.text2,
          lw: failing || fixes ? 2 : 0.75, dash: fixes && !wrong ? "dash" : undefined, color: wrong ? C.background1 : C.text1, fs: 15, bold: wrong, name: `case ${ci + 1} r${r + 1} c${c + 1}`,
        });
      }
    }
    text(s, cs.verdict, { x: gx - 0.4, y: gy + 5 * pitch + 0.1, w: gridW + 0.8, h: 0.34, fontSize: 17, fontFace: FONT.semi, color: cs.good ? C.accent3 : C.accent2, align: "center", objectName: `case ${ci + 1} verdict` });
  });
  text(s, "Filled cells flipped. Outlined cells are failed checks or the bit the decoder would flip.", { x: M, y: 4.88, w: 8.8, h: 0.26, fontSize: 13, color: C.text2, objectName: "parity legend" });
}

function demo() {
  const { s } = content({
    title: "Live demo",
    notes: "Maaz runs the laptops. Laptop 1 calibrates, then sends hi with 2-D parity at 10 bits per second, and laptop 2 decodes it. It runs faster than any measured run so it finishes quickly. If calibration reports invalid or decoding fails, switch to the recorded clip straight away.",
    secs: 120, fixed: true, dark: true,
  });
  const steps = [
    ["01", "Calibrate", "gridlink calibrate --camera 0"],
    ["02", "Transmit", "gridlink transmit hi --coding parity2d --bit-rate 10"],
    ["03", "Decode", "Laptop 2 prints the message"],
  ];
  steps.forEach(([n, h, cmd], i) => {
    const y = 1.55 + i * 1.12;
    text(s, n, { x: M, y: y - 0.05, w: 0.9, h: 0.7, fontSize: 40, bold: true, color: C.accent4, fontFace: FONT.head, objectName: `step ${n} number` });
    text(s, h, { x: 1.65, y, w: 4, h: 0.4, fontSize: 24, fontFace: FONT.semi, color: C.background1, objectName: `step ${n} name` });
    text(s, cmd, { x: 1.65, y: y + 0.46, w: 7.7, h: 0.34, fontSize: 17, color: C.accent4, fontFace: i < 2 ? FONT.mono : undefined, objectName: `step ${n} command` });
  });
  text(s, "A recorded clip is ready if the room light defeats the camera", { x: M, y: 4.85, w: 8, h: 0.28, fontSize: 14, color: C.accent4, objectName: "demo backup" });
}

async function build() {
  opening();
  divider({ index: 1, title: "The channel and the codes", sub: "How bits become light, and how three codes protect them",
    notes: "First the channel, then how a message becomes light, then the three codes the brief asks for, then a short demo." });
  twoWays();
  await traces();
  await patches();
  await calibration();
  await sampling();
  frameAnatomy();
  rateBars();
  repetition();
  hamming();
  parity();
  demo();
}

module.exports = { build, hammingWord };
