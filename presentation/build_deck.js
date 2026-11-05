// Builds gridlink-presentation.pptx from our results. Run with `node build_deck.js`.
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const fs = require("fs");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));

// pptxgenjs cannot write theme colours, so swap the colour scheme in theme1.xml after saving.
async function applyTheme(deckPath, theme) {
  const slots = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4",
    "accent5", "accent6", "hlink", "folHlink"];
  const zip = await JSZip.loadAsync(fs.readFileSync(deckPath));
  const part = "ppt/theme/theme1.xml";
  const scheme = `<a:clrScheme name="${theme.name}">` +
    slots.map((k) => `<a:${k}><a:srgbClr val="${theme.colors[k]}"/></a:${k}>`).join("") +
    "</a:clrScheme>";
  const xml = (await zip.file(part).async("string"))
    .replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, scheme);
  zip.file(part, xml);
  fs.writeFileSync(deckPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

const OUT = "gridlink-presentation.pptx";
const PLOTS = path.join(__dirname, "plots");
const STATS = require(path.join(PLOTS, "stats.json"));
// numbers shared with the final report, read only from the report's generated statistics
const RSTATS = require(path.join(__dirname, "..", "report", "generated", "stats.json"));

const THEME = {
  name: "GridLink",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1B1F24", lt1: "FFFFFF", dk2: "4A525C", lt2: "F1F3F5",
    accent1: "3B6EA5", accent2: "C1553B", accent3: "4F8A6B",
    accent4: "E0A33A", accent5: "8A929B", accent6: "2A3038",
    hlink: "3B6EA5", folHlink: "6D4C8D",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.title = "GridLink, error correction over a screen to camera link";
pres.author = "Muhammad Maaz, Kanav Mehta";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "Title Dark",
  background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.55, w: 8.8, h: 1.1,
      fontSize: 44, bold: true, color: C.background1, align: "left", valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 2.8, w: 8.8, h: 1.2,
      fontSize: 18, color: C.background2, align: "left", valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "Content",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9.0, h: 0.75,
      fontSize: 36, bold: true, color: C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: C.accent5, align: "right" },
});
pres.defineSlideMaster({
  title: "Content Dark",
  background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9.0, h: 0.75,
      fontSize: 36, bold: true, color: C.background1, align: "left", valign: "middle", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: C.accent5, align: "right" },
});

// ---------- helpers ----------
const shadow = () => ({ type: "outer", color: "000000", opacity: 0.12, blur: 6, offset: 2, angle: 90 });

async function iconData(Comp, color = "FFFFFF") {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: 256 }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

async function iconCircle(slide, Comp, x, y, d, fill, name) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: name + " circle" });
  const pad = d * 0.25;
  slide.addImage({ data: await iconData(Comp), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, objectName: name + " icon" });
}

function card(slide, x, y, w, h, name, fill = C.background2) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill }, objectName: name,
  });
}

function text(slide, t, opts) {
  slide.addText(t, { isTextBox: true, margin: 0, color: C.text1, fontSize: 15, valign: "top", ...opts });
}

// row of black and white squares, the deck's motif (a bit stream)
function bitRow(slide, bits, x, y, size, gap, name, light = false) {
  bits.forEach((b, i) => {
    const on = light ? C.background1 : C.text1;
    const off = light ? C.text2 : C.background2;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: x + i * (size + gap), y, w: size, h: size,
      fill: { color: b ? on : off }, line: { color: light ? C.text2 : C.accent5, width: 0.5 },
      objectName: `${name} bit ${i + 1}`,
    });
  });
}

const chartText = { catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt",
  legendFontFace: "+mn-lt", titleFontFace: "+mn-lt", catAxisTitleFontFace: "+mn-lt", valAxisTitleFontFace: "+mn-lt" };
// one frame for every native chart, same label colour and size, light gridlines, no chart title
const chartFrame = {
  catAxisLabelColor: HEX.dk2, valAxisLabelColor: HEX.dk2, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
  catAxisTitleColor: HEX.dk1, valAxisTitleColor: HEX.dk1, catAxisTitleFontSize: 11, valAxisTitleFontSize: 11,
  legendFontSize: 11, legendColor: HEX.dk2, dataLabelFontSize: 10, dataLabelColor: HEX.dk1,
  valGridLine: { color: "E3E6EA", size: 0.75 }, catGridLine: { style: "none" },
  catAxisLineShow: true, valAxisLineShow: false, showTitle: false, ...chartText,
};
const axes = (val, cat) => ({
  ...(val ? { showValAxisTitle: true, valAxisTitle: val } : {}),
  ...(cat ? { showCatAxisTitle: true, catAxisTitle: cat } : {}),
});
// pptxgenjs sets one dash and marker for a whole chart, so line series get their own after writing
const SERIES_STYLE = {
  "Facing screen, 8 bps": ["solid", "circle"], "Reflection with glare, 4 bps": ["dash", "square"],
  "Hamming": ["solid", "circle"], "Hamming-interleaved": ["dash", "square"], "repetition-3": ["sysDot", "triangle"],
  "Hamming rate 0.571": ["dash", "none"], "rep-3 rate 0.333": ["sysDot", "none"],
};
async function styleLineSeries(file) {
  const JSZip = require("jszip");
  const fs = require("fs");
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n))) {
    let xml = await zip.file(name).async("string");
    if (!xml.includes("<c:lineChart>")) continue;
    xml = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => {
      const m = ser.match(/<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/);
      const st = m && SERIES_STYLE[m[1]];
      if (!st) return ser;
      return ser.replace('<a:prstDash val="solid"/>', `<a:prstDash val="${st[0]}"/>`)
        .replace(/<c:symbol val="[^"]*"\/>/, `<c:symbol val="${st[1]}"/>`);
    });
    zip.file(name, xml);
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

// ---------- new data slides, numbers come from plots/stats.json (make_plots.py) ----------
async function addPlot(slide, file, x, y, w, name, alt, maxH) {
  const meta = await sharp(path.join(PLOTS, file)).metadata();
  let h = w * meta.height / meta.width;
  if (maxH && h > maxH) { w = maxH * meta.width / meta.height; h = maxH; }
  slide.addImage({ path: path.join(PLOTS, file), x, y, w, h, objectName: name, altText: alt });
  return { w, h };
}
const fmtRange = (a, b, d = 1) => (a === b ? a.toFixed(d) : `${a.toFixed(d)} to ${b.toFixed(d)}`);

function slideSetupNumbers() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Channel and codes" });
  s.addText("The setup in numbers", { placeholder: "title" });
  const groups = { "Facing screen, 3 bps": "G01 to G07", "Facing screen, 8 bps": "G08 to G14", "Reflection, 4 bps": "G15 to G21",
    "Reflection with glare, 4 bps": "G22 to G26", "Reflection with glare, 2 bps": "G27" };
  const hdr = ["Setup", "Groups", "Camera fps", "Samples per bit", "Threshold", "White and black", "Region in pixels"];
  const head = hdr.map((t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 } } }));
  const rows = STATS.setup.map((r, i) => [
    { text: r.env, options: { bold: true } }, groups[r.env],
    fmtRange(r.fps_min, r.fps_max), fmtRange(r.spb_min, r.spb_max), fmtRange(r.thr_min, r.thr_max),
    `${r.white_med} and ${r.black_med}`, r.roi_min === r.roi_max ? r.roi_min : `${r.roi_min} up to ${r.roi_max}`,
  ].map((c) => (typeof c === "string" ? { text: c, options: { fill: { color: i % 2 ? C.background1 : C.background2 } } }
    : { text: c.text, options: { ...c.options, fill: { color: i % 2 ? C.background1 : C.background2 } } })));
  s.addTable([head, ...rows], {
    x: 0.5, y: 1.15, w: 9.0, colW: [2.35, 0.95, 0.9, 0.85, 1.05, 1.1, 1.8],
    fontFace: THEME.bodyFontFace, fontSize: 12, color: C.text1, valign: "middle",
    border: { type: "solid", pt: 0.5, color: "D5D9DE" }, rowH: 0.38, margin: 0.05, objectName: "setup table",
  });
  const cards = [
    ["Frame timing", "One frame of 272 to 464 bits lasts 34 s at 8 bps and up to 192 s at 2 bps"],
    ["Levels", "Median brightness at symbol centres on a 0 to 255 scale, threshold fixed at calibration"],
    ["Region", "Glare sessions boxed the whole iPad, so reflections were averaged in with the patch"],
  ];
  cards.forEach(([h, b], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 3.85, 2.9, 1.2, `setup card ${i + 1}`);
    text(s, h, { x: x + 0.2, y: 3.95, w: 2.5, h: 0.32, fontSize: 15, bold: true, color: C.accent1, objectName: `setup card head ${i + 1}` });
    text(s, b, { x: x + 0.2, y: 4.28, w: 2.55, h: 0.72, fontSize: 13, objectName: `setup card body ${i + 1}` });
  });
  s.addNotes("Maaz. The measured conditions per setup, from the saved camera logs. The camera ran at 22 to 30 frames per second, so 8 bps gives about 4 samples per bit, 3 and 4 bps about 7, and 2 bps about 14. That is why we chose those rates. 3 and 4 bps are comfortable baselines, 8 bps stresses sampling to provoke random flips, and 2 bps tests whether more samples per bit rescue glare. White and black are medians at symbol centres, robust to a few odd frames. The glare runs in the dim lab had bright blacks of 100 to 126, and their region covered the whole iPad, so room reflections were averaged in. That matters on the next slide.");
}

