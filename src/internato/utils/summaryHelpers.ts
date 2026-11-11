import { Chapter5DRatings } from '../types';

export function validateChapterCompleteness(text: string): { isComplete: boolean; reason?: string } {
  if (!text || text.trim().length < 150) {
    return { isComplete: false, reason: 'Texto insuficiente ou vazio' };
  }
  const trimmed = text.trim();

  const codeBlockCount = (trimmed.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    return { isComplete: false, reason: 'Bloco de código (```) não fechado' };
  }

  const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
  const lastLine = lines[lines.length - 1] || '';

  if (lastLine.trim().startsWith('|') && !lastLine.trim().endsWith('|')) {
    return { isComplete: false, reason: 'Linha de tabela Markdown incompleta' };
  }

  const danglingEndings = [
    ',', ';', ':', ' e', ' ou', ' mas', ' porém', ' contudo', ' onde', ' que', ' com', ' sem', ' para', ' por', ' de', ' da', ' do', ' em', ' no', ' na'
  ];
  const lowerLast = lastLine.toLowerCase().trim();
  for (const dangling of danglingEndings) {
    if (lowerLast.endsWith(dangling)) {
      return { isComplete: false, reason: `Frase interrompida com conectivo pendente ("${dangling.trim()}")` };
    }
  }

  return { isComplete: true };
}

export function repairIncompleteMarkdownBlocks(text: string): string {
  if (!text) return '';
  let fixed = text.trim();

  const codeBlockCount = (fixed.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    fixed += '\n```';
  }

  const lines = fixed.split('\n');
  const lastLine = lines[lines.length - 1] || '';
  if (lastLine.trim().startsWith('|') && !lastLine.trim().endsWith('|')) {
    fixed += ' |';
  }

  return fixed;
}

