import React, { useState, useEffect, useMemo } from 'react';
import { Subject, Topic, UserProgress, Semester, StudySession } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BookOpen, HelpCircle, Brain, Trophy, Clock, ChevronRight, BarChart3, Filter, Trash2, Calendar, AlertCircle, CheckCircle2, XCircle, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { db, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from '../firebase';
import { cn } from '@/lib/utils';

interface DashboardProps {
  userProgress: UserProgress | null;
  subjects: Subject[];
  topics: Topic[];
  totalTopicsCount?: number;
  onSelectTopic: (topic: Topic) => void;
  onSelectQuestion: (attempt: any) => void;
  userId: string;
  onOpenTour?: () => void;
}

export default function Dashboard({ 
  userProgress, 
  subjects, 
  topics, 
  totalTopicsCount,
  onSelectTopic, 
  onSelectQuestion, 
  userId,
  onOpenTour
}: DashboardProps) {
  const [dbStudySessions, setDbStudySessions] = useState<any[]>([]);
  const [dbQuizAttempts, setDbQuizAttempts] = useState<any[]>([]);
  const [dbFlashcardSessions, setDbFlashcardSessions] = useState<any[]>([]);
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);

  // Real-time listener for studySessions and flashcardSessions
  useEffect(() => {
    if (!userId) return;
    try {
      const sessionsColl = collection(db, 'users', userId, 'studySessions');
      const unsubSessions = onSnapshot(sessionsColl, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d: any) => {
          list.push({ id: d.id, ...d.data() });
        });
        setDbStudySessions(list);
      }, (err) => {
        console.warn('Note on listening to user studySessions:', err);
      });

      const quizColl = collection(db, 'quizAttempts');
      const unsubQuiz = onSnapshot(quizColl, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d: any) => {
          const data = d.data();
          if (data.userId === userId) {
            list.push({ id: d.id, ...data });
          }
        });
        setDbQuizAttempts(list);
      }, (err) => {
        console.warn('Note on listening to quizAttempts:', err);
      });

      const flashcardSessColl = collection(db, 'users', userId, 'flashcardSessions');
      const unsubFlashcard = onSnapshot(flashcardSessColl, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d: any) => {
          list.push({ id: d.id, ...d.data() });
        });
        setDbFlashcardSessions(list);
      }, (err) => {
        console.warn('Note on listening to flashcardSessions:', err);
      });

      return () => {
        unsubSessions();
        unsubQuiz();
        unsubFlashcard();
      };
    } catch (e) {
      console.warn('Error setting up dashboard listeners:', e);
    }
  }, [userId]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const isDateToday = (dateStr?: string | Date | number) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };

  const isDateThisWeek = (dateStr?: string | Date | number) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
    return d.getTime() >= weekAgo;
  };

  const stats = useMemo(() => {
    const attempts = Object.values(userProgress?.attempts || {});
    
    // Merge attempts from quiz history if not present in attempts
    const allQuizAttempts = [...(userProgress?.quizHistory || []), ...dbQuizAttempts];
    const uniqueQuizAttemptsMap = new Map<string, any>();
    allQuizAttempts.forEach(q => {
      if (q.id) uniqueQuizAttemptsMap.set(q.id, q);
    });
    const mergedQuizAttempts = Array.from(uniqueQuizAttemptsMap.values());

    // 1. Calculate today questions
    let todayQuestionsCount = 0;
    const todayAttempts = attempts.filter(a => isDateToday(a.timestamp));
    todayQuestionsCount = todayAttempts.length;

    // Add quiz attempts from today if they had questions not individually in attempts
    let todayQuizQuestions = 0;
    mergedQuizAttempts.forEach(q => {
      if (isDateToday(q.timestamp)) {
        todayQuizQuestions += (q.totalQuestions || q.questions?.length || 0);
      }
    });

    // Add study sessions questions from today
    let todaySessionQuestions = 0;
    dbStudySessions.forEach(s => {
      if (isDateToday(s.date || s.startTime || s.createdAt)) {
        todaySessionQuestions += (Number(s.questionsCount) || 0);
      }
    });

    // Use the maximum reliable count for today
    const finalTodayCount = Math.max(todayQuestionsCount, todayQuizQuestions, todaySessionQuestions);

    // 2. Calculate week questions
    const weekAttempts = attempts.filter(a => isDateThisWeek(a.timestamp));
    let weekQuizQuestions = 0;
    mergedQuizAttempts.forEach(q => {
      if (isDateThisWeek(q.timestamp)) {
        weekQuizQuestions += (q.totalQuestions || q.questions?.length || 0);
      }
    });
    let weekSessionQuestions = 0;
    dbStudySessions.forEach(s => {
      if (isDateThisWeek(s.date || s.startTime || s.createdAt)) {
        weekSessionQuestions += (Number(s.questionsCount) || 0);
      }
    });
    const finalWeekCount = Math.max(weekAttempts.length, weekQuizQuestions, weekSessionQuestions);

    // 3. Calculate total study time
    let computedTimeSeconds = userProgress?.totalStudyTimeSeconds || 0;
    
    // Add time from dbStudySessions (convert minutes to seconds if not already accounted)
    let sessionsTimeSeconds = 0;
    dbStudySessions.forEach(s => {
      if (s.durationSeconds) {
        sessionsTimeSeconds += Number(s.durationSeconds);
      } else if (s.studyTimeMinutes) {
        sessionsTimeSeconds += Number(s.studyTimeMinutes) * 60;
      }
    });

    let quizTimeSeconds = 0;
    mergedQuizAttempts.forEach(q => {
      if (q.timeSpentSeconds) {
        quizTimeSeconds += Number(q.timeSpentSeconds);
      }
    });

    const finalTotalTimeSeconds = Math.max(computedTimeSeconds, sessionsTimeSeconds + quizTimeSeconds, computedTimeSeconds + sessionsTimeSeconds);

    // 4. Time per subject
    const timeBySubject: Record<string, number> = {};
    (userProgress?.studySessions || []).forEach(s => {
      if (s.subjectId) {
        timeBySubject[s.subjectId] = (timeBySubject[s.subjectId] || 0) + (s.durationSeconds || 0);
      }
    });
    dbStudySessions.forEach(s => {
      if (s.subjectId) {
        const secs = s.durationSeconds ? Number(s.durationSeconds) : (Number(s.studyTimeMinutes || 0) * 60);
        timeBySubject[s.subjectId] = (timeBySubject[s.subjectId] || 0) + secs;
      }
    });

    // 5. Questions per subject
    const questionsBySubject: Record<string, number> = {};
    attempts.forEach(a => {
      let subId = a.subjectId;
      if (!subId && a.questionId) {
        const q = topics.find(t => t.id === a.questionId);
        if (q) subId = q.subjectId;
      }
      if (subId) {
        questionsBySubject[subId] = (questionsBySubject[subId] || 0) + 1;
      }
    });

    // Merge sessions for display
    const formattedSessions: any[] = [];
    (userProgress?.studySessions || []).forEach(s => {
      formattedSessions.push({
        id: s.id,
        subjectId: s.subjectId,
        startTime: s.startTime,
        durationSeconds: s.durationSeconds,
        type: 'local'
      });
    });
    dbStudySessions.forEach(s => {
      formattedSessions.push({
        id: s.id,
        subjectId: s.subjectId,
        topicId: s.topicId,
        startTime: s.date || s.startTime || s.createdAt || new Date().toISOString(),
        durationSeconds: s.durationSeconds ? Number(s.durationSeconds) : (Number(s.studyTimeMinutes || 15) * 60),
        questionsCount: s.questionsCount,
        correctCount: s.correctCount,
        description: s.description,
        type: 'db'
      });
    });
    mergedQuizAttempts.forEach(q => {
      formattedSessions.push({
        id: q.id,
        subjectId: q.subjectIds?.[0] || 'geral',
        startTime: q.timestamp || new Date().toISOString(),
        durationSeconds: q.timeSpentSeconds || 120,
        questionsCount: q.totalQuestions || q.questions?.length,
        correctCount: q.score,
        description: q.type === 'simulado' ? `Simulado MedInternato (${q.score}/${q.totalQuestions || q.questions?.length})` : `Quiz MedInternato (${q.score}/${q.totalQuestions || q.questions?.length})`,
        type: 'quiz'
      });
    });

    // Deduplicate sessions by ID or approximate timestamp
    const uniqueSessionsMap = new Map<string, any>();
    formattedSessions.forEach(s => {
      if (s.id && !uniqueSessionsMap.has(s.id)) {
        uniqueSessionsMap.set(s.id, s);
      }
    });

    const mergedSortedSessions = Array.from(uniqueSessionsMap.values()).sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    // Question attempts list
    const allAttemptsList = [...attempts];
    mergedQuizAttempts.forEach(q => {
      if (Array.isArray(q.questions)) {
        q.questions.forEach((qa: any) => {
          if (qa && !allAttemptsList.some(ex => ex.questionId === qa.questionId && ex.timestamp === qa.timestamp)) {
            allAttemptsList.push(qa);
          }
        });
      }
    });

    // 6. Flashcards stats
    const srsKeysCount = Object.keys(userProgress?.flashcardReviews || {}).length;
    const sessionFlashcardSum = dbFlashcardSessions.reduce((acc, sess) => acc + (Number(sess.totalCards) || 0), 0);
    const studySessionFlashcards = dbStudySessions.reduce((acc, sess) => acc + (Number(sess.flashcardCount || sess.flashcardsCount) || 0), 0);
    const flashcardsTotalCount = Math.max(srsKeysCount, sessionFlashcardSum + studySessionFlashcards, srsKeysCount + studySessionFlashcards);

    let flashcardsTodayCount = 0;
    dbFlashcardSessions.forEach(sess => {
      if (isDateToday(sess.dateISO || sess.createdAt)) {
        flashcardsTodayCount += (Number(sess.totalCards) || 0);
      }
    });
    const srsReviewsMap = userProgress?.flashcardReviews || {};
    let srsTodayCount = 0;
    Object.values(srsReviewsMap).forEach((rev: any) => {
      if (rev && isDateToday(rev.lastReviewed)) {
        srsTodayCount++;
      }
    });
    flashcardsTodayCount = Math.max(flashcardsTodayCount, srsTodayCount);

    return {
      todayCount: finalTodayCount,
      weekCount: finalWeekCount,
      totalCount: Math.max(attempts.length, allAttemptsList.length),
      flashcardsTotalCount,
      flashcardsTodayCount,
      totalStudyTimeSeconds: finalTotalTimeSeconds,
      timeBySubject,
      questionsBySubject,
      sessions: mergedSortedSessions,
      recentAttempts: allAttemptsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    };
  }, [userProgress, topics, dbStudySessions, dbQuizAttempts, dbFlashcardSessions]);

  const handleDeleteSession = async (sessionItem: any) => {
    if (!userId) return;
    try {
      if (sessionItem.type === 'db') {
        const sRef = doc(db, 'users', userId, 'studySessions', sessionItem.id);
        await deleteDoc(sRef);
      } else if (sessionItem.type === 'quiz') {
        const qRef = doc(db, 'quizAttempts', sessionItem.id);
        await deleteDoc(qRef);
      }
      
      if (userProgress) {
        const updatedLocal = (userProgress.studySessions || []).filter(s => s.id !== sessionItem.id);
        const progressRef = doc(db, 'userProgress', userId);
        await updateDoc(progressRef, {
          studySessions: updatedLocal,
          totalStudyTimeSeconds: Math.max(0, (userProgress.totalStudyTimeSeconds || 0) - (sessionItem.durationSeconds || 0))
        });
      }
    } catch (e) {
      console.warn('Error removing session:', e);
    }
  };

  const totalTopics = totalTopicsCount || topics.length;
  const completedTopics = userProgress?.completedTopicIds?.length || 0;
  const progressPercentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <div className="space-y-6 lg:space-y-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="flex flex-col gap-2 text-center lg:text-left">
          <div className="text-[10px] lg:text-[11px] uppercase tracking-widest text-[#8E8A82] font-bold">Bem-vindo de volta</div>
          <h2 className="text-2xl lg:text-5xl font-display font-black">Seu Painel de Estudos</h2>
          <p className="text-[#8E8A82] italic font-display text-sm lg:text-lg">Continue seus estudos e acompanhe seu rendimento em tempo real.</p>
        </div>

        {onOpenTour && (
          <div className="flex justify-center lg:justify-end shrink-0">
            <Button
              onClick={onOpenTour}
              className="px-5 py-3 bg-white hover:bg-neutral-50 text-neutral-950 border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] active:translate-y-0.5 active:shadow-none font-bold text-xs uppercase tracking-wider gap-2 rounded-none cursor-pointer transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              Guia Passo a Passo
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
        <Card className="bg-[#141414] text-white border-none shadow-xl rounded-2xl p-4 lg:p-6">
          <div className="flex flex-col gap-2 lg:gap-4">
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-black opacity-60">Questões Hoje</div>
            <div className="text-2xl lg:text-4xl font-black text-amber-400">{stats.todayCount}</div>
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-bold opacity-60">Meta: 20 questões</div>
          </div>
        </Card>
        <Card className="bg-white border-[#E2E0D9] shadow-none rounded-2xl p-4 lg:p-6">
          <div className="flex flex-col gap-2 lg:gap-4">
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Questões Semana</div>
            <div className="text-2xl lg:text-4xl font-black text-[#1A1A1A]">{stats.weekCount}</div>
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-bold text-primary">Status: Em dia</div>
          </div>
        </Card>
        <Card className="bg-white border-[#E2E0D9] shadow-none rounded-2xl p-4 lg:p-6">
          <div className="flex flex-col gap-2 lg:gap-4">
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-black text-purple-700 flex items-center gap-1">
              <Brain className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              Flashcards Feitos
            </div>
            <div className="text-2xl lg:text-4xl font-black text-[#1A1A1A]">{stats.flashcardsTotalCount}</div>
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-bold text-purple-600 truncate">
              {stats.flashcardsTodayCount > 0 ? `${stats.flashcardsTodayCount} revisados hoje` : 'Repetição Espaçada'}
            </div>
          </div>
        </Card>
        <Card className="bg-white border-[#E2E0D9] shadow-none rounded-2xl p-4 lg:p-6">
          <div className="flex flex-col gap-2 lg:gap-4">
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Tempo Total</div>
            <div className="text-2xl lg:text-4xl font-black text-[#1A1A1A]">{formatTime(stats.totalStudyTimeSeconds)}</div>
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-bold text-[#8E8A82]">Foco: Medicina</div>
          </div>
        </Card>
        <Card className="bg-white border-[#E2E0D9] shadow-none rounded-2xl p-4 lg:p-6 col-span-2 lg:col-span-1">
          <div className="flex flex-col gap-2 lg:gap-4">
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Progresso</div>
            <div className="text-2xl lg:text-4xl font-black text-[#1A1A1A]">{progressPercentage}%</div>
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-bold text-[#8E8A82] truncate">{completedTopics} concluídos</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-12 w-full max-w-full min-w-0 overflow-hidden">
        <div className="lg:col-span-2 space-y-12 min-w-0 w-full overflow-hidden">
          {/* Question History */}
          <div className="space-y-6">
            <h3 className="text-sm uppercase tracking-widest font-black text-[#1A1A1A] flex items-center gap-3 border-b border-[#E2E0D9] pb-4">
              <HelpCircle className="w-4 h-4 text-primary" /> Histórico de Questões
            </h3>
            <Card className="border-[#E2E0D9] shadow-none rounded-2xl bg-[#FBFBFA] w-full min-w-0">
              <CardContent className="p-4 md:p-6 space-y-4 min-w-0">
                {stats.recentAttempts.length > 0 ? (
                  stats.recentAttempts
                    .slice(0, 6)
                    .map((attempt: any, idx) => (
                      <div 
                        key={`attempt-${attempt.questionId || idx}-${idx}`} 
                        onClick={() => onSelectQuestion(attempt)}
                        className="flex items-center justify-between p-4 bg-white border border-[#E2E0D9] rounded-xl hover:border-primary cursor-pointer transition-all group w-full min-w-0 shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${attempt.isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {attempt.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold line-clamp-2 break-words overflow-hidden text-ellipsis pr-2 max-w-full leading-normal">
                              {attempt.content || 'Questão Praticada'}
                            </div>
                            <div className="text-[9px] text-[#8E8A82] font-medium tracking-tight mt-0.5">
                              {attempt.timestamp ? new Date(attempt.timestamp).toLocaleDateString('pt-BR') : 'Recentemente'} • {attempt.isCorrect ? 'Acertou' : 'Errou'}
                              {attempt.timeSpentSeconds ? ` • ${Math.round(attempt.timeSpentSeconds)}s` : ''}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-[#E2E0D9] group-hover:text-primary group-hover:translate-x-1 shrink-0 transition-all" />
                      </div>
                    ))
                ) : (
                  <div className="text-center py-10 bg-[#FBFBFA] border border-[#E2E0D9] border-dashed rounded-xl">
                    <p className="text-[10px] text-[#8E8A82] italic">Nenhuma questão respondida recentemente.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Session History */}
          <div className="space-y-6">
            <h3 className="text-sm uppercase tracking-widest font-black text-[#1A1A1A] flex items-center gap-3 border-b border-[#E2E0D9] pb-4">
              <Calendar className="w-4 h-4 text-primary" /> Histórico de Sessões & Estudos
            </h3>
            <Card className="border-[#E2E0D9] shadow-none rounded-2xl bg-[#FBFBFA] w-full min-w-0">
              <CardContent className="p-4 md:p-6 space-y-4 min-w-0">
                {stats.sessions.length > 0 ? (
                  stats.sessions.slice(0, 6).map((session, sIdx) => {
                    const subject = subjects.find(s => s.id === session.subjectId);
                    const topic = topics.find(t => t.id === session.topicId);
                    const titleDisplay = session.description || topic?.title || subject?.name || 'Sessão de Estudos';

                    return (
                      <div key={`session-${session.id || sIdx}`} className="flex items-center justify-between p-4 bg-white border border-[#E2E0D9] rounded-xl hover:border-primary transition-all group w-full min-w-0 shadow-sm">
                        <div className="flex items-center gap-4 min-w-0 flex-1 mr-3">
                          <div className="w-10 h-10 rounded-lg bg-[#F0EEE9] flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                            <Clock className="w-4 h-4 text-[#8E8A82] group-hover:text-primary transition-colors" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold truncate pr-2 w-full text-[#1A1A1A]">
                              {titleDisplay}
                            </div>
                            <div className="text-[9px] text-[#8E8A82] font-medium tracking-tight flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span>
                                {session.startTime ? new Date(session.startTime).toLocaleDateString('pt-BR') : 'Hoje'} às {session.startTime ? new Date(session.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                              <span>•</span>
                              <span className="text-primary font-black uppercase tracking-tighter">
                                {formatTime(session.durationSeconds || 0)}
                              </span>
                              {session.questionsCount !== undefined && session.questionsCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-stone-700">
                                    {session.questionsCount} questões {session.correctCount !== undefined ? `(${session.correctCount} acertos)` : ''}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session);
                          }}
                          className="text-[#8E8A82] hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0 shrink-0"
                          title="Remover do histórico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 bg-white border border-dashed border-[#E2E0D9] rounded-xl">
                    <p className="text-[#8E8A82] italic font-display text-[10px]">Nenhuma sessão de estudo registrada ainda.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
      </div>

        <div className="space-y-8 min-w-0 w-full overflow-hidden">
           <h3 className="text-sm uppercase tracking-widest font-black text-[#1A1A1A] flex items-center gap-3 border-b border-[#E2E0D9] pb-4">
            <BarChart3 className="w-4 h-4 text-primary" /> Estudo por Matéria
          </h3>
          <Card className="border-[#E2E0D9] shadow-none rounded-2xl bg-[#FBFBFA]">
            <CardContent className="p-6 md:p-8 space-y-6 md:space-y-8">
              {subjects.slice(0, 6).map(subject => {
                const subjectTime = stats.timeBySubject[subject.id] || 0;
                const subjectQuestions = stats.questionsBySubject[subject.id] || 0;
                const isTopicInSub = (t: any) => t.subjectId === subject.id || (t.subjectId && subject.name && t.subjectId.toLowerCase().trim() === subject.name.toLowerCase().trim());
                const totalInSubject = topics.filter(isTopicInSub).length;
                const completedInSubject = topics.filter(t => isTopicInSub(t) && Boolean(userProgress?.completedTopicIds?.includes?.(t.id))).length;
                const percentage = totalInSubject > 0 ? (completedInSubject / totalInSubject) * 100 : 0;
                
                return (
                  <div key={subject.id} className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <div className="text-[11px] font-black uppercase tracking-widest text-[#1A1A1A]">{subject.name}</div>
                        <div className="flex items-center gap-3 text-[9px] uppercase tracking-tighter font-black text-[#8E8A82]">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(subjectTime)}</span>
                          <span className="flex items-center gap-1"><HelpCircle className="w-3 h-3" /> {subjectQuestions} q.</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-primary">{Math.round(percentage)}%</span>
                    </div>
                    <Progress value={percentage} className="h-1.5 bg-[#E2E0D9]" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
