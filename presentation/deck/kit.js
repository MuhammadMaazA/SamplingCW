"use strict";
// Shared theme, layouts and drawing helpers for the deck. Every slide module builds on this.
const fs = require("fs");
const os = require("os");
const path = require("path");
const pptxgen = require("pptxgenjs");
const JSZip = require("jszip");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const PLOTS = path.join(ROOT, "plots");
const STATS = require(path.join(PLOTS, "stats.json"));
const RSTATS = require(path.join(ROOT, "..", "report", "generated", "stats.json"));
const DATA = require("./data");

// An optional clip after the slide "How we ran an experiment". A genuine recording media/demo.mp4 wins, else the replay of one
// recorded run media/replay.mp4 once the figures job has written its done marker, else there is no slide.
// DECK_DEMO points at another file, which is how the slide is tried out without putting a clip in the repository.
const MEDIA = path.join(ROOT, "media");
const DEMO_REAL = process.env.DECK_DEMO || path.join(MEDIA, "demo.mp4");
const REPLAY = path.join(MEDIA, "replay.mp4");
const DEMO_KIND = fs.existsSync(DEMO_REAL) ? "demo" : fs.existsSync(REPLAY) && fs.existsSync(path.join(MEDIA, "_replay_done.txt")) ? "replay" : null;
const DEMO = DEMO_KIND === "replay" ? REPLAY : DEMO_REAL;
const HAS_DEMO = DEMO_KIND !== null;
const TOTAL = 35 + (HAS_DEMO ? 1 : 0); // slides in the whole deck. finish() checks the count.
const MAIN_END = TOTAL; // the last slide is the Questions slide, so the whole deck is the talk

// Black, white and one vermilion. Greys carry neutral data, the accent only marks errors, glare, bursts,
// the new layouts or the single emphasis on a slide. Slots keep one meaning each so slide code can use them by name.
const THEME = {
  name: "Black and vermilion",
  headFontFace: "Gill Sans MT",
  bodyFontFace: "Gill Sans MT",
  colors: {
    dk1: "111111", lt1: "FFFFFF", dk2: "4D4D4D", lt2: "CFCFCF",
    accent1: "111111", accent2: "D9381E", accent3: "111111", accent4: "8C8C8C",
    accent5: "EDEDED", accent6: "E8806F", hlink: "D9381E", folHlink: "4D4D4D",
  },
};
const HEX = THEME.colors;
// Gill Sans MT has no semibold cut, so FONT.semi means bold. Code is set in Consolas.
const FONT = { head: THEME.headFontFace, semi: "BOLD", mono: "Consolas" };
// hex for the few options that cannot take a scheme colour, and tints of the accent and greys for extra chart series
const X = { ink: "111111", white: "FFFFFF", g1: "4D4D4D", g2: "8C8C8C", g3: "CFCFCF", g4: "EDEDED", accent: "D9381E", tint1: "E8806F", tint2: "F2B8AE" };

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.title = "Error correction over a screen-to-camera optical channel";
pres.author = "Muhammad Maaz, Kanav Mehta, Daniel Helmi";
pres.subject = "COMP0228 Coursework 1";
pres.company = "University College London";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const SH = pres.shapes;
const M = 0.6; // slide margin
const WHITE = "FFFFFF";

const state = { speaker: "Maaz", section: "Opening", tag: "", count: 0, secs: [], title: "" };


