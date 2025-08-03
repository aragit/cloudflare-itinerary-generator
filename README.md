
# AI-Powered Itinerary Generator  
> Cloudflare Worker + D1 SQLite + OpenAI GPT-4o-mini
> A lightweight, serverless API that creates structured travel itineraries **asynchronously** with a single HTTP call.

The AI-Powered Itinerary Generator is a serverless micro-service that turns two pieces of user input—destination and trip length—into a rich, structured travel plan in seconds.
Key experience:
- Instant feedback: caller receives a unique tracking ID (jobId) immediately.
- Silent processing: GPT-4o-mini composes day-by-day itineraries in the background.
- Stateless & durable: results are persisted in Cloudflare D1 (serverless SQLite).
- Zero infrastructure: scales from 1 to 1 000 000 calls without extra config.

---

### Quick Start Command Sheet
 ```bash
# Clone & install
git clone https://github.com/<you>/stak-itinerary-generator.git
cd stak-itinerary-generator
npm install

# Secrets
wrangler secret put OPENAI_API_KEY

# Deploy
wrangler deploy

# Test
curl -X POST https://<worker>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"destination":"Barcelona","durationDays":4}'
1. **Deploy**  
   ```bash
   npm install
   wrangler secret put OPENAI_API_KEY
   wrangler deploy
   ```

### Stack Overview

| Component        | Choice & Reason |
|------------------|-----------------|
| **Runtime**      | Cloudflare Workers – zero-cold-start, global edge |
| **Database**     | **D1 SQLite** (replaced Firestore) – serverless SQL with 1 ms latency |
| **LLM**          | OpenAI GPT-4o-mini – low cost, JSON mode |
| **Validation**   | Zod – runtime schema guard |
| **Language**     | TypeScript – type-safe & auto-deploy |

---

### Project Structure

```
├── src/index.ts          # Worker entry point
├── migrations/0001_init.sql
├── wrangler.jsonc        # D1 binding & env vars
├── package.json          # deps: openai, zod, uuid
└── README.md             # this file
```

---

### Setup Guide

#### 1. Prerequisites

| Tool | Install |
|------|---------|
| Node 20+ | `curl -fsSL https://fnm.vercel.app/install | bash` |
| Wrangler CLI | `npm i -g wrangler` |

#### 2. Clone & Install

```bash
git clone https://github.com/<you>/stak-itinerary-generator.git
cd stak-itinerary-generator
npm install
```

#### 3. Bind Secrets

```bash
wrangler login
wrangler secret put OPENAI_API_KEY       # your OpenAI key
# No other secrets needed (D1 keys are automatic)
```

#### 4. Deploy

```bash
wrangler deploy
```

---

### API Reference

#### `POST /`
Create a new itinerary job.

**Request**  
```json
{
  "destination": "Barcelona, Spain",
  "durationDays": 4
}
```

**Response**  
```json
{ "jobId": "a1b2c3d4-e5f6-7890-abcd-1234567890ab" }
```

#### `GET /status/:jobId`
Check status & retrieve itinerary once ready.

**Response examples**

| Status | Body |
|--------|------|
| **processing** | `{"status":"processing"}` |
| **completed** | `{"status":"completed","itinerary":[...]}` |
| **failed** | `{"status":"failed","error":"LLM timeout"}` |

---

### Example Workflows

#### Happy Path
```bash
# 1. Submit
JOB=$(curl -s -X POST https://stak-d1-1754217065.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"destination":"Tokyo","durationDays":3}' | jq -r .jobId)

# 2. Wait ~10 s
curl https://stak-d1-1754217065.workers.dev/status/${JOB}
```

#### Debug Database
```bash
wrangler d1 execute stak_itinerary --command="SELECT * FROM itineraries ORDER BY created_at DESC LIMIT 1"
```

---

### Cloudflare Dashboard Screenshots

Workers overview: 
![Workers Overview](./docs/Workers.png)


Metrics: 
![Metrics Overview](./docs/metrics.png)


D1 Database:
![d1 Overview](./docs/D1.png)


---

### Architectural Choices

| Decision | Rationale |
|----------|-----------|
| **D1 over Firestore** | Lower latency, zero egress, single-file SQL migrations |
| **Async via `ctx.waitUntil`** | Instant 202 response while LLM runs |
| **Zod validation** | Guarantees schema even if LLM drifts |
| **Plain fetch to OpenAI** | Smaller bundle vs. `openai` SDK |

---

### Prompt Design

**System prompt sent to GPT-4o-mini** (truncated):

> “You are an expert travel planner… return ONLY valid JSON … { schema } … no markdown.”

---

### Testing

#### Unit
```bash
npm test          # vitest (if tests added)
```

#### Manual
```bash
npm run dev       # local dev server
```

---


### Security Notes

- **Secrets**: Never commit `OPENAI_API_KEY`; stored via Wrangler Secrets.  
- **D1**: Uses worker-bound identity; no extra key exposed.  
- **CORS**: Add `Access-Control-Allow-Origin` header for browser use.

---

## License

MIT © 2025 — Your Name


