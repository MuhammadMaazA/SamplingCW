"use strict";
// The opening, how the channel is built, how a message becomes flashes and the three codes.
const k = require("./kit");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, circle, plot, photo, content, divider, note, count } = k;
const built = require("./built");

const pct = (x, d = 1) => (x * 100).toFixed(d);

// ---------- 1 and 2, title and agenda ----------
function opening() {
  k.speaker("Maaz");
  k.section("Opening");
  const s = pres.addSlide({ masterName: "Title Dark", sectionTitle: "Opening" });
  [..."0110100001101001"].forEach((b, i) => {
    cell(s, M + i * 0.37, 0.75, 0.3, 0.3, "", { fill: b === "1" ? HEX.lt1 : HEX.dk1, line: b === "1" ? HEX.lt1 : HEX.dk2, name: `title bit ${i + 1}` });
  });
  s.addText("Error Correction over a\nScreen-to-Camera Optical Channel", { placeholder: "title" });
  s.addText([
    { text: "Muhammad Maaz and Kanav Mehta", options: { breakLine: true } },
    { text: "COMP0228 Coursework 1, University College London", options: { fontSize: 14, color: C.accent4 } },
  ], { placeholder: "body" });
  const intro = "We are Maaz and Kanav. We sent bits from one laptop screen to another through an iPad, and tested whether basic error correcting codes work on the noise we measured. That noise came in bursts, so the order we send bits in matters. I cover the setup, the codes and how we ran the experiments. Kanav covers the failures, the results, our extension and the conclusion.";
  note(s, intro);
  count(Math.round(intro.split(/\s+/).length / 2.5));

  k.section("Channel and codes");
  const { s: a, top } = content({
    title: "What we will cover",
    take: "Five parts. We show every recording, including the ones that failed.",
    notes: "Five parts. The channel and the codes, the experiments, the results, our extension, and what we learned. We show every recording, including the ones that failed.",
  });
  const items = [
    ["01", "Channel and codes", "How a message becomes flashes, and the three codes we use."],
    ["02", "Experiments", "How we ran the experiments, what we changed and which runs failed."],
    ["03", "Results and noise", "What the codes did and what the noise looked like."],
    ["04", "Extension", "Our extension, which changes the order we send the bits, tested in simulation and then in the layout test."],
    ["05", "Conclusion", "What we learned and where it falls short."],
  ];
  items.forEach(([n, h, d], i) => {
    const y = top + 0.1 + i * 0.68;
    hline(a, M, y - 0.06, 8.8, { name: `agenda rule ${n}` });
    text(a, n, { x: M, y, w: 0.9, h: 0.5, fontSize: 28, bold: true, color: C.accent4, fontFace: FONT.head, valign: "middle", objectName: `agenda ${n} number` });
    text(a, h, { x: 1.7, y, w: 2.5, h: 0.5, fontSize: 20, fontFace: FONT.semi, valign: "middle", objectName: `agenda ${n} name` });
    text(a, d, { x: 4.3, y, w: 5.1, h: 0.56, fontSize: 15, color: C.text2, valign: "middle", objectName: `agenda ${n} text` });
  });
}