// Display names of the setups, chosen by the user. The stats files may still carry older names, so every
// name that can appear for a setup is listed and a lookup by key works for either.
const SETUPS = {
  n3: { label: "Normal light, 3 bps", groups: "G01 to G07", names: ["Facing screen, 3 bps", "Facing, 3 bps", "Normal light, 3 bps"] },
  n8: { label: "Normal light, 8 bps", groups: "G08 to G14", names: ["Facing screen, 8 bps", "Facing, 8 bps", "Normal light, 8 bps"] },
  n4: { label: "Normal light, 4 bps", groups: "G15 to G21", names: ["Reflection, 4 bps", "Normal light, 4 bps"] },
  chk: { label: "Normal light, 4 bps, rep-3 check", groups: "G28 and G29", names: ["Facing screen, 4 bps", "Facing, 4 bps", "Normal light, 4 bps, rep-3 check"] },
  g4: { label: "Dim with glare, 4 bps", groups: "G22 to G26", names: ["Reflection with glare, 4 bps", "Glare, 4 bps", "Dim with glare, 4 bps"] },
  g2: { label: "Dim with glare, 2 bps", groups: "G27", names: ["Reflection with glare, 2 bps", "Glare, 2 bps", "Dim with glare, 2 bps"] },
};
function setupKey(name) { return Object.keys(SETUPS).find((key) => SETUPS[key].names.includes(name)) ?? null; }
function setupLabel(row) {
  if (typeof row === "string") { const key = setupKey(row); return key ? SETUPS[key].label : row; }
  return row.display ?? row.label ?? setupLabel(row.env ?? row.setup);
}
// the key of a stats object that belongs to a bit rate, with or without glare, whatever the stats file calls it
function findKey(obj, rate, glare) { return Object.keys(obj).find((key) => key.startsWith(`${rate} bps`) && /glare/i.test(key) === glare); }
// the row of a stats list that belongs to one setup, whatever name the stats file gave it
function setupRow(rows, key, field = "env") { return rows.find((r) => setupKey(r[field]) === key); }

// ---------- layouts ----------
const pageNo = (dark) => ({ x: 8.35, y: 5.2, w: 0.65, h: 0.28, fontSize: 12, color: dark ? C.accent4 : C.text2, align: "right", valign: "middle", margin: 0 });
const pageTotal = (dark) => ({ text: { text: ` / ${TOTAL}`, options: { x: 9.0, y: 5.2, w: 0.5, h: 0.28, fontSize: 12, color: dark ? C.accent4 : C.text2, align: "left", valign: "middle", margin: 0 } } });
const titleBox = (dark) => ({ placeholder: { options: { name: "title", type: "title", x: M, y: 0.3, w: 8.8, h: 0.72,
  fontSize: 36, bold: true, color: dark ? C.background1 : C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } });

pres.defineSlideMaster({
  title: "Title Dark", background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 1.75, w: 8.8, h: 1.75, fontSize: 38, bold: true,
      color: C.background1, align: "left", valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 3.8, w: 8.8, h: 1.0, fontSize: 22,
      color: C.background1, align: "left", valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "Content", background: { color: C.background1 },
  objects: [titleBox(false), pageTotal(false)], slideNumber: pageNo(false),
});
pres.defineSlideMaster({
  title: "Content Dark", background: { color: C.text1 },
  objects: [titleBox(true), pageTotal(true)], slideNumber: pageNo(true),
});

// ---------- small helpers ----------
function text(s, t, o = {}) {
  const opts = { isTextBox: true, margin: 0, color: C.text1, fontSize: 14, valign: "top", ...o };
  if (opts.fontFace === FONT.semi) { delete opts.fontFace; opts.bold = true; }
  opts.fontSize = Math.max(opts.fontSize, 12);
  s.addText(t, opts);
}
function hline(s, x, y, w, o = {}) {
  s.addShape(SH.LINE, { x, y, w, h: 0, line: { color: o.color ?? C.background2, width: o.w ?? 0.75, dashType: o.dash }, objectName: o.name ?? "rule" });
}
function vline(s, x, y, h, o = {}) {
  s.addShape(SH.LINE, { x, y, w: 0, h, line: { color: o.color ?? C.background2, width: o.w ?? 0.75, dashType: o.dash }, objectName: o.name ?? "rule" });
}
// straight horizontal or vertical arrow from (x1, y1) to (x2, y2)
function arrow(s, x1, y1, x2, y2, o = {}) {
  s.addShape(SH.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: o.color ?? C.text2, width: o.w ?? 1.25, dashType: o.dash, endArrowType: o.head === false ? undefined : "triangle" },
    objectName: o.name ?? "arrow",
  });
}
// one square or rectangle that is itself data, with its label drawn inside
function cell(s, x, y, w, h, label, o = {}) {
  const bold = !!o.bold || o.font === FONT.semi;
  s.addText(label === undefined || label === null ? "" : String(label), {
    shape: SH.RECTANGLE, x, y, w, h, fill: { color: o.fill ?? WHITE }, line: { color: o.line ?? C.text2, width: o.lw ?? 0.75, dashType: o.dash },
    align: o.align ?? "center", valign: "middle", margin: 0, fontSize: Math.max(o.fs ?? 14, 12), color: o.color ?? C.text1,
    bold, fontFace: o.font === FONT.semi ? undefined : (o.font ?? (/^[01]$/.test(String(label)) ? FONT.mono : undefined)), objectName: o.name ?? "cell",
  });
}
function circle(s, x, y, d, o = {}) {
  s.addShape(SH.OVAL, { x, y, w: d, h: d, fill: o.fill ? { color: o.fill } : { type: "none" }, line: { color: o.line ?? C.text1, width: o.lw ?? 1.25, dashType: o.dash }, objectName: o.name ?? "node" });
}

