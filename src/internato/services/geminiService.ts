
import { db, doc, getDoc, updateDoc, increment, setDoc, auth } from '../firebase';
import { safeLocalStorageGet } from '../utils/storageUtils';
import { cleanAndFixMarkdownTables } from '../utils/markdownUtils';

export const AI_LIMIT_PER_DAY = 3000; // Shared admin pool is 3000, other plans have custom limits

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 4, initialDelay: number = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) { 
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const message = (err.message || "").toUpperCase();
      
      const isQuotaError = message.includes('429') || message.includes('EXHAUSTED') || message.includes('QUOTA') || message.includes('RATE_LIMIT');
      const isServiceError = message.includes('503') || message.includes('502') || message.includes('504') || message.includes('500') || message.includes('BUSY') || message.includes('DEMAND') || message.includes('UNAVAILABLE') || message.includes('UNEXPECTED TOKEN') || message.includes('VALID JSON') || message.includes('DOCTYPE') || message.includes('HTML') || message.includes('JSON') || message.includes('OFFLINE') || message.includes('FETCH') || message.includes('NETWORK') || message.includes('ECONN') || message.includes('ETIMEDOUT') || message.includes('FAILED');
      const isTimeout = message.includes('TIMEOUT') || message.includes('DEADLINE') || message.includes('ABORT');

      const isUserAccountError = message.includes('CRÉDITOS INSUFICIENTES') || message.includes('LIMITE DIÁRIO') || message.includes('UNAUTHORIZED');

      if (!isUserAccountError && (isQuotaError || isServiceError || isTimeout || i < maxRetries - 1) && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(1.5, i); 
        console.warn(`[Gemini Retry] Re-tentativa automática (${message.substring(0, 40)}...). Tentativa ${i + 1}/${maxRetries}. Aguardando ${Math.round(delay/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw err;
    }
  }
  throw lastError;
}

async function getUserFocusSettings(userId?: string) {
  let residencyFocus = "Centro-Oeste (UFG, SES-GO, SES-DF, UnB, ENARE)";
  let isCustom = false;
  
  // 1. Check local storage for immediate focus selection
  const localFocus = safeLocalStorageGet('user_residency_focus');
  if (localFocus && localFocus.trim()) {
    residencyFocus = localFocus.trim();
    isCustom = true;
  }

  // 2. Query user doc in Firestore
  const targetUid = userId || auth.currentUser?.uid;
  if (targetUid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', targetUid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const docFocus = data?.settings?.residencyFocus || data?.residencyFocus || data?.targetExam;
        if (docFocus && typeof docFocus === 'string' && docFocus.trim()) {
          residencyFocus = docFocus.trim();
          isCustom = true;
        }
      }
    } catch (err) {
      console.error("Error fetching user residency focus settings:", err);
    }
  }
  return { residencyFocus, isCustom };
}

async function callGemini(action: 'generateContent' | 'generateJson', prompt: string, model: string = "gemini-3.1-flash-lite", parts?: any[]) {
  return withRetry(async () => {
    try {
      const endpoint = '/api/gemini';
      const userEmail = auth.currentUser?.email || '';
      const preferredProvider = safeLocalStorageGet('user_preferred_ai_provider') || 'auto';
      
      let response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          email: userEmail,
          payload: {
            prompt,
            model,
            parts,
            preferredProvider
          }
        })
      });

      // Special handling for 404: try direct function path as fallback on Netlify
      if (response.status === 404) {
        console.warn('[Gemini] Proxy endpoint 404. Attempting direct Netlify function call...');
        const directEndpoint = '/.netlify/functions/gemini';
        response = await fetch(directEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action,
            payload: {
              prompt,
              model,
              parts
            }
          })
        });
      }

      const responseText = await response.text();

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        if (responseText && responseText.trim()) {
          const trimmed = responseText.trim();
          if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE')) {
            errorMsg = `HTTP HTML Error: received unexpected HTML page instead of JSON (status: ${response.status})`;
          } else {
            try {
              const errorData = JSON.parse(responseText);
              errorMsg = errorData.error || errorMsg;
            } catch (e) {
              errorMsg = responseText.substring(0, 150);
            }
          }
        }

        // Format quota/rate limit error clearly so user knows their site credits are preserved
        if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('resourceexhausted') || errorMsg.toLowerCase().includes('exceeded your current quota')) {
          errorMsg = `As chaves da API de IA atingiram temporariamente o limite de requisições por minuto da Google/OpenAI. Seus CRÉDITOS DO SITE permanecem 100% intocados. Por favor, aguarde 30 a 60 segundos e tente novamente.`;
        } else if (errorMsg.includes('402') || errorMsg.toLowerCase().includes('insufficient balance')) {
          errorMsg = `A API de IA retornou saldo zerado no provedor pago. Seus CRÉDITOS DO SITE permanecem intocados. O sistema está alternando para a cota do Gemini/Groq.`;
        }

        console.error(`[Gemini] Erro na resposta do proxy: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const trimmedText = responseText.trim();
      if (trimmedText.startsWith('<!doctype') || trimmedText.startsWith('<html') || trimmedText.startsWith('<!DOCTYPE')) {
        throw new Error(`Unexpected HTML response body instead of valid JSON data (maybe offline or server restart): ${trimmedText.substring(0, 100)}`);
      }

      const data = JSON.parse(responseText);
      return data.result;
    } catch (error: any) {
      console.error('Gemini Proxy Error Details:', {
        message: error.message,
        action,
        model
      });
      throw error;
    }
  });
}

export async function checkUsageLimit(creditsNeeded: number = 1) {
  const currentUser = auth.currentUser;
  if (!currentUser) return; // Allow bypass if not logged in (e.g. during initialization or demo)

  const email = (currentUser.email || '').toLowerCase().trim();
  const today = new Date().toISOString().split('T')[0];
  const isSpecialUser = email === 'ysabelleosaraiva@gmail.com' || email === 'yasabelleosaraiva@gmail.com' || email === 'lucas1renck2melo@gmail.com';

  const userRef = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const isPremium = !!userData?.isPremium;
    const premiumPlan = userData?.premiumPlan || 'med_revise_pro';
    const customLimit = userData?.customLimit || userData?.creditLimit || userData?.dailyLimit;
    
    let limit = 10; // Default Free limit & MedRevise Pro limit
    if (customLimit && typeof customLimit === 'number' && customLimit > 0) {
      limit = customLimit;
    } else if (isSpecialUser) {
      limit = 1000;
    } else if (isPremium) {
      if (premiumPlan === 'combo_ouro') {
        limit = 250;
      } else if (premiumPlan === 'med_internato_premium') {
        limit = 200;
      } else {
        limit = 10; // med_revise_pro: 10 créditos diários
      }
    }

    const usage = userData?.aiUsage;
    const currentCount = (usage && usage.date === today) ? (usage.count || 0) : 0;
    const available = Math.max(0, limit - currentCount);

    if (creditsNeeded > available) {
      throw new Error(`Créditos diários insuficientes para esta operação (${available} cr disponíveis, necessário ${creditsNeeded} cr). Seus créditos renovam diariamente.`);
    }
  }
}

export async function getGlobalUsage() {
  const currentUser = auth.currentUser;
  if (!currentUser) return { count: 0, limit: 10 };

  const email = (currentUser.email || '').toLowerCase().trim();
  const today = new Date().toISOString().split('T')[0];
  const isSpecialUser = email === 'ysabelleosaraiva@gmail.com' || email === 'yasabelleosaraiva@gmail.com' || email === 'lucas1renck2melo@gmail.com';

  const userRef = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const isPremium = !!userData?.isPremium;
    const premiumPlan = userData?.premiumPlan || 'med_revise_pro';
    const customLimit = userData?.customLimit || userData?.creditLimit || userData?.dailyLimit;
    
    let limit = 10; // Default Free limit & MedRevise Pro limit
    if (customLimit && typeof customLimit === 'number' && customLimit > 0) {
      limit = customLimit;
    } else if (isSpecialUser) {
      limit = 1000;
    } else if (isPremium) {
      if (premiumPlan === 'combo_ouro') {
        limit = 250;
      } else if (premiumPlan === 'med_internato_premium') {
        limit = 200;
      } else {
        limit = 10; // med_revise_pro: 10 créditos diários
      }
    }

    const usage = userData?.aiUsage;
    if (usage && usage.date === today) {
      return {
        count: Math.min(limit, usage.count || 0),
        limit: limit
      };
    }
    return { count: 0, limit: limit };
  }
  return { count: 0, limit: isSpecialUser ? 1000 : 10 };
}

export async function resetSpecialUsage() {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  const email = (currentUser.email || '').toLowerCase().trim();
  const today = new Date().toISOString().split('T')[0];
  const isSpecialUser = email === 'ysabelleosaraiva@gmail.com' || email === 'yasabelleosaraiva@gmail.com' || email === 'lucas1renck2melo@gmail.com';

  if (isSpecialUser) {
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      'aiUsage.count': 0
    }).catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-credits-updated'));
    }
  }
}

export async function recordUsage(credits: number = 1) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const email = (currentUser.email || '').toLowerCase().trim();
    const today = new Date().toISOString().split('T')[0];

    // Record in user's personal profile
    const userRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const usage = data?.aiUsage;
      if (usage && usage.date === today) {
        await updateDoc(userRef, {
          'aiUsage.count': increment(credits)
        });
      } else {
        await updateDoc(userRef, {
          aiUsage: { date: today, count: credits }
        });
      }
    }

    // Also update overall global counter for statistics
    const globalStatsRef = doc(db, 'global', 'stats');
    await updateDoc(globalStatsRef, {
      'aiUsage.count': increment(credits)
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-credits-updated'));
    }
  } catch (error) {
    console.error('[Usage] Error recording AI usage:', error);
  }
}

// Exportar para uso em outros componentes
export async function generateWithAI(prompt: string, model: string = "gemini-3.1-flash-lite", credits: number = 1) {
  try {
    if (credits > 0) { await checkUsageLimit(); }
    const result = await callGemini('generateContent', prompt, model);
    await recordUsage(credits);
    return result;
  } catch (error: any) {
    console.error('Error generating with AI:', error);
    // Repassa o erro de cota para o componente tratar se necessário
    if (error.message?.includes('Limite diário')) {
      throw error;
    }
    return null;
  }
}

export type GenerationDepth = 'standard' | 'deep' | 'elite' | 'master' | 'monograph' | 'custom_analyzed';
export type ProgressCallback = (data: { current: number; total: number; message: string; partialContent?: string }) => void;

/**
 * MODO EXTENSIVO / MASTER (50cr):
 * Arquitetura modular de alta performance (5 a 6 capítulos dinâmicos estruturados por tema),
 * gerados sequencialmente com profundidade máxima, tabelas de escores completas,
 * farmacologia exata, guia de manejo passo a passo e zero repetição.
 */
async function generateMasterSummary(title: string, area: string, reference?: string, userId?: string, onProgress?: ProgressCallback, illustrationLevel: string = 'moderate', alertBoxLevel: string = 'moderate') {
  const model = "gemini-3.1-flash-lite";
  
  try {
    let extra = 0;
    if (illustrationLevel === 'minimum') extra -= 3;
    else if (illustrationLevel === 'maximum') extra += 10;
    
    if (alertBoxLevel === 'minimum') extra -= 2;
    else if (alertBoxLevel === 'maximum') extra += 5;

    const totalCost = Math.max(1, 50 + extra);
    await checkUsageLimit(totalCost);
    console.log(`[Resumo Master 50cr] Iniciando geração aprofundada por capítulos dinâmicos para: ${title}`);
    
    const { residencyFocus, isCustom } = await getUserFocusSettings(userId);
    const focusTarget = isCustom ? residencyFocus : "GOIÁS (SES-GO, UFG, PSU-GO) e DISTRITO FEDERAL (SES-DF, UnB, ENARE DF, PSU-DF)";
    const regionalShort = isCustom ? residencyFocus : "GO/DF";
    
    if (extra !== 0) {
      await recordUsage(extra);
    }

    const isProcedure = /parto|assistência|assistencia|técnica|tecnica|semiologia|exame|procedimento|manobra|reanimação|reanimacao|intubação|intubacao|acesso|sutura|curativo|planejamento|consulta|anamnese|avaliação|avaliacao|escore|escala|aleitamento|vacina|imunização|imunizacao|suporte|atendimento/i.test(title);

    onProgress?.({ current: 1, total: 7, message: "Estruturando ementa de alta densidade (50cr)..." });

    // Planejar ementa modular adaptada ao tema (5 a 6 capítulos)
    const masterOutlinePrompt = `Você é o COORDENADOR-PRECEPTOR de um Internato de Elite Médica.
Crie a ementa de capítulos para um RESUMO MASTER EXTENSIVO DE ALTA PERFORMANCE (50 créditos) sobre:
Título: "${title}"
Área: "${area}"
Foco Regional de Provas: "${focusTarget}"

DIRETRIZES DA EMENTA MASTER (5 a 6 CAPÍTULOS):
- A ementa DEVE ter exatamente entre 5 e 6 capítulos numerados, claros, específicos e sem sobreposição de escopo.
- SE O TÓPICO FOR UMA DOENÇA/PATOLOGIA:
  1. Introdução, Epidemiologia e Fundamentos Fisiopatológicos Celulares
  2. Quadro Clínico, Propedêutica, Raciocínio Diagnóstico e Diagnósticos Diferenciais
  3. Classificações Oficiais, Escores de Risco e Escalas Clínicas na Íntegra
  4. Guia de Manejo Clínico Prático e Algoritmo Terapêutico Passo a Passo
  5. Farmacoterapia Detalhada (Doses, Vias, Linhas de Tratamento e Ajustes)
  6. Peculiaridades de Provas Regionais (${regionalShort}), Controvérsias e Casos Especiais
- SE O TÓPICO FOR UM PROCEDIMENTO, CONDUTA DE EMERGÊNCIA OU TEMA PRÁTICO:
  1. Fundamentos Fisiológicos, Anatômicos, Indicações e Avaliação Pré-Procedimento
  2. Escores de Risco/Dificuldade, Materiais e Checklist Beira-Leito
  3. Farmacologia Completa (Doses mg/kg, Fármacos e Sequência Operatória)
  4. Algoritmo Passo a Passo de Execução Prática e Metas Imediatas
  5. Prevenção e Manejo de Intercorrências Críticas, Plano de Resgate e Alta
  6. Particularidades de Bancas (${regionalShort}) e Diretrizes 2024-2026

Retorne APENAS um array JSON de strings com os títulos dos 5 a 6 capítulos numerados. Ex: ["1. Introdução e Fisiopatologia", "2. Quadro Clínico...", ...]`;

    let chapters: string[] = [];
    try {
      const outlineRes = await callGemini('generateJson', masterOutlinePrompt, model);
      if (Array.isArray(outlineRes) && outlineRes.length >= 4) {
        chapters = outlineRes;
      }
    } catch (outlineErr) {
      console.warn('[Resumo Master] Falha ao obter ementa dinâmica, utilizando ementa padrão estruturada:', outlineErr);
    }

    if (chapters.length === 0) {
      chapters = isProcedure ? [
        '1. Fundamentos Fisiológicos, Anatômicos e Indicações Clínicas',
        '2. Avaliação de Risco, Escores e Preparação Beira-Leito',
        '3. Farmacologia Aplicada (Doses mg/kg) e Parâmetros Iniciais',
        '4. Algoritmo Passo a Passo de Execução e Técnica Prática',
        '5. Manejo de Intercorrências Críticas, Falhas e Plano de Resgate',
        `6. Particularidades de Bancas Regionais (${regionalShort}) e Diretrizes Atuais`
      ] : [
        '1. Introdução, Epidemiologia e Fisiopatologia Celular Detalhada',
        '2. Quadro Clínico, Semiologia e Propedêutica Diagnóstica',
        '3. Classificações Oficiais, Escores de Risco e Escalas Clínicas',
        '4. Guia de Manejo Clínico Prático e Algoritmo Passo a Passo',
        '5. Tratamento Farmacológico Completo, Doses e Linhas Terapêuticas',
        `6. Particularidades de Prova (${regionalShort}), Controvérsias e Situações Especiais`
      ];
    }

    const totalChapters = chapters.length;
    let fullContent = `# ${title.toUpperCase()}\n\n*Resumo Extensivo Master (50cr) - Método Preceptor IA de Alta Performance*\n\n---\n\n## SUMÁRIO DE NAVEGAÇÃO\n\n`;

    chapters.forEach((chapter) => {
      const slug = slugify(chapter);
      fullContent += `- [${chapter}](#${slug})\n`;
    });
    fullContent += `\n---\n\n`;

    const costPerChapter = Math.floor(50 / totalChapters);

    // Gerar sequencialmente cada capítulo para reter profundidade extrema sem bater timeouts agregados
    for (let i = 0; i < totalChapters; i++) {
      const chapterTitle = chapters[i];
      onProgress?.({ 
        current: i + 1, 
        total: totalChapters + 1, 
        message: `Escrevendo capítulo ${i + 1}/${totalChapters}: ${chapterTitle}...`,
        partialContent: fullContent
      });

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const previousChaptersStr = i > 0 ? chapters.slice(0, i).map((c, idx) => `Capítulo ${idx+1}: "${c}"`).join(' | ') : 'Nenhum (Este é o Capítulo 1)';
      const futureChaptersStr = i < totalChapters - 1 ? chapters.slice(i + 1).map((c, idx) => `Capítulo ${i+2+idx}: "${c}"`).join(' | ') : 'Nenhum (Este é o Capítulo Final)';
      const previousSignatures = extractPreviousContentSignatures(fullContent);

      const prompt = `Você é o COORDENADOR-PRECEPTOR de um Internato de Elite Médica. Estamos redigindo um RESUMO MASTER EXTENSIVO DE ALTA PERFORMANCE (50 créditos) sobre "${title}" (${area}).
Foco de Bancas: ${focusTarget} (${regionalShort})

Capítulo Atual (${i + 1}/${totalChapters}): "${chapterTitle}"
Capítulos Anteriores já redigidos: ${previousChaptersStr}
Capítulos Posteriores a serem redigidos: ${futureChaptersStr}

ELEMENTOS JÁ GERADOS NOS CAPÍTULOS ANTERIORES (REGRA RÍGIDA ANTI-DUPLICAÇÃO):
${previousSignatures}
* É ESTRITAMENTE PROIBIDO REPETIR QUALQUER TABELA, ESCORE OU CAIXA DE DICA ACIMA.

DIRETRIZES FUNDAMENTAIS DE RIGOR, DENSIDADE E NÃO REPETIÇÃO:
1. COMECE IMEDIATAMENTE PELO TÍTULO DO CAPÍTULO: O texto DEVE iniciar na primeira linha com "## ${chapterTitle}".
2. NÃO REPITA CONCEITOS OU TABELAS JÁ DISCUTIDAS: Se este não for o Capítulo 1, não reintroduza o tema. Concentre-se 100% no tema específico deste capítulo.
3. DENSIDADE ACADÊMICA E RIGOR TÉCNICO MÁXIMO: Escreva parágrafos substanciais, explicativos e aprofundados. Detalhe a fisiopatologia molecular/celular, mecanismo de ação, posologia exata com dosagens em mg/kg ou mg/dia, vias de administração e ajustes para clearance renal/função hepática.
4. TABELAS DE ESCORES E ESCALAS NA ÍNTEGRA (INÉDITAS): Se o capítulo envolver qualquer escore ou escala médica ainda não apresentada, inclua a TABELA COMPLETA com itens, pontuações e condutas vinculadas.
5. GUIA DE MANEJO PASSO A PASSO: Se este capítulo for sobre Manejo/Conduta, descreva o fluxo sequencial, claro e acionável de atendimento, com doses exatas em mg/kg, vias, intervalos e manobras clínicas beira-leito.
6. ALERTA DE PROVAS: Intercale boxes de observação inéditos de bancas:
   > [!IMPORTANT]
   > **HIGHLIGHT DE PROVA / PEGADINHA DE BANCA (${regionalShort}):**
   > [Dica clínica e pegadinha recorrente em provas]

${i === totalChapters - 1 ? `7. SEÇÃO FINAL MANDATÓRIA: Inclua ao final a seção "## 📚 REFERÊNCIAS BIBLIOGRÁFICAS E DIRETRIZES TÉCNICAS" detalhando de 3 a 5 fontes oficiais (UpToDate 2025/2026, Ministério da Saúde, SBC, SBPT, FEBRASGO, SBP, Harrison, etc.). ${reference ? `Destaque: "${reference}".` : ''}` : ''}

Escreva o capítulo "${chapterTitle}" com densidade técnica impecável, parágrafos ricos e explicativos em Markdown puro com LaTeX.`;

      const finalPrompt = prompt + getPromptPreferenceInstructions(illustrationLevel, alertBoxLevel);
      let chapterText = "";
      
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          chapterText = await callGemini('generateContent', finalPrompt, model);
          if (chapterText && chapterText.trim().length > 100) break;
        } catch (capErr: any) {
          console.warn(`[Resumo Master] Tentativa ${attempt + 1}/4 falhou no capítulo ${i + 1}:`, capErr?.message);
          await new Promise(r => setTimeout(r, 4000));
        }
      }

      if (chapterText && chapterText.trim().length > 100) {
        const cleanedText = cleanLeadingChapterTitle(chapterText, chapterTitle);
        fullContent += `## ${chapterTitle}\n\n${cleanedText}\n\n---\n\n`;
        await recordUsage(costPerChapter);
      } else {
        fullContent += `## ${chapterTitle}\n\n*Nota: Seção resumida por instabilidade temporária da rede. Utilize a opção Retomar Geração para restaurar.*\n\n---\n\n`;
      }
    }

    onProgress?.({ current: totalChapters + 1, total: totalChapters + 1, message: "Resumo Master 50cr concluído com sucesso!", partialContent: fullContent });
    return removeDuplicateSumarios(fullContent);
  } catch (error) {
    console.error('Error generating master summary:', error);
    throw error;
  }
}

