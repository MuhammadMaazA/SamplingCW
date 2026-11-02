# GridLink Presentation Outline

COMP0228 Coursework 1. Presenters: Muhammad Maaz (M) and Kanav Mehta (K).

Slot is 30 minutes total. Aim for a 22 minute talk, leaving 5 to 10 minutes for questions.
Both presenters must speak. The brief requires the nine content points below, so each slide is
tagged with the point it covers. Figures live in `report/figures/`.

Target running total is shown in brackets after each slide.

---

### 1. Title and team (M), 0.5 min  [0.5]
- GridLink, error correction over a screen to camera optical link.
- Names, who covers what. One line on the headline finding so the audience knows where it ends:
  the noise is partly bursty, so bit ordering matters as much as adding redundancy.

### 2. The channel and why we chose it (M), 2 min  [2.5]  *(brief point 1)*
- Photo or short clip of the setup: laptop 1 shows the flashing patch, a second laptop webcam
  reads it, in most runs reflected off an iPad screen used as a mirror. Glare off the glossy
  iPad surface is a real and deliberate source of the bursty noise.
- Why this channel: cheap, no special hardware, and it shows several real noise sources
  (sampling jitter, auto exposure, ambient light and glare off the mirror, slow drift), so the
  kind of noise is interesting, not just the amount.

### 3. Sending binary over light (M), 2.5 min  [5]  *(brief point 2a)*
- One bit is one screen colour held for a symbol duration. White is 1, black is 0.
- Receiver side: calibrate black and white, set a brightness threshold, timestamp every camera
  frame, pick the sample nearest each symbol centre by binary search.
- Frame layout: sync word, protected header with its own CRC, coded payload with a CRC.
- Be ready to explain the code: where the threshold comes from, why timestamps not frame counts.

### 4. The three basic codes (M), 2 min  [7]  *(brief point 2b)*
- Repetition N = 3, 5, 7, majority vote, rate 1/N.
- Hamming (7,4), one correction per codeword, rate 4/7.
- 2-D parity, our researched extra code from Kurose and Ross, rate 16/25, corrects one error
  and rejects anything larger instead of guessing.
- Show a one line code or diagram for each. Expect to be asked to explain the Hamming syndrome.

### 5. Live demonstration (M drives, K narrates), 2 min  [9]  *(brief point 3)*
- Send a short message such as "hi" and show it decode on B.
- Keep it tight. Have a pre-recorded clip ready as backup in case the room light or camera fails.
- Say one sentence on what the audience is seeing (calibration, then transmit, then decode).

### 6. How we ran the experiments (K), 1.5 min  [10.5]  *(brief point 4)*
- Scripted plans with a fixed seed, so A and B run the identical shuffled trial order without
  copying files. This is the automatic multi run point from Lab 1.
- Four metrics: channel BER, decoded BER, useful throughput, frame success, always read with
  failure counts. We only compare methods within one matched condition.

### 7. Results of the basic codes (K), 3 min  [13.5]  *(brief point 5)*
- Low noise slice (Table 1): every code reaches zero decoded BER, so only throughput differs
  and it ranks by code rate. Message: on a clean channel, do not code.
- High noise slice (`figures/highnoise-bars.png`): Hamming goes above the uncoded baseline
  because many codewords take two flips and it miscorrects. Repetition-7 and 2-D parity reach
  zero error, but parity delivers only 1 frame in 3. Message: more correction is not always
  better.

### 8. What the noise actually looks like (K), 3 min  [16.5]  *(brief point 6)*
- `figures/noise-regimes.png`. Regime 2 is isolated flips, every run length 1. Regime 3 is
  bursts, 91 percent of errors in runs of 3 or more, up to 16 bits, worse late in the frame.
- Name the cause: sampling jitter gives flips, drift and glare give bursts, and whole frames are
  sometimes lost outright.

### 9. Do classical codes fit this noise? (K), 1 min  [17.5]  *(brief point 6)*
- They assume independent errors per codeword. True for flips, false for bursts, where one burst
  fills a codeword and defeats or fools the code. Nothing here handles whole frame loss.

### 10. Our extension and why we chose it (M), 2 min  [19.5]  *(brief point 7)*
- Hamming interleaving: send eight codewords column first, deinterleave before decoding, so a
  burst is spread across many codewords. It adds no extra bits, it only reorders.
- Why this over ARQ, handshaking, DSP filtering or a learned corrector: it targets the burst
  failure we measured, it is explainable, and it isolates the effect of ordering alone.

### 11. Extension results (M), 2 min  [21.5]  *(brief point 8)*
- `figures/extension-burst.png`, the controlled experiment, 400 trials per burst length.
  Interleaving holds zero decoded BER up to a burst of 8, its depth, while plain Hamming and
  repetition fail from a burst of 2.
- Honest limit: beyond about 13 bits interleaving is slightly worse, because each word then
  takes two hits. Also mention the physical finding that simply slowing from 4 to 2 bps rescued
  a run that had collapsed, so speed is a lever too.

### 12. The error against rate trade-off (K), 1.5 min  [23]  *(brief point 9)*
- Clean channel, do not code. High rate flips, repetition helps but is costly and low rate
  Hamming can backfire. Bursts, reorder or slow down rather than add redundancy. 2-D parity is a
  middle ground that rejects instead of miscorrecting.

### 13. Reflections, strengths and limits (M), 1 min  [24]  *(brief point 9)*
- Strengths: scripted seeded pipeline, four metrics with failure counts, noise analysis drove the
  extension choice.
- Limits: only 2 to 3 physical repeats, the burst sweep is simulated, alignment can fail under
  severe noise. Say what we would do next.

### 14. Questions  [remainder]
- Hand to the audience. Both stay at the front.

---

## Backup and logistics
- Pre-recorded demo clip in case the live link fails.
- Slides exported to PDF on a USB stick and emailed to one phone, in case of laptop issues.
- Decide before the slot who clicks and who speaks on the demo slide.

## Likely questions to rehearse
- Why is Hamming worse than sending nothing at high noise? Two errors in a 7 bit word make the
  syndrome point at a third, good bit, so it flips a correct bit.
- Why does interleaving help only up to a burst of 8? That is the interleaver depth, so a burst
  of up to 8 consecutive transmitted bits lands at most one bit per codeword.
- Why 2-D parity and not something else? It was the researched code, rate 16/25, and it rejects
  rather than miscorrects, which we show matters when a wrong accepted message is costly.
- Are the numbers significant? The physical ones are descriptive with few repeats. The burst
  sweep uses 400 trials per point, which is why we trust that curve.
- Can you explain any line of the code? Expect this. Each member should be able to walk through
  the files they did not write as well as their own.