// ---------- the devices, drawn the same wherever they appear ----------
// a laptop with screen width w and a flat base. patch is true, "black" or "white" for what its screen shows,
// webcam adds the camera dot and ring adds the red exposure ring round it
function laptop(s, x, y, w, name, o = {}) {
  const f = w / 1.5, h = w * 0.62;
  cell(s, x, y, w, h, "", { line: C.text1, lw: 1.25, name: `${name} screen` });
  cell(s, x - 0.12 * f, y + h, w + 0.24 * f, Math.max(0.07 * f, 0.04), "", { fill: HEX.dk1, line: HEX.dk1, lw: 0.5, name: `${name} base` });
  if (o.patch) {
    const p = h * 0.42, both = o.patch === true;
    if (both || o.patch === "black") cell(s, both ? x + w / 2 - p - 0.07 * f : x + (w - p) / 2, y + (h - p) / 2, p, p, "", { fill: HEX.dk1, line: HEX.dk1, name: `${name} patch black` });
    if (both || o.patch === "white") cell(s, both ? x + w / 2 + 0.07 * f : x + (w - p) / 2, y + (h - p) / 2, p, p, "", { fill: WHITE, line: C.text1, lw: 1, name: `${name} patch white` });
  }
  if (o.webcam) {
    circle(s, x + w / 2 - 0.05 * f, y + 0.08 * f, 0.1 * f, { fill: HEX.dk1, line: HEX.dk1, name: `${name} webcam` });
    if (o.ring !== false) circle(s, x + w / 2 - 0.12 * f, y + 0.01 * f, 0.24 * f, { line: HEX.accent2, lw: 1.25, name: `${name} exposure ring` });
  }
  return h;
}
// the iPad with its front camera, showing laptop 1 live. Width w, height 1.1 times that.
function ipad(s, x, y, w, name, o = {}) {
  const f = w / 1.05, h = 1.15 * f;
  cell(s, x, y, w, h, "", { line: C.text1, lw: 1.25, name: `${name} screen` });
  circle(s, x + w / 2 - 0.05 * f, y + 0.08 * f, 0.1 * f, { fill: HEX.dk1, line: HEX.dk1, name: `${name} front camera` });
  if (o.ring !== false) circle(s, x + w / 2 - 0.12 * f, y + 0.01 * f, 0.24 * f, { line: HEX.accent2, lw: 1.25, name: `${name} exposure ring` });
  cell(s, x + 0.14 * f, y + 0.45 * f, 0.77 * f, 0.5 * f, "", { line: C.text1, lw: 1, name: `${name} shows laptop 1 frame` });
  cell(s, x + 0.38 * f, y + 0.57 * f, 0.12 * f, 0.12 * f, "", { fill: HEX.dk1, line: HEX.dk1, name: `${name} shows black patch` });
  cell(s, x + 0.55 * f, y + 0.57 * f, 0.12 * f, 0.12 * f, "", { fill: WHITE, line: C.text1, lw: 0.75, name: `${name} shows white patch` });
  cell(s, x + 0.08 * f, y + 0.95 * f, 0.89 * f, Math.max(0.04 * f, 0.025), "", { fill: HEX.dk1, line: HEX.dk1, lw: 0.5, name: `${name} shows laptop 1 base` });
  return h;
}