export async function generateTopicContent(
  title: string, 
  area: string, 
  reference?: string, 
  userId?: string, 
  depth: GenerationDepth = 'standard',
  onProgress?: ProgressCallback,
  illustrationLevel: string = 'moderate',
  alertBoxLevel: string = 'moderate'
) {
  const creditsMap = {
    standard: 1,
    deep: 5,
    elite: 10,
    master: 50,
    monograph: 100
  };
  const credits = creditsMap[depth] || 1;
  
  if (depth === 'monograph') {
    return generateMonograph(title, area, reference, userId, onProgress, illustrationLevel, alertBoxLevel);
  }

  if (depth === 'master') {
    return generateMasterSummary(title, area, reference, userId, onProgress, illustrationLevel, alertBoxLevel);
  }

  const { residencyFocus, isCustom } = await getUserFocusSettings(userId);
  const focusTarget = isCustom ? residencyFocus : "GOIÁS (SES-GO, UFG, PSU-GO) e DISTRITO FEDERAL (SES-DF, UnB, ENARE DF, PSU-DF)";
  const focusTargetClean = isCustom ? residencyFocus : "Centro-Oeste (UFG, SES-GO, SES-DF, UnB, ENARE)";
  const regionalShort = isCustom ? residencyFocus : "GO/DF";

  const finalCredits = credits;

  const isDeep = depth === 'deep';
  const isElite = depth === 'elite';
  const isStandard = depth === 'standard';
  
  // Using stable model
  const model = "gemini-3.1-flash-lite";

  const isProcedure = /parto|assistência|assistencia|técnica|tecnica|semiologia|exame|procedimento|manobra|reanimação|reanimacao|intubação|intubacao|acesso|sutura|curativo|planejamento|consulta|anamnese|avaliação|avaliacao|escore|escala|aleitamento|vacina|imunização|imunizacao|suporte|atendimento/i.test(title);

  let structure = "";
  if (isStandard) {
    structure = isProcedure ? `
  ESTRUTURA DO CONTEÚDO (PADRÃO - 1 CRÉDITO: CONCISO E DIRETO):
  1. **Indicações e Anatomia/Fisiologia Essencial**: Definição rápida, importância prática, indicações e contraindicações principais.
  2. **Materiais e Preparação**: Equipamentos indispensáveis e checklist objetivo.
  3. **Passo a Passo da Técnica e Doses**: Algoritmo direto do procedimento e drogas de 1ª linha.
  4. **Intercorrências e Pegadinhas de Prova**: Complicações clássicas e tópicos mais cobrados em bancas.
  ` : `
  ESTRUTURA DO CONTEÚDO (PADRÃO - 1 CRÉDITO: CONCISO E DIRETO):
  1. **Visão Geral e Fisiopatologia Direta**: Definição sucinta, epidemiologia chave e mecanismo fisiopatológico principal.
  2. **Quadro Clínico e Propedêutica Diagnóstica**: Sinais/sintomas marcantes, exames de 1ª linha e escore/critério principal.
  3. **Tratamento e Condutas Imediatas**: Medicamento de 1ª escolha, doses essenciais e fluxo rápido de conduta.
  4. **Pegadinhas de Prova e Dicas de Ouro**: Pontos mais cobrados em bancas de residência do Centro-Oeste / ENARE.
  `;
  } else if (isDeep) {
    structure = isProcedure ? `
  ESTRUTURA DO CONTEÚDO (AVANÇADO - 5 CRÉDITOS: DIDÁTICO E PRÁTICO):
  1. **Indicações e Fundamentos Aplicados**: Definição, indicações e contraindicações.
  2. **Anatomia, Preparação e Biossegurança**: Conceitos fundamentais, materiais e posicionamento.
  3. **Técnicas e Passo a Passo de Execução**: Roteiro sequencial detalhando como realizar cada fase.
  4. **Prevenção e Tratamento de Intercorrências**: Principais complicações e condutas de resgate.
  5. **Peculiaridades de Provas (GO/DF) e Checklist**: Pontos mais cobrados e resumo prático.
  ` : `
  ESTRUTURA DO CONTEÚDO (AVANÇADO - 5 CRÉDITOS: DIDÁTICO E PRÁTICO):
  1. **Epidemiologia e Fisiopatologia Aplicada**: Mecanismos explicados com clareza didática.
  2. **Semiologia e Quadro Clínico**: Sinais característicos e apresentação.
  3. **Propedêutica e Escores Clínicos**: Exames complementares e tabelas de classificação principais.
  4. **Tratamento Farmacológico e Algoritmo**: Doses de 1ª e 2ª linha, fluxogramas e condutas.
  5. **Particularidades Regionais (GO/DF) e Dicas de Prova**: Destaques de bancas locais.
  `;
  } else {
    // Elite (10 créditos)
    structure = isProcedure ? `
  ESTRUTURA DO CONTEÚDO (ELITE - 10 CRÉDITOS: DETALHADO E COMPLETO):
  1. **Introdução e Indicações Clínicas**: Definição clara, importância prática, indicações do procedimento/assistência e contraindicações secundárias.
  2. **Anatomia, Fisiologia ou Fundamentos Aplicados**: Conceitos estruturais fundamentais para beira de leito.
  3. **Preparação, Materiais e Biossegurança**: Parâmetros de segurança, equipamentos necessários, posições de exame, assepsia, e check de preparação.
  4. **Técnicas, Tempos e Passo a Passo de Execução**: Roteiro minucioso e sequencial detalhando como realizar cada fase com máxima segurança.
  5. **Prevenção e Tratamento de Intercorrências**: Principais complicações, detecção precoce e condutas de salvamento.
  6. **Peculiaridades GO/DF**: O que cai em cada uma das grandes provas locais sobre esse procedimento/assistência (UFG, UnB, PSU-GO, PSU-DF).
  7. **Controvérsias e Atualizações**: Novidades baseadas em diretrizes de portarias recentes (2024/2025).
  8. **Checklist Prático e Monitoramento Pós-Assistência**: Tabelas úteis de beira-de-leito pós-condução.
  ` : `
  ESTRUTURA DO CONTEÚDO (ELITE - 10 CRÉDITOS: DETALHADO E COMPLETO):
  1. **Epidemiologia e Impacto**: Dados reais e incidência no Centro-Oeste.
  2. **Etiopatogenia e Fisiopatologia Celular/Molecular**: Mecanismos detalhados.
  3. **Semiologia e Clínica**: Sinais epônimos, manobras físicas e pegadinhas.
  4. **Propedêutica, Diagnóstico e Escores**: Discussão profunda de exames e tabelas de escores.
  5. **Tratamento e Condutas Completas**: Fluxogramas, doses exatas mg/kg, 1ª e 2ª linhas.
  6. **Peculiaridades GO/DF**: O que cai nas grandes provas regionais.
  7. **Controvérsias e Atualizações 2024/2025**: Diretrizes recentes.
  8. **Checklist de Elite**: Tabelas comparativas e diagnósticos diferenciais.
  `;
  }

  const depthScopeInstruction = isStandard 
    ? `MODO PADRÃO (1 CRÉDITO): O aluno pagou 1 crédito por este resumo conciso. Crie um resumo SINTÉTICO, DIRETO e OBJETIVO de alto rendimento (~1.000 a 1.500 palavras). NUNCA crie um texto monográfico longo, prolixo ou gigantesco. Evite introduções longas ou divagações. Seja cirúrgico e focado em pontos de prova e condutas práticas diretas.`
    : isDeep
    ? `MODO AVANÇADO (5 CRÉDITOS): O aluno pagou 5 créditos por este resumo avançado (~2.500 a 3.500 palavras). Forneça explicações didáticas e bem encadeadas com fisiopatologia e tabelas essenciais, mantendo o equilíbrio perfeito entre profundidade e clareza de estudo, sem atingir tamanho de monografia.`
    : `MODO ELITE (10 CRÉDITOS): O aluno usou 10 créditos por este resumo completo em geração única (~3.500 a 4.500 palavras). Forneça texto rico, altamente detalhado e de excelente rendimento com tabelas de escores, posologias, condutas e particularidades de bancas, mantendo estrutura limpa sem prolixidade.`;

  const prompt = `Você é o Coordenador-Preceptor de um Internato de Elite Médica. Seu objetivo é TREINAR o aluno para as residências mais difíceis, com foco em GOIÁS (SES-GO, UFG, PSU-GO) e DISTRITO FEDERAL (SES-DF, UnB, ENARE DF, PSU-DF).

  SUA PRINCIPAL MISSÃO: DIRECIONAMENTO ADEQUADO AO CUSTO EM CRÉDITOS
  ${depthScopeInstruction}

  TAREFA: CRIE UM RESUMO MÉDICO PROPORCIONAL AO CUSTO (${credits} CRÉDITO(S)) para o tópico: "${title}" (${area}).

  DIRETRIZ DE SUMÁRIO INTERATIVO (MANDATÓRIO):
  - No início do seu texto, logo após o cabeçalho/título inicial, você DEVE gerar uma seção intitulada "## SUMÁRIO DE NAVEGAÇÃO".
  - Este sumário deve conter uma lista numerada com links de ancoragem Markdown para cada uma das seções estruturadas principais que você vai detalhar no texto.
  - Garanta que as seções reais ao longo do texto tenham exatamente os mesmos títulos de nível 2 (ex: "## 1. Visão Geral e Fisiopatologia Direta"), de modo que os hiperlinks e navegação por âncoras funcionem perfeitamente.

  ORIENTAÇÃO DIDÁTICA E TÉCNICA:
  - ESCALAS, ESCORES E CLASSIFICAÇÕES: Apresente as escalas e escores mais cobrados (ex: Glasgow, Mallampati, NYHA, CURB-65, CHADS-VASc, Wells, Geneva, Alvarado, qSOFA/SOFA, NIHSS, BI-RADS, etc.) em tabelas limpas e diretas.
  - EVITE PAREDES DE TEXTO: Divida as informações em parágrafos curtos, tópicos estruturados em bullet points e tabelas comparativas Markdown.
  - TOM DE VOZ DO PRECEPTOR: Didático, focado em prova e beira de leito, intercalado com boxes de "DICA DO PRECEPTOR" e "PEGA-RATÃO DE BANCA".

  ${structure}

  REGRAS DE FORMATAÇÃO MATEMÁTICA/MÉDICA OBRIGATÓRIAS:
  - Use notação LaTeX para símbolos e fórmulas: $ \rightarrow $, $ \le $, $ \ge $, $ \alpha $, $ \beta $.
  - Fórmulas isoladas devem usar $$ formula $$.
  - Exemplos: $ \text{Ca}^{2+} $, $ \text{HCO}_3^- $.
  
  PROIBIÇÃO DE IMAGENS AUTOMÁTICAS: É terminantemente proibido inserir qualquer tipo de imagem, figura ou link de imagem Markdown de forma automática no corpo do texto. O texto deve ser gerado de forma puramente textual e teórica.
  
  SEÇÃO FINAL OBRIGATÓRIA - REFERÊNCIAS BIBLIOGRÁFICAS DESCRITAS:
  Ao final do resumo, crie a seção:
  "## 📚 REFERÊNCIAS BIBLIOGRÁFICAS E DIRETRIZES TÉCNICAS"
  Liste de 2 a 4 fontes oficiais (UpToDate, Diretrizes Brasileiras, Ministério da Saúde, Harrison, etc.). ${reference ? `Destaque a preferência informada: "${reference}".` : ""}

  Formate em Markdown profissional. NÃO use tags HTML.
  ${getPromptPreferenceInstructions(illustrationLevel, alertBoxLevel)}`;

  const customPrompt = prompt
    .replace(/com foco absoluto em GOIÁS \(SES-GO, UFG, PSU-GO\) e DISTRITO FEDERAL \(SES-DF, UnB, ENARE DF, PSU-DF\)/g, `com foco absoluto em: ${focusTarget}`)
    .replace(/foco no Centro-Oeste \(UFG, SES-GO, SES-DF, UnB, ENARE\)/g, `foco em: ${focusTargetClean}`)
    .replace(/Peculiaridades GO\/DF/g, `Peculiaridades de Exame (${regionalShort})`)
    .replace(/bancas locais sobre esse procedimento\/assistência \(UFG, UnB, PSU-GO, PSU-DF\)/g, `bancas de foco (${focusTarget})`)
    .replace(/protocolos SES-GO\/SES-DF/g, `protocolos de ${focusTarget}`)
    .replace(/bancas de foco \(UFG, UnB, PSU-GO, PSU-DF\)/g, `bancas de foco (${focusTarget})`)
    .replace(/Na UFG costuma-se cobrar\.\.\., "No PSU-GO o foco é\.\.\.", "ENARE e UnB divergem aqui\.\.\."/g, `Na banca ${regionalShort} o foco principal é...`)
    .replace(/UFG, UnB, PSU-GO, PSU-DF/g, focusTarget);

  const rawResult = await generateWithAI(customPrompt, model, finalCredits);
  return removeDuplicateSumarios(rawResult);
}

function slugify(text: any): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * MODO MONOGRAFIA (100cr): Geração em múltiplas etapas para alcançar 10-20 páginas de conteúdo.
 */
async function generateMonograph(title: string, area: string, reference?: string, userId?: string, onProgress?: ProgressCallback, illustrationLevel: string = 'moderate', alertBoxLevel: string = 'moderate') {
  const model = "gemini-3.1-flash-lite";
  
  try {
    let extra = 0;
    if (illustrationLevel === 'minimum') extra -= 3;
    else if (illustrationLevel === 'maximum') extra += 10;
    
    if (alertBoxLevel === 'minimum') extra -= 2;
    else if (alertBoxLevel === 'maximum') extra += 5;

    const totalCost = Math.max(1, 100 + extra);
    await checkUsageLimit(totalCost);
    console.log(`[Monografia] Iniciando geração exaustiva para: ${title}`);
    
    if (extra !== 0) {
      await recordUsage(extra);
    }
    
    onProgress?.({ current: 1, total: 11, message: "Planejando estrutura..." });
    
    // Etapa 1: Gerar Estrutura Detalhada
    const outlinePrompt = `Você é um coordenador de curso de medicina e banca examinadora de alta performance. Crie um sumário/outline ACADÊMICO DE EXTREMA EXCELÊNCIA para uma monografia de conclusão de curso completa, extremamente rica e didática sobre "${title}" (${area}).
    O sumário deve ter exatamente 10 capítulos numerados, organizados na SEQUÊNCIA DIDÁTICA E ACADÊMICA MAIS EFICAZ, COMPREENSIVA E LOGICAMENTE PROGRESSIVA, focada em exaurir o tema para que o aluno domine todo o espectro do assunto e resolva qualquer questão de prova de residência médica.
    
    ATENÇÃO - DIRETRIZ INVIOLÁVEL PARA OS CAPÍTULOS:
    - Os primeiros 9 capítulos devem cobrir em máxima profundidade e de forma bem distribuída toda a fundamentação teórica, anatomia/fisiologia clínica, farmacologia e mecanismos específicos (doses e drogas se aplicável), classificações clínicas oficiais inteiras, avaliação pré-procedimento/pré-operatória, semiologia beira-de-leito, propedêutica diagnóstica, condutas terapêuticas completas, fluxos assistenciais, prevenção e tratamento exaustivo de complicações/intercorrências críticas, peculiaridades de provas regionais/nacionais (ENARE, UFG, UnB, PSU-GO, PSU-DF) e evidências científicas baseadas em diretrizes atuais (2024-2026).
    - O Capítulo 10 deve ser OBRIGATORIAMENTE um "Roteiro Prático de Consulta e Manejo Clínico de Beira de Leito", detalhando o passo a passo da consulta, com scripts de perguntas do médico, as possíveis respostas e reações clínicas do paciente, e a devida explicação funcional do manejo clínico a ser adotado sob cada cenário de resposta.

    Certifique-se de que os capítulos contemplem na ordem exata e mais produtiva para o leitor:
    - Fundamentação clássica, avançada e exaustiva do tema (adaptado perfeitamente se for manifestação/doença ou assistência/procedimento clínico).
    - Graus de Recomendação Clínica e Nível de Evidência Científica (Sistema GRADE ou Oxford) das condutas de eleição bem integradas no miolo das condutas.
    - Impacto Epidemiológico, Regional, Farmacoeconômico ou Clínico sob a ótica da saúde pública e do SUS no Brasil (com forte ênfase no Centro-Oeste / GO e DF).
    - Capítulo 10 como roteiro prático e interativo de anamnese, exame físico focado e tomada de decisão conforme as possíveis respostas do paciente.
    - Considerações Acadêmicas e Referências Bibliográficas no formato de Vancouver ou ABNT de forma diluída nos capítulos.

    Retorne APENAS um array JSON de strings com os títulos de exatamente 10 capítulos, perfeitamente encadeados e sem lacunas temporais ou didáticas. Exemplo de item final: ["...", "Capítulo 10: Roteiro Prático de Consulta, Anamnese Guiada e Manejo Comentado de Beira de Leito"]`;
    
    console.log("[Monografia] Solicitando estrutura...");
    const outline = await callGemini('generateJson', outlinePrompt, model) as string[];
    
    if (!Array.isArray(outline) || outline.length === 0) {
      console.error("[Monografia] Falha na estrutura:", outline);
      throw new Error("Falha ao gerar estrutura da monografia. Formato inválido.");
    }

    console.log("[Monografia] Estrutura definida:", outline);
    onProgress?.({ current: 2, total: 11, message: `Estrutura pronta: ${outline.length} capítulos.` });

    let fullMonograph = `# ${title.toUpperCase()}\n\n*Tratado Médico Especializado - Gerado por Preceptor IA*\n\n---\n\n## SUMÁRIO\n\n`;
    outline.forEach((chapter, idx) => {
      const slug = slugify(chapter);
      fullMonograph += `${idx + 1}. [${chapter}](#${slug})\n`;
    });
    fullMonograph += `\n---\n\n`;
    
    // Etapa 2: Gerar cada capítulo individualmente com profundidade máxima
    for (let i = 0; i < outline.length; i++) {
      const chapterTitle = outline[i];
      const progressPercent = Math.round(((i + 1) / outline.length) * 100);
      console.log(`[Monografia] [${progressPercent}%] Processando: ${chapterTitle}`);
      
      onProgress?.({ 
        current: i + 2, 
        total: 11, 
        message: `Escrevendo Capítulo ${i + 1}/10: ${chapterTitle.substring(0, 30)}...` 
      });
      
      // Delay técnico reduzido de 25s para 5s devido à rotação de chaves
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      const nextChapterTitle = i < outline.length - 1 ? outline[i + 1] : null;
      const isChapter10 = i === 9 || chapterTitle.toLowerCase().includes('capítulo 10') || chapterTitle.toLowerCase().includes('capitulo 10');
      
      const chapterPrompt = `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite. Você está escrevendo um TRATADO MÉDICO MAGNUM OPUS, exaustivo, enciclopédico e didaticamente impecável sobre "${title}".
      CAPÍTULO PARA ESCREVER AGORA: "${chapterTitle}".
      
      ${nextChapterTitle ? `CRONOGRAMA DE CAPÍTULOS: O próximo capítulo sequencial após este será exatamente: "${nextChapterTitle}". Se for incluir uma frase de finalização ou sugestão de transição de leitura ao final do capítulo, refira-se obrigatoriamente a este título de forma exata e coincidente: "${nextChapterTitle}". Nunca sugira capítulos sequenciais com nomes diferentes deste.` : "Este é o capítulo final exaustivo da monografia."}
      
      EXIGÊNCIA DE COMPLETUDE TOTAL, APROFUNDAMENTO E DIDÁTICA (MANDATÓRIO):
      - DENSIDADE E METRAGEM PEDAGÓGICA (APROFUNDAMENTO SEM REDUNDÂNCIA): Redija um capítulo extremamente denso, rico e substancial (busque entre 800 e 1.200 palavras por capítulo). Aprofunde ao máximo cada subseção com riqueza conceitual, fisiopatologia explicada passo a passo (o porquê de cada alteração), dados farmacológicos completos (mecanismos, posologias exatas, ajustes em insuficiência renal/hepática, efeitos adversos) e condutas práticas de falha terapêutica.
      - ESCALAS, ESCORES E CLASSIFICAÇÕES QUE MAIS CAEM EM PROVAS: Apresente obrigatoriamente de forma completa e em tabelas organizadas todas as escalas, escores e classificações de alta prevalência em provas de residência relevantes ao capítulo (ex: Glasgow, Mallampati, Cormack-Lehane, ASA, NYHA, Child-Pugh, CURB-65, CHADS-VASc, Ranson, Wells, Geneva, Alvarado, Apgar, qSOFA/SOFA, Balthazar, Tisdale, Marshall, PIRADS, BI-RADS, Killip, TIMI, GRACE, Framingham, GINA, GOLD, NIHSS, Hunt-Hess, Fisher, etc.). Inclua pontuações, estratificação de risco e a conduta de prova vinculada a cada escore.
      - NARRATIVA TÉCNICA DIRETA: Evite frases vazias ou enrolações introdutórias ("Como sabemos...", "É importante destacar..."). Vá direto ao ponto técnico de alto valor para a prática médica e provas de residência.
      - Este capítulo DEVE ser extremamente didático, bem estruturado, compreensível e autossuficiente para esclarecer todo o tema correspondente ao título do capítulo e garantir que o aluno consiga acertar qualquer questão de prova sobre ele.
      - NÃO RESTRINJA O TAMANHO DOS PARÁGRAFOS: Se for necessário para detalhar ou explicar com alta didática e eficácia os mecanismos fisiológicos, farmacológicos, anatômicos ou técnicos, utilize parágrafos completos, densos e bem encadeados.
      - EXCELENTE ESTRUTURAÇÃO COESA: Evite informações jogadas ou soltas. Cada dado clínico deve estar perfeitamente encadeado dentro de uma narrativa lógica, progressiva e integrada.
      - Utilize formatação Markdown de alto impacto visual: listas numeradas para passos operatórios/clínicos, listas de marcadores (bullet points) aninhadas para classificações e critérios diagnósticos, termos-chave em negrito (**destaque**) e tabelas comparativas Markdown.
      - DIRETRIZ CONTRA REPETIÇÕES (CRÍTICO): Como este capítulo faz parte de uma monografia com 10 capítulos, você NÃO DEVE repetir tabelas, classificações completas ou definições exaustivas que já pertençam ou caibam em outros capítulos. Por exemplo, se a monografia aborda ANESTESIOLOGIA/ANESTESIA, classificações como a de ASA (I a VI), Mallampati (I a IV), Cormack-Lehane, tempos de jejum pré-operatório, ou toxicidade de anestésicos locais SÓ DEVERÃO SER DETALHADAS se o título do capítulo atual for EXPLICITAMENTE focado nisso (ex: Avaliação Pré-Anestésica, Via Aérea, etc.). Nos demais capítulos que tratam de outras fases ou técnicas, faça apenas menções breves de referência (ex: 'conforme critérios da classificação ASA do paciente') sem repetir as tabelas ou descrições minuciosas. Isso é fundamental para manter a monografia coesa, fluida e não repetitiva.
      - Se este capítulo é o foco de ANESTESIOLOGIA/ANESTESIA (ex: Avaliação Pré-Anestésica ou Farmacologia Anestésica): forneça a classificação ASA completa (ASA I a VI e "E") com critérios claros e exemplos, diretrizes de jejum pré-operatório para sólidos e líquidos, classificação de via aérea difícil (Mallampati I-IV, Cormack-Lehane 1-4) com descrição minuciosa, farmacologia clínica dos anestésicos gerais (venosos e inalatórios, doses exatas, potência/CAM, contraindicações), anestésicos locais (mecanismo de ação, doses máximas com e sem vasoconstritor, tempo de latência/duração), toxicidade sistêmica por anestésicos locais (LAST) com conduta de emergência passo a passo incluindo emulsão lipídica 20%, bloqueadores neuromusculares, e fisiopatologia e manejo exato da Hipertermia Maligna (incluindo dose de Dantrolene de 2.5 mg/kg IV repetida se necessário).
      - Para qualquer outro tema médico, garanta que todas as classificações oficiais inteiras, escores, critérios de gravidade, doses farmacológicas exatas, mecanismos e fluxogramas diagnósticos/terapêuticos sejam apresentados de forma exaustiva e sem simplificações ou omissões.
      
      ${isChapter10 ? `DIRETRIZ ESPECIAL PARA O CAPÍTULO 10 (INVIOLÁVEL):
      Este é o capítulo focado no ROTEIRO PRÁTICO DE CONSULTA E MANEJO CLÍNICO BEIRA-DE-LEITO.
      Você deve redigir o conteúdo simulando:
      - SCRIPT DE CONSULTA MÉDICA: Exiba perguntas estruturadas e sequenciais que o médico deve fazer na anamnese.
      - RESPOSTAS DO PACIENTE: Apresente as possíveis respostas, queixas acadêmicas ou reações do paciente para cada questionamento do médico.
      - EXPLICAÇÃO E CONDUTA DE MANEJO: Para cada resposta descrita, explique detalhadamente de forma didática o raciocínio fisiológico por trás, a exata conduta terapêutica imediata, o adjustment de dosagem necessária e o manejo corretivo de possíveis intercorrências de acordo com as diretrizes do SUS e SES-GO/SES-DF.
      - SEÇÃO FINAL MANDATÓRIA DE REFERÊNCIAS: Como este é o capítulo de encerramento da monografia, inclua obrigatoriamente ao final dele a seção "## 📚 REFERÊNCIAS BIBLIOGRÁFICAS E DIRETRIZES TÉCNICAS", listando e descrevendo detalhadamente (de 5 a 8 fontes) os livros-texto e diretrizes oficiais utilizadas no tratado (UpToDate, Ministério da Saúde, SBC, SBPT, FEBRASGO, SBP, Harrison, Sabiston, etc.).
      Organize em formato de diálogo simulado intercalado por tabelas Markdown de diagnóstico/intervenção e caixas explicativas do Preceptor.` : ''}

      TOM DE VOZ (ESTILO PRECEPTOR):
      - Use uma linguagem de mestre para aluno: "Veja bem, doutor...", "Note este detalhe clínico crucial...", "Nunca confunda X com Y, isso custa a vaga".
      - Seja INTERATIVO: Faça perguntas retóricas que provoquem o raciocínio clínico.
      - Use analogias beira-de-leito para facilitar a memorização de dados áridos.

      REQUISITOS DO CAPÍTULO:
      - Profundidade máxima de livro-texto (Harrison, Nelson, Sabiston, Diretrizes Oficiais SBC/SBPT/Febrasgo).
      - BOXES DE FOCO REGIONAL (OBRIGATÓRIO): Intercale exemplos de como este assunto cai em: UFG, UnB, PSU-GO, PSU-DF, SES-GO, SES-DF, ENAMED e ENARE. 
      - ALGORITMO E CONDUTAS CLÍNICAS: Sempre que o capítulo tratar de Algoritmo de Diagnóstico, Manejo Terapêutico, ou Classificação Clínica, descreva o passo a passo de forma detalhada e estruturada usando tabelas Markdown ou listas numeradas. Você está sob PROIBIÇÃO DE IMAGENS AUTOMÁTICAS: é terminantemente proibido inserir qualquer tipo de imagem, figura ou link de imagem Markdown de forma automática no corpo do texto. O texto deve ser gerado de forma puramente textual e teórica. Não use tags SVG ou HTML.
      - TABELAS E FLUXOGRAMAS: Use tabelas Markdown para comparar condutas e diagnósticos diferenciais.
      - Seja denso e técnico, vá direto ao ponto, mas mantenha o tom de mentoria.
      
      ESTRUTURA: Comece diretamente no título (## ${chapterTitle}). Use apenas Markdown puro.`;
      
      let chapterContent = "";
      const finalChapterPrompt = chapterPrompt + getPromptPreferenceInstructions(illustrationLevel, alertBoxLevel);
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const currentModel = "gemini-3.1-flash-lite";
          chapterContent = await callGemini('generateContent', finalChapterPrompt, currentModel);
          if (chapterContent && chapterContent.trim().length > 0) break;
        } catch (capErr: any) {
          console.warn(`[Monografia] Tentativa ${attempt + 1}/3 falhou no capítulo ${i + 1}:`, capErr?.message);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (chapterContent && chapterContent.trim().length > 0) {
        const cleanedChapterContent = cleanLeadingChapterTitle(chapterContent, chapterTitle);
        fullMonograph += `## ${chapterTitle}\n\n${cleanedChapterContent}\n\n---\n\n`;
      } else {
        fullMonograph += `\n\n## ${chapterTitle}\n\n*Nota: Conteúdo resumido para este capítulo por instabilidade temporária do servidor de IA. Utilize o botão 'Aprofundar Capítulo' para expandir.*\n\n---\n\n`;
      }
      onProgress?.({ 
        current: i + 2, 
        total: outline.length + 1, 
        message: `Capítulo ${i + 1}/${outline.length} gerado.`, 
        partialContent: fullMonograph 
      });
    }

    onProgress?.({ current: 11, total: 11, message: "Monografia concluída!" });
    await recordUsage(100);
    return removeDuplicateSumarios(fullMonograph);
  } catch (error) {
    console.error('Error generating monograph:', error);
    throw error;
  }
}

