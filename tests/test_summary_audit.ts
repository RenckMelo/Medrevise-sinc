import {
  validateChapterCompleteness,
  repairIncompleteMarkdownBlocks,
  extractReferencesFromMarkdown,
  normalizeChapterTitle,
  calculateAdaptiveTokenDistribution,
  calculateExtraCredits
} from '../src/internato/utils/summaryHelpers';

console.log('--- TEST SUITE: RESUMOS, REFERÊNCIAS E QUESTÕES ---');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

// ==========================================
// Teste A: Validação e Truncamento de Capítulos
// ==========================================
const completeText = `
Este é um capítulo de medicina completo e didático sobre Cetoacidose Diabética.
Apresenta critérios diagnósticos, tabelas e condutas terapêuticas de forma exaustiva.
O manejo inicial com hidratação venosa e insulinoterapia em bomba de infusão contínua
deve manter a glicemia entre 150 e 200 mg/dL após a fase aguda.
`;
const incompleteCodeBlock = `
Texto inicial do capítulo sobre intubação em sequência rápida.
\`\`\`markdown
| Medicamento | Dose |
| Midazolam | 0.2 mg/kg |
`;
const incompleteTable = `
Texto inicial sobre sepse.
| Escore | Pontuação | Conduta |
| qSOFA >= 2 | Alto risco
`;
const danglingEnding = `
O paciente foi encaminhado para a unidade de terapia intensiva e
`;

assert(validateChapterCompleteness(completeText).isComplete === true, 'Capítulo íntegro validado com sucesso');
assert(validateChapterCompleteness(incompleteCodeBlock).isComplete === false, 'Detecta bloco de código não fechado');
assert(validateChapterCompleteness(incompleteTable).isComplete === false, 'Detecta linha de tabela Markdown incompleta');
assert(validateChapterCompleteness(danglingEnding).isComplete === false, 'Detecta frase interrompida com conectivo pendente ("e")');

// Teste de Reparo
const repairedCode = repairIncompleteMarkdownBlocks(incompleteCodeBlock);
assert(repairedCode.endsWith('```'), 'Repara e fecha com segurança blocos de código abertos');

const repairedTable = repairIncompleteMarkdownBlocks(incompleteTable);
assert(repairedTable.endsWith('|'), 'Repara e fecha linha de tabela aberta');

// ==========================================
// Teste F: Referências Bibliográficas
// ==========================================
const markdownWithRefs = `
# HIPERTENSÃO ARTERIAL SISTÊMICA

Conteúdo do tratado médico com condutas e tabelas.

## Referências Bibliográficas
- Diretrizes Brasileiras de Hipertensão Arterial - SBC/SBH 2020/2021.
- UpToDate: Initial treatment of hypertension in adults (2025).
- 7ª Diretriz Brasileira de Hipertensão Arterial.
- Harrison's Principles of Internal Medicine, 21st Edition.
`;

const extracted = extractReferencesFromMarkdown(markdownWithRefs);
assert(extracted.length === 4, 'Extrai corretamente as 4 referências bibliográficas do Markdown');
assert(extracted[0].includes('Diretrizes Brasileiras de Hipertensão'), 'Preserva nome legítimo da primeira referência');
assert(extracted[1].includes('UpToDate'), 'Preserva segunda referência oficial');
assert(extracted[3].includes('Harrison'), 'Preserva referência de livro-texto');

const markdownWithoutRefs = `
# RESUMO SEM REFERÊNCIAS
Apenas texto clínico sem seção de referências bibliográficas.
`;
const extractedEmpty = extractReferencesFromMarkdown(markdownWithoutRefs);
assert(extractedEmpty.length === 0, 'Não inventa referências fictícias quando ausentes no texto');

// ==========================================
// Teste J: Compatibilidade de Preços e Modos
// ==========================================
assert(calculateExtraCredits('minimum', 'minimum') === -2, 'Custo extra de Casos Mínimos e Alertas Mínimos preservado');
assert(calculateExtraCredits('moderate', 'light') === 3, 'Custo extra de Casos Moderados (+3cr) preservado');
assert(calculateExtraCredits('maximum', 'light') === 10, 'Custo extra de Casos Aprofundados (+10cr) preservado');

