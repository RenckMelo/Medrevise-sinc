/**
 * Testes Unitários e de Integração: Importador de Provas Reais em PDF - MedRevise
 * Executa testes rigorosos de integridade de layout, enunciados, alternativas, gabarito, metadados e validação.
 */

import { 
  classifyPages, 
  extractGabaritoEntries, 
  extractQuestionsFromPages, 
  processExamDocument,
  detectExamMetadata,
  computeSha256,
  cleanQuestionContent,
  isRepetitiveYearLine,
  isMetadataKeyValueLine,
  isSpecialtyTagLine,
  parseQuestionBlock,
  parsePlatformCatalogLine,
  IMAGE_CUES_RULES
} from '../src/modules/realExamImporter/examExtractor';
import { ExtractedPageData, RealExamQuestionItem } from '../src/modules/realExamImporter/types';

async function runTestSuite() {
  console.log('================================================================');
  console.log('INICIANDO BATERIA DE TESTES DO IMPORTADOR DE PROVAS REAIS (PDF)');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Detalhe: ${detail}`);
    }
  }

  // TESTE 1: Hash SHA-256 canônico
  const hash1 = await computeSha256('MedRevise 2026 Test Content');
  const hash2 = await computeSha256('MedRevise 2026 Test Content');
  const hash3 = await computeSha256('Different Content');
  assert(hash1 === hash2 && hash1 !== hash3 && hash1.length === 64, 'Geração de Hash Canônico SHA-256 determinístico');

  // TESTE 2: Classificação de páginas (Prova vs Gabarito vs Bibliografia)
  const samplePages: ExtractedPageData[] = classifyPages([
    { pageNumber: 1, text: 'CADERNO DE QUESTÕES OBJETIVAS\nQUESTÃO 1\nPaciente com dor torácica...' },
    { pageNumber: 2, text: 'QUESTÃO 2\nGestante no terceiro trimestre...' },
    { pageNumber: 3, text: 'QUESTÃO 3\nLactente com febre...' },
    { pageNumber: 4, text: 'UNIVERSIDADE DE MEDICINA\nGABARITO OFICIAL DEFINITIVO DAS QUESTÕES\n1 A\n2 B\n3 C' },
    { pageNumber: 5, text: 'REFERÊNCIAS BIBLIOGRÁFICAS E NORMAS TÉCNICAS ADOTADAS PELA BANCA' },
  ]);

  assert(samplePages[0].isGabaritoPage === false && samplePages[0].isEndMatter === false, 'Página 1 classificada como Questões');
  assert(samplePages[3].isGabaritoPage === true && samplePages[3].isEndMatter === false, 'Página 4 identificada como Gabarito Oficial');
  assert(samplePages[4].isGabaritoPage === false && samplePages[4].isEndMatter === true, 'Página 5 identificada como Bibliografia/End-Matter');

  // TESTE 3: Extração de Gabarito em múltiplos formatos (Tabela, Inline, Anuladas)
  const gabaritoTextPage: ExtractedPageData = {
    pageNumber: 15,
    text: `GABARITO OFICIAL
01: B
02 - C
3. A
04 - ANULADA
5 - D
06 | E
07: RETIFICADA`,
    charCount: 100,
    isGabaritoPage: true,
    isEndMatter: false,
    detectedKeywords: ['GABARITO OFICIAL'],
  };

  const gabaritoEntries = extractGabaritoEntries([gabaritoTextPage]);
  assert(gabaritoEntries.length >= 6, `Extração de respostas do gabarito (encontradas: ${gabaritoEntries.length})`);
  
  const q1 = gabaritoEntries.find(g => g.questionNumber === 1);
  const q2 = gabaritoEntries.find(g => g.questionNumber === 2);
  const q4 = gabaritoEntries.find(g => g.questionNumber === 4);

  assert(q1?.answerLetter === 'B', 'Questão 01 gabarito B');
  assert(q2?.answerLetter === 'C', 'Questão 02 gabarito C');
  assert(q4?.isAnulada === true && q4?.answerLetter === null, 'Questão 04 identificada como ANULADA com resposta nula');

  // ============================================================================
  // TESTES OBRIGATÓRIOS DO PROMPT (REQUISITO 6)
  // ============================================================================

  // 1. Metadados presentes após a quinta página
  console.log('\n--- 1. METADADOS PRESENTES APÓS A QUINTA PÁGINA ---');
  const lateMetadataPages: ExtractedPageData[] = [
    { pageNumber: 1, text: 'QUESTÃO 1\nEnunciado...', charCount: 20, isGabaritoPage: false, isEndMatter: false, detectedKeywords: [] },
    { pageNumber: 2, text: 'QUESTÃO 2\nEnunciado...', charCount: 20, isGabaritoPage: false, isEndMatter: false, detectedKeywords: [] },
    { pageNumber: 3, text: 'QUESTÃO 3\nEnunciado...', charCount: 20, isGabaritoPage: false, isEndMatter: false, detectedKeywords: [] },
    { pageNumber: 4, text: 'QUESTÃO 4\nEnunciado...', charCount: 20, isGabaritoPage: false, isEndMatter: false, detectedKeywords: [] },
    { pageNumber: 5, text: 'QUESTÃO 5\nEnunciado...', charCount: 20, isGabaritoPage: false, isEndMatter: false, detectedKeywords: [] },
    { pageNumber: 6, text: 'QUESTÃO 6\nEnunciado...', charCount: 20, isGabaritoPage: false, isEndMatter: false, detectedKeywords: [] },
    { 
      pageNumber: 7, 
      text: 'CONCURSO DE RESIDÊNCIA MÉDICA 2025\nUNIVERSIDADE FEDERAL DO RIO DE JANEIRO - UFRJ\nBANCA EXAMINADORA: FGV', 
      charCount: 100, 
      isGabaritoPage: false, 
      isEndMatter: false, 
      detectedKeywords: [] 
    },
  ];
  const lateMetaResult = detectExamMetadata(lateMetadataPages, 'prova_tardia.pdf');
  assert(lateMetaResult.anoAplicacao === 2025, 'Ano 2025 detectado na página 7 (após 5ª página)');
  assert(lateMetaResult.institution === 'UFRJ', 'Instituição UFRJ detectada na página 7');
  assert(lateMetaResult.banca === 'FGV', 'Banca FGV detectada na página 7');
  assert(lateMetaResult.evidenceSources.some(e => e.pageNumber === 7), 'Rastreabilidade para página de origem 7 preservada');

  // 2. Instituição ou banca fora do catálogo existente
  console.log('\n--- 2. INSTITUIÇÃO OU BANCA FORA DO CATÁLOGO EXISTENTE ---');
  const uncatalogedPages: ExtractedPageData[] = [
    {
      pageNumber: 1,
      text: `PROCESSO SELETIVO DE RESIDÊNCIA MÉDICA\nORGANIZADORA: INSTITUTO ACCESS\nUNIVERSIDADE ESTADUAL DO CENTRO-OESTE\nPROVA OBJETIVA 2025`,
      charCount: 150,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: [],
    }
  ];
  const uncatalogedMeta = detectExamMetadata(uncatalogedPages, 'prova_uncataloged.pdf');
  assert(uncatalogedMeta.institution === 'UNIVERSIDADE ESTADUAL DO CENTRO-OESTE', 'Instituição fora do catálogo detectada via padrão aberto');
  assert(uncatalogedMeta.banca === 'INSTITUTO ACCESS', 'Banca fora do catálogo detectada via padrão aberto');
  assert(uncatalogedMeta.institutionState === 'CANDIDATE' || uncatalogedMeta.institutionState === 'CONFIRMED', 'Estado de instituição atribuído');

  // 3. Ano presente nas tags das questões
  console.log('\n--- 3. ANO PRESENTE NAS TAGS DAS QUESTÕES ---');
  const taggedQuestionPages: ExtractedPageData[] = [
    {
      pageNumber: 1,
      text: `[2024 - USP - CIRURGIA] 1. Paciente do sexo masculino, 45 anos, com dor em fossa ilíaca direita...\nA) Apendicectomia\nB) Conduta expectante\nC) Antibioticoterapia isolada\nD) Laparotomia exploradora`,
      charCount: 200,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: [],
    }
  ];
  const taggedQuestions = await extractQuestionsFromPages(taggedQuestionPages, new Map());
  assert(taggedQuestions.length === 1, 'Questão com tag inicial identificada');
  assert(taggedQuestions[0].extractedTag?.ano === 2024, 'Ano 2024 extraído da tag da questão');
  assert(taggedQuestions[0].extractedTag?.institution === 'USP', 'Instituição USP extraída da tag');
  assert(taggedQuestions[0].extractedTag?.especialidade?.toUpperCase() === 'CIRURGIA', 'Especialidade CIRURGIA extraída da tag');
  const metaFromTag = detectExamMetadata(taggedQuestionPages, 'prova.pdf', taggedQuestions);
  assert(metaFromTag.anoAplicacao === 2024, 'Ano de aplicação consolidado a partir da tag da questão');

  // 4. Documentos com metadados conflitantes
  console.log('\n--- 4. DOCUMENTOS COM METADADOS CONFLITANTES ---');
  const conflictingPages: ExtractedPageData[] = [
    {
      pageNumber: 1,
      text: `[2023 - USP] QUESTÃO 1\nPaciente com hipertensão...\nA) IECA\nB) BRA\nC) Diurético\nD) Betabloqueador`,
      charCount: 150,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: [],
    },
    {
      pageNumber: 2,
      text: `[2024 - ENARE] QUESTÃO 2\nGestante no primeiro trimestre...\nA) Ácido fólico\nB) Sulfato ferroso\nC) Cálcio\nD) Vitamina D`,
      charCount: 150,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: [],
    }
  ];
  const conflictingQuestions = await extractQuestionsFromPages(conflictingPages, new Map());
  const conflictingMeta = detectExamMetadata(conflictingPages, 'caderno_mesclado.pdf', conflictingQuestions);
  assert(conflictingMeta.conflicts.length > 0 || conflictingMeta.multipleExamsDetected === true, 'Conflito de metadados detectado entre questões com bancas/anos distintos');
  assert(conflictingMeta.multipleExamsDetected === true, 'Flag multipleExamsDetected ativada para alerta visual');

  // 5. Numeração sem a palavra “QUESTÃO” (ex: "01." ou "1 -")
  console.log('\n--- 5. NUMERAÇÃO SEM A PALAVRA "QUESTÃO" ---');
  const numericOnlyPages: ExtractedPageData[] = [
    {
      pageNumber: 1,
      text: `01. Homem de 62 anos hipertenso com dor precordial...\nA) Eletrocardiograma\nB) Raio-X de tórax\nC) Tomografia\nD) Ecocardiograma\n\n2 - Mulher de 28 anos com cefaleia súbita...\nA) TC de crânio sem contraste\nB) Punção lombar imediata\nC) Ressonância\nD) Analgesia simples`,
      charCount: 300,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: [],
    }
  ];
  const numericQuestions = await extractQuestionsFromPages(numericOnlyPages, new Map());
  assert(numericQuestions.length === 2, `Segmentação sem a palavra QUESTÃO: ${numericQuestions.length} questões encontradas`);
  assert(numericQuestions[0].questionNumber === 1, 'Questão 01 identificada corretamente');
  assert(numericQuestions[1].questionNumber === 2, 'Questão 2 identificada corretamente');
  assert(numericQuestions[0].alternatives.length === 4, 'Alternativas A-D preservadas para questão 1');
  assert(numericQuestions[1].alternatives.length === 4, 'Alternativas A-D preservadas para questão 2');

  // 6. Questões divididas entre páginas (multi-página)
  console.log('\n--- 6. QUESTÕES DIVIDIDAS ENTRE PÁGINAS ---');
  const multiPageDoc: ExtractedPageData[] = [
    {
      pageNumber: 1,
      text: `QUESTÃO 01\nPaciente de 70 anos admitido com quadro de choque séptico de foco pulmonar. Apresenta hipotensão refratária a volume e taquipneia. Ao exame físico: PA 70x40 mmHg, FC 125 bpm.`,
      charCount: 180,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: [],
    },
    {
      pageNumber: 2,
      text: `Em relação à conduta vasopressora imediata recomendada pelas diretrizes atuais da Surviving Sepsis Campaign, assinale a opção correta:\nA) Iniciar noradrenalina como droga de primeira escolha.\nB) Prescrever dopamina em dose renal.\nC) Administrar adrenalina em infusão isolada.\nD) Iniciar vasopressina como monoterapia inicial.`,
      charCount: 280,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: [],
    }
  ];
  const multiPageQuestions = await extractQuestionsFromPages(multiPageDoc, new Map());
  assert(multiPageQuestions.length === 1, 'Questão contínua unificada em uma única instância');
  assert(multiPageQuestions[0].sourcePages.length === 2 && multiPageQuestions[0].sourcePages.includes(1) && multiPageQuestions[0].sourcePages.includes(2), 'Questão rastreada nas páginas 1 e 2');
  assert(multiPageQuestions[0].spansMultiplePages === true, 'Flag spansMultiplePages ativada');
  assert(multiPageQuestions[0].alternatives.length === 4, 'Alternativas da página seguinte associadas com sucesso');

  // 7. Gabarito compacto no final do documento ("1 A 2 B 3 C 4 D 5 E")
  console.log('\n--- 7. GABARITO COMPACTO NO FINAL DO DOCUMENTO ---');
  const compactGabaritoPages: ExtractedPageData[] = [
    {
      pageNumber: 10,
      text: `UNIVERSIDADE DE MEDICINA\nFOLHA DE RESPOSTAS\n1 A 2 B 3 C 4 D 5 E 6 A 7 B 8 C`,
      charCount: 80,
      isGabaritoPage: true,
      isEndMatter: false,
      detectedKeywords: ['FOLHA DE RESPOSTAS'],
    }
  ];
  const compactEntries = extractGabaritoEntries(compactGabaritoPages);
  assert(compactEntries.length === 8, `Extração de gabarito compacto: ${compactEntries.length} respostas extraídas`);
  assert(compactEntries[0].questionNumber === 1 && compactEntries[0].answerLetter === 'A', 'Resposta 1: A');
  assert(compactEntries[4].questionNumber === 5 && compactEntries[4].answerLetter === 'E', 'Resposta 5: E');
  assert(compactEntries[7].questionNumber === 8 && compactEntries[7].answerLetter === 'C', 'Resposta 8: C');

  // 8. Respostas ausentes ou duplicadas no gabarito
  console.log('\n--- 8. RESPOSTAS AUSENTES OU DUPLICADAS NO GABARITO ---');
  const duplicatedGabaritoPages: ExtractedPageData[] = [
    {
      pageNumber: 2,
      text: `GABARITO OFICIAL\n1 A\n1 B\n2 C`,
      charCount: 30,
      isGabaritoPage: true,
      isEndMatter: false,
      detectedKeywords: ['GABARITO OFICIAL'],
    }
  ];
  const dupEntries = extractGabaritoEntries(duplicatedGabaritoPages);
  const dupEntry = dupEntries.find(d => d.notes?.includes('duplicado'));
  assert(dupEntry !== undefined, 'Detecção de número duplicado no gabarito com nota de alerta');

  // Teste de questão com gabarito ausente
  const docWithMissingAnswer: ExtractedPageData[] = [
    {
      pageNumber: 1,
      text: `QUESTÃO 1\nEnunciado 1\nA) Op 1\nB) Op 2\n\nQUESTÃO 2\nEnunciado 2\nA) Op 1\nB) Op 2`,
      charCount: 80,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: [],
    },
    {
      pageNumber: 2,
      text: `GABARITO OFICIAL\n1 A`,
      charCount: 20,
      isGabaritoPage: true,
      isEndMatter: false,
      detectedKeywords: ['GABARITO OFICIAL'],
    }
  ];
  const missingAnsResult = await processExamDocument('missing_ans.pdf', 100, 'sha', docWithMissingAnswer);
  assert(missingAnsResult.summary.questionsWithoutAnswer === 1, 'Métrica de questões sem gabarito registrada');
  const q2Missing = missingAnsResult.questions.find(q => q.questionNumber === 2);
  assert(q2Missing?.validationAlerts.some(a => a.code === 'MISSING_GABARITO'), 'Alerta MISSING_GABARITO emitido para questão 2 sem resposta');

  // 9. Documento com extração de texto vazia ou incompleta
  console.log('\n--- 9. DOCUMENTO COM EXTRAÇÃO DE TEXTO VAZIA OU INCOMPLETA ---');
  const emptyDocResult = await processExamDocument('empty.pdf', 0, 'empty_sha', []);
  assert(emptyDocResult.summary.totalQuestionsIdentified === 0, 'Zero questões em documento vazio');
  assert(emptyDocResult.summary.confidenceLevel === 'LOW', 'Nível de confiança LOW atribuído');
  assert(emptyDocResult.questions.length === 0, 'Execução graciosa sem lançamento de erro não capturado');

  // ============================================================================
  // TESTE 10: HIGIENIZAÇÃO DE ENUNCIADOS E REMOÇÃO DE CONTAMINAÇÃO EDITORIAL
  // ============================================================================
  console.log('\n--- 10. HIGIENIZAÇÃO DE ENUNCIADOS E REMOÇÃO DE CONTAMINAÇÃO EDITORIAL ---');

  // A. Detecção de Anos Repetidos
  assert(isRepetitiveYearLine('2021 2021 2021 2021'), 'Reconhecimento de linha com anos repetidos (2021 2021 2021 2021)');
  assert(isRepetitiveYearLine('2021 / 2021 / 2021'), 'Reconhecimento de linha com anos repetidos com barras');
  assert(isRepetitiveYearLine('2021'), 'Reconhecimento de ano único isolado como tag editorial');
  assert(!isRepetitiveYearLine('Homem de 45 anos, hipertenso desde 2018'), 'Não confunde frase clínica com anos repetidos');

  // B. Detecção de Metadados Chave: Valor
  assert(isMetadataKeyValueLine('Ano: 2021'), 'Reconhece Ano: 2021');
  assert(isMetadataKeyValueLine('Banca: CEBRASPE'), 'Reconhece Banca: CEBRASPE');
  assert(isMetadataKeyValueLine('Duração: 4 horas'), 'Reconhece Duração: 4 horas');
  assert(isMetadataKeyValueLine('Categoria: Residência Médica'), 'Reconhece Categoria: Residência Médica');
  assert(isMetadataKeyValueLine('Natureza: Pública'), 'Reconhece Natureza: Pública');
  assert(!isMetadataKeyValueLine('Paciente com dor torácica iniciada há 4 horas'), 'Não confunde duração clínica no paciente');

  // C. Detecção de Linhas Puras de Especialidades
  assert(isSpecialtyTagLine('Clínica Médica Ginecologia e Obstetrícia Pediatria Cirurgia Geral'), 'Reconhece lista pura de especialidades em tags');
  assert(isSpecialtyTagLine('Medicina > Clínica Médica > Cardiologia'), 'Reconhece árvore de especialidades com setas');
  assert(!isSpecialtyTagLine('Paciente encaminhado à Clínica Médica com quadro de insuficiência cardíaca'), 'Preserva frase clínica legítima citando Clínica Médica');

  // D. Limpeza Integral do Conteúdo Extraído com Preservação Clínica
  const dirtyStatement = `2021 2021 2021 2021
