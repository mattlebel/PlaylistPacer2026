import "server-only";

/**
 * Transactional email through Resend, if RESEND_API_KEY and EMAIL_FROM are set.
 * Without them, sending is skipped and the UI shows the link on screen instead.
 */
export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(msg: { to: string; subject: string; text: string }) {
  if (!emailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