async function slideCameraTrace() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Channel and codes" });
  s.addText("What the camera actually sees", { placeholder: "title" });
  await addPlot(s, "raw-traces.png", 0.4, 1.12, 6.4, "raw brightness traces",
    "Camera brightness over 30 seconds of a clean frame and a glare frame, with the threshold and bit errors marked", 3.65);
  const crops = [["crop-clean.png", "Reflection region, 20 by 25 px"], ["crop-glare-c.png", "Glare 4 bps region (G24), 647 by 544 px"]];
  for (let i = 0; i < crops.length; i++) {
    const y = 1.15 + i * 1.95;
    await addPlot(s, crops[i][0], 7.1, y, 2.4, `camera crop ${i + 1}`, crops[i][1], 1.45);
    text(s, crops[i][1], { x: 7.1, y: y + 1.5, w: 2.5, h: 0.3, fontSize: 11, color: C.text2, objectName: `camera crop caption ${i + 1}` });
  }
  text(s, "In glare, black never settles. After each white flash the reading climbs back over the threshold and a run of 0s reads as 1s",
    { x: 0.5, y: 4.85, w: 8.4, h: 0.5, fontSize: 13, color: C.text2, objectName: "trace takeaway" });
  s.addNotes(`Maaz. Raw brightness straight from the capture files, 30 seconds of one frame each. Top is the reflection in the lab with normal light on 27 Oct, repetition-5, zero errors, every white well above the amber threshold. Bottom is glare in the dimmed lab on 26 Oct, repetition-3, 116 errors in the frame and ${STATS.traces[1].errors_in_window} in this window. After each white flash the reading drops, then creeps back above the threshold of 143 for a second or two. The likely cause is auto exposure brightening a dark scene, plus room light on the glossy iPad. So a run of black symbols reads as white, which is a burst. On the right are the regions averaged, a small patch against the whole iPad.`);
}

// native table in the deck style, dark header row, alternating row fills, first column bold
function styledTable(slide, hdr, rows, colW, y, rowH, name, fontSize = 13) {
  const head = hdr.map((t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 } } }));
  const body = rows.map((r, i) => r.map((c, j) => ({
    text: c, options: { bold: j === 0, fill: { color: i % 2 ? C.background1 : C.background2 } },
  })));
  slide.addTable([head, ...body], {
    x: 0.5, y, w: 9.0, colW, fontFace: THEME.bodyFontFace, fontSize, color: C.text1, valign: "middle",
    border: { type: "solid", pt: 0.5, color: "D5D9DE" }, rowH, margin: [0.03, 0.06, 0.03, 0.06], objectName: name,
  });
}

// every recording, from session.json, plan.json and capture.log in experiments/results
function slideSessions() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Experiments" });
  s.addText("Every recording session", { placeholder: "title" });
  const rows = [
    ["26 Oct 16:33", "Lab, reflection, 5 runs", "Dim, glare", "4", "rep-3", "15", "143 to 188", "2 of 15, G22 to G26"],
    ["26 Oct 17:24", "Lab, reflection", "Dim, glare", "2", "rep-3", "3", "182", "2 of 3, G27"],
    ["27 Oct 16:22", "Pipeline test debug1", "Not logged", "n/a", "None", "0", "n/a", "Not a result"],
    ["27 Oct 16:39", "Lab, reflection", "No glare", "4", "rep-3", "3", "95", "3 of 3, G29"],
    ["27 Oct 17:07", "Outside lab, path unsure", "Dim, glare", "2", "All 7", "21", "93", "1 of 21, only 3 filmed"],
    ["27 Oct 17:32", "Lab, facing", "No glare", "4", "rep-3", "2", "65", "1 of 2, G28"],
    ["27 Oct 17:44", "Lab, reflection", "No glare", "4", "All 7", "21", "59", "20 of 21, G15 to G21"],
    ["30 Oct 18:03", "Room, facing", "No glare", "3", "All 7", "21", "n/a", "None, stopped at 16.7 s"],
    ["30 Oct 18:04", "Room, facing", "No glare", "3", "All 7", "21", "114", "14 of 21, G01 to G07"],
    ["31 Oct 15:03", "Not logged, facing", "No glare", "8", "All 7", "21", "142", "9 of 21, G08 to G14"],
  ];
  styledTable(s, ["When", "Where and path", "Light", "bps", "Codes", "Trials", "Threshold", "Frames delivered"], rows,
    [1.15, 1.95, 0.95, 0.5, 0.7, 0.6, 0.95, 2.2], 1.1, 0.33, "sessions table");
  text(s, "Laptop 1 sends, laptop 2 records. Payload 16 bits, or 32 on 26 Oct. Threshold on a 0 to 255 scale",
    { x: 0.5, y: 4.75, w: 8.4, h: 0.45, fontSize: 13, color: C.text2, objectName: "sessions note" });
  s.addNotes("Maaz. This is every recording we made, failed ones included, in date order, taken from each session's saved log. Laptop 1 sends, laptop 2 records, and the group ran every session together. On 26 Oct, in the lab with the lights dimmed, we ran five glare runs at 4 bps and one at 2 bps, all repetition-3. On 27 Oct came a pipeline test, a short reflection run, the outside the lab session, a quick facing run and the main reflection comparison. On 30 Oct in a separate room we ran the facing comparison at 3 bps after one aborted start, and on 31 Oct the same at 8 bps. Three rows gave nothing usable, and two slides on we explain each one.");
}

function slideChanges() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Experiments" });
  s.addText("What we changed and why", { placeholder: "title" });
  const rows = [
    ["Speed, facing. 3 then 8 bps, all 7 codes, 3 trials each", "30 Oct room, 31 Oct, G01 to G14",
      "BER 0.001 to 0.026 rose to 0.016 to 0.049. Frames 14 to 9 of 21",
      "At 30 fps, 8 bps leaves about 4 samples per bit, so white smears into the next bit"],
    ["Camera path at 4 bps. Facing against reflection", "27 Oct lab, G28 against G15 to G21 and G29",
      "Both 0 BER. Reflection 23 of 24 frames, facing 1 of 2 with one cut short",
      "White 89 and 165 reflected, 106 facing, all well above black. G28 has only 2 trials"],
    ["Lighting, reflection, 4 bps. Normal against dim lab", "27 Oct against 26 Oct, G15 to G21 against G22 to G26",
      "BER 0 to 0.003 rose to 0.073 to 0.315. Frames 20 of 21 to 2 of 15",
      "Glare and auto exposure lift the black level after each white flash, which gives bursts"],
    ["Speed in glare. 4 then 2 bps, rep-3", "26 Oct dim lab, G22 to G26 against G27",
      "BER 0.073 to 0.315 fell to 0.004. Frames 2 of 15 to 2 of 3",
      "More samples per bit or milder glare, one session cannot tell"],
    ["Location. Outside the lab, dim with glare, 2 bps", "27 Oct, session full1",
      "Only 3 of 21 trials filmed. BER 0.005 to 0.023, 1 frame delivered",
      "Not comparable, the plan outran the recording"],
  ];
  styledTable(s, ["Change and how", "When and where", "Channel BER and frames", "Why"], rows, [2.2, 1.85, 2.45, 2.5], 1.1, [0.36, 0.66, 0.66, 0.66, 0.66, 0.66], "changes table");
  s.addNotes("Maaz. Each row changes one thing so the result can be tied to it. First, speed facing the screen. At 8 bps the camera gets about 4 samples per bit, the white flash smears into the next symbol, and frames fell from 14 to 9 of 21. The two days also differ in room, so speed is not the only change. Second, camera path in the lab. Both were clean, but the facing run has only 2 trials, so we do not lean on it. Third, dimming the lab took the reflection to 7 to 32 percent channel BER through bursts. The dim runs used only repetition-3 with a 32 bit payload, so compare repetition-3 with repetition-3, 3 of 3 against 2 of 15. Fourth, halving the speed in glare cut BER to 0.4 percent, though milder glare that session is a confound. Last, the outside the lab run cannot be compared, which Kanav explains shortly.");
}

function slideDidNotWork() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Experiments" });
  s.addText("Runs that did not work, and why", { placeholder: "title" });
  const rows = [
    ["Outside the lab, 27 Oct 17:07. Dim with glare, 2 bps, all 7 codes, 21 trials",
      "First pass 0 of 21. Against laptop 1's real schedule 3 trials synced, BER 0.005 to 0.023, rep-3 delivered",
      "Wrong trial order on laptop 2. The plan needed 3571 s, recording stopped at 480 s",
      "A planning failure, not a channel failure. Size plans to the bit rate"],
    ["Room, 30 Oct 18:03. Facing, 3 bps, all 7 codes", "Stopped after 16.7 s and 501 samples, the capture would not load",
      "The camera repeated timestamps", "The retry dropped 179 duplicates and became G01 to G07"],
    ["Lab, 27 Oct 17:44. Reflection, 4 bps, all 7 codes", "First pass decoded 0 of 21",
      "Same bug, the printed transmit command reordered the codes", "Re-analysed against laptop 1's schedule, now G15 to G21"],
    ["Lab, 26 Oct. Glare, 4 bps, 5 runs of rep-3", "9 of 15 frames died at the header CRC, one run stopped early",
      "Glare bursts, see Where whole frames were lost", "Auto lock off, recalibrate between runs"],
    ["27 Oct 16:22. debug1, 168 s, no plan", "Only checked that capture worked", "A pipeline test", "Not a result and not counted"],
  ];
  styledTable(s, ["Run, when, where, setup", "What happened", "Why", "Lesson"], rows, [2.35, 2.55, 2.2, 1.9], 1.1, [0.36, 0.86, 0.62, 0.62, 0.62, 0.55], "failed runs table");
  s.addNotes("Kanav. Every failed or discarded recording and what it taught us. The biggest is outside the lab on 27 Oct, at 2 bps in dim light with glare. The first analysis decoded 0 of 21 because a bug in how the transmit command was printed reordered the codes, so laptop 2 checked the wrong order. Against the schedule laptop 1 really sent, 3 trials synchronised. At the calibrated threshold of 93 channel BER was 0.005 to 0.023 and repetition-3 delivered its frame, and at the automatic threshold of 81.5 two frames came through with no errors. The other 18 trials were never filmed, because the plan needed about an hour of airtime and recording stopped after 8 minutes. That was a planning failure, not a channel failure. The same bug first hid the main reflection session, the 30 Oct start was aborted after 17 seconds, and debug1 only checked capture.");
}