Ano: 2021 Banca: VUNESP Órgão: UNIFESP Prova: Residência Médica
Duração: 4 horas Categoria: Residência Médica Natureza: Pública
Clínica Médica Cardiologia Acesso Direto
Essa questão possui comentário do professor no site 4000142459
Paciente masculino, 64 anos de idade, hipertenso de longa data e diabético em uso de metformina, dá entrada no pronto-socorro com dor retroesternal em aperto iniciada há 2 horas. O eletrocardiograma demonstra supradesnivelamento do segmento ST de 2,5 mm nas derivações DII, DIII e aVF. A troponina ultrassensível está positiva.
Com base no quadro clínico e nas diretrizes vigentes, assinale a conduta imediata:`;

  const dirtyAlternatives = [
    { letter: 'A', text: 'Encaminhar para angioplastia coronária primária imediata.', originalIndex: 0 },
    { letter: 'B', text: 'Prescrever analgésico comum e alta com retorno ambulatorial.', originalIndex: 1 },
    { letter: 'C', text: 'Solicitar radiografia de tórax e aguardar 12 horas.\nPágina 1 de 8\nwww.qconcursos.com\n2021 2021 2021', originalIndex: 2 },
    { letter: 'D', text: 'Indicar pericardiocentese exploratória de urgência.', originalIndex: 3 }
  ];

  const cleaned = cleanQuestionContent(dirtyStatement, dirtyAlternatives);

  assert(!cleaned.cleanedStatement.includes('2021 2021 2021 2021'), 'Anos repetidos removidos do enunciado');
  assert(!cleaned.cleanedStatement.includes('Essa questão possui comentário do professor no site'), 'Frase de comentário do site removida');
  assert(!cleaned.cleanedStatement.includes('4000142459'), 'Identificador numérico do site removido do enunciado');
  assert(!cleaned.cleanedStatement.includes('Duração: 4 horas'), 'Metadado de duração removido');
  assert(!cleaned.cleanedStatement.includes('Categoria: Residência Médica'), 'Metadado de categoria removido');
  assert(!cleaned.cleanedStatement.includes('Natureza: Pública'), 'Metadado de natureza removido');
  assert(!cleaned.cleanedStatement.includes('Clínica Médica Cardiologia Acesso Direto'), 'Lista de tags de especialidades removida do enunciado');
  assert(cleaned.cleanedStatement.startsWith('Paciente masculino, 64 anos de idade'), 'Enunciado clínico legítimo preservado integralmente');
  assert(cleaned.cleanedStatement.includes('troponina ultrassensível está positiva'), 'Valores clínicos e termos laboratoriais preservados');
  assert(cleaned.cleanedAlternatives[2].text === 'Solicitar radiografia de tórax e aguardar 12 horas.', 'Rodapé de página e URL removidos da alternativa C');
  assert(cleaned.updatedTag?.plataformaCodigo === '4000142459', 'Código da plataforma 4000142459 capturado na tag');
  assert(cleaned.updatedTag?.ano === 2021, 'Ano 2021 capturado na tag');
  assert(cleaned.updatedTag?.banca === 'VUNESP', 'Banca VUNESP capturada na tag');
  assert(cleaned.updatedTag?.modalidade === 'Acesso Direto (R1)', 'Modalidade Acesso Direto capturada na tag');
  assert(cleaned.removedArtifacts.length >= 5, `Registrados ${cleaned.removedArtifacts.length} artefatos editoriais removidos para auditoria`);

  // ============================================================================
  // TESTE 11: PROVA REAL COM 8 QUESTÕES E GABARITO FINAL ASSOCIADO
  // ============================================================================
  console.log('\n--- 11. PROVA REAL COM 8 QUESTÕES E GABARITO FINAL ASSOCIADO ---');

  const realEightQuestionsPages: ExtractedPageData[] = [
    {
      pageNumber: 1,
      text: `CONCURSO PÚBLICO DE RESIDÊNCIA MÉDICA 2021
