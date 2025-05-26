import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export interface PDFExportOptions {
  filename?: string;
  scale?: number;
  margin?: number;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  backgroundColor?: string;
}

export interface PDFExportResult {
  success: boolean;
  error?: string;
}

export async function exportElementToPDF(
  element: HTMLElement,
  options: PDFExportOptions = {}
): Promise<PDFExportResult> {
  try {
    const {
      filename = 'export.pdf',
      scale = 2,
      margin = 20,
      orientation = 'portrait',
      format = 'a4',
      backgroundColor = '#ffffff'
    } = options;

    // Wait for any dynamic content to render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create canvas from element
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      width: element.offsetWidth,
      height: element.offsetHeight,
      backgroundColor,
      removeContainer: true,
      foreignObjectRendering: true
    });

    // Create PDF
    const pdf = new jsPDF(orientation, 'pt', format);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate image dimensions with margins
    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Add first page
    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, Math.min(imgHeight, pageHeight - (margin * 2)));
    
    // Handle multi-page content
    if (imgHeight > pageHeight - (margin * 2)) {
      let remainingHeight = imgHeight - (pageHeight - (margin * 2));
      let yOffset = -(pageHeight - (margin * 2));
      
      while (remainingHeight > 0) {
        pdf.addPage();
        const currentPageHeight = Math.min(remainingHeight, pageHeight - (margin * 2));
        pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight);
        remainingHeight -= currentPageHeight;
        yOffset -= pageHeight;
      }
    }
    
    // Save the PDF
    pdf.save(filename);
    
    return { success: true };
  } catch (error) {
    console.error('PDF export failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
} 