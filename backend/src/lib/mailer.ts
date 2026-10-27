import nodemailer from 'nodemailer';
import { env } from '../env';

/**
 * ============================================================================
 * NODEMAILER SMTP TRANSPORT SERVICE (lib/mailer.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Initializes the Nodemailer SMTP transport using Ethereal Email sandbox settings.
 * - Exports `sendEmail({ to, from, subject, html })` to transmit email messages over SMTP.
 * 
 * WHY ETHEREAL EMAIL? (INTERVIEW CONCEPT):
 * Ethereal is a fake SMTP service provided by Nodemailer. It accepts real SMTP transactions,
 * generates live preview URLs, and catches all emails without delivering them to real people.
 * This guarantees safe testing without spamming real user inboxes or blacklisting IP addresses.
 */

// Configure SMTP transport with host, port, and authentication credentials
export const transporter = nodemailer.createTransport({
  host: env.ETHEREAL_HOST,
  port: env.ETHEREAL_PORT,
  secure: false, // Port 587 uses STARTTLS rather than immediate SSL
  auth: {
    user: env.ETHEREAL_USER,
    pass: env.ETHEREAL_PASS,
  },
});

export interface SendEmailPayload {
  to: string;
  from: string;
  subject: string;
  html: string;
}

/**
 * sendEmail()
 * 
 * TASK / PURPOSE:
 * Sends an email message via SMTP transport.
 * 
 * WHEN REQUEST REACHES HERE:
 * Called by the standalone BullMQ worker (`worker.ts`) when executing an EmailJob.
 * 
 * HOW IT GENERATES RESPONSE:
 * 1. Strips HTML tags using regex to create a fallback plain-text version for legacy mail clients.
 * 2. Transmits the payload to the SMTP server.
 * 3. Returns the SMTP delivery receipt info object (including messageId and response headers).
 * 
 * WHERE CONTROL MOVES NEXT:
 * Returns `info` to `worker.ts`, which then marks the database row as `SENT`.
 * If SMTP fails or times out, the thrown Error triggers BullMQ's automatic retry mechanism.
 */
export async function sendEmail({ to, from, subject, html }: SendEmailPayload) {
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text: html.replace(/<[^>]*>?/gm, ''), // fallback plain text for text-only clients
    html,
  });

  return info;
}

