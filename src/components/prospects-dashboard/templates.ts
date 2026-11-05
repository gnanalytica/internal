/**
 * Starter messages for prospects research has not written a draft for, one per
 * pitch angle and channel. They follow the outreach playbook: ask about their
 * work before showing anything, never open with an AI feature list, and close
 * for a short call or a real-case pilot. Placeholders are filled from the record.
 */

import type { ProspectKind } from "@/lib/prospects/schema";

export type TemplateChannel = "whatsapp" | "email" | "call";

export const GENERAL_ANGLE = "Discovery";

type Template = Record<TemplateChannel, string>;

const T: Record<string, Template> = {
  [GENERAL_ANGLE]: {
    whatsapp:
      "Hello {name}, I'm {me} from Gnanalytica. We're building Valytica for Land & Building valuers{cityPart}. I'm not selling anything yet — I'd value 10 minutes to understand how you take a bank case from assignment to signed report. Would a short call this week work?",
    email:
      "Subject: How do you take a bank case from assignment to signed report?\n\nHello {name},\n\nI'm {me} from Gnanalytica. We're building Valytica for Land & Building valuers and are speaking with practising valuers{cityPart} before we build further.\n\nCould you spare 10 minutes to walk me through how a bank case moves from assignment to the signed report? I'm not asking you to buy or try anything.\n\nThank you,\n{me}",
    call: "Introduce yourself and Valytica in one line. Ask the anchor question: walk me through what happens from the moment you receive a valuation assignment until you send the signed report. Qualify monthly case volume and current software. Ask for a 15-minute demo only if they describe pain.",
  },
  "Faster reports": {
    whatsapp:
      "Hello {name}, I'm {me} from Gnanalytica. Valuers{lendersPart} tell us the report write-up takes longer than the valuation itself. We're working on cutting that time for L&B cases. Could I ask you three quick questions about how long a typical case takes you today?",
    email:
      "Subject: How long does a bank L&B report take you?\n\nHello {name},\n\nValuers{lendersPart} tell us the write-up often takes longer than the valuation itself. We're building Valytica to cut that time without changing the bank's format.\n\nWould you be open to a 10-minute call on how long a typical case takes you today, and where the time goes?\n\nThank you,\n{me}, Gnanalytica",
    call: "Ask how long a typical L&B case takes from site visit to signed report, and which part takes longest. If formatting or re-typing comes up, offer a 15-minute demo on one of their real case types.",
  },
  "Documents read for you": {
    whatsapp:
      "Hello {name}, I'm {me} from Gnanalytica. We're building a tool that reads sale deeds, EC and tax receipts and pulls the facts into your report, with every fact linked back to the page it came from. Do you still type these details in by hand? I'd value 10 minutes on how you handle documents today.",
    email:
      "Subject: Reading title documents for L&B reports\n\nHello {name},\n\nHow much of each case goes into reading deeds, EC and tax receipts and typing the details into the report?\n\nWe're building Valytica to read those documents and fill the facts in, each linked to the page it came from, so you check rather than type. Could we take 10 minutes for you to tell me how you handle documents today?\n\nThank you,\n{me}, Gnanalytica",
    call: "Ask which documents they receive per case and who extracts the facts. Ask how often a fact is copied wrongly. Offer to run one of their (anonymised) deeds through Valytica on a call.",
  },
  "Defensible evidence": {
    whatsapp:
      "Hello {name}, I'm {me} from Gnanalytica. If a bank or reviewer questions a report months later, how easy is it to find the proof behind each figure? We're building Valytica so every fact in an L&B report stays linked to its source. Could I ask you about one case where this mattered?",
    email:
      "Subject: The proof behind each figure in a report\n\nHello {name},\n\nWhen a bank or reviewer questions a valuation months later, finding the deed page, the site photo or the guideline value behind a figure can take hours.\n\nValytica keeps every fact in the report linked to its source. I'd value 10 minutes to hear how you keep that evidence today.\n\nThank you,\n{me}, Gnanalytica",
    call: "Ask what part of a report would be hardest to defend later, and where they would find the evidence if a bank asked next month. Show source-linked facts only if they describe this pain.",
  },
  "Site visit & photos": {
    whatsapp:
      "Hello {name}, I'm {me} from Gnanalytica. How do site photos and notes get from the visit into your report today — WhatsApp, a camera, a surveyor? We're building Valytica so they land in the case, labelled, ready for the report. Could I ask you a few questions about your site visits?",
    email:
      "Subject: From site visit to report\n\nHello {name},\n\nWe keep hearing that the back-and-forth after a site visit — missing photos, unlabelled pictures, notes on paper — slows L&B reports down.\n\nValytica lets the person on site capture photos and observations straight into the case. Could we take 10 minutes for you to tell me how site visits work for you today?\n\nThank you,\n{me}, Gnanalytica",
    call: "Ask what information is most often missing before or after a site visit, and who does the visits. Offer a demo of site capture on a phone only if they describe the gap.",
  },
  "Team & case tracking": {
    whatsapp:
      "Hello {name}, I'm {me} from Gnanalytica. With several valuers and surveyors working on bank cases, how do you keep track of where each case is? We're building Valytica to show every case, who has it and what's pending. Could I ask how your team manages this today?",
    email:
      "Subject: Keeping track of every case across your team\n\nHello {name},\n\nWhen several valuers and surveyors work on cases for different banks, knowing which case is stuck and why often depends on phone calls.\n\nValytica shows every case, who has it and what is pending. I'd value 10 minutes to hear how your team keeps track today.\n\nThank you,\n{me}, Gnanalytica",
    call: "Ask how many cases are open at once, who reviews reports, and what usually causes a case to get stuck. Propose a pilot with one team on two real cases.",
  },
  "Portal checks": {
    whatsapp:
      "Hello {name}, I'm {me} from Gnanalytica. How much time goes into checking land records and registration portals for each case? We're building Valytica to keep a screenshot as proof and pull the values into the case. Could I ask you about the portals you use most?",
    email:
      "Subject: Land-record and registration portal checks\n\nHello {name},\n\nChecking land records and registration portals, then copying the values into the report, is repetitive work on every L&B case.\n\nValytica keeps a screenshot of each portal check as proof and fills the values into the case for you to confirm. Which portals take you the most time?\n\nThank you,\n{me}, Gnanalytica",
    call: "Ask which state portals they check per case and how they keep proof of the check. Offer to show the portal capture on a case from their state.",
  },
};

/** Angles that have templates, the general one first. */
export const TEMPLATE_ANGLES = Object.keys(T);

export type TemplateSubject = { kind: ProspectKind; name: string; city: string; lenders: string[] };

/** "Mr. Sachin Goel" stays as written; firms and banks are addressed as a team. */
function salutation(s: TemplateSubject): string {
  if (s.kind === "firm" || s.kind === "bank" || s.kind === "rvo") return "team";
  return s.name.trim() || "sir";
}

/** A template for an angle and channel, filled from the prospect; unknown angles fall back to the general one. */
export function fillTemplate(angle: string, channel: TemplateChannel, s: TemplateSubject, me: string): string {
  const t = (T[angle] ?? T[GENERAL_ANGLE])[channel];
  const lenders = s.lenders.slice(0, 2).join(" and ");
  return t
    .replaceAll("{name}", salutation(s))
    .replaceAll("{me}", me.trim().split(/\s+/)[0] || "the Gnanalytica team")
    .replaceAll("{cityPart}", s.city ? ` in ${s.city}` : "")
    .replaceAll("{lendersPart}", lenders ? ` on the ${lenders} panels` : "");
}
