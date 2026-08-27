import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ManualLinkingModalProps {
  linkingTopic: {
    weekIdx: number;
    dayName: string;
    topicIdx: number;
    title: string;
    currentLinkedId?: string;
  } | null;
  setLinkingTopic: (value: any) => void;
  topicLinkSearch: string;
  setTopicLinkSearch: (value: string) => void;
  topics: any[];
  handleLinkTopic: (weekIdx: number, dayName: string, topicIdx: number, topicId: string) => void;
}

export const ManualLinkingModal: React.FC<ManualLinkingModalProps> = ({
  linkingTopic,
  setLinkingTopic,
  topicLinkSearch,
  setTopicLinkSearch,
  topics,
  handleLinkTopic,
}) => {
  return (
    <AnimatePresence>
      {linkingTopic && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-[#E2E0D9] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            <div className="bg-[#1A1A1A] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display uppercase tracking-wider">Vincular Tema ao MedRevise</h3>
                  <p className="text-[10px] text-stone-400">Associe esta aula do cronograma com um tópico registrado no MedRevise.</p>
                </div>
              </div>
              <button 
                onClick={() => setLinkingTopic(null)}
                className="text-stone-400 hover:text-white transition-all text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Selected topic information */}
            <div className="p-4 bg-stone-50 border-b border-stone-100 space-y-1">
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase bg-amber-50 border border-amber-200 text-amber-800">
                AULA DO CRONOGRAMA
              </span>
              <h4 className="text-xs font-bold text-stone-800">{linkingTopic.title}</h4>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-stone-100 bg-stone-50/20">
              <input 
                type="text"
                placeholder="🔍 Buscar tópico no MedRevise..."
                value={topicLinkSearch}
                onChange={(e) => setTopicLinkSearch(e.target.value)}
                className="w-full text-xs p-3 border border-stone-200 rounded-xl bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-medium"
              />
            </div>

            {/* Topics Selection list */}
            <div className="p-5 overflow-y-auto flex-1 space-y-2">
              {(() => {
                const filteredTopics = topics.filter(t => {
                  const name = t.title || t.name || '';
                  return name.toLowerCase().includes(topicLinkSearch.toLowerCase());
                });

                if (filteredTopics.length === 0) {
                  return (
                    <p className="text-xs text-stone-400 italic py-8 text-center">Nenhum tópico do MedRevise encontrado com esse nome.</p>
                  );
                }

                return filteredTopics.map(t => {
                  const name = t.title || t.name || '';
                  const isLinked = linkingTopic.currentLinkedId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleLinkTopic(linkingTopic.weekIdx, linkingTopic.dayName, linkingTopic.topicIdx, t.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-center justify-between ${
                        isLinked 
                          ? "bg-indigo-50/60 border-indigo-200 text-indigo-900 font-bold" 
                          : "bg-white border-stone-200/80 hover:border-indigo-400 hover:bg-stone-50"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">{name}</p>
                        <p className="text-[10px] text-stone-500">{t.subjectName}</p>
                      </div>
                      {isLinked ? (
                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded border border-indigo-200/50">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-stone-400 opacity-80">
                          Vincular →
                        </span>
                      )}
                    </button>
                  );
                });
              })()}
            </div>

            {/* Footer with remove link option */}
            {linkingTopic.currentLinkedId && (
              <div className="p-4 bg-stone-50 border-t border-stone-150 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLinkTopic(linkingTopic.weekIdx, linkingTopic.dayName, linkingTopic.topicIdx, '')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs flex items-center gap-1.5"
                >
                  Desvincular Tópico
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
