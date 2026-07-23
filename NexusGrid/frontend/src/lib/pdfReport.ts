import { jsPDF } from 'jspdf';

// ─── Brand palette ────────────────────────────────────────────────────────────
const NAVY: [number, number, number] = [15, 23, 42];
const BLUE: [number, number, number] = [37, 99, 235];
const BLUE_LIGHT: [number, number, number] = [59, 130, 246];
const SLATE: [number, number, number] = [71, 85, 105];
const SLATE_LIGHT: [number, number, number] = [148, 163, 184];
const LIGHT: [number, number, number] = [241, 245, 249];
const ZEBRA: [number, number, number] = [248, 250, 252];
const BORDER: [number, number, number] = [226, 232, 240];
const WHITE: [number, number, number] = [255, 255, 255];
const EMERALD: [number, number, number] = [16, 185, 129];
const RED: [number, number, number] = [239, 68, 68];
const AMBER: [number, number, number] = [245, 158, 11];
const VIOLET: [number, number, number] = [139, 92, 246];
const CYAN: [number, number, number] = [6, 182, 212];

// Status color mapping
const STATUS_COLORS: Record<string, [number, number, number]> = {
  active: EMERALD,
  inactive: SLATE_LIGHT,
  'non-functional': RED,
  resolved: EMERALD,
  unaddressed: RED,
  'in-progress': AMBER,
  scheduled: CYAN,
  ignored: SLATE_LIGHT,
  Pending: AMBER,
  Fulfilled: EMERALD,
  Denied: RED,
  online: EMERALD,
  offline: RED,
};

export interface PdfColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
  /** Render as colored status badge */
  isStatus?: boolean;
}

export interface PdfTable {
  title?: string;
  columns: PdfColumn[];
  rows: Array<Record<string, string | number>>;
  footer?: Record<string, string | number>;
}

export interface PdfStatCard {
  label: string;
  value: string;
  /** Accent color for the stat value */
  color?: 'blue' | 'emerald' | 'red' | 'amber' | 'violet' | 'cyan' | 'slate';
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  meta?: string[];
  tables: PdfTable[];
  stats?: PdfStatCard[];
  fileName: string;
}

const PAGE = { w: 595.28, h: 841.89 };
const M = 42;
const CONTENT_W = PAGE.w - M * 2;

const STAT_COLORS: Record<string, [number, number, number]> = {
  blue: BLUE,
  emerald: EMERALD,
  red: RED,
  amber: AMBER,
  violet: VIOLET,
  cyan: CYAN,
  slate: SLATE,
};

