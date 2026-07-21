// Shared CSV/export helpers used by Reports and Admin Oversight pages.

export function csvEscape(value: unknown): string {
  const raw = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (raw.includes(',') || raw.includes('"')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildCsvSection(title: string, headers: string[], rows: unknown[][]): string {
  const lines = [title, headers.join(',')];
  rows.forEach((row) => lines.push(row.map(csvEscape).join(',')));
  lines.push('');
  return lines.join('\n');
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(sections: string[], fileName: string): void {
  triggerDownload(new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8;' }), fileName);
}
