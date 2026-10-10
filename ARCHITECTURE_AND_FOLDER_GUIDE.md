# Complete System Architecture & Folder Guide (`ARCHITECTURE_AND_FOLDER_GUIDE.md`)

This document provides an exhaustive breakdown of the entire codebase architecture, detailing the purpose of every folder, how components communicate with each other, and where each specific feature/functionality resides.

---

## 1. High-Level Architecture Overview

This project is a high-throughput, rate-limited, distributed Email Scheduling & Automation Platform built as a monorepo. It supports multi-sender batch scheduling, background queue execution, rate-limiting per sender, fallback SMTP delivery, Elasticsearch logging, and Slack notifications upon job failures.

### System Interaction Diagram

```
 +-----------------------------------------------------------------------------------+
 |                                   FRONTEND UI                                     |
 |  Next.js 14 App Router (Port 3000) | NextAuth OAuth | React Dashboard | Compose |
 +-----------------------------------------------------------------------------------+
                                         |
                                         | HTTP REST API Requests
                                         v
 +-----------------------------------------------------------------------------------+
 |                                 BACKEND API SERVER                                |
 |  Node.js + Express (Port 5000) | Zod Validation | Auth Middleware | Bull Board     |
 +-----------------------------------------------------------------------------------+
       |                                   |                                   |
       | Prisma Queries                    | Enqueue Jobs                      | Admin / Status
       v                                   v                                   v
+--------------+                   +----------------+                  +---------------+
|  PostgreSQL  |                   |  Redis 7 (6379) |                  |  Bull Board   |
| (Database)   |                   |  BullMQ Queues |                  |  Dashboard    |
+--------------+                   +----------------+                  +---------------+
                                           |
                                           | Dequeue & Execute
                                           v
 +-----------------------------------------------------------------------------------+
 |                              BACKGROUND QUEUE WORKER                              |
 |  BullMQ Worker Process (Rate Limiter, Concurrency Control, Error Fallback)        |
 +-----------------------------------------------------------------------------------+
       |                                   |                                   |
       | Send Email                        | Index Audit Log                   | Send Alert
       v                                   v                                   v
+--------------+                   +----------------+                  +---------------+
| Ethereal Mail|                   | Elasticsearch  |                  | Slack Webhook |
| (SMTP Server)|                   |  (Search API)  |                  | (Alert Channel|
+--------------+                   +----------------+                  +---------------+
```

---

## 2. Comprehensive Folder Structure & Responsibilities

Below is the complete breakdown of every folder and file in the project.

```
outskill/ (Monorepo Root)
├── backend/                        # Node.js + Express API & BullMQ Background Worker
│   ├── prisma/                     # Database Schema & ORM Configuration
│   │   └── schema.prisma           # Prisma Data Schema (User, Sender, EmailJob, SlackIntegration)
│   ├── src/                        # Main TypeScript Source Code
│   │   ├── env.ts                  # Zod Environment Variable Validation & Schema Defaults
│   │   ├── index.ts                # Express REST API Entry Point & Bull Board Dashboard Setup
│   │   ├── worker.ts               # BullMQ Worker Process (Email sending, rate limiting, ES index)
│   │   ├── lib/                    # Shared Service Connectors & Utilities
│   │   │   ├── elasticsearch.ts    # Elasticsearch Client Setup & Log Indexing Engine
│   │   │   ├── mailer.ts           # Nodemailer SMTP Transport Connection
│   │   │   ├── prisma.ts           # Prisma Database Client Singleton
│   │   │   ├── queue.ts            # BullMQ Email Queue Initialization
│   │   │   └── slack.ts            # Slack Webhook Notification Dispatcher
│   │   ├── middleware/             # Express Middlewares
│   │   │   ├── auth.ts             # User Authentication & Bearer/Header Validation
│   │   │   ├── basicAuth.ts        # HTTP Basic Auth for Bull Board Admin Interface
│   │   │   └── errorHandler.ts     # Global Error Handling & Zod Validation Middleware
│   │   ├── routes/                 # Express API Endpoint Handlers
│   │   │   ├── email.ts            # Email CRUD, Scheduling, Batch Processing, Search & Metrics
│   │   │   └── slack.ts            # Slack OAuth Integration & Webhook Configuration
│   │   └── schemas/                # Zod Endpoint Request Body Validation Schemas
│   │       └── email.ts            # Validation schemas for scheduling, batching, and filters
│   └── scripts/                    # Test & Automation Scripts
│       ├── createEtherealAccount.ts# Generates test SMTP credentials from Ethereal Mail
│       ├── loadTest.ts             # High-concurrency load testing suite
│       ├── testBatchSchedule.ts    # Verifies multi-sender batch scheduling logic
│       ├── testElasticsearch.ts    # Tests search queries against Elasticsearch
│       ├── testErrorHandler.ts     # Validates global error handling middleware
│       ├── testRateLimit.ts        # Tests sender rate-limiting caps per hour
│       └── testSlackNotification.ts# Validates Slack alert dispatching
│
├── frontend/                       # Next.js 14 Frontend Application
│   ├── src/
│   │   ├── app/                    # Next.js App Router Pages & API Routes
│   │   │   ├── layout.tsx          # Root Layout & Global Metadata
│   │   │   ├── page.tsx            # Landing Page / Marketing View
│   │   │   ├── globals.css         # Global Styles & Tailwind Directives
│   │   │   ├── login/              # Login Page with NextAuth & Mock Auth
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/          # Main Email Management Dashboard Page
│   │   │   │   └── page.tsx
│   │   │   └── api/auth/[...nextauth]/
│   │   │       └── route.ts        # NextAuth Authentication Route Handlers
│   │   ├── components/             # Reusable UI Components
│   │   │   ├── DashboardLayout.tsx # Sidebar, Navigation Header & User Profile UI
│   │   │   ├── ComposeModal.tsx    # Email Scheduling Modal with Multi-Sender & CSV Import
│   │   │   ├── DataTable.tsx       # Reusable Data Table Component
│   │   │   ├── ScheduledEmailsTable.tsx # Active/Scheduled Email Queue Table
│   │   │   ├── SentEmailsTable.tsx # Sent Email History Table with Search
│   │   │   ├── FailedEmailsTable.tsx# Failed Email Job Logs with Error Details
│   │   │   └── Providers.tsx       # React Context Providers (NextAuth SessionProvider)
│   │   ├── lib/
│   │   │   └── auth.ts             # NextAuth Options & Google Provider Setup
│   │   └── middleware.ts           # Next.js Edge Middleware protecting `/dashboard`
│
├── docker-compose.yml              # Local Container Setup (Postgres, Redis, Elasticsearch)
├── package.json                    # Monorepo Workspace Configuration & Scripts
├── execution.md                    # Infrastructure & Local Running Instructions
├── flow.md                         # Detailed Architectural Sequence Diagrams & Specs
└── player.html                     # Local HTML Video Player for Project Walkthrough
```