// ---------- the channel ----------
function chain() {
  const { s, top } = content({
    title: "How the channel is built",
    take: "Laptop 1 flashes a patch, the iPad shows it live and laptop 2 films the iPad.",
    notes: "Every run used this one chain. Laptop 1 flashes a patch in front of an iPad with its front camera open. The iPad shows laptop 1 live, and laptop 2's built-in webcam films the iPad screen. We kept the iPad in on purpose. Its glass adds glare, which is room light on the glass, and its camera adds exposure drift, a change in brightness while it records. bps means bits per second.",
  });
  const y0 = top + 0.3, lw = 1.5;
  // laptop 1, the iPad and laptop 2 in the order the light travels
  k.laptop(s, M, y0, lw, "Laptop 1", { patch: true });
  const ix = 4.25, iw = 1.05;
  k.ipad(s, ix, y0 - 0.05, iw, "iPad");
  k.laptop(s, 7.9, y0, lw, "Laptop 2", { webcam: true });
  const ay = y0 + 0.47;
  arrow(s, M + lw + 0.2, ay, ix - 0.1, ay, { color: C.text2, w: 1.5, name: "patch light" });
  text(s, "light from the patch", { x: M + lw + 0.1, y: ay - 0.32, w: 1.8, h: 0.26, fontSize: 13, color: C.text2, align: "center", objectName: "patch light label" });
  arrow(s, ix + iw + 0.1, ay, 7.8, ay, { color: C.text2, w: 1.5, name: "ipad filmed" });
  text(s, "the iPad screen, filmed", { x: ix + iw + 0.1, y: ay - 0.32, w: 2.5, h: 0.26, fontSize: 13, color: C.text2, align: "center", objectName: "ipad filmed label" });
  // where glare and exposure drift come in
  circle(s, 5.78, top + 0.02, 0.24, { line: HEX.accent2, lw: 1.5, name: "room light" });
  arrow(s, 5.82, top + 0.28, ix + iw, y0 + 0.2, { color: C.accent2, w: 1.25, dash: "dash", name: "glare ray" });
  text(s, "room light, glare", { x: 6.1, y: top + 0.03, w: 1.7, h: 0.26, fontSize: 14, color: C.accent2, objectName: "glare label" });
  text(s, "exposure drift", { x: ix + iw / 2 - 0.75, y: top - 0.02, w: 1.5, h: 0.26, fontSize: 14, color: C.accent2, align: "center", objectName: "ipad exposure label" });
  text(s, "exposure drift", { x: 7.9 + lw / 2 - 0.75, y: top - 0.02, w: 1.5, h: 0.26, fontSize: 14, color: C.accent2, align: "center", objectName: "webcam exposure label" });
  // names under the devices
  const cy = y0 + 1.28;
  [["Laptop 1", "shows the flashing patch", M, 2.6], ["iPad", "front camera open, screen shows laptop 1 live", 3.55, 2.45], ["Laptop 2", "built-in webcam films the iPad screen, our software reads it", 6.95, 2.45]].forEach(([n, d, x, w], i) => {
    text(s, n, { x, y: cy, w, h: 0.3, fontSize: 17, fontFace: FONT.semi, objectName: `device ${i + 1} name` });
    text(s, d, { x, y: cy + 0.3, w, h: 0.5, fontSize: 14, color: C.text2, objectName: `device ${i + 1} text` });
  });
  // why it is built this way
  const wy = cy + 1.0;
  hline(s, M, wy, 8.8, { name: "why rule" });
  [["Cheap", "Two laptops and an iPad, no other hardware.", M, 2.5], ["Hardware noise", "Glare and two auto exposure cameras add noise that is not simulated.", 3.55, 2.9], ["Bursts", "Errors come in bursts, which are hard to correct.", 6.95, 2.45]].forEach(([h, t, x, w], i) => {
    text(s, h, { x, y: wy + 0.07, w, h: 0.3, fontSize: 16, fontFace: FONT.semi, objectName: `why ${i + 1} head` });
    text(s, t, { x, y: wy + 0.37, w, h: 0.55, fontSize: 14, color: C.text2, objectName: `why ${i + 1} text` });
  });
}

async function traces() {
  const w47 = STATS.traces[1].errors_in_window;
  const { s, top } = content({
    title: "Brightness the camera records",
    take: "In glare the black level rises above the threshold, so black bits read as white.",
    notes: `These are brightness traces from two recordings, 30 seconds each. In normal light every white flash is above the dashed threshold, so there are no errors. In the dim room with glare the brightness falls after each white flash and then rises again, so black bits read as white. This window has ${w47} errors.`,
  });
  await plot(s, "raw-traces.png", { y: top, maxW: 9.4, maxH: 5.15 - top, name: "brightness traces", alt: "Camera brightness over 30 seconds in normal light and in dim light with glare, with the threshold and the bit errors marked" });
}

