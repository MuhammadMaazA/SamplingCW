"use strict";
// Shared theme, layouts and drawing helpers for the deck. Every slide module builds on this.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const JSZip = require("jszip");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const PLOTS = path.join(ROOT, "plots");
const STATS = require(path.join(PLOTS, "stats.json"));
const RSTATS = require(path.join(ROOT, "..", "report", "generated", "stats.json"));
const DATA = require("./data");

// An optional demonstration clip. The slide after "How one run goes" exists only when this file does, so the counts follow it.
// DECK_DEMO points at another file, which is how the slide is tried out without putting a clip in the repository.
const DEMO = process.env.DECK_DEMO || path.join(ROOT, "media", "demo.mp4");
const HAS_DEMO = fs.existsSync(DEMO);
const TOTAL = 54 + (HAS_DEMO ? 1 : 0); // slides in the whole deck. finish() checks the count.
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
pres.author = "Muhammad Maaz, Kanav Mehta";
pres.subject = "COMP0228 Coursework 1";
pres.company = "University College London";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const SH = pres.shapes;
const M = 0.6; // slide margin
const WHITE = "FFFFFF";

const state = { speaker: "Maaz", section: "Opening", count: 0, secs: [] };


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
  title: "Divider", background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.35, w: 8.8, h: 0.95, fontSize: 46, bold: true,
      color: C.background1, align: "left", valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 3.5, w: 8.2, h: 0.8, fontSize: 20,
      color: C.accent4, align: "left", valign: "top", margin: 0 }, text: "" } },
    pageTotal(true),
  ],
  slideNumber: pageNo(true),
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
  try { meta = await sharp(path.join(PLOTS, file)).metadata(); } catch (e) {
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
    s.addImage({ path: path.join(PLOTS, file), x, y: o.y, w, h, objectName: o.name ?? file, altText: o.alt ?? o.name ?? file });
  }
  return { x, y: o.y, w, h };
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
function section(name) {
  pres.addSection({ title: name });
  state.section = name;
}
function speaker(name) { state.speaker = name; }
function note(s, t) { s.addNotes(`${state.speaker}. ${t}`); }
// speaking time in seconds for a note, at 150 words a minute
function words(t) { return Math.round(t.split(/\s+/).length / 2.5); }
function count(secs) { state.count += 1; state.secs.push({ n: state.count, who: state.speaker, secs }); }

// a content slide, title and an optional one sentence takeaway. Returns the slide and the y where visuals can start.
function content({ title, take, notes, secs, fixed = false, dark = false }) {
  const s = pres.addSlide({ masterName: dark ? "Content Dark" : "Content", sectionTitle: state.section });
  s.addText(title, { placeholder: "title" });
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

// the progress strip on dividers, one square for each part of the talk
function progress(s, current, total = 5, x = M, y = 0.75) {
  for (let i = 0; i < total; i++) {
    const done = i < current, now = i === current - 1;
    cell(s, x + i * 0.32, y, 0.22, 0.22, "", { fill: done ? (now ? HEX.lt1 : HEX.accent4) : HEX.dk1,
      line: done ? (now ? HEX.lt1 : HEX.accent4) : HEX.dk2, lw: 0.75, name: `progress ${i + 1}` });
  }
}
function divider({ index, title, sub, notes }) {
  section(title);
  const s = pres.addSlide({ masterName: "Divider", sectionTitle: title });
  progress(s, index);
  text(s, String(index).padStart(2, "0"), { x: M, y: 1.45, w: 1.2, h: 0.9, fontSize: 64, bold: true, color: C.accent4, fontFace: FONT.head, objectName: "section number" });
  s.addText(title, { placeholder: "title" });
  s.addText(sub, { placeholder: "body" });
  note(s, notes);
  count(words(notes));
  return s;
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
    + `(Maaz ${(by("Maaz") / 60).toFixed(1)}, Kanav ${(by("Kanav") / 60).toFixed(1)})`);
}

module.exports = {
  pres, C, SH, THEME, HEX, X, FONT, M, WHITE, TOTAL, MAIN_END, DEMO, HAS_DEMO, STATS, RSTATS, DATA, PLOTS, state,
  SETUPS, setupKey, setupLabel, setupRow, findKey,
  text, hline, vline, arrow, cell, circle, laptop, ipad, plot, photo, chartFrame, axes,
  section, speaker, note, count, content, divider, progress, lineStyle, finish,
};
