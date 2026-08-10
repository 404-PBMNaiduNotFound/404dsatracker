// src/lib/email.ts
// @ts-ignore
import nodemailer from "nodemailer";

// Load credentials from environment variables (Vercel and local .env)
const GMAIL_USER = process.env.GMAIL_USER?.trim();
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.trim();

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error(
    "Gmail credentials are missing. Ensure GMAIL_USER and GMAIL_APP_PASSWORD are set in the environment."
  );
}

// Create a reusable transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

/**
 * Sends an email via Gmail SMTP.
 * @param to Recipient email address
 * @param subject Email subject line
 * @param text Plain‑text body
 */
export async function sendEmail(to: string, subject: string, text: string) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Gmail credentials not configured");
  }
  try {
    const info = await transporter.sendMail({
      from: GMAIL_USER,
      to,
      subject,
      text,
    });
    console.info("Email sent", { to, messageId: info.messageId });
    return info;
  } catch (err) {
    console.error("Failed to send email", err);
    throw err;
  }
}
