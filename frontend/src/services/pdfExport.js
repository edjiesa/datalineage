import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export async function exportLineageToPdf({
  database = 'PostgreSQL',
  mode = 'fdw',
  granularity = 'object',
  nodeCount = 0,
}) {
  const flowElement = document.querySelector('.react-flow');
  if (!flowElement) {
    throw new Error('Canvas visualizer tidak ditemukan');
  }

  // 1. Capture React Flow canvas as high-res PNG
  const dataUrl = await toPng(flowElement, {
    backgroundColor: '#020617', // slate-950 background
    quality: 1.0,
    pixelRatio: 2, // High resolution for crystal clear text
    filter: (node) => {
      // Exclude controls & minimap from PDF export for a clean report
      if (
        node.classList?.contains('react-flow__controls') ||
        node.classList?.contains('react-flow__minimap') ||
        node.classList?.contains('react-flow__attribution')
      ) {
        return false;
      }
      return true;
    },
  });

  // 2. Initialize Landscape A4 PDF
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // 3. Dark Theme Background
  pdf.setFillColor(2, 6, 23); // #020617
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // 4. Header Section
  pdf.setTextColor(6, 182, 212); // #06b6d4 cyan
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('PostgreSQL Data Lineage & FDW Visualizer Report', 14, 15);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184); // #94a3b8 slate-400
  const dateStr = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  pdf.text(`Database: ${database}  |  Mode: ${mode.toUpperCase()}  |  Granularity: ${granularity.toUpperCase()}  |  Nodes: ${nodeCount}  |  Generated: ${dateStr}`, 14, 21);

  // Divider line
  pdf.setDrawColor(30, 41, 59); // slate-800
  pdf.setLineWidth(0.5);
  pdf.line(14, 24, pageWidth - 14, 24);

  // 5. Calculate Image aspect ratio to fit the page cleanly
  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve) => (img.onload = resolve));

  const contentWidth = pageWidth - 28;
  const contentHeight = pageHeight - 34;

  const imgRatio = img.width / img.height;
  const contentRatio = contentWidth / contentHeight;

  let renderWidth = contentWidth;
  let renderHeight = contentHeight;
  let offsetX = 14;
  let offsetY = 27;

  if (imgRatio > contentRatio) {
    renderHeight = contentWidth / imgRatio;
    offsetY = 27 + (contentHeight - renderHeight) / 2;
  } else {
    renderWidth = contentHeight * imgRatio;
    offsetX = 14 + (contentWidth - renderWidth) / 2;
  }

  // Draw Graph Image
  pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, renderWidth, renderHeight);

  // 6. Save PDF
  const filename = `data-lineage-${database}-${mode}-${Date.now()}.pdf`;
  pdf.save(filename);
}
