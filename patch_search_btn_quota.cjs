const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

const originalCredits = `  const [aiCredits, setAiCredits] = useState(() => { return parseInt(localStorage.getItem('pref_ai_credits') || '50', 10); });`;
content = content.replace(originalCredits, ''); // Remove the local state

const originalSearchLogic = `      if (useAi && aiCredits > 0) {
        const newCredits = Math.max(0, aiCredits - 1);
        setAiCredits(newCredits);
        localStorage.setItem('pref_ai_credits', newCredits.toString());
      }`;
const newSearchLogic = `      if (useAi) {
        if (globalQuota.available < 1) {
          alert('Você não tem créditos suficientes para otimizar com IA.');
          return;
        }
      }`;
content = content.replace(originalSearchLogic, newSearchLogic);

const originalGenerate = `const aiResponse = await generateWithAI(aiPrompt, "gemini-3.1-flash-lite", 0);`;
const newGenerate = `const aiResponse = await generateWithAI(aiPrompt, "gemini-3.1-flash-lite", 1);`;
content = content.replace(originalGenerate, newGenerate);

const originalCatch = `        } catch (err: any) {
          console.warn("AI failed to optimize search", err);
          alert("A IA não conseguiu otimizar a busca: " + (err.message || err));
          // Refund credit
          const refunded = aiCredits; // it was reduced before
          setAiCredits(refunded);
          localStorage.setItem('pref_ai_credits', refunded.toString());
        }`;
const newCatch = `        } catch (err: any) {
          console.warn("AI failed to optimize search", err);
          alert("A IA não conseguiu otimizar a busca: " + (err.message || err));
        } finally {
          await fetchQuota(); // Refresh to reflect usage or refund
        }`;
content = content.replace(originalCatch, newCatch);

const originalBtn = `<button
                      onClick={() => handleSearchScientificImages(searchModalQuery, true)}
                      disabled={aiCredits <= 0}
                      className="\${aiCredits > 0 ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800' : 'bg-stone-300'} text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      title={aiCredits > 0 ? "Custo: 1 crédito de imagem. A IA otimizará a busca." : "Sem créditos de IA"}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Otimizar com IA (Custa 1 crédito) - Saldo: {aiCredits}
                    </button>`;
const newBtn = `<button
                      onClick={() => handleSearchScientificImages(searchModalQuery, true)}
                      disabled={globalQuota.available < 1}
                      className="\${globalQuota.available >= 1 ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800' : 'bg-stone-300'} text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      title={globalQuota.available >= 1 ? "Custo: 1 crédito de IA." : "Créditos insuficientes"}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Otimizar com IA (1cr)
                    </button>`;
content = content.replace(originalBtn, newBtn);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
