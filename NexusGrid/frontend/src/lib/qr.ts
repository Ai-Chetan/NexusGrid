export function normalizeSystemCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (/^NGSYS-\d+$/.test(upper)) return upper;
  if (/^\d+$/.test(trimmed)) return `NGSYS-${trimmed}`;
  return null;
}

export function parseSystemCodeFromQrValue(raw: string): string | null {
  const direct = normalizeSystemCode(raw);
  if (direct) return direct;

  const match = raw.toUpperCase().match(/NGSYS-\d+/);
  if (match) return match[0];

  try {
    const url = new URL(raw);
    const fromParam =
      url.searchParams.get('code') ||
      url.searchParams.get('system') ||
      url.searchParams.get('system_code');
    if (fromParam) {
      const parsed = normalizeSystemCode(fromParam);
      if (parsed) return parsed;
    }
  } catch {
    // Non-URL text is expected for many scanners.
  }

  return null;
}

export function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'nexusgrid';
}
