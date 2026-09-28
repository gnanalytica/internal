/** The dashboard needs only the service account; the sheet ID has a built-in default. */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY);
}
