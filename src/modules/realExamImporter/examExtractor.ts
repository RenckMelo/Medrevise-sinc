/**
 * Extrator e Validador Semântico de Provas Reais em PDF - MedRevise
 * 
 * Regras estritas:
 * 1. Não reescrever, resumir ou corrigir o texto de enunciados e alternativas.
 * 2. Associação de gabarito estritamente pelo número original da questão.
 * 3. Identificação do gabarito nas páginas finais e distinção de bibliografia/anexos.
 * 4. Validação automática de discrepâncias, conflitos de metadados e alertas de inconsistência.
 * 5. Identificação inicial como "EXTRACTED_FROM_DOCUMENT" (documental).
 * 6. Suporte a metadados mistos, cadernos multi-instituição e segmentação flexível de questões.
 */

import {
  ExtractedPageData,
  ExtractedGabaritoEntry,
  RealExamQuestionItem,
  ExtractedAlternative,
  ExamExtractionSummary,
  ExtractionResult,
  ValidationAlert,
  QuestionType,
  DetectedExamMetadata,
  MetadataEvidence,
  MetadataConflict,
  MetadataFieldState,
  ExtractedQuestionTag,
  ImageEvidenceType,
} from './types';
import { KNOWN_INSTITUTIONS, KNOWN_BANCAS } from './sourceCatalog';

// Helper de hash SHA-256 portátil (funciona no Browser e no Node.js sem importar 'crypto')
export async function computeSha256(input: string | ArrayBuffer): Promise<string> {
  const subtleCrypto = typeof globalThis !== 'undefined' && globalThis.crypto?.subtle ? globalThis.crypto.subtle : null;
  if (subtleCrypto) {
    const buffer = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    const hashBuffer = await subtleCrypto.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Fallback puro em JS sem importar módulos nativos do Node
    let hash = 0;
    const str = typeof input === 'string' ? input : new Uint8Array(input).toString();
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/**
 * Padrões de palavras-chave para identificar se uma página pertence ao Gabarito
 */
const GABARITO_KEYWORDS = [
  /GABARITO\s+OFICIAL/i,
  /GABARITO\s+DEFINITIVO/i,
  /GABARITO\s+PRELIMINAR/i,
  /\bFOLHA\s+DE\s+RESPOSTAS\b/i,
  /\bQUADRO\s+DE\s+RESPOSTAS\b/i,
  /\bTABELA\s+DE\s+RESPOSTAS\b/i,
  /\bCHAVE\s+DE\s+RESPOSTAS\b/i,
  /\bRESPOSTAS\s+DAS\s+QUEST[ÕO]ES\b/i,
  /\bGABARITO\b/i,
];

/**
 * Padrões de páginas de encerramento / outros conteúdos (não são questões e nem gabarito)
 */
const END_MATTER_KEYWORDS = [
  /REFER[ÊE]NCIAS\s+BIBLIOGR[ÁA]FICAS/i,
  /\bBIBLIOGRAFIA\b/i,
  /\bANEXO\s+[A-Z0-9]/i,
  /\bINSTRU[ÇC][ÕO]ES\s+AO\s+CANDIDATO\b/i,
  /\bFOLHA\s+DE\s+ROSTO\b/i,
  /\bTERMO\s+DE\s+HOMOLOGA[ÇC][ÃA]O\b/i,
];

/**
 * Pistas no enunciado de que há imagem/figura/tabela na questão
 * Refinado para evitar falso-positivo em especialidades como 'Radiologia e Diagnóstico por Imagem'
 */
interface ImageCueRule {
  name: string;
  regex: RegExp;
  negativeContext?: RegExp;
}

export const IMAGE_CUES_RULES: ImageCueRule[] = [
  { name: 'figura_numerada', regex: /\bfigura\s*\d+\b/i },
  { name: 'observe_figura', regex: /\b(?:observe|veja|conforme|analise|mostrad[oa]|apresentad[oa])\s+(?:a|o|na)?\s*figura\b/i },
  { name: 'figura_a_seguir', regex: /\bfigura\s+(?:abaixo|a\s+seguir|ao\s+lado|anexa)\b/i },
  { 
    name: 'imagem_referencia', 
    regex: /\b(?:observe|veja|conforme|analise|mostrad[oa]|apresentad[oa]|com\s+base\s+n[ao])\s+(?:a|o)?\s*imagem\b/i,
    negativeContext: /diagn[óo]stico\s+por\s+imagem|especialidade\s*[:\-]?\s*radiologia/i
  },
  { 
    name: 'imagem_a_seguir', 
    regex: /\bimagem\s+(?:abaixo|a\s+seguir|ao\s+lado|anexa|\d+)\b/i,
    negativeContext: /diagn[óo]stico\s+por\s+imagem/i
  },
  { 
    name: 'radiografia_exame', 
    regex: /\b(?:radiografia|radiografias|raio[\-\s]?x)\s+(?:apresentad[oa]|a\s+seguir|abaixo|mostrad[oa]|de\s+t[óo]rax|de\s+abdome|simples|contrastad[oa]|\d+)\b/i,
    negativeContext: /resid[êe]ncia\s+em\s+radiologia|servi[çc]o\s+de\s+radiologia/i
  },
  { 
    name: 'tomografia_exame', 
    regex: /\b(?:tomografia|tc|angiotomografia)\s+(?:computadorizada|apresentad[oa]|a\s+seguir|abaixo|mostrad[oa]|de\s+cr[âa]nio|de\s+t[óo]rax|de\s+abdome|\d+)\b/i 
  },
  { 
    name: 'ressonancia_exame', 
    regex: /\b(?:resson[âa]ncia|rnm|rm)\s+(?:magn[ée]tica|apresentad[oa]|a\s+seguir|abaixo|mostrad[oa]|\d+)\b/i 
  },
  { 
    name: 'eletrocardiograma_exame', 
    regex: /\b(?:eletrocardiograma|ecg|tra[çc]ado)\s+(?:abaixo|a\s+seguir|mostrad[oa]|apresentad[oa]|de\s+12\s+deriva[çc][õo]es|\d+)\b/i 
  },
  { 
    name: 'ultrassonografia_exame', 
    regex: /\b(?:ultrassonografia|ultrassom|ecografia|usg)\s+(?:apresentad[oa]|a\s+seguir|abaixo|mostrad[oa]|\d+)\b/i 
  },
  { name: 'fotografia_clinica', regex: /\bfoto(?:grafia)?\s+(?:abaixo|a\s+seguir|mostrad[oa]|apresentad[oa]|\d+)\b/i },
  { name: 'tabela_clinica', regex: /\btabela\s+(?:abaixo|a\s+seguir|ao\s+lado|\d+)\b/i },
  { name: 'grafico_clinico', regex: /\bgr[áa]fico\s+(?:abaixo|a\s+seguir|ao\s+lado|\d+)\b/i },
  { name: 'veja_o_tracado', regex: /\bveja\s+o\s+tra[çc]ado\b/i },
  { name: 'com_base_na_imagem', regex: /\bcom\s+base\s+na\s+imagem\b/i },
  { name: 'lamina_histopatologica', regex: /\bl[âa]mina\s+(?:abaixo|a\s+seguir|histopatol[óo]gica|\d+)\b/i },
  { name: 'corte_histopatologico', regex: /\b(?:corte|exame)\s+histopatol[óo]gic[oa]\s+(?:abaixo|a\s+seguir|mostrad[oa])\b/i },
];

/**
 * Classifica páginas entre Conteúdo de Prova, Gabarito e Elementos Finais (bibliografia/anexos)
 */
export function classifyPages(rawPages: { pageNumber: number; text: string }[]): ExtractedPageData[] {
  const total = rawPages.length;
  
  return rawPages.map((page) => {
    const text = page.text.trim();
    
    // Identificar gabarito: provável especialmente a partir de páginas finais ou se houver grade densa
    const isLateInDoc = total <= 2 ? true : page.pageNumber >= Math.floor(total * 0.4);
    
    let isGabaritoPage = false;
    let isEndMatter = false;
    const detectedKeywords: string[] = [];
    
    // Verifica palavras-chave de gabarito
    for (const kw of GABARITO_KEYWORDS) {
      if (kw.test(text)) {
        detectedKeywords.push(kw.source);
        if (isLateInDoc) {
          isGabaritoPage = true;
        }
      }
    }

    // Identificação de grade densa de respostas (ex: "1 A 2 B 3 C 4 D" ou "01. B  02. C")
    // Funciona mesmo se a página não tiver a palavra formal "GABARITO"
    const denseAnswerGridPattern = /(?:\b0?\d{1,3}\s*[\-\:\.\s]\s*[A-E]\b.*){4,}/i;
    const compactPairsCount = (text.match(/\b\d{1,3}\s*[\-\:\.]?\s*[A-E]\b/gi) || []).length;
    
    if ((denseAnswerGridPattern.test(text) || compactPairsCount >= 5) && isLateInDoc) {
      isGabaritoPage = true;
      detectedKeywords.push('DENSE_ANSWER_GRID');
    }

    // Verifica end matter (bibliografia, instruções finais)
    for (const em of END_MATTER_KEYWORDS) {
      if (em.test(text)) {
        detectedKeywords.push(em.source);
        isEndMatter = true;
      }
    }

    // Se for explicitamente gabarito, não é end matter
    if (isGabaritoPage) {
      isEndMatter = false;
    }

    return {
      pageNumber: page.pageNumber,
      text: page.text,
      charCount: text.length,
      isGabaritoPage,
      isEndMatter,
      detectedKeywords,
    };
  });
}

/**
 * Extrai as entradas do gabarito a partir das páginas classificadas como Gabarito.
 * Suporta formatos:
 * - Em tabela/coluna: "1 A", "01: B", "01 - C", "1. D"
 * - Compacto contínuo: "1 A 2 B 3 C 4 D", "1-A 2-B 3-C"
 * - Tabular com múltiplas colunas na mesma linha: "1 A   11 C   21 B"
 * - Questões anuladas ou alteradas: "1 ANULADA", "02 NULA", "3 *", "4 X", "5 RETIFICADA"
 * - Determina proveniência oficial: 'OFFICIAL_EXPLICIT' vs 'DOCUMENT_FOUND'
 */
export function extractGabaritoEntries(gabaritoPages: ExtractedPageData[]): ExtractedGabaritoEntry[] {
  const entries: ExtractedGabaritoEntry[] = [];
  const seenNumbers = new Set<number>();

  for (const page of gabaritoPages) {
    const isExplicitlyOfficial = /(?:GABARITO\s+OFICIAL|GABARITO\s+DEFINITIVO|GABARITO\s+PRELIMINAR\s+OFICIAL|BANCA\s+EXAMINADORA)/i.test(page.text);
    const provenance: 'OFFICIAL_EXPLICIT' | 'DOCUMENT_FOUND' = isExplicitlyOfficial ? 'OFFICIAL_EXPLICIT' : 'DOCUMENT_FOUND';

    const lines = page.text.split(/\r?\n/);
    
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // 1. Procurar por pares no formato: (Número) (Separador opcional) (Letra A-E ou Anulada)
      // Ex: "01 - A", "1: B", "1. C", "01 A", "Questão 1: D", "1 ANULADA", "10 NULA", "15 *", "1 A 2 B 3 C"
      const pairRegex = /(?:QUEST[ÃA]O\s*)?\b(0?\d{1,3})\s*(?:[\-\:\.\)]|\s)\s*([A-E]|ANULADA|NULA|CANCELADA|RETIFICADA|\*|X)\b/gi;
      let match: RegExpExecArray | null;

      while ((match = pairRegex.exec(line)) !== null) {
        const qNum = parseInt(match[1], 10);
        const rawAns = match[2].toUpperCase().trim();

        if (isNaN(qNum) || qNum <= 0 || qNum > 250) continue;

        const isAnulada = rawAns === 'ANULADA' || rawAns === 'NULA' || rawAns === 'CANCELADA' || rawAns === '*' || rawAns === 'X';
        const isRetificada = rawAns === 'RETIFICADA';
        const answerLetter = isAnulada ? null : rawAns;

        // Verifica duplicidade no gabarito
        const isDuplicate = seenNumbers.has(qNum);
        seenNumbers.add(qNum);

        entries.push({
          questionNumber: qNum,
          answerLetter: answerLetter && ['A', 'B', 'C', 'D', 'E'].includes(answerLetter) ? answerLetter : null,
          isAnulada,
          isRetificada,
          pageNumber: page.pageNumber,
          rawSnippet: line.length > 120 ? line.substring(0, 120) + '...' : line,
          source: 'EXTRACTED_FROM_DOCUMENT',
          provenance,
          notes: isDuplicate ? 'Atenção: Número duplicado no gabarito do documento.' : undefined,
        });
      }

      // 2. Procurar formato compacto ou tabular separado por múltiplos espaços ou tabs: "1  A  2  B  3  C"
      const tableTokens = line.split(/\s{2,}|\t+/);
      for (const token of tableTokens) {
        const tableMatch = token.trim().match(/^(\d{1,3})\s*[\-\:\.]?\s*([A-E])$/i);
        if (tableMatch) {
          const qNum = parseInt(tableMatch[1], 10);
          const ansLetter = tableMatch[2].toUpperCase();
          if (qNum > 0 && qNum <= 250 && !seenNumbers.has(qNum)) {
            seenNumbers.add(qNum);
            entries.push({
              questionNumber: qNum,
              answerLetter: ansLetter,
              isAnulada: false,
              isRetificada: false,
              pageNumber: page.pageNumber,
              rawSnippet: token.trim(),
              source: 'EXTRACTED_FROM_DOCUMENT',
              provenance,
            });
          }
        }
      }
    }
  }

  // Ordena por número de questão
  return entries.sort((a, b) => a.questionNumber - b.questionNumber);
}