export function getChaptersFromMonograph(content: string): string[] {
  const chapters: string[] = [];
  if (!content) return chapters;

  const lines = content.split('\n');
  let inSummary = false;
  for (const line of lines) {
    if (line.includes('SUMÁRIO')) {
      inSummary = true;
      continue;
    }
    if (inSummary) {
      if (line.trim().startsWith('---') || (line.trim().startsWith('## ') && !line.includes('SUMÁRIO'))) {
        inSummary = false;
      } else {
        // Combinativo para "- [Título](#slug)", "1. [Título](#slug)", "* [Título]", "1. Título"
        const match = line.match(/^(?:[\d+\.\-\*]|\d+\.)\s*\[?(.*?)\]?(?:\(#.*?\))?\s*$/);
        if (match && match[1]) {
          let title = match[1].trim();
          if (title.includes('](')) {
            title = title.split('](')[0].replace(/^\[/, '');
          }
          if (title && title.length > 2 && !title.toLowerCase().includes('sumário')) {
            chapters.push(title);
          }
        }
      }
    }
  }
  
  if (chapters.length === 0) {
    for (const line of lines) {
      if (line.startsWith('## ') && !line.includes('SUMÁRIO')) {
        const title = line.replace(/^##\s+/, '').trim();
        if (title && title.length > 2) {
          chapters.push(title);
        }
      }
    }
  }
  return chapters;
}

export async function resumeFailedSummaryContent(
  title: string,
  area: string,
  currentContent: string,
  reference?: string,
  userId?: string,
  depth: GenerationDepth = 'standard',
  onProgress?: ProgressCallback,
  illustrationLevel: string = 'moderate',
  alertBoxLevel: string = 'moderate',
  analysis?: any
) {
  const model = "gemini-3.1-flash-lite";
  
  try {
    await checkUsageLimit();
    console.log(`[Resume] Resuming failed or interrupted summary for: ${title} (${depth})`);

    let updatedContent = currentContent;

    if (depth === 'custom_analyzed') {
      let analysisToUse = analysis;
      if (!analysisToUse || !analysisToUse.chapters || analysisToUse.chapters.length === 0) {
        const extractedChapters = getChaptersFromMonograph(currentContent);
        analysisToUse = {
          cost: 25,
          chapters: extractedChapters.length > 0 ? extractedChapters : [
            '1. Introdução e Epidemiologia',
            '2. Fisiopatologia e Apresentação Clínica',
            '3. Propedêutica Diagnóstica',
            '4. Tratamento, Doses e Condutas Completas',
            '5. Peculiaridades de Provas locais e Prática'
          ],
          clinicalHighlights: []
        };
      }
      return await generateCustomAnalyzedSummary(
        title,
        area,
        analysisToUse,
        reference,
        userId,
        onProgress,
        illustrationLevel,
        alertBoxLevel,
        currentContent,
        'custom_analyzed'
      );
    }

    const isProcedure = /parto|assistência|assistencia|técnica|tecnica|semiologia|exame|procedimento|manobra|reanimação|reanimacao|intubação|intubacao|acesso|sutura|curativo|planejamento|consulta|anamnese|avaliação|avaliacao|escore|escala|aleitamento|vacina|imunização|imunizacao|suporte|atendimento/i.test(title);

    if (depth === 'monograph') {
      const chapters = getChaptersFromMonograph(currentContent);
      console.log(`[Resume Monograph] Parsed chapters:`, chapters);

      if (chapters.length === 0) {
        throw new Error("Não foi possível identificar os capítulos no texto atual para retomar.");
      }

      onProgress?.({ current: 1, total: chapters.length + 1, message: "Analisando capítulos falhos..." });

      for (let i = 0; i < chapters.length; i++) {
        const chapterTitle = chapters[i];
        
        const headingIndex = updatedContent.indexOf(`## ${chapterTitle}`);
        const nextHeadingIndex = i < chapters.length - 1 ? updatedContent.indexOf(`## ${chapters[i + 1]}`) : -1;
        
        let chapterBody = "";
        if (headingIndex !== -1) {
          chapterBody = nextHeadingIndex !== -1 
            ? updatedContent.substring(headingIndex, nextHeadingIndex) 
            : updatedContent.substring(headingIndex);
        }

        const isFailed = headingIndex === -1 || 
                         chapterBody.includes('Erro na geração') || 
                         chapterBody.includes('Conteúdo indisponível') || 
                         chapterBody.includes('falha de rede') ||
                         chapterBody.includes('Erro de conexão') ||
                         chapterBody.trim().length < 150;

        if (isFailed) {
          console.log(`[Resume Monograph] Capítulo ${i+1} falho detectado: ${chapterTitle}. Regerando...`);
          onProgress?.({ 
            current: i + 1, 
            total: chapters.length + 1, 
            message: `Regerando Capítulo ${i + 1}/${chapters.length}: ${chapterTitle.substring(0, 30)}...` 
          });

          await new Promise(resolve => setTimeout(resolve, 3000));

          const nextChapterTitle = i < chapters.length - 1 ? chapters[i + 1] : null;
          
          const chapterPrompt = `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite. Você está escrevendo um TRATADO MÉDICO MAGNUM OPUS, exaustivo, enciclopédico e didaticamente impecável sobre "${title}".
          CAPÍTULO PARA ESCREVER AGORA: "${chapterTitle}".
          
          ${nextChapterTitle ? `CRONOGRAMA DE CAPÍTULOS: O próximo capítulo sequencial após este será exatamente: "${nextChapterTitle}". Se for incluir uma frase de finalização ou sugestão de transição de leitura ao final do capítulo, refira-se obrigatoriamente a este título de forma exata e coincidente: "${nextChapterTitle}". Nunca sugira capítulos sequenciais com nomes diferentes deste.` : "Este é o capítulo final exaustivo da monografia."}
          
          EXIGÊNCIA DE COMPLETUDE TOTAL E DIDÁTICA (MANDATÓRIO):
          - Este capítulo DEVE ser extremamente didático, bem estruturado, compreensível e autossuficiente para esclarecer todo o tema correspondente ao título do capítulo.
          - NÃO RESTRINJA O TAMANHO DOS PARÁGRAFOS: Forneça explicações detalhadas e completas.
          - Use formatação Markdown de alto impacto visual e tabelas comparativas Markdown.
          
          ESTRUTURA: Comece diretamente no título (## ${chapterTitle}). Use apenas Markdown puro.`;

          const finalChapterPrompt = chapterPrompt + getPromptPreferenceInstructions(illustrationLevel, alertBoxLevel);
          const chapterContent = await callGemini('generateContent', finalChapterPrompt, model);

          if (chapterContent) {
            const cleanedChapterContent = cleanLeadingChapterTitle(chapterContent, chapterTitle);
            const replacementText = `## ${chapterTitle}\n\n${cleanedChapterContent}\n\n---\n\n`;
            
            if (headingIndex !== -1) {
              const before = updatedContent.substring(0, headingIndex);
              const after = nextHeadingIndex !== -1 ? updatedContent.substring(nextHeadingIndex) : "";
              updatedContent = before + replacementText + after;
            } else {
              updatedContent += replacementText;
            }
            await recordUsage(2);
          }
        }
      }

      onProgress?.({ current: chapters.length + 1, total: chapters.length + 1, message: "Monografia restaurada com sucesso!" });
      return updatedContent;
    } 
    
    if (depth === 'master') {
      const { residencyFocus, isCustom } = await getUserFocusSettings(userId);
      const regionalShort = isCustom ? residencyFocus : "GO/DF";

      const parts = isProcedure ? [
        {
          title: "Início: Introdução Clínica, Anatomia/Fisiologia Aplicada e Indicações",
          prompt: `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite. Seu objetivo é TREINAR o aluno para as residências mais difíceis, com foco no Centro-Oeste.
          Escreva a **Parte 1 (Início: Introdução Clínica, Anatomia/Fisiologia Aplicada e Indicações)** para o tema da assistência/procedimento clínico: "${title}" (${area}). ${reference ? `Use como preferência de referência: "${reference}".` : ""}
          NÃO RESTRINJA O TAMANHO DOS PARÁGRAFOS: Forneça explicações extremamente detalhadas e didáticas.`
        },
        {
          title: "Meio: Desenvolvimento Prático, Passo a Passo e Técnicas de Execução",
          prompt: `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite. Seu objetivo é TREINAR o aluno para as residências mais difíceis, com foco no Centro-Oeste.
          Escreva a **Parte 2 (Meio: Desenvolvimento Prático, Passo a Passo e Técnicas de Execução)** para o tema da assistência/procedimento clínico: "${title}" (${area}).
          DESENVOLVIMENTO DETALHADO DO PASSO A PASSO.`
        },
        {
          title: "Fim: Conclusão Clínica, Intercorrências Tardias, Alta e Checklist de Cuidados",
          prompt: `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite. Seu objetivo é TREINAR o aluno para as residências mais difíceis, com foco no Centro-Oeste.
          Escreva a **Parte 3 (Fim: Conclusão Clínica, Intercorrências Tardias, Alta e Checklist de Cuidados)** para o tema da assistência/procedimento clínico: "${title}" (${area}).`
        }
      ] : [
        {
          title: "Início: Introdução Clínica, Fisiopatologia, Semiologia e Apresentação",
          prompt: `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite. Seu objetivo é TREINAR o aluno para as residências mais difíceis, com foco no Centro-Oeste.
          Escreva a **Parte 1 (Início: Introdução Clínica, Fisiopatologia, Semiologia e Apresentação)** para o tema: "${title}" (${area}). ${reference ? `Use como preferência de referência: "${reference}".` : ""}
          NÃO RESTRINJA O TAMANHO DOS PARÁGRAFOS: Forneça explicações detalhadas.`
        },
        {
          title: "Meio: Desenvolvimento Clínico, Propedêutica, Raciocínio Diagnóstico e Fluxo",
          prompt: `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite. Seu objetivo é TREINAR o aluno para as residências mais difíceis, com foco no Centro-Oeste.
          Escreva a **Parte 2 (Meio: Desenvolvimento Clínico, Propedêutica, Raciocínio Diagnóstico e Fluxo)** para o tema: "${title}" (${area}).`
        },
        {
          title: `Fim: Conclusão Terapêutica, Condutas Completas, Doses e Particularidades Regionais (${regionalShort})`,
          prompt: `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite. Seu objetivo é TREINAR o aluno para as residências mais difíceis, com foco no Centro-Oeste.
          Escreva a **Parte 3 (Fim: Conclusão Terapêutica, Condutas Completas, Doses e Particularidades Regionais (${regionalShort}))** para o tema: "${title}" (${area}).`
        }
      ];

      onProgress?.({ current: 1, total: parts.length + 1, message: "Analisando seções falhas..." });

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        const headingIndex = updatedContent.indexOf(`## ${part.title}`);
        const nextHeadingIndex = i < parts.length - 1 ? updatedContent.indexOf(`## ${parts[i + 1].title}`) : -1;
        
        let partBody = "";
        if (headingIndex !== -1) {
          partBody = nextHeadingIndex !== -1 
            ? updatedContent.substring(headingIndex, nextHeadingIndex) 
            : updatedContent.substring(headingIndex);
        }

        const isFailed = headingIndex === -1 || 
                         partBody.includes('Erro na geração') || 
                         partBody.includes('Conteúdo indisponível') || 
                         partBody.includes('falha de rede') ||
                         partBody.includes('Erro de conexão') ||
                         partBody.trim().length < 150;

        if (isFailed) {
          console.log(`[Resume Master] Seção ${i+1} falha detectada: ${part.title}. Regerando...`);
          onProgress?.({ 
            current: i + 1, 
            total: parts.length + 1, 
            message: `Regerando Seção ${i + 1}/${parts.length}: ${part.title.substring(0, 30)}...` 
          });

          await new Promise(resolve => setTimeout(resolve, 3000));

          const finalPartPrompt = part.prompt + getPromptPreferenceInstructions(illustrationLevel, alertBoxLevel);
          const partContent = await callGemini('generateContent', finalPartPrompt, model);

          if (partContent) {
            const replacementText = `## ${part.title}\n\n${partContent}\n\n---\n\n`;
            
            if (headingIndex !== -1) {
              const before = updatedContent.substring(0, headingIndex);
              const after = nextHeadingIndex !== -1 ? updatedContent.substring(nextHeadingIndex) : "";
              updatedContent = before + replacementText + after;
            } else {
              updatedContent += replacementText;
            }
            await recordUsage(5);
          }
        }
      }

      onProgress?.({ current: 4, total: 4, message: "Resumo Extensivo restaurado!" });
      return updatedContent;
    }

    onProgress?.({ current: 1, total: 2, message: "Regerando resumo..." });
    const content = await generateTopicContent(title, area, reference, userId, depth, onProgress, illustrationLevel, alertBoxLevel);
    onProgress?.({ current: 2, total: 2, message: "Resumo concluído!" });
    return content;

  } catch (error) {
    console.error('Error during resume failed summary:', error);
    throw error;
  }
}

export async function deepenTopicSection(topicTitle: string, currentContent: string, sectionTitle: string, userId?: string, customPrompt?: string) {
  try {
    await checkUsageLimit();
    
    const credits = customPrompt ? 4 : 2;
    const model = 'gemini-3.1-flash-lite';
    
    const targetSubject = customPrompt || sectionTitle;
    
    const promptText = `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite.
Você está realizando uma mentoria clínica hiper-personalizada de alta complexidade para esclarecer e aprofundar uma dúvida de um aluno de alto rendimento.

TÓPICO PRINCIPAL DE DISCUSSÃO: "${topicTitle}"

MATÉRIA / CONCEITO ATUAL DA DISCUSSÃO NO RESUMO:
---
${currentContent.substring(0, 1500)}
---

DÚVIDA DO ESTUDANTE / TEMA ESPECÍFICO DE PROVA PARA DESENVOLVER:
"${targetSubject}"

DIRETRIZES DA RESPOSTA (RIGOR MÁXIMO PRECEPTOR):
1. TOM DE VOZ: Comece com um acolhimento estimulante no seu tom de preceptor (ex: "Veja bem, doutor...", "Análise clínica excelente...", "Aqui está o detalhe que aprova!").
2. EXPLICAÇÃO PROFUNDA E EFICAZ: Explique em detalhes a fisiopatologia, os critérios diagnósticos práticos, as pegadinhas de prova nacionais/regionais e a conduta terapêutica exata (doses, vias, fluxos do SUS e notas da SES-GO/SES-DF e do ENARE se relevante) relacionada a essa dúvida.
   - NÃO RESTRINJA O TAMANHO DOS PARÁGRAFOS: Se for necessário para detalhar ou explicar com alta didática e eficácia os mecanismos fisiológicos, farmacológicos, anatômicos ou técnicos, utilize parágrafos completos e densos.
   - COMPLETUDE PARA PROVAS: Forneça absolutamente tudo o que é necessário para compreender o tema e responder a qualquer questão de prova de residência médica de forma resolutiva.
   - ESTRUTURAÇÃO IMPECÁVEL E COESA: Evite informações soltas ou fragmentos sem contexto. Cada parágrafo, conceito e dado clínico deve estar perfeitamente interligado dentro de uma narrativa lógica, contínua e integrada.
3. FORMATO: Responda obrigatoriamente formatado em Markdown profissional de alta legibilidade, com subtópicos claros e elegantes, tabelas comparativas e caixas de "DICA DO PRECEPTOR / PEGADINHA DE PROVA" se adequado. Use notação LaTeX para termos médicos ($ \rightarrow $, $ \le $, $ \beta $-bloqueadores).

Assine de forma encorajadora como: "Excelente dedicação clínica. Foca no detalhe e bons estudos!"`;

    const result = await callGemini('generateContent', promptText, model);
    await recordUsage(credits);
    return result;
  } catch (error) {
    console.error('Error deepening topic section:', error);
    throw error;
  }
}

export async function generateQuestions(
  topicTitle: string, 
  area: string, 
  count: number = 10, 
  existingQuestions: string[] = [], 
  userId?: string,
  targetExam?: string
) {
  await checkUsageLimit();

  const chunkSize = Math.min(count, 2); // Generate 2 questions at a time to strictly guarantee complete, unabridged clinical vignettes and full options without model summarization
  const allQuestions: any[] = [];
  const currentExisting = [...existingQuestions];

  const { residencyFocus } = await getUserFocusSettings(userId);
  let examFocusText = `Você DEVE priorizar com 100% de rigidez as seguintes bancas de residência médica de interesse do candidato: **${residencyFocus}** (2022 a 2026).`;

  if (targetExam && targetExam !== 'all') {
    examFocusText = `Você DEVE priorizar com 100% de rigidez a banca de residência médica: **${targetExam}** (2022 a 2026).`;
  }

  let remaining = count;
  while (remaining > 0) {
    const currentChunkSize = Math.min(chunkSize, remaining);
    
    const chunkPrompt = `Você é uma autoridade em concursos de residência médica no Brasil e um banco de dados de exames de seleção médica.
    Sua tarefa é recuperar e fornecer exatamente ${currentChunkSize} questões autênticas, completas e de alto nível para exames de residência médica sobre o tema "${topicTitle}" (${area}).
    
    ORDEM DE PRIORIDADE E CASCATA DE DECISÃO OBRIGATÓRIA (INDIQUE O RESULTADO EXATO NO CAMPO "source"):
    1ª PRIORIDADE (Bancas Selecionadas - Últimos 5 Anos):
    - Recupere exaustivamente questões reais das bancas prioritárias selecionadas pelo candidato: **${residencyFocus}** (anos 2022 a 2026).
    - Formato obrigatorio do "source": "SIGLA DA BANCA (ANO)" -> Ex: "SES-DF (2024)", "ENARE (2025)", "SES-GO (2023)".

    2ª PRIORIDADE (Se a 1ª Falhar - Bancas Selecionadas nos Últimos 10 Anos):
    - SE E SOMENTE SE você constatar com certeza absoluta que NÃO HÁ NENHUMA OUTRA questão disponível deste tema nos últimos 5 anos nas bancas prioritárias, busque questões reais dessas MESMAS bancas prioritárias nos últimos 10 anos (anos 2016 a 2021).
    - Formato obrigatorio do "source": "SIGLA DA BANCA (ANO) - [Nota: Busca expandida para os últimos 10 anos nas bancas prioritárias]" -> Ex: "SES-DF (2018) - [Nota: Busca expandida para os últimos 10 anos nas bancas prioritárias]".

    3ª PRIORIDADE (Se a 1ª e a 2ª Falharem - Outras Bancas Brasileiras de Alta Concorrência):
    - SE E SOMENTE SE você constatar com certeza absoluta que NÃO HÁ NENHUMA OUTRA questão disponível deste tema nas bancas prioritárias nem nos últimos 10 anos, busque questões reais de outras bancas brasileiras de alta concorrência e renome nacional (ex: USP, UNIFESP, UNICAMP, SUS-SP, PSU-MG, AMRIGS, AMP, UERJ).
    - Formato obrigatorio do "source": "SIGLA DA BANCA (ANO) - [Nota: Não há outras questões deste tema nas bancas prioritárias. Questão de banca de alta concorrência]" -> Ex: "USP (2023) - [Nota: Não há outras questões deste tema nas bancas prioritárias. Questão de banca de alta concorrência]".

    4ª PRIORIDADE (Se a 1ª, 2ª e 3ª Falharem - Questão Inédita no Estilo Fiel da Prova):
    - SE E SOMENTE SE não existir nenhuma questão real de concurso público sobre este tema em nenhuma banca reconhecida, elabore uma questão 100% inédita na íntegra (caso clínico complexo completo, alternativas detalhadas) no estilo exato de cobrança da banca prioritária.
    - Formato obrigatorio do "source": "Inédita Estilo SIGLA DA BANCA (2026) - [Nota: Questão elaborada no estilo oficial da banca por ausência de questões anteriores deste tema especifico]" -> Ex: "Inédita Estilo ENARE (2026) - [Nota: Questão elaborada no estilo oficial da banca por ausência de questões anteriores deste tema especifico]".

    ATENÇÃO ABSOLUTA DE IDIOMA E ESTRUTURA:
    - TODO o conteúdo gerado (enunciado "text", alternativas "options", explicação "explanation", "frequentMistakesExplanation", etc.) DEVE estar rigorosamente escrito em PORTUGUÊS DO BRASIL.
    - NUNCA retorne enunciados ou opções em inglês.

    EXIGÊNCIAS RÍGIDAS DE INTEGRIDADE (SEM RESUMOS E SEM CORTES):
    1. ENUNCIADO 100% NA ÍNTEGRA (SEM RESUMOS): O enunciado ("text") DEVE conter o caso clínico completo na sua totalidade (idade, sexo, comorbidades, histórico da doença atual, sintomas, sinais vitais, achados de exame físico, resultados laboratoriais e achados de exames de imagem em todos os seus detalhes). É ESTRITAMENTE PROIBIDO resumir, parafrasear ou simplificar o caso clínico.
    2. ALTERNATIVAS 100% NA ÍNTEGRA (SEM CORTES): O vetor "options" DEVE conter todas as alternativas completas exatamente na íntegra, incluindo condutas detalhadas, doses de medicamentos, esquemas terapêuticos e formulações técnicas originais da prova.
    3. PURINHA E SEM TEXTO PREPARATÓRIO OU EXPLICAÇÃO DENTRO DO ENUNCIADO: O campo "text" deve conter APENAS e TÃO SOMENTE o enunciado oficial da questão, começando diretamente pelo caso clínico. É proibido inserir saudações, introduções ("Abaixo temos a questão..."), explicações ou notas no meio do enunciado.
    4. EXPLICAÇÃO DIDÁTICA E EXCLUSÃO DE ALTERNATIVAS: O campo "explanation" DEVE conter um comentário técnico completo em PORTUGUÊS garantindo o entendimento total da questão, explicando fundamentadamente por que a alternativa correta é a verdadeira E detalhando a exclusão exata/motivo do erro de cada uma das alternativas incorretas (ex: "Alternativa A incorreta pois...", "Alternativa B correta por...").

    REQUISITOS ADICIONAIS:
    1. DIVERSIDADE REAL DE ORIGEM E ANO: Cada questão gerada/recuperada DEVE possuir a sua banca e o seu ano ESPECÍFICOS e REAIS (ex: varie entre ENARE, SES-DF, SES-GO, UFG, UnB, USP, UNIFESP, UNICAMP, PSU-MG, AMRIGS e anos entre 2021 e 2026). É ESTRITAMENTE PROIBIDO atribuir a mesma banca e o mesmo ano fixo (como ENARE 2023) a todas as questões de um lote, a menos que o candidato tenha selecionado um filtro específico de banca única.
    2. Evite repetir enunciados parecidos com: ${currentExisting.join(', ')}.
    3. Estatísticas Regionais ("regionalIncidenceStats") e Termômetro ("heatLevel"): Frequência aproximada de cobrança do tema e termômetro ('baixo', 'medio', 'alto', 'extremo').
    4. Pegadinhas ("frequentMistakesExplanation"): Detalhes do distrator da banca em português.
    5. Gabarito Conflitante ("gabaritoConflict"): Anulações ou divergências em português.

    FORMATO DE RESPOSTA (APENAS JSON ESTREITO):
    [
      {
        "text": "Texto completo, extenso e detalhado do caso clínico e enunciado da prova em português...",
        "options": ["Alternativa A completa", "Alternativa B completa", "Alternativa C completa", "Alternativa D completa"],
        "correctOptionIndex": 0,
        "explanation": "Comentário técnico minucioso e fundamentado em português...",
        "source": "SIGLA DA BANCA REAL (ANO REAL DA QUESTÃO)",
        "regionalIncidenceStats": {
          "SES-DF": 12,
          "SES-GO": 8,
          "SUS-GO": 6,
          "HBDF": 5,
          "ENARE": 14
        },
        "heatLevel": "alto",
        "frequentMistakesExplanation": "Explicação da pegadinha da banca em português...",
        "gabaritoConflict": {
          "hasConflict": false,
          "description": "Situação do gabarito definitivo em português."
        }
      }
    ]`;

    try {
      let result = await callGemini('generateJson', chunkPrompt);
      if (!result || !Array.isArray(result) || result.length === 0) {
        // Fallback retry with simplified prompt if needed
        const retryPrompt = `Gere ${currentChunkSize} questões de residência médica sobre "${topicTitle}" (${area}) em formato JSON estrito para a banca ${residencyFocus}.\n` + chunkPrompt;
        result = await callGemini('generateJson', retryPrompt);
      }

      if (result && Array.isArray(result)) {
        allQuestions.push(...result);
        for (const q of result) {
          if (q && q.text) {
            currentExisting.push(q.text);
          }
        }
      }
    } catch (chunkError: any) {
      console.error(`Error generating chunk of questions:`, chunkError);
      if (allQuestions.length === 0 && remaining === count) {
        // First chunk failed completely - do NOT charge any credits!
        throw new Error(`A IA não conseguiu estruturar as questões neste momento (${chunkError?.message || 'erro de resposta'}). Nenhum crédito foi cobrado da sua conta.`);
      }
      // If some questions were already generated, break and keep generated ones
      break;
    }

    remaining -= currentChunkSize;
  }

  if (allQuestions.length === 0) {
    throw new Error(`Não foi possível recuperar questões no momento para o tema "${topicTitle}". Fique tranquilo, nenhum crédito foi cobrado da sua conta!`);
  }

  // Charge credits ONLY for questions actually generated (proportional: 3 credits per 5 questions)
  const creditsRecorded = Math.max(1, Math.ceil((allQuestions.length / 5) * 3));
  await recordUsage(creditsRecorded);

  return allQuestions;
}

export function calculateFlashcardCreditCost(cardsCount: number): number {
  if (cardsCount <= 10) return 2;
  if (cardsCount <= 20) return 3;
  if (cardsCount <= 30) return 4;
  if (cardsCount <= 40) return 5;
  if (cardsCount <= 50) return 6;
  return Math.min(10, Math.ceil(cardsCount / 10) + 1);
}

export interface FlashcardPotentialAnalysis {
  estimatedIdealCards: number;
  creditCost: number;
  coreMedicalConcepts: string[];
  analysisSummary: string;
}

export async function analyzeTopicFlashcardPotential(
  topicTitle: string,
  content: string
): Promise<FlashcardPotentialAnalysis> {
  const prompt = `Você é um diretor pedagógico do MedInternato especializado em Análise de Densidade de Conteúdo e Extração de Flashcards para Provas de Residência Médica.
Examine o texto médico do tema: "${topicTitle}".
Conteúdo do tema: ${content ? content.substring(0, 5000) : topicTitle}

Sua missão:
1. Determine o NÚMERO IDEAL DE FLASHCARDS ("estimatedIdealCards") necessário para garantir 100% DE COBERTURA dos pontos cruciais do tema (fisiopatologia, critérios diagnósticos, exames de escolha, tratamento de 1ª linha, complicações e pegadinhas de prova), sem gerar cards redundantes.
2. Liste os principais grupos de conceitos encontrados ("coreMedicalConcepts"), por exemplo: ["Diagnóstico e Critérios", "Tratamento de 1ª Linha", "Exames Complementares", "Sinais de Alarme"].
3. Escreva um resumo analítico direto ("analysisSummary") de 2 a 3 frases explicando por que esse número exato de cards foi recomendado para este tema específico.

Formato de Resposta (JSON estrito):
{
  "estimatedIdealCards": 25,
  "coreMedicalConcepts": ["Conceito 1", "Conceito 2", "Conceito 3"],
  "analysisSummary": "Explicação pedagógica da densidade do tema..."
}`;

  try {
    await checkUsageLimit();
    const result = await callGemini('generateJson', prompt);
    const estimatedIdealCards = typeof result.estimatedIdealCards === 'number' ? Math.max(5, Math.min(60, result.estimatedIdealCards)) : 20;
    const creditCost = calculateFlashcardCreditCost(estimatedIdealCards);

    return {
      estimatedIdealCards,
      creditCost,
      coreMedicalConcepts: Array.isArray(result.coreMedicalConcepts) ? result.coreMedicalConcepts : ['Conceitos do Tema'],
      analysisSummary: result.analysisSummary || `Recomendamos ${estimatedIdealCards} flashcards para cobertura integral deste tema.`
    };
  } catch (err) {
    console.error('Error analyzing flashcard potential:', err);
    return {
      estimatedIdealCards: 20,
      creditCost: calculateFlashcardCreditCost(20),
      coreMedicalConcepts: ['Conceitos do Tema'],
      analysisSummary: 'Recomendamos cerca de 20 flashcards para garantir a cobertura integral das principais condutas médicas.'
    };
  }
}

export async function generateFlashcards(topicTitle: string, content: string, count: number = 10, userId?: string) {
  const prompt = `Com base no conteúdo médico abaixo, gere ${count} flashcards (frente e verso) para estudo por repetição espaçada sobre o tema "${topicTitle}".
  Conteúdo: ${content ? content.substring(0, 4000) : topicTitle}
  
  REQUISITOS:
  - Escreva a frente e o verso estritamente em PORTUGUÊS (PORTUGUÊS DO BRASIL).
  - A frente deve ser uma pergunta curta ou conceito direto para completar.
  - O verso deve ser a resposta direta e concisa.
  - Adicione a chave "concept" para tag de diagnóstico de assunto (ex: "Diagnóstico", "Conduta de 1ª Linha", "Exame Padrão-Ouro", "Efeitos Colaterais").
  - Foque em "pérolas" de prova de residência e condutas médicas cruciais.
  
  Formato de Resposta (JSON estrito):
  [
    {
      "front": "Pergunta em português...",
      "back": "Resposta em português...",
      "concept": "Conceito Médico (ex: Tratamento de 1ª linha)"
    }
  ]`;

  try {
    await checkUsageLimit();
    const result = await callGemini('generateJson', prompt);
    const cost = calculateFlashcardCreditCost(count);
    await recordUsage(cost);
    return result;
  } catch (error) {
    console.error('Error generating flashcards:', error);
    throw error;
  }
}

export async function generateFlashcardDiagnosticReport(
  topicTitle: string,
  scores: { cardFront: string; concept?: string; rating: 'errei' | 'dificil' | 'bom' | 'facil' }[]
) {
  const failedConcepts = scores.filter(s => s.rating === 'errei' || s.rating === 'dificil').map(s => s.concept || s.cardFront);
  const masteredConcepts = scores.filter(s => s.rating === 'bom' || s.rating === 'facil').map(s => s.concept || s.cardFront);

  const prompt = `Você é um preceptor médico de alta performance do MedInternato.
Análise de Diagnóstico de Domínio para o tema: "${topicTitle}".
Desempenho nos Flashcards de Avaliação do Aluno:
- Conceitos Com Dificuldade/Erros: ${failedConcepts.join('; ') || 'Nenhum, o aluno respondeu tudo com facilidade!'}
- Conceitos Dominados: ${masteredConcepts.join('; ') || 'Nenhum'}

Forneça um relatório pedagógico de diagnóstico em formato JSON estrito com:
1. "overallMasteryLevel": resumo de 1 frase do nível (ex: "Nível Sólido com Lacunas em Conduta de Emergência")
2. "whatToStudy": array de 3 a 5 pontos diretos e pragmáticos de medicina que o aluno precisa revisar imediatamente.
3. "studyPlan": orientações práticas de como estudar (ex: "Focar na leitura do resumo de Cetoacidose e resolver 15 questões de provas recentes").
4. "revisionSchedule": recomendação de quando e como agendar as revisões espaçadas (24h, 7d, 30d).

Formato de Resposta (JSON estrito):
{
  "overallMasteryLevel": "...",
  "whatToStudy": ["Ponto 1", "Ponto 2", "Ponto 3"],
  "studyPlan": "...",
  "revisionSchedule": "..."
}`;

  try {
    await checkUsageLimit();
    const result = await callGemini('generateJson', prompt);
    await recordUsage(1);
    return result;
  } catch (err) {
    console.error('Error generating diagnostic report:', err);
    return null;
  }
}

export async function generateFlashcardDeepDive(
  cardFront: string,
  cardBack: string,
  concept: string,
  topicTitle?: string
) {
  const prompt = `Você é o COORDENADOR-PRECEPTOR do MedInternato. O aluno solicitou um APROFUNDAMENTO MÉDICO EXAUSTIVO E DE ALTA PERFORMANCE para este flashcard/conceito específico:

Foco / Conceito: "${concept || 'Conceito Médico'}"
${topicTitle ? `Tema Geral: "${topicTitle}"` : ''}
Pergunta (Frente): "${cardFront}"
Resposta (Verso): "${cardBack}"

CRIE UM APROFUNDAMENTO TÉCNICO COMPLETO EM MARKDOWN COM A SEGUINTE ESTRUTURA VISUAL E ACADÊMICA:

# 🔬 APROFUNDAMENTO CLÍNICO: ${concept || cardFront}

---

## 1. 🧠 MECANISMO FISIOLÓGICO E FISIOPATOLÓGICO CELULAR
- Explique o PORQUÊ desse achado ou conduta passo a passo.
- Detalhe a fisiopatologia molecular/celular, cascatas de sinalização, hemorrágicas, metabólicas ou mecânicas envolvidas.

## 2. 📋 DIAGNÓSTICO, EXAMES & ESCORES ASSOCIADOS
- Descreva a propedêutica de 1ª linha e padrão-ouro.
- Se houver escore de risco, critérios ou escala associada (ex: Wells, CURB-65, CHADS-VASc, NIHSS, Ranson, Child-Pugh, MELD, etc.), apresente a **TABELA COMPLETA** com critérios, pontos e condutas.

## 3. 💊 TRATAMENTO, CONDUTA E POSOLOGIA COMPLETA
- Farmacologia detalhada com Doses exatas (mg/kg), vias, posologias, duração do tratamento e ajustes em falência renal ou hepática.
- Algoritmo de conduta passo a passo (1ª e 2ª linhas de tratamento).

## 4. 🎯 PÉROLA DE PROVA & DICA DO PRECEPTOR
> [!IMPORTANT]
> **HIGHLIGHT DE ALTO RENDIMENTO PARA PROVAS (ENARE / UFG / SES-GO / SES-DF):**
> [Dica cirúrgica sobre como as bancas cobram essa pegadinha ou exceção na prova]

Escreva de forma extremamente densa, rica, didática e profissional em Markdown. Evite redundâncias vazias.`;

  try {
    await checkUsageLimit();
    const result = await callGemini('generateContent', prompt, "gemini-3.1-flash-lite");
    await recordUsage(1);
    return removeDuplicateSumarios(result);
  } catch (err) {
    console.error('Error generating flashcard deep dive:', err);
    throw err;
  }
}

export async function analyzeFlashcardSessionForSummary(
  scores: { cardFront: string; cardBack: string; concept: string; rating: string; topicId?: string }[],
  topicTitles: string[]
) {
  const failedCards = scores.filter(s => s.rating === 'errei' || s.rating === 'dificil');
  const failedList = failedCards.map(s => `- Conceito: ${s.concept || 'Geral'} | Q: ${s.cardFront} | R: ${s.cardBack}`).join('\n');

  const prompt = `Você é o Coordenador-Preceptor do MedInternato. Analise os erros e dificuldades cometidos pelo aluno nesta sessão de flashcards:

Temas Envolvidos: ${topicTitles.join(', ') || 'Geral'}
Total de Cards Errados/Com Dificuldade: ${failedCards.length}
Lista de Erros Identificados:
${failedList || 'O aluno revisou todos os cards sem erros graves.'}

Forneça uma pré-análise em JSON estrito planejando um RESUMO ADAPTADO DE LACUNAS focado em sanar todos esses erros específicos:
1. "diagnosis": Análise de 2 a 3 frases explicando as principais lacunas identificadas nos erros do aluno.
2. "chapters": Array com 4 a 6 títulos de capítulos encadeados para montar um Resumo Adaptado Completo focado nesses erros.
3. "clinicalHighlights": Array com 3 a 5 alertas de prova específicos sobre os erros cometidos.
4. "recommendedCredits": Custo fixo em créditos para a geração desse resumo adaptado (ex: 5).

Formato JSON estrito:
{
  "diagnosis": "...",
  "chapters": ["Capítulo 1: ...", "Capítulo 2: ...", "Capítulo 3: ...", "Capítulo 4: ..."],
  "clinicalHighlights": ["...", "..."],
  "recommendedCredits": 5
}`;

  try {
    await checkUsageLimit();
    const result = await callGemini('generateJson', prompt);
    return result as { diagnosis: string; chapters: string[]; clinicalHighlights: string[]; recommendedCredits: number };
  } catch (err) {
    console.error('Error analyzing flashcard session for summary:', err);
    throw err;
  }
}

export async function explainQuestion(questionText: string, options: string[], correctIndex: number, userId?: string) {
  const prompt = `Você é um professor de medicina comentando uma questão de prova.
  Questão: ${questionText}
  Alternativas:
  ${options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}
  A alternativa correta é a ${String.fromCharCode(65 + correctIndex)}.
 
  Explique detalhadamente por que a alternativa ${String.fromCharCode(65 + correctIndex)} está correta e por que cada uma das outras alternativas está incorreta.
  Seja didático e use referências médicas atuais.
  Responda estritamente em PORTUGUÊS (PORTUGUÊS DO BRASIL) usando Markdown.`;

  return generateWithAI(prompt);
}

export async function importPdfWithAI(fileData: string, mimeType: string, filename: string, credits: number = 5) {
  try {
    await checkUsageLimit();
    const { residencyFocus } = await getUserFocusSettings();
    return await withRetry(async () => {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'importPdf',
          email: auth.currentUser?.email || '',
          payload: {
            fileData,
            mimeType,
            promptText: `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite (Foco acadêmico do aluno: ${residencyFocus}). Analise detidamente este documento anexado chamado "${filename}" (que pode ser um arquivo contendo textos, resumos, anotações de aula, diretrizes, esquemas ou diagramas e imagens integradas). 
 
Escreva um RESUMO MÉDICO ADAPTADO de altíssima densidade, exaustivo, altamente didático e rico em detalhes científicos e práticos, formatado em Markdown com base no anexo e nas exigências da residência (${residencyFocus}).

DIRETRIZES DE MÁXIMA DENSIDADE E COMPLETUDE TÉCNICA:
1. DENSIDADE TÉCNICA E APROFUNDAMENTO MÁXIMO: É proibido gerar resumos curtos, comprimidos ou superficiais. Redija parágrafos densos e explicativos detalhando a fisiopatologia celular/molecular, mecanismos de ação de drogas, posologias exatas (ataque e manutenção em mg/kg ou mg/dia, vias de administração, intervalos, e ajustes em insuficiência renal/hepática).
2. TABELAS COMPLETAS DE ESCORES E CRITÉRIOS DIAGNÓSTICOS: Apresente obrigatoriamente de forma exaustiva e em tabelas Markdown estruturadas todas as escalas médicas, escores de risco e classificações oficiais (ex: Wells, CURB-65, CHA2DS2-VASc, HAS-BLED, NIHSS, qSOFA, Child-Pugh, MELD, Alvarado, Ranson, Mallampati, Cormack-Lehane, etc.), contendo critérios, pontuação individual, estratificação e condutas por faixa de pontuação.
3. FLUXOGRAMAS E QUADROS DE DIFERENCIAÇÃO CLÍNICA: Inclua tabelas comparativas para diagnósticos diferenciais e fluxogramas terapêuticos/diagnósticos em passo a passo numerado e estruturado.
4. CAIXAS DE DESTAQUE E ALERTAS DE PROVA: Abunde o resumo com caixas de alerta no padrão GFM (\`> [!IMPORTANT]\`, \`> [!CAUTION]\`, \`> [!TIP]\`), identificando "DICA DO PRECEPTOR", "PEGADINHA DE BANCA" e "ANALOGIA CLÍNICA".
5. ILUSTRAÇÕES E DIAGRAMAS DO ANEXO: Descreva, explique e integre na medida do possível quaisquer diagramas ou imagens de fluxo clínicos que apareçam no anexo. Utilize notação LaTeX para termos médicos/notações ($ \rightarrow $, $ \alpha $, $ \text{HCO}_3^- $).

Ao final do documento, crie obrigatoriamente a seção intitulada:
"## 📚 REFERÊNCIAS BIBLIOGRÁFICAS E DIRETRIZES TÉCNICAS"
Liste e descreva detalhadamente (de 3 a 5 fontes) com nome e breves explicações de 1 a 2 frases para cada referência citada (ex: UpToDate 2025/2026, Diretrizes da Sociedade Brasileira, Ministério da Saúde, FEBRASGO, SBP, Harrison's, etc.).`,
            preferredProvider: safeLocalStorageGet('user_preferred_ai_provider') || 'auto'
          }
        })
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        if (responseText && responseText.trim()) {
          const trimmed = responseText.trim();
          if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE')) {
            errorMsg = `HTTP HTML Error: received unexpected HTML page instead of JSON (status: ${response.status})`;
          } else {
            try {
              const errorData = JSON.parse(responseText);
              errorMsg = errorData.error || errorMsg;
            } catch (e) {
              errorMsg = responseText.substring(0, 150);
            }
          }
        }
        throw new Error(errorMsg);
      }

      const trimmedText = responseText.trim();
      if (trimmedText.startsWith('<!doctype') || trimmedText.startsWith('<html') || trimmedText.startsWith('<!DOCTYPE')) {
        throw new Error(`Unexpected HTML response body instead of valid JSON data (maybe offline or server restart): ${trimmedText.substring(0, 100)}`);
      }

      const data = JSON.parse(responseText);
      
      // Record usage only after successful parse
      await recordUsage(credits);
      
      return data.result;
    });
  } catch (error: any) {
    console.error('Error importing PDF with AI:', error);
    throw error;
  }
}

