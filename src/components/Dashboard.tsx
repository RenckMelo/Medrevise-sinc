import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, collection, query, onSnapshot, addDoc, doc, updateDoc } from '../firebase';
import { StudySession, MockExam, Topic } from '../types';
import { 
  startOfWeek, 
  startOfMonth, 
  isAfter, 
  parseISO, 
  format, 
  subDays,
  eachDayOfInterval
} from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line
} from 'recharts';
import { BarChart3, Clock, Target, TrendingUp, Award, Brain, Sparkles, Check, HelpCircle, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';
import { calculateNextReview } from '../utils/srs';

import { useStudyData } from '../hooks/useStudyData';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { subjects = [], topics = [], sessions = [], mockExams = [], loading } = useStudyData();

  // Active Revision States
  const [showQuickLogForm, setShowQuickLogForm] = useState(false);
  const [selectedQuickLogTopic, setSelectedQuickLogTopic] = useState<Topic | null>(null);
  const [questionsAnswered, setQuestionsAnswered] = useState('');
  const [correctAnswers, setCorrectAnswers] = useState('');
  const [studyTime, setStudyTime] = useState('30');
  const [rating, setRating] = useState<number>(4); // sm2 quality (0 to 5)
  const [savingQuickLog, setSavingQuickLog] = useState(false);
  const [quickLogSuccess, setQuickLogSuccess] = useState<string | null>(null);

  // Calculate topic retention
  const calculateTopicRetention = (topic: Topic) => {
    if (!topic.repetitions || topic.repetitions === 0 || !topic.lastReviewDate) {
      return {
        retentionPct: 100,
        daysSince: 0,
        status: 'Aguardando 1º Estudo',
        statusColor: 'text-neutral-500 bg-neutral-50 border-neutral-200',
        interval: 0
      };
    }
    const now = new Date();
    const baseDate = topic.lastReviewDate ? parseISO(topic.lastReviewDate) : parseISO(topic.createdAt);
    const diffTime = Math.max(0, now.getTime() - baseDate.getTime());
    const daysSince = diffTime / (1000 * 3600 * 24);
    
    const interval = topic.interval > 0 ? topic.interval : 1;
    // R = 0.9 ^ (t / I)
    const retention = Math.pow(0.9, daysSince / interval);
    const retentionPct = Math.min(100, Math.max(0, Math.round(retention * 100)));
    
    let status = '';
    let statusColor = '';
    
    if (retentionPct >= 80) {
      status = 'Excelente (Sólido)';
      statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (retentionPct >= 50) {
      status = 'Instável (Revisar em Breve)';
      statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
    } else {
      status = 'Esquecimento Crítico (Urgente)';
      statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
    }

    return {
      retentionPct,
      daysSince: Math.round(daysSince * 10) / 10,
      status,
      statusColor,
      interval
    };
  };

  const formattedTopics = topics
    .filter(topic => !topic.noMoreReviews && !topic.completed)
    .map(topic => {
      const ret = calculateTopicRetention(topic);
      const subject = subjects.find(s => s.id === topic.subjectId);
      return {
        ...topic,
        subjectName: subject ? subject.name : 'SEM MATÉRIA',
        retentionPct: ret.retentionPct,
        daysSince: ret.daysSince,
        status: ret.status,
        statusColor: ret.statusColor,
        interval: ret.interval
      };
    }).sort((a, b) => a.retentionPct - b.retentionPct);

  const hasRealTopics = formattedTopics.length > 0;
  const currentTopicToShow = hasRealTopics ? formattedTopics[0] : null;

  // Filter topics with insufficient performance (accuracy < 75%)
  const insufficientTopics = topics
    .filter(t => t.isInsufficient || (t.accuracyAfterStudy !== undefined && t.accuracyAfterStudy < 0.75) || (t.accuracyInSimulados !== undefined && t.accuracyInSimulados < 0.75))
    .map(t => {
      const subject = subjects.find(s => s.id === t.subjectId);
      return {
        ...t,
        subjectName: subject ? subject.name : 'SEM MATÉRIA'
      };
    });

  const topicToRender = selectedQuickLogTopic 
    ? {
        ...selectedQuickLogTopic,
        subjectName: (subjects.find(s => s.id === selectedQuickLogTopic.subjectId)?.name || 'SEM MATÉRIA'),
        ...calculateTopicRetention(selectedQuickLogTopic)
      }
    : currentTopicToShow;

  const handleQuickLog = async (topicId: string) => {
    if (!user) return;
    setSavingQuickLog(true);
    setQuickLogSuccess(null);
    try {
      const targetTopic = topics.find(t => t.id === topicId);
      if (!targetTopic) return;

      const questions = parseInt(questionsAnswered) || 0;
      const correct = parseInt(correctAnswers) || 0;
      const time = parseInt(studyTime) || 30;

      const srsUpdate = calculateNextReview(
        rating,
        targetTopic.repetitions || 0,
        targetTopic.interval || 0,
        targetTopic.easinessFactor || 2.5
      );

      const sessDate = new Date().toISOString();

      // Add session
      await addDoc(collection(db, 'users', user.uid, 'studySessions'), {
        topicId: targetTopic.id,
        subjectId: targetTopic.subjectId,
        date: sessDate,
        questionsCount: questions,
        correctCount: correct,
        studyTimeMinutes: time,
        description: 'Revisão Rápida efetuada via Ficha Dinâmica do Dashboard'
      });

      // Update topic with performance evaluation
      let isInsufficient = false;
      let accuracyField: any = {};

      if (questions > 0) {
        const accuracy = correct / questions;
        isInsufficient = accuracy < 0.75;
        accuracyField = {
          accuracyAfterStudy: accuracy,
          isInsufficient,
          insufficiencySource: isInsufficient ? 'pos_estudo' : undefined
        };
      } else {
        // If theory only, clear insufficiency if student evaluates recall quality as good (>= 3)
        if (rating >= 3) {
          accuracyField = {
            isInsufficient: false
          };
        }
      }

      await updateDoc(doc(db, 'users', user.uid, 'topics', targetTopic.id), {
        interval: srsUpdate.interval,
        easinessFactor: srsUpdate.ease,
        repetitions: srsUpdate.repetitions,
        nextReviewDate: srsUpdate.nextReviewDate,
        lastReviewDate: sessDate,
        wasRescheduledOverdue: false,
        completed: false,
        ...accuracyField
      });

      if (selectedQuickLogTopic && selectedQuickLogTopic.id === targetTopic.id) {
        setSelectedQuickLogTopic(null);
      }

      setQuickLogSuccess('Sessão de Revisão registrada com sucesso! Nível de fixação otimizado.');
      setShowQuickLogForm(false);
      
      // Clear inputs
      setQuestionsAnswered('');
      setCorrectAnswers('');
      setStudyTime('30');
    } catch (err) {
      console.error('Error logging quick review on dashboard:', err);
    } finally {
      setSavingQuickLog(false);
    }
  };

  const [consolidateExams, setConsolidateExams] = useState(() => {
    return localStorage.getItem('consolidateExams') === 'true';
  });

  const toggleConsolidateExams = (val: boolean) => {
    setConsolidateExams(val);
    localStorage.setItem('consolidateExams', String(val));
  };

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const stats = {
    week: sessions.filter(s => isAfter(parseISO(s.date), weekStart)),
    month: sessions.filter(s => isAfter(parseISO(s.date), monthStart)),
    total: sessions
  };

  const examStats = {
    week: mockExams.filter(e => isAfter(parseISO(e.date), weekStart)),
    month: mockExams.filter(e => isAfter(parseISO(e.date), monthStart)),
    total: mockExams
  };

  const calculateTotals = (sessionData: StudySession[], examData: MockExam[]) => {
    const sQuestions = sessionData.reduce((acc, s) => acc + s.questionsCount, 0);
    const eQuestions = consolidateExams ? examData.reduce((acc, e) => acc + (e.totalQuestions || 0), 0) : 0;
    const totalQuestions = sQuestions + eQuestions;

    const sCorrect = sessionData.reduce((acc, s) => acc + s.correctCount, 0);
    const eCorrect = consolidateExams ? examData.reduce((acc, e) => acc + (e.correctAnswers || 0), 0) : 0;
    const totalCorrect = sCorrect + eCorrect;

    const sTime = sessionData.reduce((acc, s) => acc + s.studyTimeMinutes, 0);
    const eTime = consolidateExams ? examData.reduce((acc, e) => acc + (e.timeSpentMinutes || 0), 0) : 0;
    const totalTime = sTime + eTime;

    return {
      questions: totalQuestions,
      correct: totalCorrect,
      time: totalTime,
      accuracy: totalQuestions > 0 ? (totalCorrect / totalQuestions * 100).toFixed(1) : 0
    };
  };

  const weekTotals = calculateTotals(stats.week, examStats.week);
  const monthTotals = calculateTotals(stats.month, examStats.month);
  const totalTotals = calculateTotals(stats.total, examStats.total);

  // Simulated exam stats calculations
  const totalSimuladosCount = mockExams.length;
  const totalSimuladoQuestions = mockExams.reduce((acc, exam) => acc + (exam.totalQuestions || 0), 0);
  const totalSimuladoCorrect = mockExams.reduce((acc, exam) => acc + (exam.correctAnswers || 0), 0);
  const avgSimuladoAccuracy = totalSimuladoQuestions > 0 
    ? ((totalSimuladoCorrect / totalSimuladoQuestions) * 105 / 105 * 100).toFixed(1) // Keep accuracy math correct
    : 0;

  // Chart data for last 30 days
  const last30Days = eachDayOfInterval({
    start: subDays(now, 29),
    end: now
  }).map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySessions = sessions.filter(s => s.date.startsWith(dateStr));
    const dayExams = consolidateExams ? mockExams.filter(e => e.date.startsWith(dateStr)) : [];
    return {
      name: format(date, 'dd/MM'),
      questions: daySessions.reduce((acc, s) => acc + s.questionsCount, 0) + dayExams.reduce((acc, e) => acc + (e.totalQuestions || 0), 0),
      time: daySessions.reduce((acc, s) => acc + s.studyTimeMinutes, 0) + dayExams.reduce((acc, e) => acc + (e.timeSpentMinutes || 0), 0),
    };
  });

  if (loading) return <div className="font-mono text-xs opacity-50">PROCESSANDO DADOS...</div>;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="mb-6 sm:mb-8">
        <h2 className="font-serif italic text-3xl sm:text-4xl text-[#141414]">Olá, {profile && profile.displayName ? profile.displayName.split(' ')[0] : 'Estudante'}</h2>
        <p className="font-mono text-[9px] sm:text-[10px] opacity-50 uppercase tracking-widest mt-2">
          {(sessions?.length || 0) > 0 
            ? `Você já completou ${sessions.length} sessões de estudo. Continue assim!`
            : 'Bem-vindo ao MedRevise. Vamos começar sua primeira sessão?'}
        </p>
      </div>

      {/* Metrics Union Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#141414] p-4 shadow-[3px_3px_0px_0px_rgba(20,20,20,1)]">
        <div>
          <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#141414]/50">Configurações de Indicadores</span>
          <h4 className="font-serif italic text-sm leading-tight text-[#141414]">Consolidação de Desempenho</h4>
          <p className="text-[10px] text-neutral-500 mt-1">Deseja unir o rendimento de simulados e provas antigas aos seus totais acumulados de estudo?</p>
        </div>
        <div className="inline-flex border border-[#141414] p-0.5 bg-[#E4E3E0]/20 shrink-0 self-start sm:self-center">
          <button 
            onClick={() => toggleConsolidateExams(false)}
            className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
              !consolidateExams ? 'bg-[#141414] text-white font-bold' : 'hover:bg-neutral-50 text-neutral-500'
            }`}
          >
            Apenas Estudos
          </button>
          <button 
            onClick={() => toggleConsolidateExams(true)}
            className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
              consolidateExams ? 'bg-[#141414] text-white font-bold' : 'hover:bg-[#141414]/5 text-neutral-500'
            }`}
          >
            Estudos + Simulados
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          title="ESTA SEMANA" 
          questions={weekTotals.questions} 
          time={weekTotals.time} 
          accuracy={Number(weekTotals.accuracy)}
          icon={<TrendingUp size={20} />}
        />
        <StatCard 
          title="ESTE MÊS" 
          questions={monthTotals.questions} 
          time={monthTotals.time} 
          accuracy={Number(monthTotals.accuracy)}
          icon={<BarChart3 size={20} />}
        />
        <StatCard 
          title="TOTAL ACUMULADO" 
          questions={totalTotals.questions} 
          time={totalTotals.time} 
          accuracy={Number(totalTotals.accuracy)}
          icon={<Target size={20} />}
        />
        <div className="bg-white border border-[#141414] p-4 sm:p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest opacity-50">SIMULADOS COMPILADOS</span>
            <div className="opacity-20"><Award size={20} /></div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <div className="text-2xl sm:text-3xl font-serif italic">{totalSimuladosCount}</div>
              <div className="text-[9px] sm:text-[10px] font-mono uppercase opacity-50">Exames Realizados</div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 sm:pt-4 border-t border-[#141414]/10">
              <div>
                <div className="text-base sm:text-lg font-mono font-bold">{totalSimuladoQuestions}</div>
                <div className="text-[7px] sm:text-[8px] font-mono uppercase opacity-50">Questões</div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-mono font-bold">{avgSimuladoAccuracy}%</div>
                <div className="text-[7px] sm:text-[8px] font-mono uppercase opacity-50">Precisão Média</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status de Retenção por Matéria */}
      <div className="bg-white border border-[#141414] p-5 sm:p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-dashed border-neutral-200">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 border border-indigo-200 text-[9px] font-mono uppercase font-bold text-indigo-700">
              <Brain size={12} className="text-indigo-650 shrink-0" />
              Sincronia Ebbinghaus Ativa
            </div>
            <h3 className="font-serif italic text-xl sm:text-2xl font-bold text-[#141414] mt-1.5">
              Status de Retenção por Matéria
            </h3>
            <p className="text-neutral-600 text-xs leading-relaxed font-sans mt-1">
              Cada sessão de revisão espaçada reinstala sua capacidade de lembrança em 100%. Abaixo listamos o status de retenção estimada e declínio de memória calculados para seus tópicos cadastrados com o algoritmo SM-2.
            </p>
          </div>
          <div className="shrink-0 bg-neutral-100 border border-[#141414] px-3.5 py-2 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] text-[#141414] text-right self-start sm:self-center">
            <span className="block font-mono text-[8px] uppercase tracking-wider text-neutral-400 font-bold">MÉTRICA GLOBAL DE MEMÓRIA</span>
            <span className="font-mono text-[9px] text-[#141414]/60 block mt-0.5">Retenção Estimada Geral:</span>
            <span className="font-mono font-bold text-xs text-[#141414] block mt-1 bg-white border border-[#141414] px-1 py-0.5 text-center">
              {hasRealTopics ? `${Math.round(formattedTopics.reduce((acc, t) => acc + t.retentionPct, 0) / formattedTopics.length)}% (Calibrado)` : 'Sem matérias ativas'}
            </span>
          </div>
        </div>

        {hasRealTopics ? (
          <div>
            <span className="font-mono text-[8px] uppercase tracking-wider text-neutral-400 block font-bold mb-3">
              Sua Curva de Esquecimento (Assuntos Críticos):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {formattedTopics.slice(0, 4).map((item, idx) => (
                <div key={item.id || `dash-topic-${idx}`} className="p-4 bg-neutral-50/50 border border-neutral-200/80 hover:border-neutral-300 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[8px] font-mono font-bold uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 py-0.5 truncate max-w-[120px]" title={item.subjectName}>
                        {item.subjectName}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[8.5px] font-mono font-bold shrink-0 ${
                        item.retentionPct < 40 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        item.retentionPct < 75 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-emerald-50 text-emerald-800 border border-emerald-250'
                      }`}>
                        {item.retentionPct}%
                      </span>
                    </div>
                    <h5 className="font-serif italic font-bold text-xs text-neutral-800 line-clamp-2 min-h-[32px]" title={item.name}>
                      {item.name}
                    </h5>
                  </div>

                  {/* Visual decay graph bar */}
                  <div className="space-y-1.5 pt-2 border-t border-dashed border-neutral-200">
                    <div className="w-full bg-neutral-200 h-2.5 relative border border-neutral-300">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          item.retentionPct < 40 ? 'bg-rose-500' :
                          item.retentionPct < 75 ? 'bg-amber-400' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${item.retentionPct}%` }}
                      />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] font-mono font-bold uppercase mix-blend-difference text-white">
                        {item.retentionPct < 40 ? 'Crítico' : item.retentionPct < 75 ? 'Alerta' : 'Estável'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 text-[8px] font-mono text-neutral-500">
                      <div className="flex justify-between">
                        <span>Último estudo:</span>
                        <span className="text-neutral-700 font-bold">{item.lastReviewDate ? `${item.daysSince === 0 ? 'Hoje' : `${Math.round(item.daysSince)} dias atrás`}` : 'Sem registro'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Intervalo SRS:</span>
                        <span className="text-neutral-700 font-bold">{item.interval}d</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-neutral-50 border border-dashed border-[#141414]/15 font-mono space-y-3 mt-2">
            <span className="font-bold text-neutral-700 block uppercase text-[10px]">💡 Cadastre seus tópicos de estudo!</span>
            <p className="text-[11px] leading-relaxed text-neutral-500">
              Você ainda não possui tópicos salvos no sistema. Vá no menu <strong>"Matérias & Editais"</strong> para cadastrar suas primeiras disciplinas e tópicos. 
            </p>
            <p className="text-[11px] leading-relaxed text-neutral-500">
              O algoritmo Ebbinghaus desenhará e calibrará sua curva de esquecimento automaticamente para otimizar suas repetições baseadas no método SM-2!
            </p>
          </div>
        )}
      </div>

      {/* Interactive Controls & Performance Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Side: Ficha Dinâmica de Revisão Card */}
        <div className="lg:col-span-5 bg-white border text-[#141414] border-[#141414] p-5 sm:p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between h-full min-h-[380px]">
          <div>
            <div className="flex items-center justify-between border-b pb-3 border-[#141414]/15">
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${hasRealTopics ? 'bg-indigo-600 animate-pulse' : 'bg-neutral-400'}`}></span>
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-neutral-450 font-bold">
                  Ficha Dinâmica de Revisão
                </span>
              </div>
            </div>
            
            {/* Subject Box Content */}
            <div className="space-y-3 mt-4">
              {topicToRender ? (
                // Real Topic Display
                <div className="space-y-3">
                  <div className="bg-indigo-50/50 p-3.5 border border-indigo-200 space-y-1">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-indigo-700 font-bold block">
                      MATÉRIA: {topicToRender.subjectName.toUpperCase()}
                    </span>
                    <span className="font-serif italic text-sm font-bold text-neutral-800 block leading-tight">
                      {topicToRender.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50/70 border border-emerald-100 p-2.5 text-center">
                      <span className="block font-mono text-[8px] text-neutral-400 uppercase">Último Estudo</span>
                      <span className="block font-mono text-[9px] font-bold text-emerald-800 mt-0.5 truncate">
                        {topicToRender.lastReviewDate 
                          ? `${topicToRender.daysSince === 0 ? 'Hoje' : `Há ${Math.round(topicToRender.daysSince)} d`}`
                          : 'Nenhum'
                        }
                      </span>
                    </div>
                    <div className={`p-2.5 text-center ${topicToRender.retentionPct < 55 ? 'bg-amber-50 border border-amber-200 animate-pulse' : 'bg-neutral-50 border border-neutral-100'}`}>
                      <span className="block font-mono text-[8px] text-neutral-400 uppercase">Intervalo Atual</span>
                      <span className="block font-mono text-[9px] font-bold text-amber-900 mt-0.5">
                        {topicToRender.interval === 0 ? 'Imediato (D+0)' : `${topicToRender.interval} d`}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-neutral-50/80 border border-neutral-150 space-y-1.5">
                    <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                      <span>Chance de Acerto (Retenção)</span>
                      <span className={`font-bold ${
                        topicToRender.retentionPct < 40 ? 'text-rose-600' :
                        topicToRender.retentionPct < 70 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {topicToRender.retentionPct < 40 ? 'Crítico: ' : ''}{topicToRender.retentionPct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-200 rounded-none overflow-hidden border border-[#141414]/5">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          topicToRender.retentionPct < 40 ? 'bg-rose-500' :
                          topicToRender.retentionPct < 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${topicToRender.retentionPct}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : (
                // Empty state for active review card
                <div className="p-4 bg-neutral-50 border border-dashed border-neutral-200 text-center space-y-2">
                  <span className="block font-mono text-[10px] text-neutral-400 uppercase font-bold">Fila de Revisões Vazia</span>
                  <p className="text-[10px] font-mono text-neutral-400">Adicione assuntos no menu "Matérias & Editais" e estude-os para iniciar a memorização científica de longo prazo.</p>
                </div>
              )}
            </div>
          </div>

          {/* Simulated success or error alerts */}
          {quickLogSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-950 border border-emerald-300 text-[10.5px] font-mono flex items-start gap-1.5 my-2">
              <Check size={14} className="shrink-0 text-emerald-600 mt-0.5" />
              <span>{quickLogSuccess}</span>
            </div>
          )}

          {/* Inline Quick Action Panel */}
          <div className="pt-2">
            {/* Form real topic log */}
            {showQuickLogForm && topicToRender && (
              <div className="p-3 border border-[#141414] bg-neutral-50 space-y-3.5 mb-2">
                <span className="text-[9px] font-mono font-bold block border-b pb-1 uppercase border-[#141414]/10">Registrar Revisão Rápida</span>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[8px] font-mono text-neutral-400 uppercase mb-1">Questões</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={questionsAnswered}
                      onChange={e => setQuestionsAnswered(e.target.value)}
                      className="w-full p-1 bg-white border border-[#141414] text-[10px] font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-mono text-neutral-400 uppercase mb-1">Acertos</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={correctAnswers}
                      onChange={e => setCorrectAnswers(e.target.value)}
                      className="w-full p-1 bg-white border border-[#141414] text-[10px] font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-mono text-neutral-400 uppercase mb-1">Duração (m)</label>
                    <input 
                      type="number"
                      value={studyTime}
                      onChange={e => setStudyTime(e.target.value)}
                      className="w-full p-1 bg-white border border-[#141414] text-[10px] font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Rating selection (0-5 stars) */}
                <div className="space-y-1">
                  <label className="block text-[8px] font-mono text-neutral-400 uppercase">Qualidade do Recall</label>
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setRating(score)}
                        className={`px-1.5 py-1 text-[8.5px] font-mono border cursor-pointer ${
                          rating === score ? 'bg-[#141414] text-white border-neutral-900 font-bold' : 'bg-white text-neutral-600 border-[#141414]/10 hover:border-neutral-400'
                        }`}
                      >
                        {score === 1 && '1'}
                        {score === 2 && '2'}
                        {score === 3 && '3'}
                        {score === 4 && '4'}
                        {score === 5 && '5'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLog(topicToRender.id)}
                    disabled={savingQuickLog}
                    className="flex-1 py-1.5 px-2 text-[9px] font-mono bg-[#141414] border border-[#141414] text-white font-bold uppercase hover:bg-neutral-800 disabled:opacity-50 cursor-pointer text-center text-xs"
                  >
                    {savingQuickLog ? 'Salvando...' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowQuickLogForm(false); setSelectedQuickLogTopic(null); }}
                    className="py-1.5 px-2 text-[9px] font-mono bg-white border border-neutral-300 hover:border-neutral-400 cursor-pointer text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Activation Buttons */}
            {topicToRender ? (
              !showQuickLogForm && (
                <div className="flex flex-col gap-2">
                  <button 
                    type="button"
                    onClick={() => { setShowQuickLogForm(true); setQuickLogSuccess(null); }}
                    className="w-full py-3 bg-[#141414] hover:bg-neutral-850 text-white font-mono text-[10px] uppercase font-bold tracking-widest text-center cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles size={12} className="text-[#E4E3E0] animate-pulse" />
                    Registrar Revisão Rápida
                  </button>
                  {selectedQuickLogTopic && (
                    <button
                      type="button"
                      onClick={() => setSelectedQuickLogTopic(null)}
                      className="w-full py-1 text-neutral-500 font-mono text-[9px] hover:text-neutral-700 text-center"
                    >
                      Voltar para Próximo do Fluxo
                    </button>
                  )}
                </div>
              )
            ) : (
              <div className="p-3 bg-neutral-50/50 border border-neutral-200 text-center text-[10px] font-mono uppercase text-neutral-400">
                Sem revisões urgentes ativas
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Analytical Performance Chart Section */}
        <div className="lg:col-span-7 bg-white border border-[#141414] p-5 sm:p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between h-full min-h-[380px]">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b pb-3 border-[#141414]/15 gap-2">
              <h3 className="font-serif italic text-lg sm:text-xl font-bold">Evolução de 30 Dias</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 bg-[#14141480] border border-[#141414]"></div>
                  <span className="text-[9px] font-mono uppercase text-neutral-600">Questões</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-0.5 bg-[#6366f1]"></div>
                  <span className="text-[9px] font-mono uppercase text-neutral-600">Tempo (min)</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="h-[230px] sm:h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={last30Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#14141410" />
                <XAxis 
                  dataKey="name" 
                  axisLine={{ stroke: '#141414' }} 
                  tickLine={false}
                  tick={{ fontSize: 9, fontFamily: 'monospace' }}
                />
                <YAxis 
                  yAxisId="left"
                  orientation="left"
                  stroke="#141414"
                  axisLine={{ stroke: '#141414' }} 
                  tickLine={false}
                  tick={{ fontSize: 9, fontFamily: 'monospace' }}
                  label={{ value: 'Questões', angle: -90, position: 'insideLeft', style: { fontSize: '8px', fontFamily: 'monospace', fill: '#141414' } }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#6366f1"
                  axisLine={{ stroke: '#6366f1' }} 
                  tickLine={false}
                  tick={{ fontSize: 9, fontFamily: 'monospace' }}
                  label={{ value: 'Tempo (min)', angle: 95, position: 'insideRight', style: { fontSize: '8px', fontFamily: 'monospace', fill: '#6366f1' } }}
                />
                <Tooltip 
                  cursor={{ fill: '#14141405' }}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #141414',
                    borderRadius: '0px',
                    fontFamily: 'monospace',
                    fontSize: '10px'
                  }}
                />
                <Bar yAxisId="left" dataKey="questions" name="Questões" fill="#14141480">
                  {last30Days.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 29 ? '#141414' : '#14141480'} />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="time"
                  name="Tempo Estudado"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 1 }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Recovery Section (Tópicos com Rendimento Deficitário) */}
      {insufficientTopics.length > 0 && (
        <div id="recovery-panel" className="bg-rose-50 border-2 border-[#141414] p-5 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] text-[#141414] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#141414]/15 pb-2">
            <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white font-bold leading-none">!</span>
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[#141414]">
              Rendimento Deficitário Detectado (Algoritmo de Recuperação)
            </h3>
          </div>
          <p className="text-[11px] font-sans text-neutral-600 leading-relaxed">
            Os seguintes tópicos apresentaram aproveitamento inferior a <strong className="text-rose-700">75%</strong> em suas revisões ou simulados de fixação. 
            O algoritmo adicionou revisões prioritárias adicionais automaticamente para consolidar o aprendizado e recuperar suas falhas. 
            Clique em <strong>Revisar</strong> para focar no assunto agora.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insufficientTopics.map((topic) => {
              const accuracy = topic.accuracyAfterStudy !== undefined
                ? (topic.accuracyAfterStudy * 100).toFixed(0) + '%'
                : topic.accuracyInSimulados !== undefined
                ? (topic.accuracyInSimulados * 100).toFixed(0) + '%'
                : 'N/A';
                
              const reason = topic.insufficiencyReason || (topic.accuracyAfterStudy !== undefined ? 'Aproveitamento pós-estudo baixo' : 'Rendimento deficitário em simulado');

              return (
                <div key={topic.id} className="bg-white border border-[#141414] p-3.5 flex flex-col justify-between hover:shadow-[3px_3px_0px_0px_rgba(220,38,38,1)] hover:border-rose-600 transition-all">
                  <div>
                    <span className="block font-mono text-[8px] uppercase font-bold text-rose-800 tracking-wider">
                      {topic.subjectName}
                    </span>
                    <h4 className="font-serif italic font-bold text-sm text-neutral-900 mt-1">
                      {topic.name}
                    </h4>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                        <span>Aproveitamento:</span>
                        <span className="font-bold text-rose-700">{accuracy}</span>
                      </div>
                      <div className="text-[9px] font-mono italic text-rose-600 leading-tight">
                        {reason}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedQuickLogTopic(topic);
                      setShowQuickLogForm(true);
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className="w-full mt-3 py-1.5 bg-[#141414] hover:bg-neutral-800 text-white font-mono text-[10px] uppercase font-bold tracking-wider cursor-pointer text-center border border-[#141414]"
                  >
                    Revisar Tema
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Study Sessions Left Column */}
        <div className="bg-white border border-[#141414] overflow-hidden">
          <div className="p-4 border-b border-[#141414] bg-[#141414]/5 flex items-center justify-between">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest">Últimas Sessões de Estudo</h3>
            <span className="text-[10px] font-mono opacity-50 bg-white border border-[#141414] px-1.5 py-0.5 uppercase">Ativas/Srs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#141414]">
                  <th className="p-4 font-serif italic text-xs font-normal">Data</th>
                  <th className="p-4 font-serif italic text-xs font-normal">Questões</th>
                  <th className="p-4 font-serif italic text-xs font-normal">Acertos</th>
                  <th className="p-4 font-serif italic text-xs font-normal">Tempo</th>
                  <th className="p-4 font-serif italic text-xs font-normal">Precisão</th>
                </tr>
              </thead>
              <tbody>
                {(sessions || []).slice(0, 5).map((s) => (
                  <tr key={s.id} className="border-b border-[#141414]/10 hover:bg-[#141414]/5 transition-colors">
                    <td className="p-4 font-mono text-[10px]">{s.date ? format(parseISO(s.date), 'dd/MM/yyyy HH:mm') : 'N/A'}</td>
                    <td className="p-4 font-mono text-[10px]">{s.questionsCount || 0}</td>
                    <td className="p-4 font-mono text-[10px]">{s.correctCount || 0}</td>
                    <td className="p-4 font-mono text-[10px]">{s.studyTimeMinutes || 0}m</td>
                    <td className="p-4 font-mono text-[10px] font-bold">
                      {(s.questionsCount || 0) > 0 ? (((s.correctCount || 0) / s.questionsCount) * 100).toFixed(0) : 0}%
                    </td>
                  </tr>
                ))}
                {(!sessions || sessions.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center font-mono text-[10px] opacity-50">
                      NENHUMA SESSÃO REGISTRADA AINDA.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Similar Dashboard Mock Exams Right Column */}
        <div className="bg-white border border-[#141414] overflow-hidden">
          <div className="p-4 border-b border-[#141414] bg-[#141414]/5 flex items-center justify-between">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest">Últimos Simulados e Provas</h3>
            <span className="text-[10px] font-mono opacity-50 bg-white border border-[#141414] px-1.5 py-0.5 uppercase">Exames</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#141414]">
                  <th className="p-4 font-serif italic text-xs font-normal">Exame / Título</th>
                  <th className="p-4 font-serif italic text-xs font-normal">Data</th>
                  <th className="p-4 font-serif italic text-xs font-normal">Questões</th>
                  <th className="p-4 font-serif italic text-xs font-normal">Tag</th>
                  <th className="p-4 font-serif italic text-xs font-normal">Desempenho</th>
                </tr>
              </thead>
              <tbody>
                {(mockExams || []).slice(0, 5).map((exam) => {
                  const accuracy = exam.totalQuestions > 0 
                    ? ((exam.correctAnswers / exam.totalQuestions) * 100).toFixed(0) 
                    : 0;
                  return (
                    <tr key={exam.id} className="border-b border-[#141414]/10 hover:bg-[#141414]/5 transition-colors">
                      <td className="p-4 font-sans text-[10px] font-medium truncate max-w-[120px]" title={exam.title}>{exam.title}</td>
                      <td className="p-4 font-mono text-[10px]">{exam.date ? format(parseISO(exam.date), 'dd/MM/yyyy') : 'N/A'}</td>
                      <td className="p-4 font-mono text-[10px]">{exam.correctAnswers}/{exam.totalQuestions}</td>
                      <td className="p-4 font-mono text-[9px]">
                        <span className={`px-1.5 py-0.5 border text-[8px] tracking-tight uppercase ${
                          exam.tag === 'Simulado' ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white border-neutral-300'
                        }`}>
                          {exam.tag}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[10px] font-bold">
                        <span className={Number(accuracy) >= 70 ? 'text-green-700' : Number(accuracy) >= 50 ? 'text-amber-700' : 'text-red-700'}>
                          {accuracy}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(!mockExams || mockExams.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center font-mono text-[10px] opacity-50">
                      NENHUM SIMULADO REGISTRADO AINDA.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, questions, time, accuracy, icon }: { title: string, questions: number, time: number, accuracy: number, icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#141414] p-4 sm:p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest opacity-50">{title}</span>
        <div className="opacity-20">{icon}</div>
      </div>
      <div className="space-y-3 sm:space-y-4">
        <div>
          <div className="text-2xl sm:text-3xl font-serif italic">{questions}</div>
          <div className="text-[9px] sm:text-[10px] font-mono uppercase opacity-50">Questões Resolvidas</div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-3 sm:pt-4 border-t border-[#141414]/10">
          <div>
            <div className="text-base sm:text-lg font-mono font-bold">{Math.floor(time / 60)}h {time % 60}m</div>
            <div className="text-[7px] sm:text-[8px] font-mono uppercase opacity-50">Tempo de Estudo</div>
          </div>
          <div>
            <div className="text-base sm:text-lg font-mono font-bold">{accuracy}%</div>
            <div className="text-[7px] sm:text-[8px] font-mono uppercase opacity-50">Precisão Média</div>
          </div>
        </div>
      </div>
    </div>
  );
}
