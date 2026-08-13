import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Subject, Topic, Flashcard, UserProgress } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Loader2,
  Sparkles,
  Filter,
  Layers,
  HelpCircle,
  ChevronRight as ChevronRightIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Plus,
  Trophy,
  Target,
  BarChart2,
  Check,
  Flame,
  ArrowRight,
  ShieldAlert,
  Sparkle,
  Keyboard,
  Clock,
  BookOpen,
  Zap,
  Award
} from 'lucide-react';

import { db, collection, query, getDocs, doc, updateDoc, setDoc, where, addDoc, limit } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  generateFlashcards, 
  generateFlashcardDiagnosticReport, 
  calculateFlashcardCreditCost, 
  analyzeTopicFlashcardPotential, 
  FlashcardPotentialAnalysis 
} from '../services/geminiService';
import { cn } from '@/lib/utils';

interface FlashcardModuleProps {
  subjects: Subject[];
  topics: Topic[];
  userProgress: UserProgress | null;
  userId: string;
  initialTopicIds?: string[];
  onProgressUpdate?: () => void;
  availableCredits?: number;
  setAvailableCredits?: React.Dispatch<React.SetStateAction<number>>;
}

export type ReviewRating = 'errei' | 'dificil' | 'bom' | 'facil';

interface DiagnosticResult {
  scorePercent: number;
  totalCards: number;
  masteredCount: number;
  hardCount: number;
  failedCount: number;
  levelLabel: string;
  levelColor: string;
  failedItems: { concept: string; front: string; back: string }[];
  hardItems: { concept: string; front: string; back: string }[];
  masteredItems: { concept: string; front: string; back: string }[];
  aiReport?: {
    overallMasteryLevel: string;
    whatToStudy: string[];
    studyPlan: string;
    revisionSchedule: string;
  } | null;
}

// SRS SM-2 Algorithm helper with distinct interval curves
export function calculateSRS(
  rating: ReviewRating,
  prevInterval: number = 1,
  prevEase: number = 2.5,
  prevReps: number = 0
): { nextInterval: number; newEase: number; newReps: number; nextDateISO: string } {
  let newEase = prevEase;
  let newReps = prevReps;
  let nextInterval = prevInterval;

  switch (rating) {
    case 'errei':
      newReps = 0;
      nextInterval = 1; // 1d
      newEase = Math.max(1.3, prevEase - 0.20);
      break;

    case 'dificil':
      newReps = prevReps + 1;
      if (prevReps === 0) {
        nextInterval = 2; // 2d for new card
      } else {
        nextInterval = Math.max(prevInterval + 1, Math.round(prevInterval * 1.25));
      }
      newEase = Math.max(1.3, prevEase - 0.15);
      break;

    case 'bom':
      newReps = prevReps + 1;
      if (prevReps === 0) {
        nextInterval = 4; // 4d for new card
      } else {
        nextInterval = Math.max(prevInterval + 2, Math.round(prevInterval * prevEase));
      }
      break;

    case 'facil':
      newReps = prevReps + 1;
      if (prevReps === 0) {
        nextInterval = 7; // 7d for new card
      } else {
        nextInterval = Math.max(prevInterval + 4, Math.round(prevInterval * prevEase * 1.35));
      }
      newEase = prevEase + 0.15;
      break;
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + nextInterval);

  return {
    nextInterval,
    newEase,
    newReps,
    nextDateISO: nextDate.toISOString()
  };
}

