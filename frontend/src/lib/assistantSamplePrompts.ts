export type AssistantSamplePrompt = {
  label: string;
  prompt: string;
};

export const ASSISTANT_SAMPLE_PROMPTS: AssistantSamplePrompt[] = [
  {
    label: "Ramesh retires",
    prompt:
      "If Ramesh retires tomorrow, which machines lose their only expert?",
  },
  {
    label: "P-101 failure history",
    prompt:
      "Why did Pump P-101 keep failing in 2019 and what did we do about it?",
  },
  {
    label: "Knowledge risk radar",
    prompt:
      "Show the Knowledge Risk Radar — which assets have single-point-of-failure expertise?",
  },
  {
    label: "Resolve P-101",
    prompt: "What is P-101? Resolve the tag and show its related incidents and parts.",
  },
  {
    label: "Load Unit 3 demo",
    prompt:
      "Load the Bharat Engineering Works Unit 3 demo knowledge graph into this workspace.",
  },
];
