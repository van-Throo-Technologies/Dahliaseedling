/*
 * Voice plumbing. Dictation is plain speech-to-text in the browser. It is not an assistant, and nothing
 * here sends speech or transcripts to an AI service. The only command in Phase 3 is "New seedling".
 */

export type VoiceCommand = "new_seedling";

/** Recognises the "New seedling" command in a short phrase, ignoring case and punctuation. */
export function matchVoiceCommand(transcript: string): VoiceCommand | null {
  const normalised = transcript
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalised === "new seedling" || normalised.startsWith("new seedling "))
    return "new_seedling";
  return null;
}
