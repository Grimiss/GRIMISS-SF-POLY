# SF-POLY Alpha 1 implementation report

## Run and play

Serve the repository over HTTP: `python3 -m http.server 8080`, then open `http://localhost:8080`. GitHub Pages serves the same static files. No runtime dependencies, backend, build step, or account is required. AudioWorklet and MIDI require HTTPS or localhost.

Click START AUDIO, a cream/black key, or press A W S E D F T G Y H U J K to start. Space and PANIC silence voices, clear effect tails, and stop transports. Click the SF-POLY branding to select, save, rename, delete, initialize, import, or export patches. User patches live in this browser's local storage; JSON export is the portable backup.

SHIFT-click, double-click, or long-press arpeggiator UP selects UP/DOWN. SHIFT-click chorus I or II selects combined I+II. Pitch returns to centre after pointer release; modulation stays in position. MIDI supports notes, velocity, pitch bend, CC1, CC64, CC120 and CC123. Sustain and expression are global, rather than independent per MIDI channel.

The fixed 1774 × 887 design scales proportionally to a minimum logical display width of 1000 pixels; smaller displays scroll. KEY/SEQ16 only changes the view. SEQ16 and the arpeggiator have separate note owners: sequencer notes do not enter the arpeggiator. They can play together intentionally. Patch recall stops notes and transports.

## Implemented and automatically tested

- 12 independent voices with persistent calibration, idle/released/quiet/old voice selection, ownership and a 4 ms reassignment fade.
- Independent amp and filter ADSRs, 0.001 Hz LFO minimum, slow attacks up to 60 seconds and releases up to 90 seconds.
- Separate Prophet, Oberheim and Juno-inspired synthesis paths; continuous adjacent-model CHARACTER crossfade, fixed level trims, smoothed controls and sustained transition tests.
- Stereo chorus I/II/I+II/OFF, ping-pong delay, and stereo algorithmic reverb; DC blocking, bounded feedback and soft output limiting.
- Audio-thread arpeggiator UP/DOWN/UP-DOWN/RANDOM, HOLD, octave range and rate.
- Independent 16-step chromatic sequencer, root, length, forward/reverse/pendulum, rate, play/pause/stop.
- One automation recorder: timestamped multi-parameter events, interpolation, loop, overdub, clear confirmation and 0.1×–4× speed. Main synthesis/effect faders, CHARACTER, wheels, waveform settings, arp rate and sequencer pitch faders participate. Transport and view changes are not recorded.
- 12 factory patches, validated/versioned user patches, browser storage and JSON round trips.
- Keyboard, pointer/touch glissando, simulated MIDI, audio startup, suspension and resume in Chromium.

## Engine architecture and model status

`src/audio/dsp.js` implements oscillators, envelopes, filters and effects. `engine.js` owns voices, parameter smoothing, note ownership, arpeggiation, sequencing and automation. `worklet.js` runs the engine in the audio rendering thread. `client.js` bridges messages; the UI never generates oscillator samples. Note events are scheduled against engine sample time. Musical clocks and automation update every 32 samples, with non-accumulating clock deadlines; continuous parameters smooth on an eight-sample control grid. Filter coefficients smooth at the audio rate. Automation tracks use binary search rather than scanning every stored event for every parameter.

| Model           | Implemented approximation                                                                                                                                                                                                       | Further work                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Prophet-5 Rev 3 | Dual PolyBLEP VCOs, saw/pulse/integrated triangle, B→A sync and audio-rate Poly-Mod, correlated drift, persistent voice calibration, four TPT one-pole stages with an algebraic resonance feedback solution and nonlinear drive | Measured CEM3320 circuit response, fuller Poly-Mod routing and rigorous sync anti-aliasing |
| Oberheim OB-X   | Dual detuned VCOs, sync/cross-modulation, a separate TPT two-integrator state-variable filter, voice-card tuning/filter differences, subtle envelope variation and stereo spread                                                | Compare discrete circuit nonlinearities, envelope and voice-card tolerances to hardware    |
| Juno-6          | Stable shared-frequency DCO-derived waveforms, PWM, sub, noise, highpass, separate four-stage nonlinear OTA-inspired cascade, independent chorus                                                                                | Measured IR3109/BBD matching, clock-dependent BBD behavior and noise                       |

