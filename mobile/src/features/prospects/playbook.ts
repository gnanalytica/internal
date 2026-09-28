/**
 * A copy of the web's src/components/prospects-dashboard/playbook-content.ts:
 * the Playbook view and the per-stage coaching on a record. Edit the web copy
 * first and paste it here — src/lib/prospects/mobile-parity.test.ts fails
 * while the two differ.
 */

export const ANCHOR_QUESTION = "Walk me through what happens from the moment you receive a valuation assignment until you send the final signed report.";

export type PlaybookSection = { id: string; label: string; title: string; intro: string; quote?: string; groups: { name: string; items: string[] }[] };

export const PLAYBOOK: PlaybookSection[] = [
  {
    id: "anchor",
    label: "The anchor question",
    title: "One question to anchor every conversation",
    intro: "It reveals workflow pain, volume, roles, review steps, current tools and report-format complexity — and shows where Valytica can create measurable value.",
    quote: ANCHOR_QUESTION,
    groups: [
      { name: "Primary objective", items: ["Do not sell software on the first interaction. Find valuers with sufficient case volume and reporting pain, then move them toward a 2–3 real-case pilot."] },
      {
        name: "Principles",
        items: [
          "Target workflow pain, not job title alone: recurring report volume, multiple formats, repeat data entry, site-photo handling, review overhead.",
          "Discovery before demo — a demo is much stronger when it is tied to a pain they have just described.",
          "Pilot before subscription — usage on one or two real cases beats a polite demo reaction.",
          "Volume matters — a few high-volume firms can be worth more than many low-frequency individuals.",
        ],
      },
    ],
  },
  {
    id: "who",
    label: "Who to target",
    title: "Who to target first",
    intro: "A practising Land & Building valuer or small valuation firm with recurring lender work, meaningful monthly case volume and a Word/Excel-heavy reporting process.",
    groups: [
      {
        name: "Priority 1",
        items: [
          "Independent L&B valuer handling 20+ cases a month — user and decision maker are the same person. Ask for a discovery call and a 2-case pilot.",
          "Owner or partner of a 3–20 person valuation firm — higher volume and stronger ROI. Understand the workflow, then pilot with one team.",
          "Valuer empanelled with several banks or NBFCs — more formats, more repetition. Find the highest-friction report types.",
        ],
      },
      { name: "Priority 2–3", items: ["Registered valuer entities — pilot with one branch or team.", "RVO leadership or regional chapters — a demo, webinar or member pilot.", "Senior technical or credit managers at NBFCs/HFCs — discovery only, never a pitch."] },
      { name: "Sweet spot", items: ["5–20 people in the valuation operation", "100–1,000 cases a month", "Several bank/NBFC panels", "Word/Excel-heavy workflow", "Owner or senior valuer still reviews reports"] },
    ],
  },
  {
    id: "call",
    label: "Cold call flow",
    title: "Cold call flow",
    intro: "Earn two minutes, discover, and ask for a demo only when there is pain.",
    groups: [
      { name: "Opening", items: ["Hello sir, is this Mr. [Name]? My name is [you], calling from Gnanalytica.", "We're working on a product called Valytica for property valuers, particularly Land & Building work.", "I came across your details while researching practising registered valuers in [City]. Do you have two minutes?"] },
      { name: "If they say yes", items: ["I'm not calling to sell you software. We've been speaking with valuers about how they handle bank and NBFC cases — site information, photographs, calculations and report formats.", "Roughly how many valuation cases do you handle in a month?"] },
      { name: "If there is pain", items: ["That's exactly the area we're working on. Rather than me explaining everything, would you see a 15-minute demo?", "I'd prefer you don't judge it on a demo alone — try one or two real cases and tell us where it works and where it doesn't."] },
      { name: "If they already use software", items: ["What are you using? What do you like about it? If you could change one thing, what would it be?", "I'm not asking you to switch — the comparison would be really useful for us."] },
      { name: "If not interested", items: ["No problem. One question before I go: do you know a valuer or firm handling a high volume of bank cases who might be interested?"] },
    ],
  },
  {
    id: "questions",
    label: "Question bank",
    title: "Discovery questions",
    intro: "Pick three or four that fit the person in front of you — never read the list.",
    groups: [
      { name: "Workload and control", items: ["How many valuation cases are you usually managing at the same time?", "What usually causes a case to get stuck?", "Where do you lose the most time between case creation and report completion?"] },
      { name: "Admin and repetition", items: ["Which part of the report takes expert time but does not feel like expert work?", "How many times does the same information get copied, checked, or chased?", "Do different banks require significantly different formats?"] },
      { name: "Risk and review", items: ["What part of the report would be hardest to defend later?", "If a bank or reviewer asked a question next month, where would you find the evidence?"] },
      { name: "Surveyors and site visits", items: ["What information is most often missing before you go on site?", "What causes the most back-and-forth after the site visit?"] },
      { name: "AI trust", items: ["Where should AI never decide without human review?", "What would make AI feel like an assistant rather than a replacement?"] },
      { name: "Pilot and next step", items: ["Which one workflow should we test first?", "Which case would be a fair pilot?", "Who else needs to feel comfortable with this before it can work?"] },
    ],
  },
  {
    id: "objections",
    label: "Handling objections",
    title: "Handling objections",
    intro: "The Overview shows which of these the team hears most. Record every one on the record, even small ones.",
    groups: [
      { name: "Happy with current software", items: ["\"What do you like about it? If you could change one thing, what would it be? I'm not asking you to switch — the comparison would help us.\""] },
      { name: "Too busy to try something new", items: ["Offer to sit with their team for the first case, so the pilot costs them no extra time."] },
      { name: "Low case volume", items: ["Ask for a referral to a busier valuer or firm, and move on."] },
      { name: "Doesn't trust AI", items: ["Show that every value is traced to its source clause and nothing reaches the report without the valuer accepting it."] },
      { name: "Worried about data privacy", items: ["All data stays in India (Mumbai), and nothing is used to train any model. Offer the data-protection note before a live case."] },
      { name: "Bank gives us the format", items: ["Ask which banks — Valytica fills the bank's own template, so the format does not change."] },
    ],
  },
  {
    id: "dos",
    label: "Do's and don'ts",
    title: "Do's and don'ts",
    intro: "From the outreach playbook.",
    groups: [
      { name: "Do", items: ["Ask them to walk you through a real valuation case.", "Qualify monthly volume early.", "Ask what software or templates they already use.", "Tie demo features to the pain they described.", "Close for a real-case pilot.", "Ask for a referral when there is no fit."] },
      { name: "Avoid", items: ["Opening with an AI feature list.", "Asking \"Would you like to use Valytica?\"", "Treating every registered valuer as equally valuable.", "Pushing pricing before understanding volume and workflow.", "A generic mass message for A-grade prospects."] },
    ],
  },
];