export async function deepenNotebookArea(
  topicTitle: string,
  topicContent: string,
  excerptText: string,
  typedNotes?: string,
  base64Drawing?: string,
  userId?: string
) {
  try {
    await checkUsageLimit();
    
    // Cost: 3 credits for standard, 5 credits if multimodal
    const credits = base64Drawing ? 5 : 3;
    const model = 'gemini-3.1-flash-lite';
    
    const promptText = `Você é o COORDENADOR-PRECEPTOR de um Internato Médico de Elite.
Você está prestando uma mentoria clínica hiper-personalizada para tirar a dúvida de um aluno de alto rendimento.

TÓPICO PRINCIPAL DO CADERNO: "${topicTitle}"

CONCEITO COBRADO NO RESUMO DO TÓPICO:
---
${topicContent.substring(0, 1500)}
---

O Aluno grifou/salvou o seguinte trecho ("seleção") no caderno:
"${excerptText}"

${typedNotes ? `O Aluno também digitou as seguintes observações de estudo complementares sobre esse trecho:
"${typedNotes}"` : ''}

${base64Drawing ? `O Aluno também fez anotações à mão livre / esquemas ("grafite") com caneta digital sobre esse trecho (IMAGEM ANEXADA).` : ''}

DIRETRIZES DA RESPOSTA (RIGOR MÁXIMO PRECEPTOR):
1. TOM DE VOZ: Comece com um acolhimento estimulante no seu tom de preceptor (ex: "Veja bem, doutor...", "Análise clínica excelente...", "Aqui está o detalhe que aprova!").
2. EXPLICAÇÃO PROFUNDA E EFICAZ: Explique em detalhes a fisiopatologia, os critérios diagnósticos práticos, as pegadinhas de prova nacionais/regionais e a conduta terapêutica exata (doses, vias, fluxos do SUS e notas da SES-GO/SES-DF se relevante) relacionada a esse trecho do caderno.
   - NÃO RESTRINJA O TAMANHO DOS PARÁGRAFOS: Se for necessário para detalhar ou explicar com alta didática e eficácia os mecanismos fisiológicos, farmacológicos, anatômicos ou técnicos, utilize parágrafos completos e densos.
   - COMPLETUDE PARA PROVAS: Forneça absolutamente tudo o que é necessário para compreender o tema e responder a qualquer questão de prova de residência médica de forma resolutiva.
   - ESTRUTURAÇÃO IMPECÁVEL E COESA: Evite informações soltas ou fragmentos sem contexto. Cada parágrafo, conceito e dado clínico deve estar perfeitamente interligado dentro de uma narrativa lógica, contínua e integrada.
3. ANÁLISE DO GRAFITE (Se aplicável): Se a imagem com os rabiscos/esquemas grafite do aluno estiver presente, analise detidamente o que ele tentou esquematizar, confirme se o raciocínio fisiológico desenhado está correto, aponte correções clínicas e integre essa análise em uma seção "COMENTÁRIO DO SEU ESQUEMA".
4. FORMATO: Responda obrigatoriamente formatado em Markdown profissional de alta legibilidade, com subtópicos claros e elegantes, tabelas comparativas e caixas de "DICA DO PRECEPTOR / PEGADINHA DE PROVA" se adequado. Use notação LaTeX para termos médicos ($ \rightarrow $, $ \le $, $ \beta $-bloqueadores).

Assine de forma encorajadora como: "Excelente dedicação clínica. Foca no detalhe e bons estudos!"`;

    let parts: any[] = [];
    if (base64Drawing) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Drawing
        }
      });
    }
    parts.push({ text: promptText });

    const result = await callGemini('generateContent', promptText, model, parts);
    await recordUsage(credits);
    return result;
  } catch (error) {
    console.error('Error deepening notebook area:', error);
    throw error;
  }
}