async function boxes() {
  const B = Object.fromEntries(DATA.boxes.map((b) => [b.key, b]));
  const cases = [
    { b: B.n4, head: "Normal light", glare: false, file: "photo-normal-4bps.png", caption: "Inside the box, a flat patch of colour.", alt: "The picture inside the box in normal light, a flat patch of colour" },
    { b: B.g22, head: "Dim with glare", glare: true, file: "photo-glare-4bps.png", caption: "Inside the box, the iPad glass with room light.", alt: "The picture inside the box in glare, the iPad glass with room light on it" },
  ];
  const { s, top } = content({
    title: "Which pixels we measure",
    take: "Each camera frame becomes one number, the median brightness inside a box we draw.",
    notes: `The software reads one number from each camera frame, the median brightness of the pixels inside a box we draw. In normal light the box sits tightly round the patch. In the earlier glare runs we drew it round the whole iPad screen, so room light on the glass went into the number. The layout test went back to a tight box, ${B.test.roi[2]} by ${B.test.roi[3]} pixels. The drawings are not to scale.`,
  });
  const pw = 4.2, fw = 1.95, fy = top + 0.72;
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i], x0 = M + i * (pw + 0.4), fh = (fw * c.b.frame[1]) / c.b.frame[0];
    const tone = c.glare ? HEX.accent2 : HEX.dk1;
    text(s, c.head, { x: x0, y: top, w: pw, h: 0.36, fontSize: 20, bold: true, color: c.glare ? C.accent2 : C.text1, objectName: `${c.head} heading` });
    text(s, "camera view, not to scale", { x: x0, y: top + 0.4, w: fw + 0.4, h: 0.24, fontSize: 12, color: C.text2, objectName: `${c.head} view label` });
    // a plain drawing of the camera view, with the iPad outline and the patch on it
    cell(s, x0, fy, fw, fh, "", { fill: WHITE, line: C.text1, lw: 1.25, name: `${c.head} camera view` });
    const ix = x0 + fw * 0.17, iy = fy + fh * 0.14, iw = fw * 0.66, ih = fh * 0.72, pd = 0.2;
    cell(s, ix, iy, iw, ih, "", { fill: WHITE, line: C.text2, lw: 1, name: `${c.head} iPad outline` });
    text(s, "iPad", { x: ix + 0.06, y: iy + 0.03, w: 0.6, h: 0.24, fontSize: 12, color: C.text2, objectName: `${c.head} iPad label` });
    const px = ix + iw / 2 - pd / 2, py = iy + ih / 2 - pd / 2 + (c.glare ? 0.04 : 0.06);
    cell(s, px, py, pd, pd, "", { fill: HEX.dk1, line: HEX.dk1, name: `${c.head} patch` });
    // the box, tight round the patch in normal light and round the whole iPad in glare
    const box = c.glare ? [ix - 0.05, iy - 0.05, iw + 0.1, ih + 0.1] : [px - 0.06, py - 0.06, pd + 0.12, pd + 0.12];
    s.addShape(SH.RECTANGLE, { x: box[0], y: box[1], w: box[2], h: box[3], fill: { type: "none" }, line: { color: tone, width: 2.5 }, objectName: `${c.head} box` });
    // its size from the recording, and the real picture inside it
    const sz = `${c.b.roi[2]} by ${c.b.roi[3]} pixels`, share = `${(c.b.fraction * 100).toFixed(1)} percent of the frame`;
    text(s, [{ text: sz, options: { bold: true, fontSize: 17, breakLine: true } }, { text: share, options: { fontSize: 14, color: C.text2 } }], { x: x0, y: top + 2.35, w: 2.4, h: 0.62, objectName: `${c.head} box size` });
    const cx = x0 + fw + 0.5, cw = pw - fw - 0.5;
    const pic = await photo(s, c.file, c.glare ? { x: cx, y: fy, w: cw, name: `${c.head} crop`, alt: c.alt } : { x: cx + 0.25, y: fy, h: 1.3, name: `${c.head} crop`, alt: c.alt });
    arrow(s, box[0] + box[2] + 0.04, box[1] + box[3] / 2, pic.x - 0.06, pic.y + pic.h / 2, { color: tone === HEX.dk1 ? C.text1 : C.accent2, w: 1.5, name: `${c.head} box to crop` });
    text(s, c.caption, { x: pic.x, y: pic.y + pic.h + 0.1, w: cx + cw - pic.x, h: 0.9, fontSize: 14, objectName: `${c.head} crop caption` });
  }
  hline(s, M, 4.62, 8.8, { name: "box takeaway rule" });
  text(s, "A bigger box lets room light into the number.", { x: M, y: 4.7, w: 8.8, h: 0.4, fontSize: 18, bold: true, objectName: "box takeaway" });
}