/** What to fill and how to win each stage, shown on a record's stage path. */
export const STAGE_COACHING: { fields: string[]; tips: string[] }[] = [
  { fields: ["phone", "pitch_angle", "draft_whatsapp"], tips: ["Cold? Send the discovery message. Evidence of volume? The direct pilot message.", "Never open with an AI feature list.", "A-band valuers get a personal message, never a mass one."] },
  { fields: ["last_contacted", "next_step_date"], tips: ["Follow up twice, three days apart — switch channel the second time.", "No reply after two? Try the firm's office or an RVO route."] },
  { fields: ["lb_cases_per_month", "current_software", "objections"], tips: ["Ask the anchor question and let them talk.", "Qualify monthly volume early.", "Write down the tools and templates they use today."] },
  { fields: ["pitch_angle", "next_step", "objections"], tips: ["Show only the part that removes the pain they described.", "Close for one or two live cases, not a subscription."] },
  { fields: ["next_step_date", "notes"], tips: ["Sit with them for the first case.", "Agree up front what a successful pilot looks like; review after case two."] },
  { fields: ["referred_by", "notes"], tips: ["Ask: \"Who else handles a lot of bank cases?\"", "Note why they said yes — it trains the next pitch."] },
  { fields: ["objections", "notes"], tips: ["Record why, in their words.", "Ask for a referral before letting go.", "If the reason was timing, set a date to try again."] },
];
