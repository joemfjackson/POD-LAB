/**
 * Rule-based IP / content screening for POD concepts.
 *
 * This is a first-pass filter for OBVIOUS problems only. It is not legal
 * advice, not a trademark search and not a clearance. Flagged items always
 * require a human decision (compliance override gate).
 */

export type ComplianceCategory =
  | "trademarked_phrase"
  | "company_name"
  | "sports_team"
  | "team_logo"
  | "copyrighted_character"
  | "celebrity"
  | "protected_lyrics"
  | "movie_tv_reference"
  | "copied_artwork"
  | "brand_confusion"
  | "political_campaign_mark"
  | "restricted_content"
  | "other";

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export const COMPLIANCE_DISCLAIMER =
  "Automated screening only. This is not legal advice and is not a trademark or copyright clearance. Consult a qualified attorney before relying on any mark.";

interface Rule {
  category: ComplianceCategory;
  risk: RiskLevel;
  terms: readonly string[];
  explanation: string;
  action: string;
}

const RULES: readonly Rule[] = [
  {
    category: "company_name",
    risk: "high",
    terms: [
      "openai", "chatgpt", "gpt-4", "gpt-5", "anthropic", "claude ai", "google", "gemini ai", "deepmind", "microsoft",
      "nvidia", "tesla", "spacex", "iphone", "macbook", "meta ai", "facebook", "instagram", "tiktok",
      "amazon", "alexa", "netflix", "nike", "adidas", "supreme", "coca-cola", "pepsi", "starbucks", "mcdonald's",
      "harley-davidson", "ford", "chevrolet", "chevy", "toyota", "bmw", "porsche", "ferrari", "lamborghini",
      "jeep", "ram trucks", "carhartt", "patagonia", "gucci", "louis vuitton", "chanel",
      "rolex", "disney", "pixar", "lego", "barbie", "hot wheels", "playstation", "xbox", "nintendo",
    ],
    explanation: "Contains a company or product name that is very likely a registered trademark.",
    action: "Remove the company/product name or obtain a licence.",
  },
  {
    category: "sports_team",
    risk: "high",
    terms: [
      "nfl", "nba", "mlb", "nhl", "mls", "ncaa", "fifa", "uefa", "olympic", "olympics", "super bowl", "world series",
      "march madness", "final four", "stanley cup", "dallas cowboys", "new england patriots", "green bay packers",
      "kansas city chiefs", "las vegas raiders", "golden knights", "vegas golden knights", "lakers", "celtics",
      "yankees", "red sox", "dodgers", "cubs", "warriors", "manchester united", "real madrid", "barcelona fc",
    ],
    explanation: "References a professional league, event or team — these marks are aggressively enforced.",
    action: "Remove league/team references; use generic sport or city language instead.",
  },
  {
    category: "copyrighted_character",
    risk: "high",
    terms: [
      "mickey mouse", "minnie mouse", "spider-man", "spiderman", "batman", "superman", "wonder woman", "iron man",
      "avengers", "marvel", "dc comics", "star wars", "darth vader", "yoda", "baby yoda", "grogu", "pokemon",
      "pikachu", "super mario", "zelda", "sonic the hedgehog", "hello kitty", "snoopy", "peanuts", "scooby-doo",
      "harry potter", "hogwarts", "frodo", "gandalf", "terminator", "skynet", "hal 9000", "wall-e", "optimus prime",
      "transformers", "r2-d2", "c-3po", "t-800", "ghost in the shell", "astro boy", "gundam",
    ],
    explanation: "References a copyrighted/trademarked fictional character or franchise.",
    action: "Remove the character or franchise reference; create an original concept instead.",
  },
  {
    category: "movie_tv_reference",
    risk: "medium",
    terms: [
      "the matrix", "blade runner", "ex machina", "westworld", "black mirror", "stranger things", "breaking bad",
      "game of thrones", "the office", "friends tv", "top gun", "fast and furious", "jurassic park", "i, robot",
      "2001: a space odyssey", "her movie", "silicon valley show", "severance",
    ],
    explanation: "References a film or TV title; titles, logos and distinctive quotes are frequently protected.",
    action: "Avoid titles and quotes; evoke the theme with original language.",
  },
  {
    category: "celebrity",
    risk: "high",
    terms: [
      "elon musk", "sam altman", "mark zuckerberg", "jeff bezos", "bill gates", "steve jobs", "taylor swift",
      "beyonce", "kanye", "drake", "lebron james", "michael jordan", "tom brady", "messi", "ronaldo",
      "geoffrey hinton", "yann lecun", "demis hassabis", "dario amodei", "jensen huang",
    ],
    explanation: "Uses a real person's name; right-of-publicity and false-endorsement risk.",
    action: "Remove the person's name/likeness unless you have written permission.",
  },
  {
    category: "political_campaign_mark",
    risk: "high",
    terms: ["make america great again", "maga", "keep america great", "feel the bern", "yes we can", "trump 20", "biden 20", "harris 20"],
    explanation: "Resembles a political campaign slogan or mark.",
    action: "Remove campaign slogans; political merchandise needs separate legal review.",
  },
  {
    category: "trademarked_phrase",
    risk: "medium",
    terms: ["just do it", "i'm lovin' it", "think different", "because you're worth it", "keep calm and carry on", "let's get ready to rumble", "that's hot", "taco tuesday"],
    explanation: "Contains a phrase that is (or has been) registered as a trademark for apparel or services.",
    action: "Check the registry for the phrase in apparel classes before use.",
  },
  {
    category: "protected_lyrics",
    risk: "medium",
    terms: ["lyrics", "song lyric", "sing along"],
    explanation: "The concept appears to rely on song lyrics, which are protected by copyright.",
    action: "Replace lyrics with original text.",
  },
  {
    category: "brand_confusion",
    risk: "medium",
    terms: ["official merch", "officially licensed", "licensed product", "authentic replica", "inspired by", "parody of", "in the style of", "logo remix", "bootleg"],
    explanation: "Wording implies affiliation with, or imitation of, another brand.",
    action: "Remove affiliation or imitation language; make the design fully original.",
  },
  {
    category: "copied_artwork",
    risk: "high",
    terms: ["traced from", "copy of", "screenshot of", "fan art of", "recreate the logo", "their logo"],
    explanation: "The brief suggests reproducing existing artwork or logos.",
    action: "Commission or generate fully original artwork.",
  },
  {
    category: "restricted_content",
    risk: "critical",
    terms: ["nazi", "swastika", "kkk", "white power", "isis", "terrorist", "genocide", "porn", "cocaine", "heroin", "meth"],
    explanation: "Contains restricted or hateful content that platforms and fulfillment providers prohibit.",
    action: "Do not produce. Remove the content entirely.",
  },
];

