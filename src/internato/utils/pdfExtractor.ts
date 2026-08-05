import * as pdfjsLib from 'pdfjs-dist';

// Dynamically set workerSrc matching pdfjsLib.version to avoid API/Worker version mismatches
if (typeof window !== 'undefined') {
  const version = pdfjsLib.version || '6.2.108';
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
}

/**
 * Extracts all readable text from a PDF file in the browser.
 * Extremely fast and lightweight.
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (progressText: string, percent: number) => void
): Promise<string> {
  try {
    if (onProgress) onProgress("Carregando documento PDF...", 5);
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    let fullText = '';
    const totalPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        if (onProgress) {
          const percent = Math.min(95, Math.round(5 + (pageNum / totalPages) * 60)); // Page extraction covers up to 65% of overall process
          onProgress(`Lendo páginas do PDF: ${pageNum} de ${totalPages}...`, percent);
        }
        
        // Yield execution to the browser's event loop to prevent main-thread freezing/lagging
        await new Promise(resolve => setTimeout(resolve, 1));

        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageItems = textContent.items.map((item: any) => item.str || '').filter(Boolean);
        const pageString = pageItems.join(' ');
        if (pageString.trim().length > 0) {
          fullText += `\n--- SEMANA/PÁGINA ${pageNum} ---\n${pageString}`;
        }
      } catch (pageErr) {
        console.warn(`Erro ao extrair página ${pageNum} do PDF:`, pageErr);
      }
    }

    if (onProgress) onProgress("Processamento de texto concluído.", 70);
    return fullText.trim();
  } catch (err) {
    console.error("Falha na extração de texto do PDF via pdfjs-dist:", err);
    return "";
  }
}
