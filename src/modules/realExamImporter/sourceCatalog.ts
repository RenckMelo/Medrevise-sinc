/**
 * Catálogo de Fontes Oficiais e Planejamento de Coleta Automática - MedRevise
 * 
 * Estrutura para catalogar e rastrear provas médicas reais de fontes autorizadas
 * com deduplicação por hash SHA-256 e proveniência estrita.
 */

export type DocumentType = 
  | 'CADERNO_PROVA_COM_GABARITO'
  | 'CADERNO_PROVA'
  | 'GABARITO_DEFINITIVO'
  | 'GABARITO_PRELIMINAR';

export type GabaritoVersion = 'DEFINITIVO' | 'PRELIMINAR' | 'RETIFICADO' | 'NAO_DISPONIVEL';

export type CollectionStatus = 
  | 'PENDENTE'
  | 'COLETADO'
  | 'EXTRAIDO'
  | 'HOMOLOGADO'
  | 'FALHA';

export interface SourceCatalogEntry {
  id: string; // Identificador único estável da fonte
  institution: string; // Ex: "ENARE / EBSERH", "USP-SP", "UNICAMP"
  banca: string; // Ex: "FGV Conhecimento", "FUVEST", "VUNESP"
  examName: string; // Ex: "Exame Nacional de Residência Médica 2024"
  year: number; // Ano de aplicação
  officialPortalUrl: string; // Página oficial de download / processo seletivo
  pdfUrl?: string; // URL direta do PDF oficial, quando disponível
  documentType: DocumentType;
  fileSha256?: string; // Hash do PDF baixado (evita duplicatas físicas)
  gabaritoVersion: GabaritoVersion;
  collectionStatus: CollectionStatus;
  collectedAt?: string;
  notes?: string;
}

/**
 * Catálogo inicial de fontes oficiais consolidadas dos principais exames de residência médica no Brasil
 */
