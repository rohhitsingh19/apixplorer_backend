# APIxplorer — Backend

A **NestJS** backend that lets developers paste any JSON API response, ask a plain-English question about it, and receive a structured, AI-powered breakdown — including field maps, code snippets, and targeted field lookups.

---

## What It Does

APIxplorer exposes a single `POST /api/explore` endpoint. The client sends:
- a raw **JSON** string (any API response)
- a **query** in plain English (e.g. *"explain this"* or *"find the user's email"*)

The backend parses the JSON, builds a prompt, calls **Gemini 2.5 Flash**, and returns a structured `ExploreResult` — either a full field-map explanation or a precise field lookup with a ready-to-use TypeScript code snippet.

---

## Architecture & Request Flow

```
Client
  │
  │  POST /api/explore  { json, query }
  ▼
┌─────────────────────────────────────────────────┐
│              API Layer (NestJS)                  │
│                                                  │
│  ThrottlerGuard ──────────────── Redis           │
│  (5 req/day per IP)    check/incr rate-limit     │
│         │             counters                   │
│         ▼                                        │
│  ValidationPipe                                  │
│  (whitelist DTO — json + query required)         │
│         │                                        │
│         ▼                                        │
│  ExploreController  @POST                        │
│         │                                        │
│         ▼                          ┌──────────────────────┐
│  ExploreService                    │   LLM Integration    │
│  parseJson · truncate ─────────── ▶│  System Prompt       │
│  analyzeWithLLM        build prompt│  (EXPLAIN / FIND)    │
│         ◀──────────────────────────│  Gemini 2.5 Flash    │
│         │       raw text → parse   └──────────────────────┘
└─────────│───────────────────────────────────────┘
          ▼
    ExploreResult
    { mode · summary · targetField · codeSnippet · fieldMap }
          │
          ▼
       Client
```

### Key Components

| Component | Responsibility |
|---|---|
| `ThrottlerGuard` | Rate-limits to **5 requests / day per IP** using Redis counters |
| `ValidationPipe` | Validates and whitelists the incoming `ExploreDto` (`json`, `query`) |
| `ExploreController` | Single `@Post()` endpoint at `/explore`, wires guard + service |
| `ExploreService` | Parses JSON, truncates to 8 000 chars, builds prompt, calls Gemini, parses response |
| **Gemini 2.5 Flash** | LLM that receives a system prompt + user message and returns structured JSON |
| `ExploreResult` | Typed response: `mode`, `summary`, `targetField`, `codeSnippet`, `fieldMap` |

---

## Two Operating Modes

The LLM is guided by a system prompt to operate in one of two modes based on the user's query:

### `EXPLAIN` mode
Triggered by: *"explain", "describe", "what is in", "tell me about"*

Returns a 3–5 sentence summary of the API response **and** a `fieldMap` covering **every** field — with type, description, and an actual example value from the JSON.

### `FIND` mode
Triggered by: *"find X", "get X", "I want X", "which field has X"*

Returns:
- `targetField` — exact dot-notation path, actual value, and why it was chosen
- `codeSnippet` — valid TypeScript to extract that value
- `fieldMap` — the 5–7 most relevant fields

---

## Response Shape

```ts
interface ExploreResult {
  mode: 'explain' | 'find';
  summary: string;
  targetField?: {        // find mode only
    path: string;
    value: string;
    explanation: string;
  };
  codeSnippet?: string; // find mode only
  fieldMap: Array<{
    path: string;
    type: string;
    description: string;
    example?: string;
  }>;
}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [NestJS 11](https://nestjs.com) (TypeScript) |
| LLM | Google Gemini 2.5 Flash via REST (`axios`) |
| Rate Limiting | `@nestjs/throttler` + Redis ([Upstash](https://upstash.com)) |
| Validation | `class-validator` + `class-transformer` |
| Config | `@nestjs/config` (`.env`) |

---

## Project Setup

```bash
# Install dependencies
yarn install

# Copy environment file and add your keys
cp .env.example .env
```

**.env** variables required:

```env
GEMINI_API_KEY=your_gemini_api_key
REDIS_URL=your_upstash_redis_url
REDIS_TOKEN=your_upstash_redis_token
```

---

## Running the Server

```bash
# Development (watch mode)
yarn start:dev

# Production
yarn build
yarn start:prod
```

The server starts on **`http://localhost:3000`** by default.

---

## API Reference

### `POST /api/explore`

**Rate limit:** 5 requests per IP per day (tracked in Redis)

**Request body:**
```json
{
  "json": "{\"id\": 1, \"name\": \"Alice\"}",
  "query": "what is in this response?"
}
```

**Success response (200):**
```json
{
  "mode": "explain",
  "summary": "This is a user object from a REST API...",
  "fieldMap": [
    { "path": "id", "type": "number", "description": "Unique user identifier", "example": "1" },
    { "path": "name", "type": "string", "description": "The user's full name", "example": "Alice" }
  ]
}
```

**Error responses:**
- `400` — invalid JSON or unparseable AI response
- `429` — rate limit exceeded (5 req/day)

---

## Running Tests

```bash
# Unit tests
yarn test

# End-to-end tests
yarn test:e2e

# Coverage report
yarn test:cov
```

---

## Privacy

**No data is stored.** JSON payloads are processed in memory for the duration of the request and discarded immediately after the response is sent.

---