/**
 * Padrão global para identificar início de uma nova questão no corpo do texto.
 * Suporta:
 * - Literal: "QUESTÃO 1", "QUESTÃO 01", "Questão 12:", "QUESTAO 1"
 * - Numeração pura: "1.", "01.", "1 -", "01 -", "1)", "01)"
 * - Prefixo com abreviação: "Q. 1", "Q1.", "ITEM 1."
 * - Tags precedendo o número: "[2024 - USP] 1.", "[CIRURGIA] QUESTÃO 1", "(ENARE 2023) QUESTÃO 1"
 */
const QUESTION_GLOBAL_REGEX = /(?:^|\n)\s*(?:\[([^\]\n]{2,80})\]\s*|\(([^)\n]{2,80})\)\s*)?(?:(?:QUEST[ÃA]O|QUESTAO|Q\.|ITEM)\s*(\d{1,3})[\.\-\:\)]?\s*|(\d{1,3})\s*[\.\-\:\)]\s+(?=[A-Z\u00C0-\u00DF\[\(]))/gi;

/**
 * Padrão para identificar alternativas padrão:
 * A), B), C), D), E)
 * (A), (B), (C), (D), (E)
 * a., b., c., d.
 * [A], [B], [C]
 */
const ALTERNATIVE_PREFIX_REGEX = /^\s*(?:\(?([A-Ea-e])\)|\[([A-Ea-e])\]|([A-Ea-e])[\.\-\:\)])\s+(.*)/;

/**
 * Padrão específico para alternativas sem pontuação (ex: "A Certo", "B Errado")
 * Restrito estritamente a palavras de julgamento ou termos concisos para não capturar "A paciente...", "A conduta..."
 */
const ALTERNATIVE_CERTO_ERRADO_REGEX = /^\s*([A-Ea-e])\s+(Certo|Errado|Verdadeiro|Falso|Correto|Incorreto)\s*$/i;

/**
 * Analisa e extrai estruturadamente a tag de uma questão
 */
