# SF-POLY Alpha 2 — implementation status (27 November 2026)

## Implemented
- Three independently enabled and levelled synthesis paths: Prophet-5 inspired (existing model 0), Polysix-inspired (adapted model 1, now single VCO and sub), Juno-inspired (existing model 2).
- Shared synthesis controls; new character faders and ON/OFF switches.
- 12 total voice-card slots, divided evenly by active engine count: 12, 6+6 or 4+4+4. Each note sounds on each active engine.
- MONO, UNISON and POLY modes. Unison stacks all twelve cards; mono plays one card per active engine.
- Analog and Analog Detune parameter controls; per-card static calibration and slow pitch variation; additional saturation and filter variance.
- Twelve LEDs reflect actual envelope activity, including release.
- Blue Track 6 styling, including the character mixer and sequencer accents.
- Existing 16-step monophonic sequencer and arpeggiator preserved.
- Four new Alpha 2 engine tests pass.

## Not yet implemented / not validated
- Polysix SSM2044 circuit-accurate filter and ensemble; current filter is a simplified Curtis-derived placeholder.
- Juno-106-specific BBD chorus and filter calibration; current Juno model derives from Alpha 1 Juno-6.
- Full Prophet-5 hardware calibration and audio-reference listening tests.
- Polyphonic chord sequencing, step ties, probability, master-clock integration.
- Randomised cyclic voice selection: allocator currently chooses first idle/released voice per group.
- Mode transitions, release-tail preservation and voice stealing require further refinement.
- Browser/visual regression testing has not been run; UI is a first integration pass.
- Existing Alpha 1 tests that assume one DSP voice per note are now obsolete: two failures remain. Other 20 original tests pass.
- No Drone Machine integration yet.

## Important
The blue panel is a functional development UI, not an approved final layout. This is a working architectural prototype, not a finished three-synth emulation.
