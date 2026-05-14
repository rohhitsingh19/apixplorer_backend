import { Injectable, BadRequestException } from '@nestjs/common';
import { createLogger } from 'src/common/logger';

export interface ParsedCurl {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

@Injectable()
export class CurlParserService {
  private readonly logger = createLogger(CurlParserService.name);

  parse(curlString: string): ParsedCurl {
    this.logger.log('Starting curl string parsing...');
    const normalized = curlString
      .replace(/\\\n/g, ' ')
      .replace(/\\\r\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized.toLowerCase().startsWith('curl')) {
      this.logger.error('Input is not a valid curl command');
    }

    const url = this.extractUrl(normalized);
    const method = this.extractMethod(normalized);
    const headers = this.extractHeaders(normalized);
    const body = this.extractBody(normalized);

    this.logger.log(`Successfully parsed curl command: ${method} ${url}`);
    return { url, method, headers, body };
  }

  private extractUrl(curl: string): string {
    const quoted = curl.match(/curl\s+['"]([^'"]+)['"]/);
    if (quoted) return quoted[1];

    const bare = curl.match(/curl\s+(https?:\/\/[^\s]+)/);
    if (bare) return bare[1];

    throw new BadRequestException('Could not extract URL from curl command');
  }

  private extractMethod(curl: string): string {
    const match = curl.match(/(?:-X|--request)\s+['"]?(\w+)['"]?/i);
    if (match) return match[1].toUpperCase();
    if (/(?:--data(?:-raw|-binary)?|-d)\s/.test(curl)) return 'POST';
    return 'GET';
  }

  private extractHeaders(curl: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const regex = /(?:-H|--header)\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(curl)) !== null) {
      const colonIndex = match[1].indexOf(':');
      if (colonIndex === -1) continue;
      const key = match[1].slice(0, colonIndex).trim();
      const value = match[1].slice(colonIndex + 1).trim();
      headers[key] = value;
    }

    return headers;
  }

  private extractBody(curl: string): string | undefined {
    const dataFlag = curl.match(/(?:--data(?:-raw|-binary)?|\s-d)\s+/);
    if (!dataFlag) return undefined;

    const afterFlag = curl.slice(dataFlag.index! + dataFlag[0].length);
    const trimmed = afterFlag.trimStart();

    let body: string;

    if (trimmed.startsWith("'")) {
      const end = trimmed.indexOf("'", 1);
      if (end === -1) return undefined;
      body = trimmed.slice(1, end);
    } else if (trimmed.startsWith('"')) {
      const end = trimmed.indexOf('"', 1);
      if (end === -1) return undefined;
      body = trimmed.slice(1, end);
    } else {
      const nextFlag = trimmed.search(/\s+(?:-[A-Za-z]|--[a-z])/);
      body =
        nextFlag === -1 ? trimmed.trim() : trimmed.slice(0, nextFlag).trim();
    }

    return body || undefined;
  }
}