function parseRawTag(rawTagStr?: string): ExtractedQuestionTag | undefined {
  if (!rawTagStr) return undefined;
  const rawTag = rawTagStr.trim();
  if (/^[A-E]$/i.test(rawTag)) return undefined;

  let ano: number | undefined;
  const anoMatch = rawTag.match(/\b(20[12]\d)\b/);
  if (anoMatch) ano = parseInt(anoMatch[1], 10);

  let institution: string | undefined;
  for (const inst of KNOWN_INSTITUTIONS) {
    if (new RegExp(`\\b${inst.sigla}\\b`, 'i').test(rawTag) || new RegExp(inst.nome, 'i').test(rawTag)) {
      institution = inst.sigla;
      break;
    }
  }

  let banca: string | undefined;
  for (const b of KNOWN_BANCAS) {
    if (new RegExp(`\\b${b.nome}\\b|\\b${b.sigla}\\b`, 'i').test(rawTag)) {
      banca = b.sigla;
      break;
    }
  }

  let especialidade: string | undefined;
  const espMatch = rawTag.match(/\b(CL[ÍI]NICA\s+M[ÉE]DICA|CIRURGIA(?:\s+GERAL)?|PEDIATRIA|GINECOLOGIA(?:\s+E\s+OBSTETR[ÍI]CIA)?|OBSTETR[ÍI]CIA|MEDICINA\s+PREVENTIVA|SA[ÚU]DE\s+COLETIVA|MFC|INFECTOLOGIA|CARDIOLOGIA|PSIQUIATRIA|ORTOPEDIA|DERMATOLOGIA|NEFROLOGIA|NEUROLOGIA|OFTALMOLOGIA|PNEUMOLOGIA|ENDOCRINOLOGIA)\b/i);
  if (espMatch) {
    especialidade = espMatch[1].toUpperCase();
  }

  let modalidade: string | undefined;
  if (/ACESSO\s+DIRETO|\bR1\b/i.test(rawTag)) {
    modalidade = 'Acesso Direto (R1)';
  } else if (/PR[ÉE][\s\-]REQUISITO|\bR3\b|\bR4\b/i.test(rawTag)) {
    modalidade = 'Pré-Requisito (R3/R4)';
  }

  const orgaoMatch = rawTag.match(/\b(?:Órgão|Orgao|Instituição|Instituicao)\s*[:\-]\s*([^;\]\)]+)/i);
  const orgao = orgaoMatch ? orgaoMatch[1].trim() : undefined;
  if (orgao && !institution) {
    institution = orgao;
  }

  const duracaoMatch = rawTag.match(/\bDura[çc][ãa]o\s*[:\-]\s*([^;\]\)]+)/i);
  const duracao = duracaoMatch ? duracaoMatch[1].trim() : undefined;

  const catMatch = rawTag.match(/\bCategoria\s*[:\-]\s*([^;\]\)]+)/i);
  const categoria = catMatch ? catMatch[1].trim() : undefined;

  const natMatch = rawTag.match(/\bNatureza\s*[:\-]\s*([^;\]\)]+)/i);
  const natureza = natMatch ? natMatch[1].trim() : undefined;

  const ufMatch = rawTag.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  const uf = ufMatch ? ufMatch[1] : undefined;

  const codMatch = rawTag.match(/\b(?:no\s+site|c[óo]digo|id)\s*[:\-#]?\s*(\d{6,14})/i);
  const plataformaCodigo = codMatch ? codMatch[1].trim() : undefined;

  return {
    rawTag,
    ano,
    institution,
    banca,
    especialidade,
    modalidade,
    orgao,
    duracao,
    categoria,
    natureza,
    uf,
    plataformaCodigo,
  };
}

/**
 * Extrai questões do texto das páginas de prova (excluindo gabarito e end matter).
 * Preserva o texto integral sem resumir, cortar ou alterar.
 */
export async function extractQuestionsFromPages(
  pages: ExtractedPageData[],
  gabaritoMap: Map<number, ExtractedGabaritoEntry>
): Promise<RealExamQuestionItem[]> {
  const examPages = pages.filter(p => !p.isGabaritoPage && !p.isEndMatter);
  const questions: RealExamQuestionItem[] = [];

  // Se o documento estiver vazio ou não houver páginas de prova, retorna vazio com segurança
  if (examPages.length === 0) {
    return [];
  }

  // Concatena mantendo a rastreabilidade das páginas
  interface PageSegment {
    pageNumber: number;
    text: string;
    startIndex: number;
    endIndex: number;
  }

  let fullExamText = '';
  const pageSegments: PageSegment[] = [];

  for (const page of examPages) {
    const startIndex = fullExamText.length;
    fullExamText += `\n[--- PAGE_BREAK_${page.pageNumber} ---]\n` + page.text;
    const endIndex = fullExamText.length;
    pageSegments.push({
      pageNumber: page.pageNumber,
      text: page.text,
      startIndex,
      endIndex,
    });
  }

  // Localiza os divisores de questão
  interface QuestionMatchItem {
    questionNumber: number;
    index: number;
    matchLength: number;
    extractedTag?: ExtractedQuestionTag;
  }

  const questionMatches: QuestionMatchItem[] = [];
  
  let m: RegExpExecArray | null;
  while ((m = QUESTION_GLOBAL_REGEX.exec(fullExamText)) !== null) {
    const rawTagStr = m[1] || m[2];
    const numStr = m[3] || m[4];
    const qNum = parseInt(numStr, 10);
    
    // Ignora números absurdos ou datas/anos (ex: 2024.)
    if (!isNaN(qNum) && qNum > 0 && qNum <= 250) {
      if (qNum >= 1900 && qNum <= 2099) continue;
      
      const parsedTag = parseRawTag(rawTagStr);

      questionMatches.push({
        questionNumber: qNum,
        index: m.index,
        matchLength: m[0].length,
        extractedTag: parsedTag,
      });
    }
  }

  // Deduplicação de cabeçalhos consecutivos muito próximos (ruído de paginação ou repetição)
  const filteredMatches: QuestionMatchItem[] = [];
  for (let i = 0; i < questionMatches.length; i++) {
    const current = questionMatches[i];
    const prev = filteredMatches[filteredMatches.length - 1];
    if (prev && prev.questionNumber === current.questionNumber && current.index - prev.index < 60) {
      continue;
    }
    filteredMatches.push(current);
  }

  // Para cada questão identificada, extrai o bloco de texto até a próxima questão
  for (let i = 0; i < filteredMatches.length; i++) {
    const current = filteredMatches[i];
    const next = filteredMatches[i + 1];
    
    const blockStart = current.index + current.matchLength;
    const blockEnd = next ? next.index : fullExamText.length;
    let rawBlock = fullExamText.substring(blockStart, blockEnd).trim();

    // Determina em quais páginas este bloco se estende
    const sourcePages: number[] = [];
    for (const seg of pageSegments) {
      if (blockStart < seg.endIndex && blockEnd > seg.startIndex) {
        sourcePages.push(seg.pageNumber);
      }
    }
    const cleanPages = sourcePages.length > 0 ? Array.from(new Set(sourcePages)) : [1];
    const spansMultiplePages = cleanPages.length > 1;

    // Remove eventuais tags de quebra de página internas do texto limpo
    let cleanBlock = rawBlock.replace(/\[--- PAGE_BREAK_\d+ ---\]\n?/g, '').trim();

    // Se o bloco ainda contiver tag residual no início, analisa
    let extractedTag = current.extractedTag;
    if (!extractedTag) {
      const matchTag = cleanBlock.match(/^\s*(?:\[([^\]]+)\]|\(([^)]+)\))\s*/);
      if (matchTag) {
        extractedTag = parseRawTag(matchTag[1] || matchTag[2]);
        if (extractedTag) {
          cleanBlock = cleanBlock.replace(/^\s*(?:\[[^\]]+\]|\([^)]+\))\s*/, '').trim();
        }
      }
    }

    // Divide o bloco entre Enunciado e Alternativas
    const { statement: rawStatement, alternatives: rawAlternatives, isDiscursive } = parseQuestionBlock(cleanBlock);

    // Etapa explícita de limpeza do conteúdo extraído (antes da validação e revisão)
    const { 
      cleanedStatement, 
      cleanedAlternatives, 
      updatedTag, 
      removedArtifacts 
    } = cleanQuestionContent(rawStatement, rawAlternatives, extractedTag);

    const statement = cleanedStatement;
    const alternatives = cleanedAlternatives;
    if (updatedTag) {
      extractedTag = updatedTag;
    }

    // Pistas de imagens no enunciado avaliadas por regras contextualizadas
    const imageHints: string[] = [];
    const triggeredRules: string[] = [];
    for (const rule of IMAGE_CUES_RULES) {
      if (rule.negativeContext && rule.negativeContext.test(statement)) {
        continue; // Ignora se estiver no contexto negativo (ex: "Diagnóstico por Imagem")
      }
      const match = statement.match(rule.regex);
      if (match) {
        imageHints.push(`[${rule.name}] "${match[0]}"`);
        triggeredRules.push(rule.name);
      }
    }
    const hasImages = imageHints.length > 0;
    const imageEvidenceType: ImageEvidenceType = hasImages ? 'EXPLICIT_TEXT_REFERENCE' : 'NONE';
    const imageRuleTriggered = triggeredRules.length > 0 ? triggeredRules.join(', ') : undefined;

    // Gabarito associado estritamente pelo número original
    const gabarito = gabaritoMap.get(current.questionNumber) || null;

    // Alertas de validação automática
    const validationAlerts: ValidationAlert[] = [];

    // 1. Alerta se não houver gabarito correspondente
    if (!gabarito) {
      validationAlerts.push({
        code: 'MISSING_GABARITO',
        message: 'Nenhuma resposta correspondente a esta questão foi encontrada no gabarito do documento.',
        severity: 'WARNING',
      });
    }

    // 2. Alerta de gabarito anulado
    if (gabarito?.isAnulada) {
      validationAlerts.push({
        code: 'ANULADA',
        message: 'Questão explicitamente identificada como ANULADA/NULA no gabarito.',
        severity: 'INFO',
      });
    }

    // 3. Alerta de letra incompatível com o número de alternativas
    if (gabarito?.answerLetter && alternatives.length > 0) {
      const availableLetters = alternatives.map(a => a.letter.toUpperCase());
      if (!availableLetters.includes(gabarito.answerLetter.toUpperCase())) {
        validationAlerts.push({
          code: 'LETTER_MISMATCH',
          message: `O gabarito extraído indica letra '${gabarito.answerLetter}', mas as alternativas detectadas foram apenas [${availableLetters.join(', ')}]. Manter a resposta extraída e conferir alternativas no PDF.`,
          severity: 'WARNING',
        });
      }
    }

    // 4. Poucas alternativas em questão objetiva
    if (!isDiscursive && alternatives.length > 0 && alternatives.length < 3) {
      validationAlerts.push({
        code: 'FEW_ALTERNATIVES',
        message: `Detectadas apenas ${alternatives.length} alternativa(s). O layout pode ter omitido alternativas ou formatado como texto contínuo.`,
        severity: 'WARNING',
      });
    }

    // 5. Pista de imagem presente no texto
    if (hasImages) {
      validationAlerts.push({
        code: 'IMAGE_HINT_DETECTED',
        message: `O enunciado faz menção a imagem, figura, radiografia ou tabela clínica. Conferir a página ${cleanPages.join(', ')} no documento original.`,
        severity: 'INFO',
      });
    }

    // 6. Enunciado muito curto ou ausente
    if (statement.length < 20) {
      validationAlerts.push({
        code: 'SHORT_STATEMENT',
        message: 'Enunciado suspeito de truncamento ou extração incompleta (menos de 20 caracteres).',
        severity: 'WARNING',
      });
    }

    // 7. Salto na sequência numérica das questões
    if (i > 0) {
      const prevQNum = filteredMatches[i - 1].questionNumber;
      if (current.questionNumber !== prevQNum + 1) {
        validationAlerts.push({
          code: 'NUMBERING_GAP',
          message: `Salto na numeração detectado: questão anterior é a de número ${prevQNum} e a atual é a de número ${current.questionNumber}.`,
          severity: 'WARNING',
        });
      }
    }

    // 8. Questão que se estende por mais de uma página
    if (spansMultiplePages) {
      validationAlerts.push({
        code: 'MULTI_PAGE_QUESTION',
        message: `A questão inicia na página ${cleanPages[0]} e continua na página ${cleanPages[cleanPages.length - 1]}. Enunciado e alternativas unificados mantendo rastreabilidade.`,
        severity: 'INFO',
      });
    }

    // Gera Hash Canônico Rastreável (SHA-256)
    const canonicalPayload = JSON.stringify({
      questionNumber: current.questionNumber,
      statement: statement.trim(),
      alternatives: alternatives.map(a => `${a.letter}:${a.text.trim()}`),
      sourcePages: cleanPages,
    });
    const hashId = await computeSha256(canonicalPayload);

    questions.push({
      id: hashId,
      questionNumber: current.questionNumber,
      statement: statement.trim(),
      rawStatement: rawStatement.trim(),
      alternatives,
      correctAnswer: gabarito?.isAnulada ? 'ANULADA' : (gabarito?.answerLetter || null),
      sourcePages: cleanPages,
      spansMultiplePages,
      continuesFromPrevPage: spansMultiplePages,
      questionType: isDiscursive ? 'DISCURSIVE' : 'OBJECTIVE',
      hasImages,
      imageEvidenceType,
      imageRuleTriggered,
      imageHints: imageHints.length > 0 ? imageHints : undefined,
      extractedTag,
      removedArtifacts: removedArtifacts.length > 0 ? removedArtifacts : undefined,
      gabarito,
      validationAlerts,
      reviewStatus: 'PENDING',
    });
  }

  // Ordena por número de questão
  return questions.sort((a, b) => a.questionNumber - b.questionNumber);
}

/**
 * Catálogo de especialidades médicas reconhecidas pelo CFM/CNRM e plataformas de concurso
 */
