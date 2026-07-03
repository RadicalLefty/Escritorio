import { jsPDF } from 'jspdf';
import { Scene, ScriptBlock } from '../types';

export function exportScreenplayToPDF(
  projectName: string,
  scenes: Scene[],
  scriptBlocks: ScriptBlock[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const PAGE_WIDTH = 612;  // 8.5" x 72pt
  const PAGE_HEIGHT = 792; // 11" x 72pt
  const TOP_MARGIN = 72;   // 1"
  const BOTTOM_MARGIN = 720; // 10" (leaving 1" at bottom)
  const LINE_HEIGHT = 16;  // Standard 12pt font line spacing

  // Setup margins & widths
  const LEFT_MARGIN_STANDARD = 108; // 1.5" left margin for screenplay format
  const RIGHT_MARGIN_STANDARD = 72;  // 1" right margin
  const MAX_WIDTH_ACTION = PAGE_WIDTH - LEFT_MARGIN_STANDARD - RIGHT_MARGIN_STANDARD; // 432pt

  // Offsets for standard screenplay elements (relative to LEFT edge of page, i.e., in absolute pts)
  const X_SCENE_HEADING = 108;
  const X_ACTION = 108;
  const X_CHARACTER = 266;       // Centered feel: ~3.7 inches
  const X_PARENTHTICAL = 216;    // ~3.0 inches. Max width: 180pt
  const X_DIALOGUE = 180;        // ~2.5 inches. Max width: 216pt
  const X_CAMERA = 108;
  const X_TRANSITION = 400;      // Right aligned: offset from left is around 400pt

  const WIDTH_PARENTHTICAL = 180;
  const WIDTH_DIALOGUE = 216;

  let y = TOP_MARGIN;
  let pageCount = 1;

  // Add a helper to write text and automatically handle page breaks
  const writeLines = (lines: string[], xOffset: number, width: number, isUppercase = false) => {
    lines.forEach((line) => {
      if (y + LINE_HEIGHT > BOTTOM_MARGIN) {
        doc.addPage();
        pageCount++;
        y = TOP_MARGIN;
        
        // Print page number at top right of subsequent pages
        doc.setFont('courier', 'normal');
        doc.setFontSize(11);
        doc.text(`${pageCount}.`, PAGE_WIDTH - 72, 45, { align: 'right' });
      }

      const textToWrite = isUppercase ? line.toUpperCase() : line;
      doc.text(textToWrite, xOffset, y);
      y += LINE_HEIGHT;
    });
  };

  // 1. Cover Page or Simple Header
  // Clean, minimalist industry standards cover page
  doc.setFont('courier', 'bold');
  doc.setFontSize(22);
  doc.text(projectName.toUpperCase(), PAGE_WIDTH / 2, 250, { align: 'center' });
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(11);
  doc.text('Written by', PAGE_WIDTH / 2, 290, { align: 'center' });
  doc.text('CoScript Studio Coworkers', PAGE_WIDTH / 2, 310, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Exported: ${new Date().toLocaleDateString()}`, PAGE_WIDTH / 2, 550, { align: 'center' });
  doc.text('Local & Encrypted Copy', PAGE_WIDTH / 2, 570, { align: 'center' });

  // Start script on Page 2
  doc.addPage();
  pageCount = 1; // Page 1 of screenplay content is technically page 2 of document
  y = TOP_MARGIN;

  // Sort scenes by order
  const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);

  sortedScenes.forEach((scene) => {
    if (scene.isAct) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(13);
      y += 24;
      const actTitle = scene.title.toUpperCase();
      doc.text(actTitle, PAGE_WIDTH / 2, y, { align: 'center' });
      y += 20;
      return;
    }

    // Get blocks belonging to this scene
    const sceneBlocks = scriptBlocks.filter((b) => b.sceneId === scene.id);
    
    // Skip empty scenes unless it's the only scene
    if (sceneBlocks.length === 0 && sortedScenes.filter(s => !s.isAct).length > 1) return;

    sceneBlocks.forEach((block) => {
      const text = block.text.trim();
      if (!text) return; // Skip empty blocks

      doc.setFont('courier', 'normal');
      doc.setFontSize(11); // 11-12pt Courier is the industry standard

      switch (block.type) {
        case 'scene-heading': {
          doc.setFont('courier', 'bold');
          y += 8; // Double-space before scene headings
          const wrapped = doc.splitTextToSize(text, MAX_WIDTH_ACTION);
          writeLines(wrapped, X_SCENE_HEADING, MAX_WIDTH_ACTION, true);
          y += 8; // Spacer
          break;
        }

        case 'action': {
          const wrapped = doc.splitTextToSize(text, MAX_WIDTH_ACTION);
          writeLines(wrapped, X_ACTION, MAX_WIDTH_ACTION);
          y += 6; // Compact space after paragraph
          break;
        }

        case 'character': {
          doc.setFont('courier', 'bold');
          y += 4; // Add a small break before character
          const wrapped = doc.splitTextToSize(text, 200);
          writeLines(wrapped, X_CHARACTER, 200, true);
          break;
        }

        case 'parenthetical': {
          const formattedText = text.startsWith('(') && text.endsWith(')') ? text : `(${text})`;
          const wrapped = doc.splitTextToSize(formattedText, WIDTH_PARENTHTICAL);
          writeLines(wrapped, X_PARENTHTICAL, WIDTH_PARENTHTICAL);
          break;
        }

        case 'dialogue': {
          const wrapped = doc.splitTextToSize(text, WIDTH_DIALOGUE);
          writeLines(wrapped, X_DIALOGUE, WIDTH_DIALOGUE);
          y += 6; // Add spacer after block
          break;
        }

        case 'camera': {
          doc.setFont('courier', 'bold');
          const wrapped = doc.splitTextToSize(text, MAX_WIDTH_ACTION);
          writeLines(wrapped, X_CAMERA, MAX_WIDTH_ACTION, true);
          y += 4;
          break;
        }

        case 'transition': {
          doc.setFont('courier', 'bold');
          const wrapped = doc.splitTextToSize(text, 150);
          writeLines(wrapped, X_TRANSITION, 150, true);
          y += 10;
          break;
        }

        default:
          break;
      }
    });
  });

  // Save the PDF
  const safeTitle = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safeTitle}_screenplay.pdf`);
}
