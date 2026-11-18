/**
 * Reaching a prospect: phone, WhatsApp and email links, and the software
 * options the team asks about. The phone app keeps the same rules in
 * mobile/src/features/prospects/model.ts; mobile-parity.test.ts checks the two agree.
 */

export const SOFTWARE = ["Word + Excel", "Word templates", "Own software", "Bank's portal", "Another tool"];

/** The last ten digits of an Indian number, or null when there aren't ten. */
export function digits10(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

/** An email draft is "Subject: …" then a blank line then the body. */
export function emailParts(draft: string): { subject: string; body: string } {
  const m = draft.match(/^Subject:\s*(.+)\n+([\s\S]*)$/);
  return m ? { subject: m[1].trim(), body: m[2].trim() } : { subject: "", body: draft };
}

export function telHref(phone: string): string | null {
  const d = digits10(phone);
  return d ? `tel:+91${d}` : null;
}

export function whatsappHref(phone: string, text: string): string | null {
  const d = digits10(phone);
  return d ? `https://wa.me/91${d}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
}

export function mailtoHref(email: string, draft: string): string | null {
  if (!email) return null;
  const { subject, body } = emailParts(draft);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
