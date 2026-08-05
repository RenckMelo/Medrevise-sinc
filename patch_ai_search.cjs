const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// Import generateWithAI
content = content.replace(
  'getGlobalUsage, importPdfWithAI, deepenNotebookArea, analyzeSummaryNeeds, generateCustomAnalyzedSummary } from \'../services/geminiService\';',
  'getGlobalUsage, importPdfWithAI, deepenNotebookArea, analyzeSummaryNeeds, generateCustomAnalyzedSummary, generateWithAI } from \'../services/geminiService\';'
);

// Modify handleSearchScientificImages
const originalHandleSearch = `  const handleSearchScientificImages = async (queryStr: string) => {
    if (!queryStr || queryStr.trim().length < 2) return;
    setSearchModalLoading(true);
    setSearchModalResults([]);
    setSearchModalSelectedId(null);
    
    try {
      let results: any[] = [];
      const cleanQuery = queryStr.trim();
      
      const ptTerm = cleanQuery;
      const enTerm = getEnglishMedicalTerm(ptTerm);
      const queryTermsToSearch = [ptTerm];
      if (enTerm && enTerm !== ptTerm) {
        queryTermsToSearch.push(enTerm);
      }`;

const newHandleSearch = `  const handleSearchScientificImages = async (queryStr: string, useAi: boolean = false) => {
    if (!queryStr || queryStr.trim().length < 2) return;
    setSearchModalLoading(true);
    if (useAi) setSearchModalAiLoading(true);
    setSearchModalResults([]);
    setSearchModalSelectedId(null);
    
    try {
      if (useAi && aiCredits > 0) {
        const newCredits = Math.max(0, aiCredits - 1);
        setAiCredits(newCredits);
        localStorage.setItem('pref_ai_credits', newCredits.toString());
      }

      let results: any[] = [];
      const cleanQuery = queryStr.trim();
      
      let queryTermsToSearch: string[] = [];
      let ptTerm = cleanQuery;
      
      if (useAi) {
        try {
          const aiPrompt = \`O usuário quer encontrar uma imagem médica/acadêmica descrita como: "\${cleanQuery}". 
Gere 3 termos de busca altamente específicos e otimizados em INGLÊS que retornariam as melhores fotos médicas, ilustrações anatômicas ou achados clínicos em APIs de livros e imagens. 
Exemplos de formato: "sternocleidomastoid muscle anatomy", "appendicitis histology", "netter heart cross section".
Retorne APENAS os 3 termos separados por vírgula, sem aspas, marcadores ou explicações.\`;
          const aiResponse = await generateWithAI(aiPrompt, "gemini-3.1-flash", 0);
          if (aiResponse) {
            queryTermsToSearch = aiResponse.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          }
        } catch (err) {
          console.warn("AI failed to optimize search", err);
        }
      }
      
      if (queryTermsToSearch.length === 0) {
        const enTerm = getEnglishMedicalTerm(ptTerm);
        queryTermsToSearch = [ptTerm];
        if (enTerm && enTerm !== ptTerm) {
          queryTermsToSearch.push(enTerm);
        }
      }`;

content = content.replace(originalHandleSearch, newHandleSearch);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
