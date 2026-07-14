const DEFAULT_MAX_WORDS = 450; // ~600 tokens
const DEFAULT_OVERLAP_WORDS = 75; // ~100 tokens

export function chunkText(
  text: string,
  options: { maxWords?: number; overlapWords?: number } = {},
): string[] {
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS;
  const overlapWords = options.overlapWords ?? DEFAULT_OVERLAP_WORDS;

  // Split into sentences on . ! ? followed by whitespace+capital, or paragraph breaks
  const sentences = text
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?:\n\s*\n)+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;

    if (wordCount + sentenceWords > maxWords && current.length > 0) {
      chunks.push(current.join(" "));

      // Carry over overlap from the end of the current chunk
      const overlapSentences: string[] = [];
      let overlapCount = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const w = current[i].split(/\s+/).length;
        if (overlapCount + w > overlapWords) break;
        overlapSentences.unshift(current[i]);
        overlapCount += w;
      }
      current = overlapSentences;
      wordCount = overlapCount;
    }

    current.push(sentence);
    wordCount += sentenceWords;
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks.filter((c) => c.trim().length > 0);
}