export function generatePdfReport(opts: PdfReportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  let y = 0;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  // ── Header band ──────────────────────────────────────────────────────────
  const drawHeader = () => {
    // Main header background
    setFill(NAVY);
    doc.rect(0, 0, PAGE.w, 72, 'F');

    // Accent gradient bar (simulated with two rects)
    setFill(BLUE);
    doc.rect(0, 72, PAGE.w * 0.6, 3, 'F');
    setFill(BLUE_LIGHT);
    doc.rect(PAGE.w * 0.6, 72, PAGE.w * 0.4, 3, 'F');

    // Logo / Brand
    setText(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('NexusGrid', M, 32);

    // Tagline
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(SLATE_LIGHT);
    doc.text('Lab Infrastructure Management System', M, 48);

    // Right side — report title
    setText(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(opts.title, PAGE.w - M, 30, { align: 'right' });

    // Generated timestamp
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(SLATE_LIGHT);
    doc.text(`Generated: ${generatedAt}`, PAGE.w - M, 46, { align: 'right' });

    y = 96;
  };

  const drawFooter = () => {
    const page = doc.getNumberOfPages();
    // Separator line
    setDraw(BORDER);
    doc.setLineWidth(0.5);
    doc.line(M, PAGE.h - 36, PAGE.w - M, PAGE.h - 36);

    // Footer text
    setText(SLATE_LIGHT);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('NexusGrid — Confidential & Proprietary', M, PAGE.h - 22);
    doc.text(`Page ${page}`, PAGE.w - M, PAGE.h - 22, { align: 'right' });

    // Small brand mark
    setText(BORDER);
    doc.setFontSize(7);
    doc.text('nexusgrid.io', PAGE.w / 2, PAGE.h - 22, { align: 'center' });
  };

  const ensure = (needed: number) => {
    if (y + needed > PAGE.h - 52) {
      drawFooter();
      doc.addPage();
      drawHeader();
    }
  };

  drawHeader();

  // ── Title block ──────────────────────────────────────────────────────────
  setText(NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(opts.title, M, y);
  y += opts.subtitle ? 20 : 14;

  if (opts.subtitle) {
    setText(SLATE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(opts.subtitle, M, y);
    y += 16;
  }

  // Meta lines with bullet styling
  (opts.meta ?? []).forEach((line) => {
    setText(SLATE_LIGHT);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    // Small dot bullet
    setFill(BLUE_LIGHT);
    doc.circle(M + 3, y - 3, 1.5, 'F');
    setText(SLATE);
    doc.text(line, M + 10, y);
    y += 14;
  });
  y += 12;

  // ── Stat cards ───────────────────────────────────────────────────────────
  if (opts.stats?.length) {
    const gap = 10;
    const count = opts.stats.length;
    const cardW = (CONTENT_W - gap * (count - 1)) / count;
    const cardH = 56;
    ensure(cardH + 16);

    opts.stats.forEach((s, i) => {
      const x = M + i * (cardW + gap);
      const accentColor = STAT_COLORS[s.color ?? 'blue'] ?? BLUE;

      // Card background
      setFill(LIGHT);
      setDraw(BORDER);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, cardW, cardH, 6, 6, 'FD');

      // Top accent bar
      setFill(accentColor);
      doc.roundedRect(x, y, cardW, 4, 6, 6, 'F');
      doc.rect(x, y + 2, cardW, 2, 'F');

      // Value
      setText(accentColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(String(s.value), x + cardW / 2, y + 30, { align: 'center' });

      // Label
      setText(SLATE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(s.label.toUpperCase(), x + cardW / 2, y + 44, { align: 'center' });
    });
    y += cardH + 24;
  }

  // ── Tables ───────────────────────────────────────────────────────────────
  const resolveWidths = (cols: PdfColumn[]) => {
    const fixed = cols.reduce((a, c) => a + (c.width ?? 0), 0);
    const flexCount = cols.filter((c) => !c.width).length;
    const flexW = flexCount ? (CONTENT_W - fixed) / flexCount : 0;
    return cols.map((c) => c.width ?? flexW);
  };

  const drawStatusBadge = (text: string, x: number, cellY: number, cellH: number) => {
    const color = STATUS_COLORS[text] ?? SLATE_LIGHT;
    const badgeW = doc.getTextWidth(text) + 12;
    const badgeH = 12;
    const badgeY = cellY + (cellH - badgeH) / 2;

    // Light background
    setFill([
      Math.min(255, color[0] + 200),
      Math.min(255, color[1] + 200),
      Math.min(255, color[2] + 200),
    ]);
    doc.roundedRect(x, badgeY, badgeW, badgeH, 3, 3, 'F');

    // Text
    setText(color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(text, x + 6, badgeY + 8.5);
  };

  const drawRow = (
    cols: PdfColumn[], widths: number[], row: Record<string, string | number>,
    rowOpts: { bold?: boolean; fill?: [number, number, number]; height: number },
  ) => {
    if (rowOpts.fill) {
      setFill(rowOpts.fill);
      doc.rect(M, y, CONTENT_W, rowOpts.height, 'F');
    }

    let x = M;
    cols.forEach((c, i) => {
      const w = widths[i];
      const text = String(row[c.key] ?? '');

      if (c.isStatus) {
        drawStatusBadge(text, x + 4, y, rowOpts.height);
      } else {
        setText(rowOpts.bold ? NAVY : [51, 65, 85]);
        doc.setFont('helvetica', rowOpts.bold ? 'bold' : 'normal');
        doc.setFontSize(8.5);
        const clipped = doc.splitTextToSize(text, w - 10)[0] ?? '';
        const align = c.align ?? 'left';
        const tx = align === 'right' ? x + w - 5 : align === 'center' ? x + w / 2 : x + 5;
        doc.text(clipped, tx, y + rowOpts.height - 6, { align });
      }
      x += w;
    });

    // Row bottom border
    setDraw(BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, y + rowOpts.height, M + CONTENT_W, y + rowOpts.height);

    y += rowOpts.height;
  };

  const drawTableHeader = (cols: PdfColumn[], widths: number[], rowH: number) => {
    // Header background
    setFill(NAVY);
    doc.rect(M, y, CONTENT_W, rowH, 'F');

    // Header text
    setText(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let hx = M;
    cols.forEach((c, i) => {
      const w = widths[i];
      const align = c.align ?? 'left';
      const tx = align === 'right' ? hx + w - 5 : align === 'center' ? hx + w / 2 : hx + 5;
      doc.text(c.header.toUpperCase(), tx, y + rowH - 6, { align });
      hx += w;
    });
    y += rowH;
  };

  opts.tables.forEach((table) => {
    const widths = resolveWidths(table.columns);
    const rowH = 20;

    // Section title with accent
    ensure((table.title ? 28 : 0) + rowH * 2 + 8);

    if (table.title) {
      y += 6;
      // Accent dot
      setFill(BLUE);
      doc.circle(M + 4, y + 1, 3, 'F');
      // Title text
      setText(NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(table.title, M + 14, y + 5);
      y += 20;
    }

    drawTableHeader(table.columns, widths, rowH);

    table.rows.forEach((row, idx) => {
      if (y + rowH > PAGE.h - 52) {
        drawFooter();
        doc.addPage();
        drawHeader();
        // Repeat table title on new page
        if (table.title) {
          setText(NAVY);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(`${table.title} (continued)`, M, y + 4);
          y += 16;
        }
        drawTableHeader(table.columns, widths, rowH);
      }
      drawRow(table.columns, widths, row, {
        height: rowH,
        fill: idx % 2 === 1 ? ZEBRA : undefined,
      });
    });

    if (!table.rows.length) {
      ensure(rowH);
      setFill(ZEBRA);
      doc.rect(M, y, CONTENT_W, rowH, 'F');
      setText(SLATE_LIGHT);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.text('No records in this range.', M + CONTENT_W / 2, y + rowH - 6, { align: 'center' });
      y += rowH;
    }

    // Footer row
    if (table.footer) {
      ensure(rowH + 4);
      setDraw(NAVY);
      doc.setLineWidth(1);
      doc.line(M, y, M + CONTENT_W, y);
      drawRow(table.columns, widths, table.footer, {
        height: rowH, bold: true, fill: LIGHT,
      });
    }
    y += 20;
  });

  drawFooter();
  doc.save(opts.fileName);
}