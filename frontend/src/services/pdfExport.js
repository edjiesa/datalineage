import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getRectOfNodes, getTransformForBounds } from 'reactflow';

export async function exportLineageToPdf({
  database = 'PostgreSQL',
  mode = 'fdw',
  granularity = 'object',
  nodes = [],
}) {
  const viewportElement = document.querySelector('.react-flow__viewport');
  if (!viewportElement) {
    throw new Error('Canvas visualizer tidak ditemukan di halaman');
  }

  // 1. Collect nodes to measure full diagram bounds
  let activeNodes = nodes;
  if (!activeNodes || activeNodes.length === 0) {
    const domNodes = document.querySelectorAll('.react-flow__node');
    if (domNodes.length > 0) {
      activeNodes = Array.from(domNodes).map((el, i) => ({
        id: `node-${i}`,
        position: { x: el.offsetLeft || 0, y: el.offsetTop || 0 },
        width: el.offsetWidth || 320,
        height: el.offsetHeight || 160,
      }));
    }
  }

  if (!activeNodes || activeNodes.length === 0) {
    throw new Error('Tidak ada data diagram yang ditemukan untuk diekspor');
  }

  // Ensure each node has width and height for getRectOfNodes
  const safeNodes = activeNodes.map((n) => ({
    ...n,
    width: n.width || 320,
    height: n.height || (granularity === 'column' ? 240 : 150),
  }));

  // 2. Calculate the exact bounding box of ALL nodes across the whole canvas
  const nodesBounds = getRectOfNodes(safeNodes);
  
  // Padding around all diagram nodes
  const padding = 70;
  const imageWidth = Math.max(Math.ceil(nodesBounds.width + padding * 2), 1200);
  const imageHeight = Math.max(Math.ceil(nodesBounds.height + padding * 2), 700);

  // 3. Compute the viewport transform to encompass the whole diagram perfectly
  const transform = getTransformForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.1,
    2.0
  );

  // 4. Capture .react-flow__viewport at ultra-high resolution (2.5x pixel ratio)
  // This guarantees zero blurriness and zero cutting off!
  const dataUrl = await toPng(viewportElement, {
    backgroundColor: '#020617', // slate-950
    width: imageWidth,
    height: imageHeight,
    pixelRatio: 2.5, // Razor sharp retina clarity
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
    },
    filter: (domNode) => {
      // Exclude controls & minimap from PDF export
      if (
        domNode.classList?.contains('react-flow__controls') ||
        domNode.classList?.contains('react-flow__minimap') ||
        domNode.classList?.contains('react-flow__attribution')
      ) {
        return false;
      }
      return true;
    },
  });

  // 5. Create High-Resolution PDF scaled to the true proportions of the diagram
  // Convert px to mm (1 px ≈ 0.264583 mm)
  const headerHeightMm = 28;
  const contentWidthMm = Math.max(imageWidth * 0.264583, 297);
  const contentHeightMm = Math.max(imageHeight * 0.264583, 210);
  const pageHeightMm = contentHeightMm + headerHeightMm;

  const pdf = new jsPDF({
    orientation: contentWidthMm >= pageHeightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [contentWidthMm, pageHeightMm],
    compress: true,
  });

  // Dark Theme Background
  pdf.setFillColor(2, 6, 23); // #020617
  pdf.rect(0, 0, contentWidthMm, pageHeightMm, 'F');

  // Header Title
  pdf.setTextColor(6, 182, 212); // #06b6d4 cyan
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('PostgreSQL Data Lineage & FDW Visualizer Report', 14, 13);

  // Header Metadata
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184); // #94a3b8 slate-400
  const dateStr = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  pdf.text(
    `Database: ${database}   |   Mode: ${mode.toUpperCase()}   |   Granularity: ${granularity.toUpperCase()}   |   Total Nodes: ${safeNodes.length}   |   Generated: ${dateStr}`,
    14,
    19
  );

  // Divider line
  pdf.setDrawColor(30, 41, 59); // slate-800
  pdf.setLineWidth(0.5);
  pdf.line(14, 23, contentWidthMm - 14, 23);

  // Draw High-Res Canvas Image without downsampling
  pdf.addImage(dataUrl, 'PNG', 0, headerHeightMm, contentWidthMm, contentHeightMm);

  // Save PDF
  const filename = `data-lineage-${database}-${mode}-${Date.now()}.pdf`;
  pdf.save(filename);
}
