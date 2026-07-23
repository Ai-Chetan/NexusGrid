import { jsPDF } from 'jspdf';
import type { ReportsDetailData } from '@/types';

// ─── Brand palette ────────────────────────────────────────────────────────────
const NAVY: [number, number, number] = [15, 23, 42];
const BLUE: [number, number, number] = [37, 99, 235];
const BLUE_LIGHT: [number, number, number] = [59, 130, 246];
const SLATE: [number, number, number] = [71, 85, 105];
const SLATE_LIGHT: [number, number, number] = [148, 163, 184];
const LIGHT: [number, number, number] = [241, 245, 249];
const BORDER: [number, number, number] = [226, 232, 240];
const WHITE: [number, number, number] = [255, 255, 255];
const EMERALD: [number, number, number] = [16, 185, 129];
const RED: [number, number, number] = [239, 68, 68];
const AMBER: [number, number, number] = [245, 158, 11];
const VIOLET: [number, number, number] = [139, 92, 246];
const CYAN: [number, number, number] = [6, 182, 212];

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
};

const STAT_COLORS: Record<string, [number, number, number]> = {
  blue: BLUE,
  emerald: EMERALD,
  red: RED,
  amber: AMBER,
  violet: VIOLET,
  cyan: CYAN,
  slate: SLATE,
};

const PAGE = { w: 595.28, h: 841.89 };
const M = 42;
const CONTENT_W = PAGE.w - M * 2;

export interface HierarchicalPdfOptions {
  title: string;
  subtitle?: string;
  meta?: string[];
  stats?: { label: string; value: string; color?: string }[];
  data: ReportsDetailData;
  fileName: string;
}

interface DeviceNode {
  host_name: string;
  status: string;
  faults: {
    fault_id: number;
    date: string;
    type: string;
    status: string;
    description: string;
    opened_by: string;
    closed_by: string;
  }[];
  resources: {
    resource_id: number;
    date: string;
    name: string;
    status: string;
    description: string;
    opened_by: string;
    closed_by: string;
  }[];
}

interface LabNode {
  name: string;
  devices: DeviceNode[];
}

interface FloorNode {
  name: string;
  labs: LabNode[];
}

interface BuildingNode {
  name: string;
  floors: FloorNode[];
}