async function calibration() {
  const L = STATS.levels, glareKey = L.glare_c ?? Object.values(L)[1], cleanKey = L.reflect4 ?? Object.values(L)[0];
  const { s, top } = content({
    title: "Setting the threshold",
    take: `In glare ${(glareKey.wrong_side_share * 100).toFixed(1)} percent of symbols fall on the wrong side of the threshold.`,
    notes: "At the start we show black, then white, and measure the median brightness of each. The threshold goes halfway between them and stays fixed for the session. In normal light the two levels are far apart. In glare they overlap, and the overlap is where the bit errors come from.",
  });
  await plot(s, "fig-levels.png", { y: top, maxW: 9.4, maxH: 5.15 - top, name: "brightness levels", alt: "Brightness at the centre of each symbol for black and white symbols, with the threshold, in normal light and in glare" });
}

async function sampling() {
  const spb8 = Math.round(k.setupRow(STATS.setup, "n8").spb_min), spb2 = Math.round(k.setupRow(STATS.setup, "g2").spb_min);
  const { s, top } = content({
    title: "Samples per bit at each speed",
    take: `At 8 bps the camera gives about ${spb8} samples per bit, at 2 bps about ${spb2}.`,
    notes: `The camera does not run at a steady rate, so counting frames would drift. Instead every camera frame has a timestamp, and each bit uses the frame nearest the middle of its time slot. That frame is one sample. At 8 bits per second we get about ${spb8} samples per bit, at 2 bits per second about ${spb2}.`,
  });
  await plot(s, "fig-sampling.png", { y: top + 0.05, maxW: 9.4, maxH: 5.15 - top - 0.05, name: "camera frames against symbol centres", alt: "Camera frame timestamps against the centre of each symbol at three bit rates" });
}

function frameAnatomy() {
  const SYNC = 48, HEADER = 192; // bits, from src/gridlink/protocol.py, SYNC_BITS and HEADER_CODED_BITS
  const total = RSTATS.design[k.findKey(RSTATS.design, 8, false)]["rep-3 adjacent"].bits;
  const payload = total - SYNC - HEADER, over = SYNC + HEADER;
  const { s, top } = content({
    title: "One message is one frame",
    take: `The sync word and header take ${over} of the ${total} bits sent for a 2 byte message.`,
    notes: `Every message is sent as one frame. A ${SYNC} bit sync word marks the start. The header says which code we used, and we send it three times, so it takes ${HEADER} bits. The payload comes last, with its own check value, called a CRC. If the header is lost, so is the whole frame.`,
  });
  const scale = 8.8 / total, y = top + 1.2, h = 1.25;
  const segs = [
    ["Sync word", SYNC, HEX.dk2, "start marker", `${SYNC} bits`, C.background1],
    ["Header", HEADER, HEX.lt2, "which code was used", `${HEADER} bits, three copies of 64`, C.text1],
    ["Payload and check value", payload, HEX.dk1, "the message", `${payload} bits, three copies of 32`, C.background1],
  ];
  let x = M;
  segs.forEach(([name, bits, fill, role, cap, ink], i) => {
    const w = bits * scale;
    cell(s, x, y, w, h, name, { fill, line: HEX.lt1, lw: 1.5, color: ink, fs: i === 0 ? 15 : 18, font: FONT.semi, name: `frame segment ${i + 1}` });
    text(s, role, { x: x + (i === 0 ? 0 : 0.15), y: y + h + 0.12, w: i === 0 ? w : Math.max(w - 0.2, 1.9), h: 0.3, fontSize: 14, fontFace: FONT.semi, objectName: `frame segment ${i + 1} role` });
    text(s, cap, { x: x + (i === 0 ? 0 : 0.15), y: y + h + 0.44, w: i === 0 ? w : Math.max(w - 0.2, 1.9), h: 0.3, fontSize: 14, color: C.text2, objectName: `frame segment ${i + 1} caption` });
    x += w;
  });
  const bx = M + over * scale;
  hline(s, M, y - 0.22, over * scale, { color: C.accent2, w: 1.25, name: "overhead bracket" });
  vline(s, M, y - 0.22, 0.12, { color: C.accent2, w: 1.25, name: "overhead bracket left" });
  vline(s, bx, y - 0.22, 0.12, { color: C.accent2, w: 1.25, name: "overhead bracket right" });
  text(s, `${over} bits before the payload`, { x: M, y: y - 0.56, w: over * scale, h: 0.32, fontSize: 18, fontFace: FONT.semi, color: C.accent2, align: "center", objectName: "overhead label" });
}