function slideFailures() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Experiments" });
  s.addText("Where whole frames were lost", { placeholder: "title" });
  const F = STATS.failures;
  const SHORT = { "Facing screen, 3 bps": "Facing 3 bps", "Facing screen, 8 bps": "Facing 8 bps", "Facing screen, 4 bps": "Facing 4 bps",
    "Reflection, 4 bps": "Reflection 4 bps", "Reflection with glare, 4 bps": "Glare 4 bps", "Reflection with glare, 2 bps": "Glare 2 bps" };
  const labels = F.map((r) => SHORT[r.env]);
  const series = [
    ["Delivered", "valid_frames", HEX.accent3], ["Payload CRC failed", "payload_crc_failures", HEX.accent2],
    ["Header CRC failed", "header_crc_failures", HEX.accent4], ["Uncorrectable", "uncorrectable", HEX.dk1],
    ["Cut short", "truncated", HEX.accent5], ["Sync not found", "sync_failures", "C9CED4"],
  ];
  s.addChart(pres.charts.BAR, series.map(([name, key]) => ({ name, labels, values: F.map((r) => r[key]) })), {
    x: 0.4, y: 1.15, w: 5.9, h: 3.95, barDir: "bar", barGrouping: "stacked", chartColors: series.map((x) => x[2]),
    showLegend: true, legendPos: "b", catAxisOrientation: "maxMin",
    valAxisMinVal: 0, valAxisMaxVal: 24, valAxisMajorUnit: 4, ...chartFrame, ...axes("Frames, 86 planned trials in total"),
    objectName: "failure breakdown chart",
  });
  text(s, "What went wrong in practice", { x: 6.6, y: 1.2, w: 2.9, h: 0.35, fontSize: 16, bold: true, objectName: "practice heading" });
  const items = [
    ["Facing 3 bps", "179 repeated camera timestamps were dropped and 6 of 21 frames were cut short"],
    ["Glare 4 bps", "9 of 15 frames died at the header CRC before the payload code could act"],
    ["Facing 8 bps", "10 frames failed the payload CRC and 2 were uncorrectable, bit errors the codes could fight"],
    ["Not shown", "runs we could not analyse are on the next slide"],
  ];
  text(s, items.flatMap(([h, t], j) => [
    { text: h + " ", options: { bullet: true, bold: true } },
    { text: t, options: { breakLine: j < items.length - 1 } },
  ]),
    { x: 6.6, y: 1.65, w: 2.95, h: 3.4, fontSize: 13, paraSpaceAfter: 6, objectName: "practice list" });
  s.addNotes("Kanav. Bit error rate hides the worst failure, losing the whole frame, so this counts every one of the 86 planned trials in the analysed groups. Green is delivered. At 8 bps frames arrive but fail the payload CRC, a bit error problem the codes can fight. In the dim lab with glare, 9 of 15 frames die at the header, which is always repetition-3, so the payload code never gets a chance. Facing the screen at 3 bps, 6 frames were cut short because we dropped 179 repeated camera timestamps and sampling ran out. Recordings we could not analyse at all come next.");
}

async function slideWilson() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Experiments" });
  s.addText("How sure are 3 trials", { placeholder: "title" });
  await addPlot(s, "wilson.png", 0.6, 1.1, 8.6, "frame success with Wilson intervals",
    "Frame success per method with 95 percent Wilson intervals for the three seven method sessions", 3.42);
  const [lo3] = STATS.wilson_3of3, [, hi0] = STATS.wilson_0of3;
  const p = RSTATS.fisher_fast_rep7_vs_hamming.toFixed(2);
  const PF = RSTATS.pooled_frames, pmin = Math.min(...Object.values(RSTATS.fisher)).toFixed(2);
  text(s, `Bars are 95% Wilson intervals. Pooled over three sessions, frame success runs from ${PF.none[0]} of 9 uncoded to ${PF["rep-5"][0]} of 9 for rep-5, and no method differs from the best, p of ${pmin} or more`,
    { x: 0.5, y: 4.6, w: 4.4, h: 0.75, fontSize: 13, color: C.text2, objectName: "wilson note" });
  text(s, `Our widest gap, rep-7 3 of 3 against Hamming 0 of 3 at 8 bps, gives Fisher exact p = ${p}, so it is a pattern, not proof`,
    { x: 5.1, y: 4.6, w: 4.0, h: 0.75, fontSize: 13, bold: true, color: C.accent2, objectName: "fisher note" });
  s.addNotes(`Kanav. With 3 trials per cell the statistics need care. Frame success gets Wilson intervals, because at 0 of 3 and 3 of 3 the normal interval collapses to a point. Method comparisons use Fisher exact tests, which stay exact at counts this small. Our widest gap, repetition-7 3 of 3 against Hamming 0 of 3 at 8 bps, gives p of ${p}. Pooling the three seven code sessions gives 9 trials per method, from ${PF.none[0]} of 9 uncoded to ${PF["rep-5"][0]} of 9 for repetition-5, and nothing differs from the best. BER intervals in the report resample whole trials, because errors within a frame are correlated. So frame rankings are suggestive only, and the bit level tests that follow carry the claims.`);
}

function slidePattern() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Noise" });
  s.addText("Errors follow the bit pattern", { placeholder: "title" });
  const F8 = RSTATS.noise["8 bps facing"], GL = RSTATS.noise["4 bps glare"];
  const L = ["1", "2", "3", "4", "5", "6+"];
  const rate = (o) => L.map((_, i) => { const [e, n] = o.run_position_rate[String(i + 1)]; return e / n; });
  s.addChart(pres.charts.LINE, [
    { name: "Facing screen, 8 bps", labels: L, values: rate(F8) },
    { name: "Reflection with glare, 4 bps", labels: L, values: rate(GL) },
  ], {
    x: 0.4, y: 1.1, w: 5.2, h: 3.5, chartColors: [HEX.accent1, HEX.accent2], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    showLegend: true, legendPos: "t",
    valAxisMinVal: 0, valAxisMaxVal: 0.3, valAxisMajorUnit: 0.1, valAxisLabelFormatCode: "0%", ...chartFrame,
    ...axes("Error rate", "Position of the symbol in a run of one colour"),
    objectName: "run position chart",
  });
  const r = (a) => a[0] / a[1], el = GL.early_late;
  s.addChart(pres.charts.BAR, [{
    name: "Error rate", labels: ["After white", "After black", "Symbols 1 to 2", "Symbol 3 on"],
    values: [r(F8.black_after_white), r(F8.black_after_black), el[0] / el[1], el[2] / el[3]],
  }], {
    x: 5.8, y: 1.1, w: 3.8, h: 3.5, barDir: "col", barGapWidthPct: 50, chartColors: [HEX.accent1, HEX.accent5, HEX.accent5, HEX.accent2],
    showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0%",
    valAxisMinVal: 0, valAxisMaxVal: 0.22, valAxisMajorUnit: 0.05, valAxisLabelFormatCode: "0%", ...chartFrame,
    ...axes("Error rate", "8 bps black symbols, then glare"), objectName: "mechanism chart",
  });
  const fd = F8.flip_direction;
  text(s, `At 8 bps, ${fd["black read white"]} of ${fd["black read white"] + fd["white read black"]} errors are black read as white, white smearing into the next symbol. In glare, errors grow once a colour is held`,
    { x: 0.5, y: 4.7, w: 5.2, h: 0.55, fontSize: 13, color: C.text2, objectName: "pattern note" });
  text(s, "Both contrasts Fisher exact p < 10⁻¹⁰",
    { x: 5.9, y: 4.7, w: 3.6, h: 0.3, fontSize: 13, bold: true, color: C.accent2, objectName: "mechanism note" });
  s.addNotes(`Kanav. Conditioning errors on the data we sent separates two mechanisms. At 8 bps, ${fd["black read white"]} of ${fd["black read white"] + fd["white read black"]} errors are a black symbol read as white, and a black symbol fails ${(100 * r(F8.black_after_white)).toFixed(1)} percent of the time right after a white, against ${(100 * r(F8.black_after_black)).toFixed(1)} percent after another black. With about 4 camera frames per symbol, white smears into the next symbol, a form of intersymbol interference. Glare reverses the pattern. Errors are rare in the first two symbols of a run, ${(100 * el[0] / el[1]).toFixed(1)} percent, and common from the third, ${(100 * el[2] / el[3]).toFixed(1)} percent, on both colours, which fits auto exposure drifting while a colour is held. We used Fisher exact tests, and both contrasts give p below 10 to the minus 10.`);
}

