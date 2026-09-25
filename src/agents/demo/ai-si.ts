/**
 * Curated SAMPLE content for PL-0001 (AI / Superintelligence). These are early
 * hypotheses and example concepts for the demo workflow — not finalised IP,
 * not validated research.
 */

export const AI_SI_BRAND_HYPOTHESES = ["RECURSIVE", "BEYOND GENERAL", "T-ZERO", "SYNTH", "POSTHUMAN", "SUPERINTEL"] as const;

export const AI_SI_COLLECTIONS = [
  { name: "AI", theme: "Foundations", description: "The current era: models, benchmarks and the people building them." },
  { name: "AGI", theme: "Generality", description: "The threshold of general capability — debated, anticipated, contested." },
  { name: "ASI", theme: "Beyond", description: "What comes after human-level: the unknown top of the curve." },
  { name: "Singularity", theme: "Acceleration", description: "Exponential curves, compounding progress, the vertical moment." },
  { name: "Human // Machine", theme: "Interface", description: "Collaboration, co-evolution and the boundary between people and models." },
  { name: "Alignment", theme: "Safety", description: "The problem worth solving: values, control, interpretability." },
  { name: "Research Division", theme: "Lab uniform", description: "Utility pieces styled as issued equipment from a fictional research lab." },
  { name: "Recursive Self Improvement", theme: "Loops", description: "Systems that improve the systems that improve them." },
] as const;

export const AI_SI_DESIGNS = [
  { title: "RECURSIVE SELF IMPROVEMENT", collection: "Recursive Self Improvement", concept: "Wordmark set in a monospaced technical face, each line slightly larger than the last, implying a loop that grows each iteration.", front: "Small left-chest wordmark (3.5in)", back: "Full back typographic stack, 11in wide", sleeve: "Iteration counter 'n+1' on left sleeve", method: "screen_print" as const },
  { title: "AI → AGI → ASI → ?", collection: "ASI", concept: "A minimal progression line with the final term deliberately unresolved; the question mark carries the idea.", front: "Center chest horizontal lockup, 10in", back: null, sleeve: null, method: "dtg" as const },
  { title: "CAPABILITY // UNKNOWN", collection: "ASI", concept: "Lab-label aesthetic: a specification plate where the capability field reads UNKNOWN.", front: "Left chest spec plate", back: "Large spec plate with measurement ticks", sleeve: null, method: "screen_print" as const },
  { title: "HUMAN // MACHINE", collection: "Human // Machine", concept: "Two words separated by a double slash — a comment marker from code — framing the relationship as annotation, not conflict.", front: "Center chest", back: null, sleeve: "Double slash mark on sleeve", method: "embroidery" as const },
  { title: "PRE-AGI", collection: "AGI", concept: "Era marker in the style of a historical period label, dating the wearer to the years before general intelligence.", front: "Left chest era stamp", back: "Timeline with a single marked point", sleeve: null, method: "puff_embroidery" as const },
  { title: "SUPERINTELLIGENCE RESEARCH DIVISION", collection: "Research Division", concept: "Fictional department insignia for an invented lab; utility typography, issue numbers and department codes.", front: "Left chest insignia", back: "Department badge with issue number", sleeve: "Division code 'SRD-01'", method: "embroidery" as const },
  { title: "THE CURVE GOES VERTICAL", collection: "Singularity", concept: "An exponential curve plotted on engineering graph paper, the final segment leaving the frame.", front: null, back: "Full back plotted curve with axis labels", sleeve: null, method: "dtg" as const },
  { title: "ALIGNMENT PROBLEM", collection: "Alignment", concept: "Two vectors almost — but not quite — parallel, with the angle between them annotated. Understated, thoughtful.", front: "Center chest diagram", back: null, sleeve: null, method: "screen_print" as const },
] as const;

export const AI_SI_AVOID = [
  "glowing robot heads",
  "generic AI brains",
  "stock cyberpunk imagery",
  "chat-assistant style logos",
  "blue circuit-board clichés",
];