function header() {
  const fields = [["Version", 8], ["Coding id", 8], ["Repeats", 8], ["Sequence", 8], ["Payload length", 16], ["CRC-16", 16]];
  const total = fields.reduce((t, f) => t + f[1], 0), scale = 8.8 / total;
  const { s, top } = content({
    title: "The header and the CRC",
    take: "The header is 64 bits with its own check value, and we send it three times.",
    notes: "The header holds the version, the code we used, how many repeats, the frame number and the payload length. It ends with a CRC, a 16 bit check value computed from the data. The receiver recomputes it to see whether anything changed. A CRC can detect damage but cannot repair it. The payload has its own CRC.",
  });
  let x = M;
  fields.forEach(([name, bits], i) => {
    const w = bits * scale, last = name === "CRC-16";
    cell(s, x, top + 0.4, w, 0.8, name, { fill: last ? HEX.dk1 : i % 2 ? HEX.accent5 : HEX.lt2, line: HEX.lt1, lw: 1.5, color: last ? C.background1 : C.text1, fs: 17, bold: true, name: `header field ${i + 1}` });
    text(s, `${bits} bits`, { x, y: top + 1.28, w, h: 0.3, fontSize: 14, color: C.text2, align: "center", objectName: `header field ${i + 1} bits` });
    x += w;
  });
  arrow(s, M + 4.4, top + 1.75, M + 4.4, top + 2.15, { color: C.text2, w: 1.5, name: "sent three times arrow" });
  text(s, "sent three times, 192 bits", { x: M + 4.6, y: top + 1.78, w: 3.5, h: 0.3, fontSize: 16, color: C.text2, objectName: "sent three times" });
  for (let i = 0; i < 3; i++) cell(s, M + i * (8.8 / 3), top + 2.3, 8.8 / 3 - 0.06, 0.55, `copy ${i + 1}`, { fill: HEX.accent5, line: HEX.lt2, color: C.text1, fs: 16, name: `header copy ${i + 1}` });
  text(s, "The receiver recomputes the CRC from the other fields. If it comes out different, the header is thrown away.", { x: M, y: top + 3.15, w: 8.8, h: 0.6, fontSize: 14, color: C.text2, objectName: "crc note" });
}

