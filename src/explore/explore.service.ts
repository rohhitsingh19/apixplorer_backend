import { Injectable, BadRequestException } from '@nestjs/common';
import { ExploreDto } from './dto/explore.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createLogger } from 'src/common/logger';

export type ExploreMode = 'explain' | 'find';

export interface ExploreResult {
  mode: ExploreMode;
  summary: string;
  targetField?: {
    path: string;
    value: string;
    explanation: string;
  };
  codeSnippet?: string;
  fieldMap: Array<{
    path: string;
    type: string;
    description: string;
    example?: string;
  }>;
}

const SYSTEM_PROMPT = `You are an API response analyzer. You help developers understand JSON responses from APIs.

You operate in two modes depending on what the user is asking:

---

MODE 1 — EXPLAIN
Triggered when the user asks to: "explain", "describe", "what is in", "tell me about", "what does this contain", or any general question about the JSON with no specific field in mind.

Return this structure:
{
  "mode": "explain",
  "summary": "3-5 sentence plain English explanation of what this API response is, what it represents, and what a developer would typically use it for",
  "fieldMap": [
    {
      "path": "exact.field[0].path",
      "type": "string | number | boolean | array | object | null",
      "description": "what this field means and when a developer would use it",
      "example": "actual value from the response or a representative example"
    }
  ]
}

Rules for EXPLAIN mode:
- fieldMap must cover EVERY field in the JSON — not just 5-7, but all of them
- For arrays, document the structure of one item and note it repeats
- description must be plain English a non-technical person can understand
- example must be the actual value from the JSON, not a placeholder

---

MODE 2 — FIND
Triggered when the user asks for something specific: "I want X", "find X", "get X", "which field has X", "how do I get X".

Return this structure:
{
  "mode": "find",
  "summary": "2-3 sentence summary of what this response contains",
  "targetField": {
    "path": "exact.field[0].path using dot and bracket notation",
    "value": "the actual value at that path from the response",
    "explanation": "one sentence explaining why this is the right field"
  },
  "codeSnippet": "// TypeScript\nconst value = response.items[0].link;\nconsole.log(value);",
  "fieldMap": [
    {
      "path": "field.path",
      "type": "string | number | boolean | array | object | null",
      "description": "what this field contains",
      "example": "actual value from the response"
    }
  ]
}

Rules for FIND mode:
- fieldMap has 5-7 of the most relevant fields
- targetField.path must use dot notation for objects, [0] for arrays
- codeSnippet must be valid TypeScript that actually extracts the value
- If you recognize the API (Google CSE, Jungle Scout, GitHub, Stripe, Twitter, etc.) use your real knowledge of its response shape

---

GLOBAL RULES (both modes):
- Respond ONLY with raw JSON — no markdown, no backticks, no explanation outside the JSON
- Never make up field paths — only use paths that exist in the provided JSON
- If the JSON is truncated, note that in the summary`;

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

@Injectable()
export class ExploreService {
  private readonly logger = createLogger(ExploreService.name);

  constructor(
    private readonly configService: ConfigService,
  ) { }

  async explore(dto: ExploreDto): Promise<ExploreResult> {
    this.logger.log(`Processing explore request. Query: "${dto.query}"`);

    const json = this.parseJson(dto.json);

    return this.analyzeWithLLM(json, dto.query);
  }

  private parseJson(jsonString: string): unknown {
    try {
      return JSON.parse(jsonString);
    } catch (err) {
      this.logger.error(`Failed to parse JSON: ${err instanceof Error ? err.message : err}`);
      throw new BadRequestException(
        'Invalid JSON — please check your input and try again.',
      );
    }
  }

  private async analyzeWithLLM(
    json: unknown,
    query: string,
  ): Promise<ExploreResult> {
    const jsonString = JSON.stringify(json, null, 2);

    const truncated =
      jsonString.length > 8000
        ? jsonString.slice(0, 8000) + '\n\n... (truncated for analysis)'
        : jsonString;

    const userMessage = `JSON response:\n${truncated}\n\nWhat the user wants: "${query}"`;

    this.logger.log('Sending prompt to Gemini LLM for analysis...');
    const raw = await this.callLLM(userMessage);

    this.logger.log('Received response from Gemini LLM. Cleaning up format...');
    const cleaned = raw
      .replace(/^```(?:json|JSON)?\s*/gm, '')
      .replace(/```\s*$/gm, '')
      .trim();

    try {
      const result = JSON.parse(cleaned) as ExploreResult;

      // validate common fields
      if (!result.mode || !result.summary || !result.fieldMap) {
        throw new Error('Missing required fields');
      }

      // validate find-mode specific fields
      if (result.mode === 'find' && (!result.targetField || !result.codeSnippet)) {
        throw new Error('Find mode missing targetField or codeSnippet');
      }

      return result;
    } catch (err) {
      this.logger.error(`Failed to parse AI response into ExploreResult: ${err instanceof Error ? err.message : err}`);
      this.logger.debug(`Raw AI Output: ${cleaned}`);
      throw new BadRequestException(
        'Failed to parse AI response — please try again',
      );
    }
  }

  private async callLLM(userMessage: string): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Missing GEMINI_API_KEY');
    }
    let text = "";
    try {
      const res = await axios.post(GEMINI_ENDPOINT, {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userMessage }] }],
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        }
      });

      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (err: unknown) {
      this.logger.error(`Gemini API call failed: ${err instanceof Error ? err.message : err}`);
      if (axios.isAxiosError(err) && err.response) {
        throw new BadRequestException(
          `Gemini API error (${err.response.status}): ${JSON.stringify(err.response.data)}`,
        );
      }
      throw new BadRequestException(`Gemini API error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    if (!text) {
      this.logger.error('Gemini response missing expected content format');
      throw new BadRequestException('Gemini response missing expected content format');
    }
    return text;

  }

}
