GRIMISS SF-POLY

Virtual Analog Polysynth

Prophet-5 × Oberheim OB-X × Roland Juno-6

Project: GRIMISS Sound Factory
Repository: GRIMISS-SF-POLY
Development target: Alpha 1
Platform: Browser-based, Windows desktop and Android tablet, with wider compatibility planned.

---

1. Project Overview

GRIMISS SF-POLY is a 12-voice virtual analogue polysynth combining the distinctive sonic characteristics of three classic instruments:

- Sequential Circuits Prophet-5 Rev 3 — Rich dual oscillators, powerful modulation, expressive envelopes and four-pole filtering.
- Oberheim OB-X — Expansive dual-VCO sound, discrete two-pole filtering and individual analogue voice character.
- Roland Juno-6 — Stable DCO architecture, sub-oscillator, smooth filtering, classic stereo chorus and immediate hands-on operation.

The objective is to create a genuinely musical virtual analogue synthesizer that captures the character and behaviour of these instruments while offering a unified, minimal interface.

SF-POLY is not intended to be three unrelated synthesizers placed behind a selector.

Instead, it uses three distinct synthesis models connected through a continuous CHARACTER control.

The instrument should excel at vintage strings, brass, pads, basses, leads, warm polyphonic chords and slowly evolving ambient textures.

Sound quality is the highest technical priority. Visual fidelity to the approved reference is the highest interface priority.

---

2. Primary Visual Reference — Mandatory

The repository contains the approved interface reference image:

"file_000000004878820ab269b1f9474348f3.png"

"Approved SF-POLY interface" (file_000000004878820ab269b1f9474348f3.png)

Critical Design Instruction

THIS IMAGE IS THE PRIMARY VISUAL DESIGN SPECIFICATION.

Codex must inspect the actual image and reproduce it as closely as technically possible.

This includes:

- Overall dimensions and proportions.
- Black body and satin-black end cheeks.
- GRIMISS SF-POLY branding.
- Red, white and blue header stripes.
- Two horizontal banks of controls.
- Exact section positions and relative widths.
- Section header colours.
- Fader positions, lengths, caps and markings.
- Buttons, switches and indicator lights.
- Typography and labelling.
- Keyboard appearance and proportions.
- Section spacing, borders and alignment.
- CHARACTER / VIEW section.
- Delay, reverb, chorus and master control placement.

The interface must be built using real HTML, CSS and SVG controls.

Do not simply display the reference image as a background.

Do not independently redesign, simplify, rearrange or omit the controls.

Do not introduce additional decorative panels, gesture windows or unnecessary displays.

Visual Hierarchy

Blue headers:

- LFO
- DCO
- MIXER
- MASTER
- DELAY
- REVERB
- CHORUS

Red headers:

- HPF / VCF
- ENV 1 — FILTER
- ENV 2 — AMP

White headers with black text:

- ARPEGGIATOR
- AUTOMATION

The CHARACTER / VIEW section must match the reference image.

Layout Rules

The synthesizer has two main banks of controls above the keyboard.

The lower bank contains the arpeggiator, automation recorder, CHARACTER / VIEW, delay, reverb and chorus.

The upper bank contains the principal synthesis controls and master section.

No separate LED peak meter is required.

Use predominantly vertical sliders, with rotary controls only where specifically justified.

Maintain the reference layout at its intended desktop dimensions. For smaller screens, use sensible scaling or scrolling rather than arbitrarily rearranging the instrument.

The design must remain usable on touchscreens.

When visual and functional requirements conflict, preserve the reference layout and find the least intrusive functional solution.

---

3. Sound Engine Architecture

The synthesis engine must use three distinct virtual analogue models.

Each model should be based on documented characteristics of the original hardware.

The aim is convincing analogue behaviour rather than generic digital approximations.

Prophet-5 Rev 3 Model

Implement:

- Two independent band-limited VCOs per voice.
- Sawtooth, pulse and triangle waveforms as appropriate.
- Adjustable pulse width.
- Oscillator detuning.
- Oscillator hard sync.
- Oscillator B modulation.
- Prophet-style Poly-Mod.
- CEM3320-inspired four-pole resonant low-pass filter.
- Filter and amplifier envelopes.
- Exponential envelope response.
- Persistent voice calibration differences.
- Subtle oscillator drift and nonlinear behaviour.