ORGANIZADORA: CEBRASPE
HOSPITAL DE BASE DO DISTRITO FEDERAL

[2021 2021 2021 - CLÍNICA MÉDICA] QUESTÃO 1
Duração: 4 horas Categoria: Residência Médica Natureza: Pública
Essa questão possui comentário do professor no site 4000142459
Mulher de 35 anos apresenta fadiga progressiva, ganho de peso e constipação. Ao exame: tireoide difusamente aumentada, indolor. TSH: 18 mUI/L, T4 livre diminuído. Anticorpo anti-TPO positivo. Assinale o diagnóstico mais provável:
A) Tireoidite de Hashimoto
B) Doença de Graves
C) Tireoidite subaguda de De Quervain
D) Bócio coloide simples

[2021 2021 2021 - PEDIATRIA] QUESTÃO 2
Duração: 4 horas Categoria: Residência Médica
Essa questão possui comentário do professor no site 4000142460
Lactente de 6 meses é levado à emergência com tosse, coriza e taquipneia iniciadas há 3 dias. Ao exame: tiragem subcostal e sibilos difusos. Diagnóstico de bronquiolite viral aguda. A conduta primordial é:
A) Iniciar suporte de oxigênio se saturação < 90% e hidratação adequada
B) Prescrever salbutamol inalatório de rotina
C) Iniciar corticoide sistêmico oral
D) Prescrever antibioticoterapia empírica com amoxicilina`,
      charCount: 800,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: []
    },
    {
      pageNumber: 2,
      text: `[2021 2021 2021 - CIRURGIA GERAL] QUESTÃO 3