async function slideModelTest() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Noise" });
  s.addText("Testing a random flip model", { placeholder: "title" });
  const N = RSTATS.noise, F3 = N["3 bps facing"], F8 = N["8 bps facing"], GL = N["4 bps glare"], MC = RSTATS.glare_model_check;
  s.addChart(pres.charts.BAR, [{
    name: "Share", labels: ["Observed", "Two state model", "Memoryless"], values: [GL.burst_share, MC.GE[0], MC.memoryless[0]],
  }], {
    x: 0.4, y: 1.1, w: 4.3, h: 2.85, barDir: "col", barGapWidthPct: 60, chartColors: [HEX.accent2, HEX.accent1, HEX.accent5],
    showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
    valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: "0.00", ...chartFrame,
    ...axes("Glare errors in runs of 3 or more"), objectName: "model check chart",
  });
  text(s, `Model check on a share it was not fitted to. Simulated 95% range ${MC.GE[1].toFixed(2)} to ${MC.GE[2].toFixed(2)}`,
    { x: 0.5, y: 4.05, w: 4.2, h: 0.5, fontSize: 13, color: C.text2, objectName: "model check note" });
  const pc = (x) => (x === 0 ? "0%" : x * 100 < 10 ? (x * 100).toFixed(1) + "%" : Math.round(x * 100) + "%");
  const pv = (x) => (x >= 0.999 ? "1" : x < 0.001 ? "< 0.001" : x.toFixed(3));
  const cols = [F3, F8, GL];
  const cell = (t, o = {}) => ({ text: t, options: o });
  const rows = [
    [cell(""), ...["3 bps", "8 bps", "Glare"].map((t, i) => cell(t, { bold: true, color: [C.text1, C.accent1, C.accent2][i] }))],
    [cell("In runs of 3+"), ...cols.map((c) => cell(pc(c.burst_share)))],
    [cell("By chance"), ...cols.map((c) => cell(pc(c.burst_share_null)))],
    [cell("Permutation p"), ...cols.map((c) => cell(pv(c.burst_p)))],
    [cell("BIC memoryless"), ...cols.map((c) => cell(Math.round(c.bic_bsc).toString()))],
    [cell("BIC two state"), ...cols.map((c) => cell(Math.round(c.bic_ge).toString(), { bold: true }))],
  ];
  s.addTable(rows, {
    x: 4.95, y: 1.15, w: 4.55, colW: [1.6, 0.95, 1.0, 1.0], fontFace: THEME.bodyFontFace, fontSize: 13, color: C.text1,
    rowH: 0.38, valign: "middle", border: { type: "solid", pt: 0.5, color: "D5D9DE" }, margin: 0.05, objectName: "model table",
  });
  card(s, 4.95, 3.65, 4.55, 1.45, "gilbert card", C.text1);
  text(s, `Glare fit. Bad spells average ${GL.ge.mean_bad_length.toFixed(1)} bits and fill ${Math.round(GL.ge.bad_fraction * 100)}% of the time, with nearly every Bad bit flipped. At 3 bps the Bad spell lasts ${Math.round(F3.ge.mean_bad_length)} bits, noisier trials rather than bursts`,
    { x: 5.15, y: 3.72, w: 4.2, h: 1.3, fontSize: 13, color: C.background1, valign: "middle", objectName: "gilbert text" });
  s.addNotes(`Kanav. Two tests on thousands of bits. First a permutation test. We scatter each trial's errors uniformly over its bits 5000 times and ask how often errors sit in runs of 3 or more by chance. In glare it is ${pc(GL.burst_share)} against ${pc(GL.burst_share_null)}, at 8 bps ${pc(F8.burst_share)} against ${pc(F8.burst_share_null)}, both p below 0.001, and none at 3 bps. Second, a two state Gilbert Elliott model, a hidden Markov chain fitted by Baum Welch. We compare it with a memoryless channel by BIC, because BIC penalises the extra parameters. It wins clearly in glare and modestly at 8 bps. As a check, it reproduces the glare burst share it was never fitted to, ${MC.GE[0].toFixed(2)} against ${GL.burst_share.toFixed(2)} observed, where memoryless gives ${MC.memoryless[0].toFixed(2)}.`);
}

async function slideRepetitionTheory() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Noise" });
  s.addText("Repetition, theory against reality", { placeholder: "title" });
  await addPlot(s, "repetition-theory.png", 0.4, 1.1, 5.9, "repetition theory against measured runs",
    "Majority vote decoded BER theory curves for repetition 3, 5 and 7 with every measured repetition run overlaid", 3.95);
  const R = Object.fromEntries(STATS.repetition.map((r) => [r.group, r]));
  const st = [
    [R.G25.decoded.toFixed(3), `rep-3 in glare (G25), where theory predicts ${R.G25.theory.toFixed(3)} at channel BER ${R.G25.channel.toFixed(3)}`, C.accent2],
    [`${RSTATS.rep3_all_copies.observed} of ${RSTATS.rep3_all_copies.groups}`, `glare rep-3 groups lost all three copies, ${RSTATS.rep3_all_copies.memoryless.toFixed(1)} expected by chance`, C.accent4],
  ];
  st.forEach(([v, l, col], i) => {
    const y = 1.2 + i * 1.3;
    text(s, v, { x: 6.6, y, w: 2.9, h: 0.6, fontSize: 34, bold: true, color: col, fontFace: THEME.headFontFace, objectName: `rep stat ${i + 1}` });
    text(s, l, { x: 6.6, y: y + 0.6, w: 2.9, h: 0.6, fontSize: 13, objectName: `rep stat label ${i + 1}` });
  });
  text(s, "Decoded BER covers payload bits of decodable frames only, with the header taken from the plan, at most 144 bits per run",
    { x: 6.6, y: 3.9, w: 2.9, h: 1.1, fontSize: 11, color: C.accent5, objectName: "rep caveat" });
  s.addNotes(`Kanav. If flips were independent, majority voting would follow these curves. Our glare runs land far above them. G25 left ${R.G25.decoded.toFixed(3)} of bits wrong where theory says ${R.G25.theory.toFixed(3)}, close to not coding at all. The reason is adjacency. Of ${RSTATS.rep3_all_copies.groups} repetition-3 groups in glare, ${RSTATS.rep3_all_copies.observed} lost all three copies against ${RSTATS.rep3_all_copies.memoryless.toFixed(1)} expected without memory, because neighbouring copies share one burst. Worse, repetition lengthens same colour runs, which is what triggers glare errors. So repetition and Hamming fit our quiet channel, not glare, and the extension had to target bursts.`);
}

// model guided design, simulated on the Gilbert-Elliott channel fitted to the glare data (report design_sim.py)
function slideRedundancy() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Extension" });
  s.addText("Redundancy where bursts are not", { placeholder: "title" });
  const D = RSTATS.design["4 bps glare"];
  const keys = ["rep-3 adjacent", "rep-5 adjacent", "rep-7 adjacent", "rep-3 spread", "rep-7 spread", "Hamming", "Ham-int d4", "Ham-int d8", "Ham-int d16"];
  const labels = ["rep-3 adj.", "rep-5 adj.", "rep-7 adj.", "rep-3 spread", "rep-7 spread", "Depth 0", "Depth 4", "Depth 8", "Depth 16"];
  s.addChart(pres.charts.BAR, [{ name: "Payload success", labels, values: keys.map((k) => D[k].payload) }], {
    x: 0.4, y: 1.1, w: 6.2, h: 3.55, barDir: "col", barGapWidthPct: 40,
    chartColors: [HEX.accent5, HEX.accent5, HEX.accent5, HEX.accent3, HEX.accent3, HEX.accent2, HEX.accent1, HEX.accent1, HEX.accent1],
    showLegend: false, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: "0.00", ...chartFrame,
    ...axes("Payload success", "Repetition placement, then Hamming interleaver depth"), objectName: "design chart",
  });
  const H = D["header adjacent"], HS = D["header spread"], pc = (x) => (x * 100 < 10 ? (x * 100).toFixed(1) : Math.round(x * 100)) + "%";
  const st = [
    [`${pc(H.header)} to ${pc(HS.header)}`, "headers surviving glare, as built against spread", C.accent2],
    [`${pc(H.frame)} to ${pc(HS.frame)}`, "whole frames, spread rep-3 with a spread header", C.accent3],
  ];
  st.forEach(([v, l, col], i) => {
    const y = 1.2 + i * 1.45;
    text(s, v, { x: 6.85, y, w: 2.75, h: 0.6, fontSize: 30, bold: true, color: col, fontFace: THEME.headFontFace, objectName: `design stat ${i + 1}` });
    text(s, l, { x: 6.85, y: y + 0.62, w: 2.65, h: 0.6, fontSize: 13, objectName: `design stat label ${i + 1}` });
  });
  text(s, "The header is the bottleneck", { x: 6.85, y: 4.1, w: 2.65, h: 0.4, fontSize: 14, bold: true, color: C.accent2, objectName: "design bottleneck" });
  text(s, "Simulated on the two state model fitted to our glare data, 3000 frames per layout. It ranks designs, it does not forecast exact rates",
    { x: 0.5, y: 4.72, w: 8.6, h: 0.5, fontSize: 13, color: C.text2, objectName: "design caveat" });
  s.addNotes(`Kanav. A single synthetic burst is not our channel, so we pushed whole frames through the fitted glare model, exactly as the receiver decodes them. Placement beats quantity. With copies adjacent, more repetition makes it worse, ${D["rep-3 adjacent"].payload.toFixed(3)} down to ${D["rep-7 adjacent"].payload.toFixed(3)}, because longer runs mean longer bursts. Sending the whole message three times at the same rate gives ${D["rep-3 spread"].payload.toFixed(3)}, and seven spread copies ${D["rep-7 spread"].payload.toFixed(2)}. Interleaving depth helps up to 8 and then flattens, which fits Bad spells of 4.4 bits. The header is the bottleneck, only ${pc(H.header)} survive as built. This is a simulation, so it ranks designs rather than forecasting exact rates.`);
}

