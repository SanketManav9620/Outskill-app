import nodemailer from 'nodemailer';
import { env } from '../env';

export const transporter = nodemailer.createTransport({
  host: env.ETHEREAL_HOST,
  port: env.ETHEREAL_PORT,
  secure: false,
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

export async function sendEmail({ to, from, subject, html }: SendEmailPayload) {
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text: html.replace(/<[^>]*>?/gm, ''), // fallback plain text
    html,
  });

  return info;
}
