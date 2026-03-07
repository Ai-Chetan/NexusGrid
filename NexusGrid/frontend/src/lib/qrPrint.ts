import { safeFileName } from '@/lib/qr';
import { jsPDF } from 'jspdf';

export interface QrPrintEntry {
  roomName: string;
  hostName: string;
  uniqueCode: string;
  qrDataUrl: string;
}

export async function downloadQrPrintSheet(options: { locationLine: string; fileNameBase: string; entries: QrPrintEntry[] }) {
  const { locationLine, fileNameBase, entries } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const topHeaderHeight = 12;
  const columns = 2;
  const rows = 3;
  const colGap = 6;
  const rowGap = 6;
  const cardWidth = (pageWidth - margin * 2 - colGap) / columns;
  const cardHeight = (pageHeight - margin * 2 - topHeaderHeight - rowGap * (rows - 1)) / rows;

  let pageIndex = 0;

  const drawPageHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    const prettyLocation = locationLine.replace(/\s*->\s*/g, '  •  ');
    doc.text(prettyLocation, pageWidth / 2, margin + 6, { align: 'center' });
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(margin, margin + 9, pageWidth - margin, margin + 9);
  };

  drawPageHeader();

  for (let i = 0; i < entries.length; i++) {
    const indexInPage = i - pageIndex * (rows * columns);
    const row = Math.floor(indexInPage / columns);
    const col = indexInPage % columns;

    let x = margin + col * (cardWidth + colGap);
    let y = margin + topHeaderHeight + row * (cardHeight + rowGap);

    if (y + cardHeight > pageHeight - margin) {
      doc.addPage();
      pageIndex += 1;
      drawPageHeader();
      const resetIndexInPage = i - pageIndex * (rows * columns);
      const resetRow = Math.floor(resetIndexInPage / columns);
      const resetCol = resetIndexInPage % columns;
      x = margin + resetCol * (cardWidth + colGap);
      y = margin + topHeaderHeight + resetRow * (cardHeight + rowGap);
    }

    const entry = entries[i];

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    const roomLines = doc.splitTextToSize(entry.roomName, cardWidth - 10);
    doc.text(roomLines, x + cardWidth / 2, y + 6, { align: 'center', baseline: 'top' });

    const qrSize = Math.min(cardWidth - 18, cardHeight - 36, 48);
    const qrX = x + (cardWidth - qrSize) / 2;
    const qrY = y + 18;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 2, 2, 'FD');
    doc.addImage(entry.qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const hostLines = doc.splitTextToSize(entry.hostName, cardWidth - 10);
    doc.text(hostLines, x + cardWidth / 2, qrY + qrSize + 5, { align: 'center', baseline: 'top' });
  }

  doc.save(`${safeFileName(fileNameBase)}-qr-print.pdf`);
}