Essa questão possui comentário do professor no site 4000142461
Homem de 28 anos, vítima de agressão por arma branca em hipocôndrio direito, dá entrada com PA 80x40 mmHg e FC 130 bpm. Abdome tenso e doloroso difusamente. A conduta é:
A) Laparotomia exploradora imediata
B) Tomografia computadorizada de abdome com contraste
C) Ultrassonografia FAST ambulatorial
D) Punção de alívio com agulha fina

[2021 2021 2021 - GINECOLOGIA E OBSTETRÍCIA] QUESTÃO 4
Essa questão possui comentário do professor no site 4000142462
Primigesta com 38 semanas de idade gestacional dá entrada em trabalho de parto. PA 160x110 mmHg, proteinúria de fita +++. Reflexos patelares exaltados. O medicamento de escolha para prevenção de convulsões é:
A) Sulfato de magnésio
B) Hidralazina intravenosa
C) Diazepam endovenoso
D) Nifedipino oral isolado`,
      charCount: 750,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: []
    },
    {
      pageNumber: 3,
      text: `[2021 2021 2021 - MEDICINA PREVENTIVA] QUESTÃO 5
Essa questão possui comentário do professor no site 4000142463
Em um estudo epidemiológico que acompanha 1.000 trabalhadores expostos e 1.000 não expostos ao longo de 10 anos para avaliar o surgimento de neoplasia pulmonar, o delineamento corresponde a:
A) Estudo de coorte
B) Caso-controle
C) Ensaio clínico randomizado
D) Estudo transversal

