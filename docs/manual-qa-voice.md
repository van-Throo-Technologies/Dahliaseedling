# Manual QA: dictation and voice commands

Status: pending. This is a manual check on real speech-capable devices. It is required before public launch. It is not a Phase 9 blocker, and automated tests do not replace it.

## What is automated, and what is not

- Automated: the command rules (`src/modules/capture/voice.ts`, English, Dutch and French phrases, diacritic folding) are unit tested. The equivalent UI paths are browser tested: New Seedling, Not keeping this one (which opens the rehome start), and the typed note fallback.
- Not automated: whether a real browser's speech engine hears the phrase correctly, on a real microphone, in a real room. Headless browsers have no speech engine, so this is checked by hand.

## Devices and browsers to check

Record one row per combination. Use a real phone or laptop, not a simulator.

| Device | OS version | Browser and version | Languages tested | Result | Tester | Date |
| ------ | ---------- | ------------------- | ---------------- | ------ | ------ | ---- |
|        |            |                     |                  |        |        |      |

Minimum coverage before launch: one iPhone with Safari, one Android phone with Chrome, one desktop with Chrome, and one desktop with Safari or Firefox if dictation is offered there.

## Steps for each device and language

1. Open Capture while signed in and allow the microphone when asked.
2. Say the New Seedling phrase in the language under test. Expect the Capture to switch to a new Seedling and to show the applied notice.
3. Say the Not keeping this one phrase with an existing Seedling chosen. Expect the rehome start link for that Seedling to appear, and nothing to be sent until the grower presses it.
4. Dictate a note. Expect the text to appear in the note field, to be editable, and to be saved only when the grower presses Save.
5. Deny the microphone permission and confirm the typed note still works and no error is shown in place of the note field.
6. Check that the page does not scroll horizontally at phone width, and that all text stays readable.

## Phrases

- English: "new seedling", "not keeping this one"
- Dutch: "nieuwe zaailing", "deze niet verder kweken"
- French: "nouveau semis", "je ne garde pas celui-ci"

The matcher folds accents and punctuation, so "celui-ci" and "celui ci" both match. Each phrase must be said in full, or as the phrase plus one word.

Record any phrase that is misheard, with the exact words the device produced, and attach it to the row.

## Pass criteria

- Each command is recognised on at least one device per language, or the fallback is shown and works.
- No note is saved, and no Seedling is changed, without a visible confirmation by the grower.
- The microphone is never recording after the grower stops the input.

Sign-off: ____________________ Date: ____________