// Normalização de Capítulos
const norm1 = normalizeChapterTitle('1.1. Fisiopatologia e Quadro Clínico', 0);
assert(norm1 === '1. Fisiopatologia e Quadro Clínico', 'Normaliza título evitando numeração duplicada (1.1. -> 1.)');

const norm2 = normalizeChapterTitle('Capítulo 2: Diagnóstico Diferencial', 1);
assert(norm2 === '2. Diagnóstico Diferencial', 'Normaliza rótulo redundante de capítulo');

// Alocação Adaptativa de Tokens do Modo Elite
const chapters = ['Cap 1', 'Cap 2', 'Cap 3', 'Cap 4', 'Cap 5', 'Cap 6'];
const dist = calculateAdaptiveTokenDistribution(chapters, undefined, 16000, 1200, 5000);
assert(dist.allocations.length === 6, 'Aloca 6 capítulos no orçamento adaptativo do Elite');
assert(dist.totalAllocated === 16000, 'Conserva o total exato de 16.000 tokens distribuídos');

// ==========================================
// Teste K: Sanitize Mermaid Code & Parse Fixes
// ==========================================
import { sanitizeMermaidCode } from '../src/internato/utils/markdownUtils.tsx';

// 1. Fluxograma com rótulo contendo parênteses
const case1 = `graph TD\n    D --> E{Gravidade (TG-2021)}`;
const sanitized1 = sanitizeMermaidCode(case1);
assert(sanitized1.includes('"Gravidade (TG-2021)"'), 'Envolve parênteses e hífen em aspas duplas');

// 2. Fluxograma com hífen Unicode (ex: TG‑2021 com non-breaking hyphen \u2011)
const case2 = `graph TD\n    D --> E{Gravidade (TG\u20112021)}`;
const sanitized2 = sanitizeMermaidCode(case2);
assert(!sanitized2.includes('\u2011'), 'Normaliza hífen unicode para hífen ASCII padrão');
assert(sanitized2.includes('TG-2021'), 'Mantém texto legível com hífen padrão');

// 3. Fluxograma com múltiplas conexões e nós squashed
const case3 = `graph TD\n    D --> E{Gravidade (TG-2021)} E --> F`;
const sanitized3 = sanitizeMermaidCode(case3);
assert(sanitized3.includes('E') && sanitized3.includes('E -->'), 'Divide nós e conexões concatenadas na mesma linha');

// 4. Fluxograma com conexões em linhas separadas
const case4 = `graph TD\n    A --> B\n    B --> C`;
const sanitized4 = sanitizeMermaidCode(case4);
assert(sanitized4.includes('A --> B') && sanitized4.includes('B --> C'), 'Preserva conexões em linhas separadas');

// 5. Bloco Mermaid inválido / vazio
const case5 = '';
const sanitized5 = sanitizeMermaidCode(case5);
assert(sanitized5.startsWith('graph TD'), 'Fornece fallback seguro para bloco vazio');

// 6. Resumo com Mermaid válido seguido de texto Markdown
const case6Code = '```mermaid\ngraph TD\n    A --> B\n```\n# Título do Capítulo\nTexto clínico de seguimento.';
const sanitized6 = sanitizeMermaidCode(case6Code);
assert(sanitized6.includes('A --> B'), 'Processa corretamente o código Mermaid extraído dos cercos de markdown');

// 7. Resumo sem nenhum bloco Mermaid
const case7Text = '# Resumo Clinico Padrão\nSem blocos de diagrama aqui.';
const sanitized7 = sanitizeMermaidCode(case7Text);
assert(sanitized7.startsWith('graph TD'), 'Garante cabeçalho graph TD padrão mesmo sem tag mermaid explícita');

console.log(`\nTESTES CONCLUÍDOS: ${passedTests}/${totalTests} aprovados com sucesso.`);