These are functioning model-inspired algorithms, not circuit-exact emulations. Juno OSC2 changes the relative derived-wave phase rather than detuning an independent VCO; its waveform controls include triangle as an extension. For VCO profiles OSC1 is ±24 semitones and OSC2 is ±12 semitones; SUB selects one or two octaves below. Global tune is ±1 semitone and pitch bend is ±2.

The oscillator/filter paths run at 2× rate and average adjacent output samples. Standard PolyBLEP treats free-running saw/pulse edges. Hard-sync uses a fractional reset and short causal discontinuity smoothing: it is an approximation, not a complete minimum-phase BLEP or BLAMP solution. The 2× averaging stage is not a steep resampling filter. High-note sync/FM aliasing needs further spectral work. Triangle uses integrated 50% duty pulses to avoid PWM-induced DC buildup.

OB uses a genuinely separate filter topology; it is not a four-pole filter with two stages bypassed. The CEM feedback solution linearizes its nonlinear drive and is not a full nonlinear zero-delay circuit solve. The Juno model is an OTA-inspired cascade, not a calibrated IR3109 model. Model trims keep endpoint RMS within 2 dB for the tested reference chord; matching is patch-dependent. Adjacent models process in parallel and the third warms near the central transition. Effects are shared after the model blend and remain independent of CHARACTER.

## Validation

See `docs/validation/` for measured results and the rendered interface. Run:

```sh
npm ci --ignore-scripts
npm test
npx playwright install chromium
npm run test:browser
npm run diagnostics
python3 tests/visual_compare.py
```

Browser testing needs Python 3, Chromium/Playwright and Pillow for image comparison. Set `CHROMIUM_PATH` to override the browser executable. Visual comparison additionally uses the retained intermediate captures in `work/`; the final screenshot and report are committed, and future comparisons can use those as new pass baselines.

The final local run passed 22 automated DSP/music/worklet tests and 27 browser checks. Browser RMS was nonzero; that verifies signal output, not listening quality. MIDI was simulated through the browser input interface; physical MIDI hardware, Windows and Android devices were not tested. A 30-second, 12-voice stress render at 24 kHz remained finite. `npm run diagnostics` creates Prophet/Oberheim/Juno WAVs, a sustained CHARACTER sweep and measured performance JSON in `work/diagnostics/`.

Three retained visual passes compare typography, geometry and final control details at 1774 × 887. All 13 section rectangles match the manually measured map in `LAYOUT.md`; this is not automatic pixel-edge matching. Whole-image mean absolute error improved from about 30.0 to 28.1 on a 0–255 scale. This includes differences in patch values, generated hardware lighting, texture and fonts, and is not a fidelity acceptance threshold. Branding is a font approximation. The reference's irregular black-key pattern is replaced by correct chromatic groups within its keyboard bounds. Visual matching is materially improved but is not pixel-identical or owner-approved.

## Known limitations and listening work

All synthesis and effects are implemented but **not listening-tested against hardware or established emulations**. Hardware accuracy, the subjective quality of reverb tails, chorus character, oscillator interaction and perceived CHARACTER loudness remain unverified. Reverb uses eight damped comb paths with allpass diffusion; it is a stable initial algorithm and may need further diffusion/tuning. CPU measurements are offline rendering costs on this cloud host, not a guarantee against browser underruns or a tablet performance result. Dense 12-voice CHARACTER blends are the heaviest path.

Begin listening with dry single notes and five-note chords for each model, followed by brass attacks, slow strings, PWM, resonance sweeps and hard-sync leads. Compare endpoint loudness before slow CHARACTER sweeps. Then compare chorus modes and sustained reverb tails. Prioritize high-note aliasing, sync/Poly-Mod spectra, filter resonance, stereo phase and low-end level. Test real MIDI repeated notes/sustain and 12-voice chords on Windows Chromium and Android hardware.

## Delivery and files

The original README specification is retained. Application files are `index.html`, `src/app.js`, `src/style.css`, `src/parameters.js`, `src/presets.js`, `src/audio/{client,dsp,engine,worklet}.js` and a licensed local condensed font. Tests live in `tests/`; `docs/LAYOUT.md` records the measured design map. `.github/workflows/pages.yml` tests and stages only the static application before Pages deployment. The reference is preserved in `docs/reference.png` and is never used as an application background.

Initial local milestone: `55bcf30`. Later validation and publication commits are available in Git history. A live URL must only be reported after deployment and an HTTP/browser check succeeds; pushing the workflow alone does not establish deployment.