const PARTIAL = !!process.env.DECK_PARTIAL;
const missing = [];
async function plot(s, file, o = {}) {
  let meta;
  const src = o.full ?? path.join(PLOTS, file);
  try { meta = await sharp(src).metadata(); } catch (e) {
    if (!PARTIAL) throw new Error(`missing figure ${file}`);
    missing.push(file);
    meta = { width: (o.ar ?? 2.5) * 1000, height: 1000 };
  }
  const ar = meta.width / meta.height;
  let w = o.w ?? o.maxW ?? 8.8, h = w / ar;
  if (o.h) { h = o.h; w = h * ar; }
  if (o.maxH && h > o.maxH) { h = o.maxH; w = h * ar; }
  if (o.maxW && w > o.maxW) { w = o.maxW; h = w / ar; }
  const x = o.x ?? (o.align === "left" ? M : (10 - w) / 2);
  if (missing.includes(file)) {
    cell(s, x, o.y, w, h, `missing ${file}`, { fill: HEX.accent5, line: C.text2, fs: 12, color: C.text2, name: `placeholder ${file}` });
  } else {
    s.addImage({ path: src, x, y: o.y, w, h, objectName: o.name ?? file, altText: o.alt ?? o.name ?? file });
  }
  return { x, y: o.y, w, h };
}
// A copy of a figure without its last line of text, written to the temp folder. The header figure ends with a bare
// p label, and the slide says the same thing in plain words, so the label is cut off at the blank gap above it.
async function withoutLastLine(file) {
  const out = path.join(os.tmpdir(), `deck-trimmed-${file}`);
  const { data, info } = await sharp(path.join(PLOTS, file)).flatten({ background: "#ffffff" }).raw().toBuffer({ resolveWithObject: true });
  const inked = (y) => { for (let x = 0; x < info.width; x++) { const i = (y * info.width + x) * info.channels; if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) return true; } return false; };
  let y = info.height - 1;
  while (y > 0 && !inked(y)) y--;                    // the blank margin under the figure
  const bottom = y;
  while (y > 0 && inked(y)) y--;                     // the rows of the last line of text
  let gap = 0;
  while (y > 0 && gap < 6) { if (inked(y)) gap = 0; else gap++; y--; }
  if (y <= 0 || bottom - y < 10) throw new Error(`could not find the last line of ${file}`);
  await sharp(path.join(PLOTS, file)).extract({ left: 0, top: 0, width: info.width, height: y + 1 }).toFile(out);
  return out;
}

// a real picture with a hairline border so its edge shows on the paper
async function photo(s, file, o) {
  const p = await plot(s, file, o);
  s.addShape(SH.RECTANGLE, { x: p.x, y: p.y, w: p.w, h: p.h, fill: { type: "none" }, line: { color: C.text2, width: 0.75 }, objectName: `${o.name ?? file} border` });
  return p;
}

// native charts share one frame so every chart reads the same
const chartText = { catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt",
  legendFontFace: "+mn-lt", titleFontFace: "+mn-lt", catAxisTitleFontFace: "+mn-lt", valAxisTitleFontFace: "+mn-lt" };
const chartFrame = {
  catAxisLabelColor: HEX.dk2, valAxisLabelColor: HEX.dk2, catAxisLabelFontSize: 12, valAxisLabelFontSize: 12,
  catAxisTitleColor: HEX.dk1, valAxisTitleColor: HEX.dk1, catAxisTitleFontSize: 12, valAxisTitleFontSize: 12,
  legendFontSize: 12, legendColor: HEX.dk2, dataLabelFontSize: 12, dataLabelColor: HEX.dk1,
  valGridLine: { color: HEX.accent5, size: 0.75 }, catGridLine: { style: "none" },
  catAxisLineShow: true, valAxisLineShow: false, showTitle: false, ...chartText,
};
const axes = (val, cat) => ({
  ...(val ? { showValAxisTitle: true, valAxisTitle: val } : {}),
  ...(cat ? { showCatAxisTitle: true, catAxisTitle: cat } : {}),
});