// placeholder for the final physical test, results are filled in after it runs
function slidePhysicalTest() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Conclusion" });
  s.addText("Physical test of the new layouts", { placeholder: "title" });
  card(s, 0.5, 1.1, 9.0, 0.6, "planned banner", C.accent4);
  text(s, "Planned final test. Results to be added", { x: 0.75, y: 1.1, w: 8.5, h: 0.6, fontSize: 18, bold: true, color: C.text1, valign: "middle", objectName: "planned banner text" });
  const L = [
    ["As built", "Adjacent repetition-3 payload and header, the baseline"],
    ["Spread repetition", "The whole message sent three times, same rate"],
    ["Depth 16 interleaving", "Hamming codewords sent column first, 16 deep"],
    ["Spread header", "Header copies spread the same way"],
  ];
  L.forEach(([h, b], i) => {
    const x = 0.5 + i * 2.29;
    card(s, x, 1.9, 2.14, 2.45, `layout card ${i + 1}`);
    text(s, h, { x: x + 0.15, y: 2.02, w: 1.9, h: 0.6, fontSize: 15, bold: true, color: C.accent1, objectName: `layout head ${i + 1}` });
    text(s, b, { x: x + 0.15, y: 2.65, w: 1.88, h: 1.0, fontSize: 13, objectName: `layout body ${i + 1}` });
    text(s, "Result to be added", { x: x + 0.15, y: 3.8, w: 1.9, h: 0.35, fontSize: 13, bold: true, color: C.accent5, objectName: `layout result ${i + 1}` });
  });
  text(s, "Same dimmed lab with glare, 10 or more trials per layout, Wilson intervals and Fisher exact tests",
    { x: 0.5, y: 4.55, w: 8.6, h: 0.5, fontSize: 13, color: C.text2, objectName: "physical test note" });
  s.addNotes("Kanav. This is our planned final test, and the results are not in yet. We are building the three layouts the model ranked highest into the live link, spread repetition, depth 16 interleaving and a spread header, and testing them against the layout as built. They run in the same dimmed lab with glare, with 10 or more trials per layout, so the intervals are narrower than our 3 trial cells. The question is whether the ranking from the model holds on the real channel.");
}

// pooled channel BER per setup from summary.csv, capacity of a binary symmetric channel C = 1 - H(p)
function slideWiderContext() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Conclusion" });
  s.addText("Our work in a wider context", { placeholder: "title" });
  const L = ["Reflection 4", "Glare 2", "Facing 3", "Facing 8", "Glare 4"];
  const cap = [0.995, 0.960, 0.936, 0.772, 0.449];
  s.addChart([
    { type: pres.charts.BAR, data: [{ name: "Capacity", labels: L, values: cap }],
      options: { chartColors: [HEX.accent1], barGapWidthPct: 60, showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00" } },
    { type: pres.charts.LINE, data: [
      { name: "Hamming rate 0.571", labels: L, values: L.map(() => 0.571) },
      { name: "rep-3 rate 0.333", labels: L, values: L.map(() => 0.333) },
    ], options: { chartColors: [HEX.accent2, HEX.accent3], lineSize: 2, lineDataSymbol: "none" } },
  ], {
    x: 0.4, y: 1.1, w: 5.4, h: 3.45, showLegend: true, legendPos: "t",
    valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: "0.00", ...chartFrame,
    ...axes("Capacity, bits per channel bit", "Setup and bit rate"), objectName: "capacity chart",
  });
  text(s, "Capacity 1 minus H(p) of a binary symmetric channel at the pooled channel BER. Glare has memory, so 0.45 is a pessimistic bound",
    { x: 0.5, y: 4.6, w: 5.3, h: 0.6, fontSize: 13, color: C.text2, objectName: "capacity note" });
  const cards = [
    ["Sampling, this module", "3.8 samples per bit at 8 bps smeared edges. 14 at 2 bps did better in glare"],
    ["Compression, this module", "240 of 272 bits are overhead for a 2 byte payload"],
    ["Degree programme", "CRC framing as in Ethernet, Markov chains, DSP filtering next"],
    ["Beyond the module", "Reed-Solomon in CDs and QR codes, LiFi, PixNet and COBRA"],
  ];
  cards.forEach(([h, b], i) => {
    const y = 1.1 + i * 1.02;
    card(s, 6.05, y, 3.45, 0.92, `context card ${i + 1}`);
    text(s, h, { x: 6.2, y: y + 0.08, w: 3.2, h: 0.3, fontSize: 14, bold: true, color: C.accent1, objectName: `context head ${i + 1}` });
    text(s, b, { x: 6.2, y: y + 0.38, w: 3.2, h: 0.5, fontSize: 13, objectName: `context body ${i + 1}` });
  });
  s.addNotes("Kanav. This places our results in the module and beyond. The bars are Shannon capacity of a binary symmetric channel at each setup's pooled channel BER. At 8 bps capacity is about 0.77, above Hamming's rate of 0.57, so reliable codes exist even faster than Hamming, and our simple codes sit far from that limit, which is why Hamming still failed. Glare has memory, and a Gilbert channel has more capacity than this figure, so 0.45 is pessimistic. Sampling helps explain our speed results, since each symbol needs several camera samples. On compression, a 2 byte message carries 240 bits of overhead. CRC framing is the Ethernet link layer, and our burst model is a Markov chain. Beyond the module, CDs interleave Reed-Solomon codes the way we interleave Hamming.");
}

async function slideTradeoffChart() {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: "Conclusion" });
  s.addText("Rate against reliability", { placeholder: "title" });
  await addPlot(s, "tradeoff.png", 0.5, 1.1, 9.0, "throughput against code rate",
    "Useful throughput against code rate for every method, Reflection 4 bps and Facing screen 8 bps", 3.75);
  text(s, "Labels give frames delivered out of 3. On the clean channel throughput rises with code rate. At 8 bps it falls, and rep-7 moved the most data",
    { x: 0.5, y: 4.9, w: 8.4, h: 0.4, fontSize: 13, color: C.text2, objectName: "tradeoff note" });
  s.addNotes("Maaz. The headline compromise in one picture. Useful throughput counts only payload bits that arrived intact, per second of airtime, because a fast code that loses frames moves nothing. On the clean reflection at 4 bps the order follows code rate, and no coding is fastest at 0.235 bps. At 8 bps facing the screen it flips. No coding and Hamming delivered nothing, while repetition-7, the slowest code on paper, moved the most data at 0.276 bps because it got all three frames through. So the right redundancy depends on the noise. With 3 trials per point this is a trend, not a precise ranking.");
}