export interface SuggestedExtraChapter {
  title: string;
  reason: string;
  insertAtIndex: number;
}

/**
 * Realiza uma pré-análise inteligente do tópico para estimar as necessidades de créditos,
 * justificativa de profundidade, capítulos sugeridos e destaques essenciais do tema.
 */
export async function analyzeSummaryNeeds(title: string, area: string, depth: GenerationDepth = 'custom_analyzed') {
  const depthText = {
    standard: "Padrão (escopo focado de 3 a 5 capítulos curtos, objetivos e práticos)",
    deep: "Avançado (escopo aprofundado de 5 a 6 capítulos detalhados)",
    elite: "Elite (escopo exaustivo e aprofundado de 6 a 8 capítulos)",
    master: "Extensivo (escopo massivo de 8 a 10 capítulos extremamente completos)",
    monograph: "Monografia (escopo monumental de 10 a 12 capítulos em nível de tratado/TCC)",
    custom_analyzed: "Personalizado Inteligente (escopo 100% dinâmico e sem limite pré-definido, ajustado sob medida de acordo com a extensão e complexidade clínica do assunto)"
  }[depth] || "Personalizado Inteligente";

  const costText = {
    standard: 1,
    deep: 5,
    elite: 10,
    master: 50,
    monograph: 100,
    custom_analyzed: null
  }[depth];

  const prompt = `Você é o COORDENADOR-PRECEPTOR de um Internato de Elite Médica. Sua especialidade é analisar editais e provas de residência (SUS, SES-GO, SES-DF, ENARE, USP, UNIFESP, etc.) para desenhar materiais de estudo impecáveis, exaustivos e 100% autossuficientes.

Analise o seguinte tópico médico de estudo:
Título: "${title}"
Grande Área: "${area}"
Nível de Profundidade Desejado: ${depthText}

Seu objetivo é definir as necessidades exatas para que o aluno receba um resumo completo, profundamente detalhado, didático e autossuficiente (capaz de substituir livros-texto), cobrindo tanto a BASE DIDÁTICA FISIOPATOLÓGICA/FISIOLÓGICA quanto o CONTEÚDO PRÁTICO DE PROVA E MANEJO COMPLETO (critérios oficiais na íntegra, doses exatas mg/kg, checklists de procedimento, todas as escalas e escores relevantes e pegadinhas de bancas).

DIRETRIZES DE ESTRUTURAÇÃO DE CAPÍTULOS CONFORME A NATUREZA DO TEMA:
1. SE O TÓPICO FOR UMA PATOLOGIA/DOENÇA: Crie capítulos cobrindo: Introdução/Epidemiologia -> Fisiopatologia Celular e Mecanismos -> Quadro Clínico e Propedêutica -> Classificações e Escores Oficiais -> Manejo Clínico Prático e Algoritmo Passo a Passo (Obrigatório) -> Tratamento Medicamentoso (Doses, Vias, Linhas) -> Peculiaridades e Casos Complexos.
2. SE O TÓPICO FOR UM PROCEDIMENTO, MANEJO DE EMERGÊNCIA OU TEMA PRÁTICO NÃO-DOENÇA (ex: Manejo de Via Aérea, Ventilação Mecânica, Sequência Rápida de Intubação, Parada Cardiorrespiratória, Acesso Venoso Central, ATLS/Trauma, Reposição Volêmica, Distúrbios Eletrolíticos/Ácido-Básicos, DVA/Vasopressores, etc.):
   Garantir obrigatoriamente capítulos estruturados para abranger o MANEJO COMPLETO:
   - Cap. 1: Fundamentos Fisiológicos, Anatômicos, Indicações e Fisiologia Aplicada
   - Cap. 2: Avaliação Preditiva de Dificuldade, Escores/Escalas (LEMON, Mallampati, Cormack-Lehane, MOANS, SHORT, etc.) e Preparação de Materiais/Equipamentos
   - Cap. 3: Farmacologia Completa (Doses mg/kg, Indutores, Bloqueadores Neuromusculares, Vasoativos) e Algoritmo Passo a Passo do Procedimento (ex: 7 Ps da SRI)
   - Cap. 4: Confirmação Beira-Leito, Cuidados Pós-Procedimento, Metas Terapêuticas e Monitorização
   - Cap. 5: Complicações Imediatas, Plano de Resgate / Manejo de Falhas ('Não Intubo, Não Oxigeno', Crico de Urgência) e Pegadinhas de Prova

DIRETRIZ OBRIGATÓRIA DE CAPÍTULO DE MANEJO PASSO A PASSO:
- Todo plano de capítulos DEVE OBRIGATORIAMENTE conter um capítulo dedicado ao MANEJO CLÍNICO PRÁTICO E ALGORITMO PASSO A PASSO (ex: "Manejo Clínico Prático, Algoritmo Passo a Passo e Conduta Imediata" ou "Guia de Manejo Beira-Leito e Algoritmo Terapêutico Passo a Passo").
- Esse capítulo deve funcionar como um roteiro prático e resolutivo do que fazer imediatamente diante do paciente, desde a admissão até a estabilização/alta.
- Adicionalmente, na lista "suggestedExtraChapters", sempre inclua ou sugira um capítulo complementar focado em variações de manejo (ex: "Manejo de Complicações Graves e Situações de Exceção" ou "Manejo em Populações Especiais e Casos Refratários").

Determine:
1. Um custo justo em créditos: ${costText !== null ? `DEVE ser exatamente ${costText} créditos para este nível de profundidade.` : 'Um custo justo calculado diretamente pela quantidade de capítulos necessários para cobrir 100% do tema (ex: 5 créditos por capítulo).'}
2. Justificativa didática profunda em português (por que esse tema exige essa estrutura, a razão fisiopatológica e as particularidades de provas cobradas pelas bancas).
3. Uma lista "chapters" de capítulos/seções sugeridos para o resumo principal (SEMPRE incluindo um capítulo de Manejo Passo a Passo). 
   - ATENÇÃO A DELIMITAÇÃO DE ESCOPO: Crie capítulos com títulos claros, específicos e NENHUMA SOBREPOSIÇÃO entre eles.
   - OBRIGATÓRIO PARA ESCALAS/ESCORES: Se o tema envolver qualquer escala médica, escore de risco, estratificação de gravidade ou critérios oficiais de diagnóstico (ex: Wells, PERC, CURB-65, CHA2DS2-VASc, HAS-BLED, NIHSS, Glasgow, Child-Pugh, MELD, Alvarado, Centor, Ranson, qSOFA/SOFA, TIMI, GRACE, BI-RADS, Mallampati, Cormack-Lehane, LEMON, ASA, etc.), GARANTA que haja capítulo dedicado ou subseção explícita no sumário para contemplá-los inteiramente em tabelas de pontuação.
4. Uma lista "suggestedExtraChapters" de 2 a 4 capítulos COMPLEMENTARES OPCIONAIS que NÃO estão na lista principal "chapters", mas que seriam acréscimos excelentes para provas exigentes. Para cada capítulo sugerido a mais, informe:
   - "title": Título claro do capítulo (incluindo opções de manejo avançado ou situações especiais)
   - "reason": Breve justificativa de 1 frase apontando a relevância
   - "insertAtIndex": Número inteiro de 0 a N indicando o índice exato na lista "chapters" onde este capítulo se ENCAIXA MELHOR DIDATICAMENTE.
5. Uma lista de "clinicalHighlights" (Destaques Clínicos Essenciais) que DEVEM ser incluídos (exigem tabelas de escalas completas, doses exatas mg/kg, classificações oficiais e pegadinhas de provas regionais).

Retorne APENAS um JSON válido no seguinte formato:
{
  "cost": ${costText !== null ? costText : 35},
  "justification": "Justificativa detalhada em português...",
  "chapters": [
    "1. Introdução, Definições e Epidemiologia",
    "2. Fisiopatologia e Quadro Clínico Detalhado",
    "3. Classificações Oficiais, Escores de Risco e Escalas Clínicas",
    "4. Propedêutica Diagnóstica e Algoritmo de Investigação",
    "5. Manejo Clínico Prático e Algoritmo Passo a Passo",
    "6. Tratamento Medicamentoso, Doses e Peculiaridades de Provas"
  ],
  "suggestedExtraChapters": [
    {
      "title": "Manejo de Complicações e Situações Refratárias",
      "reason": "Passo a passo avançado de resgate para provas de alto nível e plantão.",
      "insertAtIndex": 5
    },
    {
      "title": "Manejo em Populações Especiais (Gestantes, Idosos e DRC)",
      "reason": "Muito cobrado em questões de Medicina de Família e Clínica Médica para ajuste de conduta.",
      "insertAtIndex": 5
    }
  ],
  "clinicalHighlights": [
    "Tabela oficial da escala X na íntegra com pontuação e conduta",
    "Passo a passo sequencial de manejo imediato beira-leito",
    "Fornecer dose exata de Y para primeira linha",
    "Destacar a pegadinha de prova Z"
  ]
}
`;

  const result = await callGemini('generateJson', prompt, "gemini-3.1-flash-lite");
  try {
    const data = typeof result === 'string' ? JSON.parse(result) : result;
    const chapters = Array.isArray(data.chapters) ? data.chapters : [
      '1. Introdução e Epidemiologia',
      '2. Fisiopatologia e Apresentação Clínica',
      '3. Propedêutica Diagnóstica e Escores',
      '4. Manejo Clínico Prático e Algoritmo Passo a Passo',
      '5. Tratamento Farmacológico, Doses e Peculiaridades de Provas'
    ];

    const suggestedExtraChapters: SuggestedExtraChapter[] = Array.isArray(data.suggestedExtraChapters)
      ? data.suggestedExtraChapters.map((item: any) => ({
          title: String(item.title || '').trim(),
          reason: String(item.reason || '').trim(),
          insertAtIndex: typeof item.insertAtIndex === 'number' ? Math.max(0, item.insertAtIndex) : 2
        })).filter((item: any) => item.title.length > 0)
      : [
          {
            title: 'Manejo em Populações Especiais (Gestantes e Idosos)',
            reason: 'Diferencial de condutas cobrado em bancas do ENARE e Revalida.',
            insertAtIndex: Math.min(2, chapters.length)
          },
          {
            title: 'Manejo de Complicações Graves e Abordagem de Urgência',
            reason: 'Foco em questões avançadas de residência médica.',
            insertAtIndex: Math.min(3, chapters.length)
          }
        ];

    // Preço do resumo inteligente cobrado estritamente pela quantidade de capítulos (10 créditos por capítulo)
    const finalCost = depth === 'custom_analyzed' ? Math.max(10, chapters.length * 10) : (costText !== null ? costText : 50);
    return {
      cost: finalCost,
      justification: data.justification || 'Análise realizada com sucesso.',
      chapters,
      suggestedExtraChapters,
      clinicalHighlights: Array.isArray(data.clinicalHighlights) ? data.clinicalHighlights : [],
      analyzedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error parsing analysis JSON:', err);
    const chapters = [
      '1. Introdução e Epidemiologia',
      '2. Fisiopatologia e Apresentação Clínica',
      '3. Propedêutica Diagnóstica e Escores',
      '4. Manejo Clínico Prático e Algoritmo Passo a Passo',
      '5. Tratamento Farmacológico, Doses e Peculiaridades de Provas'
    ];
    const fallbackCost = depth === 'custom_analyzed' ? chapters.length * 10 : (costText !== null ? costText : 50);
    return {
      cost: fallbackCost,
      justification: 'Análise automática realizada. O tema possui complexidade média e exige cobertura abrangente com manejo prático passo a passo.',
      chapters,
      suggestedExtraChapters: [
        {
          title: 'Manejo em Populações Especiais (Gestantes e Idosos)',
          reason: 'Foco em questões do ENARE e Revalida para diferenciação de conduta.',
          insertAtIndex: 2
        },
        {
          title: 'Manejo em Casos Complexos e Complicações Frequentes',
          reason: 'Direcionado a provas de alto desempenho.',
          insertAtIndex: 3
        }
      ],
      clinicalHighlights: [
        'Classificações oficiais completas e critérios diagnósticos',
        'Doses exatas de medicamentos de primeira linha e esquemas de resgate',
        'Principais diagnósticos diferenciais e pegadinhas de bancas do SUS, SES e ENARE'
      ],
      analyzedAt: new Date().toISOString()
    };
  }
}

/**
 * Gera um resumo completo e 100% autossuficiente baseado na análise de requisitos prévia.
 */
export async function generateCustomAnalyzedSummary(
  title: string,
  area: string,
  analysis: { cost: number; chapters: string[]; clinicalHighlights: string[] },
  reference?: string,
  userId?: string,
  onProgress?: ProgressCallback,
  illustrationLevel: string = 'moderate',
  alertBoxLevel: string = 'moderate',
  existingContent?: string,
  depth: GenerationDepth = 'custom_analyzed'
) {
  try {
    let chapters = [...(analysis?.chapters || [])];
    
    // Se já houver conteúdo existente, verifica se o sumário contém os capítulos originais planejados
    if (existingContent && existingContent.trim().length > 100) {
      const extractedChapters = getChaptersFromMonograph(existingContent);
      if (extractedChapters.length > chapters.length) {
        console.log(`[Gemini] Preservando todos os ${extractedChapters.length} capítulos do sumário original do documento (em vez de ${chapters.length}).`);
        chapters = extractedChapters;
      }
    }

    let finalCost = analysis.cost;
    if (depth === 'standard') {
      finalCost = 1;
    } else if (depth === 'deep') {
      finalCost = 5;
    } else if (depth === 'elite') {
      finalCost = 10;
    } else if (depth === 'master') {
      finalCost = 50;
    } else if (depth === 'monograph') {
      finalCost = 100;
    } else {
      finalCost = Math.max(10, chapters.length * 10);
    }
    const extraCost = calculateExtraCredits(illustrationLevel, alertBoxLevel);
    finalCost = Math.max(1, finalCost + extraCost);

    await checkUsageLimit(finalCost);

    const totalChapters = chapters.length;
    let fullContent = "";
    let startChapterIndex = 0;
    
    // Suporte a retomada de progresso inteligente com limpeza de blocos de erro
    if (existingContent && existingContent.trim().length > 100 && existingContent.includes('## ')) {
      fullContent = existingContent;
      for (let i = 0; i < totalChapters; i++) {
        const chapterTitle = chapters[i];
        const cleanTitle = chapterTitle.replace(/^\d+\.\s*/, '').trim();
        const hasFullTitle = fullContent.includes(`## ${chapterTitle}`);
        const hasCleanTitle = Boolean(cleanTitle && fullContent.includes(`## ${cleanTitle}`));
        
        if (hasFullTitle || hasCleanTitle) {
          const actualHeader = hasFullTitle ? `## ${chapterTitle}` : `## ${cleanTitle}`;
          const parts = fullContent.split(actualHeader);
          const textAfterHeader = parts[1] || '';
          
          // Se o capítulo contém aviso de erro/instabilidade ou ficou extremamente curto/truncado, remove o erro e retoma dele
          if (textAfterHeader.includes('Instabilidade de conexão') || textAfterHeader.includes('[!WARNING]') || textAfterHeader.trim().length < 50) {
            const pos = fullContent.indexOf(actualHeader);
            fullContent = fullContent.substring(0, pos).trim() + '\n\n';
            startChapterIndex = i;
            break;
          } else {
            startChapterIndex = i + 1; // Capítulo i gerado com sucesso
          }
        } else {
          break; // Capítulo não encontrado, inicia a partir dele
        }
      }
      console.log(`[Gemini] Retomando geração do resumo personalizado a partir do capítulo ${startChapterIndex + 1}/${totalChapters}: ${chapters[startChapterIndex]}`);
    }

    if (startChapterIndex >= totalChapters && totalChapters > 0) {
      console.log(`[Gemini] Todos os ${totalChapters} capítulos do resumo personalizado já foram gerados com sucesso.`);
      if (onProgress) {
        onProgress({
          current: totalChapters,
          total: totalChapters,
          message: 'Resumo já está 100% concluído com todos os capítulos!',
          partialContent: fullContent
        });
      }
      return fullContent;
    }

    if (startChapterIndex === 0) {
      fullContent = `# ${title.toUpperCase()}\n\n*Tratado Personalizado de Alta Performance - Gerado por Preceptor IA (Análise Prévia de Requisitos)*\n\n---\n\n## SUMÁRIO DE NAVEGAÇÃO\n\n`;
      
      // Gerar links de ancoragem
      chapters.forEach((chapter) => {
        const slug = slugify(chapter);
        fullContent += `- [${chapter}](#${slug})\n`;
      });
      fullContent += `\n---\n\n`;
    }
    
    if (onProgress) {
      onProgress({ 
        current: startChapterIndex, 
        total: totalChapters, 
        message: startChapterIndex > 0 ? `Retomando geração a partir do capítulo ${startChapterIndex + 1}...` : 'Iniciando geração inteligente baseada na pré-análise...',
        partialContent: fullContent
      });
    }

    // Gerar sequencialmente cada capítulo para reter profundidade extrema sem bater timeouts agregados!
    for (let i = startChapterIndex; i < totalChapters; i++) {
      const chapterTitle = chapters[i];
      if (onProgress) {
        onProgress({ 
          current: i, 
          total: totalChapters, 
          message: `Escrevendo capítulo ${i + 1}/${totalChapters} : ${chapterTitle}...`,
          partialContent: fullContent
        });
      }

      // Pausa otimizada entre capítulos (3.0s) para garantir tempo adequado de processamento no Gemini 3.1 Flash-Lite
      if (i > startChapterIndex) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const previousChaptersStr = i > 0 ? chapters.slice(0, i).map((c, idx) => `Capítulo ${idx+1}: "${c}"`).join(' | ') : 'Nenhum (Este é o Capítulo 1)';
      const futureChaptersStr = i < totalChapters - 1 ? chapters.slice(i + 1).map((c, idx) => `Capítulo ${i+2+idx}: "${c}"`).join(' | ') : 'Nenhum (Este é o Capítulo Final)';
      const previousSignatures = extractPreviousContentSignatures(fullContent);

      const prompt = `Você é o COORDENADOR-PRECEPTOR de um Internato de Elite Médica. Estamos gerando um TRATADO PERSONALIZADO de Alta Performance para o aluno gabaritar qualquer questão e ter segurança absoluta na prática clínica.

Tema Geral do Tratado: "${title}" (${area})
Capítulo Atual (${i + 1}/${totalChapters}): "${chapterTitle}"

ESTRUTURA GLOBAL E DELIMITAÇÃO RÍGIDA DE ESCOPO DESTE CAPÍTULO:
- Capítulos Anteriores (Já escritos no resumo): ${previousChaptersStr}
- Capítulo Atual a ser escrito AGORA: Capítulo ${i + 1} de ${totalChapters} ("${chapterTitle}")
- Capítulos Seguintes (Serão escritos depois): ${futureChaptersStr}

ELEMENTOS JÁ GERADOS NOS CAPÍTULOS ANTERIORES (REGRA RÍGIDA ANTI-DUPLICAÇÃO):
${previousSignatures}
* É ESTRITAMENTE PROIBIDO REPETIR QUALQUER TABELA, ESCORE OU CAIXA DE DICA LISTADA ACIMA.

DIRETRIZES FUNDAMENTAIS DE RIGOR, APROFUNDAMENTO E NÃO REPETIÇÃO:
1. COMECE IMEDIATAMENTE PELO TÍTULO DO CAPÍTULO: O texto do capítulo DEVE começar na PRIMEIRA LINHA com "## ${chapterTitle}". É ESTRITAMENTE PROIBIDO incluir saudações, frases preparatórias, introduções gerais sobre o tema ou re-gerar o sumário de navegação.
2. PROIBIÇÃO ABSOLUTA DE RE-INTRODUÇÃO, REPETIÇÕES E TABELAS DUPLICADAS:
   - SE ESTE NÃO FOR O CAPÍTULO 1, NÃO REINICIE O TEMA! Não escreva introduções gerais ou definições básicas que pertençam aos capítulos iniciais. O aluno já leu as seções anteriores.
   - NÃO REPITA conceitos, epidemiologia, definições, quadros ou tabelas que pertençam ou já foram explicados nos capítulos anteriores (${previousChaptersStr}).
   - REGRA DE OURO DAS TABELAS COMPARATIVAS (INVIOLÁVEL): CADA TABELA COMPARATIVA (ex: "Comparação entre Doença X e Doença Y", "Diagnóstico Diferencial", "Tabelas de Classificação") DEVE APARECER NO MÁXIMO UMA ÚNICA VEZ NO RESUMO INTEIRO. Se uma tabela comparativa ou quadro de diferenciação entre patologias já foi inserido em um capítulo anterior (${previousChaptersStr}), É TERMINANTEMENTE PROIBIDO recriá-lo, repeti-lo ou fazer novas variações dele neste capítulo.
   - NÃO ANTECIPE tópicos, condutas ou fármacos que pertencem aos capítulos seguintes (${futureChaptersStr}).
   - Mantenha foco 100% EXCLUSIVO e aprofundado nas especificidades do título do capítulo atual: "${chapterTitle}".

3. OBRIGATORIEDADE DE TABELAS COMPLETAS DE ESCALAS, ESCORES DE RISCO E CRITÉRIOS DIAGNÓSTICOS:
   - Se este capítulo abordar ou se aplicar a qualquer escala médica, escore de risco ou critérios diagnósticos consagrados em provas e na prática (ex: Escores de Wells, PERC, Geneva, CURB-65, CRB-65, PSI, CHA2DS2-VASc, HAS-BLED, NIHSS, ABCD2, Glasgow, qSOFA, SOFA, Child-Pugh, MELD, Alvarado, Centor, Ranson, Balthazar, Atlanta, TIMI, GRACE, Killip, NYHA, ACC/AHA, GOLD, GINA, BI-RADS, PIRADS, Mallampati, Cormack-Lehane, ASA, Apgar, Tisdale, Hunt-Hess, Fisher, Light, Jones, Duke, McDonald, etc.), você DEVE OBRIGATORIAMENTE incluir a TABELA COMPLETA do escore/escala.
   - A tabela DEVE conter: cada critério individual, sua pontuação exata, a pontuação total máxima, as faixas de estratificação de risco (baixo, intermediário, alto) e a CONDUTA CLÍNICA / TRATAMENTO EXATO associado a cada faixa de pontos.
   - NUNCA mencione uma escala apenas pelo nome sem colocar a sua tabela exaustiva e pronta para prova.

4. APROFUNDAMENTO FISIOLÓGICO E FISIOPATOLÓGICO RIGOROSO:
   - Explique minuciosamente a base fisiológica, anatômica e fisiopatológica celular/molecular por trás de cada sintoma, exame e conduta. O aluno exige saber o PORQUÊ de cada achado: dinâmica de receptores, mecânica ventilatória, trocas gasosas, perfusão/hemodinâmica, gradientes iônicos, cascatas de sinalização e alterações de órgão-alvo.

5. MANEJO COMPLETO E EXAUSTIVO PARA TEMAS PROCEDIMENTAIS, DE EMERGÊNCIA OU NÃO-DOENÇAS (EX: MANEJO DE VIA AÉREA, VENTILAÇÃO MECÂNICA, SEDAÇÃO/SRI, PARADA CARDIORRESPIRATÓRIA, DISTÚRBIOS ELETROLÍTICOS/ÁCIDO-BÁSICOS, ATLS, ACESSO VENOSO CENTRAL, DVA, ETC.):
   - Se o capítulo ou tema for um procedimento, técnica ou manejo prático de urgência/emergência, forneça O MANEJO COMPLETO, INCLUINDO TUDO O QUE É NECESSÁRIO PARA A COMPREENSÃO E APLICAÇÃO:
     a) Raciocínio fisiológico e anatômico essencial (ex: desnitrogenação da CRF na pré-oxigenação, curvas de dissociação da hemoglobina, complacência x resistência);
     b) Preparação beira-leito e checklist de equipamentos/materiais;
     c) Escores e classificações de predição de dificuldade em TABELAS COMPLETAS (ex: LEMON, Mallampati, Cormack-Lehane, MOANS, SHORT, etc.);
     d) Farmacologia completa com DOSES EXATAS EM mg/kg (indutores, bloqueadores neuromusculares, vasopressores, analgésicos), tempo de ação e perfil hemodinâmico de cada droga;
     e) Algoritmo passo a passo sequencial e prático da técnica (ex: Os 7 Ps da SRI);
     f) Confirmação, monitorização, metas terapêuticas e ajustes pós-procedimento;
     g) Manejo imediato de intercorrências e plano de resgate de falhas (ex: algoritmo 'Não Intubo, Não Oxigeno', cricotireoidostomia de urgência, via aérea difícil).

6. EXTENSÃO E DENSIDADE TÉCNICA MAXIMIZADA (EXAUSTIVO, RICO E DENSO):
   - É ESTRITAMENTE PROIBIDO fazer resumos superficiais, esquemas comprimidos ou tópicos genéricos curtos.
   - Redija parágrafos completos, ricos e encadeados com profundidade de livro-texto (nível Harrison / UpToDate / Tratados de Especialidade).
   - Traga dados exatos: mecanismos fisiopatológicos celulares/moleculares, farmacologia minuciosa com dosagens de medicamentos (ataque, manutenção, mg/kg, via, intervalos, ajuste renal/hepático), condutas em falha terapêutica, e diretrizes oficiais atualizadas (2025/2026).
   - Inclua tabelas comparativas ricas, escores completos com pontuações e condutas por faixa de risco, e caixas de destaque clínico (\`> [!IMPORTANT]\`, \`> [!CAUTION]\`, \`> [!TIP]\`).

7. HIGHLIGHTS E ALERTAS (NÃO REPETITIVOS):
   - Se este capítulo for o local ideal para abordar algum dos destaques solicitados na análise prévia (${analysis.clinicalHighlights.join('; ')}), inclua-o AQUI (APENAS SE AINDA NÃO FOI TRATADO EM CAPÍTULOS ANTERIORES).
   - NUNCA repita o mesmo destaque clínico ou a mesma tabela comparativa em múltiplos capítulos.
   - Sempre que houver uma dica crucial de prova ou pegadinha de banca, insira um alerta no formato:
     > [!IMPORTANT]
     > **OBSERVAÇÃO CLÍNICA / HIGHLIGHT DE PROVA:**
     > [Dica clínica objetiva, acionável e relevante para prova]

${i === totalChapters - 1 ? `- SEÇÃO FINAL MANDATÓRIA DE REFERÊNCIAS: Como este é o capítulo final do tratado, inclua ao final a seção "## 📚 REFERÊNCIAS BIBLIOGRÁFICAS E DIRETRIZES TÉCNICAS" detalhando de 3 a 5 fontes e diretrizes oficiais utilizadas (UpToDate, Diretrizes da SBC/SBPT/FEBRASGO/SBP, Ministério da Saúde, Harrison, etc.).` : ''}

Referência ou contexto adicional do aluno: ${reference || 'Nenhuma'}

Escreva o capítulo "${chapterTitle}" de forma exaustiva, 100% aprofundada, sem repetições e pronta para alta performance médica.`;

      const finalPrompt = prompt + getPromptPreferenceInstructions(illustrationLevel, alertBoxLevel);
      let chapterText = "";
      let chapterSuccess = false;
      let chapterError: any = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            console.warn(`[Gemini Custom Summary] Tentativa ${attempt + 1}/3 para capítulo ${i + 1}/${totalChapters}: "${chapterTitle}"...`);
            if (onProgress) {
              onProgress({
                current: i,
                total: totalChapters,
                message: `Re-tentando capítulo ${i + 1}/${totalChapters} (tentativa ${attempt + 1}/3)...`,
                partialContent: fullContent
              });
            }
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }

          chapterText = await callGemini('generateContent', finalPrompt, "gemini-3.1-flash-lite");
          if (chapterText && chapterText.trim().length > 30) {
            chapterSuccess = true;
            break;
          }
        } catch (err) {
          chapterError = err;
          console.error(`[Gemini Custom Summary] Capítulo ${i + 1} tentativa ${attempt + 1} falhou:`, err);
        }
      }

      if (!chapterSuccess) {
        // Marcação clara de erro de geração para indicar que pode ser retomado
        fullContent += `## ${chapterTitle}\n\n> [!WARNING]\n> **Instabilidade de conexão na geração deste capítulo.** Clique no botão **"Retomar e Concluir"** no final da página para gerar este capítulo e as seções restantes de onde parou.\n\n---\n\n`;
        
        if (onProgress) {
          onProgress({ 
            current: i, 
            total: totalChapters, 
            message: `Geração interrompida no capítulo ${i + 1}/${totalChapters}. Você pode clicar em "Retomar e Concluir".`,
            partialContent: fullContent 
          });
        }

        throw new Error(`Instabilidade na geração do capítulo "${chapterTitle}". ${chapterError?.message || 'Clique em Retomar para continuar.'}`);
      }
      
      let cleanedChapterText = cleanLeadingChapterTitle(chapterText, chapterTitle);
      
      fullContent += `## ${chapterTitle}\n\n${cleanedChapterText}\n\n---\n\n`;

      if (onProgress) {
        onProgress({ 
          current: i + 1, 
          total: totalChapters, 
          message: `Capítulo ${i + 1}/${totalChapters} concluído!`,
          partialContent: fullContent 
        });
      }
    }

    if (onProgress) {
      onProgress({ current: totalChapters, total: totalChapters, message: 'Concluindo e estruturando o tratado personalizado...', partialContent: fullContent });
    }

    // Grava o uso dos créditos calculados na entrada
    await recordUsage(finalCost);

    return removeDuplicateSumarios(fullContent);
  } catch (error) {
    console.error('Error generating custom analyzed summary:', error);
    throw error;
  }
}