// ---------- slide scaffolds ----------
// starts a part of the talk. Every content slide after it carries a small grey tag like "02 Experiments" at the top right.
function section(name, no) {
  pres.addSection({ title: name });
  state.section = name;
  state.tag = no ? `${no} ${name}` : name;
}
function speaker(name) { state.speaker = name; }
// Who speaks on each slide, by slide title. Maaz takes the plainest slides, and Kanav and Daniel Helmi share the technical ones in runs of
// two or three. The last slide is for all three. A slide that is not in this table stops the build, so a new slide has to be given a speaker.
const SPEAKERS = {
  Maaz: ["Error Correction over a Screen-to-Camera Optical Channel", "What we will cover", "How the channel is built", "How we ran an experiment", "One recorded run",
    "Demonstration of one run", "The recording sessions", "Three changes we made", "Lost frames and failed runs", "What to send for each kind of noise", "Conclusion and limitations"],
  Daniel: ["How the two laptops work", "Which pixels we measure", "The three codes and their rates", "How repetition coding works", "Plugging in and checking a code", "Four numbers for every trial",
    "Two kinds of noise", "Which bits go wrong", "Why the order of the bits matters", "Simulating bursts and layouts", "Spreading the header cost frames", "What the layout test shows"],
  Kanav: ["What the camera sees", "Samples per bit at each speed", "One message is one frame", "How Hamming finds a flipped bit", "When 2-D parity fails", "Clean channel against high noise",
    "What 3 trials can tell us", "A two-state model of glare", "Repetition does worse than theory", "The three new layouts", "The layout test had 72 trials", "Delivery rate against code rate", "How close we are to the limit"],
};
const ALL = "Maaz, Kanav and Daniel";
function who() {
  if (state.speaker === "Both") return ALL;
  const name = Object.keys(SPEAKERS).find((n) => SPEAKERS[n].includes(state.title));
  if (!name) throw new Error(`no speaker is set for the slide ${state.title}, add it to SPEAKERS in deck/kit.js`);
  return name;
}
// A short crib under the words to say, so each of us knows what the slide is doing. It is not part of the talk,
// and words() never sees it, so it does not change the timing.
const MEANS = {
  "Error Correction over a Screen-to-Camera Optical Channel": "The title slide. We send bits by flashing a laptop screen, through an iPad, into another laptop's camera, and we test whether ordinary error-correcting codes survive that noise. The line to land is that in the dim room the errors come in bursts, so the order of the bits matters as much as how many extra bits we add.",
  "What we will cover": "A map of the five parts, with no results yet. Part 1 is the hardware and the codes, part 2 is how a session was run, part 3 is what the noise looked like, part 4 is changing the order of the bits, and part 5 is what we would send next time.",
  "How the channel is built": "The hardware path, left to right. Laptop 1 flashes black or white. The iPad's front camera shows that live, and laptop 2 films the iPad screen. Glare is room light on the glass, and exposure drift is a camera slowly changing the brightness. Bursts are what we saw in the dim room. In normal light the errors are mostly single flips.",
  "How the two laptops work": "The software path for one short message. Laptop 1 adds a check value, applies the code, and flashes one colour per bit. Laptop 2 turns each camera picture into one brightness number, finds the start, and checks the header and the payload. The 336 bits and 42 seconds are this example at 8 bits per second, not every message.",
  "Which pixels we measure": "We do not use the whole camera picture. Each frame becomes one number, the median brightness inside a box we draw. In normal light the box is tiny and sits on the patch. In the glare example the box is the whole iPad, so room light leaks into the number. The 9.9 percent is that one glare frame, which was 1920 by 1080.",
  "What the camera sees": "What the brightness actually did. The top trace is normal light and the lower trace is one glare frame, not every glare run. Grey bands are white bits, the dashed line is the threshold, and red ticks are wrong bits. The 8.7 percent is one glare recording, and that share of its symbols landed on the wrong side of the threshold. The five dim runs ranged from 7.3 to 31.5 percent wrong.",
  "Samples per bit at each speed": "How many camera pictures we get for each bit. The webcam and the screen are not locked together, so we timestamp every picture and pick the one nearest the middle of the bit. At 8 bits per second that is about 4 pictures, at 4 bits per second about 7 or 8, and at 2 bits per second about 14. Fewer pictures means a white flash can still be bright when the next bit is black.",
  "One message is one frame": "The shape of one message. A sync word marks the start, then a header sent three times, then the coded payload. For our two-byte example, 240 of the 336 bits are overhead that comes before the message. The CRC is a checksum. If it does not match, we throw that part away. It cannot repair the bits.",
  "The three codes and their rates": "The three codes side by side, plus sending the bits with no code. The dark part of each bar is the message and the pale part is the extra protection. The rate is the share of sent bits that carry the message, so a lower rate means the same message takes longer.",
  "How repetition coding works": "The simplest code. Each bit is sent three times and the receiver takes a majority vote. One wrong copy still leaves two that agree, so the vote is right. Two wrong copies make the vote wrong. The cost is that only one bit in three is the message.",
  "How Hamming finds a flipped bit": "Hamming puts 4 message bits and 3 check bits in a block of 7. The pattern of which checks fail is a binary number, and that number is the position of the flipped bit. It repairs one flip. Two flips make it repair the wrong bit, so the block ends up with three errors.",
  "When 2-D parity fails": "Sixteen message bits in a grid, with a check on every row and every column. One failed row and one failed column meet at the bad bit, so one error is fixed. Three errors in an L leave exactly one failed row and one failed column, and they meet at a bit that was not flipped, so the fix is wrong. Four errors at the corners of a rectangle leave every check passing, so nothing is noticed.",
  "Plugging in and checking a code": "How a code is selected, and the tests that the decoder is correct. The header carries a number from 0 to 6, and both laptops look it up in the same table. The grids underneath are not a recording. They are every possible Hamming block with one flip and with two flips. The decoder fixed all 112 single flips and none of the 336 double flips.",
  "How we ran an experiment": "The three steps of every session. First, show black and then white and set the threshold halfway. Second, flash one frame and record the brightness with the time of each camera picture. Third, a plan of 21 trials, 3 of each method, shuffled from a seed so both laptops build the same order and no file has to be copied across.",
  "One recorded run": "A drawing made afterwards from one saved recording, played about 6 times faster. It is not a live demo and it is not a video of the laptops. Each dot above the dashed line is read as 1 and each dot below it as 0. At the end the checks pass and the message matches what was sent.",
  "Demonstration of one run": "A short recording of one real run, black, then white, then a short message, then the decode. Use it only if we are showing the live clip rather than the drawn replay.",
  "Four numbers for every trial": "The four scores we use everywhere after this. Channel BER is the share of bits that arrived wrong, before any code. Decoded BER is the share of message bits still wrong after the code. Delivery rate is useful message bits per second. Frame success is the share of frames that came through intact.",
  "The recording sessions": "A map of every session, not a comparison of codes. Each dot is one session. Black means most frames got through and red means most were lost. The recordings that gave us nothing usable are left out here and are covered on the lost frames slide. The dim room at 4 bits per second is the red group, 2 of 15 frames.",
  "Three changes we made": "Three comparisons, each changing one thing. Faster in normal light lost frames. Dimmer, with glare, lost many more, and those runs used only repetition 3. Slower in glare looked better, but that was one short session on another day, so we cannot say the speed caused it.",
  "Lost frames and failed runs": "Where the planned trials went. A header check failure means we never learned which code was sent, so the frame is lost. A payload check failure means the header was fine but the message was damaged. The right side is our own fault, because one session was stopped early, and one was started with the codes in the wrong order.",
  "Clean channel against high noise": "The same codes in two rooms. In clean light every code, including no code, decoded with no errors, so the extra bits only made the link slower. At 8 bits per second Hamming left more message bits wrong than no code, because two flips in one block get turned into three.",
  "What 3 trials can tell us": "Why we do not declare a winning code. Each method was tried 3 times, so the lines are wide. The p of 0.13 on the slide compares each code with the best one across 9 pooled trials. A separate test, only inside the 8 bits per second session, gives 0.10 for repetition 7 against Hamming. Neither is below 0.05, so both are trends.",
  "Two kinds of noise": "The main result about the noise. At 8 bits per second the wrong bits are mostly on their own. In the dim glare recordings they come in runs, and 87 percent of those errors sit in runs of 3 or more. That 87 percent is the dim-room recordings, not every session.",
  "Which bits go wrong": "Which bits the camera gets wrong, and why. At 8 bits per second almost every error is a black bit read as white, especially the black bit just after a white one, because the screen has not gone dark yet. In glare the first bits of a colour are mostly fine and the later ones fail, which fits the camera slowly changing its exposure.",
  "A two-state model of glare": "A simple model of the dim-room bursts. The link is usually in a good state, where about 1 percent of bits flip, and sometimes in a bad state, where almost all of them flip. The bad state lasts about 4 bits. It fits the recordings much better than assuming each bit flips on its own. BIC is only a score for that comparison, and lower is better.",
  "Repetition does worse than theory": "Why sending a bit three times in a row failed in glare. The curves assume each copy flips on its own. Our copies sit next to each other, so one burst hits all three and the vote is wrong. The 0.198 is one glare recording, not every glare run. Across the dim runs, 77 of 624 triple-sent bits lost all three copies, where independent flips would lose about 3.",
  "Why the order of the bits matters": "The idea behind the extension. We keep the same bits and only change their order. If the three copies sit together, a burst of 3 wipes out one bit. If the message is sent three times in a row, that burst hits three different bits and each bit keeps two good copies. The same idea lets Hamming see one error in many blocks instead of many errors in one block.",
  "Simulating bursts and layouts": "A computer replay of the harsh glare model, not a new recording. We did it because the real glare runs were too short to compare layouts. In that model, spreading the copies and interleaving Hamming both help, and spreading the header helps too. The real layout test later disagreed about the header.",
  "The three new layouts": "The three orders we added. Spread repetition sends the whole message three times instead of each bit three times. Depth 16 mixes 16 Hamming blocks instead of 8. A spread header puts a gap between the three copies of the header. The receiver always tries the ordinary header first, and tries the spread header only if that check fails.",
  "The layout test had 72 trials": "The real test of those orders, which was one session, six layouts, 12 trials each. A black square is a frame that arrived and a red square is one that did not. The counts run from 9 to 12 out of 12, and none of the gaps is larger than chance. So this session did not show one layout beating another.",
  "Spreading the header cost frames": "The one result in that session that was larger than chance, and it went the wrong way. Layouts with the header copies together lost no frames to a header check. The two layouts with a spread header lost 5 of 24. The simulation had predicted the opposite, and we have not found why.",
  "What the layout test shows": "Why that session does not prove the extension. Its channel error rate was about 0.4 to 2.5 percent. The earlier dim-room runs were 7.3 to 31.5 percent. The room was too clean for heavy bursts, so the claim that spreading helps against bursts still rests on the simulation.",
  "Delivery rate against code rate": "Useful bits per second, counting only frames that arrived whole. In clean light the rate follows the code, so less protection means a faster link. At 8 bits per second the lightly protected codes delivered nothing and repetition 7 delivered the most. With 3 trials this is a pattern, not a ranking.",
  "How close we are to the limit": "A ceiling from theory. Capacity is the fastest any code could go on this noise and still be reliable. Our codes sit below it, so the channel could carry a better code than the ones we used. The glare bar assumes each bit flips on its own, and glare does not, so that bar is a low estimate. The sampling, compression and degree lines are there because the brief asks for them.",
  "What to send for each kind of noise": "The practical answer. On a clean channel, send no code. When flips are isolated, repetition or 2-D parity did better than Hamming. When errors come in bursts, spread the copies. That last line is what the simulation says. The real layout test was too mild to confirm it, and spreading the header lost frames.",
  "Conclusion and limitations": "The close. Coding helps only when it matches the noise, and in the dim room the order of the bits mattered as much as the number of extra bits. The limit on the slide is the important one to remember. The room changed between sessions, so we compare codes only inside one session. Three trials, mild glare in the layout test, and a simulation that misses some of the glare are the other limits.",
  "Questions": "Stop and take questions. We can open any file in the code, or walk through any number on the slides. The script above is the only part to read out.",
};

