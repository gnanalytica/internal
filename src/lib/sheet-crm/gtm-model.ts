/**
 * The GTM sheet's schema — one definition, read by both the builder and the
 * column sync, so the live workbook and a fresh build can never disagree.
 *
 * Six tabs, each answering one part of a single business question: get a
 * registered valuer finalising reports on Valytica.
 *
 * Two rules the model rests on, restated in the Guide tab so they outlive the
 * conversation that produced them:
 *
 *   A noun tab never holds an event history. The moment "when did we last email
 *   them" becomes a column it can only hold the MOST RECENT touch. That is a
 *   deliberate trade, not an oversight — an Outreach log nobody fills is worse
 *   than none, because an empty tab reads as "we have contacted nobody", while
 *   a flag on the row being edited cannot go stale. The cost, accepted: no
 *   "touches before reply" and no per-template comparison.
 *
 *   An id is never reused or renumbered. Every link here is an id in a cell,
 *   and a renumber silently repoints it at a different person.
 */

/** Closed vocabularies. A dropdown is the only foreign key a spreadsheet has. */
export const VOCAB = {
  asset_class: ["Land & Building", "Plant & Machinery", "Securities or Financial Assets"],
  stage: ["Not contacted", "Contacted", "Replied", "Demo done", "Trial", "Paying", "Lost", "Do not pursue"],
  role_at_firm: ["Proprietor", "Partner", "Director", "Employee", "Independent"],
  current_tool: ["None", "Word", "Excel", "Rival software", "In-house", "Unknown"],
  yes_no: ["Yes", "No"],
  yes_no_unknown: ["Yes", "No", "Unknown"],
  language: ["English", "Hindi", "Telugu", "Kannada", "Tamil", "Malayalam", "Marathi", "Gujarati", "Bengali", "Other"],
  constitution: ["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "Other"],
  lender_type: ["Bank", "HFC", "NBFC", "ARC", "Co-operative bank", "Government", "Insurance", "Other"],
  ownership: ["PSU", "Private", "Foreign", "Co-operative", "Government"],
  priority: ["Very High", "High", "Medium", "Low"],
  relationship_stage: ["None", "Intro made", "In talks", "Pilot", "Partner", "Declined"],
  partnership_stage: ["None", "Member", "Speaking slot", "Co-marketing", "Endorsed", "Declined"],
  body_type: ["RVO", "Association", "Institute"],
  decision_role: ["Decider", "Influencer", "Gatekeeper", "Unknown"],
  strength: ["Cold", "Warm", "Champion"],
  org_type: ["Lender", "RVO", "Association", "Firm", "Other"],

  /**
   * The MEDIUM, never the intermediary — a message the RVO secretary forwards
   * for us is channel WhatsApp with route Body. Splitting them is what lets
   * "which medium gets replies" and "which route gets replies" be two questions.
   *
   * WhatsApp group is separate from WhatsApp on purpose: in this market a
   * valuer or RVO group reaches a couple of hundred people at once, which makes
   * it the highest-leverage entry on the list, not a variant of a 1:1 message.
   * Post / courier is here because 950 legacy rows carry no email and no phone.
   * Email campaign is separate from Email so a blast cannot be mistaken for a
   * conversation.
   */
  channel: [
    "Email", "Email campaign", "Phone call", "SMS", "WhatsApp", "WhatsApp group",
    "LinkedIn", "Post / courier", "In-person visit", "Meeting", "Event / CPE session", "Other",
  ],

  /** Through WHOM. Blank or Direct means straight to the person. */
  route_type: ["Direct", "Lender", "Body", "Firm", "Valuer referral"],

  state: [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu & Kashmir", "Ladakh",
    "Puducherry", "Chandigarh", "Andaman & Nicobar", "Dadra & Nagar Haveli and Daman & Diu", "Lakshadweep",
  ],
} as const;

export type Vocab = keyof typeof VOCAB;

export type TabSpec = {
  title: string;
  purpose: string;
  rows: number;
  colour: [number, number, number];
  columns: string[];
  /** header -> vocabulary key */
  validate?: Record<string, Vocab>;
  dates?: string[];
};

/** The three columns that stand in for a per-touch log, on every noun tab. */
const TOUCH = ["last_touch_date", "touch_count", "last_touch_channel"];

export const GTM_TABS: TabSpec[] = [
  {
    title: "Valuers",
    purpose: "The market. One row per individual registered valuer.",
    rows: 10000,
    colour: [0.13, 0.42, 0.35],
    columns: [
      "valuer_id", "full_name", "ibbi_reg_no", "asset_class", "registered_since",
      "email", "phone", "whatsapp", "city", "state", "preferred_language",
      "firm_id", "role_at_firm", "empanelled_lenders", "est_reports_per_month", "current_tool", "rvo",
      "route_type", "route_id",
      "stage", "owner", "next_action", "next_action_date", "lost_reason",
      ...TOUCH,
      "signed_up", "product_org_id",
      "do_not_contact", "source", "notes",
    ],
    validate: {
      asset_class: "asset_class", whatsapp: "yes_no_unknown", state: "state",
      preferred_language: "language", role_at_firm: "role_at_firm", current_tool: "current_tool",
      route_type: "route_type", stage: "stage", last_touch_channel: "channel",
      signed_up: "yes_no", do_not_contact: "yes_no",
    },
    dates: ["next_action_date", "last_touch_date"],
  },
  {
    title: "Firms",
    purpose: "A multi-valuer deal, sold once to its proprietor.",
    rows: 2000,
    colour: [0.13, 0.42, 0.35],
    columns: [
      "firm_id", "firm_name", "constitution", "ibbi_entity_reg_no", "city", "state",
      "num_valuers", "asset_classes", "email", "phone", "website",
      "decision_maker_valuer_id", "empanelled_lenders", "est_reports_per_month",
      "stage", "owner", "next_action", "next_action_date",
      ...TOUCH,
      "do_not_contact", "source", "notes",
    ],
    validate: {
      constitution: "constitution", state: "state", stage: "stage",
      last_touch_channel: "channel", do_not_contact: "yes_no",
    },
    dates: ["next_action_date", "last_touch_date"],
  },
  {
    title: "Lenders",
    purpose: "Not customers. They hold the panel lists and can recommend us to a whole panel.",
    rows: 500,
    colour: [0.16, 0.32, 0.55],
    columns: [
      "lender_id", "lender_name", "lender_type", "ownership", "state", "panel_size_est", "priority",
      // How to get on the panel, and when you may apply. Two different facts, and
      // the window is free text on purpose: "Sharp window: 29.11.2025 to
      // 06.12.2025 inclusive" does not survive being squeezed into an enum.
      "empanelment_route", "empanelment_window", "empanelment_page_url",
      "valuation_volume_signal", "relationship_stage", "primary_contact_id", "our_angle",
      "owner", "next_action", "next_action_date",
      ...TOUCH,
      "do_not_contact", "source", "notes",
    ],
    validate: {
      lender_type: "lender_type", ownership: "ownership", state: "state", priority: "priority",
      relationship_stage: "relationship_stage", last_touch_channel: "channel",
      do_not_contact: "yes_no",
    },
    dates: ["next_action_date", "last_touch_date"],
  },
  {
    title: "RVOs & Associations",
    purpose: "Highest leverage per row: a dozen bodies whose membership is most of the market.",
    rows: 200,
    colour: [0.16, 0.32, 0.55],
    columns: [
      "body_id", "body_name", "acronym", "type", "parent_body", "member_count", "asset_classes", "states_covered",
      "website", "email", "phone", "primary_contact_id", "cpe_event_cadence",
      "partnership_stage", "our_angle", "owner", "next_action", "next_action_date",
      ...TOUCH,
      "source", "notes",
    ],
    validate: { type: "body_type", partnership_stage: "partnership_stage", last_touch_channel: "channel" },
    dates: ["next_action_date", "last_touch_date"],
  },
  {
    title: "Contacts",
    purpose: "A named human at a lender or a body who is not a valuer.",
    rows: 2000,
    colour: [0.16, 0.32, 0.55],
    columns: [
      "contact_id", "name", "org_id", "org_type", "title", "decision_role",
      "email", "phone", "linkedin", "city", "relationship_strength", "do_not_contact", "source", "notes",
    ],
    validate: {
      org_type: "org_type", decision_role: "decision_role",
      relationship_strength: "strength", do_not_contact: "yes_no",
    },
  },
  {
    title: "Guide",
    purpose: "The vocabularies and the stage definitions. Reference only.",
    rows: 300,
    colour: [0.42, 0.42, 0.42],
    columns: ["section", "term", "definition"],
  },
];

/** Seeded so the dropdowns and the links have somewhere to be explained. */
export const GUIDE_ROWS: string[][] = [
  ["Rule", "One row per real thing", "A row is one person, one firm, one institution. A firm is not a person; several people are not one row."],
  ["Rule", "Ids are permanent", "An id is never reused and never renumbered. Every link here is an id, and a renumber repoints it at somebody else."],
  ["Rule", "Id prefix names the tab", "V valuer, F firm, L lender, B body, C contact. It is what makes Contacts.org_id readable without a second lookup."],
  ["Rule", "Nouns hold no event history", "last_touch_date holds the MOST RECENT touch only. Accepted trade: no count of touches before a reply, no per-template comparison. A log nobody fills would be worse — an empty tab reads as 'we contacted nobody'."],
  ["Rule", "Blank is a fact", "Blank means nobody has looked. It never means zero, none, or not applicable — write those words if you mean them."],
  ["", "", ""],
  ["Link", "Valuers.firm_id", "-> Firms.firm_id. THE source of truth for who is in a firm. Never infer membership from Firms.decision_maker_valuer_id, which only names which member signs."],
  ["Link", "Valuers.rvo", "-> RVOs & Associations.body_id. Semicolon list; a valuer can hold two memberships."],
  ["Link", "Valuers.empanelled_lenders", "-> Lenders.lender_id. Semicolon list, many-to-many. Searchable but not precisely filterable — the price of a sheet."],
  ["Link", "Valuers.route_type / route_id", "Through WHOM we reach this valuer. The CANDIDATES are already in empanelled_lenders and rvo; this records the decision. Blank or Direct means straight to the person."],
  ["Link", "Contacts.org_id", "-> Lenders.lender_id OR RVOs & Associations.body_id. Needs org_type beside it to resolve."],
  ["Link", "RVOs.parent_body", "-> body_id in this same tab. IOV RVF sits under IOV."],
  ["", "", ""],
  ["Valuers", "est_reports_per_month", "The best qualifier in the workbook: at the per-report price this IS revenue. A guess is fine; the order of magnitude is what matters."],
  ["Valuers", "role_at_firm", "Only a Proprietor, Partner or Director buys. An Employee is a user, not a decision."],
  ["Valuers", "signed_up / product_org_id", "The only columns that say whether any of this worked. Without them the sheet and the product never reconcile."],
  ["Lenders", "panel_size_est", "How many valuers this lender puts us in front of. It is why a lender is worth a row at all."],
  ["Lenders", "ownership", "PSU panel lists are public and large; private ones usually are not. It decides whether this is a research job or a relationship job."],
  ["Lenders", "empanelment_route / empanelment_window", "How to get on the panel, and when you may apply. Two facts, not one. The window stays free text because a real one reads 'Sharp window: 29.11.2025 to 06.12.2025 inclusive' — an enum would throw the only part that matters away."],
  ["Lenders", "priority", "The prioritisation the research already did. panel_size_est is the objective version of the same judgement; where both exist, prefer the number."],
  ["Lenders", "relationship_stage", "Read with a valuer's empanelled_lenders: five panels we have never spoken to are five useless routes; one we have a pilot with is a live one."],
  ["RVOs & Associations", "member_count", "The leverage. One body can carry more valuers than a year of cold outreach."],
  ["RVOs & Associations", "asset_classes", "Which asset class this body's members actually practise. It is the first qualifier on a channel: a body whose members do securities valuation is not our market however large it is."],
  ["RVOs & Associations", "parent_body", "A body_id, or blank. Most of what the source called a parent was really a constitution and a city ('Independent (Section 8 co.), Pune') — that is not a parent and it lives in notes instead."],
  ["RVOs & Associations", "cpe_event_cadence", "The actual ask. Bodies must run continuing-education sessions and are short of speakers; a slot beats five hundred emails."],
  ["", "", ""],
  ["Channel", "It is the medium, not the intermediary", "A message the RVO secretary forwards for us is channel WhatsApp, route Body. There is deliberately no 'indirect' channel — that is what route_type is."],
  ["Channel", "WhatsApp group", "Kept separate from WhatsApp. A valuer or RVO group reaches a couple of hundred people at once, which makes it the highest-leverage channel here, not a variant of a 1:1 message."],
  ["Channel", "Email campaign", "Separate from Email so a blast is never mistaken for a conversation. The per-send history stays in the sending tool."],
  ["Channel", "Post / courier", "A printed letter to the office. It is on the list because a large share of legacy rows carry no email and no phone at all."],
  ["Route", "Valuer referral", "A happy valuer introducing a peer: the cheapest acquisition there is, so it gets counted."],
  ["", "", ""],
  ["Stage", "Not contacted", "On the list, nothing sent."],
  ["Stage", "Contacted", "We reached out. No reply yet."],
  ["Stage", "Replied", "They answered. Any answer that is not a no."],
  ["Stage", "Demo done", "They have seen the product."],
  ["Stage", "Trial", "Using it, not paying."],
  ["Stage", "Paying", "Money has moved."],
  ["Stage", "Lost", "Said no, or went cold after a reply. Fill lost_reason."],
  ["Stage", "Do not pursue", "We decided not to sell to them. Different from Lost, which was their decision."],
];