Prioritise accurate oscillator, filter and modulation interactions.

Oberheim OB-X Model

Implement:

- Two independent band-limited VCOs.
- Sawtooth and pulse waveforms.
- Oscillator detuning.
- Oscillator sync and cross-modulation.
- Discrete two-pole state-variable filter.
- Resonance and appropriate nonlinear feedback.
- Independent virtual voice-card calibration.
- Voice-specific oscillator tuning.
- Voice-specific filter response.
- Subtle envelope variations.
- Stereo voice spread.

The OB-X filter must be a separate DSP model, not simply a Prophet filter with a different slope.

Roland Juno-6 Model

Implement:

- Stable DCO-style oscillator architecture.
- Sawtooth and pulse waveforms.
- Pulse-width modulation.
- Square-wave sub-oscillator one octave below.
- Noise generator.
- High-pass filter.
- IR3109-inspired four-pole resonant low-pass filter.
- ADSR envelope.
- Juno-style stereo BBD chorus.
- Relatively stable pitch behaviour.

Avoid applying excessive analogue drift to the Juno model.

---

4. DSP Quality Requirements

Use high-quality virtual analogue DSP techniques.

Requirements:

- Band-limited oscillator generation.
- Low aliasing across the playable range.
- Correct oscillator phase behaviour.
- Accurate hard-sync handling.
- Stable pulse-width modulation.
- Smooth parameter interpolation.
- Nonlinear filter modelling where appropriate.
- Zero-delay-feedback techniques where justified.
- Oversampling where necessary.
- Stable resonance behaviour.
- Protection against DC buildup.
- No audible zipper noise.
- No uncontrolled clipping or runaway feedback.

A basic digital sawtooth combined with a generic biquad filter is not an acceptable final approximation of the three vintage models.

Use technical references, circuit documentation and objective testing to guide implementation.

---

5. CHARACTER Control

The CHARACTER fader is one of SF-POLY's defining features.

It is a horizontal fader with three principal positions:

PROPHET ← OBERHEIM → JUNO

- Left: Prophet-5 character.
- Centre: Oberheim OB-X character.
- Right: Roland Juno-6 character.

The control must transition smoothly between adjacent sound models.

It should influence:

- Oscillator architecture and behaviour.
- Filter topology and response.
- Analogue calibration profile.
- Envelope behaviour where appropriate.
- Voice character.
- Harmonic balance.

Use parallel model processing and smooth crossfading where appropriate.

Manage oscillator and filter states to prevent clicks during transitions.

Avoid abrupt changes in perceived loudness.

The CHARACTER fader must be fully automatable.

Chorus, delay and reverb must remain independently controllable.

The three principal positions should retain recognisable sonic identities.

---

6. Polyphony and Voice Management

Target 12 simultaneous voices.

Each voice must maintain independent oscillator, filter, envelope and modulation states.

Implement intelligent voice stealing with preference for:

1. Available idle voices.
2. Released or quiet voices.
3. Older sustained voices when necessary.

Prevent clicks during voice reassignment.

Support:

- Overlapping notes.
- Repeated notes of the same pitch.
- MIDI note-on and note-off.
- Sustain pedal.
- All-notes-off / panic.
- Reliable note ownership.

The instrument must not produce stuck notes.

---

7. Main Synthesis Controls

LFO

- Rate.
- Delay.
- Waveform selection.
- Pitch modulation.
- PWM modulation.
- Filter modulation where supported.

Allow extremely slow rates for ambient sound design, approximately 0.001 Hz where practical.

DCO / VCO

- Oscillator 1.
- Oscillator 2.
- Sub-oscillator.
- Pulse width.
- Waveform selection.
- Appropriate oscillator interaction according to CHARACTER.

Mixer

- Oscillator 1 level.
- Oscillator 2 level.
- Sub-oscillator level.
- Noise level.

HPF / VCF

- High-pass filter.
- Cutoff.
- Resonance.
- Envelope amount.

ENV 1 — FILTER

- Attack.
- Decay.
- Sustain.
- Release.

