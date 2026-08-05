const fs = require('fs');
let content = fs.readFileSync('src/internato/components/TopicDetail.tsx', 'utf-8');

// Loading state
const originalLoading = `<p className="text-xs font-bold uppercase tracking-widest text-stone-600">Consultando Fontes Acadêmicas...</p>
                        <p className="text-[10px] text-stone-400 font-mono">Buscando em Wikimedia Commons e Google Books API</p>`;
const newLoading = `<p className="text-xs font-bold uppercase tracking-widest text-stone-600">
                          {searchModalAiLoading ? "A IA está otimizando a busca..." : "Consultando Fontes Acadêmicas..."}
                        </p>
                        <p className="text-[10px] text-stone-400 font-mono">
                          {searchModalAiLoading ? "Pesquisando com termos altamente específicos" : "Buscando em Wikimedia Commons e Google Books API"}
                        </p>`;
content = content.replace(originalLoading, newLoading);

// Search Buttons
const originalSearchInput = `<button
                      onClick={() => handleSearchScientificImages(searchModalQuery)}
                      className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-widest px-5 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Pesquisar
                    </button>`;

const newSearchInput = `<button
                      onClick={() => handleSearchScientificImages(searchModalQuery, false)}
                      className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-widest px-5 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer"
                      title="Pesquisa comum"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Pesquisar
                    </button>
                    <button
                      onClick={() => handleSearchScientificImages(searchModalQuery, true)}
                      disabled={aiCredits <= 0}
                      className="\${aiCredits > 0 ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800' : 'bg-stone-300'} text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      title={aiCredits > 0 ? "A IA encontrará as imagens mais adequadas nos acervos" : "Sem créditos de IA"}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Pedir à IA ({aiCredits} {aiCredits === 1 ? 'crédito' : 'créditos'})
                    </button>`;

content = content.replace(originalSearchInput, newSearchInput);

// Need to import Sparkles at the top
if (!content.includes('Sparkles')) {
  content = content.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*'lucide-react';/, "import { $1, Sparkles } from 'lucide-react';");
}

fs.writeFileSync('src/internato/components/TopicDetail.tsx', content);