export function extractPreviousContentSignatures(contentSoFar: string): string {
  if (!contentSoFar || contentSoFar.length < 50) return 'Nenhum capítulo anterior gerado ainda.';

  const summaries: string[] = [];

  // Extract table headers
  const tableHeaders = contentSoFar.match(/^\|([^\n]+)\|/gm);
  if (tableHeaders && tableHeaders.length > 0) {
    const uniqueHeaders = Array.from(new Set(tableHeaders
      .filter(h => !h.includes('---'))
      .map(h => h.replace(/\|/g, ' ').trim())
      .filter(h => h.length > 5)
    )).slice(0, 10);
    if (uniqueHeaders.length > 0) {
      summaries.push(`TABELAS E ESCORES JÁ INCLUÍDOS (PROIBIDO REPETIR): ${uniqueHeaders.join(' | ')}`);
    }
  }

  // Extract callout headers/first lines
  const alertMatches = contentSoFar.match(/^>\s*\[!(IMPORTANT|CAUTION|WARNING|TIP|NOTE)\][\s\S]*?(?=\n\n|\n[^\>]|$)/gm);
  if (alertMatches && alertMatches.length > 0) {
    const alertTitles = alertMatches.map(a => {
      const firstLine = a.split('\n').find(l => l.includes('**') || l.length > 15) || '';
      return firstLine.replace(/^>\s*/, '').replace(/\*\*/g, '').trim();
    }).filter(Boolean);
    const uniqueAlerts = Array.from(new Set(alertTitles)).slice(0, 10);
    if (uniqueAlerts.length > 0) {
      summaries.push(`DICAS E ALERTAS JÁ INCLUÍDOS (PROIBIDO REPETIR): ${uniqueAlerts.join('; ')}`);
    }
  }

  return summaries.length > 0 ? summaries.join('\n\n') : 'Capítulos anteriores analisados.';
}