function note(s, t) {
  const means = MEANS[state.title];
  if (!means) throw new Error(`no explanation is set for the slide ${state.title}, add it to MEANS in deck/kit.js`);
  // the speaker's name, the words to say, then a crib that is not read out
  s.addNotes(`${who()}\n\n${t}\n\nWhat this slide means. Do not read this out.\n${means}`);
}
// speaking time in seconds for a note, at 150 words a minute
function words(t) { return Math.round(t.split(/\s+/).length / 2.5); }
function count(secs) { const w = who(); state.count += 1; state.secs.push({ n: state.count, who: w, secs }); }

// a content slide, title and an optional one sentence takeaway. Returns the slide and the y where visuals can start.
function content({ title, take, notes, secs, fixed = false, dark = false }) {
  const s = pres.addSlide({ masterName: dark ? "Content Dark" : "Content", sectionTitle: state.section });
  s.addText(title, { placeholder: "title" });
  state.title = title;
  if (state.tag) text(s, state.tag, { x: 6.9, y: 0.08, w: 2.5, h: 0.24, fontSize: 12, color: dark ? C.accent4 : C.text2, align: "right", objectName: "section tag" });
  let top = 1.2;
  if (take) {
    const lines = Math.ceil(take.length / 84);
    if (take.length > 84) console.warn(`takeaway wraps to ${lines} lines on ${title}, shorten it`);
    text(s, take, { x: M, y: 1.04, w: 8.8, h: 0.33 * lines + 0.04, fontSize: 18, color: dark ? C.accent4 : C.text2, objectName: "takeaway" });
    top = 1.04 + 0.33 * lines + 0.2;
  }
  note(s, notes);
  count(fixed || secs === 0 ? secs : words(notes));
  return { s, top };
}