async function build() {
  // 1. Title
  pres.addSection({ title: "Introduction" });
  let s = pres.addSlide({ masterName: "Title Dark", sectionTitle: "Introduction" });
  s.addText("GridLink", { placeholder: "title" });
  s.addText([
    { text: "Error correction over a screen to camera optical link", options: { breakLine: true } },
    { text: "Muhammad Maaz and Kanav Mehta, COMP0228 Coursework 1", options: { fontSize: 14, color: C.accent5 } },
  ], { placeholder: "body" });
  bitRow(s, [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1], 0.6, 0.75, 0.32, 0.08, "title stream", true);
  s.addNotes("Maaz. We are Maaz and Kanav, and this is GridLink, a one way link where laptop 1 flashes bits on its screen and laptop 2 films them. Our takeaway is that the noise was partly bursty, so the order bits are sent in matters as much as how much redundancy we add. We report every recording, including the ones that failed.");

  // 2. The channel
  pres.addSection({ title: "Channel and codes" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Channel and codes" });
  s.addText("Two ways to film the screen", { placeholder: "title" });
  const colX = { laptop: 3.95, ipad: 5.95, camera: 7.95 };
  const node = {
    laptop: [fa.FaLaptop, "Laptop 1", C.text1], ipad: [fa.FaTabletAlt, "iPad screen", C.accent4], camera: [fa.FaCamera, "Camera", C.accent1],
  };
  const paths = [
    ["Facing the screen", "The camera looks straight at laptop 1. White about 106 to 229", ["laptop", "camera"]],
    ["Reflection in the iPad screen", "White about 89 to 165. In a dim room, glare and room light dominate", ["laptop", "ipad", "camera"]],
  ];
  for (let p = 0; p < paths.length; p++) {
    const [head, sub, chain] = paths[p];
    const y = 1.2 + p * 1.18;
    card(s, 0.5, y, 9.0, 1.05, `path card ${p + 1}`);
    text(s, head, { x: 0.75, y: y + 0.15, w: 2.6, h: 0.32, fontSize: 15, bold: true, color: C.accent1, objectName: `path head ${p + 1}` });
    text(s, sub, { x: 0.75, y: y + 0.47, w: 2.55, h: 0.5, fontSize: 12, color: C.text2, objectName: `path note ${p + 1}` });
    const d = 0.55;
    for (let i = 0; i < chain.length; i++) {
      const [Icon, label, fill] = node[chain[i]], cx = colX[chain[i]];
      await iconCircle(s, Icon, cx - d / 2, y + 0.1, d, fill, `path ${p + 1} ${label}`);
      text(s, label, { x: cx - 0.8, y: y + 0.7, w: 1.6, h: 0.28, fontSize: 13, bold: true, align: "center", objectName: `path ${p + 1} ${label} label` });
      if (i < chain.length - 1) {
        const nx = colX[chain[i + 1]];
        s.addShape(pres.shapes.LINE, { x: cx + d / 2 + 0.12, y: y + 0.1 + d / 2, w: nx - cx - d - 0.24, h: 0,
          line: { color: C.accent5, width: 2, endArrowType: "triangle" }, objectName: `path ${p + 1} arrow ${i + 1}` });
      }
    }
  }
  const why = [
    ["Cheap", "Two laptops and an iPad, no extra hardware"],
    ["Real noise", "Camera jitter, auto exposure, glare and drift"],
    ["Interesting noise", "The kind of error matters, not just the amount"],
  ];
  why.forEach(([h, b], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 3.65, 2.9, 1.3, `why card ${i + 1}`);
    text(s, h, { x: x + 0.2, y: 3.78, w: 2.5, h: 0.35, fontSize: 16, bold: true, color: C.accent1, objectName: `why head ${i + 1}` });
    text(s, b, { x: x + 0.2, y: 4.16, w: 2.5, h: 0.7, fontSize: 14, objectName: `why body ${i + 1}` });
  });
  s.addNotes("Maaz. Laptop 1 shows a patch that flashes white for 1 and black for 0, and laptop 2 films it in one of two ways. Facing the screen covers G01 to G14 and G28, and gives a clean reference. The reflection in the glossy iPad screen covers G15 to G27 and G29, and let us bring in glare and reflected room light, which became our main source of bursts. White levels depended on placement as much as path, 89 to 165 reflected and 106 to 229 facing. We checked the path for every analysed group from the saved camera frames.");

  // 3. Bits into light
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Channel and codes" });
  s.addText("Turning bits into light", { placeholder: "title" });
  const steps = [
    ["Calibrate", "Show black then white, set the threshold halfway between the two brightness levels"],
    ["Sample", "Timestamp every camera frame and take the one nearest each symbol centre"],
    ["Decide", "Median brightness of the patch above the threshold is a 1, below is a 0"],
  ];
  steps.forEach(([h, b], i) => {
    const y = 1.3 + i * 1.2;
    s.addShape(pres.shapes.OVAL, { x: 0.5, y, w: 0.55, h: 0.55, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `step ${i + 1} circle` });
    text(s, String(i + 1), { x: 0.5, y, w: 0.55, h: 0.55, fontSize: 18, bold: true, color: C.background1, align: "center", valign: "middle", objectName: `step ${i + 1} number` });
    text(s, h, { x: 1.25, y: y - 0.02, w: 3.4, h: 0.35, fontSize: 17, bold: true, objectName: `step ${i + 1} head` });
    text(s, b, { x: 1.25, y: y + 0.33, w: 3.4, h: 0.75, fontSize: 13, color: C.text2, objectName: `step ${i + 1} body` });
  });
  text(s, "Every message travels in one frame", { x: 5.2, y: 1.3, w: 4.3, h: 0.35, fontSize: 16, bold: true, objectName: "frame heading" });
  const segs = [
    ["Sync", "48 bits", 1.0, C.text1],
    ["Header", "192 bits, sent as repetition-3", 1.6, C.accent5],
    ["Payload and CRC-16", "coded with the chosen code", 1.7, C.accent1],
  ];
  let fx = 5.2;
  segs.forEach(([h, b, w, fill], i) => {
    s.addShape(pres.shapes.RECTANGLE, { x: fx, y: 1.8, w, h: 0.75, fill: { color: fill }, line: { color: C.background1, width: 1.5 }, objectName: `frame seg ${i + 1}` });
    text(s, h, { x: fx + 0.08, y: 1.8, w: w - 0.16, h: 0.75, fontSize: 12, bold: true, color: C.background1, align: "center", valign: "middle", objectName: `frame seg ${i + 1} label` });
    text(s, b, { x: fx, y: 2.62, w, h: 0.6, fontSize: 11, color: C.text2, align: "center", objectName: `frame seg ${i + 1} note` });
    fx += w;
  });
  card(s, 5.2, 3.45, 4.3, 1.45, "frame facts card");
  text(s, [
    { text: "240 bits of fixed overhead per frame", options: { bullet: true, breakLine: true } },
    { text: "Sync still found with a few flipped bits", options: { bullet: true, breakLine: true } },
    { text: "CRC detects damage but cannot repair it", options: { bullet: true } },
  ], { x: 5.4, y: 3.6, w: 3.95, h: 1.2, fontSize: 13, paraSpaceAfter: 4, objectName: "frame facts" });
  s.addNotes("Maaz. How a bit is read. Calibration shows black then white and sets the threshold at the midpoint, because halfway gives both symbols equal margin, which minimises errors when the noise around each level is similar. It is then fixed, so it cannot adapt to the data under test. Each symbol takes the camera frame nearest its centre by timestamp, found by binary search, because the frame rate jitters and counting frames would drift. We use the median brightness of the patch rather than the mean, so a few glinting or saturated pixels cannot flip a bit. The header always uses repetition-3, so losing it does not depend on the payload code.");

  slideSetupNumbers();
  await slideCameraTrace();

  // 4. Three codes
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Channel and codes" });
  s.addText("Three basic codes", { placeholder: "title" });
  const codes = [
    ["1/N", "Repetition 3, 5, 7", "Send each bit N times and take a majority vote", C.accent3],
    ["4/7", "Hamming (7,4)", "Three parity bits fix one error per 7-bit codeword", C.accent1],
    ["16/25", "2-D parity", "Row and column checks on a 4 by 4 grid fix one error and reject double errors", C.accent2],
  ];
  codes.forEach(([rate, name, desc, col], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.3, 2.9, 3.6, `code card ${i + 1}`);
    text(s, rate, { x: x + 0.25, y: 1.5, w: 2.4, h: 0.9, fontSize: 48, bold: true, color: col, fontFace: THEME.headFontFace, objectName: `code rate ${i + 1}` });
    text(s, "code rate", { x: x + 0.25, y: 2.4, w: 2.4, h: 0.3, fontSize: 11, color: C.accent5, objectName: `code rate label ${i + 1}` });
    text(s, name, { x: x + 0.25, y: 2.9, w: 2.4, h: 0.4, fontSize: 18, bold: true, objectName: `code name ${i + 1}` });
    text(s, desc, { x: x + 0.25, y: 3.35, w: 2.4, h: 1.3, fontSize: 14, color: C.text2, objectName: `code desc ${i + 1}` });
  });
  text(s, "2-D parity is the simplest product code, introduced by Peter Elias in 1954", { x: 0.5, y: 5.05, w: 8.3, h: 0.3, fontSize: 11, color: C.accent5, objectName: "parity source" });
  s.addNotes("Maaz. Why these codes. Together they span the rate axis, uncoded at 1, 2-D parity at 16/25, Hamming at 4/7 and repetition down to 1/7, so we can trace rate against reliability. Repetition is the simplest baseline, with strength set by N. Hamming is the classic single error correcting code at a better rate. 2-D parity rejects a double error instead of guessing. Expect a Hamming syndrome question, the three parity checks spell out the position of a single error. 2-D parity is not perfect, three errors in an L shape are miscorrected, so the payload CRC is the last check.");

  // 5. Demo
  s = pres.addSlide({ masterName: "Content Dark", sectionTitle: "Channel and codes" });
  s.addText("Live demo", { placeholder: "title" });
  const demo = [
    [fa.FaSlidersH, "Calibrate", "gridlink calibrate --camera 0"],
    [fa.FaPaperPlane, "Transmit", "gridlink transmit hi --coding parity2d --bit-rate 10"],
    [fa.FaCheck, "Decode", "Laptop 2 prints the message"],
  ];
  for (let i = 0; i < demo.length; i++) {
    const y = 1.35 + i * 1.15;
    await iconCircle(s, demo[i][0], 0.6, y, 0.75, i === 2 ? C.accent3 : C.accent1, `demo ${demo[i][1]}`);
    text(s, demo[i][1], { x: 1.6, y: y - 0.02, w: 3, h: 0.35, fontSize: 18, bold: true, color: C.background1, objectName: `demo head ${i + 1}` });
    text(s, demo[i][2], { x: 1.6, y: y + 0.36, w: 7.5, h: 0.35, fontSize: 14, color: C.background2, fontFace: "Courier New", objectName: `demo cmd ${i + 1}` });
  }
  text(s, "A recorded clip is ready in case the room light defeats the camera", { x: 0.6, y: 4.9, w: 8, h: 0.3, fontSize: 12, color: C.accent5, objectName: "demo backup" });
  s.addNotes("Maaz drives, Kanav narrates. Laptop 1 calibrates and sends a short message with 2-D parity, and laptop 2 decodes it. The demo uses 10 bps only so it finishes quickly, which is faster than any measured run, so the recorded clip is ready. Keep it under two minutes, and if calibration is reported invalid or decoding fails, switch to the clip straight away.");

  // 6. Method
  pres.addSection({ title: "Experiments" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Experiments" });
  s.addText("How we ran experiments", { placeholder: "title" });
  text(s, [
    { text: "A plan fixes payloads, codes, repeats, bit rate and a random seed", options: { bullet: true, breakLine: true } },
    { text: "The same seed rebuilds the identical shuffled schedule on both laptops", options: { bullet: true, breakLine: true } },
    { text: "Every run saves raw brightness and the room conditions", options: { bullet: true, breakLine: true } },
    { text: "Methods are only compared within one matched condition", options: { bullet: true } },
  ], { x: 0.5, y: 1.35, w: 4.1, h: 3.4, fontSize: 15, paraSpaceAfter: 10, objectName: "method bullets" });
  const metrics = [
    ["Channel BER", "Wrong bits as received, before decoding"],
    ["Decoded BER", "Wrong payload bits after decoding, decodable frames only"],
    ["Throughput", "Delivered payload bits per second of airtime"],
    ["Frame success", "Frames fully decoded out of frames planned"],
  ];
  metrics.forEach(([h, b], i) => {
    const x = 4.9 + (i % 2) * 2.35, y = 1.3 + Math.floor(i / 2) * 1.85;
    card(s, x, y, 2.2, 1.65, `metric card ${i + 1}`);
    text(s, h, { x: x + 0.18, y: y + 0.18, w: 1.85, h: 0.4, fontSize: 16, bold: true, color: C.accent1, objectName: `metric head ${i + 1}` });
    text(s, b, { x: x + 0.18, y: y + 0.62, w: 1.85, h: 0.9, fontSize: 13, objectName: `metric body ${i + 1}` });
  });
  s.addNotes("Kanav. How every session worked. Laptop 1 transmits, laptop 2 records, and the group ran each session together. A plan fixes payloads, codes, repeats, bit rate and a random seed. Shuffling the trial order spreads slow drift in light or exposure over all codes instead of loading it onto whichever runs last, and the seed lets laptop 2 rebuild the same schedule with no return channel. We ran 3 trials per method because a trial takes up to 4 minutes at 2 bps, so 21 trials is 40 minutes at 3 bps and an hour at 2 bps, and we wanted each session under stable light. We compare codes only within one matched condition, because room and speed moved channel BER from 0 to 0.3, far more than any code. Both BERs only count bits we observed, so read them next to frame success.");

  slideSessions();
  slideChanges();
  slideFailures();
  slideDidNotWork();

  // 7. Low noise
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Experiments" });
  s.addText("On a clean channel, do not code", { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{
    name: "Throughput",
    labels: ["none", "2-D par.", "Ham-int.", "rep-3", "rep-5", "Hamming", "rep-7"],
    values: [0.235, 0.221, 0.216, 0.190, 0.160, 0.144, 0.138],
  }], {
    x: 0.4, y: 1.2, w: 5.9, h: 3.9, barDir: "col", chartColors: [HEX.accent1],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.28, valAxisLabelFormatCode: "0.00", showLegend: false, ...chartFrame,
    ...axes("Useful throughput (bps)", "Code, Reflection 4 bps, 3 trials each"),
    objectName: "low noise throughput chart",
  });
  card(s, 6.6, 1.3, 2.9, 3.6, "low noise takeaway card");
  text(s, "0", { x: 6.85, y: 1.45, w: 2.4, h: 1.0, fontSize: 64, bold: true, color: C.accent3, fontFace: THEME.headFontFace, objectName: "zero stat" });
  text(s, "decoded errors for every method, uncoded included", { x: 6.85, y: 2.5, w: 2.4, h: 0.7, fontSize: 14, objectName: "zero stat label" });
  text(s, "With nothing to fix, extra bits only cost rate, and throughput falls in line with code rate", { x: 6.85, y: 3.35, w: 2.4, h: 1.4, fontSize: 13, color: C.text2, objectName: "low noise note" });
  s.addNotes("Kanav. The low noise slice is the reflection in the lab with normal light on 27 Oct, 4 bps, all seven codes, 3 trials each. Every code reached zero decoded errors, uncoded included. So throughput simply follows code rate, and extra bits only cost speed. Hamming sits low only because one of its three frames lost its header, a frame failure, not a bit error.");

  // 8. High noise
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Experiments" });
  s.addText("At high noise, Hamming backfires", { placeholder: "title" });
  const hiVals = [0.042, 0.010, 0.031, 0.0, 0.073, 0.0, 0.042];
  s.addChart(pres.charts.BAR, [{
    name: "Decoded BER",
    labels: ["none 0/3", "rep-3 2/3", "rep-5 2/3", "rep-7 3/3", "Hamming 0/3", "2-D par. 1/3", "Ham-int. 1/3"],
    values: hiVals,
  }], {
    x: 0.4, y: 1.2, w: 5.9, h: 3.9, barDir: "col",
    chartColors: [HEX.accent5, HEX.accent1, HEX.accent1, HEX.accent1, HEX.accent2, HEX.accent1, HEX.accent1],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.085, valAxisLabelFormatCode: "0.00", showLegend: false, ...chartFrame,
    ...axes("Decoded BER (errors per bit)", "Code and frames delivered out of 3, Facing screen 8 bps"),
    objectName: "high noise ber chart",
  });
  card(s, 6.6, 1.3, 2.9, 3.6, "hamming takeaway card");
  text(s, "0.073", { x: 6.85, y: 1.45, w: 2.4, h: 0.75, fontSize: 40, bold: true, color: C.accent2, fontFace: THEME.headFontFace, objectName: "hamming stat" });
  text(s, "Hamming decoded BER", { x: 6.85, y: 2.2, w: 2.4, h: 0.3, fontSize: 13, objectName: "hamming stat label" });
  text(s, "0.042", { x: 6.85, y: 2.6, w: 2.4, h: 0.75, fontSize: 40, bold: true, color: C.accent5, fontFace: THEME.headFontFace, objectName: "uncoded stat" });
  text(s, "sending nothing", { x: 6.85, y: 3.35, w: 2.4, h: 0.3, fontSize: 13, objectName: "uncoded stat label" });
  text(s, "Two flips in one codeword make Hamming flip a third, correct bit", { x: 6.85, y: 3.85, w: 2.4, h: 0.9, fontSize: 13, color: C.text2, objectName: "hamming note" });
  s.addNotes("Kanav. The high noise slice is facing the screen at 8 bps on 31 Oct, all seven codes, 3 trials each, channel BER mostly 3 to 5 percent. Repetition-7 sits at 1.6 percent partly because it changes colour less often. Frames out of 3 were none 0, repetition-3 2, repetition-5 2, repetition-7 3, Hamming 0, 2-D parity 1 and interleaved 1. Hamming did worse than sending nothing, because two flips in one codeword make it flip a third, correct bit. 2-D parity reaches zero error only on the one frame it accepted, which is why every label carries the frame count.");

  await slideWilson();

  // 9. Noise regimes
  pres.addSection({ title: "Noise" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Noise" });
  s.addText("Two kinds of noise", { placeholder: "title" });
  await addPlot(s, "noise-regimes.png", 0.4, 1.15, 5.6, "noise regimes figure",
    "Error positions and run length histogram for isolated flips and bursts", 4.0);
  const stats = [
    ["7.3%", "of 8 bps errors in runs of 3 or more, mostly isolated", C.accent1],
    ["87%", "of glare errors in runs of 3 or more", C.accent2],
    ["16 bits", "longest burst across the glare runs", C.accent2],
  ];
  stats.forEach(([v, l, col], i) => {
    const y = 1.25 + i * 1.3;
    text(s, v, { x: 6.4, y, w: 3.1, h: 0.65, fontSize: 36, bold: true, color: col, fontFace: THEME.headFontFace, objectName: `noise stat ${i + 1}` });
    text(s, l, { x: 6.4, y: y + 0.65, w: 3.1, h: 0.5, fontSize: 13, objectName: `noise stat label ${i + 1}` });
  });
  s.addNotes("Kanav. Two error shapes. Blue is facing the screen at 8 bps, where errors are mostly alone, only 7.3 percent in runs of 3 or more. Clay is the reflection with glare at 4 bps, where 87 percent sit in clumps, up to 16 bits. The next slides show why and test it properly.");

  slidePattern();
  await slideModelTest();
  await slideRepetitionTheory();

  // 11. Interleaving
  pres.addSection({ title: "Extension" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Extension" });
  s.addText("Our extension, interleaving", { placeholder: "title" });
  text(s, "Same bits and same 4/7 rate, only the sending order changes. Each grid is 8 Hamming codewords of 7 bits, and red marks one 8-bit burst.",
    { x: 0.5, y: 1.15, w: 9, h: 0.55, fontSize: 14, color: C.text2, objectName: "interleave intro" });
  const cell = 0.24, g0x = [0.9, 5.4], gy = 1.95;
  [["Word first", (r, c) => r * 7 + c < 8], ["Column first", (r, c) => c === 0]].forEach(([label, hit], gi) => {
    text(s, label, { x: g0x[gi], y: gy - 0.05, w: 2.5, h: 0.3, fontSize: 15, bold: true, objectName: `${label} label` });
    for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: g0x[gi] + c * cell, y: gy + 0.35 + r * cell, w: cell - 0.03, h: cell - 0.03,
        fill: { color: hit(r, c) ? C.accent2 : C.background2 }, line: { color: hit(r, c) ? C.accent2 : "D5D9DE", width: 0.5 },
        objectName: `${label} r${r + 1} c${c + 1}`,
      });
    }
  });
  text(s, "7 errors in codeword 1, Hamming cannot fix it", { x: 2.75, y: 2.4, w: 2.3, h: 1.0, fontSize: 13, color: C.accent2, bold: true, objectName: "word first verdict" });
  text(s, "1 error in each codeword, every one is fixed", { x: 7.25, y: 2.4, w: 2.3, h: 1.0, fontSize: 13, color: C.accent3, bold: true, objectName: "column first verdict" });
  text(s, "Physically it matched Hamming, 3 of 3 against 2 of 3 clean and 1 of 3 against 0 of 3 at 8 bps. The intervals overlap, so we claim no physical difference",
    { x: 0.5, y: 4.55, w: 8.4, h: 0.55, fontSize: 13, color: C.text2, objectName: "why interleaving" });
  s.addNotes("Maaz. Laptop 1 sends the Hamming bits column by column across 8 codewords, and laptop 2 puts them back before decoding, so a burst of up to 8 bits hits each codeword once. It adds no bits and keeps the 4/7 rate. Why depth 8. A 16 bit payload plus its 16 bit CRC is exactly 8 Hamming codewords, so one block covers the whole frame with no padding, and 93 percent of our measured glare error runs were 8 bits or shorter. We chose this over retransmission because our link is one way. Physically it matched Hamming, and the intervals overlap, so we claim no difference. That is expected, since 8 bps errors are mostly isolated and our glare runs only used repetition-3.");

  // 12. Burst experiment
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Extension" });
  s.addText("Bursts up to 8 bits, zero errors", { placeholder: "title" });
  const L = Array.from({ length: 16 }, (_, i) => String(i + 1));
  s.addChart(pres.charts.LINE, [
    { name: "Hamming", labels: L, values: [0, .023, .032, .0357, .0414, .0545, .0625, .0716, .0783, .0897, .0988, .1085, .1164, .125, .1334, .1441] },
    { name: "Hamming-interleaved", labels: L, values: [0, 0, 0, 0, 0, 0, 0, 0, .0242, .0473, .0733, .0988, .1211, .138, .175, .1838] },
    { name: "repetition-3", labels: L, values: [0, .0106, .0156, .0211, .0258, .0312, .0368, .042, .0469, .0525, .0578, .0625, .0676, .0727, .0781, .0838] },
  ], {
    x: 0.4, y: 1.15, w: 6.1, h: 4.0, chartColors: [HEX.accent2, HEX.accent1, HEX.accent3], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 5,
    showLegend: true, legendPos: "t",
    valAxisMinVal: 0, valAxisMaxVal: 0.2, valAxisLabelFormatCode: "0.00", ...chartFrame,
    ...axes("Mean decoded BER (errors per bit)", "Burst length (bits), 400 trials per point"),
    objectName: "burst experiment chart",
  });
  const bstats = [["8 bits", "zero errors with interleaving, its depth", C.accent1], ["2 bits", "plain Hamming already fails", C.accent2], ["13+ bits", "interleaving does worse, each word takes two hits", C.accent5]];
  bstats.forEach(([v, l, col], i) => {
    const y = 1.25 + i * 1.3;
    text(s, v, { x: 6.8, y, w: 2.7, h: 0.65, fontSize: 34, bold: true, color: col, fontFace: THEME.headFontFace, objectName: `burst stat ${i + 1}` });
    text(s, l, { x: 6.8, y: y + 0.63, w: 2.7, h: 0.55, fontSize: 13, objectName: `burst stat label ${i + 1}` });
  });
  s.addNotes("Maaz. Why simulate. The physical glare runs used repetition-3 only and gave too few frames to compare Hamming with interleaving, so we ran a controlled test where we set the burst length. A 64 bit payload, every bit inside the burst flipped, random payloads and positions, 400 trials per point. Both Hamming versions have the same length and rate, so only bit order differs. Interleaving gives zero errors up to 8 bits, its depth, while plain Hamming fails from 2. Past 13 bits it does worse, because each codeword takes two hits. This backs up the physical data rather than replacing it.");

  slideRedundancy();

  // 13. Speed
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Extension" });
  s.addText("Slowing down, a confounded hint", { placeholder: "title" });
  [["4 bps, G26", "0 of 3", "frames delivered in glare", C.accent2], ["2 bps, G27", "0.4%", "channel BER, 2 of 3 frames", C.accent3]].forEach(([rate, v, l, col], i) => {
    const x = 0.7 + i * 4.5;
    card(s, x, 1.4, 3.6, 2.6, `speed card ${i + 1}`);
    text(s, rate, { x: x + 0.3, y: 1.6, w: 3.0, h: 0.4, fontSize: 18, bold: true, color: C.text2, objectName: `speed rate ${i + 1}` });
    text(s, v, { x: x + 0.3, y: 2.05, w: 3.0, h: 1.0, fontSize: 54, bold: true, color: col, fontFace: THEME.headFontFace, objectName: `speed value ${i + 1}` });
    text(s, l, { x: x + 0.3, y: 3.15, w: 3.0, h: 0.5, fontSize: 14, objectName: `speed label ${i + 1}` });
  });
  s.addShape(pres.shapes.LINE, { x: 4.45, y: 2.7, w: 0.6, h: 0, line: { color: C.accent5, width: 2.5, endArrowType: "triangle" }, objectName: "speed arrow" });
  text(s, "Repetition-3 in the dimmed lab on 26 Oct, threshold 182 in both. All five 4 bps glare runs gave 2 of 15. More samples per bit or milder glare, one session cannot separate them",
    { x: 0.7, y: 4.3, w: 8.1, h: 0.7, fontSize: 14, color: C.text2, objectName: "speed note" });
  s.addNotes("Maaz. Same dimmed lab on 26 Oct, same code, same threshold of 182. G26 at 4 bps delivered 0 of 3, and across all five 4 bps glare runs it was 2 of 15. Eight minutes later G27 at 2 bps gave 0.4 percent channel BER and 2 of 3 frames. Halving the rate doubles the samples per bit to about 14, but exposure drift grows with time held, so milder glare in that one session may explain it as well. One session cannot separate the two, so we flag it as a confound rather than a result.");

  // 14. Trade-off
  pres.addSection({ title: "Conclusion" });
  await slideTradeoffChart();
  slideWiderContext();
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Conclusion" });
  s.addText("The error and rate trade-off", { placeholder: "title" });
  const trade = [
    [fa.FaSun, C.accent3, "Clean channel", "Do not code, every scheme reaches zero error and coding only lowers rate"],
    [fa.FaRandom, C.accent1, "Independent flips", "Repetition works but costs rate, and Hamming can backfire by miscorrecting"],
    [fa.FaWaveSquare, C.accent2, "Bursts", "Place redundancy where bursts are not, interleave and spread copies"],
    [fa.FaShieldAlt, C.accent4, "Middle ground", "2-D parity keeps a good rate and rejects double errors instead of miscorrecting them"],
  ];
  for (let i = 0; i < trade.length; i++) {
    const x = 0.5 + (i % 2) * 4.6, y = 1.3 + Math.floor(i / 2) * 1.85;
    card(s, x, y, 4.4, 1.65, `trade card ${i + 1}`);
    await iconCircle(s, trade[i][0], x + 0.25, y + 0.25, 0.6, trade[i][1], trade[i][2]);
    text(s, trade[i][2], { x: x + 1.05, y: y + 0.25, w: 3.15, h: 0.35, fontSize: 17, bold: true, objectName: `trade head ${i + 1}` });
    text(s, trade[i][3], { x: x + 1.05, y: y + 0.65, w: 3.15, h: 0.9, fontSize: 13, color: C.text2, objectName: `trade body ${i + 1}` });
  }
  s.addNotes("Kanav. Pulling it together. On a clean channel, do not code. With isolated flips, repetition works but costs rate, and Hamming can backfire. With bursts, where the redundancy sits matters more than how much, so interleave and spread copies. 2-D parity is a middle ground. The right code depends on the shape of the noise, not just how much there is.");

  // 15. Strengths and limits
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Conclusion" });
  s.addText("Strengths and limits", { placeholder: "title" });
  [["What went well", fa.FaCheck, C.accent3, [
    "Scripted, seeded experiment pipeline",
    "Four metrics, always reported with failure counts",
    "Noise analysis chose the extension, not the other way round",
    "29 groups from 14 recordings, failures included",
  ]], ["What limits it", fa.FaExclamation, C.accent2, [
    "Burst sweep and design study are simulated",
    "Room conditions drifted between sessions",
    "Alignment can fail under severe noise",
    "Only 3 trials per method",
    "One plan was too long for its bit rate",
  ]]].forEach(([head, Icon, col, items], i) => {
    const x = 0.5 + i * 4.6;
    card(s, x, 1.3, 4.4, 3.6, `${head} card`);
    text(s, head, { x: x + 0.3, y: 1.5, w: 3.8, h: 0.4, fontSize: 18, bold: true, color: col, objectName: `${head} heading` });
    text(s, items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })),
      { x: x + 0.3, y: 2.05, w: 3.85, h: 2.7, fontSize: 14, paraSpaceAfter: 8, objectName: `${head} list` });
  });
  s.addNotes("Maaz. Strengths first. A scripted and seeded pipeline, failure counts beside every metric, every recording reported including the failures, and noise analysis that chose the extension. Then the limits. Only 3 trials per method, conditions that drifted between days, rooms and payload sizes, a burst sweep and design study that are simulated, and one session lost to a plan too long for its bit rate. The physical test of the new layouts comes next.");

  slidePhysicalTest();

  // 16. Questions
  s = pres.addSlide({ masterName: "Title Dark", sectionTitle: "Conclusion" });
  s.addText("Questions", { placeholder: "title" });
  s.addText([
    { text: "Muhammad Maaz and Kanav Mehta", options: { breakLine: true } },
    { text: "github.com/MuhammadMaazA/gridlink", options: { fontSize: 14, color: C.accent5 } },
  ], { placeholder: "body" });
  bitRow(s, [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1], 0.6, 0.75, 0.32, 0.08, "end stream", true);
  s.addNotes("Both. Likely questions. Why Hamming is worse than nothing at high noise. Why interleaving only helps up to 8 bits. Why 2-D parity. Whether the numbers are significant. Why only 3 trials, and what went wrong outside the lab. Be ready to explain any file in the code.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  await styleLineSeries(OUT);
  console.log("wrote", OUT);
}

build().catch((e) => { console.error(e); process.exit(1); });
