// Builds gridlink-presentation.pptx from the recorded results. Run `npm run data` once, then `node build_deck.js`.
const k = require("./deck/kit");

const OUT = process.env.DECK_OUT || "gridlink-presentation.pptx";
const parts = ["s1-channel", "s2-experiments", "s3-results", "s4-extension", "s5-conclusion", "s6-appendix"];

(async () => {
  for (const name of parts) {
    let mod;
    try { mod = require(`./deck/${name}`); } catch (e) { if (process.env.DECK_PARTIAL && e.code === "MODULE_NOT_FOUND" && String(e.message).includes(name)) continue; throw e; }
    await mod.build();
  }
  await k.finish(OUT);
})().catch((e) => { console.error(e); process.exit(1); });