export function generateHierarchicalPdfReport(opts: HierarchicalPdfOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  let y = 0;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  // ── Build hierarchical tree ──────────────────────────────────────────────
  const buildTree = (): BuildingNode[] => {
    const buildingMap = new Map<string, BuildingNode>();

    // Group systems by building > floor > lab
    for (const sys of opts.data.systems) {
      const bName = sys.building_name || 'Unassigned';
      const fName = sys.floor_name || 'Unknown Floor';
      const lName = sys.lab_name || 'Unknown Lab';

      if (!buildingMap.has(bName)) {
        buildingMap.set(bName, { name: bName, floors: [] });
      }
      const building = buildingMap.get(bName)!;

      let floor = building.floors.find(f => f.name === fName);
      if (!floor) {
        floor = { name: fName, labs: [] };
        building.floors.push(floor);
      }

      let lab = floor.labs.find(l => l.name === lName);
      if (!lab) {
        lab = { name: lName, devices: [] };
        floor.labs.push(lab);
      }

      // Find faults and resources for this device
      const deviceFaults = opts.data.faults
        .filter(f => f.system_name === sys.host_name)
        .map(f => ({
          fault_id: f.fault_id,
          date: f.reported_at.slice(0, 10),
          type: f.fault_type,
          status: f.status,
          description: f.description,
          opened_by: f.reported_by,
          closed_by: f.resolved_by || '—',
        }));

      const deviceResources = opts.data.resources
        .filter(r => r.system_name === sys.host_name)
        .map(r => ({
          resource_id: r.resource_id,
          date: r.requested_at.slice(0, 10),
          name: r.resource_name,
          status: r.status,
          description: r.description,
          opened_by: r.requested_by,
          closed_by: r.provided_by || '—',
        }));

      lab.devices.push({
        host_name: sys.host_name,
        status: sys.status,
        faults: deviceFaults,
        resources: deviceResources,
      });
    }

    return [...buildingMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  };

  const tree = buildTree();

  // ── Header / Footer ──────────────────────────────────────────────────────
  const drawHeader = () => {
    setFill(NAVY);
    doc.rect(0, 0, PAGE.w, 72, 'F');
    setFill(BLUE);
    doc.rect(0, 72, PAGE.w * 0.6, 3, 'F');
    setFill(BLUE_LIGHT);
    doc.rect(PAGE.w * 0.6, 72, PAGE.w * 0.4, 3, 'F');

    setText(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('NexusGrid', M, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(SLATE_LIGHT);
    doc.text('Lab Infrastructure Management System', M, 48);

    setText(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(opts.title, PAGE.w - M, 30, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(SLATE_LIGHT);
    doc.text(`Generated: ${generatedAt}`, PAGE.w - M, 46, { align: 'right' });

    y = 96;
  };

  const drawFooter = () => {
    const page = doc.getNumberOfPages();
    setDraw(BORDER);
    doc.setLineWidth(0.5);
    doc.line(M, PAGE.h - 36, PAGE.w - M, PAGE.h - 36);

    setText(SLATE_LIGHT);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('NexusGrid — Confidential & Proprietary', M, PAGE.h - 22);
    doc.text(`Page ${page}`, PAGE.w - M, PAGE.h - 22, { align: 'right' });
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

  (opts.meta ?? []).forEach((line) => {
    setText(SLATE_LIGHT);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
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

      setFill(LIGHT);
      setDraw(BORDER);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, cardW, cardH, 6, 6, 'FD');

      setFill(accentColor);
      doc.roundedRect(x, y, cardW, 4, 6, 6, 'F');
      doc.rect(x, y + 2, cardW, 2, 'F');

      setText(accentColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(String(s.value), x + cardW / 2, y + 30, { align: 'center' });

      setText(SLATE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(s.label.toUpperCase(), x + cardW / 2, y + 44, { align: 'center' });
    });
    y += cardH + 24;
  }

  // ── Hierarchical content ─────────────────────────────────────────────────
  const drawStatusBadge = (text: string, x: number, badgeY: number) => {
    const color = STATUS_COLORS[text] ?? SLATE_LIGHT;
    const badgeW = doc.getTextWidth(text) + 12;
    const badgeH = 13;

    setFill([
      Math.min(255, color[0] + 200),
      Math.min(255, color[1] + 200),
      Math.min(255, color[2] + 200),
    ]);
    doc.roundedRect(x, badgeY, badgeW, badgeH, 3, 3, 'F');

    setText(color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(text, x + 6, badgeY + 9);
    return badgeW;
  };

  for (const building of tree) {
    ensure(30);

    // Building header
    setFill(NAVY);
    doc.rect(M, y, CONTENT_W, 22, 'F');
    setText(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Building: ${building.name}`, M + 8, y + 15);
    y += 28;

    for (const floor of building.floors) {
      ensure(24);

      // Floor header
      setFill([51, 65, 85]);
      doc.rect(M + 10, y, CONTENT_W - 10, 18, 'F');
      setText(WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`Floor: ${floor.name}`, M + 18, y + 13);
      y += 24;

      for (const lab of floor.labs) {
        ensure(22);

        // Lab header
        setFill(LIGHT);
        setDraw(BORDER);
        doc.setLineWidth(0.5);
        doc.roundedRect(M + 20, y, CONTENT_W - 20, 16, 3, 3, 'FD');
        setText(NAVY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`Lab: ${lab.name}`, M + 28, y + 11);
        y += 22;

        for (const device of lab.devices) {
          ensure(20);

          // Device row
          setDraw(BORDER);
          doc.setLineWidth(0.3);
          doc.line(M + 30, y + 14, M + CONTENT_W, y + 14);

          setText([51, 65, 85]);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.text(device.host_name, M + 34, y + 10);

          // Status badge
          const statusX = M + 34 + doc.getTextWidth(device.host_name) + 10;
          drawStatusBadge(device.status, statusX, y + 2);

          y += 18;

          // Fault history
          if (device.faults.length > 0) {
            ensure(14);
            setText(RED);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(`Fault History (${device.faults.length}):`, M + 44, y + 6);
            y += 12;

            for (const fault of device.faults) {
              ensure(24);
              setText(SLATE);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);

              const faultLine = `#${fault.fault_id} | ${fault.date} | ${fault.type} | Status: ${fault.status} | Opened: ${fault.opened_by} | Closed: ${fault.closed_by}`;
              const lines = doc.splitTextToSize(faultLine, CONTENT_W - 60);
              doc.text(lines[0] ?? '', M + 50, y + 6);
              y += 10;

              if (fault.description) {
                const descLines = doc.splitTextToSize(`"${fault.description}"`, CONTENT_W - 60);
                setText(SLATE_LIGHT);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(6.5);
                doc.text(descLines[0] ?? '', M + 50, y + 5);
                y += 9;
              }
              y += 3;
            }
          }

          // Resource request history
          if (device.resources.length > 0) {
            ensure(14);
            setText(BLUE);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(`Resource Requests (${device.resources.length}):`, M + 44, y + 6);
            y += 12;

            for (const res of device.resources) {
              ensure(24);
              setText(SLATE);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);

              const resLine = `#${res.resource_id} | ${res.date} | ${res.name} | Status: ${res.status} | Opened: ${res.opened_by} | Closed: ${res.closed_by}`;
              const lines = doc.splitTextToSize(resLine, CONTENT_W - 60);
              doc.text(lines[0] ?? '', M + 50, y + 6);
              y += 10;

              if (res.description) {
                const descLines = doc.splitTextToSize(`"${res.description}"`, CONTENT_W - 60);
                setText(SLATE_LIGHT);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(6.5);
                doc.text(descLines[0] ?? '', M + 50, y + 5);
                y += 9;
              }
              y += 3;
            }
          }

          y += 4;
        }
        y += 6;
      }
      y += 4;
    }
    y += 8;
  }

  // If no data
  if (tree.length === 0) {
    ensure(30);
    setText(SLATE_LIGHT);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('No device data available for the selected scope.', M + CONTENT_W / 2, y + 10, { align: 'center' });
    y += 30;
  }

  drawFooter();
  doc.save(opts.fileName);
}