export interface ScreenInput {
  title: string;
  concept?: string | null;
  texts?: ReadonlyArray<string | null | undefined>;
}

export interface ScreenIssue {
  category: ComplianceCategory;
  detectedIssue: string;
  matchedTerm: string;
  riskLevel: RiskLevel;
  explanation: string;
  evidence: string;
  actionRequired: string;
}

export interface ScreenResult {
  status: "clear" | "flagged";
  riskLevel: RiskLevel;
  issues: ScreenIssue[];
  disclaimer: string;
}

const RISK_ORDER: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

export function maxRisk(levels: readonly RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>((a, b) => (RISK_ORDER[b] > RISK_ORDER[a] ? b : a), "none");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term: string): RegExp {
  // word-ish boundaries that tolerate punctuation inside terms (e.g. "i, robot", "mcdonald's")
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}(?=$|[^a-z0-9])`, "i");
}

const COMPILED = RULES.map((r) => ({ rule: r, patterns: r.terms.map((t) => ({ term: t, re: termPattern(t) })) }));

export function screenConcept(input: ScreenInput): ScreenResult {
  const fields: Array<{ name: string; text: string }> = [
    { name: "title", text: input.title },
    { name: "concept", text: input.concept ?? "" },
    ...(input.texts ?? []).map((t, i) => ({ name: `text ${i + 1}`, text: t ?? "" })),
  ].filter((f) => f.text.trim().length > 0);

  const issues: ScreenIssue[] = [];
  const seen = new Set<string>();
  for (const { rule, patterns } of COMPILED) {
    for (const { term, re } of patterns) {
      for (const f of fields) {
        if (re.test(f.text) && !seen.has(`${rule.category}:${term}`)) {
          seen.add(`${rule.category}:${term}`);
          issues.push({
            category: rule.category,
            detectedIssue: `"${term}" found in ${f.name}`,
            matchedTerm: term,
            riskLevel: rule.risk,
            explanation: rule.explanation,
            evidence: excerpt(f.text, term),
            actionRequired: rule.action,
          });
        }
      }
    }
  }
  const riskLevel = maxRisk(issues.map((i) => i.riskLevel));
  return { status: issues.length > 0 ? "flagged" : "clear", riskLevel, issues, disclaimer: COMPLIANCE_DISCLAIMER };
}

function excerpt(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text.slice(0, 120);
  const start = Math.max(0, i - 40);
  const end = Math.min(text.length, i + term.length + 40);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