export const KNOWN_MEDICAL_SPECIALTIES = [
  'CLÍNICA MÉDICA',
  'CLINICA MEDICA',
  'CIRURGIA GERAL',
  'CIRURGIA',
  'PEDIATRIA',
  'GINECOLOGIA E OBSTETRÍCIA',
  'GINECOLOGIA E OBSTETRICIA',
  'GINECOLOGIA',
  'OBSTETRÍCIA',
  'OBSTETRICIA',
  'MEDICINA PREVENTIVA E SOCIAL',
  'MEDICINA PREVENTIVA',
  'SAÚDE COLETIVA',
  'SAUDE COLETIVA',
  'MEDICINA DE FAMÍLIA E COMUNIDADE',
  'MEDICINA DE FAMILIA E COMUNIDADE',
  'MFC',
  'CARDIOLOGIA',
  'DERMATOLOGIA',
  'ENDOCRINOLOGIA E METABOLOGIA',
  'ENDOCRINOLOGIA',
  'GASTROENTEROLOGIA',
  'GERIATRIA',
  'HEMATOLOGIA E HEMOTERAPIA',
  'HEMATOLOGIA',
  'INFECTOLOGIA',
  'NEFROLOGIA',
  'NEUROLOGIA',
  'OFTALMOLOGIA',
  'ONCOLOGIA CLÍNICA',
  'ONCOLOGIA CLINICA',
  'ONCOLOGIA',
  'ORTOPEDIA E TRAUMATOLOGIA',
  'ORTOPEDIA',
  'OTORRINOLARINGOLOGIA',
  'PNEUMOLOGIA',
  'PSIQUIATRIA',
  'RADIOLOGIA E DIAGNÓSTICO POR IMAGEM',
  'RADIOLOGIA',
  'REUMATOLOGIA',
  'UROLOGIA',
  'ANESTESIOLOGIA',
  'MEDICINA DE EMERGÊNCIA',
  'MEDICINA DE EMERGENCIA',
  'MEDICINA INTENSIVA',
  'TERAPIA INTENSIVA',
  'ACESSO DIRETO',
  'PRÉ-REQUISITO',
  'PRE-REQUISITO',
  'R1',
  'R3',
  'R4',
];

export interface CleanedQuestionContent {
  cleanedStatement: string;
  cleanedAlternatives: ExtractedAlternative[];
  updatedTag?: ExtractedQuestionTag;
  removedArtifacts: string[];
}

/**
 * Padrão para identificar e remover frases de comentário de professor / publicidade de plataformas
 * Ex: "Essa questão possui comentário do professor no site 4000142459"
 */
const PLATFORM_NAV_REGEX = /(?:es[st]a\s+quest[ãa]o\s+(?:possui|tem)\s+coment[áa]rio\s+(?:do\s+professor\s+)?(?:no\s+site\s*)?(?:\s*[:\-#]?\s*\d+)?|quest[ãa]o\s+comentada\s+(?:por\s+professores?|pelo\s+professor)\s+(?:no\s+site\s*)?(?:\s*[:\-#]?\s*\d+)?|coment[áa]rio\s+do\s+professor\s+no\s+site(?:\s*[:\-#]?\s*\d+)?|coment[áa]rio\s+do\s+professor\s+dispon[íi]vel\s+no\s+site(?:\s*[:\-#]?\s*\d+)?)/i;

/**
 * Pistas semânticas de frases clínicas para garantir que trechos legítimos NUNCA sejam removidos
 */
const CLINICAL_CUES_REGEX = /\b(paciente|homem|mulher|crian[çc]a|lactente|rec[ée]m[\-\s]nascido|rn|idos[oa]|gestante|apresenta|refere|procura|queixa|relata|admitid[oa]|diagnosticad[oa]|exame|quadro|sintomas|hist[óo]ri[co]a?|dor|febre|tosse|dispneia|press[ãa]o|pa\b|fc\b|ecg\b|tc\b|medicamento|dose|assinale|considere|com\s+base|em\s+rela[çc][ãa]o|qual|sobre|segundo|deve[\-\s]se|indica|conduta|diagn[óo]stico)\b/i;

/**
 * Verifica se uma linha é composta estritamente por repetições de anos ou ano isolado
 * Ex: "2021 2021 2021 2021", "2021 / 2021 / 2021", "2021"
 */
export function isRepetitiveYearLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const cleanTokens = trimmed.split(/[\s,\/\|\-\.]+/).filter(Boolean);
  if (cleanTokens.length >= 1 && cleanTokens.every(tok => /^20[12]\d$/.test(tok))) {
    return true;
  }
  return false;
}

/**
 * Verifica se a linha é um metadado editorial de plataforma no formato chave: valor
 */
export function isMetadataKeyValueLine(line: string): boolean {
  return /^\s*(?:Ano|Banca|Órgão|Orgao|Instituição|Instituicao|Prova|Cargo|Disciplina|Assunto|Dificuldade|Duração|Duracao|Categoria|Natureza|Nível|Nivel|Modalidade|Especialidade[s]?)\s*[:\-]/i.test(line);
}

/**
 * Verifica se a linha é uma lista pura de tags de especialidades / modalidades (sem contexto clínico)
 */
export function isSpecialtyTagLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || CLINICAL_CUES_REGEX.test(trimmed)) return false;

  if (/^(?:especialidade[s]?|modalidade[s]?|[áa]rea[s]?|tags?|assuntos?)\s*[:\-]/i.test(trimmed)) {
    return true;
  }

  const upper = trimmed.toUpperCase();
  let matchCount = 0;
  for (const esp of KNOWN_MEDICAL_SPECIALTIES) {
    if (upper.includes(esp)) {
      matchCount++;
    }
  }

  if (matchCount >= 1) {
    const withoutSpecialties = KNOWN_MEDICAL_SPECIALTIES.reduce(
      (acc, esp) => acc.replace(new RegExp(`\\b${esp}\\b`, 'gi'), ''), 
      trimmed
    ).replace(/[>\|\/\-\,\s\:\;\(\)\[\]\.\&]/g, '').trim();

    if (withoutSpecialties.length === 0 || /^(?:medicina|resid[êe]ncia|geral|m[ée]dica)*$/i.test(withoutSpecialties)) {
      return true;
    }
  }

  return false;
}

/**
 * Verifica se a linha é um rodapé editorial, número de página isolado ou URL de site
 */