[2021 2021 2021 - CARDIOLOGIA] QUESTÃO 6
Essa questão possui comentário do professor no site 4000142464
Paciente de 72 anos com fibrilação atrial não valvar e escore CHA2DS2-VASc de 4 pontos. A conduta profilática para fenômenos tromboembólicos é:
A) Anticoagulação oral plena (NOAC ou varfarina)
B) Ácido acetilsalicílico em monoterapia
C) Dupla antiagregação plaquetária
D) Conduta expectante`,
      charCount: 700,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: []
    },
    {
      pageNumber: 4,
      text: `[2021 2021 2021 - INFECTOLOGIA] QUESTÃO 7
Essa questão possui comentário do professor no site 4000142465
Homem de 40 anos, HIV positivo sem acompanhamento regular, interna com cefaleia holocraniana há 2 semanas e febre baixa. Tinta da China no líquor revela leveduras encapsuladas. O tratamento de indução é:
A) Anfotericina B associada a flucitosina (ou fluconazol)
B) Aciclovir intravenoso em altas doses
C) Penicilina cristalina endovenosa
D) Ganciclovir

[2021 2021 2021 - ORTOPEDIA] QUESTÃO 8
Essa questão possui comentário do professor no site 4000142466
Idosa de 78 anos sofre queda da própria altura e apresenta encurtamento e rotação externa do membro inferior direito. O diagnóstico mais provável é:
A) Fratura de fêmur proximal
B) Luxação posterior de quadril
C) Fratura diafisária de tíbia
D) Entorse de tornozelo grau III`,
      charCount: 700,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: []
    },
    {
      pageNumber: 5,
      text: `CEBRASPE - PROCESSO SELETIVO DE RESIDÊNCIA MÉDICA 2021
GABARITO OFICIAL DEFINITIVO DAS QUESTÕES OBJETIVAS

QUESTÃO 01: A
QUESTÃO 02: A
QUESTÃO 03: A
QUESTÃO 04: A
QUESTÃO 05: A
QUESTÃO 06: A
QUESTÃO 07: A
QUESTÃO 08: A`,
      charCount: 200,
      isGabaritoPage: true,
      isEndMatter: false,
      detectedKeywords: ['GABARITO OFICIAL DEFINITIVO']
    }
  ];

  const realEightResult = await processExamDocument(
    'prova_real_8_questoes_gabarito.pdf',
    512000,
    'hash_real_8_questoes',
    realEightQuestionsPages
  );

  // Verificação das 8 questões extraídas e limpas
  assert(realEightResult.summary.totalQuestionsIdentified === 8, 'Exatamente 8 questões extraídas do documento real');
  assert(realEightResult.summary.totalGabaritoAnswersFound === 8, 'Exatamente 8 respostas encontradas no gabarito final');
  assert(realEightResult.summary.questionsWithAnswer === 8, 'Gabarito associado para 100% das 8 questões (8 de 8)');
  assert(realEightResult.summary.questionsWithoutAnswer === 0, 'Zero questões sem resposta no gabarito');
  assert(realEightResult.summary.gabaritoWithoutQuestion === 0, 'Zero respostas no gabarito sem questão');

  // Verificação de limpeza de contaminação em todas as 8 questões
  for (let qIdx = 0; qIdx < 8; qIdx++) {
    const q = realEightResult.questions[qIdx];
    assert(!q.statement.includes('2021 2021 2021'), `Questão ${qIdx + 1}: anos repetidos 2021 expurgados do enunciado`);
    assert(!q.statement.includes('Essa questão possui comentário do professor no site'), `Questão ${qIdx + 1}: frase de publicidade do site expurgada`);
    assert(!q.statement.includes('Duração:'), `Questão ${qIdx + 1}: duração removida`);
    assert(q.alternatives.length === 4, `Questão ${qIdx + 1}: 4 alternativas A-D preservadas`);
    assert(q.gabarito?.answerLetter === 'A', `Questão ${qIdx + 1}: gabarito associado com a letra A`);
    assert(q.removedArtifacts && q.removedArtifacts.length > 0, `Questão ${qIdx + 1}: lista de artefatos removidos registrada`);
  }

  // Verificação de Metadados consolidados a partir do caderno real
  assert(realEightResult.metadata.anoAplicacao === 2021, 'Ano de aplicação 2021 identificado a partir das evidências');
  assert(realEightResult.metadata.anoAplicacaoState === 'CONFIRMED', 'Ano 2021 consolidado como CONFIRMED (apoiado pelas 8 questões)');
  assert(realEightResult.metadata.banca === 'CEBRASPE', 'Banca CEBRASPE identificada a partir do documento');
  assert(realEightResult.metadata.especialidadesList !== undefined && realEightResult.metadata.especialidadesList.length >= 5, `Lista de especialidades catalogada com ${realEightResult.metadata.especialidadesList?.length} especialidades`);


  // ============================================================================
  // TESTE PILOTO COMPLETO DE 10 QUESTÕES (ENARE)
  // ============================================================================
  console.log('\n--- TESTE PILOTO COM 10 QUESTÕES MÉDICAS REAIS ---');

  const pilotDocumentPages = [
    {
      pageNumber: 1,
      text: `EXAME NACIONAL DE RESIDÊNCIA MÉDICA (ENARE)
CADERNO DE PROVA 2026 - ACESSO DIRETO (R1)

QUESTÃO 01
Homem de 62 anos, hipertenso e tabagista, apresenta dor precordial retroesternal em aperto iniciada há 2 horas. Eletrocardiograma demonstra supradesnivelamento de ST de 3 mm em DII, DIII e aVF. Assinale a conduta mais adequada:
A) Encaminhar para teste ergométrico ambulatorial.
B) Iniciar terapia trombolítica se angioplastia primária não estiver acessível em 120 minutos.
C) Prescrever nitrato e betabloqueador e liberar para domicílio.
D) Solicitar esofagograma baritado.
E) Realizar pericardiocentese subxifóidea.