// ---------- finishing ----------
const SERIES_STYLE = {};
function lineStyle(name, dash, marker) { SERIES_STYLE[name] = [dash, marker]; }

async function applyTheme(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const part = "ppt/theme/theme1.xml";
  const slots = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
  for (const k of slots) if (!/^[0-9A-Fa-f]{6}$/.test(HEX[k])) throw new Error(`theme colour ${k} is not six hex digits`);
  const scheme = `<a:clrScheme name="${THEME.name}">` + slots.map((k) => `<a:${k}><a:srgbClr val="${HEX[k].toUpperCase()}"/></a:${k}>`).join("") + "</a:clrScheme>";
  let xml = await zip.file(part).async("string");
  xml = xml.replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme)
    .replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, (_, head) => `${head}${THEME.name}"`);
  zip.file(part, xml);
  // pptxgenjs lists its own default fonts and theme in docProps/app.xml, so name the ones the deck really uses
  const app = await zip.file("docProps/app.xml").async("string");
  zip.file("docProps/app.xml", app.replace("<vt:lpstr>Arial</vt:lpstr>", `<vt:lpstr>${THEME.headFontFace}</vt:lpstr>`).replace("<vt:lpstr>Calibri</vt:lpstr>", `<vt:lpstr>${FONT.mono}</vt:lpstr>`).replace("<vt:lpstr>Office Theme</vt:lpstr>", `<vt:lpstr>${THEME.name}</vt:lpstr>`));
  for (const name of ["docProps/app.xml", "docProps/core.xml"]) {
    if (/pptxgen/i.test(await zip.file(name).async("string"))) throw new Error(`${name} still carries a generator label`);
  }
  // a scheme colour handed to an option that only takes hex is written as a bad srgbClr, catch it here
  for (const name of Object.keys(zip.files).filter((n) => n.endsWith(".xml"))) {
    const bad = (await zip.file(name).async("string")).match(/<a:srgbClr val="((?![0-9A-Fa-f]{6}")[^"]*)"/);
    if (bad) throw new Error(`${name} has a colour that is not hex (${bad[1]}), a scheme colour went into a hex only option`);
  }
  // pptxgenjs gives a whole chart one dash and marker, so line series get their own here
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n))) {
    let c = await zip.file(name).async("string");
    if (!c.includes("<c:lineChart>")) continue;
    c = c.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => {
      const m = ser.match(/<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/);
      const st = m && SERIES_STYLE[m[1]];
      if (!st) return ser;
      return ser.replace('<a:prstDash val="solid"/>', `<a:prstDash val="${st[0]}"/>`).replace(/<c:symbol val="[^"]*"\/>/, `<c:symbol val="${st[1]}"/>`);
    });
    zip.file(name, c);
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