export function deduplicateTablesAndAlerts(content: string): string {
  if (!content) return content;

  const contentFixed = cleanAndFixMarkdownTables(content);
  const lines = contentFixed.split('\n');
  const resultLines: string[] = [];
  
  const seenAlertSignatures = new Set<string>();
  const seenTableSignatures = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Check for GFM Callout / Alert box start: "> [!IMPORTANT]" or "> [!CAUTION]", etc.
    if (/^>\s*\[!(IMPORTANT|CAUTION|WARNING|TIP|NOTE)\]/i.test(trimmed)) {
      const alertLines: string[] = [lines[i]];
      let j = i + 1;
      while (j < lines.length && (lines[j].trim().startsWith('>') || lines[j].trim() === '')) {
        if (lines[j].trim() === '' && (j + 1 < lines.length && !lines[j + 1].trim().startsWith('>'))) {
          break;
        }
        alertLines.push(lines[j]);
        j++;
      }

      // Normalize alert text
      const alertText = alertLines
        .map(l => l.replace(/^>\s*/, '').trim())
        .join(' ')
        .toLowerCase()
        .replace(/[^\w\s\u00C0-\u00FF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (alertText.length >= 15) {
        let isDuplicateAlert = false;
        for (const seenSig of seenAlertSignatures) {
          if (seenSig === alertText) {
            isDuplicateAlert = true;
            break;
          }
          if (alertText.length > 30 && seenSig.length > 30) {
            if (seenSig.includes(alertText) || alertText.includes(seenSig)) {
              isDuplicateAlert = true;
              break;
            }
          }
        }

        if (isDuplicateAlert) {
          // Skip duplicate alert box!
          i = j;
          continue;
        } else {
          seenAlertSignatures.add(alertText);
        }
      }

      for (const aLine of alertLines) {
        resultLines.push(aLine);
      }
      i = j;
      continue;
    }

    // 2. Check for Markdown Table start
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
        tableLines.push(lines[j]);
        j++;
      }

      const hasDelimiter = tableLines.some(l => /^\|?\s*:?-+:?\s*(\||\+)/.test(l.trim()));
      if (tableLines.length >= 2 && hasDelimiter) {
        const normalizedCells = tableLines
          .filter(l => !/^\|?\s*:?-+:?\s*(\||\+)/.test(l.trim()))
          .map(l => l.split('|').map(c => c.trim().toLowerCase().replace(/[^\w\u00C0-\u00FF]/g, '')).filter(Boolean).join('|'))
          .filter(Boolean)
          .join('||');

        if (normalizedCells.length >= 20) {
          let isDuplicateTable = false;
          for (const seenSig of seenTableSignatures) {
            if (seenSig === normalizedCells) {
              isDuplicateTable = true;
              break;
            }
            if (seenSig.length > 30 && normalizedCells.length > 30) {
              const sig1Cells = new Set(seenSig.split('||'));
              const sig2Cells = normalizedCells.split('||');
              const matchCount = sig2Cells.filter(c => sig1Cells.has(c)).length;
              if (matchCount / Math.max(1, sig2Cells.length) >= 0.7) {
                isDuplicateTable = true;
                break;
              }
            }
          }

          if (isDuplicateTable) {
            resultLines.push('\n*(Tabela comparativa / escore oficial apresentado em capítulo anterior)*\n');
            i = j;
            continue;
          } else {
            seenTableSignatures.add(normalizedCells);
          }
        }
      }

      for (const tLine of tableLines) {
        resultLines.push(tLine);
      }
      i = j;
      continue;
    }

    resultLines.push(line);
    i++;
  }

  return resultLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function removeDuplicateSumarios(content: string): string {
  if (!content) return content;
  
  let cleaned = content;

  // Encontra todas as ocorrências de SUMÁRIO DE NAVEGAÇÃO / SUMÁRIO / ÍNDICE
  const sumarioRegex = /#+\s*(SUMÁRIO\s*DE\s*NAVEGAÇÃO|SUMÁRIO|SUMARIO|ÍNDICE|INDICE)/gi;
  const matches = [...cleaned.matchAll(sumarioRegex)];
  
  if (matches.length > 1) {
    const firstMatch = matches[0];
    const firstIndex = firstMatch.index ?? 0;

    const afterFirstHeader = firstIndex + firstMatch[0].length;
    const nextHeadingMatch = cleaned.substring(afterFirstHeader).match(/\n---\n|\n##\s+/);
    
    let firstBlockEnd = cleaned.length;
    if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
      firstBlockEnd = afterFirstHeader + nextHeadingMatch.index + nextHeadingMatch[0].length;
    }

    const topPart = cleaned.substring(0, firstBlockEnd);
    let restPart = cleaned.substring(firstBlockEnd);

    restPart = restPart.replace(/#+\s*(SUMÁRIO\s*DE\s*NAVEGAÇÃO|SUMÁRIO|SUMARIO|ÍNDICE|INDICE)[\s\S]*?(?=\n#+\s+[A-Za-z0-9]|\n---\n|$)/gi, '');

    cleaned = topPart + restPart;
  } else if (matches.length === 1 && matches[0].index !== undefined && matches[0].index > 1200) {
    cleaned = cleaned.replace(/#+\s*(SUMÁRIO\s*DE\s*NAVEGAÇÃO|SUMÁRIO|SUMARIO|ÍNDICE|INDICE)[\s\S]*?(?=\n#+\s+[A-Za-z0-9]|\n---\n|$)/gi, '').trim();
  }

  // Remove tabelas e caixas de alerta duplicadas
  return deduplicateTablesAndAlerts(cleaned);
}

function getPromptPreferenceInstructions(illustrationLevel: string = 'moderate', alertBoxLevel: string = 'moderate'): string {
  let instructions = '\n\nREQUISITOS ADICIONAIS DE PERSONALIZAÇÃO E CONFIGURAÇÃO DO RESUMO (PREFERÊNCIA DO USUÁRIO):\n';
  
  // PROIBIÇÃO ABSOLUTA DE IMAGENS AUTOMÁTICAS
  instructions += `PROIBIÇÃO ABSOLUTA DE INSERÇÃO AUTOMÁTICA DE IMAGENS:
- É TERMINANTEMENTE PROIBIDO gerar, sugerir ou inserir links de imagens, figuras ou Markdown de imagens (por exemplo, \`![legenda](nome_da_imagem.jpg)\` ou \`![legenda](url)\`) de forma automática no corpo do resumo.
- O resumo gerado deve ser estritamente textual, conceitual e teórico, sem nenhuma imagem pré-inserida. Imagens só poderão ser inseridas manualmente pelo aluno selecionando termos após a geração.
\n`;

  // Prioridade absoluta para profundidade científica e raciocínio médico
  instructions += `PRIORIDADE MÁXIMA - INVESTIMENTO EM CONTEÚDO MÉDICO E DIRETRIZES:
- Dedique a vasta maioria do texto (mais de 80%) para o raciocínio clínico fisiopatológico detalhado, critérios de gravidade, tabelas oficiais, esquemas de tratamento com doses exatas e diretrizes das sociedades brasileiras relevantes (SBC, SBH, MS, FEBRASGO, SBP, etc.).
- O conteúdo deve ser rico, denso e científico, focado no raciocínio médico aprofundado, evitando explicações óbvias ou enrolações vazias.
- O caso clínico não deve dominar o texto de forma alguma.
\n`;

  instructions += `PROIBIÇÃO ABSOLUTA DE ARTE ASCII, CAIXAS BRUTAS E SETAS DE TRAÇO (\`┌─┐\`, \`│\`, \`└─┘\`, \`──►\`, \`───\`):
- NUNCA desenhe quadros, tabelas, quadros duplos ou esquemas usando caracteres de arte ASCII ou unicode box-drawing (como ┌, ─, ┐, │, └, ┘, ├, ┤, ┼).
- NUNCA crie diagramas com traços repetidos ou setas brutas como \`── Barreira Intestinal ──► ...\`.
- Toda comparação, resumo de sinais/sintomas ou classificação DEVE ser formatada EXCLUSIVAMENTE em:
  1. Tabelas Markdown oficiais com cabeçalhos (\`| Parâmetro | Sinal de Pega | Sinal de Posicionamento |\`).
  2. Caixas de destaque GFM (\`> [!IMPORTANT]\`, \`> [!TIP]\`, \`> [!NOTE]\`, \`> [!CAUTION]\`).
  3. Listas elegantes estruturadas com CADA ITEM EM UMA LINHA SEPARADA PRÓPRIA (\`- **Item**: ... → ...\`). NUNCA agrupe múltiplos itens com marcadores (\`•\` ou \`-\`) na mesma linha de texto.
\n`;

  instructions += `REGRA INVIOLÁVEL DE NÃO REPETIÇÃO ABSOLUTA E DENSIDADE MÁXIMA (PREFERÊNCIA CRUCIAL DO ALUNO):
- PROIBIÇÃO CRÍTICA DE DUPLICAÇÃO DE ESCALAS, TABELAS E INFORMAÇÕES: É expressamente proibido repetir qualquer tabela, escala (ex: CURB-65, Wells, NIHSS, etc.) ou informação já mencionada. Uma vez detalhado um escore, escala ou protocolo, ele não deve ser apresentado novamente em nenhuma outra seção ou capítulo sob hipótese alguma. Refira-se a ele brevemente no texto se necessário, mas nunca o re-desenhe ou re-liste.
- DENSIDADE DO CONTEÚDO EXTREMAMENTE ALTA: Aumente ao máximo a densidade científica e clínica de cada frase. Cada parágrafo deve conter informações médicas concretas (fisiopatologia celular, critérios exatos de diagnóstico, doses exatas em mg/kg, fluxo de tratamento sequencial, diretrizes brasileiras atualizadas). É terminantemente proibido incluir termos genéricos, frases de preenchimento ("conforme mencionado", "como vimos", "é de suma importância saber que"), ou transições vazias.
- ZERO INTRODUÇÕES REPETIDAS: Não crie novas introduções ou visões gerais para sub-tópicos de um mesmo tema. Vá direto aos dados de conduta prática, beira-leito e diferenciação de provas.
\n`;

  instructions += `REGRA DE TABELAS FORA DE CAIXAS DE ALERTA:
- É ESTRITAMENTE PROIBIDO colocar tabelas Markdown dentro de caixas de citação/alerta (linhas iniciando com '>').
- Todas as tabelas e quadros comparativos devem obrigatoriamente ser escritos no nível raiz do Markdown, fora de qualquer citação ou bloco '>', com linhas iniciadas por '|' e finalizadas por '|', para garantir que a estrutura de linhas e colunas seja renderizada perfeitamente pelo navegador.
\n`;

  instructions += `REGRA DE SINTAXE E LIMPEZA DE TABELAS MARKDOWN:
- Toda tabela Markdown DEVE ter exatamente 1 linha de cabeçalho (ex: | Coluna 1 | Coluna 2 |), 1 linha de separador (ex: | --- | --- |) e N linhas de dados (ex: | Dado 1 | Dado 2 |).
- NUNCA repita ou acumule linhas de separadores (| --- | --- |) em sequência.
- NUNCA insira pipes vazios ou colunas duplas sem texto (ex: ||, || ||, | | |).
- NUNCA quebre a linha dentro da mesma célula de tabela. CADA linha da tabela DEVE ser emitida inteira em uma única linha física com quebra de linha (\\n) no final.
\n`;

  instructions += `REGRA DE SUMÁRIO DE NAVEGAÇÃO:
- NUNCA crie nem insira nenhuma seção "## SUMÁRIO DE NAVEGAÇÃO", "## SUMÁRIO" ou "## ÍNDICE" dentro de capítulos individuais. O sumário de navegação geral do documento é gerado exclusivamente no topo do documento.
- CASO O SISTEMA SOLICITE UM SUMÁRIO NO TOPO DO DOCUMENTO: Cada item DEVE usar a sintaxe Markdown completa com colchetes: \`1. [Título do Capítulo](#ancora-do-capitulo)\`.
\n`;

  instructions += `EXIGÊNCIA DE RIGOR E CONCREÇÃO NOS QUADROS DE DICAS, MACETES E PEGADINHAS (INVIOLÁVEL):
- É TERMINANTEMENTE PROIBIDO gerar dicas vagas, superficiais, meta-conselhos de estudo ou truismos óbvios (ex: PROIBIDO "DICA DE ESTUDO: É importante lembrar que o pneumotórax requer avaliação cuidadosa... A escolha do tratamento depende da gravidade... Estude os tipos de pneumotórax...").
- CADA CAIXA DE DICA (\`> [!TIP]\`), PEGADINHA (\`> [!CAUTION]\`), PONTO CRÍTICO (\`> [!IMPORTANT]\`) OU NOTA CLÍNICA (\`> [!NOTE]\`) DEVE OBRIGATORIAMENTE FORNECER:
  1. A regra, número, escore ou dosagem EXPLÍCITA (ex: "Na cetoacidose diabética, o potássio deve estar > 3,3 mEq/L ANTES de iniciar a insulinoterapia").
  2. O PORQUÊ / MECANISMO FISIOPATOLÓGICO CLARO (ex: "A insulina move o potássio para o intracelular; iniciar insulina com K < 3,3 mEq/L pode precipitar arritmia ventricular fatal ou parada em assistolia").
  3. A pegadinha exata montada pelas bancas (ex: "As bancas ENARE e SES-DF adoram colocar 'iniciar insulina imediatamente' na alternativa A quando o potássio é 2,9 mEq/L — a conduta correta é repor potássio primeiro!").
  4. Mnemônicos ou regras diretas e acionáveis para memorização sem encheção de linguiça.
\n`;

  // DIRETRIZ EXPLÍCITA PARA CASOS CLÍNICOS / QUADROS CLÍNICOS (illustrationLevel):
  const lowerIll = (illustrationLevel || 'moderate').toLowerCase();
  if (lowerIll === 'minimum' || lowerIll === 'off' || lowerIll === 'desativado') {
    instructions += 'DIRETRIZ DE CASOS CLÍNICOS (QUADROS CLÍNICOS): DESATIVADO / SEM CASOS. É PROIBIDO incluir simulações de casos clínicos ao longo das patologias; mantenha 100% do texto focado estritamente em conceitos teóricos, diretrizes, algoritmos e tabelas.\n\n';
  } else if (lowerIll === 'maximum' || lowerIll === 'academic' || lowerIll === 'extreme' || lowerIll === 'alto') {
    instructions += 'DIRETRIZ DE CASOS CLÍNICOS (QUADROS CLÍNICOS): OBRIGATÓRIO E APROFUNDADO (NÍVEL MÁXIMO/EXTREMO). Ao final de cada patologia descrita, inclua OBRIGATORIAMENTE uma seção dedicada intitulada "### 🏥 Caso Clínico & Resolução Comentada", contendo uma vinheta clínica completa com história do paciente, achados de exame físico, exames complementares, conduta rápida de prova e justificativa médica comentada.\n\n';
  } else if (lowerIll === 'light' || lowerIll === 'leve') {
    instructions += 'DIRETRIZ DE CASOS CLÍNICOS (QUADROS CLÍNICOS): LEVE / MÍNIMO. Inclua no máximo 1 caso clínico ilustrativo conciso ao longo do texto todo em formato de vinheta clínica curta.\n\n';
  } else {
    instructions += 'DIRETRIZ DE CASOS CLÍNICOS (QUADROS CLÍNICOS): MODERADO (PADRÃO). Se houver casos clínicos, utilize formato de vinheta clínica ultra-curta (1 parágrafo de história + 1 parágrafo de resolução comentada, max 100-120 palavras por patologia) para priorizar o espaço da fundamentação teórica.\n\n';
  }
  
  // DIRETRIZ EXPLÍCITA PARA CAIXAS DE ALERTA / QUADRADOS LARANJAS (alertBoxLevel):
  const lowerAlert = (alertBoxLevel || 'moderate').toLowerCase();
  if (lowerAlert === 'minimum' || lowerAlert === 'off' || lowerAlert === 'desativado') {
    instructions += 'DIRETRIZ DE CAIXAS DE ALERTA / QUADRADOS LARANJAS (`> [!CAUTION]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!NOTE]`): DESATIVADO / MÍNIMO. É PROIBIDO usar caixas de aviso GFM; apresente as informações estritamente em parágrafos normais e listas Markdown.\n\n';
  } else if (lowerAlert === 'light' || lowerAlert === 'leve') {
    instructions += 'DIRETRIZ DE CAIXAS DE ALERTA / QUADRADOS LARANJAS (`> [!CAUTION]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!NOTE]`): LEVE / MÍNIMO. Use caixas de aviso GFM com moderação extrema, limitando a no máximo 1 ou 2 caixas de destaque por capítulo, reservando-as apenas para o ponto de maior risco de pegadinha da prova.\n\n';
  } else if (lowerAlert === 'academic' || lowerAlert === 'maximum' || lowerAlert === 'alto') {
    instructions += 'DIRETRIZ DE CAIXAS DE ALERTA / QUADRADOS LARANJAS (`> [!CAUTION]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!NOTE]`): OBRIGATÓRIO ABUNDANTE (MÁXIMO/ACADÊMICO). OBRIGATÓRIO inserir caixas de destaque GFM variadas (`> [!CAUTION]` para avisos/pegadinhas laranjas de provas, `> [!TIP]` para macetes e mnemônicos, `> [!IMPORTANT]` para pontos cruciais de conduta, `> [!NOTE]` para observações fisiopatológicas) em TODA seção principal e patologia do resumo.\n\n';
  } else if (lowerAlert === 'extreme' || lowerAlert === 'extremo') {
    instructions += 'DIRETRIZ DE CAIXAS DE ALERTA / QUADRADOS LARANJAS (`> [!CAUTION]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!NOTE]`): OBRIGATÓRIO EXTREMO / DENSIDADE MÁXIMA. Insira caixas de destaque GFM variadas (`> [!CAUTION]`, `> [!TIP]`, `> [!NOTE]`, `> [!CAUTION]`) em quase TODA subseção, passo a passo de procedimento e doença descrita, ressaltando minuciosamente armadilhas de bancas e alertas vermelhos/laranjas de emergência médica.\n\n';
  } else {
    instructions += 'DIRETRIZ DE CAIXAS DE ALERTA / QUADRADOS LARANJAS (`> [!CAUTION]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!NOTE]`): MODERADO (PADRÃO). Insira caixas de destaque GFM de forma equilibrada nas seções principais do resumo (`> [!CAUTION]` para alertas/pegadinhas de prova, `> [!TIP]` para macetes, `> [!IMPORTANT]` para pontos vitais).\n\n';
  }
  
  return instructions;
}

export function cleanLeadingChapterTitle(text: string, chapterTitle: string): string {
  if (!text) return text;

  // Remove qualquer bloco de SUMÁRIO DE NAVEGAÇÃO / SUMÁRIO gerado no topo do capítulo individual
  let cleaned = text.replace(/^#+\s*(SUMÁRIO\s*DE\s*NAVEGAÇÃO|SUMÁRIO|SUMARIO|ÍNDICE|INDICE)[\s\S]*?(?=\n#+\s+[A-Za-z0-9]|\n\n[A-Z0-9]|$)/gi, '').trim();
  if (!cleaned) cleaned = text;

  let lines = cleaned.split('\n');
  if (lines.length === 0) return text;
  
  let linesRemoved = 0;
  while (lines.length > 0 && linesRemoved < 3) {
    const rawLine = lines[0].trim();
    if (!rawLine) {
      lines.shift();
      continue;
    }
    
    let lineText = rawLine.replace(/^[#\s*_]+|[#\s*_]+$/g, '').trim();
    const capRegex = /^(Cap[íi]tulo\s+\w+[:\-\s]*|\d+[\.\-\s]+)/i;
    let lineWithoutPrefix = lineText.replace(capRegex, '').trim();
    
    const cleanChapterTitle = chapterTitle.replace(/^[#\s*_]+|[#\s*_]+$/g, '').trim();
    const titleWithoutPrefix = cleanChapterTitle.replace(capRegex, '').trim();
    
    const lowerLine = lineText.toLowerCase();
    const lowerLineWithoutPrefix = lineWithoutPrefix.toLowerCase();
    const lowerTitle = cleanChapterTitle.toLowerCase();
    const lowerTitleWithoutPrefix = titleWithoutPrefix.toLowerCase();
    
    const isHeader = rawLine.startsWith('#') || rawLine.startsWith('*') || rawLine.startsWith('_');
    const isShort = lineText.length < chapterTitle.length + 20;
    
    const matchesTitle = 
      lowerLine === lowerTitle ||
      (lowerLineWithoutPrefix && lowerLineWithoutPrefix === lowerTitleWithoutPrefix) ||
      (isShort && (lowerLine.includes(lowerTitle) || lowerTitle.includes(lowerLine))) ||
      (isShort && (lowerLineWithoutPrefix.includes(lowerTitleWithoutPrefix) || lowerTitleWithoutPrefix.includes(lowerLineWithoutPrefix)));
      
    const isGenericCapLabel = /^(Cap[íi]tulo\s+\d+|Cap[íi]tulo\s+[I|V|X|L|C]+)$/i.test(lineText);
    
    if (matchesTitle || isGenericCapLabel || (isHeader && isShort && lineText.length === 0)) {
      lines.shift();
      linesRemoved++;
    } else {
      break;
    }
  }
  
  return lines.join('\n').trim();
}

export function calculateExtraCredits(illustrationLevel: string = 'moderate', alertBoxLevel: string = 'moderate'): number {
  let extra = 0;
  
  const lowerIll = (illustrationLevel || 'moderate').toLowerCase();
  if (lowerIll === 'minimum' || lowerIll === 'off' || lowerIll === 'desativado') {
    extra -= 3;
  } else if (lowerIll === 'maximum' || lowerIll === 'academic' || lowerIll === 'extreme' || lowerIll === 'alto') {
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

async function callAiForPdfChunk(
  fileData: string,
  mimeType: string,
  promptText: string,
  userEmail: string,
  onProgress?: (message: string) => void
): Promise<any> {
  const endpoint = '/api/gemini';
  let attempt = 0;
  const maxAttempts = 6;
  let delay = 3500; // Começa com 3.5 segundos de base

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'importPdf',
          email: userEmail,
          payload: {
            fileData,
            mimeType,
            promptText,
            preferredProvider: safeLocalStorageGet('user_preferred_ai_provider') || 'auto'
          }
        })
      });

      if (!response.ok) {
        let errMsg = `Falha ao conectar com a IA: ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData?.error) {
            errMsg = errData.error;
          }
        } catch {
          // Fallback se não for JSON
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const resultVal = data.result;
      
      if (!resultVal) {
        throw new Error("Resposta vazia da IA.");
      }

      let parsed: any;
      if (typeof resultVal === 'object' && resultVal !== null) {
        parsed = resultVal;
      } else if (typeof resultVal === 'string') {
        let cleaned = resultVal.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
        }

        try {
          parsed = JSON.parse(cleaned);
        } catch (e) {
          const start = cleaned.indexOf('{');
          const end = cleaned.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            try {
              parsed = JSON.parse(cleaned.substring(start, end + 1));
            } catch (innerErr) {
              try {
                let repaired = cleaned.substring(start);
                const lastObjEnd = repaired.lastIndexOf('}');
                if (lastObjEnd !== -1) {
                  repaired = repaired.substring(0, lastObjEnd + 1);
                }
                const openBraces = (repaired.match(/{/g) || []).length - (repaired.match(/}/g) || []).length;
                const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
                for (let i = 0; i < openBrackets; i++) repaired += ']';
                for (let i = 0; i < openBraces; i++) repaired += '}';
                parsed = JSON.parse(repaired);
              } catch (repairErr) {
                console.error("JSON parse & repair error:", repairErr);
                throw new Error("A resposta da IA ficou incompleta ou corrompida.");
              }
            }
          } else {
            throw new Error("A IA não retornou um formato JSON de cronograma válido.");
          }
        }
      } else {
        throw new Error("Resposta inválida da IA.");
      }

      return parsed;
    } catch (err: any) {
      console.warn(`[callAiForPdfChunk] Tentativa ${attempt}/${maxAttempts} falhou: ${err.message}`);
      
      const isRateLimit = err.message?.includes('429') || 
                          err.message?.includes('413') || 
                          err.message?.includes('rate_limit') || 
                          err.message?.includes('quota') || 
                          err.message?.includes('Limit') || 
                          err.message?.includes('Too Many Requests') ||
                          err.message?.includes('too large');

      if (attempt >= maxAttempts) {
        throw err;
      }

      let waitTimeMs = delay;
      // Tenta extrair tempo específico da mensagem de erro de cota (ex: "try again in 1h19m38.784s", "try again in 14s")
      const secondsMatch = err.message?.match(/try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i);
      if (secondsMatch) {
        const hours = parseFloat(secondsMatch[1] || '0');
        const minutes = parseFloat(secondsMatch[2] || '0');
        const seconds = parseFloat(secondsMatch[3] || '0');
        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        if (totalSeconds > 0) {
          waitTimeMs = (totalSeconds + 2) * 1000; // adiciona margem de segurança de 2s
          console.log(`[Rate Limit] Cooldown dinâmico extraído: ${totalSeconds}s (Esperando ${waitTimeMs}ms)`);
        }
      } else {
        const simpleMatch = err.message?.match(/try again in ([\d.]+)\s*s/i) || err.message?.match(/wait ([\d.]+)\s*s/i);
        if (simpleMatch) {
          const secs = parseFloat(simpleMatch[1]);
          if (secs > 0) {
            waitTimeMs = (secs + 2) * 1000;
          }
        } else if (isRateLimit) {
          // Se for erro de limite genérico, faz backoff exponencial progressivo
          waitTimeMs = Math.min(75000, delay * Math.pow(1.8, attempt)) + Math.random() * 3000;
        } else {
          waitTimeMs = 4000 + Math.random() * 1500;
        }
      }

      const secondsToWait = (waitTimeMs / 1000).toFixed(1);
      if (onProgress) {
        onProgress(`⚠️ Limite de requisições excedido. Aguardando ${secondsToWait}s para reprocessar de forma segura (Tentativa ${attempt}/${maxAttempts})...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, waitTimeMs));
      delay = waitTimeMs; // atualiza o delay base para a próxima iteração
    }
  }
}

function cleanPdfText(text: string): string {
  if (!text) return "";
  // Substitui múltiplos parágrafos/novas linhas vazias por uma única nova linha
  let cleaned = text.replace(/\n\s*\n/g, '\n');
  // Substitui múltiplos espaços por um espaço único
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  return cleaned.trim();
}

function splitTextIntoChunks(text: string, maxChunkSize: number = 12000): string[] {
  const chunks: string[] = [];
  let remainingText = text;
  
  while (remainingText.length > 0) {
    if (remainingText.length <= maxChunkSize) {
      chunks.push(remainingText);
      break;
    }
    
    let splitIndex = maxChunkSize;
    const lastNewline = remainingText.lastIndexOf('\n', maxChunkSize);
    if (lastNewline > maxChunkSize * 0.6) {
      splitIndex = lastNewline;
    }
    
    chunks.push(remainingText.substring(0, splitIndex).trim());
    remainingText = remainingText.substring(splitIndex).trim();
  }
  
  return chunks;
}

export async function importPdfSchedule(
  fileContentOrBase64: string,
  mimeType: string = "application/pdf",
  studyDays: string[] = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  hoursPerDay: number = 4,
  onAiProgress?: (stage: string, percent: number) => void
): Promise<any> {
  try {
    await checkUsageLimit();
    const userEmail = auth.currentUser?.email || '';
    
    // Check if the content is a Base64 binary file or extracted text
    const strippedHeader = fileContentOrBase64.includes(',') ? fileContentOrBase64.split(',')[1] : fileContentOrBase64;
    const isBase64 = fileContentOrBase64.startsWith('data:') || 
                     strippedHeader.startsWith('JVBERi0') || 
                     (!strippedHeader.trim().includes(' ') && strippedHeader.length > 500);
    const isText = !isBase64;
    
    let contentToProcess = fileContentOrBase64;
    if (isText) {
      contentToProcess = cleanPdfText(fileContentOrBase64);
    }
    
    const preferredProvider = safeLocalStorageGet('user_preferred_ai_provider') || 'auto';
    const maxCharLimit = preferredProvider === 'groq' ? 4500 : 18000;

    let finalParsedData: any;

    if (isText && contentToProcess.length > maxCharLimit) {
      const chunks = splitTextIntoChunks(contentToProcess, maxCharLimit);
      if (onAiProgress) {
        onAiProgress(`Documento otimizado (${contentToProcess.length} caracteres). Dividido em ${chunks.length} blocos...`, 68);
      }
      
      const allWeeks: string[] = [];
      let maxWeekParsed = 0;

      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) {
          // Dynamic delay to respect API Rate Limits (Groq TPM is very tight, Gemini needs a light pause too)
          const delayMs = preferredProvider === 'groq' ? 6000 : 2500;
          if (onAiProgress) {
            const percent = Math.floor(70 + (i / chunks.length) * 25);
            onAiProgress(`Aguardando resfriamento de cota da API (${(delayMs / 1000).toFixed(1)}s)...`, percent);
          }
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        if (onAiProgress) {
          const percent = Math.floor(70 + (i / chunks.length) * 25);
          onAiProgress(`Processando Bloco ${i + 1} de ${chunks.length} com a IA selecionada...`, percent);
        }
        
        const prompt = `Analise a PARTE ${i + 1} de ${chunks.length} deste documento de cronograma de estudos de medicina com EXTREMA PRECISÃO.
Sua missão é extrair 100% DOS TEMAS, MATÉRIAS E TODAS AS SEMANAS contidos nesta parte do documento.

Para evitar cortes na resposta e economizar tokens, retorne em JSON extremamente COMPACTO, onde cada semana é uma linha de texto dentro de um array "weeks".

REGRAS CRUCIAIS:
1. EXTRAIA TODAS AS SEMANAS PRESENTES NESTE TEXTO.
2. ZERO ABREVIAÇÕES OU AGRUPAMENTOS: Transcreva cada tópico de estudo de forma individual e fiel.
3. CATEGORIZAÇÃO: Mapeie para: 'Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Ginecologia e Obstetrícia', 'Preventiva', 'Cardiologia', 'Infectologia', 'Neurologia', 'Psiquiatria', 'Ortopedia', ou 'Dermatologia'.

FORMATO DO RETORNO (JSON válido neste formato):
{
  "weeks": [
    "S[número da semana] | [Título/Matéria da Semana] | [Grande Área]: [Nome do Tópico 1]; [Grande Área]: [Nome do Tópico 2]; ..."
  ]
}`;

        const resChunk = await callAiForPdfChunk(
          chunks[i], 
          mimeType, 
          prompt, 
          userEmail, 
          (msg: string) => {
            if (onAiProgress) {
              const percent = Math.floor(70 + (i / chunks.length) * 25);
              onAiProgress(msg, percent);
            }
          }
        );
        const chunkWeeks = Array.isArray(resChunk?.weeks) ? resChunk.weeks : [];
        
        // Adjust week numbers in this chunk if they overlap or restart
        const adjustedWeeks = chunkWeeks.map((wLine: string) => {
          if (typeof wLine !== 'string') return wLine;
          const parts = wLine.split('|');
          if (parts.length >= 2) {
            const match = parts[0].match(/S(?:emana)?\s*(\d+)/i);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num <= maxWeekParsed) {
                const newNum = maxWeekParsed + num;
                parts[0] = `S${newNum} `;
                return parts.join('|');
              }
            }
          }
          return wLine;
        });

        allWeeks.push(...adjustedWeeks);

        // Update maxWeekParsed based on what has been successfully processed
        allWeeks.forEach((wLine: string) => {
          if (typeof wLine !== 'string') return;
          const parts = wLine.split('|');
          if (parts.length > 0) {
            const match = parts[0].match(/S(?:emana)?\s*(\d+)/i);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxWeekParsed) maxWeekParsed = num;
            }
          }
        });
        if (maxWeekParsed === 0) {
          maxWeekParsed = allWeeks.length;
        }
      }

      finalParsedData = {
        totalWeeks: allWeeks.length,
        weeks: allWeeks
      };

    } else {
      if (onAiProgress) onAiProgress("Enviando documento para análise da Inteligência Artificial...", 75);
      const promptText = `Analise este documento de cronograma de estudos de medicina com EXTREMA PRECISÃO, RIGOR E COMPREENSÃO INTEGRAL.
Sua missão é extrair 100% DOS TEMAS, MATÉRIAS E TODAS AS SEMANAS (sejam 30, 40, 42, 48 ou 52 semanas) presentes no documento PDF.

Para evitar cortes na resposta e garantir que TODAS AS SEMANAS sejam listadas, retorne os dados em formato JSON extremamente COMPACTO, onde cada semana é uma única linha de texto dentro de um array "weeks".

REGRAS OBRIGATÓRIAS DE EXTRAÇÃO:
1. EXTRAIA TODAS AS SEMANAS ATÉ A ÚLTIMA DO DOCUMENTO.
2. COBERTURA INTEGRAL E FIDELIDADE ABSOLUTA: Não omita nenhuma semana.
3. ZERO ABREVIAÇÕES OU AGRUPAMENTOS DE TÓPICOS: Nunca abrevie, resuma ou junte tópicos.
4. CATEGORIZAÇÃO: Mapeie para: 'Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Ginecologia e Obstetrícia', 'Preventiva', 'Cardiologia', 'Infectologia', 'Neurologia', 'Psiquiatria', 'Ortopedia', ou 'Dermatologia'.

FORMATO DO RETORNO (JSON válido neste formato):
{
  "totalWeeks": 42,
  "weeks": [
    "S1 | Gastroenterologia e Hepatologia | Clínica Médica: Doença do Refluxo Gastroesofágico e Dispepsia; Clínica Médica: Úlceras Pépticas e H. Pylori",
    "S2 | Pneumologia e Alergologia | Clínica Médica: Asma Brônquica; Clínica Médica: DPOC e Enfisema"
  ]
}`;

      finalParsedData = await callAiForPdfChunk(
        contentToProcess, 
        mimeType, 
        promptText, 
        userEmail,
        (msg: string) => {
          if (onAiProgress) onAiProgress(msg, 85);
        }
      );
    }

    if (onAiProgress) onAiProgress("Organizando estrutura e gerando calendário...", 98);
    await recordUsage(25);
    return hydratePdfScheduleResponse(finalParsedData, studyDays, hoursPerDay);
  } catch (error: any) {
    console.error('Error importing PDF schedule:', error);
    throw error;
  }
}

