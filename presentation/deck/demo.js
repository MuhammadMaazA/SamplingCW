"use strict";
// Helpers for the optional demonstration slide. Nothing here runs unless the demo clip exists, see DEMO in kit.js.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const sharp = require("sharp");

// the output of a command, or null when it is not installed or fails
function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return r.error || r.status !== 0 ? null : r.stdout;
}

// width, height and length in seconds of the clip, from ffprobe when it is installed, else a 16 by 9 guess of a minute
function probe(file) {
  try {
    const j = JSON.parse(run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file]));
    return { w: j.streams[0].width, h: j.streams[0].height, secs: parseFloat(j.format.duration) || 60 };
  } catch (e) {
    return { w: 1280, h: 720, secs: 60 };
  }
}

// a poster frame as a base64 png. It is the clip's own picture from the first second when ffmpeg is installed,
// else a dark panel with a play triangle
async function poster(file, info, at) {
  const tmp = path.join(os.tmpdir(), `demo-poster-${process.pid}.png`);
  if (run("ffmpeg", ["-y", "-v", "error", "-ss", String(at ?? (info.secs > 2 ? 1 : 0)), "-i", file, "-frames:v", "1", "-vf", "scale=1280:-2", tmp]) !== null && fs.existsSync(tmp)) {
    const data = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    return `data:image/png;base64,${data.toString("base64")}`;
  }
  const w = 1280, h = Math.round((1280 * info.h) / info.w);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#111111"/><polygon points="${w / 2 - 50},${h / 2 - 70} ${w / 2 - 50},${h / 2 + 70} ${w / 2 + 80},${h / 2}" fill="#ffffff"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

// how many times faster the replay runs than the recording, read from make_replay.py (SPEED, recording seconds per video second)
function replaySpeed() {
  const src = fs.readFileSync(path.join(__dirname, "..", "make_replay.py"), "utf8");
  const m = src.match(/^SPEED\s*=\s*([0-9.]+)/m);
  if (!m) throw new Error("could not read SPEED from make_replay.py");
  return Math.round(parseFloat(m[1]));
}

module.exports = { probe, poster, replaySpeed };