export function isEditorialFooterLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^P[áa]gina\s+\d+\s+de\s+\d+$/i.test(trimmed)) return true;
  if (/^P[áa]g\.?\s*\d+$/i.test(trimmed)) return true;
  if (/^(?:https?:\/\/)?(?:www\.)?[a-z0-9\-]+\.com(?:\.br)?(?:\/[^\s]*)?$/i.test(trimmed)) return true;
  if (/^Caderno\s+de\s+Quest[õo]es$/i.test(trimmed)) return true;
  if (/^Todos\s+os\s+direitos\s+reservados/i.test(trimmed)) return true;
  if (/^(?:c[óo]digo|id)\s*[:#]?\s*\d{6,14}$/i.test(trimmed)) return true;
  return false;
}

/**
 * Padrões para identificar blocos de catálogo de plataforma antes do início do enunciado real.
 * Ex: "2021 2021 2021 2021 Privado DF - Hospital das Forças Armadas - HFA Anestesiologia Clínica Médica Acesso Direto (R1) Instituto Ibest"
 */
export function parsePlatformCatalogLine(line: string): {
  isCatalog: boolean;
  remainingText: string;
  catalogSnippet: string;
  meta: {
    ano?: number;
    natureza?: string;
    uf?: string;
    institution?: string;
    banca?: string;
    modalidade?: string;
    specialties: string[];
    plataformaCodigo?: string;
    titulo?: string;
  };
} {
  const meta: {
    ano?: number;
    natureza?: string;
    uf?: string;
    institution?: string;
    banca?: string;
    modalidade?: string;
    specialties: string[];
    plataformaCodigo?: string;
    titulo?: string;
  } = {
    specialties: [],
  };

  const trimmed = line.trim();
  if (!trimmed) {
    return { isCatalog: false, remainingText: '', catalogSnippet: '', meta };
  }

  // Se a linha começar com uma frase clínica evidente ou comando de questão com verbo, não é catálogo puro
  if (/^(?:paciente|homem|mulher|crian[çc]a|lactente|rec[ée]m[\-\s]nascido|rn|idos[oa]|gestante|ao\s+exame|apresenta|quadro|assinale|considere|com\s+base|em\s+rela[çc][ãa]o|qual\s+a|qual\s+o|sobre\s+o|segundo|de\s+acordo|julgue|o\s+teste\s+de)\b/i.test(trimmed)) {
    return { isCatalog: false, remainingText: trimmed, catalogSnippet: '', meta };
  }

  let working = trimmed;
  let catalogDetectedCount = 0;

  // 1. Anos repetidos ou anos no cabeçalho
  const yearsMatch = working.match(/^((?:20[12]\d[\s,\/\|\-\.]+)+)/);
  if (yearsMatch) {
    const yr = yearsMatch[1].match(/\b(20[12]\d)\b/);
    if (yr) meta.ano = parseInt(yr[1], 10);
    working = working.substring(yearsMatch[0].length).trim();
    catalogDetectedCount += 2;
  } else {
    const singleYr = working.match(/\b(20[12]\d)\b/);
    if (singleYr && /(?:Privad[oa]|P[úu]blic[oa]|Hospital|Instituto|Banca|Acesso|Resid[êe]ncia)/i.test(working)) {
      meta.ano = parseInt(singleYr[1], 10);
      working = working.replace(new RegExp(`\\b${singleYr[1]}\\b`, 'g'), '').trim();
      catalogDetectedCount++;
    }
  }

  // 2. Natureza / Esfera
  const natMatch = working.match(/\b(Privad[oa]|P[úu]blic[oa]|Federal|Estadual|Municipal)\b/i);
  if (natMatch) {
    meta.natureza = natMatch[1];
    working = working.replace(new RegExp(`\\b${natMatch[1]}\\b`, 'gi'), '').trim();
    catalogDetectedCount++;
  }

  // 3. UF
  const ufMatch = working.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (ufMatch) {
    meta.uf = ufMatch[1];
    working = working.replace(new RegExp(`\\b${ufMatch[1]}\\b`, 'g'), '').trim();
    catalogDetectedCount++;
  }

  // 4. Instituição / Hospital
  const hfaMatch = working.match(/\bHospital\s+das?\s+For[çc]as\s+Armadas(?:\s*-\s*HFA)?\b|\bHFA\b/i);
  if (hfaMatch) {
    meta.institution = 'Hospital das Forças Armadas - HFA';
    working = working.replace(hfaMatch[0], '').trim();
    catalogDetectedCount += 2;
  } else {
    const hospMatch = working.match(/\bHospital\s+[A-Za-z\u00C0-\u00DF\s\-]+(?:\s*-\s*[A-Z0-9]+)?\b/i);
    if (hospMatch) {
      meta.institution = hospMatch[0].trim();
      working = working.replace(hospMatch[0], '').trim();
      catalogDetectedCount += 2;
    } else {
      for (const inst of KNOWN_INSTITUTIONS) {
        const instRegex = new RegExp(`\\b${inst.sigla}\\b|${inst.nome}`, 'i');
        if (instRegex.test(working)) {
          meta.institution = inst.sigla;
          working = working.replace(instRegex, '').trim();
          catalogDetectedCount++;
          break;
        }
      }
    }
  }

  // 5. Banca
  const ibestMatch = working.match(/\bInstituto\s+Ibest\b|\bIBEST\b/i);
  if (ibestMatch) {
    meta.banca = 'Instituto Ibest';
    working = working.replace(ibestMatch[0], '').trim();
    catalogDetectedCount += 2;
  } else {
    for (const b of KNOWN_BANCAS) {
      const bRegex = new RegExp(`\\b${b.nome}\\b|\\b${b.sigla}\\b`, 'i');
      if (bRegex.test(working)) {
        meta.banca = b.sigla;
        working = working.replace(bRegex, '').trim();
        catalogDetectedCount++;
        break;
      }
    }
    if (!meta.banca) {
      const genericInstBanca = working.match(/\bInstituto\s+[A-Za-z\u00C0-\u00DF0-9\-]+\b/i);
      if (genericInstBanca) {
        meta.banca = genericInstBanca[0].trim();
        working = working.replace(genericInstBanca[0], '').trim();
        catalogDetectedCount++;
      }
    }
  }

  // 6. Modalidade
  if (/Acesso\s+Direto(?:\s*\(R1\))?|\bR1\b/i.test(working)) {
    meta.modalidade = 'Acesso Direto (R1)';
    working = working.replace(/Acesso\s+Direto(?:\s*\(R1\))?|\bR1\b/gi, '').trim();
    catalogDetectedCount++;
  } else if (/Pr[ée][\-\s]Requisito(?:\s*\([^\)]+\))?|\bR3\b|\bR4\b/i.test(working)) {
    meta.modalidade = 'Pré-Requisito (R3/R4)';
    working = working.replace(/Pr[ée][\-\s]Requisito(?:\s*\([^\)]+\))?|\bR3\b|\bR4\b/gi, '').trim();
    catalogDetectedCount++;
  }

  // 7. Especialidades médicas
  for (const esp of KNOWN_MEDICAL_SPECIALTIES) {
    const espRegex = new RegExp(`\\b${esp}\\b`, 'gi');
    if (espRegex.test(working)) {
      meta.specialties.push(esp);
      working = working.replace(espRegex, '').trim();
      catalogDetectedCount++;
    }
  }

  // 8. Código de plataforma / comentário de professor
  if (PLATFORM_NAV_REGEX.test(working)) {
    const codMatch = working.match(/(?:no\s+site|c[óo]digo|id)?\s*[:\-#]?\s*(\d{6,14})/i);
    if (codMatch) meta.plataformaCodigo = codMatch[1];
    working = working.replace(PLATFORM_NAV_REGEX, '').trim();
    catalogDetectedCount += 2;
  }

  // Limpa pontuações residuais de separadores (ex: "-", "/", "|", etc.)
  const cleanRemaining = working.replace(/^[\s\-–—/|•,:;]+|[\s\-–—/|•,:;]+$/g, '').trim();

  // Consideramos catálogo se detectamos ao menos 2 indícios ou se todo o texto foi consumido
  if (catalogDetectedCount >= 2 || (catalogDetectedCount >= 1 && cleanRemaining.length === 0)) {
    if (cleanRemaining.length > 0 && !CLINICAL_CUES_REGEX.test(cleanRemaining) && cleanRemaining.length < 100) {
      meta.titulo = cleanRemaining;
    }
    const catalogSnippet = trimmed.replace(cleanRemaining, '').trim();
    return {
      isCatalog: true,
      remainingText: cleanRemaining,
      catalogSnippet: catalogSnippet || trimmed,
      meta,
    };
  }

  return {
    isCatalog: false,
    remainingText: trimmed,
    catalogSnippet: '',
    meta,
  };
}

/**
 * Higieniza o enunciado e as alternativas da questão:
 * - Remove repetições de ano ("2021 2021 2021 2021...")
 * - Remove frases de navegação/comentário ("Essa questão possui comentário do professor no site 4000142459")
 * - Remove metadados editoriais de duração, categoria, natureza
 * - Remove listas de tags de especialidades e modalidades
 * - PRESERVA 100% de trechos clínicos com idades, anos, exames laboratoriais, doenças e condutas
 */
export function cleanQuestionContent(
  rawStatement: string,
  rawAlternatives: ExtractedAlternative[],
  initialTag?: ExtractedQuestionTag
): CleanedQuestionContent {
  const removedArtifacts: string[] = [];
  const updatedTag: ExtractedQuestionTag = {
    rawTag: initialTag?.rawTag || '',
    institution: initialTag?.institution,
    banca: initialTag?.banca,
    ano: initialTag?.ano,
    especialidade: initialTag?.especialidade,
    modalidade: initialTag?.modalidade,
    orgao: initialTag?.orgao,
    cargo: initialTag?.cargo,
    disciplina: initialTag?.disciplina,
    assunto: initialTag?.assunto,
    titulo: initialTag?.titulo,
    duracao: initialTag?.duracao,
    categoria: initialTag?.categoria,
    natureza: initialTag?.natureza,
    uf: initialTag?.uf,
    plataformaCodigo: initialTag?.plataformaCodigo,
  };

  const detectedSpecialties: string[] = [];
  if (initialTag?.especialidade) {
    detectedSpecialties.push(initialTag.especialidade);
  }

  // 1. Limpeza do Enunciado linha por linha
  const statementLines = rawStatement.split(/\r?\n/);
  const cleanedStatementLines: string[] = [];

  for (let rawLine of statementLines) {
    let line = rawLine.trim();
    if (!line) {
      if (cleanedStatementLines.length > 0) {
        cleanedStatementLines.push('');
      }
      continue;
    }

    // A. Frases de comentário de professor / plataforma com identificador
    if (PLATFORM_NAV_REGEX.test(line)) {
      const codeMatch = line.match(/(?:no\s+site|c[óo]digo|id)?\s*[:\-#]?\s*(\d{6,14})/i);
      if (codeMatch && !updatedTag.plataformaCodigo) {
        updatedTag.plataformaCodigo = codeMatch[1];
      }
      removedArtifacts.push(`Frase de navegação/comentário removida: "${line}"`);
      const stripped = line.replace(PLATFORM_NAV_REGEX, '').trim();
      if (!stripped || /^\d+$/.test(stripped)) {
        continue;
      }
      line = stripped;
    }

    // B. Anos repetidos (ex: "2021 2021 2021 2021")
    if (isRepetitiveYearLine(line)) {
      const yrMatch = line.match(/\b(20[12]\d)\b/);
      if (yrMatch && !updatedTag.ano) {
        updatedTag.ano = parseInt(yrMatch[1], 10);
      }
      removedArtifacts.push(`Anos repetidos removidos: "${line}"`);
      continue;
    }

    // B2. Prefixo de anos repetidos seguido de tags (ex: "2021 2021 2021 Clínica Médica")
    const repPrefixMatch = line.match(/^((?:20[12]\d[\s,\/\|\-\.]+){2,})(.*)$/);
    if (repPrefixMatch) {
      const yrMatch = repPrefixMatch[1].match(/\b(20[12]\d)\b/);
      if (yrMatch && !updatedTag.ano) {
        updatedTag.ano = parseInt(yrMatch[1], 10);
      }
      removedArtifacts.push(`Prefixo de anos repetidos removido: "${repPrefixMatch[1].trim()}"`);
      line = repPrefixMatch[2].trim();
      if (!line) continue;
    }

    // C. Pares Chave-Valor de Metadados Editoriais (Ano:, Banca:, Órgão:, Duração:, etc.)
    if (isMetadataKeyValueLine(line)) {
      const extractCleanValue = (pattern: RegExp, text: string): string | undefined => {
        const match = text.match(pattern);
        if (!match) return undefined;
        const raw = match[1].trim();
        const cut = raw.split(/\s+(?:Banca|Ano|Órgão|Orgao|Instituição|Instituicao|Prova|Cargo|Disciplina|Assunto|Duração|Duracao|Categoria|Natureza|Modalidade|Especialidade[s]?)\s*[:\-]/i)[0];
        return cut.trim();
      };

      const anoMatch = line.match(/\bAno\s*[:\-]\s*(20[12]\d)/i);
      if (anoMatch && !updatedTag.ano) updatedTag.ano = parseInt(anoMatch[1], 10);

      const bancaVal = extractCleanValue(/\bBanca\s*[:\-]\s*([^;\n\r]+)/i, line);
      if (bancaVal && !updatedTag.banca) updatedTag.banca = bancaVal;

      const orgaoVal = extractCleanValue(/\b(?:Órgão|Orgao|Instituição|Instituicao)\s*[:\-]\s*([^;\n\r]+)/i, line);
      if (orgaoVal) {
        if (!updatedTag.orgao) updatedTag.orgao = orgaoVal;
        if (!updatedTag.institution) updatedTag.institution = orgaoVal;
      }

      const duracaoVal = extractCleanValue(/\bDura[çc][ãa]o\s*[:\-]\s*([^;\n\r]+)/i, line);
      if (duracaoVal && !updatedTag.duracao) updatedTag.duracao = duracaoVal;

      const categoriaVal = extractCleanValue(/\bCategoria\s*[:\-]\s*([^;\n\r]+)/i, line);
      if (categoriaVal && !updatedTag.categoria) updatedTag.categoria = categoriaVal;

      const naturezaVal = extractCleanValue(/\bNatureza\s*[:\-]\s*([^;\n\r]+)/i, line);
      if (naturezaVal && !updatedTag.natureza) updatedTag.natureza = naturezaVal;

      const discVal = extractCleanValue(/\bDisciplina\s*[:\-]\s*([^;\n\r]+)/i, line);
      if (discVal && !updatedTag.disciplina) updatedTag.disciplina = discVal;

      const assuntoVal = extractCleanValue(/\bAssunto\s*[:\-]\s*([^;\n\r]+)/i, line);
      if (assuntoVal && !updatedTag.assunto) updatedTag.assunto = assuntoVal;

      const modVal = extractCleanValue(/\bModalidade\s*[:\-]\s*([^;\n\r]+)/i, line);
      if (modVal && !updatedTag.modalidade) updatedTag.modalidade = modVal;

      const espVal = extractCleanValue(/\bEspecialidade[s]?\s*[:\-]\s*([^;\n\r]+)/i, line);
      if (espVal) {
        detectedSpecialties.push(espVal);
        if (!updatedTag.especialidade) updatedTag.especialidade = espVal;
      }

      removedArtifacts.push(`Metadado editorial removido: "${line}"`);
      continue;
    }

    // D. Linhas puras de tags de especialidades / modalidades (sem contexto clínico)
    if (isSpecialtyTagLine(line)) {
      const upper = line.toUpperCase();
      for (const esp of KNOWN_MEDICAL_SPECIALTIES) {
        if (upper.includes(esp)) {
          detectedSpecialties.push(esp);
        }
      }
      if (/ACESSO\s+DIRETO/i.test(line) && !updatedTag.modalidade) {
        updatedTag.modalidade = 'Acesso Direto (R1)';
      } else if (/PR[ÉE][\s\-]REQUISITO/i.test(line) && !updatedTag.modalidade) {
        updatedTag.modalidade = 'Pré-Requisito (R3/R4)';
      }
      removedArtifacts.push(`Tag de especialidade/modalidade removida: "${line}"`);
      continue;
    }

    // D2. Bloco de cabeçalho / catálogo de plataforma (ex: "2021 2021 2021 2021 Privado DF - Hospital das Forças Armadas - HFA Anestesiologia Clínica Médica Acesso Direto (R1) Instituto Ibest")
    const catalogInfo = parsePlatformCatalogLine(line);
    if (catalogInfo.isCatalog) {
      if (catalogInfo.meta.ano && !updatedTag.ano) updatedTag.ano = catalogInfo.meta.ano;
      if (catalogInfo.meta.natureza && !updatedTag.natureza) updatedTag.natureza = catalogInfo.meta.natureza;
      if (catalogInfo.meta.uf && !updatedTag.uf) updatedTag.uf = catalogInfo.meta.uf;
      if (catalogInfo.meta.institution && !updatedTag.institution) {
        updatedTag.institution = catalogInfo.meta.institution;
        if (!updatedTag.orgao) updatedTag.orgao = catalogInfo.meta.institution;
      }
      if (catalogInfo.meta.banca && !updatedTag.banca) updatedTag.banca = catalogInfo.meta.banca;
      if (catalogInfo.meta.modalidade && !updatedTag.modalidade) updatedTag.modalidade = catalogInfo.meta.modalidade;
      if (catalogInfo.meta.specialties.length > 0) {
        for (const sp of catalogInfo.meta.specialties) {
          detectedSpecialties.push(sp);
        }
        if (!updatedTag.especialidade) updatedTag.especialidade = catalogInfo.meta.specialties[0];
        if (!updatedTag.rawCatalogSpecialties) updatedTag.rawCatalogSpecialties = [...catalogInfo.meta.specialties];
      }
      if (catalogInfo.meta.plataformaCodigo && !updatedTag.plataformaCodigo) {
        updatedTag.plataformaCodigo = catalogInfo.meta.plataformaCodigo;
      }
      if (catalogInfo.meta.titulo && !updatedTag.titulo) {
        updatedTag.titulo = catalogInfo.meta.titulo;
      }

      removedArtifacts.push(`Bloco de metadados da plataforma removido: "${catalogInfo.catalogSnippet || line}"`);

      // Se sobrou algum texto da linha (ex: título da questão "Classificação de Schilling"), preserva-o!
      if (catalogInfo.remainingText) {
        line = catalogInfo.remainingText;
      } else {
        continue;
      }
    }

    // E. Rodapés editoriais, numeração isolada e URLs de plataformas
    if (isEditorialFooterLine(line)) {
      removedArtifacts.push(`Rodapé/URL de plataforma removido: "${line}"`);
      continue;
    }

    // Linha legítima preservada! (Usa 'line' que pode ter tido prefixos limpos, em vez de 'rawLine')
    cleanedStatementLines.push(line);
  }

  // 2. Limpeza das Alternativas
  const cleanedAlternatives: ExtractedAlternative[] = rawAlternatives.map(alt => {
    const altLines = alt.text.split(/\r?\n/);
    const validAltLines: string[] = [];

    for (const altL of altLines) {
      const trimmed = altL.trim();
      if (!trimmed) {
        if (validAltLines.length > 0) validAltLines.push('');
        continue;
      }

      // Remove comentários e rodapés que vazaram para dentro da alternativa
      if (PLATFORM_NAV_REGEX.test(trimmed)) {
        removedArtifacts.push(`Frase de navegação removida da alternativa ${alt.letter}: "${trimmed}"`);
        continue;
      }
      if (isEditorialFooterLine(trimmed)) {
        removedArtifacts.push(`Rodapé removido da alternativa ${alt.letter}: "${trimmed}"`);
        continue;
      }
      if (isRepetitiveYearLine(trimmed)) {
        removedArtifacts.push(`Ano repetido removido da alternativa ${alt.letter}: "${trimmed}"`);
        continue;
      }

      validAltLines.push(altL);
    }

    return {
      letter: alt.letter,
      text: validAltLines.join('\n').trim(),
      originalIndex: alt.originalIndex,
    };
  });

  if (detectedSpecialties.length > 0 && !updatedTag.especialidade) {
    updatedTag.especialidade = detectedSpecialties[0];
  }

  const cleanedStatement = cleanedStatementLines.join('\n').trim();

  return {
    cleanedStatement,
    cleanedAlternatives,
    updatedTag: (
      updatedTag.ano || 
      updatedTag.institution || 
      updatedTag.banca || 
      updatedTag.especialidade || 
      updatedTag.modalidade || 
      updatedTag.plataformaCodigo || 
      updatedTag.orgao ||
      updatedTag.natureza ||
      updatedTag.uf ||
      updatedTag.titulo
    ) ? updatedTag : undefined,
    removedArtifacts,
  };
}

/**
 * Decompõe o bloco de texto entre enunciado e alternativas
 */
export function parseQuestionBlock(rawBlock: string): {
  statement: string;
  alternatives: ExtractedAlternative[];
  isDiscursive: boolean;
} {
  const lines = rawBlock.split(/\r?\n/);
  const alternatives: ExtractedAlternative[] = [];
  
  let inAlternatives = false;
  const statementLines: string[] = [];
  let currentAlt: { letter: string; lines: string[]; originalIndex: number } | null = null;
  let altIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (!inAlternatives) statementLines.push('');
      else if (currentAlt) currentAlt.lines.push('');
      continue;
    }

    const match = line.match(ALTERNATIVE_PREFIX_REGEX);
    const certoErradoMatch = !match ? line.match(ALTERNATIVE_CERTO_ERRADO_REGEX) : null;

    if (match || certoErradoMatch) {
      inAlternatives = true;
      if (currentAlt) {
        alternatives.push({
          letter: currentAlt.letter.toUpperCase(),
          text: currentAlt.lines.join('\n').trim(),
          originalIndex: currentAlt.originalIndex,
        });
      }

      let letter = '';
      let firstLineText = '';

      if (match) {
        letter = (match[1] || match[2] || match[3]).toUpperCase();
        firstLineText = match[4] || '';
      } else if (certoErradoMatch) {
        letter = certoErradoMatch[1].toUpperCase();
        firstLineText = certoErradoMatch[2] || '';
      }
      
      currentAlt = {
        letter,
        lines: [firstLineText],
        originalIndex: altIndex++,
      };
    } else {
      if (!inAlternatives) {
        statementLines.push(rawLine);
      } else {
        if (currentAlt) {
          currentAlt.lines.push(rawLine);
        } else {
          statementLines.push(rawLine);
        }
      }
    }
  }

  // Salva última alternativa em processamento
  if (currentAlt) {
    alternatives.push({
      letter: currentAlt.letter.toUpperCase(),
      text: currentAlt.lines.join('\n').trim(),
      originalIndex: currentAlt.originalIndex,
    });
  }

  const statement = statementLines.join('\n').trim();
  const isDiscursive = alternatives.length === 0;

  return {
    statement,
    alternatives,
    isDiscursive,
  };
}

/**
 * Detecta automaticamente o nome da prova, instituição, banca, ano e modalidade
 * a partir das evidências de TODAS as páginas do documento e das tags extraídas.
 * Detecta conflitos e não assume valores padrão sem evidência real.
 */
export function detectExamMetadata(
  pages: ExtractedPageData[],
  fileName: string,
  questionItems: RealExamQuestionItem[] = []
): DetectedExamMetadata {
  const evidenceSources: MetadataEvidence[] = [];
  const conflicts: MetadataConflict[] = [];

  // 1. INSTITUIÇÃO / PROCESSO SELETIVO
  const institutionCandidates = new Map<string, { count: number; pages: number[]; snippet: string; isCatalog: boolean }>();

  // A. Catálogo conhecido
  for (const page of pages) {
    for (const inst of KNOWN_INSTITUTIONS) {
      const pattern = new RegExp(`\\b${inst.sigla}\\b|${inst.nome}`, 'i');
      if (pattern.test(page.text)) {
        const match = page.text.match(pattern);
        const current = institutionCandidates.get(inst.sigla) || { count: 0, pages: [], snippet: match ? match[0] : inst.sigla, isCatalog: true };
        current.count += 2;
        current.pages.push(page.pageNumber);
        institutionCandidates.set(inst.sigla, current);
      }
    }
  }

  // B. Padrões textuais abertos linha a linha (universidades, hospitais, faculdades, secretarias de saúde)
  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);
    for (const rawL of lines) {
      const line = rawL.trim();
      const openInstMatch = line.match(/(?:UNIVERSIDADE\s+[A-ZÀ-Ú0-9\s\-]{3,45}|FACULDADE\s+(?:DE\s+MEDICINA\s+)?[A-ZÀ-Ú0-9\s\-]{3,45}|HOSPITAL\s+(?:UNIVERSIT[ÁA]RIO|DAS\s+CL[ÍI]NICAS|DE\s+CL[ÍI]NICAS)?[A-ZÀ-Ú0-9\s\-]{3,45}|SECRETARIA\s+(?:DE\s+ESTADO\s+DA\s+|MUNICIPAL\s+DE\s+)?SA[ÚU]DE[A-ZÀ-Ú0-9\s\-]{3,40})/i);
      if (openInstMatch) {
        const candidateName = openInstMatch[0].trim().replace(/\s+/g, ' ');
        if (candidateName.length >= 8 && candidateName.length <= 60) {
          const current = institutionCandidates.get(candidateName) || { count: 0, pages: [], snippet: candidateName, isCatalog: false };
          current.count++;
          current.pages.push(page.pageNumber);
          institutionCandidates.set(candidateName, current);
        }
      }
    }
  }

  // C. Question tags (metadados por questão)
  for (const q of questionItems) {
    const tagInst = q.extractedTag?.institution || q.extractedTag?.orgao;
    if (tagInst) {
      const current = institutionCandidates.get(tagInst) || { count: 0, pages: [], snippet: `Tag [${tagInst}] na questão ${q.questionNumber}`, isCatalog: false };
      current.count += 3;
      current.pages.push(...q.sourcePages);
      institutionCandidates.set(tagInst, current);
    }
  }

  // Seleciona instituição e avalia conflitos
  let institution: string | null = null;
  let institutionState: MetadataFieldState = 'PENDING';

  const sortedInstitutions = Array.from(institutionCandidates.entries()).sort((a, b) => b[1].count - a[1].count);

  if (sortedInstitutions.length > 0) {
    const top = sortedInstitutions[0];
    institution = top[0];
    institutionState = top[1].count >= 2 || top[1].isCatalog ? 'CONFIRMED' : 'CANDIDATE';

    evidenceSources.push({
      field: 'institution',
      value: institution,
      confidence: institutionState === 'CONFIRMED' ? 'HIGH' : 'MEDIUM',
      state: institutionState,
      sourceText: top[1].snippet,
      pageNumber: top[1].pages[0] || 1,
    });

    // Detecta se há múltiplas instituições conflitantes
    if (sortedInstitutions.length > 1) {
      const competing = sortedInstitutions.filter(inst => inst[1].count >= 2 && inst[0] !== top[0]);
      if (competing.length > 0) {
        conflicts.push({
          field: 'institution',
          values: sortedInstitutions.slice(0, 3).map(s => ({
            value: s[0],
            pageNumber: s[1].pages[0] || 1,
            count: s[1].count,
          })),
          notes: 'Documento contém menções a múltiplas instituições distintas.',
        });
      }
    }
  }

  // 2. BANCA EXAMINADORA
  const bancaCandidates = new Map<string, { count: number; pages: number[]; snippet: string; isCatalog: boolean }>();

  // A. Catálogo conhecido
  for (const page of pages) {
    for (const b of KNOWN_BANCAS) {
      const pattern = new RegExp(`\\b${b.nome}\\b|\\b${b.sigla}\\b`, 'i');
      if (pattern.test(page.text)) {
        const match = page.text.match(pattern);
        const current = bancaCandidates.get(b.sigla || b.nome) || { count: 0, pages: [], snippet: match ? match[0] : b.nome, isCatalog: true };
        current.count += 2;
        current.pages.push(page.pageNumber);
        bancaCandidates.set(b.sigla || b.nome, current);
      }
    }
  }

  // B. Padrões abertos de banca linha a linha
  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);
    for (const rawL of lines) {
      const line = rawL.trim();
      const openBancaMatch = line.match(/(?:ORGANIZADORA|BANCA\s+EXAMINADORA|REALIZA[ÇC][ÃA]O)[\s\:\-]+([A-ZÀ-Ú0-9\s\-]{3,40})/i);
      if (openBancaMatch) {
        const candidateBanca = openBancaMatch[1].trim().replace(/\s+/g, ' ');
        if (candidateBanca.length >= 3 && candidateBanca.length <= 40) {
          const current = bancaCandidates.get(candidateBanca) || { count: 0, pages: [], snippet: openBancaMatch[0], isCatalog: false };
          current.count += 2;
          current.pages.push(page.pageNumber);
          bancaCandidates.set(candidateBanca, current);
        }
      }
    }
  }

  // C. Question tags de banca
  for (const q of questionItems) {
    if (q.extractedTag?.banca) {
      const tagBanca = q.extractedTag.banca;
      const current = bancaCandidates.get(tagBanca) || { count: 0, pages: [], snippet: `Tag banca [${tagBanca}] na questão ${q.questionNumber}`, isCatalog: false };
      current.count += 3;
      current.pages.push(...q.sourcePages);
      bancaCandidates.set(tagBanca, current);
    }
  }

  let banca: string | null = null;
  let bancaState: MetadataFieldState = 'PENDING';

  const sortedBancas = Array.from(bancaCandidates.entries()).sort((a, b) => b[1].count - a[1].count);

  if (sortedBancas.length > 0) {
    const topBanca = sortedBancas[0];
    banca = topBanca[0];
    bancaState = topBanca[1].count >= 2 || topBanca[1].isCatalog ? 'CONFIRMED' : 'CANDIDATE';

    evidenceSources.push({
      field: 'banca',
      value: banca,
      confidence: bancaState === 'CONFIRMED' ? 'HIGH' : 'MEDIUM',
      state: bancaState,
      sourceText: topBanca[1].snippet,
      pageNumber: topBanca[1].pages[0] || 1,
    });

    if (sortedBancas.length > 1) {
      conflicts.push({
        field: 'banca',
        values: sortedBancas.map(s => ({ value: s[0], pageNumber: s[1].pages[0] || 1, count: s[1].count })),
        notes: 'Documento apresenta menção a mais de uma banca organizadora.',
      });
    }
  }

  // 3. NOME DA PROVA / PROCESSO SELETIVO
  let examName: string | null = null;
  let examNameState: MetadataFieldState = 'PENDING';

  for (const page of pages) {
    const examMatch = page.text.match(/(?:PROVA\s+(?:OBJETIVA\s+)?(?:DE\s+)?RESID[ÊE]NCIA\s+M[ÉE]DICA[^\n]{0,50}|EXAME\s+NACIONAL\s+DE\s+RESID[ÊE]NCIA\s+M[ÉE]DICA[^\n]{0,50}|PROCESSO\s+SELETIVO\s+(?:P[ÚU]BLICO\s+)?(?:UNIFICADO\s+)?[^\n]{0,50}|CONCURSO\s+DE\s+RESID[ÊE]NCIA\s+M[ÉE]DICA[^\n]{0,50})/i);
    if (examMatch) {
      examName = examMatch[0].trim().replace(/\s+/g, ' ');
      examNameState = 'CONFIRMED';
      evidenceSources.push({
        field: 'examName',
        value: examName,
        confidence: 'HIGH',
        state: 'CONFIRMED',
        sourceText: examMatch[0],
        pageNumber: page.pageNumber,
      });
      break;
    }
  }

  if (!examName && institution) {
    examName = `Residência Médica ${institution}`;
    examNameState = 'CANDIDATE';
    evidenceSources.push({
      field: 'examName',
      value: examName,
      confidence: 'MEDIUM',
      state: 'CANDIDATE',
      sourceText: `Inferido a partir da instituição detectada: ${institution}`,
      pageNumber: 1,
    });
  }

  // 4. ANOS: ANO DE APLICAÇÃO vs ANO DE PUBLICAÇÃO DO EDITAL vs CASOS CLÍNICOS
  let anoAplicacao: number | null = null;
  let anoAplicacaoState: MetadataFieldState = 'PENDING';
  let anoPublicacao: number | null = null;
  let anoPublicacaoState: MetadataFieldState = 'PENDING';

  const isLawOrCaseNoise = (line: string) => /(?:RESOLU[ÇC][ÃA]O|LEI\s+N?º?\s*\d|PORTARIA|DECRETO|DIRETRIZ|PACIENTE[^\n]{0,20}\b20[12]\d\b|DESDE\s+20[12]\d|EM\s+20[12]\d[^\n]{0,30}PACIENTE)/i.test(line);

  // A. Ano do Edital (anoPublicacao)
  for (const page of pages) {
    const editalMatch = page.text.match(/EDITAL\s*(?:N[ºo°]?\s*)?\d{1,4}\s*[\/\-]\s*(20[12]\d)/i);
    if (editalMatch) {
      anoPublicacao = parseInt(editalMatch[1], 10);
      anoPublicacaoState = 'CONFIRMED';
      evidenceSources.push({
        field: 'anoPublicacao',
        value: anoPublicacao.toString(),
        confidence: 'HIGH',
        state: 'CONFIRMED',
        sourceText: editalMatch[0],
        pageNumber: page.pageNumber,
      });
      break;
    }
  }

  // B. Ano de Aplicação (anoAplicacao)
  const applicationYearCandidates = new Map<number, { count: number; pages: number[]; snippet: string }>();

  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);
    for (const line of lines) {
      if (isLawOrCaseNoise(line)) continue;

      // Data de aplicação expressa
      const explicitDateMatch = line.match(/(?:APLICA[ÇC][ÃA]O|DATA\s+DA\s+PROVA|REALIZA[ÇC][ÃA]O)[\s\:\-]+(?:\d{1,2}\/\d{1,2}\/)?(20[12]\d)/i);
      if (explicitDateMatch) {
        const yr = parseInt(explicitDateMatch[1], 10);
        const curr = applicationYearCandidates.get(yr) || { count: 0, pages: [], snippet: explicitDateMatch[0] };
        curr.count += 5;
        curr.pages.push(page.pageNumber);
        applicationYearCandidates.set(yr, curr);
      }

      // Título de prova ou cabeçalho com ano (procurando no segmento da linha)
      const titleYearMatch = line.match(/(?:PROVA|RESID[ÊE]NCIA|SELE[ÇC][ÃA]O|CONCURSO|ENARE|GABARITO)[^\n\r]{0,60}\b(20[12]\d)\b/i);
      if (titleYearMatch) {
        const yr = parseInt(titleYearMatch[1], 10);
        const curr = applicationYearCandidates.get(yr) || { count: 0, pages: [], snippet: line.trim() };
        curr.count += 2;
        curr.pages.push(page.pageNumber);
        applicationYearCandidates.set(yr, curr);
      }
    }
  }

  // C. Question tags com ano
  for (const q of questionItems) {
    if (q.extractedTag?.ano) {
      const yr = q.extractedTag.ano;
      const curr = applicationYearCandidates.get(yr) || { count: 0, pages: [], snippet: `Tag [${yr}] na questão ${q.questionNumber}` };
      curr.count += 3;
      curr.pages.push(...q.sourcePages);
      applicationYearCandidates.set(yr, curr);
    }
  }

  const sortedYears = Array.from(applicationYearCandidates.entries()).sort((a, b) => b[1].count - a[1].count);

  if (sortedYears.length > 0) {
    const topYear = sortedYears[0];
    anoAplicacao = topYear[0];
    anoAplicacaoState = topYear[1].count >= 2 ? 'CONFIRMED' : 'CANDIDATE';

    evidenceSources.push({
      field: 'anoAplicacao',
      value: anoAplicacao.toString(),
      confidence: anoAplicacaoState === 'CONFIRMED' ? 'HIGH' : 'MEDIUM',
      state: anoAplicacaoState,
      sourceText: topYear[1].snippet,
      pageNumber: topYear[1].pages[0] || 1,
    });

    if (sortedYears.length > 1) {
      conflicts.push({
        field: 'anoAplicacao',
        values: sortedYears.map(s => ({ value: s[0].toString(), pageNumber: s[1].pages[0] || 1, count: s[1].count })),
        notes: 'Múltiplos anos detectados ao longo das questões ou páginas.',
      });
    }
  }

  // Fallback no nome do arquivo caso nenhuma evidência textual de ano exista
  if (!anoAplicacao) {
    const fileYearMatch = fileName.match(/\b(20[12]\d)\b/);
    if (fileYearMatch) {
      anoAplicacao = parseInt(fileYearMatch[1], 10);
      anoAplicacaoState = 'CANDIDATE';
      evidenceSources.push({
        field: 'anoAplicacao',
        value: anoAplicacao.toString(),
        confidence: 'MEDIUM',
        state: 'CANDIDATE',
        sourceText: `Nome do arquivo: "${fileName}"`,
        pageNumber: 1,
      });
    }
  }

  // 5. MODALIDADE
  // REGRA ESTRITA: Se não houver evidência textual, modalidade é NULL e PENDING. Nunca assumir Acesso Direto sem evidência!
  let modalidade: string | null = null;
  let modalidadeState: MetadataFieldState = 'PENDING';

  const fullTextSample = pages.map(p => p.text).join('\n');

  if (/ACESSO\s+DIRETO|\bR1\b/i.test(fullTextSample)) {
    modalidade = 'Acesso Direto (R1)';
    modalidadeState = 'CONFIRMED';
  } else if (/PR[ÉE][\s\-]REQUISITO|\bR3\b|\bR4\b/i.test(fullTextSample)) {
    modalidade = 'Pré-Requisito (R3/R4)';
    modalidadeState = 'CONFIRMED';
  } else if (/REVALIDA[ÇC][ÃA]O/i.test(fullTextSample)) {
    modalidade = 'Revalidação de Diplomas (Revalida)';
    modalidadeState = 'CONFIRMED';
  } else if (/ÁREAS\s+B[ÁA]SICAS/i.test(fullTextSample)) {
    modalidade = 'Áreas Básicas';
    modalidadeState = 'CONFIRMED';
  }

  // Fallback em tags das questões se a modalidade não foi detectada no corpo das páginas
  if (!modalidade) {
    for (const q of questionItems) {
      if (q.extractedTag?.modalidade) {
        const rawM = q.extractedTag.modalidade;
        if (/ACESSO\s+DIRETO|\bR1\b/i.test(rawM)) {
          modalidade = 'Acesso Direto (R1)';
        } else if (/PR[ÉE][\s\-]REQUISITO|\bR3\b|\bR4\b/i.test(rawM)) {
          modalidade = 'Pré-Requisito (R3/R4)';
        } else {
          modalidade = rawM;
        }
        modalidadeState = 'CONFIRMED';
        evidenceSources.push({
          field: 'modalidade',
          value: modalidade,
          confidence: 'HIGH',
          state: 'CONFIRMED',
          sourceText: `Identificada nas tags da questão ${q.questionNumber}: "${rawM}"`,
          pageNumber: q.sourcePages[0] || 1,
        });
        break;
      }
    }
  }

  if (modalidade && !evidenceSources.some(e => e.field === 'modalidade')) {
    evidenceSources.push({
      field: 'modalidade',
      value: modalidade,
      confidence: 'HIGH',
      state: 'CONFIRMED',
      sourceText: `Evidência de modalidade identificada: ${modalidade}`,
      pageNumber: 1,
    });
  }

  // 6. ESPECIALIDADES DETECTADAS NAS QUESTÕES
  const allSpecialties = new Set<string>();
  for (const q of questionItems) {
    if (q.extractedTag?.especialidade) {
      allSpecialties.add(q.extractedTag.especialidade);
    }
  }
  const especialidadesList = allSpecialties.size > 0 ? Array.from(allSpecialties) : undefined;

  // 7. PROVENIÊNCIA DO GABARITO
  const gabaritoPages = pages.filter(p => p.isGabaritoPage);
  const isGabaritoOficialComprovado = gabaritoPages.some(p => 
    /(?:GABARITO\s+OFICIAL|GABARITO\s+DEFINITIVO|GABARITO\s+PRELIMINAR\s+OFICIAL|BANCA\s+EXAMINADORA)/i.test(p.text)
  );
  const gabaritoProvenance = isGabaritoOficialComprovado 
    ? 'OFFICIAL_EXPLICIT' 
    : gabaritoPages.length > 0 ? 'DOCUMENT_FOUND' : 'UNVERIFIED';

  const multipleExamsDetected = conflicts.some(c => c.field === 'institution' || c.field === 'anoAplicacao');

  return {
    examName,
    institution,
    banca,
    anoAplicacao,
    anoPublicacao,
    modalidade,
    examNameState,
    institutionState,
    bancaState,
    anoAplicacaoState,
    anoPublicacaoState,
    modalidadeState,
    evidenceSources,
    conflicts,
    isGabaritoOficialComprovado,
    gabaritoProvenance,
    especialidadesList,
    multipleExamsDetected,
    notes: multipleExamsDetected 
      ? 'Atenção: Conflito detectado entre metadados ao longo do documento. O arquivo pode conter questões de múltiplas instituições ou anos.' 
      : undefined,
  };
}