QUESTÃO 02
Mulher de 28 anos, primigesta com 34 semanas, apresenta PA de 150x95 mmHg e proteinúria de fita ++. Nega sintomas visuais ou cefaleia. Plaquetas e enzimas hepáticas normais. Qual o diagnóstico?
A) Hipertensão arterial crônica.
B) Pré-eclâmpsia sem critérios de gravidade.
C) Eclâmpsia iminente.
D) Síndrome HELLP.
E) Hipertensão do avental branco.`
    },
    {
      pageNumber: 2,
      text: `QUESTÃO 03
Lactente de 9 meses com febre alta há 3 dias que cedeu com surgimento de exantema maculopapular no tronco. Diagnóstico mais provável:
A) Sarampo.
B) Escarlatina.
C) Exantema súbito (Herpesvírus 6).
D) Rubéola.
E) Eritema infeccioso.

QUESTÃO 04
Vítima de trauma torácico com murmúrio abolido à direita, hipertimpanismo e turgência jugular com hipotensão severa (PA 70x40 mmHg). Conduta prioritária:
A) Tomografia de tórax com contraste.
B) Descompressão torácica imediata seguida de drenagem pleural em selo d'água.
C) Pericardiocentese diagnóstica.
D) Intubação orotraqueal e aguardar radiografia de tórax.
E) Ressuscitação volêmica exclusiva.`
    },
    {
      pageNumber: 3,
      text: `QUESTÃO 05
Mulher de 55 anos com pirose crônica. Biópsia esofágica revela metaplasia intestinal especializada sem displasia (Esôfago de Barrett curto). Conduta recomendada:
A) Esofagectomia imediata.
B) Otimização de IBP e seguimento endoscópico periódico.
C) Ressecção endoscópica profilática de urgência.
D) Alta sem necessidade de seguimento.
E) Ablação a laser mandatória.

QUESTÃO 06
Idoso de 72 anos com tosse produtiva, febre, confusão mental aguda, PA 85x50 mmHg e ureia 80 mg/dL. Escore CURB-65 e conduta:
A) CURB-65 = 1; tratamento ambulatorial.
B) CURB-65 = 2; reavaliação em 48 horas.
C) CURB-65 = 4; internação hospitalar de urgência com suporte intensivo.
D) CURB-65 = 0; tratamento domiciliar com azitromicina.
E) CURB-65 = 5; cuidados paliativos.`
    },
    {
      pageNumber: 4,
      text: `QUESTÃO 07
Mulher de 32 anos com queixa de astenia, constipação, ganho de peso e sonolência. Exames: TSH 22 mUI/L, T4 livre 0,3 ng/dL e anti-TPO positivo. Tratamento de escolha:
A) Levotiroxina sódica oral em jejum.
B) Metimazol.
C) Propiltiouracila.
D) Iodo radioativo.
E) Cirurgia de tireoidectomia subtotal.

QUESTÃO 08
Observe a imagem do traçado eletrocardiográfico abaixo. Paciente com taquicardia paroxística supraventricular estável que não reverteu com manobra vagal. Droga de primeira linha:
A) Amiodarona 300 mg.
B) Adenosina 6 mg em bolus rápido seguido de flush salino.
C) Cardioversão elétrica sincronizada com 200J.
D) Sulfato de magnésio.
E) Verapamil oral.`
    },
    {
      pageNumber: 5,
      text: `QUESTÃO 09
Conforme o Código de Ética Médica e a Resolução CFM nº 1.995/2012 sobre Diretivas Antecipadas de Vontade (DAV):
A) A vontade dos familiares sempre anula as diretivas registradas pelo paciente lúcido.
B) As diretivas do paciente prevalecem sobre os desejos de familiares desde que em conformidade ética.
C) Exige obrigatoriamente validação prévia por autorização judicial para ter eficácia.
D) Não têm validade em território nacional.
E) Podem ser revogadas unilateralmente pela equipe médica assistente.

QUESTÃO 10
No calendário vacinal do Programa Nacional de Imunizações (PNI), a vacina Pentavalente protege contra:
A) Difteria, Tétano, Coqueluche, Hepatite B e Haemophilus influenzae tipo b.
B) Sarampo, Caxumba, Rubéola, Varicela e Febre Amarela.
C) Poliomielite, Rotavírus, Hepatite A, Meningococo e Pneumococo.
D) HPV, Influenza, BCG, Febre Tifoide e Cólera.
E) COVID-19, Dengue, Chikungunya, Zika e Malária.`
    },
    {
      pageNumber: 6,
      text: `ENARE 2026 - GABARITO OFICIAL DEFINITIVO
GABARITO DAS QUESTÕES OBJETIVAS

QUESTÃO 01: B
QUESTÃO 02: B
QUESTÃO 03: C
QUESTÃO 04: B
QUESTÃO 05: B
QUESTÃO 06: C
QUESTÃO 07: A
QUESTÃO 08: B
QUESTÃO 09: B
QUESTÃO 10: A`
    }
  ];

  const pilotResult = await processExamDocument(
    'ENARE_2026_Piloto_Real.pdf',
    2048500,
    '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    pilotDocumentPages
  );

  assert(pilotResult.summary.totalQuestionsIdentified === 10, 'Identificação exata de 10 questões médicas');
  assert(pilotResult.summary.totalGabaritoAnswersFound === 10, 'Identificação de 10 respostas no gabarito final');
  assert(pilotResult.summary.questionsWithAnswer === 10, 'Associação de gabarito para 100% das questões');
  assert(pilotResult.summary.questionsWithoutAnswer === 0, 'Zero questões sem resposta encontrada');
  assert(pilotResult.summary.gabaritoWithoutQuestion === 0, 'Zero respostas no gabarito sem questão');
  assert(pilotResult.summary.confidenceLevel === 'HIGH', 'Nível de confiança da extração: HIGH');
  assert(pilotResult.metadata.anoAplicacao === 2026, 'Detecção automática do Ano de Aplicação (2026)');
  assert(pilotResult.metadata.modalidade === 'Acesso Direto (R1)', 'Detecção da Modalidade Acesso Direto');
  assert(pilotResult.metadata.isGabaritoOficialComprovado === true, 'Gabarito oficial comprovado por evidência textual');

  // TESTE 14 (REGRESSÃO): "Radiologia e Diagnóstico por Imagem" não gera falso-positivo de imagem
  const textWithSpecialtyOnly = `QUESTÃO 11
