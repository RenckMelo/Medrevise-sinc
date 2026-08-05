const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

const originalBtn = `<button
                      onClick={() => handleSearchScientificImages(searchModalQuery, true)}
                      disabled={aiCredits <= 0}
                      className="\${aiCredits > 0 ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800' : 'bg-stone-300'} text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      title={aiCredits > 0 ? "A IA encontrará as imagens mais adequadas nos acervos" : "Sem créditos de IA"}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Pedir à IA ({aiCredits} {aiCredits === 1 ? 'crédito' : 'créditos'})
                    </button>`;

const newBtn = `<button
                      onClick={() => handleSearchScientificImages(searchModalQuery, true)}
                      disabled={aiCredits <= 0}
                      className="\${aiCredits > 0 ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800' : 'bg-stone-300'} text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      title={aiCredits > 0 ? "Custo: 1 crédito de imagem. A IA otimizará a busca." : "Sem créditos de IA"}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Otimizar com IA (Custa 1 crédito) - Saldo: {aiCredits}
                    </button>`;

content = content.replace(originalBtn, newBtn);

const originalCatch = `        } catch (err) {
          console.warn("AI failed to optimize search", err);
        }`;
const newCatch = `        } catch (err: any) {
          console.warn("AI failed to optimize search", err);
          alert("A IA não conseguiu otimizar a busca: " + (err.message || err));
        }`;

content = content.replace(originalCatch, newCatch);

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