ENV 2 — AMP

- Attack.
- Decay.
- Sustain.
- Release.

Master

- Tune.
- Stereo width.
- Volume.

All visible controls must have real audio functionality.

---

8. Arpeggiator

Implement the arpeggiator shown in the approved design.

Controls:

- On / Off.
- Up.
- Down.
- Up / Down.
- Random.
- Hold.
- Range.
- Rate.

Requirements:

- Stable note scheduling.
- Multiple octave ranges.
- Proper handling of held notes.
- Correct note addition and removal.
- No stuck notes.
- Reliable HOLD behaviour.
- Continued playback when switching keyboard and SEQ16 views.

The arpeggiator must not accidentally duplicate SEQ16 note events.

Provide deterministic note-source handling.

---

9. Keyboard / SEQ16 Toggle

The lower part of the synthesizer has two alternative views:

KEYBOARD and SEQ16.

The toggle buttons are located in the CHARACTER / VIEW section.

Only one view is displayed at a time.

Switching views must not stop existing playback.

Keyboard View

Include:

- Playable on-screen keyboard.
- Mouse interaction.
- Touch interaction.
- Computer keyboard input where practical.
- Octave up/down.
- Pitch wheel.
- Modulation wheel.
- External MIDI input.

SEQ16 View

Implement a simplified 16-step pitch sequencer.

Features:

- 16 chromatic pitch steps.
- Pitch sliders from -12 to +12 semitones.
- Root-note selection.
- Adjustable sequence length.
- Forward playback.
- Reverse playback.
- Pendulum playback.
- Adjustable rate.
- Play, pause and stop.

Do not add drift sliders.

Keep the sequencer visually consistent with the main instrument.

SEQ16 should remain operational when the keyboard view is selected.

---

10. Automation Recorder

SF-POLY must have one global automation recorder.

Unlike mikroSEQ, there must be no separate gesture-recording windows.

Automation is recorded directly from the main synthesizer controls.

Controls

- REC
- PLAY
- STOP
- LOOP
- OVERDUB
- CLEAR
- SPEED

Behaviour

Press REC and move any controls to record their movements.

Support multiple automated parameters.

Store timestamped parameter events and replay them smoothly.

During playback, the corresponding graphical controls must visibly move.

Automation playback must not depend on the graphical refresh rate.

SPEED Fader

Range: 0.1× to 4×

Default: 1×

The speed fader controls the playback speed of the entire automation recording.

Automation can loop independently of the sequencer and arpeggiator.

Overdub

Additional parameter movements can be recorded without deleting existing automation.

Handle overlapping automation deterministically.

Clear

CLEAR removes the current automation recording, with appropriate protection against accidental deletion.

CHARACTER must support automation.

---

11. Effects

Chorus

Implement a high-quality Juno-inspired stereo chorus.

Modes:

- I
- II
- OFF

Support combined I+II where practical.

Include a MIX control.

Use BBD-inspired modulation, stereo phase relationships and appropriate filtering.

Chorus must remain independent of CHARACTER.

Delay

Controls:

- TIME
- FEEDBACK
- MIX

Implement a stable stereo delay with smooth parameter changes and musical feedback behaviour.

Reverb

Controls:

- SIZE
- DAMPING
- MIX

Implement a high-quality stereo algorithmic reverb suitable for sustained chords, pads and ambient music.

Avoid excessive metallic ringing and unstable feedback.

Do not add separate effects editor windows.

---

12. Preset System

Provide a simple, reliable preset system.

Include:

- Factory presets.
- User presets.
- Patch selection.
- Save.
- Rename.
- Delete user patch.
- Initialize patch.

Factory presets should include examples of:

- Prophet brass.
- Prophet strings.
- Prophet polyphonic lead.
- Oberheim brass.
- Oberheim wide pad.
- Oberheim strings.
- Juno strings.
- Juno bass.
- Juno chorus pad.
- Hybrid Prophet/Oberheim pad.
- Hybrid Oberheim/Juno pad.
- Slowly evolving ambient texture.

Save and restore:

- All synthesis parameters.
- CHARACTER position.
- Effects.
- Arpeggiator settings.
- SEQ16 settings.
- Automation recordings.
- Automation speed.