function rateBars() {
  const rows = [["Uncoded", 1, "1"], ["2-D parity", 16 / 25, "16/25"], ["Hamming (7,4)", 4 / 7, "4/7"], ["Repetition 3", 1 / 3, "1/3"], ["Repetition 5", 1 / 5, "1/5"], ["Repetition 7", 1 / 7, "1/7"]];
  const { s, top } = content({
    title: "The three codes and their rates",
    take: "The rate of a code is the share of the sent bits that carry the message.",
    notes: "These are the codes the brief asks for, plus our own 2-D parity. Uncoded has rate 1. 2-D parity is 16 over 25, Hamming is 4 over 7, and repetition with 3, 5 or 7 copies is a third, a fifth or a seventh. A lower rate means more protection and slower sending.",
  });
  const x0 = 2.7, full = 5.6, rh = 0.34, pitch = 0.5, y0 = top + 0.15;
  rows.forEach(([name, r, frac], i) => {
    const y = y0 + i * pitch;
    text(s, name, { x: M, y: y + 0.02, w: 2.0, h: rh, fontSize: 16, fontFace: FONT.semi, valign: "middle", objectName: `${name} name` });
    cell(s, x0, y, full * r, rh, "", { fill: HEX.dk1, line: HEX.dk1, name: `${name} data share` });
    if (r < 1) cell(s, x0 + full * r, y, full * (1 - r), rh, "", { fill: HEX.accent5, line: HEX.accent5, name: `${name} redundancy` });
    text(s, frac, { x: x0 + full + 0.25, y: y - 0.02, w: 1.0, h: rh + 0.04, fontSize: 20, bold: true, fontFace: FONT.head, valign: "middle", objectName: `${name} rate` });
  });
  const ly = y0 + rows.length * pitch + 0.05;
  cell(s, x0, ly + 0.05, 0.22, 0.18, "", { fill: HEX.dk1, line: HEX.dk1, name: "legend data" });
  text(s, "bits that carry the message", { x: x0 + 0.32, y: ly + 0.02, w: 2.3, h: 0.26, fontSize: 13, color: C.text2, objectName: "legend data label" });
  cell(s, x0 + 2.8, ly + 0.05, 0.22, 0.18, "", { fill: HEX.accent5, line: HEX.accent5, name: "legend redundancy" });
  text(s, "extra bits", { x: x0 + 3.12, y: ly + 0.02, w: 1.5, h: 0.26, fontSize: 13, color: C.text2, objectName: "legend redundancy label" });
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
    title: "How repetition coding works",
    take: "Majority vote fixes one flipped copy. If two copies flip, it gets the bit wrong.",
    notes: "Repetition sends every bit three times, and the receiver takes a majority vote. If one copy flips, the other two still agree, so the bit is right. If two copies flip, the vote is wrong. That sends three times as many bits, so the rate is one third. A burst flips neighbouring copies together, and we come back to that.",
  });
  const panels = [
    { x0: M, title: "One copy flips", sent: [1, 1, 1], got: [1, 0, 1], bad: [1], vote: 1, ok: true },
    { x0: 5.2, title: "Two copies flip", sent: [1, 1, 1], got: [0, 0, 1], bad: [0, 1], vote: 0, ok: false },
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
    text(s, p.ok ? "Right" : "Wrong", { x: mid + size / 2 + 0.2, y: top + 2.62, w: 1.6, h: 0.3, fontSize: 17, fontFace: FONT.semi, color: p.ok ? C.accent3 : C.accent2, valign: "middle", objectName: `panel ${pi + 1} verdict` });
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
  got[4] ^= 1;
  const fails = [1, 2, 4].map((c) => [1, 2, 3, 4, 5, 6, 7].filter((q) => covers(c, q)).reduce((t, q) => t + got[q - 1], 0) % 2 === 1);
  const syndrome = (fails[2] ? 4 : 0) + (fails[1] ? 2 : 0) + (fails[0] ? 1 : 0);
  const { s, top } = content({
    title: "How Hamming finds a flipped bit",
    take: "The pattern of failed parity checks gives the position of the flipped bit.",
    notes: "Hamming seven four adds three parity bits to four data bits, and the seven bits together are one codeword. Each check covers some of the seven positions. When one bit flips, the checks that cover it fail, and read as a binary number they give its position. Here checks 1 and 3 fail, 1 0 1 is 5, so the decoder flips bit 5 back.",
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
    { title: "Three errors in an L", errs: [[0, 1], [0, 2], [2, 1]], verdict: "Wrong fix", good: false },
    { title: "Four in a rectangle", errs: [[0, 1], [0, 2], [2, 1], [2, 2]], verdict: "Not noticed", good: false },
  ];
  const { s, top } = content({
    title: "When 2-D parity fails",
    take: "Three errors in an L get a wrong fix, and four in a rectangle are not noticed.",
    notes: "We put 16 bits in a four by four grid and add a parity bit for every row and every column. One flip makes one row and one column fail, and their crossing is the bad bit. Three errors in an L give a wrong fix, and four at the corners of a rectangle pass every check. The payload CRC then catches the damage.",
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
  text(s, "Filled cells are flipped bits. Outlined cells are failed checks, or the bit the decoder would flip.", { x: M, y: 4.88, w: 8.8, h: 0.26, fontSize: 13, color: C.text2, objectName: "parity legend" });
}

async function build() {
  opening();
  divider({ index: 1, title: "Channel and codes", sub: "How a message becomes flashes, and the three codes we use.",
    notes: "First the channel, the frame and the three codes." });
  chain();
  built.transmitter();
  built.receiver();
  await traces();
  await boxes();
  await calibration();
  await sampling();
  frameAnatomy();
  header();
  rateBars();
  repetition();
  hamming();
  parity();
  built.plugin();
  built.checked();
}

module.exports = { build, hammingWord };