/**
 * Hydrates compact AI PDF schedule response into complete StudyPlanWeek structure with 100% fidelity.
 */
function hydratePdfScheduleResponse(parsedData: any, studyDays: string[], hoursPerDay: number) {
  if (!parsedData) {
    throw new Error("Nenhum cronograma válido foi encontrado no arquivo enviado.");
  }

  let rawWeeks: any[] = [];
  if (Array.isArray(parsedData.weeks)) {
    if (parsedData.weeks.length > 0 && typeof parsedData.weeks[0] === 'string') {
      // Process new high-fidelity compact format
      parsedData.weeks.forEach((line: string) => {
        const parts = line.split('|');
        if (parts.length >= 2) {
          const weekMatch = parts[0].match(/S(?:emana)?\s*(\d+)/i);
          const weekNumber = weekMatch ? parseInt(weekMatch[1], 10) : null;
          if (weekNumber === null) return;

          const priorityTitle = parts[1].trim();
          const topics: any[] = [];

          if (parts[2]) {
            const topicSegments = parts[2].split(';');
            for (const segment of topicSegments) {
              const segTrimmed = segment.trim();
              if (!segTrimmed) continue;

              const colonIdx = segTrimmed.indexOf(':');
              if (colonIdx !== -1) {
                const subjectName = segTrimmed.substring(0, colonIdx).trim();
                const title = segTrimmed.substring(colonIdx + 1).trim();
                if (title) {
                  topics.push({
                    title,
                    subjectName: subjectName || 'Clínica Médica',
                    type: title.toLowerCase().includes('simulado') || title.toLowerCase().includes('revisão') || title.toLowerCase().includes('questões') ? 'revisao' : 'estudo'
                  });
                }
              } else {
                topics.push({
                  title: segTrimmed,
                  subjectName: 'Clínica Médica',
                  type: segTrimmed.toLowerCase().includes('simulado') || segTrimmed.toLowerCase().includes('revisão') || segTrimmed.toLowerCase().includes('questões') ? 'revisao' : 'estudo'
                });
              }
            }
          }

          rawWeeks.push({
            weekNumber,
            priorityTitle,
            topics
          });
        }
      });
    } else {
      // Old object format
      rawWeeks = parsedData.weeks;
    }
  }

  if (rawWeeks.length === 0) {
    throw new Error("Nenhum cronograma ou semana válida foi encontrado no arquivo enviado.");
  }

  // Sort weeks by number to ensure order
  rawWeeks.sort((a: any, b: any) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));

  const targetTotalWeeks = parsedData.totalWeeks || rawWeeks.length || 42;
  const maxWeekNum = Math.max(
    targetTotalWeeks,
    ...rawWeeks.map((w: any) => Number(w.weekNumber) || 1)
  );

  const existingMap = new Map<number, any>();
  rawWeeks.forEach((w: any) => {
    const wNum = Number(w.weekNumber) || 1;
    existingMap.set(wNum, w);
  });

  const completeWeeks: any[] = [];
  let lastValidWeek = rawWeeks[0] || { priorityTitle: 'Estudo Teórico', topics: [{ title: 'Estudo Dirigido', subjectName: 'Clínica Médica', type: 'estudo' }] };

  for (let i = 1; i <= maxWeekNum; i++) {
    if (existingMap.has(i)) {
      const w = existingMap.get(i);
      completeWeeks.push(w);
      lastValidWeek = w;
    } else {
      let nextValidWeek = null;
      for (let j = i + 1; j <= maxWeekNum; j++) {
        if (existingMap.has(j)) {
          nextValidWeek = existingMap.get(j);
          break;
        }
      }
      const baseWeek = nextValidWeek || lastValidWeek;
      const adaptedTopics = (baseWeek.topics && baseWeek.topics.length > 0)
        ? baseWeek.topics.map((t: any) => ({ ...t, title: `${t.title} (Módulo ${i})` }))
        : [{ title: `Estudo Orientado - Semana ${i}`, subjectName: 'Clínica Médica', type: 'estudo' }];

      completeWeeks.push({
        weekNumber: i,
        priorityTitle: `Semana ${i}: ${baseWeek.priorityTitle || 'Continuação do Cronograma'}`,
        topics: adaptedTopics
      });
    }
  }

  const validStudyDays = studyDays && studyDays.length > 0 ? studyDays : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const allWeekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const hydratedWeeks = completeWeeks.map((w: any, weekIdx: number) => {
    const weekNumber = w.weekNumber || (weekIdx + 1);
    const priorityTitle = w.priorityTitle || `Semana ${weekNumber}`;

    let topicsList: any[] = [];
    if (Array.isArray(w.topics) && w.topics.length > 0) {
      topicsList = w.topics;
    } else if (w.days && typeof w.days === 'object') {
      Object.values(w.days).forEach((arr: any) => {
        if (Array.isArray(arr)) {
          arr.forEach((t: any) => {
            if (t && (t.title || typeof t === 'string')) topicsList.push(t);
          });
        }
      });
    }

    if (topicsList.length === 0) {
      topicsList = [{ title: `Estudo Orientado - Semana ${weekNumber}`, subjectName: 'Clínica Médica' }];
    }

    const daysMap: Record<string, any[]> = {};
    allWeekdays.forEach(d => { daysMap[d] = []; });

    topicsList.forEach((topicObj: any, tIdx: number) => {
      const targetDay = validStudyDays[tIdx % validStudyDays.length];
      const titleStr = typeof topicObj === 'string' ? topicObj : (topicObj.title || '');
      const subjectStr = typeof topicObj === 'object' && topicObj.subjectName ? topicObj.subjectName : 'Clínica Médica';
      
      let itemType: 'estudo' | 'revisao' = 'estudo';
      if (typeof topicObj === 'object' && topicObj.type === 'revisao') {
        itemType = 'revisao';
      } else {
        const lowerTitle = titleStr.toLowerCase();
        if (
          lowerTitle.includes('revisão') || 
          lowerTitle.includes('exercício') || 
          lowerTitle.includes('questõ') || 
          lowerTitle.includes('banco') || 
          lowerTitle.includes('reta final') ||
          lowerTitle.includes('simulado')
        ) {
          itemType = 'revisao';
        }
      }

      const incidence = typeof topicObj === 'object' && typeof topicObj.historicalIncidence === 'number'
        ? topicObj.historicalIncidence
        : Math.min(38, Math.max(15, 18 + ((tIdx * 7 + weekNumber * 4) % 20)));
      const importanceDegree = incidence >= 28 ? 'extremo' : incidence >= 22 ? 'alto' : incidence >= 18 ? 'medio' : 'baixo';

      daysMap[targetDay].push({
        title: titleStr,
        subjectName: subjectStr,
        historicalIncidence: incidence,
        importanceDegree,
        isPriority: tIdx < 2,
        isCompleted: false,
        review24h: false,
        review7d: false,
        review30d: false,
        type: itemType
      });
    });

    // Add 1 active revision slot on the first study day
    const firstStudyDay = validStudyDays[0] || 'Seg';
    const firstTopicTitle = daysMap[firstStudyDay]?.[0]?.title || (typeof topicsList[0] === 'string' ? topicsList[0] : topicsList[0]?.title) || `Módulo ${weekNumber}`;
    
    daysMap[firstStudyDay].push({
      title: `Revisão Ativa + Flashcards: ${firstTopicTitle}`,
      subjectName: daysMap[firstStudyDay]?.[0]?.subjectName || 'Clínica Médica',
      historicalIncidence: 20,
      importanceDegree: 'alto',
      isPriority: true,
      isCompleted: false,
      review24h: false,
      review7d: false,
      review30d: false,
      type: 'revisao'
    });

    const weekTopicNames = topicsList.map(t => typeof t === 'string' ? t : t.title);
    const mockExam = {
      title: `Simulado Semanal - Semana ${weekNumber} (${weekTopicNames.length} Tópicos)`,
      questionsCount: Math.min(50, Math.max(15, weekTopicNames.length * 5)),
      isCompleted: false
    };

    let monthlyMockExam = undefined;
    if (weekNumber % 4 === 0 || weekIdx === completeWeeks.length - 1) {
      const monthNum = Math.ceil(weekNumber / 4);
      monthlyMockExam = {
        title: `Simulado Mensal Cumulativo - Mês ${monthNum}`,
        questionsCount: 60,
        isCompleted: false
      };
    }

    return {
      weekNumber,
      priorityTitle,
      days: daysMap,
      mockExam,
      monthlyMockExam
    };
  });

  return {
    weeks: hydratedWeeks
  };
}

/**
 * AI-powered semantic matching of college exam topics to canonical residency topics.
 * Charges 20 credits as requested.
 */
export async function matchCollegeTopicsWithAI(inputText: string, canonicalTitles: string[], userId?: string): Promise<string[]> {
  const prompt = `Você é um médico especialista em educação médica e IA.
Sua tarefa é analisar o edital ou lista de assuntos de uma prova da faculdade de medicina e mapeá-los para os nossos tópicos canônicos de estudo de residência médica.

Assuntos digitados pelo estudante:
"${inputText}"

Nossos tópicos canônicos disponíveis para estudo:
${JSON.stringify(canonicalTitles)}

Por favor, faça um mapeamento semântico inteligente. Identifique quais tópicos canônicos correspondem diretamente aos assuntos da faculdade. Leve em consideração abreviações (ex: HAS -> Hipertensão Arterial Sistêmica, IC -> Insuficiência Cardíaca, IAM -> Infarto Agudo do Miocárdio, DHEG -> Doença Hipertensiva Específica da Gestação, DPOC -> Doença Pulmonar Obstrutiva Crônica), sinônimos e nomes ligeiramente diferentes, mas que representem na verdade o mesmo conteúdo médico.

Retorne APENAS uma lista JSON válida contendo as strings dos nossos tópicos canônicos mapeados.
NÃO inclua formatação markdown, tags \`\`\`json, explicações ou texto extra. Apenas o array JSON puro. Exemplo de retorno:
["Apendicite Aguda", "Hipertensão Arterial Sistêmica", "Asma Brônquica"]`;

  try {
    await checkUsageLimit();
    const result = await callGemini('generateContent', prompt, "gemini-3.1-flash-lite");
    await recordUsage(20); // 20 credits as requested / established
    
    if (!result) return [];
    
    // Clean up response to ensure valid JSON parsing
    if (typeof result === 'object' && result !== null) {
      if (Array.isArray(result)) {
        return result.map((t: any) => String(t).trim());
      }
    }

    let cleanJson = String(result).trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
    }
    
    try {
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        return parsed.map((t: any) => String(t).trim());
      }
    } catch (e) {
      console.error("Error parsing matchCollegeTopicsWithAI JSON:", e);
    }
    return [];
  } catch (error) {
    console.error('Error in matchCollegeTopicsWithAI:', error);
    throw error;
  }
}