export function extractReferencesFromMarkdown(markdownText: string): string[] {
  if (!markdownText) return [];

  const refs: string[] = [];
  const refSectionMatch = markdownText.match(/(?:##|###)\s*(?:📚\s*)?(?:REFERÊNCIAS\s+BIBLIOGRÁFICAS|REFERENCIAS\s+BIBLIOGRAFICAS|REFERÊNCIAS|REFERENCIAS|DIRETRIZES\s+TÉCNICAS|BIBLIOGRAFIA)[\s\S]*?(?=(?:\n##\s+[^\n]+)|$)/i);

  if (refSectionMatch && refSectionMatch[0]) {
    const sectionText = refSectionMatch[0];
    const lines = sectionText.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (/^#{2,4}\s+/i.test(line)) continue;
      const itemMatch = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
      if (itemMatch && itemMatch[1]) {
        const cleaned = itemMatch[1].replace(/^[#\s*_]+|[#\s*_]+$/g, '').trim();
        if (cleaned.length > 5 && !refs.includes(cleaned)) {
          refs.push(cleaned);
        }
      }
    }
  }

  return refs;
}

export function normalizeChapterTitle(title: string, index: number): string {
  if (!title) return `${index + 1}. Capítulo`;
  let clean = title.trim();
  clean = clean.replace(/^(Cap[íi]tulo\s+\d+[:\-\s]*|\d+[\.\-\s]+)+/i, '').trim();
  clean = clean.replace(/^[\.\-\s]+/, '').trim();
  return `${index + 1}. ${clean}`;
}

export function calculateExtraCredits(illustrationLevel: string = 'moderate', alertBoxLevel: string = 'moderate'): number {
  let extra = 0;
  
  const lowerIll = (illustrationLevel || 'moderate').toLowerCase();
  if (lowerIll === 'minimum' || lowerIll === 'off' || lowerIll === 'desativado' || lowerIll === 'none') {
    extra += 0;
  } else if (lowerIll === 'moderate' || lowerIll === 'moderado') {
    extra += 3;
  } else if (lowerIll === 'maximum' || lowerIll === 'academic' || lowerIll === 'extreme' || lowerIll === 'alto' || lowerIll === 'aprofundado') {
    extra += 10;
  }

  const lowerAlert = (alertBoxLevel || 'moderate').toLowerCase();
  if (lowerAlert === 'minimum' || lowerAlert === 'off' || lowerAlert === 'desativado') {
    extra -= 2;
  } else if (lowerAlert === 'light' || lowerAlert === 'leve') {
    extra += 0;
  } else if (lowerAlert === 'moderate') {
    extra += 2;
  } else if (lowerAlert === 'academic' || lowerAlert === 'maximum' || lowerAlert === 'alto') {
    extra += 5;
  } else if (lowerAlert === 'extreme' || lowerAlert === 'extremo') {
    extra += 10;
  }

  return extra;
}

export function calculateAdaptiveTokenDistribution(
  chapters: string[],
  customRatings?: (Chapter5DRatings | null | undefined)[],
  referenceBudget: number = 16000,
  minFloor: number = 1200,
  maxCap: number = 5000
) {
  const N = chapters.length;
  if (N === 0) {
    return {
      allocations: [],
      referenceBudget,
      totalAllocated: 0,
      effectiveFloor: minFloor,
      effectiveCap: maxCap,
      isBudgetConstrained: false
    };
  }

  const ratings: Chapter5DRatings[] = chapters.map((title, idx) => {
    const custom = customRatings?.[idx];
    if (custom && typeof custom.C === 'number' && typeof custom.I === 'number') {
      return {
        C: Math.min(5, Math.max(1, custom.C)),
        I: Math.min(5, Math.max(1, custom.I)),
        R: Math.min(5, Math.max(1, custom.R)),
        E: Math.min(5, Math.max(1, custom.E)),
        D: Math.min(5, Math.max(1, custom.D))
      };
    }
    const titleLower = title.toLowerCase();
    let C = 3, I = 3, R = 3, E = 3, D = 3;
    if (titleLower.includes('fisiopatologia') || titleLower.includes('conceito') || titleLower.includes('definição')) {
      C = 4; E = 3; D = 3;
    }
    if (titleLower.includes('manejo') || titleLower.includes('algoritmo') || titleLower.includes('conduta') || titleLower.includes('urgência') || titleLower.includes('emergência')) {
      I = 5; R = 5; D = 4; E = 4;
    }
    if (titleLower.includes('tratam') || titleLower.includes('farmaco') || titleLower.includes('dose')) {
      I = 5; R = 5; D = 5; C = 4;
    }
    if (titleLower.includes('escore') || titleLower.includes('classifica') || titleLower.includes('estágio') || titleLower.includes('tabela')) {
      R = 5; D = 5; I = 4;
    }
    if (titleLower.includes('prevenção') || titleLower.includes('seguimento') || titleLower.includes('rastreio')) {
      C = 2; I = 3; R = 2; E = 2; D = 2;
    }
    return { C, I, R, E, D };
  });

  const scores = ratings.map(r => 
    Number((0.25 * r.C + 0.30 * r.I + 0.20 * r.R + 0.15 * r.E + 0.10 * r.D).toFixed(4))
  );

  let effectiveBudget = referenceBudget;
  let effectiveFloor = minFloor;
  let effectiveCap = maxCap;
  let isBudgetConstrained = false;

  if (N * maxCap < referenceBudget) {
    effectiveBudget = N * maxCap;
    isBudgetConstrained = true;
  }
  if (N * minFloor > referenceBudget) {
    effectiveFloor = Math.floor(referenceBudget / N);
    isBudgetConstrained = true;
  }

  const unconstrained = new Set<number>(Array.from({ length: N }, (_, i) => i));
  const finalAllocationsFloat = new Array<number>(N).fill(0);
  let budgetToDistribute = effectiveBudget;

  while (unconstrained.size > 0) {
    const currentUnconstrainedScoreSum = Array.from(unconstrained).reduce((sum, idx) => sum + scores[idx], 0);
    let newlyConstrainedCount = 0;

    for (const idx of Array.from(unconstrained)) {
      const share = currentUnconstrainedScoreSum > 0 ? (scores[idx] / currentUnconstrainedScoreSum) * budgetToDistribute : (budgetToDistribute / unconstrained.size);
      if (share > effectiveCap) {
        finalAllocationsFloat[idx] = effectiveCap;
        budgetToDistribute -= effectiveCap;
        unconstrained.delete(idx);
        newlyConstrainedCount++;
      } else if (share < effectiveFloor) {
        finalAllocationsFloat[idx] = effectiveFloor;
        budgetToDistribute -= effectiveFloor;
        unconstrained.delete(idx);
        newlyConstrainedCount++;
      }
    }

    if (newlyConstrainedCount === 0) {
      for (const idx of Array.from(unconstrained)) {
        finalAllocationsFloat[idx] = currentUnconstrainedScoreSum > 0 ? (scores[idx] / currentUnconstrainedScoreSum) * budgetToDistribute : (budgetToDistribute / unconstrained.size);
      }
      break;
    }
  }

  const integerParts = finalAllocationsFloat.map(v => Math.floor(v));
  const remainders = finalAllocationsFloat.map((v, idx) => ({
    idx,
    remainder: v - integerParts[idx]
  }));

  const integerSum = integerParts.reduce((sum, v) => sum + v, 0);
  let remainderTokensToDistribute = effectiveBudget - integerSum;

  remainders.sort((a, b) => b.remainder - a.remainder || a.idx - b.idx);

  const finalAllocationsInt = [...integerParts];
  for (let i = 0; i < remainderTokensToDistribute && i < remainders.length; i++) {
    finalAllocationsInt[remainders[i].idx] += 1;
  }

  return {
    allocations: chapters.map((title, idx) => ({
      chapterIndex: idx,
      chapterTitle: title,
      priorityScore: scores[idx],
      allocatedTokens: finalAllocationsInt[idx],
      ratings5D: ratings[idx]
    })),
    referenceBudget,
    totalAllocated: finalAllocationsInt.reduce((s, v) => s + v, 0),
    effectiveFloor,
    effectiveCap,
    isBudgetConstrained
  };
}
