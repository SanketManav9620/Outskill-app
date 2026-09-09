# Outskill Mailer - Automated Email Queue & Slack Dispatcher Monorepo

A full-stack email scheduling and dispatching platform built with **Next.js 14 (App Router)**, **Express.js (TypeScript)**, **Prisma ORM (PostgreSQL)**, **BullMQ (Redis)**, **Elasticsearch**, **NextAuth (Google OAuth)**, and **Slack OAuth v2**.

---

## 📋 Table of Contents
1. [Quick Start & How to Run](#1-quick-start--how-to-run)
2. [Docker Compose Usage](#2-docker-compose-usage)
3. [Creating an Ethereal Account & Environment Setup](#3-creating-an-ethereal-account--environment-setup)
4. [Deep Architecture Explanation](#4-deep-architecture-explanation)
5. [Exact Delay & Rate-Limit Values Chosen and Rationale](#5-exact-delay--rate-limit-values-chosen-and-rationale)
6. [Assignment Requirement Implementation Checklist](#6-assignment-requirement-implementation-checklist)

---

## 1. Quick Start & How to Run

### Prerequisites
- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Docker & Docker Compose** (for PostgreSQL, Redis, Elasticsearch)

### Step-by-Step Execution Guide

#### 1. Install Workspace Dependencies
Run from the root directory to install all monorepo workspace dependencies:
```bash
npm install
```

#### 2. Configure Environment Files
Copy example environment templates for both backend and frontend services:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

#### 3. Start Infrastructure Containers
Launch PostgreSQL (5432), Redis (6379), and Elasticsearch (9200):
```bash
npm run docker:up
```

#### 4. Run Prisma Database Migrations
Initialize PostgreSQL tables and indexes:
```bash
cd backend && npx prisma migrate dev --name init_models && cd ..
```

#### 5. Generate Ethereal SMTP Credentials
Generate fresh Ethereal Mail sandbox credentials (see [Section 3](#3-creating-an-ethereal-account--environment-setup)):
```bash
npm run create-ethereal
```

#### 6. Launch Applications
Run backend API, background worker, and frontend dev servers in separate terminal tabs:

- **Terminal 1 (Backend API)**:
  ```bash
  npm run dev:backend
  ```
  *Express API running at `http://localhost:5000` | Bull Board Admin UI at `http://localhost:5000/admin/queues` (User: `admin`, Pass: `admin123`)*

- **Terminal 2 (Standalone BullMQ Worker)**:
  ```bash
  npm run dev:worker
  ```
  *Background Worker processing `"email-send"` queue with startup reconciliation and rate-limit staggering*

- **Terminal 3 (Next.js Frontend)**:
  ```bash
  npm run dev:frontend
  ```
  *Dashboard UI running at `http://localhost:3000/dashboard`*

---

## 2. Docker Compose Usage

The platform uses Docker Compose to orchestrate database, queue, and search infrastructure services:

```yaml
# Services orchestrated in docker-compose.yml:
- postgres:16-alpine      (Port 5432) -> Persistent volume: postgres_data
- redis:7-alpine          (Port 6379) -> Persistent volume: redis_data
- elasticsearch:8.11.0    (Port 9200) -> Persistent volume: es_data
```

### Docker Management Commands
```bash
# Start all containers in background
docker compose up -d

# Check status of running services
docker compose ps

# View live container logs
docker compose logs -f

# Stop and remove containers (preserving volumes)
docker compose down

# Stop containers and remove volumes (clean reset)
docker compose down -v
```

---

## 3. Creating an Ethereal Account & Environment Setup

The application uses **Ethereal Mail** (a fake SMTP service by Nodemailer) for safe email testing without sending actual external emails.

### 1. Generate Ethereal Credentials via CLI Script
Run the automated creation script from the root workspace:
```bash
npm run create-ethereal
```

**Console Output Example:**
```text
🚀 Creating new Ethereal test account...
✅ Ethereal Account Created Successfully!
--------------------------------------------------
ETHEREAL_USER="john.doe@ethereal.email"
ETHEREAL_PASS="secretPass123"
ETHEREAL_HOST="smtp.ethereal.email"
ETHEREAL_PORT=587
--------------------------------------------------
Preview messages at: https://ethereal.email
```

### 2. Configure Backend `.env` File
Open [`backend/.env`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/.env) and paste the generated credentials:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/monorepo_db?schema=public"
REDIS_URL="redis://localhost:6379"
ELASTICSEARCH_URL="http://localhost:9200"

# Ethereal SMTP Credentials
ETHEREAL_USER="john.doe@ethereal.email"
ETHEREAL_PASS="secretPass123"
ETHEREAL_HOST="smtp.ethereal.email"
ETHEREAL_PORT=587

# Worker & Queue Tuning
WORKER_CONCURRENCY=5
MIN_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=100

# Administrative Dashboard Credentials
BULLBOARD_USER="admin"
BULLBOARD_PASS="admin123"

# Slack OAuth App Credentials
SLACK_CLIENT_ID="mock-slack-client-id"
SLACK_CLIENT_SECRET="mock-slack-client-secret"
```

Emails dispatched by the worker will be delivered to Ethereal Mail. You can view rendered HTML messages at [https://ethereal.email](https://ethereal.email) using your `ETHEREAL_USER` and `ETHEREAL_PASS`.

---

## 4. Deep Architecture Explanation

### 4.1 Staggered Batch Scheduling
When scheduling batch emails via `POST /api/emails/schedule-batch`, the API calculates staggered `scheduledAt` timestamps for each recipient:
$$\text{scheduledAt}_i = \text{startTime} + (i \times \text{delaySeconds})$$
1. **PostgreSQL Creation**: Creates one `EmailJob` row per recipient (initial status: `SCHEDULED`).
2. **BullMQ Enqueue**: Calculates initial delay $\text{Math.max}(0, \text{scheduledAt} - \text{Date.now()})$ and adds a delayed job to the `"email-send"` queue using deterministic `jobId: email-${id}`.
3. **Elasticsearch Indexing**: Index document immediately into the `"emails"` Elasticsearch index.

### 4.2 Worker Restart Persistence & Reconciliation
To guarantee zero lost jobs and zero duplicate dispatches when the background worker restarts:
- **Deterministic Job IDs**: Every BullMQ job is enqueued with `jobId: email-${id}` using the database row's primary key.
- **Startup Reconciliation (`reconcileScheduledJobs()`)**: Upon worker boot in [`backend/src/worker.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/worker.ts), the worker:
  1. Queries PostgreSQL for all jobs with `status = SCHEDULED`.
  2. Queries Redis via `emailQueue.getJob("email-" + id)`.
  3. If present in Redis, skips re-enqueuing.
  4. If missing from Redis (e.g. Redis crash/flush), re-enqueues the job with its recomputed remaining delay.

### 4.3 Raw Redis Per-Sender Hourly Rate Limiting
Rate limiting is enforced per sender using atomic raw Redis commands:
- **Redis Window Key**: `ratelimit:${senderId}:${YYYY-MM-DDTHH}`.
- **Processing Logic**:
  1. Executes `redisConnection.incr(key)`. On first increment (`count === 1`), sets a 3600-second expiration (`EXPIRE key 3600`).
  2. If `count > MAX_EMAILS_PER_HOUR_PER_SENDER`:
     - Decrements the counter (`DECR key`).
     - Calculates `nextWindowTimestamp` (top of the next hour window).
     - Dispatches Slack webhook alert if configured ([Section 4.5](#45-slack-rate-limit-webhook-notifications)).
     - Re-indexes job in Elasticsearch as postponed.
     - Calls `job.moveToDelayed(nextWindowTimestamp, token)`.
     - **Result**: Job status remains `SCHEDULED` in PostgreSQL and stays delayed in BullMQ until the next hour window.

### 4.4 Worker Concurrency & Multi-Threading
- The worker process runs independently (`npm run dev:worker`) with `concurrency: WORKER_CONCURRENCY` (default 5).
- Processes up to $N$ jobs concurrently across async event loop slots.
- Implements `MIN_DELAY_MS` delay at top of worker processor to throttle SMTP dispatch pacing.

### 4.5 Slack Rate-Limit Webhook Notifications
- **Fresh DB Lookup**: `notifySlackRateLimitHit(senderId, sentCount, limit)` in [`backend/src/lib/slack.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/lib/slack.ts) performs a fresh database query on every execution (`Sender` -> `User` -> `SlackIntegration`).
- **Zero Cache Dependency**: Avoids stale in-memory state.
- **Silent Exception Handling**: If no `SlackIntegration` exists or webhook call fails, it completes silently without throwing or breaking worker processing.

### 4.6 Centralized Error Handling & Unhandled Rejection Safety
- **`asyncHandler`**: Higher-order wrapper `(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)` applied to all Express routes.
- **`AppError`**: Custom error class with HTTP status code and error code.
- **`errorHandler`**: Express middleware returning `{ error: { message, code } }` with appropriate status code (400, 401, 403, 404, 500), preventing unhandled promise rejections from crashing the process.
- **Frontend Toast Popups**: SWR and fetch error handlers display floating toast notifications for API error responses.

---

## 5. Exact Delay & Rate-Limit Values Chosen and Rationale

| Parameter | Default Value | Technical Rationale & Architectural Justification |
| :--- | :--- | :--- |
| **`MIN_DELAY_MS`** | `2000 ms` (2 seconds) | **SMTP Rate Pacing**: Enforces a minimum 2-second gap between individual email dispatches. Prevents hitting Ethereal/SMTP provider connection limits, socket exhaustion, and IP blacklisting during rapid batch queues. |
| **`MAX_EMAILS_PER_HOUR_PER_SENDER`** | `100 emails/hour` | **Domain Reputation Protection**: Standard transactional email providers (SendGrid, Mailgun, AWS SES sandbox) enforce strict hourly quotas per sending identity. 100/hr prevents domain reputation damage while demonstrating raw Redis rate-limiting staggering into future hour windows. |
| **`WORKER_CONCURRENCY`** | `5 workers` | **Optimal Resource Balance**: Balances parallel async throughput with Node.js event loop memory/CPU footprint. Allows processing 5 concurrent jobs per worker process without overwhelming database connection pools or Redis memory. |
| **BullMQ Retry Backoff** | `3 attempts` / Exponential (1000ms base) | **Transient Fault Tolerance**: Automatically retries temporary SMTP network blips up to 3 times with exponential backoff (`1s`, `2s`, `4s`) before marking status as `FAILED`. |

---

## 6. Assignment Requirement Implementation Checklist

| Assignment Requirement | Status | File Location / Function Reference |
| :--- | :---: | :--- |
| **1. Slack OAuth v2 (`GET /auth/slack/start` & Callback)** | ✅ | [`backend/src/routes/slack.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/routes/slack.ts) (`/auth/slack/start`, `/auth/slack/callback`) |
| **2. SlackIntegration DB Storage (teamId, accessToken, webhookUrl)** | ✅ | [`backend/prisma/schema.prisma`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/prisma/schema.prisma) (`model SlackIntegration`) |
| **3. GET `/api/slack/status` Connection Status** | ✅ | [`backend/src/routes/slack.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/routes/slack.ts) (`GET /api/slack/status`) |
| **4. Fresh DB Lookup Slack Webhook Notification (`notifySlackRateLimitHit`)** | ✅ | [`backend/src/lib/slack.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/lib/slack.ts) (`notifySlackRateLimitHit()`) |
| **5. Mock Fetch Test for Slack Notification** | ✅ | [`backend/scripts/testSlackNotification.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/scripts/testSlackNotification.ts) (`npm run test:slack`) |
| **6. System Flow & Architecture Documentation (`flow.md`)** | ✅ | [`flow.md`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/flow.md) (Complete flow diagram & changelog) |
| **7. Elasticsearch Index Creation (`emails` index)** | ✅ | [`backend/src/lib/elasticsearch.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/lib/elasticsearch.ts) (`ensureEmailsIndex()`) |
| **8. Upsert EmailJob into Elasticsearch on Status Transitions** | ✅ | [`backend/src/lib/elasticsearch.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/lib/elasticsearch.ts) (`indexEmailJob()`) |
| **9. GET `/api/emails/search` Multi-Match Query & Postgres Hydration** | ✅ | [`backend/src/routes/email.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/routes/email.ts) (`GET /search`) |
| **10. NextAuth Google Provider & Protected Dashboard Shell** | ✅ | [`frontend/src/app/api/auth/[...nextauth]/route.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/app/api/auth/%5B...nextauth%5D/route.ts), [`frontend/src/middleware.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/middleware.ts) |
| **11. Google Login Page & Dashboard Layout (Header, Tabs, CTA)** | ✅ | [`frontend/src/app/login/page.tsx`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/app/login/page.tsx), [`frontend/src/components/DashboardLayout.tsx`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/components/DashboardLayout.tsx) |
| **12. Batch Compose Modal with CSV/TXT Upload & Client Validation** | ✅ | [`frontend/src/components/ComposeModal.tsx`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/components/ComposeModal.tsx) |
| **13. POST `/api/emails/schedule-batch` Staggered Endpoint** | ✅ | [`backend/src/routes/email.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/routes/email.ts) (`POST /schedule-batch`) |
| **14. Generic `<DataTable>` with Skeleton & Empty States** | ✅ | [`frontend/src/components/DataTable.tsx`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/components/DataTable.tsx) |
| **15. SWR 5-Second Polling Email Tables (`Scheduled` & `Sent`)** | ✅ | [`frontend/src/components/ScheduledEmailsTable.tsx`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/components/ScheduledEmailsTable.tsx), [`frontend/src/components/SentEmailsTable.tsx`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/components/SentEmailsTable.tsx) |
| **16. Centralized Express Error Middleware (`{ error: { message, code } }`)** | ✅ | [`backend/src/middleware/errorHandler.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/middleware/errorHandler.ts) (`errorHandler()`) |
| **17. `asyncHandler` Route Handler Wrapper** | ✅ | [`backend/src/middleware/errorHandler.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/src/middleware/errorHandler.ts) (`asyncHandler()`) |
| **18. Frontend Toast Error Handling for Compose Flow & Tables** | ✅ | [`frontend/src/app/dashboard/page.tsx`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/app/dashboard/page.tsx) (`handleFetchError()`) |
| **19. Dashboard "Connect Slack" Button & Workspace Name Display** | ✅ | [`frontend/src/components/DashboardLayout.tsx`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/frontend/src/components/DashboardLayout.tsx) (`#slack-connect-btn`, `#slack-reconnect-btn`) |
| **20. Load Test Script (1000 EmailJobs across 3 senders)** | ✅ | [`backend/scripts/loadTest.ts`](file:///c:/Users/0sank/OneDrive/Desktop/outskill/backend/scripts/loadTest.ts) (`npm run test:load`) |

---

## 💻 Automated Test Suite Execution Matrix

```bash
# 1. Test Centralized Express Error Handling Middleware
npm run test:error

# 2. Test 1000 Email Jobs Load Test & Rate Limit Staggering
npm run test:load

# 3. Test Slack OAuth & Webhook Rate Limit Notification (Mock Fetch)
npm run test:slack

# 4. Test Elasticsearch Indexing & Multi-Match Search
npm run test:elasticsearch

# 5. Test Batch Email Scheduling with Staggered Delays
npm run test:batch

# 6. Test Per-Sender Hourly Rate Limiting
npm run test:ratelimit
```