async function finish(file) {
  if (!PARTIAL && state.count !== TOTAL) throw new Error(`built ${state.count} slides but TOTAL says ${TOTAL}, fix TOTAL in deck/kit.js`);
  await pres.writeFile({ fileName: file });
  await applyTheme(file);
  const main = state.secs.filter((x) => x.n <= MAIN_END);
  const sum = (a) => a.reduce((t, x) => t + x.secs, 0);
  const by = (who) => sum(main.filter((x) => x.who === who));
  if (missing.length) console.log("placeholders for", [...new Set(missing)].join(", "));
  console.log(`wrote ${file}, ${state.count} slides, talk ${main.length} slides about ${(sum(main) / 60).toFixed(1)} min `
    + `(Maaz ${(by("Maaz") / 60).toFixed(1)}, Kanav ${(by("Kanav") / 60).toFixed(1)}, Daniel ${(by("Daniel") / 60).toFixed(1)})`);
}

module.exports = {
  pres, C, SH, THEME, HEX, X, FONT, M, WHITE, TOTAL, MAIN_END, DEMO, DEMO_KIND, MEDIA, HAS_DEMO, STATS, RSTATS, DATA, PLOTS, state,
  SETUPS, setupKey, setupLabel, setupRow, findKey,
  text, hline, vline, arrow, cell, circle, laptop, ipad, plot, photo, withoutLastLine, chartFrame, axes,
  section, speaker, note, count, content, lineStyle, finish,
};
