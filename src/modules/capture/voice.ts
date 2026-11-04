/*
 * Voice commands. A command is an explicit intent, not AI inference: a short phrase whose whole meaning is the command. Dictated
 * notes are never commands, so the same words inside a sentence do nothing. Commands are recognised in each supported language, and
 * they never act on their own: the Capture page shows the matching control, and the grower presses it.
 */

export type VoiceCommand = "new_seedling" | "not_keeping";

/** Phrases per command, one set per supported language, without diacritics. Each phrase is matched in full. */
const PHRASES: Readonly<Record<VoiceCommand, readonly string[]>> = {
  new_seedling: ["new seedling", "nieuwe zaailing", "nouveau semis"],
  not_keeping: ["not keeping this one", "deze niet verder kweken", "je ne garde pas celui ci"],
};

/** Lower-case, without diacritics, with punctuation and extra spaces removed. */
export function normaliseTranscript(transcript: string): string {
  return transcript
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Recognises a command when the transcript is the phrase, or starts with it followed by a further word. */
export function matchVoiceCommand(transcript: string): VoiceCommand | null {
  const normalised = normaliseTranscript(transcript);
  if (normalised === "") return null;
  for (const command of Object.keys(PHRASES) as VoiceCommand[]) {
    for (const phrase of PHRASES[command]) {
      if (normalised === phrase || normalised.startsWith(`${phrase} `)) return command;
    }
  }
  return null;
}