Especialidade: Radiologia e Diagnóstico por Imagem
Paciente de 40 anos assintomático comparece para avaliação de rotina.
A) Solicitar exames laboratoriais.
B) Manter conduta expectante.`;

  const parsedQ11 = parseQuestionBlock(textWithSpecialtyOnly);
  const cleanedQ11 = cleanQuestionContent(parsedQ11.statement, parsedQ11.alternatives);
  
  // Avalia se dispara alguma regra de imagem
  let q11ImageTriggered = false;
  for (const rule of IMAGE_CUES_RULES) {
    if (rule.negativeContext && rule.negativeContext.test(cleanedQ11.cleanedStatement)) {
      continue;
    }
    if (rule.regex.test(cleanedQ11.cleanedStatement)) {
      q11ImageTriggered = true;
      break;
    }
  }
  assert(!q11ImageTriggered, 'Radiologia e Diagnóstico por Imagem NÃO gera alerta de imagem indevido');

  // TESTE 15 (REGRESSÃO): "Observe a figura a seguir" continua sendo identificado como referência visual
  const textWithRealImage = `QUESTÃO 12
Observe a figura a seguir mostrando o traçado eletrocardiográfico do paciente.
Qual a principal alteração identificada?
A) Supra de ST em parede anterior.
B) Fibrilação atrial.`;

  const parsedQ12 = parseQuestionBlock(textWithRealImage);
  const cleanedQ12 = cleanQuestionContent(parsedQ12.statement, parsedQ12.alternatives);
  let q12ImageTriggered = false;
  let q12Rule = '';
  for (const rule of IMAGE_CUES_RULES) {
    if (rule.negativeContext && rule.negativeContext.test(cleanedQ12.cleanedStatement)) {
      continue;
    }
    const match = cleanedQ12.cleanedStatement.match(rule.regex);
    if (match) {
      q12ImageTriggered = true;
      q12Rule = rule.name;
      break;
    }
  }
  assert(q12ImageTriggered && q12Rule.length > 0, 'Observe a figura a seguir continua identificado como referência visual');

  // TESTE 16 (REGRESSÃO): "A Certo" e "B Errado" (sem pontuação) extraídos como 2 alternativas estruturadas
  const certoErradoBlock = `QUESTÃO 13
Em relação à conduta na sepse com choque séptico refratário a aminas vasoativas:
A Certo
B Errado`;

  const parsedCertoErrado = parseQuestionBlock(certoErradoBlock);
  assert(parsedCertoErrado.alternatives.length === 2, 'A Certo / B Errado sem pontuação resulta em exatamente 2 alternativas');
  assert(parsedCertoErrado.alternatives[0]?.letter === 'A' && parsedCertoErrado.alternatives[0]?.text === 'Certo', 'Alternativa A com texto Certo');
  assert(parsedCertoErrado.alternatives[1]?.letter === 'B' && parsedCertoErrado.alternatives[1]?.text === 'Errado', 'Alternativa B com texto Errado');

  // TESTE 17 (REGRESSÃO): "A paciente apresenta febre" NÃO é interpretado como alternativa
  const clinicalStatementBlock = `QUESTÃO 14
A paciente apresenta febre alta, tosse e dor pleurítica há três dias.
Ao exame, murmúrio vesicular diminuído em base direita.
A) Iniciar amoxicilina com clavulanato.
B) Realizar internação imediata em UTI.`;

  const parsedClinical = parseQuestionBlock(clinicalStatementBlock);
  assert(parsedClinical.alternatives.length === 2, '"A paciente apresenta febre" NÃO é interpretado como alternativa');
  assert(parsedClinical.alternatives[0]?.letter === 'A' && parsedClinical.alternatives[0]?.text.includes('amoxicilina'), 'Alternativa A é "Iniciar amoxicilina..."');
  assert(parsedClinical.statement.includes('A paciente apresenta febre alta'), 'Enunciado preserva "A paciente apresenta febre alta" integralmente');

  // ============================================================================
  // TESTES DE REGRESSÃO ESPECÍFICOS DO FLUXO REAL (METADADOS, AUDITORIA E SCHILLING)
  // ============================================================================

  // TESTE 18 (REGRESSÃO): parsePlatformCatalogLine reconhece cabeçalho editorial de catálogo
  console.log('\n--- 18. TESTE DE RECONHECIMENTO DE CABEÇALHO DE PLATAFORMA ---');
  const catalogHeaderSample = '2021 2021 2021 2021 Privado DF - Hospital das Forças Armadas - HFA Anestesiologia Clínica Médica Acesso Direto (R1) Instituto Ibest';
  const catalogParsed = parsePlatformCatalogLine(catalogHeaderSample);
  assert(catalogParsed.isCatalog === true, 'Linha de catálogo da plataforma reconhecida com sucesso');
  assert(catalogParsed.meta.ano === 2021, 'Ano 2021 extraído do catálogo');
  assert(catalogParsed.meta.natureza === 'Privado', 'Natureza "Privado" extraída do catálogo');
  assert(catalogParsed.meta.uf === 'DF', 'UF "DF" extraída do catálogo');
  assert(catalogParsed.meta.institution === 'Hospital das Forças Armadas - HFA', 'Instituição HFA extraída do catálogo');
  assert(catalogParsed.meta.banca === 'Instituto Ibest', 'Banca Instituto Ibest extraída do catálogo');
  assert(catalogParsed.meta.modalidade === 'Acesso Direto (R1)', 'Modalidade Acesso Direto extraída do catálogo');
  assert(catalogParsed.meta.specialties.some(s => s.toUpperCase().includes('ANESTESIOLOGIA')) && catalogParsed.meta.specialties.some(s => s.toUpperCase().includes('CLÍNICA MÉDICA')), 'Especialidades catalogadas extraídas');

  // TESTE 19 (REGRESSÃO): Caso Real de Prova: Schilling, Metadados Separados, Certo/Errado e rawStatement
  console.log('\n--- 19. CASO REAL: SCHILLING, COMENTÁRIO DO PROFESSOR, METADADOS E CERTO/ERRADO ---');
  const rawSchillingBlock = `2021 2021 2021 2021 Privado DF - Hospital das Forças Armadas - HFA Anestesiologia Clínica Médica Acesso Direto (R1) Instituto Ibest
