import { z } from 'zod';
import { EmailJobStatus } from '@prisma/client';

export const createEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipientEmail: z.string().email('Invalid recipient email address'),
  senderId: z.string().min(1, 'Sender ID is required'),
  scheduledAt: z
    .string()
    .datetime({ message: 'scheduledAt must be a valid ISO 8601 date string' })
    .or(z.date())
    .transform((val) => new Date(val)),
});

export type CreateEmailInput = z.infer<typeof createEmailSchema>;

export const scheduleBatchEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  senderId: z.string().min(1, 'Sender ID is required'),
  recipients: z.array(z.string().email('Invalid email in recipients')).min(1, 'At least one recipient is required'),
  startTime: z
    .string()
    .datetime({ message: 'startTime must be a valid ISO 8601 date string' })
    .or(z.date())
    .transform((val) => new Date(val)),
  delaySeconds: z.number().min(0).default(0),
  hourlyLimit: z.number().optional(),
});

export type ScheduleBatchEmailInput = z.infer<typeof scheduleBatchEmailSchema>;

export const getEmailsQuerySchema = z.object({
  status: z
    .enum(['scheduled', 'sent', 'failed'])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      switch (val) {
        case 'scheduled':
          return EmailJobStatus.SCHEDULED;
        case 'sent':
          return EmailJobStatus.SENT;
        case 'failed':
          return EmailJobStatus.FAILED;
      }
    }),
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))),
});

export type GetEmailsQueryInput = z.infer<typeof getEmailsQuerySchema>;
