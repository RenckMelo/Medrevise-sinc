/**
 * Tipos e interfaces do Importador de Provas Reais em PDF - MedRevise
 * Foco em fidelidade documental, rastreabilidade e integridade.
 */

export type QuestionType = 'OBJECTIVE' | 'DISCURSIVE';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED';

export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR';

export type MetadataFieldState = 'CONFIRMED' | 'CANDIDATE' | 'PENDING';

export interface ValidationAlert {
  code: string;
  message: string;
  severity: AlertSeverity;
}

export interface ExtractedAlternative {
  letter: string; // 'A', 'B', 'C', 'D', 'E', etc.
  text: string;
  originalIndex: number;
}

export interface ExtractedGabaritoEntry {
  questionNumber: number;
  answerLetter: string | null; // null se anulada ou discursiva
  isAnulada: boolean;
  isRetificada: boolean;
  pageNumber: number;
  rawSnippet: string; // Linha ou trecho exato do documento de onde foi extraído
  source: 'EXTRACTED_FROM_DOCUMENT';
  provenance: 'OFFICIAL_EXPLICIT' | 'DOCUMENT_FOUND' | 'UNVERIFIED';
  notes?: string;
}

export type ImageEvidenceType = 'EXPLICIT_TEXT_REFERENCE' | 'PAGE_IMAGE_PRESENT' | 'UNCONFIRMED_SUSPICION' | 'NONE';

export interface ExtractedQuestionTag {
  rawTag: string;
  institution?: string;
  banca?: string;
  ano?: number;
  anoEdital?: number;
  anoAplicacao?: number;
  especialidade?: string;
  modalidade?: string;
  orgao?: string;
  cargo?: string;
  disciplina?: string;
  assunto?: string;
  titulo?: string; // Título ou assunto da questão (ex: "Classificação de Schilling", "NR15...")
  duracao?: string;
  categoria?: string;
  natureza?: string;
  uf?: string;
  plataformaCodigo?: string;
  rawCatalogSpecialties?: string[]; // Especialidades listadas no catálogo editorial da plataforma
}

export interface RealExamQuestionItem {
  id: string; // SHA-256 canônico gerado a partir do conteúdo bruto
  questionNumber: number;
  statement: string; // Enunciado limpo da pergunta
  rawStatement?: string; // Enunciado bruto original antes da limpeza (para auditoria)
  alternatives: ExtractedAlternative[];
  correctAnswer?: string | null; // Resposta oficial extraída do gabarito documental
  sourcePages: number[]; // Páginas do PDF onde a questão se encontra (ex: [12] ou [12, 13])
  spansMultiplePages?: boolean;
  continuesFromPrevPage?: boolean;
  questionType: QuestionType;
  hasImages: boolean;
  imageEvidenceType?: ImageEvidenceType;
  imageRuleTriggered?: string;
  imageHints?: string[]; // Pistas encontradas no texto (ex: "figura 1", "radiografia")
  imageUrls?: string[]; // Imagens ou recortes extraídos da página
  extractedTag?: ExtractedQuestionTag; // Tag extraída do início ou cabeçalho da questão
  removedArtifacts?: string[]; // Elementos editoriais limpos do enunciado/alternativas
  gabarito: ExtractedGabaritoEntry | null;
  validationAlerts: ValidationAlert[];
  reviewStatus: ReviewStatus;
  adminModifications?: {
    editedStatement?: string;
    editedAlternatives?: ExtractedAlternative[];
    editedGabaritoLetter?: string | null;
    isAnulada?: boolean;
    notes?: string;
    updatedAt: string;
  };
}

export interface ExtractedPageData {
  pageNumber: number;
  text: string;
  charCount: number;
  isGabaritoPage: boolean;
  isEndMatter: boolean; // Bibliografia, anexos, etc.
  detectedKeywords: string[];
}

export interface ExamExtractionSummary {
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  totalPages: number;
  questionPagesRange: [number, number];
  gabaritoPages: number[];
  endMatterPages: number[];
  
  // Métricas de validação da associação
  totalQuestionsIdentified: number;
  totalGabaritoAnswersFound: number;
  questionsWithAnswer: number;
  questionsWithoutAnswer: number;
  gabaritoWithoutQuestion: number;
  duplicateGabaritoEntries: number;
  anuladasCount: number;
  discrepanciesCount: number;
  
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  extractedAt: string;
}

export interface MetadataEvidence {
  field: string;
  value: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  state: MetadataFieldState;
  sourceText: string;
  pageNumber: number;
}

export interface MetadataConflict {
  field: string;
  values: { value: string; pageNumber: number; count: number }[];
  notes: string;
}

export interface DetectedExamMetadata {
  examName: string | null;
  institution: string | null;
  banca: string | null;
  anoAplicacao: number | null;
  anoPublicacao: number | null;
  modalidade: string | null;

  // Estados de confirmação
  examNameState: MetadataFieldState;
  institutionState: MetadataFieldState;
  bancaState: MetadataFieldState;
  anoAplicacaoState: MetadataFieldState;
  anoPublicacaoState: MetadataFieldState;
  modalidadeState: MetadataFieldState;

  evidenceSources: MetadataEvidence[];
  conflicts: MetadataConflict[];

  isGabaritoOficialComprovado: boolean;
  gabaritoProvenance: 'OFFICIAL_EXPLICIT' | 'DOCUMENT_FOUND' | 'UNVERIFIED';

  especialidadesList?: string[]; // Lista de especialidades detectadas nas questões
  multipleExamsDetected: boolean;
  notes?: string;
}

export interface ExtractionResult {
  summary: ExamExtractionSummary;
  metadata: DetectedExamMetadata;
  pages: ExtractedPageData[];
  questions: RealExamQuestionItem[];
}
