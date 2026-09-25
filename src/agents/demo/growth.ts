import type { GrowthOutput } from "../schemas";
import { DEMO_LABEL, isAiSiSubject } from "./util";

export function demoGrowth(input: { brand: { name: string; niche: string; audience: string | null }; products: Array<{ title: string }> }): GrowthOutput {
  const { brand } = input;
  const aiSi = isAiSiSubject(brand.niche);
  const hero = input.products[0]?.title ?? "the first drop";
  const pillars = aiSi
    ? [
        { name: "Lab notes", description: "Short explainers on AI concepts behind each design (alignment, scaling, recursion)." },
        { name: "Issued equipment", description: "Product-as-uniform content: fit, fabric, details." },
        { name: "The curve", description: "Commentary on AI progress milestones — thoughtful, never hype." },
      ]
    : [
        { name: "Inside the craft", description: `Day-in-the-life and insider references for ${brand.niche}.` },
        { name: "Product details", description: "Close-ups, fit and fabric." },
        { name: "Community", description: "Features of real community members (with permission)." },
      ];
  const platforms: GrowthOutput["platform_strategy"] = [
    { platform: "tiktok", role: "Discovery via short explainers and product reveals", rationale: "Short-form reach for identity content (demo assumption).", mode: "organic" },
    { platform: "instagram", role: "Brand home: grid, reels, stories", rationale: "Visual storefront for apparel.", mode: "both" },
    { platform: "x", role: aiSi ? "Where the AI community talks" : "Community conversation", rationale: aiSi ? "AI researchers and builders are active here (demo assumption)." : "Conversation hub (demo assumption).", mode: "organic" },
    { platform: "email", role: "Owned audience for drops", rationale: "Converts warm interest at low cost.", mode: "organic" },
    { platform: "reddit", role: "Listen and participate — no spam", rationale: "Follow each subreddit's self-promotion rules.", mode: "organic" },
  ];
  const calendar: GrowthOutput["calendar"] = Array.from({ length: 12 }, (_, i) => {
    const day = 1 + i * 2 + (i > 5 ? 6 : 0);
    const p = platforms[i % 3]!.platform;
    return {
      day: Math.min(day, 30),
      platform: p,
      content_type: i % 3 === 0 ? "short_video_script" : i % 3 === 1 ? "post" : "caption",
      title: `${pillars[i % pillars.length]!.name} #${i + 1}`,
      hook: aiSi ? ["Nobody knows what's at the top of the curve.", "PRE-AGI is an era. You're in it.", "Capability: unknown."][i % 3]! : `If you work in ${brand.niche.toLowerCase()}, you'll get this.`,
      body: `${DEMO_LABEL} Draft ${p} content featuring ${hero}.`,
    };
  });
  return {
    audience: brand.audience ?? `People who identify with ${brand.niche}`,
    platform_strategy: platforms,
    content_pillars: pillars,
    launch_campaign: { name: `${brand.name} — Launch`, objective: "Validate demand with organic content and a waitlist before paid spend.", summary: `${DEMO_LABEL} Two-week teaser, launch drop, then a measured paid test pending approval.` },
    calendar,
    hooks: aiSi ? ["Nobody knows what's at the top of the curve.", "Dress for the transition.", "Issued before the singularity."] : ["Made for the crew.", "Only insiders get this one.", "Wear the work."],
    influencer_brief: `${DEMO_LABEL} Seed 10 creators in the ${brand.niche.toLowerCase()} community with product; no scripted claims; disclose partnerships.`,
    outreach_templates: [{ name: "Creator seeding DM", body: `Hi {{name}} — we make ${brand.name}, apparel for ${brand.niche.toLowerCase()}. Could we send you a piece? No obligation to post. (Demo template.)` }],
    ugc_concepts: ["Unboxing with honest first impressions", "Wear-it-to-work day", "Fit check in daily setting"],
    landing_page_experiments: [{ name: "Hero headline test", hypothesis: "An identity-led headline outperforms a product-led headline on CTR to collection." }],
    discount_experiments: [{ name: "Launch code vs free shipping", hypothesis: "Free shipping over threshold beats 10% off on contribution margin.", offer: "10% code vs free shipping over $60" }],
    paid_plan: [{ platform: "instagram", objective: "Traffic test to hero product", audience: brand.audience ?? brand.niche, proposed_budget_usd: 300 }],
    organic_vs_paid: "Start organic to find winning hooks; only after an organic signal, request approval for a small paid test. No spend without explicit approval.",
    experiments: [
      {
        name: "Hero design: A vs B",
        experiment_type: "design",
        hypothesis: "The more understated design converts better with this audience.",
        primary_metric: "conversion_rate",
        minimum_sample: 500,
        variants: [
          { name: "Control", description: input.products[0]?.title ?? "Current hero product" },
          { name: "Challenger", description: input.products[1]?.title ?? "Alternative hero product" },
        ],
      },
      {
        name: "Price point test",
        experiment_type: "price",
        hypothesis: "A premium price does not reduce conversion enough to lower contribution profit.",
        primary_metric: "contribution_profit",
        minimum_sample: 800,
        variants: [
          { name: "Standard price", description: "Current retail price" },
          { name: "Premium price", description: "+$6 with premium positioning copy" },
        ],
      },
    ],
  };
}
