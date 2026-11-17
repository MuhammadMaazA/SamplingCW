"use strict";
// Slides 17 to 25, how the experiments were run, every session, the three changes and the failures.
const k = require("./kit");
const built = require("./built");
const merged = require("./merged");
const { pres, C, SH, HEX, X, FONT, M, WHITE, STATS, RSTATS, DATA, text, hline, vline, arrow, cell, plot, content, divider, chartFrame, axes, setupKey, setupLabel, setupRow } = k;

const SHORT = { none: "U", "rep-3": "r3", "rep-5": "r5", "rep-7": "r7", Ham: "H", "2-D": "2D", "H-int": "HI" };

function metrics() {
  const sent = [[1, 1, 1], [0, 0, 0], [1, 1, 1], [1, 1, 1]];
  const got = [[1, 0, 1], [0, 0, 0], [1, 1, 1], [0, 1, 1]];
  const vote = got.map((g) => (g.reduce((a, b) => a + b, 0) >= 2 ? 1 : 0));
  const wrongChannel = got.flat().filter((b, i) => b !== sent.flat()[i]).length;
  const wrongDecoded = vote.filter((v, i) => v !== sent[i][0]).length;
  const { s, top } = content({
    title: "Four numbers for every trial",
    take: `In this example ${wrongChannel} of 12 bits arrive wrong, but all 4 message bits decode correctly.`,
    notes: `This slide defines the four numbers that we record for every trial, using a small example with red for wrong bits. The channel BER is the share of bits that arrive wrong, and BER means bit error rate. Here 2 of the 12 received bits are wrong. The decoded BER is the share of message bits still wrong after the majority vote, which here is 0 of 4. The delivery rate is the number of message bits delivered per second, and the frame success is the share of frames that decode correctly.`,
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
  const defs = [["Channel BER", "share of bits that arrive wrong"], ["Decoded BER", "share of message bits wrong after decoding"], ["Delivery rate", "message bits delivered per second"], ["Frame success", "share of frames that decode correctly"]];
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
    take: "Each dot is one session, by light and speed. Grey dots gave nothing we could use.",
    notes: `This slide lists every recording session. Each row is a setup, grouped by light and speed, and each dot is one session. Black dots delivered most of their frames, red dots lost most of them, and grey dots gave us nothing we could use. Normal light at 4 bits per second has three sessions, and its largest delivered 20 of 21 frames. Glare at 4 bits per second delivered only 2 of 15. The grey dots are a run that stopped at 16.7 seconds and a run recorded in a different place.`,
  });
  await plot(s, "fig-sessions-timeline.png", { y: top, maxW: 9.4, maxH: 5.15 - top, ar: 2.5, name: "all recording sessions", alt: "Every session grouped by light and speed, with frames delivered and the sessions that gave nothing usable" });
}

async function build() {
  k.speaker("Maaz");
  k.section("Experiments", "02");
  built.experiment();
  await built.demo();
  metrics();
  await timeline();
  k.speaker("Kanav");
  await merged.changes();
  merged.lostAndFailed();
}

module.exports = { build };
