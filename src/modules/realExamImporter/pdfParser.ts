/**
 * Parser de PDF e renderizador visual de páginas - MedRevise
 * Responsável por:
 * 1. Extração segura de texto página a página via pdfjs-dist.
 * 2. Cálculo do SHA-256 do arquivo original para rastreabilidade estrita.
 * 3. Renderização de canvas da página original para conferência humana.
 */

import * as pdfjsLib from 'pdfjs-dist';
import { computeSha256 } from './examExtractor';

// Configuração do Worker para pdfjs-dist no browser
if (typeof window !== 'undefined') {
  const version = pdfjsLib.version || '6.2.108';
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
}

export interface ParsedPdfDocument {
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  numPages: number;
  pages: { pageNumber: number; text: string }[];
  pdfDocProxy: any; // Instância de PDFDocumentProxy do pdfjs-dist para renderização visual
}

/**
 * Lê um arquivo PDF do navegador e extrai seu conteúdo página por página
 */
export async function parsePdfFile(
  file: File,
  onProgress?: (stage: string, percent: number) => void
): Promise<ParsedPdfDocument> {
  const arrayBuffer = await file.arrayBuffer();
  
  if (onProgress) onProgress('Calculando SHA-256 do arquivo original...', 5);
  const fileSha256 = await computeSha256(arrayBuffer);

  if (onProgress) onProgress('Carregando estrutura do PDF...', 15);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const pages: { pageNumber: number; text: string }[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      const pct = Math.min(90, Math.round(15 + (pageNum / numPages) * 75));
      onProgress(`Extraindo texto da página ${pageNum} de ${numPages}...`, pct);
    }

    try {
      // Yield ao loop de eventos do navegador para evitar congelamento de UI
      await new Promise(resolve => setTimeout(resolve, 0));

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Ordena os itens em ordem de leitura natural (topo para base, esquerda para direita)
      const rawItems = (textContent.items as any[]).filter(i => i.str && i.str.trim() !== '');
      
      rawItems.sort((a, b) => {
        const yA = a.transform ? a.transform[5] : 0;
        const yB = b.transform ? b.transform[5] : 0;
        const xA = a.transform ? a.transform[4] : 0;
        const xB = b.transform ? b.transform[4] : 0;

        // Se a diferença vertical for maior que 4 pontos, ordena por Y decrescente (topo para baixo)
        if (Math.abs(yA - yB) > 4) {
          return yB - yA;
        }
        // Na mesma linha, ordena por X crescente (esquerda para direita)
        return xA - xB;
      });

      // Reconstrói o texto preservando quebras de linha aproximadas
      let lastY: number | null = null;
      let pageText = '';

      for (const item of rawItems) {
        // Se a posição vertical (transform[5]) mudou significativamente, insere quebra de linha
        const currentY = item.transform ? item.transform[5] : null;
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 6) {
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          pageText += ' ';
        }
        
        pageText += item.str;
        lastY = currentY;
      }

      pages.push({
        pageNumber: pageNum,
        text: pageText.trim(),
      });
    } catch (pageErr) {
      console.warn(`Erro ao extrair texto da página ${pageNum}:`, pageErr);
      pages.push({
        pageNumber: pageNum,
        text: `[Erro de leitura da página ${pageNum}]`,
      });
    }
  }

  if (onProgress) onProgress('Concluída extração do PDF.', 100);

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    fileSha256,
    numPages,
    pages,
    pdfDocProxy: pdf,
  };
}

/**
 * Renderiza uma página específica do PDF em um elemento HTML Canvas para visualização visual de alta fidelidade
 */
export async function renderPdfPageToCanvas(
  pdfDocProxy: any,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.3
): Promise<void> {
  if (!pdfDocProxy || !canvas) return;

  try {
    const page = await pdfDocProxy.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext).promise;
  } catch (err) {
    console.error(`Falha ao renderizar página ${pageNumber} do PDF no canvas:`, err);
  }
}
