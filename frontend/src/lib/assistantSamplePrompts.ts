export type AssistantSamplePrompt = {
  label: string;
  prompt: string;
};

/** Short curated list for plant workspace empty state. */
export const ENGRAM_SAMPLE_PROMPTS: AssistantSamplePrompt[] = [
  {
    label: "If Ramesh retires…",
    prompt:
      "If Ramesh retires tomorrow, which machines lose their only expert?",
  },
  {
    label: "P-101 failure history",
    prompt:
      "Why did Pump P-101 keep failing in 2019 and what did we do about it?",
  },
  {
    label: "Quiet knowledge gaps",
    prompt:
      "What repair knowledge on P-101 exists only in emails, not in SOPs?",
  },
  {
    label: "Hinglish ask",
    prompt:
      "P-101 mein seal dubara fail ho raha hai — pehle kya kiya tha?",
  },
];

/** @deprecated Alias — same as Engram prompts. */
export const ASSISTANT_SAMPLE_PROMPTS = ENGRAM_SAMPLE_PROMPTS;