/**
 * Função orquestradora principal do processo de extração e validação do documento
 */
export async function processExamDocument(
  fileName: string,
  fileSizeBytes: number,
  fileSha256: string,
  rawPages: { pageNumber: number; text: string }[]
): Promise<ExtractionResult> {
  // 1. Classificação das páginas
  const classifiedPages = classifyPages(rawPages);

  // 2. Extração do gabarito nas páginas finais
  const gabaritoPages = classifiedPages.filter(p => p.isGabaritoPage);
  const endMatterPages = classifiedPages.filter(p => p.isEndMatter);
  const examPages = classifiedPages.filter(p => !p.isGabaritoPage && !p.isEndMatter);

  const gabaritoEntries = extractGabaritoEntries(gabaritoPages);
  
  // Mapa por número de questão
  const gabaritoMap = new Map<number, ExtractedGabaritoEntry>();
  const duplicateNumbersInGabarito = new Set<number>();

  for (const entry of gabaritoEntries) {
    if (gabaritoMap.has(entry.questionNumber)) {
      duplicateNumbersInGabarito.add(entry.questionNumber);
    }
    gabaritoMap.set(entry.questionNumber, entry);
  }

  // 3. Extração das questões das páginas de prova
  const questions = await extractQuestionsFromPages(classifiedPages, gabaritoMap);

  // 4. Métricas e Auditoria da Associação
  const identifiedQNums = new Set(questions.map(q => q.questionNumber));
  const gabaritoQNums = new Set(gabaritoEntries.map(g => g.questionNumber));

  let questionsWithAnswer = 0;
  let questionsWithoutAnswer = 0;
  let discrepanciesCount = 0;
  let anuladasCount = 0;

  for (const q of questions) {
    if (q.gabarito) {
      questionsWithAnswer++;
      if (q.gabarito.isAnulada) {
        anuladasCount++;
      }
    } else {
      questionsWithoutAnswer++;
    }

    if (q.validationAlerts.some(a => a.severity === 'WARNING' || a.severity === 'ERROR')) {
      discrepanciesCount++;
    }
  }

  // Respostas no gabarito sem questão identificada
  let gabaritoWithoutQuestion = 0;
  for (const gNum of gabaritoQNums) {
    if (!identifiedQNums.has(gNum)) {
      gabaritoWithoutQuestion++;
    }
  }

  // Determinar nível de confiança
  let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  if (questions.length === 0 || gabaritoEntries.length === 0) {
    confidenceLevel = 'LOW';
  } else if (questionsWithoutAnswer > 5 || discrepanciesCount > questions.length * 0.3) {
    confidenceLevel = 'MEDIUM';
  }

  const firstExamPage = examPages.length > 0 ? examPages[0].pageNumber : 1;
  const lastExamPage = examPages.length > 0 ? examPages[examPages.length - 1].pageNumber : rawPages.length;

  const summary: ExamExtractionSummary = {
    fileName,
    fileSizeBytes,
    fileSha256,
    totalPages: rawPages.length,
    questionPagesRange: [firstExamPage, lastExamPage],
    gabaritoPages: gabaritoPages.map(p => p.pageNumber),
    endMatterPages: endMatterPages.map(p => p.pageNumber),
    totalQuestionsIdentified: questions.length,
    totalGabaritoAnswersFound: gabaritoEntries.length,
    questionsWithAnswer,
    questionsWithoutAnswer,
    gabaritoWithoutQuestion,
    duplicateGabaritoEntries: duplicateNumbersInGabarito.size,
    anuladasCount,
    discrepanciesCount,
    confidenceLevel,
    extractedAt: new Date().toISOString(),
  };

  // 5. Detecção automática de metadados da prova (analisando todas as páginas e tags de questões)
  const metadata = detectExamMetadata(classifiedPages, fileName, questions);

  return {
    summary,
    metadata,
    pages: classifiedPages,
    questions,
  };
}