---

## 3. Component Communication & Data Flows

### A. Scheduling an Email Job Flow
1. **User Action**: User opens the **Compose Modal** in `frontend/src/components/ComposeModal.tsx` and fills in subject, body, recipients, scheduled time, and sender profiles.
2. **API Request**: Frontend sends an HTTP POST to `http://localhost:5000/api/emails/schedule` (handled by `backend/src/routes/email.ts`).
3. **Validation**: Express validates request payload using Zod schema in `backend/src/schemas/email.ts`.
4. **Database Record**: Express uses Prisma (`backend/src/lib/prisma.ts`) to write an `EmailJob` record into **PostgreSQL** with status `SCHEDULED`.
5. **Queue Delay Calculation**: Express calculates `delay = scheduledAt - now()` and adds the job to the BullMQ queue (`backend/src/lib/queue.ts`) in **Redis**.

### B. Background Execution & Rate-Limiting Flow
1. **Trigger**: When the delay elapses, **BullMQ Worker** (`backend/src/worker.ts`) picks up the job from Redis.
2. **Rate Limit Check**: Worker queries Redis or Postgres to check how many emails sender has sent in the last hour (`MAX_EMAILS_PER_HOUR_PER_SENDER`).
   - If limit exceeded: Worker reschedules the job with a delay.
3. **SMTP Dispatch**: Worker calls Nodemailer (`backend/src/lib/mailer.ts`) to send the email via Ethereal SMTP.
4. **Success State**:
   - Updates `EmailJob` status to `SENT` in PostgreSQL.
   - Indexes sent email metadata into **Elasticsearch** (`backend/src/lib/elasticsearch.ts`).
5. **Failure State**:
   - Updates `EmailJob` status to `FAILED` with error message in PostgreSQL.
   - Indexes failure event into **Elasticsearch**.
   - Dispatches a webhook message to **Slack** (`backend/src/lib/slack.ts`) notifying team of the failed job.

### C. Live Search & Log Retrieval Flow
1. **User Action**: User types a query into the Search bar in the Sent/Failed emails tab on the Dashboard.
2. **API Request**: Frontend requests `GET /api/emails/search?q=query` from `backend/src/routes/email.ts`.
3. **Search Engine**: Backend queries **Elasticsearch** (`backend/src/lib/elasticsearch.ts`) using full-text search across `subject`, `body`, `recipientEmail`, and `errorMessage`.
4. **Response**: Elasticsearch returns matched log records with high speed and precision.

---

## 4. Feature-to-Folder Mapping

| Functionality / Feature | Responsible Folder & File(s) | Primary Purpose |
| :--- | :--- | :--- |
| **Authentication & Sessions** | `frontend/src/app/login/`, `frontend/src/lib/auth.ts`, `backend/src/middleware/auth.ts` | Handles Google OAuth login & mock authentication tokens |
| **Email Compose UI & Batch CSV** | `frontend/src/components/ComposeModal.tsx` | Allows scheduling emails to multiple recipients, multi-sender assignment, and CSV upload |
| **Email Data Storage** | `backend/prisma/schema.prisma`, `backend/src/lib/prisma.ts` | Relational storage for Users, Senders, Email Jobs, and Slack Webhooks |
| **Queue Management & Scheduling** | `backend/src/lib/queue.ts`, `backend/src/worker.ts` | In-memory job queuing via BullMQ & Redis with concurrency control |
| **Rate Limiting & Delay Engine** | `backend/src/worker.ts`, `backend/src/env.ts` | Throttles senders based on configured hourly email limits |
| **SMTP Delivery Service** | `backend/src/lib/mailer.ts` | Transports emails to recipient targets using Nodemailer and Ethereal |
| **Full-Text Log Search** | `backend/src/lib/elasticsearch.ts`, `backend/src/routes/email.ts` | High-performance search & log analytics via Elasticsearch 8 |
| **Failure Alerts & Slack Webhooks** | `backend/src/lib/slack.ts`, `backend/src/routes/slack.ts` | Sends real-time error notifications to configured Slack channels |
| **Queue Dashboard UI** | `backend/src/index.ts` (`/admin/queues`), `backend/src/middleware/basicAuth.ts` | Bull Board interface for monitoring, pausing, and retrying email queues |
| **Load & Stress Testing** | `backend/scripts/loadTest.ts`, `backend/scripts/testBatchSchedule.ts` | Automated scripts to test queue throughput and rate limits |
