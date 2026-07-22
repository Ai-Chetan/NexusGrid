import { jsPDF } from 'jspdf';

// ─── Brand palette (matches the app's slate/blue theme) ─────────────────────
const NAVY: [number, number, number] = [15, 23, 42];      // slate-900
const BLUE: [number, number, number] = [37, 99, 235];     // blue-600
const SLATE: [number, number, number] = [71, 85, 105];    // slate-600
const LIGHT: [number, number, number] = [241, 245, 249];  // slate-100
const ZEBRA: [number, number, number] = [248, 250, 252];  // slate-50
const BORDER: [number, number, number] = [203, 213, 225]; // slate-300

export interface PdfColumn {
  header: string;
  /** key into each row object */
  key: string;
  /** column width in pt; if omitted, remaining space is split evenly */
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfTable {
  title?: string;
  columns: PdfColumn[];
  rows: Array<Record<string, string | number>>;
  /** optional footer row rendered bold with a top rule (e.g. totals) */
  footer?: Record<string, string | number>;
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  /** e.g. "Range: 2026-04-01 to 2026-07-22" */
  meta?: string[];
  tables: PdfTable[];
  /** big highlighted stat cards rendered before the tables */
  stats?: Array<{ label: string; value: string }>;
  fileName: string;
}

const PAGE = { w: 595.28, h: 841.89 };   // A4 portrait, pt
const M = 40;                            // margin
const CONTENT_W = PAGE.w - M * 2;

export function generatePdfReport(opts: PdfReportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const generatedAt = new Date().toLocaleString();
  let y = 0;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  // ── Header band drawn on every page ──────────────────────────────────────
  const drawHeader = () => {
    setFill(NAVY);
    doc.rect(0, 0, PAGE.w, 64, 'F');
    setFill(BLUE);
    doc.rect(0, 64, PAGE.w, 3, 'F');

    setText([255, 255, 255]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('NexusGrid', M, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText([148, 163, 184]);
    doc.text('Lab Infrastructure Management', M, 46);

    setText([226, 232, 240]);
    doc.setFontSize(9);
    doc.text(opts.title, PAGE.w - M, 30, { align: 'right' });
    doc.setFontSize(8);
    setText([148, 163, 184]);
    doc.text(`Generated ${generatedAt}`, PAGE.w - M, 46, { align: 'right' });
    y = 88;
  };

  const drawFooter = () => {
    const page = doc.getNumberOfPages();
    setDraw(BORDER);
    doc.setLineWidth(0.5);
    doc.line(M, PAGE.h - 30, PAGE.w - M, PAGE.h - 30);
    setText(SLATE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('NexusGrid — Confidential', M, PAGE.h - 18);
    doc.text(`Page ${page}`, PAGE.w - M, PAGE.h - 18, { align: 'right' });
  };

  const ensure = (needed: number) => {
    if (y + needed > PAGE.h - 44) {
      drawFooter();
      doc.addPage();
      drawHeader();
    }
  };

  drawHeader();

  // ── Title block ──────────────────────────────────────────────────────────
  setText(NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(opts.title, M, y);
  y += opts.subtitle ? 18 : 12;

  if (opts.subtitle) {
    setText(SLATE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(opts.subtitle, M, y);
    y += 14;
  }

  (opts.meta ?? []).forEach((line) => {
    setText(SLATE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(line, M, y);
    y += 12;
  });
  y += 10;

  // ── Stat cards ───────────────────────────────────────────────────────────
  if (opts.stats?.length) {
    const gap = 10;
    const cardW = (CONTENT_W - gap * (opts.stats.length - 1)) / opts.stats.length;
    const cardH = 48;
    ensure(cardH + 12);
    opts.stats.forEach((s, i) => {
      const x = M + i * (cardW + gap);
      setFill(LIGHT);
      setDraw(BORDER);
      doc.roundedRect(x, y, cardW, cardH, 5, 5, 'FD');
      setText(BLUE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(String(s.value), x + cardW / 2, y + 22, { align: 'center' });
      setText(SLATE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(s.label, x + cardW / 2, y + 38, { align: 'center' });
    });
    y += cardH + 20;
  }

  // ── Tables ───────────────────────────────────────────────────────────────
  const resolveWidths = (cols: PdfColumn[]) => {
    const fixed = cols.reduce((a, c) => a + (c.width ?? 0), 0);
    const flexCount = cols.filter((c) => !c.width).length;
    const flexW = flexCount ? (CONTENT_W - fixed) / flexCount : 0;
    return cols.map((c) => c.width ?? flexW);
  };

  const drawRow = (
    cols: PdfColumn[], widths: number[], row: Record<string, string | number>,
    rowOpts: { bold?: boolean; fill?: [number, number, number]; height: number },
  ) => {
    if (rowOpts.fill) {
      setFill(rowOpts.fill);
      doc.rect(M, y, CONTENT_W, rowOpts.height, 'F');
    }
    setText(NAVY);
    doc.setFont('helvetica', rowOpts.bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    let x = M;
    cols.forEach((c, i) => {
      const w = widths[i];
      const text = String(row[c.key] ?? '');
      const clipped = doc.splitTextToSize(text, w - 8)[0] ?? '';
      const align = c.align ?? 'left';
      const tx = align === 'right' ? x + w - 4 : align === 'center' ? x + w / 2 : x + 4;
      doc.text(clipped, tx, y + rowOpts.height - 5, { align });
      x += w;
    });
    y += rowOpts.height;
  };

  const drawTableHeader = (cols: PdfColumn[], widths: number[], rowH: number) => {
    setFill(NAVY);
    doc.rect(M, y, CONTENT_W, rowH, 'F');
    setText([255, 255, 255]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    let hx = M;
    cols.forEach((c, i) => {
      const w = widths[i];
      const align = c.align ?? 'left';
      const tx = align === 'right' ? hx + w - 4 : align === 'center' ? hx + w / 2 : hx + 4;
      doc.text(c.header, tx, y + rowH - 5, { align });
      hx += w;
    });
    y += rowH;
  };

  opts.tables.forEach((table) => {
    const widths = resolveWidths(table.columns);
    const rowH = 18;

    // keep the section title, header row, and first body row together
    ensure((table.title ? 20 : 0) + rowH * 2 + 4);
    if (table.title) {
      setText(NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(table.title, M, y + 4);
      y += 16;
    }
    drawTableHeader(table.columns, widths, rowH);

    table.rows.forEach((row, idx) => {
      if (y + rowH > PAGE.h - 44) {
        drawFooter();
        doc.addPage();
        drawHeader();
        drawTableHeader(table.columns, widths, rowH);
      }
      drawRow(table.columns, widths, row, {
        height: rowH,
        fill: idx % 2 === 1 ? ZEBRA : undefined,
      });
    });
    if (!table.rows.length) {
      ensure(rowH);
      setText(SLATE);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.text('No records in this range.', M + 4, y + rowH - 5);
      y += rowH;
    }

    if (table.footer) {
      ensure(rowH + 2);
      setDraw(NAVY);
      doc.setLineWidth(0.8);
      doc.line(M, y, PAGE.w - M, y);
      drawRow(table.columns, widths, table.footer, {
        height: rowH, bold: true, fill: LIGHT,
      });
    }
    y += 18;
  });

  drawFooter();
  doc.save(opts.fileName);
}
