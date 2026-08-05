import React, { useState, useEffect } from 'react';
import { Subject, Topic, Flashcard, UserProgress } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, RefreshCcw, ChevronLeft, ChevronRight, RotateCcw, Loader2, Sparkles, Filter, Layers, HelpCircle, ChevronRight as ChevronRightIcon } from 'lucide-react';

import { db, collection, query, getDocs, doc, updateDoc, where, addDoc, limit } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { generateFlashcards } from '../services/geminiService';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface FlashcardModuleProps {
  subjects: Subject[];
  topics: Topic[];
  userProgress: UserProgress | null;
  userId: string;
}

export default function FlashcardModule({ subjects, topics, userProgress, userId }: FlashcardModuleProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(true);
  const [numCardsPerTopic, setNumCardsPerTopic] = useState(10);

  const fetchFlashcards = async () => {
    setLoading(true);
    let q;
    if (selectedTopicIds.length > 0) {
      q = query(collection(db, 'flashcards'), where('topicId', 'in', selectedTopicIds), limit(50));
    } else if (selectedSubjectIds.length > 0) {
      q = query(collection(db, 'flashcards'), where('subjectId', 'in', selectedSubjectIds), limit(50));
    } else {
      q = query(collection(db, 'flashcards'), limit(50));
    }
    
    const snapshot = await getDocs(q);
    const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Flashcard));
    
    setFlashcards(fetched.sort(() => Math.random() - 0.5));
    setLoading(false);
    setCurrentIndex(0);
    setIsFlipped(false);
    if (fetched.length > 0) {
      setIsSelecting(false);
    }
  };

  useEffect(() => {
    setLoading(false);
  }, []);

  const toggleSubject = (sid: string) => {
    setSelectedSubjectIds(prev => 
      prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]
    );
  };

  const toggleTopic = (tid: string) => {
    setSelectedTopicIds(prev => 
      prev.includes(tid) ? prev.filter(i => i !== tid) : [...prev, tid]
    );
  };

  const handleGenerate = async () => {
    if (selectedTopicIds.length === 0) {
      alert('Selecione um ou mais temas específicos para gerar novos flashcards.');
      return;
    }
    
    setIsGenerating(true);
    for (const tid of selectedTopicIds) {
      const topic = topics.find(t => t.id === tid);
      if (topic) {
        const newCards = await generateFlashcards(topic.title, topic.content, numCardsPerTopic, userId);
        if (newCards && Array.isArray(newCards)) {
          const addedCards: Flashcard[] = [];
          for (const cardData of newCards) {
            // Map keys if the AI used different names (defensive)
            const front = cardData.front || cardData.question || cardData.pergunta || '';
            const back = cardData.back || cardData.answer || cardData.resposta || '';
            
            const docRef = await addDoc(collection(db, 'flashcards'), {
              front,
              back,
              topicId: topic.id,
              subjectId: topic.subjectId
            });
            addedCards.push({ 
              id: docRef.id, 
              front, 
              back, 
              topicId: topic.id, 
              subjectId: topic.subjectId 
            } as Flashcard);
          }
          setFlashcards(prev => [...prev, ...addedCards]);
        }
      }
    }
    setIsSelecting(false);
    setIsGenerating(false);
  };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const currentCard = flashcards[currentIndex];

  if (loading) return <div className="text-center py-20">Carregando flashcards...</div>;

  if (isSelecting || flashcards.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="bg-[#FBFBFA] p-8 rounded-2xl border border-[#E2E0D9] space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Matérias</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s, sIdx) => (
                  <Button
                    key={`fc-subj-${s.id}-${sIdx}`}
                    variant={selectedSubjectIds.includes(s.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSubject(s.id)}
                    className="rounded-full text-[9px] uppercase tracking-widest font-bold h-8"
                  >
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Temas Específicos</label>
              <div className="flex flex-wrap gap-2 max-h-[200px] overflow-auto">
                {topics.filter(t => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(t.subjectId)).map((t, tIdx) => (
                  <Button
                    key={`fc-top-${t.id}-${tIdx}`}
                    variant={selectedTopicIds.includes(t.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleTopic(t.id)}
                    className="rounded-full text-[9px] uppercase tracking-widest font-bold h-8 border-dashed"
                  >
                    {t.title}
                  </Button>
                ))}
                {topics.length === 0 && <p className="text-[10px] italic text-[#8E8A82]">Nenhum tema encontrado.</p>}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-[#E2E0D9]">
            <Button onClick={fetchFlashcards} className="bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest font-black px-10 h-12 rounded-xl gap-3">
              Praticar Flashcards
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-[#E2E0D9] space-y-8">
          <HelpCircle className="w-16 h-16 text-[#E2E0D9] mx-auto" />
          <div className="space-y-4 max-w-sm mx-auto">
            <p className="text-[#8E8A82] font-display italic text-lg px-4">Não encontramos flashcards para esses filtros.</p>
            
            {selectedTopicIds.length > 0 ? (
              <div className="space-y-6 pt-4 border-t border-[#E2E0D9]">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Flashcards por Tema</label>
                  <div className="flex justify-center gap-2">
                    {[10, 20, 30].map(n => (
                      <Button
                        key={n}
                        variant={numCardsPerTopic === n ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNumCardsPerTopic(n)}
                        className="h-9 px-4 rounded-xl text-[10px] font-bold"
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Button 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full bg-primary text-white text-[11px] uppercase tracking-widest font-black px-10 h-14 rounded-2xl gap-3 shadow-xl shadow-primary/20"
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    Gerar {selectedTopicIds.length * numCardsPerTopic} Flashcards
                  </Button>
                  
                  <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">
                    <Brain className="w-3 h-3 text-primary" />
                    Custo estimado: {selectedTopicIds.length} Créditos de IA
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82] opacity-60">Selecione temas específicos para gerar novos flashcards via IA.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex flex-col sm:flex-row gap-6 items-center justify-between bg-white p-8 rounded-3xl shadow-sm border border-[#E2E0D9]">
        <div className="flex flex-col">
          <div className="text-[11px] uppercase tracking-widest text-[#8E8A82] font-bold">Memorização Ativa</div>
          <h2 className="text-3xl font-display font-black">Flashcards</h2>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Button 
            variant="outline"
            className="h-11 border-primary/20 text-primary text-[10px] uppercase font-black tracking-widest px-4 rounded-xl w-full"
            onClick={() => {
              setSelectedTopicIds([]);
              setSelectedSubjectIds([]);
              setFlashcards([]);
              setIsSelecting(true);
            }}
          >
            Configurar Novo Deck
          </Button>
        </div>
      </div>
        <>
          <div className="relative h-[480px] perspective-1000 max-w-2xl mx-auto w-full">
            <motion.div
              className="w-full h-full relative preserve-3d cursor-pointer"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Front */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center border-[#E2E0D9] shadow-none rounded-2xl bg-white">
                <div className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82] mb-10 border-b border-[#E2E0D9] pb-2">Pergunta</div>
                <p className="text-3xl font-display font-bold leading-tight text-[#1A1A1A]">
                  {currentCard.front || (currentCard as any).question || (currentCard as any).pergunta}
                </p>
                <div className="mt-auto pt-10">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[#E2E0D9]">Clique para revelar</p>
                </div>
              </Card>

              {/* Back */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center border-none shadow-none rounded-2xl [transform:rotateY(180deg)] bg-[#1A1A1A] text-white">
                <div className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-10 border-b border-white/10 pb-2">Resposta</div>
                <p className="text-3xl font-display italic leading-tight">
                  {currentCard.back || (currentCard as any).answer || (currentCard as any).resposta}
                </p>
                <div className="mt-auto pt-10">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-white/20">Clique para voltar</p>
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="flex items-center justify-between gap-6 max-w-2xl mx-auto w-full">
            <Button variant="outline" size="lg" onClick={prevCard} className="flex-1 h-14 border-[#E2E0D9] text-[11px] uppercase tracking-widest font-bold rounded-xl">
              <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
            </Button>
            <div className="text-xs font-bold text-[#8E8A82] uppercase tracking-widest">
              {currentIndex + 1} <span className="mx-1 opacity-30">/</span> {flashcards.length}
            </div>
            <Button variant="outline" size="lg" onClick={nextCard} className="flex-1 h-14 border-[#E2E0D9] text-[11px] uppercase tracking-widest font-bold rounded-xl">
              Próximo <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="flex justify-center pt-4 max-w-2xl mx-auto w-full">
            <Button variant="ghost" onClick={() => setFlashcards([...flashcards].sort(() => Math.random() - 0.5))} className="gap-2 text-[10px] uppercase tracking-widest font-bold text-[#8E8A82] hover:text-[#1A1A1A]">
              <RotateCcw className="w-3 h-3" /> Embaralhar Deck
            </Button>
          </div>
        </>
    </div>
  );
}