Essa questão possui comentário do professor no site 4000142459
Classificação de Schilling
O teste de Schilling é utilizado para avaliar a absorção de cianocobalamina.
A Certo
B Errado`;

  const parsedSchilling = parseQuestionBlock(rawSchillingBlock);
  assert(parsedSchilling.alternatives.length === 2, 'Exatamente 2 alternativas estruturadas (A e B) extraídas');
  assert(parsedSchilling.alternatives[0]?.letter === 'A' && parsedSchilling.alternatives[0]?.text === 'Certo', 'Alternativa A estruturada como "Certo"');
  assert(parsedSchilling.alternatives[1]?.letter === 'B' && parsedSchilling.alternatives[1]?.text === 'Errado', 'Alternativa B estruturada como "Errado"');

  const cleanedSchilling = cleanQuestionContent(parsedSchilling.statement, parsedSchilling.alternatives);
  
  // O texto "Essa questão possui comentário do professor no site 4000142459" DEVE ser removido
  assert(!cleanedSchilling.cleanedStatement.includes('Essa questão possui comentário do professor no site'), 'Frase de comentário do professor removida do enunciado limpo');
  assert(!cleanedSchilling.cleanedStatement.includes('4000142459'), 'Identificador numérico do site 4000142459 removido do enunciado limpo');
  assert(cleanedSchilling.updatedTag?.plataformaCodigo === '4000142459', 'Código 4000142459 preservado na tag estruturada');

  // O prefixo de anos e metadados DEVE ser removido do enunciado limpo
  assert(!cleanedSchilling.cleanedStatement.includes('2021 2021 2021 2021'), 'Prefixo de anos repetidos 2021 removido do enunciado');
  assert(!cleanedSchilling.cleanedStatement.includes('Privado DF - Hospital das Forças Armadas'), 'Cabeçalho da instituição removido do enunciado limpo');
  assert(!cleanedSchilling.cleanedStatement.includes('Instituto Ibest'), 'Banca removida do enunciado limpo');

  // O título "Classificação de Schilling" e o enunciado clínico DEVEM permanecer íntegros
  assert(cleanedSchilling.cleanedStatement.includes('Classificação de Schilling'), 'Título "Classificação de Schilling" permanece íntegro no enunciado limpo');
  assert(cleanedSchilling.cleanedStatement.includes('O teste de Schilling é utilizado para avaliar a absorção de cianocobalamina'), 'Texto clínico legítimo do teste de Schilling preservado');
  assert(cleanedSchilling.cleanedStatement.startsWith('Classificação de Schilling'), 'Enunciado limpo inicia diretamente com o título "Classificação de Schilling"');

  // Os metadados estruturados foram separados para o cabeçalho/tag
  assert(cleanedSchilling.updatedTag?.ano === 2021, 'Ano 2021 isolado em campo estruturado');
  assert(cleanedSchilling.updatedTag?.institution === 'Hospital das Forças Armadas - HFA', 'Instituição HFA isolada em campo estruturado');
  assert(cleanedSchilling.updatedTag?.banca === 'Instituto Ibest', 'Banca Instituto Ibest isolada em campo estruturado');
  assert(cleanedSchilling.updatedTag?.modalidade === 'Acesso Direto (R1)', 'Modalidade isolada em campo estruturado');
  assert(cleanedSchilling.updatedTag?.natureza === 'Privado', 'Natureza "Privado" isolada em campo estruturado');
  assert(cleanedSchilling.updatedTag?.uf === 'DF', 'UF "DF" isolada em campo estruturado');

  // Lista de artefatos removidos registrada para auditoria
  assert(cleanedSchilling.removedArtifacts.length >= 2, 'Trechos removidos devidamente registrados em removedArtifacts para auditoria');

  // TESTE 20 (REGRESSÃO): Extração ponta a ponta com gabarito associado e campos separados
  console.log('\n--- 20. TESTE COMPLETO: DOCUMENTO DE PROVA COM GABARITO E SEPARAÇÃO DE CAMPOS ---');
  const examDocumentPages: ExtractedPageData[] = [
    {
      pageNumber: 1,
      text: `CADERNO DE QUESTÕES OBJETIVAS - HFA 2021
QUESTÃO 01
2021 2021 2021 2021 Privado DF - Hospital das Forças Armadas - HFA Anestesiologia Clínica Médica Acesso Direto (R1) Instituto Ibest
Essa questão possui comentário do professor no site 4000142459
Classificação de Schilling
O teste de Schilling é utilizado para avaliar a absorção de cianocobalamina.
A Certo
B Errado`,
      charCount: 250,
      isGabaritoPage: false,
      isEndMatter: false,
      detectedKeywords: []
    },
    {
      pageNumber: 2,
      text: `GABARITO OFICIAL DEFINITIVO
QUESTÃO 01: A`,
      charCount: 40,
      isGabaritoPage: true,
      isEndMatter: false,
      detectedKeywords: ['GABARITO OFICIAL']
    }
  ];

  const fullProcessed = await processExamDocument(
    'HFA_2021_Schilling_Test.pdf',
    102400,
    'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    examDocumentPages
  );

  assert(fullProcessed.questions.length === 1, 'Exatamente 1 questão identificada no documento');
  const qItem = fullProcessed.questions[0];

  // Validação dos campos estritamente separados
  assert(qItem.rawStatement.includes('2021 2021 2021 2021'), 'rawStatement preserva o texto original integral sem modificação');
  assert(qItem.rawStatement.includes('Essa questão possui comentário'), 'rawStatement preserva comentário bruto para auditoria');
  assert(!qItem.statement.includes('2021 2021 2021 2021'), 'statement limpo NÃO contém o prefixo de anos');
  assert(!qItem.statement.includes('Essa questão possui comentário'), 'statement limpo NÃO contém navegação');
  assert(qItem.statement.startsWith('Classificação de Schilling'), 'statement limpo inicia diretamente com o título');
  assert(qItem.alternatives.length === 2, 'alternatives contém exatamente 2 alternativas estruturadas');
  assert(qItem.correctAnswer === 'A', 'correctAnswer populado diretamente com a resposta do gabarito oficial ("A")');
  assert(qItem.gabarito?.answerLetter === 'A', 'gabarito documental associado à questão');
  assert(qItem.extractedTag?.institution === 'Hospital das Forças Armadas - HFA', 'Metadado institution separado no topo');
  assert(qItem.extractedTag?.banca === 'Instituto Ibest', 'Metadado banca separado no topo');
  assert(qItem.extractedTag?.ano === 2021, 'Metadado ano separado no topo');
  assert((qItem.removedArtifacts || []).length > 0, 'removedArtifacts disponível para o revisor na auditoria');

  console.log('\n================================================================');
  console.log(`RESULTADO FINAL: ${passedTests} de ${totalTests} testes APROVADOS!`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
