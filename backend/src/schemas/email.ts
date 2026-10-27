import { z } from 'zod';
import { EmailJobStatus } from '@prisma/client';

/**
 * ============================================================================
 * EMAIL REQUEST VALIDATION SCHEMAS (schemas/email.ts)
 * ============================================================================
 * WHAT THIS FILE DOES:
 * - Uses Zod to define runtime schema validation rules for API request bodies and queries.
 * - Prevents malformed, incomplete, or unsafe input from ever touching database queries.
 * - Automatically transforms string types (e.g. ISO date strings to JS Date objects,
 *   and query string numbers to integers).
 * 
 * WHY ZOD IN PRODUCTION / INTERVIEWS?
 * - Static TypeScript types are erased at runtime during compilation.
 * - Zod provides RUNTIME type validation: if an attacker or buggy client sends
 *   invalid data (like an invalid email or negative delay), Zod intercepts it immediately.
 * - `z.infer<typeof schema>` generates exact TypeScript types without duplicate code.
 */

/**
 * Single Email Creation Schema
 * Validates payload for POST /api/emails
 */
export const createEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipientEmail: z.string().email('Invalid recipient email address'),
  senderId: z.string().min(1, 'Sender ID is required'),
  scheduledAt: z
    .string()
    .datetime({ message: 'scheduledAt must be a valid ISO 8601 date string' })
    .or(z.date())
    .transform((val) => new Date(val)), // Parse into a JavaScript Date instance
});

export type CreateEmailInput = z.infer<typeof createEmailSchema>;

/**
 * Batch Email Scheduling Schema
 * Validates payload for POST /api/emails/schedule-batch
 */
export const scheduleBatchEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  senderId: z.string().min(1, 'Sender ID is required'),
  recipients: z
    .array(z.string().email('Invalid email in recipients'))
    .min(1, 'At least one recipient is required'),
  startTime: z
    .string()
    .datetime({ message: 'startTime must be a valid ISO 8601 date string' })
    .or(z.date())
    .transform((val) => new Date(val)),
  delaySeconds: z.number().min(0, 'delaySeconds must be non-negative').default(0),
  hourlyLimit: z.number().optional(),
});

export type ScheduleBatchEmailInput = z.infer<typeof scheduleBatchEmailSchema>;

/**
 * Email Query Schema
 * Validates URL query string parameters for GET /api/emails?status=...&page=...&limit=...
 */
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
  // Safe pagination: guarantees page >= 1
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  // Safe limit: caps between 1 and 100 to prevent denial of service (DoS) memory exhaustion
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))),
});

export type GetEmailsQueryInput = z.infer<typeof getEmailsQuerySchema>;