export default function FlashcardModule({
  subjects,
  topics,
  userProgress,
  userId,
  initialTopicIds,
  onProgressUpdate,
  availableCredits,
  setAvailableCredits
}: FlashcardModuleProps) {
  // Main modes
  const [activeTab, setActiveTab] = useState<'srs' | 'deck' | 'diagnostic' | 'create'>('srs');

  // Decks & Cards
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(initialTopicIds || []);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(!initialTopicIds || initialTopicIds.length === 0);

  // IA Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [numCardsPerTopic, setNumCardsPerTopic] = useState(10);

  // AI Coverage Potential Analysis State
  const [isAnalyzingPotential, setIsAnalyzingPotential] = useState(false);
  const [potentialAnalysis, setPotentialAnalysis] = useState<FlashcardPotentialAnalysis | null>(null);
  const [showPotentialModal, setShowPotentialModal] = useState(false);

  // Session Tracking & Stats
  const [sessionRatings, setSessionRatings] = useState<Record<string, ReviewRating>>({});
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Diagnostic Mode states
  const [diagnosticScores, setDiagnosticScores] = useState<{
    card: Flashcard;
    rating: ReviewRating;
  }[]>([]);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isGeneratingDiagnosticReport, setIsGeneratingDiagnosticReport] = useState(false);
  const [scheduledSuccessMsg, setScheduledSuccessMsg] = useState<string | null>(null);

  // Manual Card Creation State
  const [manualFront, setManualFront] = useState('');
  const [manualBack, setManualBack] = useState('');
  const [manualConcept, setManualConcept] = useState('');
  const [manualTopicId, setManualTopicId] = useState(topics[0]?.id || '');
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Local state for SRS reviews map
  const srsReviewsMap = useMemo(() => {
    return userProgress?.flashcardReviews || {};
  }, [userProgress]);

  // Load Flashcards
  const fetchFlashcards = useCallback(async (mode: 'srs' | 'deck' | 'diagnostic' = 'deck', filterTopicIds?: string[], filterSubjectIds?: string[]) => {
    setLoading(true);
    setSessionCompleted(false);
    setSessionRatings({});
    setDiagnosticScores([]);
    setDiagnosticResult(null);

    try {
      let q;
      const topicsToFilter = filterTopicIds || selectedTopicIds;
      const subjectsToFilter = filterSubjectIds || selectedSubjectIds;

      if (topicsToFilter.length > 0) {
        q = query(collection(db, 'flashcards'), where('topicId', 'in', topicsToFilter), limit(80));
      } else if (subjectsToFilter.length > 0) {
        q = query(collection(db, 'flashcards'), where('subjectId', 'in', subjectsToFilter), limit(80));
      } else {
        q = query(collection(db, 'flashcards'), limit(80));
      }

      const snapshot = await getDocs(q);
      let fetched = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) } as Flashcard));

      if (mode === 'srs') {
        const nowStr = new Date().toISOString();
        // Filter cards that are due today or not yet reviewed
        fetched = fetched.filter(card => {
          const rev = srsReviewsMap[card.id];
          if (!rev || !rev.nextReview) return true; // new card
          return rev.nextReview <= nowStr;
        });
      }

      // Shuffle deck
      const shuffled = fetched.sort(() => Math.random() - 0.5);
      setFlashcards(shuffled);
      setCurrentIndex(0);
      setIsFlipped(false);

      if (shuffled.length > 0) {
        setIsSelecting(false);
      }
    } catch (err) {
      console.error('Error fetching flashcards:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTopicIds, selectedSubjectIds, srsReviewsMap]);

  // Auto-fetch if initialTopicIds provided
  useEffect(() => {
    if (initialTopicIds && initialTopicIds.length > 0) {
      setSelectedTopicIds(initialTopicIds);
      setActiveTab('deck');
      fetchFlashcards('deck', initialTopicIds);
    } else {
      fetchFlashcards('srs');
    }
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

  // AI Flashcard Potential Analysis
  const handleAnalyzeTopicPotential = async () => {
    if (selectedTopicIds.length === 0) {
      alert('Selecione um tema para analisar a quantidade de flashcards recomendada.');
      return;
    }
    const topic = topics.find(t => t.id === selectedTopicIds[0]);
    if (!topic) return;

    setIsAnalyzingPotential(true);
    try {
      const result = await analyzeTopicFlashcardPotential(topic.title, topic.content || topic.title);
      setPotentialAnalysis(result);
      setShowPotentialModal(true);
    } catch (err: any) {
      alert(`Falha ao analisar potencial do tema: ${err.message || 'Erro de conexão.'}`);
    } finally {
      setIsAnalyzingPotential(false);
    }
  };

  const handleGenerateExtractedCards = async (countToGenerate: number, requiredCredits: number) => {
    if (availableCredits !== undefined && availableCredits < requiredCredits) {
      alert(`Créditos insuficientes (${availableCredits} disponíveis). A geração de ${countToGenerate} flashcards exige ${requiredCredits} créditos.`);
      return;
    }

    if (selectedTopicIds.length === 0) return;

    setIsGenerating(true);
    setShowPotentialModal(false);

    try {
      const addedCards: Flashcard[] = [];
      for (const tid of selectedTopicIds) {
        const topic = topics.find(t => t.id === tid);
        if (topic) {
          const newCards = await generateFlashcards(topic.title, topic.content || topic.title, countToGenerate, userId);
          if (newCards && Array.isArray(newCards)) {
            for (const cardData of newCards) {
              const front = cardData.front || cardData.question || cardData.pergunta || '';
              const back = cardData.back || cardData.answer || cardData.resposta || '';
              const concept = cardData.concept || topic.title;

              if (front && back) {
                const docRef = await addDoc(collection(db, 'flashcards'), {
                  front,
                  back,
                  concept,
                  topicId: topic.id,
                  subjectId: topic.subjectId,
                  createdAt: new Date().toISOString()
                });

                addedCards.push({
                  id: docRef.id,
                  front,
                  back,
                  concept,
                  topicId: topic.id,
                  subjectId: topic.subjectId
                });
              }
            }
          }
        }
      }

      setFlashcards(prev => [...prev, ...addedCards]);
      setIsSelecting(false);

      if (setAvailableCredits) {
        setAvailableCredits(prev => Math.max(0, prev - requiredCredits));
      }

      if (addedCards.length > 0) {
        setCurrentIndex(0);
        setIsFlipped(false);
        alert(`Sucesso! ${addedCards.length} flashcards extraídos e adicionados ao seu deck.`);
      }
    } catch (err: any) {
      alert(`Erro ao gerar flashcards: ${err.message || 'Tente novamente.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Standard AI Flashcard Generation
  const handleGenerate = async () => {
    if (selectedTopicIds.length === 0) {
      alert('Selecione um ou mais temas específicos para gerar novos flashcards.');
      return;
    }

    const totalCardsCount = selectedTopicIds.length * numCardsPerTopic;
    const requiredCredits = calculateFlashcardCreditCost(totalCardsCount);

    if (availableCredits !== undefined && availableCredits < requiredCredits) {
      alert(`Créditos insuficientes (${availableCredits} disponíveis). A geração de ${totalCardsCount} flashcards exige ${requiredCredits} créditos.`);
      return;
    }

    setIsGenerating(true);
    try {
      const addedCards: Flashcard[] = [];
      for (const tid of selectedTopicIds) {
        const topic = topics.find(t => t.id === tid);
        if (topic) {
          const newCards = await generateFlashcards(topic.title, topic.content || topic.title, numCardsPerTopic, userId);
          if (newCards && Array.isArray(newCards)) {
            for (const cardData of newCards) {
              const front = cardData.front || cardData.question || cardData.pergunta || '';
              const back = cardData.back || cardData.answer || cardData.resposta || '';
              const concept = cardData.concept || topic.title;

              if (front && back) {
                const docRef = await addDoc(collection(db, 'flashcards'), {
                  front,
                  back,
                  concept,
                  topicId: topic.id,
                  subjectId: topic.subjectId,
                  createdAt: new Date().toISOString()
                });

                addedCards.push({
                  id: docRef.id,
                  front,
                  back,
                  concept,
                  topicId: topic.id,
                  subjectId: topic.subjectId
                });
              }
            }
          }
        }
      }

      setFlashcards(prev => [...prev, ...addedCards]);
      setIsSelecting(false);

      if (setAvailableCredits) {
        setAvailableCredits(prev => Math.max(0, prev - requiredCredits));
      }

      if (addedCards.length > 0) {
        setCurrentIndex(0);
        setIsFlipped(false);
      }
    } catch (err: any) {
      alert(`Erro ao gerar flashcards com IA: ${err.message || 'Tente novamente.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Manual Flashcard Creation
  const handleCreateManualCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFront.trim() || !manualBack.trim()) {
      alert('Preencha a pergunta (frente) e a resposta (verso).');
      return;
    }

    setIsSavingManual(true);
    try {
      const topicObj = topics.find(t => t.id === manualTopicId);
      const subjectId = topicObj ? topicObj.subjectId : subjects[0]?.id || '';

      const newCardDoc = {
        front: manualFront.trim(),
        back: manualBack.trim(),
        concept: manualConcept.trim() || (topicObj ? topicObj.title : 'Conceito Médico'),
        topicId: manualTopicId,
        subjectId,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'flashcards'), newCardDoc);
      const createdCard: Flashcard = {
        id: docRef.id,
        ...newCardDoc
      };

      setFlashcards(prev => [createdCard, ...prev]);
      setManualFront('');
      setManualBack('');
      setManualConcept('');
      alert('Flashcard criado e salvo com sucesso!');
      setActiveTab('deck');
      setIsSelecting(false);
    } catch (err: any) {
      alert(`Erro ao salvar card: ${err.message}`);
    } finally {
      setIsSavingManual(false);
    }
  };

  // Apply SRS Rating to current card
  const handleRateCard = async (rating: ReviewRating) => {
    if (!currentCard) return;

    const prevRev = srsReviewsMap[currentCard.id] || {
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0
    };

    const srs = calculateSRS(rating, prevRev.interval, prevRev.easeFactor, prevRev.repetitions);

    // Save to Firestore userProgress
    if (userId) {
      try {
        const progressRef = doc(db, 'users', userId, 'progress', 'main');
        const reviewData = {
          nextReview: srs.nextDateISO,
          interval: srs.nextInterval,
          easeFactor: srs.newEase,
          repetitions: srs.newReps,
          lastRating: rating,
          lastReviewed: new Date().toISOString()
        };

        await setDoc(progressRef, {
          flashcardReviews: {
            ...srsReviewsMap,
            [currentCard.id]: reviewData
          }
        }, { merge: true });

        // Also update parent user doc for fallback
        try {
          await setDoc(doc(db, 'users', userId), {
            flashcardReviews: {
              ...srsReviewsMap,
              [currentCard.id]: reviewData
            }
          }, { merge: true });
        } catch (_) {}

        if (onProgressUpdate) {
          onProgressUpdate();
        }
      } catch (err) {
        console.error('Error saving SRS review:', err);
      }
    }

    // Save rating to current session
    setSessionRatings(prev => ({ ...prev, [currentCard.id]: rating }));

    // In Diagnostic Mode, record score
    if (activeTab === 'diagnostic') {
      setDiagnosticScores(prev => [...prev, { card: currentCard, rating }]);
    }

    // Advance to next card or finish session
    if (currentIndex + 1 < flashcards.length) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 150);
    } else {
      // Finished deck
      if (activeTab === 'diagnostic') {
        finishDiagnosticSession([...diagnosticScores, { card: currentCard, rating }]);
      } else {
        setSessionCompleted(true);
      }
    }
  };

  // Calculate & Generate Diagnostic Report
  const finishDiagnosticSession = async (scores: { card: Flashcard; rating: ReviewRating }[]) => {
    const total = scores.length;
    if (total === 0) return;

    let scorePoints = 0;
    const failedItems: { concept: string; front: string; back: string }[] = [];
    const hardItems: { concept: string; front: string; back: string }[] = [];
    const masteredItems: { concept: string; front: string; back: string }[] = [];

    scores.forEach(s => {
      const conceptStr = s.card.concept || s.card.front;
      const item = { concept: conceptStr, front: s.card.front, back: s.card.back };

      if (s.rating === 'errei') {
        scorePoints += 0;
        failedItems.push(item);
      } else if (s.rating === 'dificil') {
        scorePoints += 0.5;
        hardItems.push(item);
      } else if (s.rating === 'bom') {
        scorePoints += 0.85;
        masteredItems.push(item);
      } else if (s.rating === 'facil') {
        scorePoints += 1.0;
        masteredItems.push(item);
      }
    });

    const scorePercent = Math.round((scorePoints / total) * 100);

    let levelLabel = 'Nível Intermediário';
    let levelColor = 'text-amber-600 bg-amber-50 border-amber-200';

    if (scorePercent >= 85) {
      levelLabel = 'Domínio Excelente (Alta Retenção)';
      levelColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (scorePercent >= 70) {
      levelLabel = 'Domínio Sólido (Com Pequenas Lacunas)';
      levelColor = 'text-blue-700 bg-blue-50 border-blue-200';
    } else if (scorePercent < 50) {
      levelLabel = 'Ponto Crítico (Urgente Reforço Teórico)';
      levelColor = 'text-rose-700 bg-rose-50 border-rose-200';
    }

    const diagRes: DiagnosticResult = {
      scorePercent,
      totalCards: total,
      masteredCount: masteredItems.length,
      hardCount: hardItems.length,
      failedCount: failedItems.length,
      levelLabel,
      levelColor,
      failedItems,
      hardItems,
      masteredItems
    };

    setDiagnosticResult(diagRes);
    setSessionCompleted(true);

    // Call AI to generate written diagnostic report if topic is available
    if (scores[0]?.card.topicId) {
      const topicObj = topics.find(t => t.id === scores[0].card.topicId);
      if (topicObj) {
        setIsGeneratingDiagnosticReport(true);
        const report = await generateFlashcardDiagnosticReport(
          topicObj.title,
          scores.map(s => ({
            cardFront: s.card.front,
            concept: s.card.concept,
            rating: s.rating
          }))
        );

        if (report) {
          setDiagnosticResult(prev => prev ? { ...prev, aiReport: report } : null);
        }
        setIsGeneratingDiagnosticReport(false);
      }
    }
  };

  // Schedule automatic SRS reviews in user progress / schedule
  const handleScheduleDiagnosticReviews = async () => {
    if (!userId || !diagnosticResult) return;
    try {
      const now = new Date();
      const r1 = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const r2 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const r3 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Schedule pending reviews for failed cards
      const progressRef = doc(db, 'users', userId, 'progress', 'main');
      const newReviews = { ...srsReviewsMap };

      diagnosticScores.forEach(s => {
        if (s.rating === 'errei' || s.rating === 'dificil') {
          newReviews[s.card.id] = {
            nextReview: r1,
            interval: 1,
            easeFactor: 1.8,
            repetitions: 0,
            lastRating: s.rating,
            lastReviewed: now.toISOString()
          };
        }
      });

      await setDoc(progressRef, { flashcardReviews: newReviews }, { merge: true });
      try {
        await setDoc(doc(db, 'users', userId), { flashcardReviews: newReviews }, { merge: true });
      } catch (_) {}

      if (onProgressUpdate) onProgressUpdate();

      setScheduledSuccessMsg('Revisões automáticas (24h, 7d e 30d) agendadas no seu plano de estudos com sucesso!');
    } catch (err: any) {
      alert(`Erro ao agendar revisões: ${err.message}`);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped && !sessionCompleted && flashcards.length > 0) {
        if (e.key === '1' || e.key === 'a' || e.key === 'A') {
          handleRateCard('errei');
        } else if (e.key === '2' || e.key === 's' || e.key === 'S') {
          handleRateCard('dificil');
        } else if (e.key === '3' || e.key === 'd' || e.key === 'D') {
          handleRateCard('bom');
        } else if (e.key === '4' || e.key === 'f' || e.key === 'F') {
          handleRateCard('facil');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, sessionCompleted, flashcards, currentIndex]);

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % flashcards.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const currentCard = flashcards[currentIndex];

  // Derived current card SRS values preview
  const currentCardSRS = useMemo(() => {
    if (!currentCard) return null;
    const rev = srsReviewsMap[currentCard.id] || { interval: 1, easeFactor: 2.5, repetitions: 0 };
    return {
      erreiInterval: '1d',
      dificilInterval: `${Math.max(1, Math.round(rev.interval * 1.2))}d`,
      bomInterval: `${rev.repetitions === 0 ? 1 : rev.repetitions === 1 ? 3 : Math.max(1, Math.round(rev.interval * rev.easeFactor))}d`,
      facilInterval: `${rev.repetitions === 0 ? 4 : Math.max(2, Math.round(rev.interval * rev.easeFactor * 1.3))}d`
    };
  }, [currentCard, srsReviewsMap]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-semibold text-[#8E8A82] uppercase tracking-widest">Carregando Flashcards do MedInternato...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* HEADER & MODES NAVIGATION */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-[#E2E0D9] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E0D9] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
              <Brain className="w-4 h-4" />
              Memorização Ativa & Repetição Espaçada
            </div>
            <h1 className="text-3xl font-display font-black text-[#1A1A1A]">Flashcards Médicos</h1>
            <p className="text-xs text-[#8E8A82]">
              Algoritmo científico SM-2 de repetição espaçada, métricas de domínio e diagnóstico inteligente de lacunas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTopicIds([]);
                setSelectedSubjectIds([]);
                setIsSelecting(true);
              }}
              className="text-xs font-bold uppercase tracking-wider h-10 rounded-xl gap-2 border-[#E2E0D9]"
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
            </Button>
          </div>
        </div>

        {/* TABS SELECTOR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F5F4F0] p-1.5 rounded-2xl">
          <button
            onClick={() => {
              setActiveTab('srs');
              setIsSelecting(false);
              fetchFlashcards('srs');
            }}
            className={cn(
              'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
              activeTab === 'srs'
                ? 'bg-white text-primary shadow-xs font-black'
                : 'text-[#8E8A82] hover:text-[#1A1A1A]'
            )}
          >
            <Clock className="w-4 h-4 text-primary" />
            Devidos Hoje
          </button>

          <button
            onClick={() => {
              setActiveTab('deck');
              setIsSelecting(true);
            }}
            className={cn(
              'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
              activeTab === 'deck'
                ? 'bg-white text-primary shadow-xs font-black'
                : 'text-[#8E8A82] hover:text-[#1A1A1A]'
            )}
          >
            <BookOpen className="w-4 h-4" />
            Por Matéria
          </button>

          <button
            onClick={() => {
              setActiveTab('diagnostic');
              setIsSelecting(true);
            }}
            className={cn(
              'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
              activeTab === 'diagnostic'
                ? 'bg-white text-emerald-700 shadow-xs font-black'
                : 'text-[#8E8A82] hover:text-[#1A1A1A]'
            )}
          >
            <BarChart2 className="w-4 h-4 text-emerald-600" />
            Diagnóstico
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
              activeTab === 'create'
                ? 'bg-white text-indigo-700 shadow-xs font-black'
                : 'text-[#8E8A82] hover:text-[#1A1A1A]'
            )}
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            Novo Card
          </button>
        </div>
      </div>

      {/* CREATE MANUAL CARD TAB */}
      {activeTab === 'create' && (
        <Card className="border-[#E2E0D9] shadow-sm rounded-3xl p-8 bg-white space-y-6">
          <div className="space-y-2 border-b border-[#E2E0D9] pb-4">
            <h2 className="text-xl font-display font-black text-[#1A1A1A] flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Adicionar Flashcard Personalizado
            </h2>
            <p className="text-xs text-[#8E8A82]">
              Crie pérolas médicas ou conceitos essenciais para revisão no seu algoritmo de repetição espaçada.
            </p>
          </div>

          <form onSubmit={handleCreateManualCard} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#8E8A82]">Tema Relacionado</label>
                <select
                  value={manualTopicId}
                  onChange={e => setManualTopicId(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-[#E2E0D9] text-xs font-bold bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#8E8A82]">Tag / Conceito de Diagnóstico</label>
                <input
                  type="text"
                  value={manualConcept}
                  onChange={e => setManualConcept(e.target.value)}
                  placeholder="Ex: Conduta de 1ª linha, Citérios de Gravidade"
                  className="w-full h-12 px-4 rounded-xl border border-[#E2E0D9] text-xs font-medium bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-[#8E8A82]">Pergunta (Frente)</label>
              <textarea
                rows={3}
                value={manualFront}
                onChange={e => setManualFront(e.target.value)}
                placeholder="Ex: Qual a tríade clássica do TEP e qual o achado eletrocardiográfico mais específico?"
                className="w-full p-4 rounded-xl border border-[#E2E0D9] text-sm font-medium bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-[#8E8A82]">Resposta Médica Direta (Verso)</label>
              <textarea
                rows={3}
                value={manualBack}
                onChange={e => setManualBack(e.target.value)}
                placeholder="Ex: Tríade: dispneia, dor torácica pleurítica e hemoptise. ECG: S1Q3T3 (Padrão de McGinn-White)."
                className="w-full p-4 rounded-xl border border-[#E2E0D9] text-sm font-medium bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-[#E2E0D9]">
              <Button
                type="submit"
                disabled={isSavingManual}
                className="bg-[#1A1A1A] hover:bg-black text-white font-bold text-xs uppercase tracking-widest px-8 h-12 rounded-xl gap-2"
              >
                {isSavingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar Flashcard
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* SELECTION / FILTER DRAWER */}
      {isSelecting && activeTab !== 'create' && (
        <Card className="border-[#E2E0D9] p-8 rounded-3xl bg-[#FBFBFA] space-y-8">
          <div className="space-y-2">
            <h2 className="text-lg font-display font-black text-[#1A1A1A] flex items-center gap-2">
              {activeTab === 'diagnostic' ? (
                <>
                  <BarChart2 className="w-5 h-5 text-emerald-600" />
                  Selecione o Conteúdo para Diagnóstico de Domínio
                </>
              ) : (
                <>
                  <Filter className="w-5 h-5 text-primary" />
                  Selecione Matérias ou Temas Específicos
                </>
              )}
            </h2>
            <p className="text-xs text-[#8E8A82]">
              {activeTab === 'diagnostic'
                ? 'Sua sessão de diagnóstico irá avaliar seu conhecimento prático e gerar um relatório completo de lacunas.'
                : 'Escolha os módulos desejados para praticar ou gerar novos cards.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Grandes Matérias</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s, sIdx) => (
                  <Button
                    key={`fc-subj-${s.id}-${sIdx}`}
                    variant={selectedSubjectIds.includes(s.id) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleSubject(s.id)}
                    className="rounded-full text-[10px] uppercase tracking-widest font-bold h-9 border-[#E2E0D9]"
                  >
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Temas Específicos</label>
              <div className="flex flex-wrap gap-2 max-h-[220px] overflow-auto pr-2">
                {topics
                  .filter(t => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(t.subjectId))
                  .map((t, tIdx) => (
                    <Button
                      key={`fc-top-${t.id}-${tIdx}`}
                      variant={selectedTopicIds.includes(t.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleTopic(t.id)}
                      className="rounded-full text-[9px] uppercase tracking-widest font-bold h-8 border-dashed"
                    >
                      {t.title}
                    </Button>
                  ))}
              </div>
            </div>
          </div>

          {/* GENERATION & CREDIT PRICING PANEL */}
          {selectedTopicIds.length > 0 && (
            <div className="bg-[#FBFBFA] p-5 rounded-2xl border border-[#E2E0D9] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D9] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-black uppercase tracking-widest text-[#1A1A1A]">
                    Extração & Quantidade de Flashcards com IA
                  </span>
                </div>
                {availableCredits !== undefined && (
                  <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-900 font-bold text-[11px] gap-1 self-start sm:self-auto">
                    <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                    Seus Créditos: {availableCredits}
                  </Badge>
                )}
              </div>

              {/* TIER SELECTION & CREDIT PRICING */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PRESET OPTIONS */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#8E8A82]">1. Opções Rápidas Predefinidas:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { cards: 10, label: '10 Cards / Tema', cost: calculateFlashcardCreditCost(10 * selectedTopicIds.length) },
                      { cards: 20, label: '20 Cards / Tema', cost: calculateFlashcardCreditCost(20 * selectedTopicIds.length) },
                      { cards: 30, label: '30 Cards / Tema', cost: calculateFlashcardCreditCost(30 * selectedTopicIds.length) }
                    ].map(opt => (
                      <button
                        key={opt.cards}
                        type="button"
                        onClick={() => setNumCardsPerTopic(opt.cards)}
                        className={cn(
                          'px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border text-left flex flex-col gap-0.5',
                          numCardsPerTopic === opt.cards
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-white text-[#1A1A1A] border-[#E2E0D9] hover:bg-[#F5F4F0]'
                        )}
                      >
                        <span className="font-extrabold">{opt.label}</span>
                        <span className={cn('text-[10px] font-medium opacity-85', numCardsPerTopic === opt.cards ? 'text-white' : 'text-amber-800')}>
                          {opt.cost} crédito{opt.cost > 1 ? 's' : ''} total
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* SMART AI TOPIC COVERAGE ANALYZER */}
                <div className="space-y-2 bg-white p-3.5 rounded-xl border border-primary/20 shadow-2xs flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <BarChart2 className="w-4 h-4" />
                      <span>2. Extração Integral Analisada por IA</span>
                    </div>
                    <p className="text-[11px] text-[#8E8A82] leading-relaxed">
                      A IA lê a extensão médica do tema e calcula a quantidade exata de cards para 100% de cobertura.
                    </p>
                  </div>

                  <Button
                    onClick={handleAnalyzeTopicPotential}
                    disabled={isAnalyzingPotential}
                    variant="outline"
                    className="w-full bg-primary/5 hover:bg-primary/10 text-primary border-primary/30 font-bold text-xs uppercase tracking-wider h-10 rounded-lg gap-2 mt-2"
                  >
                    {isAnalyzingPotential ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analisando Conteúdo do Tema...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Analisar Cobertura Completa com IA
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* ACTION ROW */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#E2E0D9]">
                <div className="text-xs text-[#8E8A82] font-medium">
                  Total a gerar: <strong className="text-[#1A1A1A]">{selectedTopicIds.length * numCardsPerTopic} flashcards</strong> ({selectedTopicIds.length} tema{selectedTopicIds.length > 1 ? 's' : ''})
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    variant="outline"
                    className="w-full sm:w-auto border-primary/40 text-primary hover:bg-primary/5 font-bold text-xs uppercase tracking-widest h-12 px-6 rounded-xl gap-2 shadow-2xs"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />}
                    Gerar Rápido ({calculateFlashcardCreditCost(selectedTopicIds.length * numCardsPerTopic)} Créditos)
                  </Button>

                  <Button
                    onClick={() => fetchFlashcards(activeTab === 'diagnostic' ? 'diagnostic' : 'deck')}
                    className="w-full sm:w-auto bg-[#1A1A1A] hover:bg-black text-white text-xs uppercase tracking-widest font-black px-8 h-12 rounded-xl gap-2 shadow-md shrink-0"
                  >
                    {activeTab === 'diagnostic' ? 'Iniciar Diagnóstico' : 'Iniciar Revisão'}
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {selectedTopicIds.length === 0 && (
            <div className="flex items-center justify-end pt-4 border-t border-[#E2E0D9]">
              <Button
                onClick={() => fetchFlashcards(activeTab === 'diagnostic' ? 'diagnostic' : 'deck')}
                className="bg-[#1A1A1A] hover:bg-black text-white text-xs uppercase tracking-widest font-black px-8 h-12 rounded-xl gap-2 shadow-md"
              >
                {activeTab === 'diagnostic' ? 'Iniciar Diagnóstico de Domínio' : 'Iniciar Revisão de Flashcards'}
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* AI COVERAGE POTENTIAL ANALYSIS MODAL */}
      {showPotentialModal && potentialAnalysis && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <Card className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl border border-[#E2E0D9] relative animate-in zoom-in-95">
            <button
              onClick={() => setShowPotentialModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-[#8E8A82] transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-2 text-center">
              <Badge className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-primary/20">
                Análise de Cobertura de Conteúdo por IA
              </Badge>
              <h3 className="text-xl font-display font-black text-[#1A1A1A]">
                Extrator Integral de Flashcards
              </h3>
              <p className="text-xs text-[#8E8A82]">
                A IA analisou a extensão e a densidade médica deste tema para garantir 100% de cobertura:
              </p>
            </div>

            {/* RECOMMENDATION METRICS */}
            <div className="grid grid-cols-2 gap-3 bg-[#FBFBFA] p-4 rounded-2xl border border-[#E2E0D9]">
              <div className="text-center p-3.5 bg-white rounded-xl border border-[#E2E0D9] space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase font-extrabold text-[#8E8A82] tracking-wider block">Total Recomendado</span>
                <span className="text-3xl font-display font-black text-primary block">
                  {potentialAnalysis.estimatedIdealCards}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 block">Flashcards Médicos</span>
              </div>

              <div className="text-center p-3.5 bg-white rounded-xl border border-[#E2E0D9] space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase font-extrabold text-[#8E8A82] tracking-wider block">Custo em Créditos</span>
                <span className="text-3xl font-display font-black text-amber-600 block flex items-center justify-center gap-1">
                  <Zap className="w-5 h-5 text-amber-500 fill-amber-400" />
                  {potentialAnalysis.creditCost}
                </span>
                <span className="text-[10px] font-bold text-[#8E8A82] block">Tabela Transparente</span>
              </div>
            </div>

            {/* CONCEPTS MAPPED */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] block">
                Eixos Médicos Identificados no Tema:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {potentialAnalysis.coreMedicalConcepts.map((concept, idx) => (
                  <Badge key={idx} variant="outline" className="bg-slate-50 text-slate-700 text-[10px] font-bold px-2.5 py-1">
                    ✓ {concept}
                  </Badge>
                ))}
              </div>
            </div>

            {/* AI SUMMARY */}
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-1 text-xs text-[#1A1A1A] leading-relaxed">
              <span className="font-extrabold text-primary block text-[11px] uppercase tracking-wider">
                Parecer do Diretor Pedagógico:
              </span>
              <p className="text-[#1A1A1A] font-medium">{potentialAnalysis.analysisSummary}</p>
            </div>

            {/* ACTION BUTTONS */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={() => handleGenerateExtractedCards(potentialAnalysis.estimatedIdealCards, potentialAnalysis.creditCost)}
                disabled={isGenerating}
                className="w-full bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest h-12 rounded-xl gap-2 shadow-md"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Extrair Cobertura Completa ({potentialAnalysis.estimatedIdealCards} Cards - {potentialAnalysis.creditCost} Créditos)
              </Button>

              <Button
                onClick={() => setShowPotentialModal(false)}
                variant="ghost"
                className="w-full text-xs font-bold text-[#8E8A82] hover:bg-slate-100 h-9 rounded-lg"
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* SESSION COMPLETED SUMMARY / DIAGNOSTIC REPORT */}
      {sessionCompleted && (
        <Card className="border-[#E2E0D9] shadow-md rounded-3xl p-8 bg-white space-y-8 animate-in fade-in zoom-in-95">
          {activeTab === 'diagnostic' && diagnosticResult ? (
            <div className="space-y-8">
              {/* DIAGNOSTIC HEADER */}
              <div className="text-center space-y-4 border-b border-[#E2E0D9] pb-8">
                <Badge className="bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
                  Relatório de Diagnóstico de Domínio
                </Badge>
                <h2 className="text-4xl font-display font-black text-[#1A1A1A]">
                  Seu Domínio: <span className="text-primary">{diagnosticResult.scorePercent}%</span>
                </h2>
                <div className="inline-block px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider shadow-2xs mt-2">
                  <span className={cn('px-3 py-1 rounded-lg border font-black', diagnosticResult.levelColor)}>
                    {diagnosticResult.levelLabel}
                  </span>
                </div>
              </div>

              {/* METRICS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-2xl text-center space-y-1">
                  <div className="text-2xl font-display font-black text-emerald-700">{diagnosticResult.masteredCount}</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">Conceitos Dominados</div>
                </div>

                <div className="p-5 bg-amber-50/50 border border-amber-200 rounded-2xl text-center space-y-1">
                  <div className="text-2xl font-display font-black text-amber-700">{diagnosticResult.hardCount}</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800">Tenho Dúvidas / Difícil</div>
                </div>

                <div className="p-5 bg-rose-50/50 border border-rose-200 rounded-2xl text-center space-y-1">
                  <div className="text-2xl font-display font-black text-rose-700">{diagnosticResult.failedCount}</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-rose-800">Lacunas Críticas (Errei)</div>
                </div>
              </div>

              {/* WHAT TO STUDY ("O QUE PRECISA ESTUDAR") */}
              {(diagnosticResult.failedItems.length > 0 || diagnosticResult.hardItems.length > 0) && (
                <div className="space-y-4 bg-[#FBFBFA] p-6 rounded-2xl border border-[#E2E0D9]">
                  <h3 className="text-base font-display font-bold text-[#1A1A1A] flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-600" />
                    O que você precisa estudar (Lacunas Identificadas)
                  </h3>

                  <div className="space-y-3">
                    {diagnosticResult.failedItems.map((item, idx) => (
                      <div key={`fail-${idx}`} className="p-4 bg-white rounded-xl border border-rose-100 shadow-2xs space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                          <XCircle className="w-4 h-4 shrink-0" />
                          <span>{item.concept}</span>
                        </div>
                        <p className="text-xs text-[#1A1A1A] font-medium pl-6">{item.front}</p>
                        <p className="text-xs text-[#8E8A82] italic pl-6">R: {item.back}</p>
                      </div>
                    ))}

                    {diagnosticResult.hardItems.map((item, idx) => (
                      <div key={`hard-${idx}`} className="p-4 bg-white rounded-xl border border-amber-100 shadow-2xs space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{item.concept}</span>
                        </div>
                        <p className="text-xs text-[#1A1A1A] font-medium pl-6">{item.front}</p>
                        <p className="text-xs text-[#8E8A82] italic pl-6">R: {item.back}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI WRITTEN REPORT */}
              {isGeneratingDiagnosticReport ? (
                <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-center space-y-3">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    Gerando Recomendações e Cronograma Personalizado pela IA...
                  </p>
                </div>
              ) : diagnosticResult.aiReport ? (
                <div className="space-y-4 bg-gradient-to-br from-indigo-50/60 to-purple-50/60 p-6 rounded-2xl border border-indigo-100">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-900">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Análise Pedagógica da IA
                  </div>

                  <p className="text-sm font-bold text-indigo-950 italic">
                    "{diagnosticResult.aiReport.overallMasteryLevel}"
                  </p>

                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Plano de Estudo Imediato:</div>
                    <p className="text-xs text-stone-700 leading-relaxed bg-white/80 p-4 rounded-xl border border-indigo-100/60">
                      {diagnosticResult.aiReport.studyPlan}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Cronograma de Revisão Recomendado:</div>
                    <p className="text-xs text-stone-700 leading-relaxed bg-white/80 p-4 rounded-xl border border-indigo-100/60">
                      {diagnosticResult.aiReport.revisionSchedule}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* ACTION BUTTONS */}
              {scheduledSuccessMsg ? (
                <div className="p-4 bg-emerald-100/80 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>{scheduledSuccessMsg}</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-[#E2E0D9]">
                  <Button
                    onClick={handleScheduleDiagnosticReviews}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-widest h-14 rounded-2xl gap-2 shadow-lg shadow-emerald-700/20"
                  >
                    <Calendar className="w-4 h-4" />
                    Agendar Revisões Automáticas no Cronograma (24h, 7d, 30d)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setSessionCompleted(false);
                      fetchFlashcards('srs');
                    }}
                    className="h-14 px-8 border-[#E2E0D9] text-xs font-bold uppercase tracking-widest rounded-2xl"
                  >
                    Voltar ao Deck Geral
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* STANDARD SESSION COMPLETE */
            <div className="text-center space-y-6 py-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-display font-black text-[#1A1A1A]">Sessão Concluída!</h2>
                <p className="text-xs text-[#8E8A82]">
                  Você revisou {flashcards.length} flashcards nesta sessão. As datas de revisão foram atualizadas no seu algoritmo SM-2.
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 pt-4">
                <Button
                  onClick={() => {
                    setSessionCompleted(false);
                    fetchFlashcards('srs');
                  }}
                  className="bg-[#1A1A1A] hover:bg-black text-white font-bold text-xs uppercase tracking-widest px-8 h-12 rounded-xl gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Nova Sessão
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* FLASHCARD STUDY CANVAS */}
      {!isSelecting && activeTab !== 'create' && !sessionCompleted && flashcards.length > 0 && currentCard && (
        <div className="space-y-8">
          {/* PROGRESS BAR & INDEX */}
          <div className="flex items-center justify-between text-xs font-bold text-[#8E8A82] uppercase tracking-widest px-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>
                Card {currentIndex + 1} de {flashcards.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-[#E2E0D9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* FLIP CARD */}
          <div className="relative h-[420px] sm:h-[460px] perspective-1000 max-w-2xl mx-auto w-full">
            <motion.div
              className="w-full h-full relative preserve-3d cursor-pointer"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 240, damping: 22 }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* FRONT (PERGUNTA) */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-between p-8 sm:p-12 text-center border-[#E2E0D9] shadow-sm rounded-3xl bg-white hover:border-primary/40 transition-colors">
                <div className="w-full flex items-center justify-between text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82] border-b border-[#E2E0D9] pb-3">
                  <span>Pergunta</span>
                  {currentCard.concept && (
                    <Badge variant="outline" className="text-[9px] font-bold border-[#E2E0D9] text-[#8E8A82]">
                      {currentCard.concept}
                    </Badge>
                  )}
                </div>

                <div className="my-auto space-y-4">
                  <p className="text-xl sm:text-2xl font-display font-bold leading-relaxed text-[#1A1A1A]">
                    {currentCard.front}
                  </p>
                </div>

                <div className="w-full pt-4 border-t border-[#E2E0D9]/50 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold text-[#8E8A82]">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clique ou aperte Espaço para revelar
                </div>
              </Card>

              {/* BACK (RESPOSTA) */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-between p-8 sm:p-12 text-center border-none shadow-xl rounded-3xl [transform:rotateY(180deg)] bg-[#1A1A1A] text-white">
                <div className="w-full flex items-center justify-between text-[10px] uppercase tracking-widest font-extrabold text-white/50 border-b border-white/10 pb-3">
                  <span>Resposta Médica</span>
                  {currentCard.concept && (
                    <span className="text-[9px] font-bold text-white/60 uppercase">{currentCard.concept}</span>
                  )}
                </div>

                <div className="my-auto space-y-4">
                  <p className="text-lg sm:text-2xl font-display italic leading-relaxed text-white">
                    {currentCard.back}
                  </p>
                </div>

                <div className="w-full pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold text-white/40">
                  <Check className="w-3.5 h-3.5" />
                  Selecione seu nível de retenção abaixo
                </div>
              </Card>
            </motion.div>
          </div>

          {/* ACTIVE RECALL SRS RATING BUTTONS */}
          <div className="max-w-2xl mx-auto space-y-4">
            {isFlipped ? (
              <div className="space-y-3">
                <div className="text-center text-[10px] font-extrabold uppercase tracking-widest text-[#8E8A82]">
                  Como foi sua lembrança deste conceito?
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* ERREI */}
                  <Button
                    onClick={() => handleRateCard('errei')}
                    className="flex flex-col items-center justify-center h-16 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl space-y-1 transition-all shadow-2xs"
                  >
                    <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      Errei [1]
                    </span>
                    <span className="text-[10px] font-bold opacity-75">{currentCardSRS?.erreiInterval}</span>
                  </Button>

                  {/* DIFÍCIL */}
                  <Button
                    onClick={() => handleRateCard('dificil')}
                    className="flex flex-col items-center justify-center h-16 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-2xl space-y-1 transition-all shadow-2xs"
                  >
                    <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Difícil [2]
                    </span>
                    <span className="text-[10px] font-bold opacity-75">{currentCardSRS?.dificilInterval}</span>
                  </Button>

                  {/* BOM / ACERTEI */}
                  <Button
                    onClick={() => handleRateCard('bom')}
                    className="flex flex-col items-center justify-center h-16 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl space-y-1 transition-all shadow-2xs"
                  >
                    <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Bom [3]
                    </span>
                    <span className="text-[10px] font-bold opacity-75">{currentCardSRS?.bomInterval}</span>
                  </Button>

                  {/* FÁCIL */}
                  <Button
                    onClick={() => handleRateCard('facil')}
                    className="flex flex-col items-center justify-center h-16 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-2xl space-y-1 transition-all shadow-2xs"
                  >
                    <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      Fácil [4]
                    </span>
                    <span className="text-[10px] font-bold opacity-75">{currentCardSRS?.facilInterval}</span>
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setIsFlipped(true)}
                className="w-full bg-[#1A1A1A] hover:bg-black text-white font-bold text-xs uppercase tracking-widest h-14 rounded-2xl gap-2 shadow-sm"
              >
                Revelar Resposta (Espaço / Clique)
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}

            {/* NAV PREV / NEXT / SHUFFLE */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevCard}
                className="text-xs font-bold text-[#8E8A82] uppercase tracking-wider gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFlashcards([...flashcards].sort(() => Math.random() - 0.5))}
                className="text-xs font-bold text-[#8E8A82] uppercase tracking-wider gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Embaralhar
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={nextCard}
                className="text-xs font-bold text-[#8E8A82] uppercase tracking-wider gap-1"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* KEYBOARD SHORTCUTS LEGEND */}
            <div className="flex items-center justify-center gap-4 pt-2 text-[10px] font-extrabold uppercase tracking-widest text-[#8E8A82]">
              <span className="flex items-center gap-1">
                <Keyboard className="w-3 h-3 text-primary" /> Atrevamentos Teclado:
              </span>
              <span>[Espaço] Virar</span>
              <span>[1] Errei</span>
              <span>[2] Difícil</span>
              <span>[3] Bom</span>
              <span>[4] Fácil</span>
            </div>
          </div>
        </div>
      )}

      {/* NO CARDS FOUND EMPTY STATE */}
      {!isSelecting && activeTab !== 'create' && !loading && flashcards.length === 0 && (
        <Card className="border-2 border-dashed border-[#E2E0D9] p-12 text-center rounded-3xl bg-white space-y-6">
          <HelpCircle className="w-12 h-12 text-[#E2E0D9] mx-auto" />
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-lg font-display font-bold text-[#1A1A1A]">
              Nenhum flashcard encontrado para este filtro
            </h3>
            <p className="text-xs text-[#8E8A82]">
              {activeTab === 'srs'
                ? 'Você não possui nenhum flashcard acumulado para revisão hoje. Parabéns pela disciplina!'
                : 'Selecione matérias ou temas específicos para estudar ou gerar novos cards via IA.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              onClick={() => setIsSelecting(true)}
              className="bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold uppercase tracking-widest h-12 px-8 rounded-xl"
            >
              Escolher Temas / Gerar com IA
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
