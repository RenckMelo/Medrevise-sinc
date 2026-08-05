import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  ComposedChart,
} from 'recharts';
import { StudySession, Subject, MockExam } from '../types';
import { format, parseISO, subDays, isSameDay } from 'date-fns';
import { Award, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';

interface PerformanceStatsProps {
  sessions: StudySession[];
  subjects: Subject[];
  mockExams?: MockExam[];
}

export default function PerformanceStats({ sessions, subjects, mockExams = [] }: PerformanceStatsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'regular' | 'exams'>('regular');

  // REGULAR SESSION CALCULATIONS
  const last30DaysData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => subDays(new Date(), 29 - i));
    return days.map(day => {
      const daySessions = sessions.filter(s => isSameDay(parseISO(s.date), day));
      const totalQuestions = daySessions.reduce((acc, s) => acc + (s.questionsCount || 0), 0);
      const totalCorrect = daySessions.reduce((acc, s) => acc + (s.correctCount || 0), 0);
      const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
      
      return {
        date: format(day, 'dd/MM'),
        accuracy: Math.round(accuracy),
        questions: totalQuestions,
        time: daySessions.reduce((acc, s) => acc + (s.studyTimeMinutes || 0), 0)
      };
    });
  }, [sessions]);

  const subjectPerformance = useMemo(() => {
    return subjects.map(sub => {
      const subSessions = sessions.filter(s => s.subjectId === sub.id);
      const totalQuestions = subSessions.reduce((acc, s) => acc + (s.questionsCount || 0), 0);
      const totalCorrect = subSessions.reduce((acc, s) => acc + (s.correctCount || 0), 0);
      const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
      
      return {
        name: sub.name,
        accuracy: Math.round(accuracy),
        color: sub.color,
        sessions: subSessions.length
      };
    }).filter(s => s.sessions > 0);
  }, [sessions, subjects]);

  // SIMULADO EXPERIMENTAL CALCULATIONS
  const totalExamQuestions = useMemo(() => {
    return mockExams.reduce((acc, exam) => acc + (exam.totalQuestions || 0), 0);
  }, [mockExams]);

  const totalExamCorrect = useMemo(() => {
    return mockExams.reduce((acc, exam) => acc + (exam.correctAnswers || 0), 0);
  }, [mockExams]);

  const avgExamAccuracy = useMemo(() => {
    return totalExamQuestions > 0 ? Math.round((totalExamCorrect / totalExamQuestions) * 100) : 0;
  }, [totalExamQuestions, totalExamCorrect]);

  const mockExamTimelineData = useMemo(() => {
    return [...mockExams]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(exam => {
        const accuracy = exam.totalQuestions > 0 ? Math.round((exam.correctAnswers / exam.totalQuestions) * 100) : 0;
        return {
          title: exam.title,
          accuracy,
          questions: exam.totalQuestions,
          date: format(parseISO(exam.date), 'dd/MM')
        };
      });
  }, [mockExams]);

  const errorsSummary = useMemo(() => {
    let lackOfContent = 0;
    let carelessness = 0;
    let timePressure = 0;
    let misinterpretation = 0;

    mockExams.forEach(exam => {
      lackOfContent += exam.errorsByReason?.lackOfContent || 0;
      carelessness += exam.errorsByReason?.carelessness || 0;
      timePressure += exam.errorsByReason?.timePressure || 0;
      misinterpretation += exam.errorsByReason?.misinterpretation || 0;
    });

    const totalErrors = lackOfContent + carelessness + timePressure + misinterpretation;

    return [
      { name: 'Teoria/Falta de Conteúdo', value: lackOfContent, color: '#DC2626', pct: totalErrors > 0 ? Math.round((lackOfContent / totalErrors) * 100) : 0 },
      { name: 'Desatenção/Bobeira', value: carelessness, color: '#EA580C', pct: totalErrors > 0 ? Math.round((carelessness / totalErrors) * 100) : 0 },
      { name: 'Pressão de Tempo', value: timePressure, color: '#D97706', pct: totalErrors > 0 ? Math.round((timePressure / totalErrors) * 100) : 0 },
      { name: 'Má Interpretação de Enunciado', value: misinterpretation, color: '#2563EB', pct: totalErrors > 0 ? Math.round((misinterpretation / totalErrors) * 100) : 0 },
    ];
  }, [mockExams]);

  const examsSubjectPerformance = useMemo(() => {
    const performanceMap: Record<string, { total: number; correct: number }> = {};

    mockExams.forEach(exam => {
      exam.performanceBySubject?.forEach(sub => {
        const name = sub.subjectName;
        if (!performanceMap[name]) {
          performanceMap[name] = { total: 0, correct: 0 };
         }
         performanceMap[name].total += sub.total || 0;
         performanceMap[name].correct += sub.correct || 0;
      });
    });

    return Object.entries(performanceMap).map(([name, data]) => {
      const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
      
      // Try to find the exact subject code/color from standard subjects array
      const matchingSubject = subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
      
      return {
        name,
        total: data.total,
        correct: data.correct,
        accuracy,
        color: matchingSubject?.color || '#6366F1'
      };
    }).sort((a, b) => a.accuracy - b.accuracy); // Worst areas first
  }, [mockExams, subjects]);

  return (
    <div className="space-y-8">
      {/* Tab Navigation header */}
      <div className="flex border-b border-[#141414] pb-px gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('regular')}
          className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wider border-t border-x transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'regular'
              ? 'bg-white border-[#141414] font-bold text-[#141414] translate-y-px z-10'
              : 'bg-neutral-100 hover:bg-neutral-50 text-neutral-500 border-transparent'
          }`}
        >
          📈 Sessões Ordinárias
        </button>
        <button
          onClick={() => setActiveSubTab('exams')}
          className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wider border-t border-x transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'exams'
              ? 'bg-white border-[#141414] font-bold text-[#141414] translate-y-px z-10'
              : 'bg-neutral-100 hover:bg-neutral-50 text-neutral-500 border-transparent'
          }`}
        >
          🎯 Diagnóstico de Simulados ({mockExams.length})
        </button>
      </div>

      {activeSubTab === 'regular' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Accuracy Over Time */}
            <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2 border-b pb-3 border-neutral-150">
                <h3 className="font-serif italic text-xl">Precisão & Esforço (30 Dias)</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-[#141414]"></div>
                    <span className="text-[9px] font-mono uppercase text-neutral-600">Precisão (%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 bg-[#6366f1] opacity-65"></div>
                    <span className="text-[9px] font-mono uppercase text-neutral-600">Tempo (min)</span>
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={last30DaysData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.08} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 9, fontFamily: 'monospace' }} 
                      stroke="#141414"
                    />
                    <YAxis 
                      yAxisId="left"
                      orientation="left"
                      tick={{ fontSize: 9, fontFamily: 'monospace' }} 
                      stroke="#141414"
                      domain={[0, 100]}
                      label={{ value: 'Precisão (%)', angle: -90, position: 'insideLeft', style: { fontSize: '8px', fontFamily: 'monospace', fill: '#141414' } }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 9, fontFamily: 'monospace' }} 
                      stroke="#6366f1"
                      label={{ value: 'Tempo (min)', angle: 90, position: 'insideRight', style: { fontSize: '8px', fontFamily: 'monospace', fill: '#6366f1' } }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #141414',
                        fontFamily: 'monospace',
                        fontSize: '10px'
                      }}
                    />
                    <Bar 
                      yAxisId="right"
                      dataKey="time" 
                      name="Tempo (min)"
                      fill="#6366f1" 
                      opacity={0.4}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="accuracy" 
                      name="Precisão (%)"
                      stroke="#141414" 
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: '#141414' }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Subject Performance */}
            <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
              <h3 className="font-serif italic text-xl mb-6">Desempenho por Matéria</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.1} />
                    <XAxis 
                      type="number" 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                      stroke="#141414"
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                      stroke="#141414"
                      width={80}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #141414',
                        fontFamily: 'monospace',
                        fontSize: '10px'
                      }}
                    />
                    <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                      {subjectPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard 
              label="Total de Questões" 
              value={sessions.reduce((acc, s) => acc + (s.questionsCount || 0), 0)} 
            />
            <StatCard 
              label="Média de Acertos" 
              value={`${(() => {
                const total = sessions.reduce((acc, s) => acc + (s.questionsCount || 0), 0);
                const correct = sessions.reduce((acc, s) => acc + (s.correctCount || 0), 0);
                return total > 0 ? Math.round((correct / total) * 100) : 0;
              })()}%`} 
            />
            <StatCard 
              label="Tempo Total" 
              value={`${Math.round(sessions.reduce((acc, s) => acc + (s.studyTimeMinutes || 0), 0) / 60)}h`} 
            />
            <StatCard 
              label="Sessões" 
              value={sessions.length} 
            />
          </div>
        </>
      ) : (
        <>
          {mockExams.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-[#141414]/30 p-12 text-center rounded-none shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] max-w-xl mx-auto">
              <Award size={48} className="mx-auto text-[#141414]/30 mb-4" />
              <h3 className="font-serif italic text-xl text-neutral-800 mb-2">Nenhum Simulado Encontrado</h3>
              <p className="text-xs text-neutral-500 leading-relaxed mb-6">
                Para ter acesso aos diagnósticos avançados de erros, mapas de calor e evolução cronológica, registre os seus simulados na aba <strong>SIMULADOS</strong> do sistema.
              </p>
            </div>
          ) : (
            <>
              {/* Stats Panel */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard 
                  label="Simulados Realizados" 
                  value={mockExams.length} 
                />
                <StatCard 
                  label="Precisão em Simulados" 
                  value={`${avgExamAccuracy}%`} 
                />
                <StatCard 
                  label="Questões Respondidas" 
                  value={totalExamQuestions} 
                />
                <StatCard 
                  label="Tipo Predominante" 
                  value={
                    mockExams.filter(e => e.tag === 'Simulado').length >= mockExams.filter(e => e.tag === 'Prova Antiga').length
                      ? 'Simulado Completo'
                      : 'Prova Antiga'
                  } 
                />
              </div>

              {/* Advanced Graphs Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Evolution Trajectory */}
                <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
                  <h3 className="font-serif italic text-xl mb-1">Evolução de Acertos</h3>
                  <p className="font-mono text-[9px] text-neutral-400 uppercase tracking-wider mb-6">Sua margem de precisão em ordem cronológica de exames</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mockExamTimelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.1} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                          stroke="#141414"
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                          stroke="#141414"
                          domain={[0, 100]}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #141414',
                            fontFamily: 'monospace',
                            fontSize: '10px'
                          }}
                        />
                        <Line 
                          type="linear" 
                          dataKey="accuracy" 
                          stroke="#4F46E5" 
                          strokeWidth={2.5}
                          dot={{ r: 5, fill: '#4F46E5' }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Error Reasons Analysis */}
                <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
                  <h3 className="font-serif italic text-xl mb-1">Análise de Pontos Cego</h3>
                  <p className="font-mono text-[9px] text-neutral-400 uppercase tracking-wider mb-6">Qual a causa psicológica predominante de seus erros?</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={errorsSummary} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.1} />
                        <XAxis 
                          type="number" 
                          tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                          stroke="#141414"
                        />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          tick={{ fontSize: 9, fontFamily: 'sans-serif' }} 
                          stroke="#141414"
                          width={140}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #141414',
                            fontFamily: 'monospace',
                            fontSize: '10px'
                          }}
                        />
                        <Bar dataKey="value" name="Erros Registrados">
                          {errorsSummary.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Vulnerabilities Mapping */}
              <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-dashed border-[#141414]/15 mb-6 gap-2">
                  <div>
                    <h3 className="font-serif italic text-2xl flex items-center gap-2">
                      <AlertTriangle size={24} className="text-amber-500" />
                      Mapeamento de Vulnerabilidades em Simulados
                    </h3>
                    <p className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mt-1">Materiais que requerem revisão prioritária ativa (Pior para o Melhor)</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 font-mono text-[9px] px-3 py-1 flex items-center gap-1.5 uppercase leading-none rounded-none self-start">
                    <span>Foco de SRS Ativo Requerido</span>
                  </div>
                </div>

                {examsSubjectPerformance.length === 0 ? (
                  <p className="font-mono text-xs opacity-50 p-4 text-center">Inicie preenchendo o diagnóstico de acertos por matéria ao registrar novos simulados para mapear o calor de erros.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {examsSubjectPerformance.map((item, index) => {
                      const isVulnerable = item.accuracy < 70;
                      return (
                        <div key={item.name} className={`p-4 border ${isVulnerable ? 'bg-red-50/20 border-red-200' : 'bg-white border-neutral-200'} shadow-[3px_3px_0px_0px_rgba(20,20,20,0.05)] flex flex-col justify-between`}>
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <span className="font-serif italic text-base text-neutral-900 truncate" title={item.name}>{item.name}</span>
                            <span className="font-mono text-xs font-bold shrink-0">{item.correct}/{item.total} Qs</span>
                          </div>
                          
                          <div className="space-y-2 mt-4">
                            <div className="flex justify-between items-center text-[10px] font-mono uppercase">
                              <span className="opacity-60">Precisão:</span>
                              <span className={`font-bold ${isVulnerable ? 'text-red-700' : 'text-green-700'}`}>{item.accuracy}%</span>
                            </div>
                            <div className="w-full bg-neutral-100 h-2 border border-[#141414]/10 rounded-none overflow-hidden">
                              <div 
                                className="h-full transition-all" 
                                style={{ 
                                  width: `${item.accuracy}%`,
                                  backgroundColor: isVulnerable ? '#EF4444' : '#10B981'
                                }}
                              />
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-dashed border-[#141414]/10 flex items-center justify-between">
                            <span className="font-mono text-[8px] uppercase tracking-wider opacity-60">Status Prioritário:</span>
                            <span className={`font-mono text-[8.5px] font-bold px-1.5 py-0.5 border ${
                              isVulnerable 
                                ? 'bg-red-100 text-red-850 border-red-300' 
                                : 'bg-green-100 text-green-850 border-green-300'
                            }`}>
                              {isVulnerable ? '⚠️ ALTA PRIORIDADE' : '✅ SÓLIDO'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
      <span className="block font-mono text-[10px] uppercase opacity-50 mb-2">{label}</span>
      <span className="block font-serif italic text-2xl sm:text-3xl leading-tight truncate" title={String(value)}>{value}</span>
    </div>
  );
}
