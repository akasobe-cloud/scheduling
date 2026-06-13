export function getGooglePrivateKey(): string | undefined {
  const key =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
  return key?.replace(/\\n/g, "\n");
}

export function getGmailSenderEmail(): string | undefined {
  return process.env.GMAIL_SENDER_EMAIL || process.env.GMAIL_USER;
}