Use a versioned patch format.

Browser-based storage is acceptable, with JSON import/export where practical.

Presets must restore consistently.

---

13. Technical Platform

Use:

- HTML5.
- CSS.
- JavaScript.
- Web Audio API.
- AudioWorklet.
- WebAssembly only where beneficial.

The audio engine must be independent of the graphical interface.

Audio timing must be authoritative.

Use appropriate parameter smoothing and sample-accurate or suitably scheduled note events.

Avoid relying on browser animation frames for audio timing.

The application must be compatible with GitHub Pages.

No mandatory backend.

Support current Chromium-based desktop and Android browsers where practical.

Handle browser audio initialization and suspension correctly.

---

14. Testing and Sound Validation

The initial development will take place without immediate listening comparisons from the project owner.

Codex must therefore perform as much automated testing as practical.

DSP Tests

- Oscillator pitch accuracy.
- Oscillator harmonic spectra.
- Aliasing measurements.
- Filter frequency response.
- Filter resonance stability.
- Envelope timing.
- Oscillator synchronization.
- Modulation stability.
- Parameter smoothing.
- CHARACTER transition behaviour.

Functional Tests

- 12-voice polyphony.
- Intelligent voice stealing.
- MIDI input.
- Sustain pedal.
- Keyboard interaction.
- SEQ16 operation.
- Arpeggiator timing.
- Automation recording and playback.
- Automation speed adjustment.
- Preset save and restore.
- Effects stability.
- View switching.

Visual Tests

Compare actual screenshots with the approved reference image.

Check layout, dimensions, section placement, typography, colours and control positions.

Use matching viewport dimensions where practical.

Sound Quality

Create diagnostic WAV renders where useful.

Objective tests must not be presented as proof that the models sound identical to the original instruments.

Listening comparisons with real hardware and established emulations will take place during later development.

---

15. Development Priorities

Stage 1 — Core Sound Engine

Build the polyphonic voice engine, oscillators, filters, envelopes and MIDI note handling.

Stage 2 — Vintage Models

Implement the Prophet, OB-X and Juno sound models.

Stage 3 — CHARACTER

Implement the continuous model blending system.

Stage 4 — Musical Features

Implement the chorus, delay, reverb, arpeggiator, SEQ16, keyboard and automation recorder.

Stage 5 — Interface

Reproduce the approved visual design and connect every control.

Stage 6 — Integration and Testing

Implement presets, complete functional testing, optimise performance and prepare GitHub Pages deployment.

Combine related development stages where practical.

Maintain modular code and meaningful test coverage.

---

16. Codex Development Instructions

This README is the authoritative project specification.

Codex should:

1. Inspect the repository and visual reference before implementation.
2. Preserve the approved design.
3. Prioritise high-quality audio DSP.
4. Implement genuinely functional controls.
5. Keep the engine modular.
6. Write and run automated tests.
7. Document implementation decisions.
8. Identify incomplete or approximate emulation behaviour.
9. Avoid unnecessary dependencies.
10. Maintain a development log and report actual test results.

Do not silently substitute generic synthesis algorithms where a specific model has been requested.

Do not claim a feature is complete unless it has been implemented and appropriately tested.

Do not claim audio fidelity has been established without comparative evidence.

Do not make unrelated changes to the approved interface.

---

17. Project Identity

SF-POLY is a separate instrument from GRIMISS mikroSEQ.

mikroSEQ focuses on experimental synthesis, sequencing and detailed gesture-based modulation.

SF-POLY focuses on vintage polyphonic sound, expressive chords, classic analogue character and immediate hands-on control.

Both belong to the wider GRIMISS Sound Factory collection.

The guiding principle is:

The warmth of the Prophet, the width of the Oberheim and the simplicity of the Juno — combined in one instrument.

---

18. Project Status

Current target: Alpha 1
Development status: Initial implementation planned
Reference design: Approved
Primary objective: Fully playable, high-quality virtual analogue polysynth

The first release should be a working instrument, not a static interface prototype.

Future development will concentrate on sound refinement, performance optimisation and comparisons against original analogue hardware.

---

GRIMISS SOUND FACTORY
Independent instruments for creative sound exploration.