export const OFFICIAL_SOURCES_CATALOG: SourceCatalogEntry[] = [
  {
    id: 'enare-2024-acesso-direto',
    institution: 'ENARE / EBSERH',
    banca: 'FGV Conhecimento',
    examName: 'ENARE 2024 - Acesso Direto',
    year: 2024,
    officialPortalUrl: 'https://enare.ebserh.gov.br',
    documentType: 'CADERNO_PROVA_COM_GABARITO',
    gabaritoVersion: 'DEFINITIVO',
    collectionStatus: 'PENDENTE',
    notes: 'Exame Nacional Unificado realizado pela FGV para a rede EBSERH e hospitais federais.',
  },
  {
    id: 'enare-2023-acesso-direto',
    institution: 'ENARE / EBSERH',
    banca: 'IBFC',
    examName: 'ENARE 2023 - Acesso Direto',
    year: 2023,
    officialPortalUrl: 'https://enare.ebserh.gov.br',
    documentType: 'CADERNO_PROVA_COM_GABARITO',
    gabaritoVersion: 'DEFINITIVO',
    collectionStatus: 'PENDENTE',
    notes: 'Edição 2023 organizada pelo Instituto IBFC.',
  },
  {
    id: 'usp-sp-2024-r1',
    institution: 'USP - Universidade de São Paulo',
    banca: 'FUVEST',
    examName: 'Residência Médica FMUSP 2024',
    year: 2024,
    officialPortalUrl: 'https://www.fuvest.br/residencia-medica',
    documentType: 'CADERNO_PROVA_COM_GABARITO',
    gabaritoVersion: 'DEFINITIVO',
    collectionStatus: 'PENDENTE',
    notes: 'Processo seletivo FUVEST/FMUSP para médicos residentes.',
  },
  {
    id: 'unicamp-2024-acesso-direto',
    institution: 'UNICAMP',
    banca: 'Comissão de Residência Médica FCM/Unicamp',
    examName: 'Residência Médica UNICAMP 2024',
    year: 2024,
    officialPortalUrl: 'https://www.fcm.unicamp.br/posgraduacao/residencia-medica',
    documentType: 'CADERNO_PROVA_COM_GABARITO',
    gabaritoVersion: 'DEFINITIVO',
    collectionStatus: 'PENDENTE',
    notes: 'Prova regular de acesso direto da Faculdade de Ciências Médicas da Unicamp.',
  },
  {
    id: 'sus-sp-2024-acesso-direto',
    institution: 'SUS-SP',
    banca: 'Fundação VUNESP',
    examName: 'Seleção Pública de Residência Médica SUS-SP 2024',
    year: 2024,
    officialPortalUrl: 'https://www.vunesp.com.br',
    documentType: 'CADERNO_PROVA_COM_GABARITO',
    gabaritoVersion: 'DEFINITIVO',
    collectionStatus: 'PENDENTE',
    notes: 'Maior processo seletivo unificado do estado de SP para hospitais estaduais.',
  },
  {
    id: 'psu-mg-2024-acesso-direto',
    institution: 'PSU-MG / AREMG',
    banca: 'AREMG',
    examName: 'Processo Seletivo Unificado de Minas Gerais 2024',
    year: 2024,
    officialPortalUrl: 'https://www.aremg.org.br',
    documentType: 'CADERNO_PROVA_COM_GABARITO',
    gabaritoVersion: 'DEFINITIVO',
    collectionStatus: 'PENDENTE',
    notes: 'Exame unificado para hospitais de Minas Gerais.',
  },
  {
    id: 'surce-2024-acesso-direto',
    institution: 'SURCE',
    banca: 'Ares Ceará',
    examName: 'Seleção Unificada para Residência Médica no Ceará 2024',
    year: 2024,
    officialPortalUrl: 'https://www.resmedceara.ufc.br',
    documentType: 'CADERNO_PROVA_COM_GABARITO',
    gabaritoVersion: 'DEFINITIVO',
    collectionStatus: 'PENDENTE',
    notes: 'Exame unificado das instituições do Ceará.',
  },
  {
    id: 'amrigs-2024-acesso-direto',
    institution: 'AMRIGS',
    banca: 'AMRIGS / Fundatec',
    examName: 'Exame AMRIGS 2024',
    year: 2024,
    officialPortalUrl: 'https://www.amrigs.org.br/exame',
    documentType: 'CADERNO_PROVA_COM_GABARITO',
    gabaritoVersion: 'DEFINITIVO',
    collectionStatus: 'PENDENTE',
    notes: 'Exame utilizado por instituições do Sul e Centro-Oeste.',
  },
  {
    id: 'revalida-inep-2024-1',
    institution: 'INEP / Revalida',
    banca: 'Cebraspe / INEP',
    examName: 'Revalida 2024/1 - Prova Objetiva P1',
    year: 2024,
    officialPortalUrl: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/revalida',
    documentType: 'CADERNO_PROVA_COM_GABARITO',
    gabaritoVersion: 'DEFINITIVO',
    collectionStatus: 'PENDENTE',
    notes: 'Exame Nacional de Revalidação de Diplomas Médicos.',
  },
];

/**
 * Consulta se um hash SHA-256 já foi catalogado (prevenção rigorosa de duplicatas)
 */
export function isDuplicateFile(sha256: string, catalog: SourceCatalogEntry[] = OFFICIAL_SOURCES_CATALOG): boolean {
  if (!sha256) return false;
  return catalog.some(entry => entry.fileSha256?.toLowerCase() === sha256.toLowerCase());
}

/**
 * Instituições e Bancas conhecidas do ecossistema médico brasileiro
 */
