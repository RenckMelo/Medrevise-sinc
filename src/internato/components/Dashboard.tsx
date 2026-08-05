import React, { useState, useEffect, useMemo } from 'react';
import { Subject, Topic, UserProgress, Semester, StudySession } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BookOpen, HelpCircle, Brain, Trophy, Clock, ChevronRight, BarChart3, Filter, Trash2, Calendar, AlertCircle, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { db, collection, query, orderBy, onSnapshot, doc, updateDoc } from '../firebase';
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
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = today - (7 * 24 * 60 * 60 * 1000);

    const attempts = Object.values(userProgress?.attempts || {});
    const sessions = userProgress?.studySessions || [];

    const todayAttempts = attempts.filter(a => new Date(a.timestamp).getTime() > today);
    const weekAttempts = attempts.filter(a => new Date(a.timestamp).getTime() > weekAgo);

    // Time per subject
    const timeBySubject: Record<string, number> = {};
    sessions.forEach(s => {
      timeBySubject[s.subjectId] = (timeBySubject[s.subjectId] || 0) + s.durationSeconds;
    });

    // Questions per subject
    const questionsBySubject: Record<string, number> = {};
    attempts.forEach(a => {
      const q = topics.find(t => t.id === a.questionId);
      if (q) {
        questionsBySubject[q.subjectId] = (questionsBySubject[q.subjectId] || 0) + 1;
      }
    });

    return {
      todayCount: todayAttempts.length,
      weekCount: weekAttempts.length,
      totalCount: attempts.length,
      timeBySubject,
      questionsBySubject,
      sessions: [...sessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    };
  }, [userProgress, topics]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!userProgress || !userId) return;
    const updatedSessions = userProgress.studySessions?.filter(s => s.id !== sessionId) || [];
    const sessionToDelete = userProgress.studySessions?.find(s => s.id === sessionId);
    
    const progressRef = doc(db, 'userProgress', userId);
    await updateDoc(progressRef, {
      studySessions: updatedSessions,
      totalStudyTimeSeconds: (userProgress.totalStudyTimeSeconds || 0) - (sessionToDelete?.durationSeconds || 0)
    });
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
          <p className="text-[#8E8A82] italic font-display text-sm lg:text-lg">Continue seus estudos de onde parou.</p>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="bg-[#141414] text-white border-none shadow-xl rounded-2xl p-4 lg:p-6">
          <div className="flex flex-col gap-2 lg:gap-4">
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-black opacity-60">Questões Hoje</div>
            <div className="text-2xl lg:text-4xl font-black">{stats.todayCount}</div>
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-bold opacity-60">Meta: 20</div>
          </div>
        </Card>
        <Card className="bg-white border-[#E2E0D9] shadow-none rounded-2xl p-4 lg:p-6">
          <div className="flex flex-col gap-2 lg:gap-4">
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Questões Semana</div>
            <div className="text-2xl lg:text-4xl font-black">{stats.weekCount}</div>
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-bold text-primary">Status: Em dia</div>
          </div>
        </Card>
        <Card className="bg-white border-[#E2E0D9] shadow-none rounded-2xl p-4 lg:p-6">
          <div className="flex flex-col gap-2 lg:gap-4">
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Tempo Total</div>
            <div className="text-2xl lg:text-4xl font-black">{formatTime(userProgress?.totalStudyTimeSeconds || 0)}</div>
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-bold text-[#8E8A82]">Foco: Medicina</div>
          </div>
        </Card>
        <Card className="bg-white border-[#E2E0D9] shadow-none rounded-2xl p-4 lg:p-6">
          <div className="flex flex-col gap-2 lg:gap-4">
            <div className="text-[9px] lg:text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Progresso</div>
            <div className="text-2xl lg:text-4xl font-black">{progressPercentage}%</div>
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
                {Object.keys(userProgress?.attempts || {}).length > 0 ? (
                  Object.values(userProgress!.attempts)
                    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 5)
                    .map((attempt: any, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => onSelectQuestion(attempt)}
                        className="flex items-center justify-between p-4 bg-white border border-[#E2E0D9] rounded-xl hover:border-primary cursor-pointer transition-all group w-full min-w-0 shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${attempt.isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {attempt.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold line-clamp-2 break-words overflow-hidden text-ellipsis pr-2 max-w-full leading-normal">{attempt.content || 'Questão do Simulado'}</div>
                            <div className="text-[9px] text-[#8E8A82] font-medium tracking-tight">
                              {attempt.timestamp ? new Date(attempt.timestamp).toLocaleDateString('pt-BR') : 'Recentemente'} • {attempt.isCorrect ? 'Acertou' : 'Errou'}
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
              <Calendar className="w-4 h-4 text-primary" /> Histórico de Sessões
            </h3>
            <Card className="border-[#E2E0D9] shadow-none rounded-2xl bg-[#FBFBFA] w-full min-w-0">
              <CardContent className="p-4 md:p-6 space-y-4 min-w-0">
                {stats.sessions.length > 0 ? (
                  stats.sessions.slice(0, 5).map(session => {
                    const subject = subjects.find(s => s.id === session.subjectId);
                    return (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-white border border-[#E2E0D9] rounded-xl hover:border-primary transition-all group w-full min-w-0 shadow-sm">
                        <div className="flex items-center gap-4 min-w-0 flex-1 mr-3">
                          <div className="w-10 h-10 rounded-lg bg-[#F0EEE9] flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                            <Clock className="w-4 h-4 text-[#8E8A82] group-hover:text-primary transition-colors" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold truncate pr-2 w-full">{subject?.name || 'Estudo Geral'}</div>
                            <div className="text-[9px] text-[#8E8A82] font-medium tracking-tight flex items-center gap-1.5 flex-wrap">
                              <span>{new Date(session.startTime).toLocaleDateString('pt-BR')} às {new Date(session.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="text-primary font-black uppercase tracking-tighter">{formatTime(session.durationSeconds)}</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                          className="text-[#8E8A82] hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0 shrink-0"
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
            <CardContent className="p-8 space-y-8">
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
