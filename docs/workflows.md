# Workflows

## Brand lifecycle

```
idea → researching → candidate ⇒ approved → branding ⇒ creative → product_selection ⇒ store_build ⇒ launch_ready → testing ⇄ iterating ⇒ scaling
                                 (⇒ = requires a human approval gate)
any active stage → paused (resume only to the previous stage) · killed · archived;  killed/archived → idea
```

Agents may only make **non-gated** moves (for example, the Scout moves researching → candidate). Humans can make direct moves from the brand page. The UI offers only the targets that are valid without a gate, and it asks for a reason each time. Gated moves happen only inside `decide_approval_gate()`.

## Approval gates

| Gate | Created by | Min role | Approve → | Reject / revision → |
|---|---|---|---|---|
| Opportunity → Approved | Scout (brand-linked) or human "Approve" | editor | opportunity approved; **Brand Record created** (or advanced to approved) | rejected (reason stored) / back to researching |
| Brand Name → Final | Human ("Make final…") | editor | name final, becomes the brand's official name | rejected / proposed |
| Brand Identity → Final | Brand Architect | editor | identity final; brand fields updated; brand → creative | rejected / draft |
| Design → Production Approved | Human | editor | production_ready (or approved until compliance is clear) | retired / revision |
| Compliance Flag → Override | IP / Compliance | admin | review overridden with notes; design can reach production | design → revision |
| Product Assortment → Approved | Product & Profit or human | editor | listed products approved; brand → store_build | products back to candidate |
| Store → Launch Approved | Store Builder or human | admin | store launch_approved; brand → launch_ready | store back to generated |
| Paid Campaign → Spending Approved | Growth Agent or human | admin | campaign approved with approved budget | rejected / draft |
| Scale Recommendation → Scale Approved | Experiment Analyst or human | admin | brand → scaling; decision recorded | "keep collecting" decision recorded |
| Provider credentials | Credential submission | owner | credential active | rejected |
| Destructive action | Human | admin | archive or delete the brand | none |

Each decision records **who**, **when**, the **decision** and the **reason**. Comments can be added to any gate. Decisions write to the audit log, complete the originating job, and send a "ready for next stage" notification.

## End-to-end: PL-0001 AI / Superintelligence

`npm run demo:walkthrough` (or `runWalkthrough()` in `server/seed/walkthrough.ts`) runs the first brand through the whole system using the configured AI provider. By default that is the demo provider, so every artefact is labelled DEMO.

1. **Opportunity Scout** investigates the niche and updates the linked opportunity with 10 scored dimensions, research dimensions and labelled evidence. It then moves PL-0001 researching → candidate and requests `opportunity_approval`.
2. **Human approval** takes PL-0001 to approved.
3. **Brand Architect** evaluates the hypothesis names (RECURSIVE, BEYOND GENERAL, T-ZERO, SYNTH, POSTHUMAN, SUPERINTEL) alongside new candidates, with domains, handles and preliminary trademark notes. It proposes identity v1 (research-lab palette, technical typography, anti-positioning that excludes robot heads, AI brains, cyberpunk and circuit clichés).
4. **Name candidates**: the operator requests and approves a final name. **Identity**: the identity gate is approved and the brand moves to creative.
5. **Creative Director** produces three visual directions and eight collections (AI, AGI, ASI, Singularity, Human // Machine, Alignment, Research Division, Recursive Self Improvement). It expands the eight sample concepts into production briefs (RECURSIVE SELF IMPROVEMENT, AI → AGI → ASI → ?, CAPABILITY // UNKNOWN, HUMAN // MACHINE, PRE-AGI, SUPERINTELLIGENCE RESEARCH DIVISION, THE CURVE GOES VERTICAL, ALIGNMENT PROBLEM).
6. **Compliance** runs automatically. Clear designs are approved for production by the operator. Flagged ones would wait for an admin override.
7. **Product & Profit** pairs designs with mock-catalog blanks, prices them and computes economics. The **assortment** is approved and the brand moves to store_build.
8. **Store Builder** generates the store and **launch** is approved. The brand moves to launch_ready, and the **storefront preview** is available.
9. **Growth Agent** creates the launch plan, a 30-day calendar and experiments. The paid proposal is **left pending**, because the walkthrough never approves spend.
10. **Experiment plan**: the first experiment starts (brand → testing). Demo metrics and demo orders are imported, the financial model is rebuilt, and the **Experiment Analyst** classifies the experiment. A *scale* result creates a scale gate that stays pending.

## Everyday flows

- **Research missions:** Opportunities → *New research mission*, or ⌘K "Research 15 HVAC-related niches". Candidates appear with scores, strongest signal and biggest risk. Open a report to see evidence grouped as measured facts, observed signals, inferences and assumptions, with sources.
- **Opportunity decisions:** approve (optionally "then send to Brand Architect"), reject with a reason, research deeper (a revisit mission at a chosen depth), or archive.
- **Design Studio:** filter by brand, status or compliance. Edit a brief (this creates a new revision and re-runs compliance), upload artwork or mockups, generate images (requires provider connection), create derivatives, request production approval.
- **Products:** catalog (manual, CSV, demo), economics calculator, per-brand reprice-and-recompute. Repricing an approved product sends it back through assortment approval.
- **Stores:** preview on desktop or mobile, request launch approval, mark live, export (JSON package, Next.js manifest, Shopify CSV, fulfillment mapping), publish Shopify drafts (requires provider connection).
- **Experiments:** create with two or more variants, enter daily metrics or import a CSV, run the Analyst, override with a reason.
- **Portfolio decisions:** kill / iterate / clone / scale / pause from the brand overview. Clone creates a new brand at idea; scale requests admin approval.
- **Imports:** products, orders, experiment metrics and fulfillment catalogs, with preview, column mapping, validation and error rows. Only valid rows are written, and every batch is recorded.
- **Command bar (⌘K / Ctrl+K):** open records by code, create missions, run agents for a brand, navigate to saved views, or search. Commands map to a closed set of actions; no arbitrary execution.