export const KNOWN_INSTITUTIONS = [
  { sigla: 'ENARE', nome: 'Exame Nacional de Residência Médica', exam: 'ENARE' },
  { sigla: 'USP', nome: 'Universidade de São Paulo', exam: 'Residência Médica USP' },
  { sigla: 'UNICAMP', nome: 'Universidade Estadual de Campinas', exam: 'Residência Médica UNICAMP' },
  { sigla: 'UNIFESP', nome: 'Universidade Federal de São Paulo', exam: 'Residência Médica UNIFESP' },
  { sigla: 'SUS-SP', nome: 'Secretaria de Estado da Saúde de São Paulo', exam: 'SUS-SP' },
  { sigla: 'SURCE', nome: 'Seleção Unificada para Residência Médica no Ceará', exam: 'SURCE' },
  { sigla: 'PSU-MG', nome: 'Processo Seletivo Unificado de Minas Gerais', exam: 'PSU-MG' },
  { sigla: 'AMRIGS', nome: 'Associação Médica do Rio Grande do Sul', exam: 'Exame AMRIGS' },
  { sigla: 'UFRJ', nome: 'Universidade Federal do Rio de Janeiro', exam: 'Residência Médica UFRJ' },
  { sigla: 'UERJ', nome: 'Universidade do Estado do Rio de Janeiro', exam: 'Residência Médica UERJ' },
  { sigla: 'UFG', nome: 'Universidade Federal de Goiás', exam: 'Residência Médica UFG' },
  { sigla: 'UFPE', nome: 'Universidade Federal de Pernambuco', exam: 'Residência Médica UFPE' },
  { sigla: 'UFMG', nome: 'Universidade Federal de Minas Gerais', exam: 'Residência Médica UFMG' },
  { sigla: 'UFRGS', nome: 'Universidade Federal do Rio Grande do Sul', exam: 'Residência Médica UFRGS' },
  { sigla: 'SCMSP', nome: 'Santa Casa de Misericórdia de São Paulo', exam: 'Residência Médica SCMSP' },
  { sigla: 'IAMSPE', nome: 'Instituto de Assistência Médica ao Servidor Público Estadual', exam: 'Residência Médica IAMSPE' },
  { sigla: 'SES-DF', nome: 'Secretaria de Estado de Saúde do Distrito Federal', exam: 'Residência Médica SES-DF' },
  { sigla: 'HFA', nome: 'Hospital das Forças Armadas', exam: 'Residência Médica HFA' },
  { sigla: 'REVALIDA', nome: 'Exame Nacional de Revalidação de Diplomas Médicos', exam: 'Revalida INEP' },
];

export const KNOWN_BANCAS = [
  { nome: 'FGV Conhecimento', sigla: 'FGV' },
  { nome: 'VUNESP', sigla: 'VUNESP' },
  { nome: 'FUVEST', sigla: 'FUVEST' },
  { nome: 'Cebraspe', sigla: 'CEBRASPE' },
  { nome: 'IBFC', sigla: 'IBFC' },
  { nome: 'Instituto Ibest', sigla: 'IBEST' },
  { nome: 'Instituto AOCP', sigla: 'AOCP' },
  { nome: 'FUNDATEC', sigla: 'FUNDATEC' },
  { nome: 'Instituto Quadrix', sigla: 'QUADRIX' },
  { nome: 'Consulpam', sigla: 'CONSULPAM' },
  { nome: 'CS-UFG', sigla: 'CS-UFG' },
  { nome: 'FCC', sigla: 'FCC' },
  { nome: 'IDIB', sigla: 'IDIB' },
  { nome: 'IDECAN', sigla: 'IDECAN' },
  { nome: 'CONSULPLAN', sigla: 'CONSULPLAN' },
  { nome: 'SELECON', sigla: 'SELECON' },
  { nome: 'AREMG', sigla: 'AREMG' },
];

/**
 * Registra ou atualiza um arquivo coletado no catálogo
 */
export function registerCollectedExam(
  entry: Omit<SourceCatalogEntry, 'collectedAt'>,
  catalog: SourceCatalogEntry[] = OFFICIAL_SOURCES_CATALOG
): SourceCatalogEntry {
  const existingIdx = catalog.findIndex(e => e.id === entry.id || (entry.fileSha256 && e.fileSha256 === entry.fileSha256));
  const fullEntry: SourceCatalogEntry = {
    ...entry,
    collectedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    catalog[existingIdx] = fullEntry;
  } else {
    catalog.push(fullEntry);
  }

  return fullEntry;
}
