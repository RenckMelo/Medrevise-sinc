import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, collection, query, onSnapshot, addDoc, deleteDoc, doc, orderBy, updateDoc } from '../firebase';
import { MockExam } from '../types';
import { useStudyData } from '../hooks/useStudyData';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import UpgradeModal from './UpgradeModal';
import ReactMarkdown from 'react-markdown';
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Brain, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Sparkles, 
  Activity,
  AlertCircle
} from 'lucide-react';
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
  Cell 
} from 'recharts';

export default function ExamsView() {
  const { user, profile } = useAuth();
  const { subjects, topics, loading: studyDataLoading } = useStudyData();
  const [exams, setExams] = useState<MockExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [analyzingExamId, setAnalyzingExamId] = useState<string | null>(null);

  // Freemium check states
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [totalQuestions, setTotalQuestions] = useState(50);
  const [correctAnswers, setCorrectAnswers] = useState(35);
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(120);
  const [tag, setTag] = useState<'Simulado' | 'Prova Antiga'>('Simulado');
  const [conditions, setConditions] = useState<'Simulado Real' | 'Estudo/Treino'>('Simulado Real');
  const [notes, setNotes] = useState('');
  
  // Metacognitive failure analysis fields
  const [lackOfContent, setLackOfContent] = useState(0);
  const [carelessness, setCarelessness] = useState(0);
  const [timePressure, setTimePressure] = useState(0);
  const [misinterpretation, setMisinterpretation] = useState(0);

  // Per-subject performance breakdown inside current form
  const [subjectBreakdowns, setSubjectBreakdowns] = useState<{ subjectName: string; total: number; correct: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'mockExams'), 
      orderBy('date', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as MockExam)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/mockExams`);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  // Sync subject dropdowns whenever form opens
  useEffect(() => {
    if (showAddForm) {
      // Pre-populate breakdowns based on current subjects if not already custom
      if (subjectBreakdowns.length === 0 && subjects.length > 0) {
        setSubjectBreakdowns(
          subjects.map(sub => ({
            subjectName: sub.name,
            total: 0,
            correct: 0
          }))
        );
      }
    }
  }, [showAddForm, subjects]);

  const handleSubjectScoreChange = (index: number, field: 'total' | 'correct', val: number) => {
    const updated = [...subjectBreakdowns];
    updated[index] = {
      ...updated[index],
      [field]: val
    };
    setSubjectBreakdowns(updated);
  };

  const addExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    const isPremiumUser = profile?.isPremium || profile?.email === 'lucas1renck2melo@gmail.com';
    if (!isPremiumUser && exams.length >= 1) {
      setUpgradeReason('No plano Gratuito, você pode registrar 1 simulado histórico completo. Desbloqueie o MedRevise Pro para ter simulados ilimitados, análise aprofundada de erros cognitivos e gráficos históricos de desempenho!');
      setIsUpgradeModalOpen(true);
      return;
    }

    // Clean performance breakdown to save only active entries
    const performanceToSave = subjectBreakdowns.filter(item => item.total > 0);

    const payload: Omit<MockExam, 'id'> = {
      title,
      date: new Date(date + 'T12:00:00').toISOString(),
      totalQuestions: Number(totalQuestions),
      correctAnswers: Number(correctAnswers),
      timeSpentMinutes: Number(timeSpentMinutes),
      tag,
      conditions,
      notes,
      errorsByReason: {
        lackOfContent: Number(lackOfContent),
        carelessness: Number(carelessness),
        timePressure: Number(timePressure),
        misinterpretation: Number(misinterpretation)
      },
      performanceBySubject: performanceToSave
    };

    try {
      await addDoc(collection(db, 'users', user.uid, 'mockExams'), payload);
      
      // FAILURE RECOVERY ALGORITHM:
      // Loop through each performanceToSave item.
      // If a subject's correctness is below 75%, identify all topics belonging to that subject.
      // Flag those topics as isInsufficient = true, insufficiencySource = 'simulado', and accuracyInSimulados = accuracy.
      // This automatically pushes them to the Dashboard's Tópicos de Rendimento Deficitário list and calendar prioritizations!
      for (const item of performanceToSave) {
        const accuracyVal = item.total > 0 ? item.correct / item.total : 1;
        if (accuracyVal < 0.75) {
          // Find all topics belonging to this subject
          const matchedSubject = subjects.find(s => s.name.trim().toLowerCase() === item.subjectName.trim().toLowerCase());
          if (matchedSubject) {
            const subjectTopics = topics.filter(t => t.subjectId === matchedSubject.id);
            for (const topic of subjectTopics) {
              const topicRef = doc(db, 'users', user.uid, 'topics', topic.id);
              await updateDoc(topicRef, {
                isInsufficient: true,
                insufficiencySource: 'simulado',
                accuracyInSimulados: accuracyVal,
                insufficiencyReason: `Aproveitamento deficitário de ${Math.round(accuracyVal * 100)}% na matéria de ${item.subjectName} no simulado: "${title}"`
              });
            }
          }
        }
      }
      
      // Reset form
      setTitle('');
      setDate(new Date().toISOString().substring(0, 10));
      setTotalQuestions(50);
      setCorrectAnswers(35);
      setTimeSpentMinutes(120);
      setTag('Simulado');
      setConditions('Simulado Real');
      setNotes('');
      setLackOfContent(0);
      setCarelessness(0);
      setTimePressure(0);
      setMisinterpretation(0);
      setSubjectBreakdowns([]);
      setShowAddForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/mockExams`);
    }
  };

  const deleteExam = async (id: string) => {
    if (!user || !confirm('Deseja excluir permanentemente este registro de simulado?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'mockExams', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/mockExams/${id}`);
    }
  };

  const handleGenerateAIDiagnostic = async (exam: MockExam) => {
    if (!user) return;
    setAnalyzingExamId(exam.id);
    
    const accuracy = ((exam.correctAnswers / exam.totalQuestions) * 100).toFixed(1);
    
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generateContent',
          email: user.email,
          payload: {
            prompt: `Abaixo estão os resultados de um simulado ou prova de residência médica de um estudante de medicina:
- Título do Simulado: ${exam.title}
- Data: ${new Date(exam.date).toLocaleDateString('pt-BR')}
- Total de Questões: ${exam.totalQuestions}
- Acertos: ${exam.correctAnswers} (${accuracy}%)
- Tempo Gasto: ${exam.timeSpentMinutes} minutos

Distribuição de erros por motivo (Taxonomia de Erros):
- Falta de Conteúdo: ${exam.errorsByReason?.lackOfContent || 0}
- Distração/Atenção: ${exam.errorsByReason?.carelessness || 0}
- Pressão por Tempo: ${exam.errorsByReason?.timePressure || 0}
- Interpretação Incorreta: ${exam.errorsByReason?.misinterpretation || 0}

Distribuição por matéria:
${(exam.performanceBySubject || []).map(s => `- ${s.subjectName}: ${s.correct}/${s.total} (${s.total > 0 ? ((s.correct / s.total) * 100).toFixed(0) : 0}%)`).join('\n')}

Notas adicionais do estudante:
${exam.notes || 'Nenhuma nota informada.'}

Como um preceptor especialista em residência médica e aprovação na residência, faça uma análise detalhada deste resultado. Forneça:
1. Uma avaliação objetiva da performance do estudante (se foi ótima, intermediária ou crítica).
2. Diagnóstico dos erros: analise os motivos dos erros (se faltou base teórica, se foi controle emocional/tempo, se foi atenção) e dê conselhos específicos para mitigar esse tipo de falha.
3. Plano de ação focado nas matérias deficitárias (especialmente aquelas com rendimento < 75%).
4. Técnicas de estudo ou táticas de prova personalizadas para este cenário.

Escreva a resposta de forma direta, encorajadora e extremamente prática em Português. Use títulos, tópicos e negritos de forma estruturada. Não use introduções formais longas, vá direto para o relatório de mentoria.`,
            preferredProvider: localStorage.getItem('user_preferred_ai_provider') || 'auto'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao comunicar com o servidor de IA.');
      }

      const data = await response.json();
      if (data.result) {
        const examRef = doc(db, 'users', user.uid, 'mockExams', exam.id);
        await updateDoc(examRef, {
          deepAnalysis: data.result
        });
      }
    } catch (err) {
      console.error('Error generating AI diagnostic:', err);
      alert('Houve um erro ao gerar o diagnóstico com IA. Verifique sua conexão ou tente novamente.');
    } finally {
      setAnalyzingExamId(null);
    }
  };

  // Metacognitive calculations
  const totalErrorsCount = exams.reduce((acc, exam) => {
    return acc + (exam.totalQuestions - exam.correctAnswers);
  }, 0);

  const reasonAccumulator = exams.reduce((acc, exam) => {
    acc.lackOfContent += exam.errorsByReason?.lackOfContent || 0;
    acc.carelessness += exam.errorsByReason?.carelessness || 0;
    acc.timePressure += exam.errorsByReason?.timePressure || 0;
    acc.misinterpretation += exam.errorsByReason?.misinterpretation || 0;
    return acc;
  }, { lackOfContent: 0, carelessness: 0, timePressure: 0, misinterpretation: 0 });

  const totalClassifiedErrors = reasonAccumulator.lackOfContent + reasonAccumulator.carelessness + reasonAccumulator.timePressure + reasonAccumulator.misinterpretation;

  const errorData = [
    { name: 'Conteúdo de Base', count: reasonAccumulator.lackOfContent, desc: 'Déficit conceitual profundo', color: '#EF4444' },
    { name: 'Distração/Atenção', count: reasonAccumulator.carelessness, desc: 'Falta de foco momentâneo', color: '#F59E0B' },
    { name: 'Pressão de Tempo', count: reasonAccumulator.timePressure, desc: 'Inabilidade em gerenciar ritmo', color: '#10B981' },
    { name: 'Questão Mal Interpretada', count: reasonAccumulator.misinterpretation, desc: 'Leitura inadequada do enunciado', color: '#3B82F6' }
  ];

  // Subject Performance Accumulator
  const subjectScores: { [key: string]: { total: number; correct: number } } = {};
  exams.forEach(exam => {
    if (exam.performanceBySubject) {
      exam.performanceBySubject.forEach(item => {
        if (!subjectScores[item.subjectName]) {
          subjectScores[item.subjectName] = { total: 0, correct: 0 };
        }
        subjectScores[item.subjectName].total += item.total;
        subjectScores[item.subjectName].correct += item.correct;
      });
    }
  });

  const subjectRanking = Object.entries(subjectScores).map(([name, scores]) => {
    const accuracy = scores.total > 0 ? (scores.correct / scores.total) * 100 : 0;
    return { name, ...scores, accuracy };
  }).sort((a, b) => a.accuracy - b.accuracy); // lowest accuracy first to guide study prioritizing

  // Timeline for charts
  const timelineData = exams.map(exam => ({
    name: exam.title.length > 15 ? exam.title.substring(0, 15) + '...' : exam.title,
    grade: parseFloat(((exam.correctAnswers / exam.totalQuestions) * 100).toFixed(1)),
    date: new Date(exam.date).toLocaleDateString('pt-BR'),
  }));

  if (loading || studyDataLoading) {
    return <div className="font-mono text-xs opacity-50">PRODUZINDO DIAGNÓSTICO DE SIMULADOS...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Introduction Banner & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif italic text-3xl sm:text-4xl text-[#141414]">Simulados & Provas</h2>
          <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest mt-1">
            Análise científica de performance, caderno de erros e prioridade metacognitiva de tópicos.
          </p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#141414] text-[#E4E3E0] px-6 py-3 sm:py-2 font-mono text-[10px] uppercase hover:bg-[#141414]/90 flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          {showAddForm ? 'FECHAR DIAGNÓSTICO' : 'REGISTRAR SIMULADO'}
        </button>
      </div>

      {/* Scientific Mindset Tooltip */}
      <div className="bg-[#141414]/5 border-l-4 border-[#141414] p-4 text-[#141414] space-y-2">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[#141414]" />
          <h4 className="font-mono text-xs font-bold uppercase tracking-widest">A CIÊNCIA POR TRÁS COMPROVA:</h4>
        </div>
        <p className="text-xs leading-relaxed max-w-4xl">
          Sessões de simulados e exames anteriores atuam como o mais poderoso mecanismo de <strong>efeito de teste (testing-effect)</strong> e <strong>calibração metacognitiva</strong>. Registrar seu desempenho juntamente com os <em>motivos fundamentais das suas falhas</em> permite que você identifique padrões de erro intangíveis na aprendizagem ordinária. Estudar sem examinar seus padrões de erro costuma gerar a <strong>ilusão de competência</strong>.
        </p>
      </div>

      {/* Quick Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex items-center gap-4">
          <div className="p-3 bg-[#141414] text-[#E4E3E0]">
            <FileText size={20} />
          </div>
          <div>
            <div className="text-2xl font-serif italic font-bold">{exams.length}</div>
            <div className="text-[9px] font-mono uppercase opacity-50">Exames Tomados</div>
          </div>
        </div>

        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex items-center gap-4">
          <div className="p-3 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="text-2xl font-serif italic font-bold">
              {exams.length > 0 
                ? `${(exams.reduce((acc, cur) => acc + (cur.correctAnswers / cur.totalQuestions), 0) / exams.length * 100).toFixed(1)}%`
                : '0%'
              }
            </div>
            <div className="text-[9px] font-mono uppercase opacity-50">Acurácia Média Geral</div>
          </div>
        </div>

        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex items-center gap-4">
          <div className="p-3 bg-[#E4E3E0] text-[#141414] border border-[#141414]">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-2xl font-serif italic font-bold">
              {exams.length > 0 
                ? `${(exams.reduce((acc, cur) => acc + cur.timeSpentMinutes, 0) / exams.length).toFixed(0)}m`
                : '0m'
              }
            </div>
            <div className="text-[9px] font-mono uppercase opacity-50">Tempo Médio/Prova</div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      {showAddForm && (
        <form onSubmit={addExam} className="bg-white border border-[#141414] p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] space-y-8">
          <div>
            <h3 className="font-serif italic text-2xl mb-2">Registrar Novo Simulado ou Prova</h3>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-wider">
              Forneça os dados de acurácia, o tempo gasto e faça a catalogação metacognitiva de seus erros.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side: General variables */}
            <div className="space-y-4">
              <h4 className="font-mono text-xs font-bold uppercase border-b border-[#141414] pb-2">Informações Gerais</h4>
              
              <div>
                <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Título do Simulado / Nome da Prova</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required
                  placeholder="EX: Simulado Especialidade Pediatria 2024"
                  className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Data de Realização</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Tempo Total Gasto (minutos)</label>
                  <input 
                    type="number" 
                    value={timeSpentMinutes} 
                    onChange={(e) => setTimeSpentMinutes(Math.max(1, Number(e.target.value)))}
                    required
                    className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Total de Questões</label>
                  <input 
                    type="number" 
                    value={totalQuestions} 
                    onChange={(e) => setTotalQuestions(Math.max(1, Number(e.target.value)))}
                    required
                    className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Questões Certas (Acertos)</label>
                  <input 
                    type="number" 
                    value={correctAnswers} 
                    onChange={(e) => setCorrectAnswers(Math.max(0, Math.min(totalQuestions, Number(e.target.value))))}
                    required
                    className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Categoria</label>
                  <select 
                    value={tag} 
                    onChange={(e) => setTag(e.target.value as any)}
                    className="w-full p-2 border border-[#141414] font-mono text-xs bg-white focus:outline-none"
                  >
                    <option value="Simulado bg-white">Simulado Completo</option>
                    <option value="Prova Antiga">Prova Antiga de Concurso/Vestibular</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Condições</label>
                  <select 
                    value={conditions} 
                    onChange={(e) => setConditions(e.target.value as any)}
                    className="w-full p-2 border border-[#141414] font-mono text-xs bg-white focus:outline-none"
                  >
                    <option value="Simulado Real">Simulado Real (Tempo/Sem Consulta)</option>
                    <option value="Estudo/Treino">Estudo/Treino (Consulta Livre)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Notas e Descobertas e Metas Individuais</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="EX: Notei que o cansaço mental após o bloco 4 aumentou a taxa de erros por falta de foco. Desenvolver melhor a pausa rápida de respiração no meio do bloco de exames."
                  className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none h-24"
                />
              </div>
            </div>

            {/* Right side: Metacognitive pattern classifier */}
            <div className="space-y-6">
              <div>
                <h4 className="font-mono text-xs font-bold uppercase border-b border-[#141414] pb-2 flex items-center justify-between">
                  <span>Diagnóstico Científico do Erro (O Caderno de Erros)</span>
                  <span className="text-[10px] font-normal text-red-500">Erros totais cometidos: {totalQuestions - correctAnswers}</span>
                </h4>
                <p className="text-[9px] font-mono opacity-60 uppercase tracking-tight mt-1">
                  Distribua a quantidade de erros cometidos com base no diagnóstico metacognitivo abaixo.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-mono uppercase font-bold">Falta de Conteúdo de Base: {lackOfContent}</label>
                    <span className="text-[9px] font-mono opacity-50">Não dominava a matéria teórica</span>
                  </div>
                  <input 
                    type="range" 
                    min={0}
                    max={totalQuestions - correctAnswers}
                    value={lackOfContent} 
                    onChange={(e) => setLackOfContent(Number(e.target.value))}
                    className="w-full accent-[#141414]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-mono uppercase font-bold">Falta de Atenção ou Distração: {carelessness}</label>
                    <span className="text-[9px] font-mono opacity-50">Sabia a teoria, mas errou de bobeira</span>
                  </div>
                  <input 
                    type="range" 
                    min={0}
                    max={totalQuestions - correctAnswers}
                    value={carelessness} 
                    onChange={(e) => setCarelessness(Number(e.target.value))}
                    className="w-full accent-[#141414]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-mono uppercase font-bold">Pressão de Tempo: {timePressure}</label>
                    <span className="text-[9px] font-mono opacity-50">Teve que chutar por falta de tempo</span>
                  </div>
                  <input 
                    type="range" 
                    min={0}
                    max={totalQuestions - correctAnswers}
                    value={timePressure} 
                    onChange={(e) => setTimePressure(Number(e.target.value))}
                    className="w-full accent-[#141414]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-mono uppercase font-bold">Má Interpretação de Enunciado: {misinterpretation}</label>
                    <span className="text-[9px] font-mono opacity-50">Leu errado ou caiu em cascata/pegadinha</span>
                  </div>
                  <input 
                    type="range" 
                    min={0}
                    max={totalQuestions - correctAnswers}
                    value={misinterpretation} 
                    onChange={(e) => setMisinterpretation(Number(e.target.value))}
                    className="w-full accent-[#141414]"
                  />
                </div>

                {lackOfContent + carelessness + timePressure + misinterpretation !== totalQuestions - correctAnswers && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>INFO: Você classificou {lackOfContent + carelessness + timePressure + misinterpretation} de {totalQuestions - correctAnswers} erros totais cometidos.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Performance by Subject inside exam breakdown */}
          {subjects.length > 0 && (
            <div className="border border-[#141414] p-4 bg-[#141414]/5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-mono text-xs font-bold uppercase">Distribuição Opcional por Matéria</h4>
                <p className="text-[9px] font-mono opacity-50 uppercase">Preencha apenas as matérias avaliadas neste específico simulado</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {subjectBreakdowns.map((item, idx) => (
                  <div key={idx} className="bg-white border border-[#141414] p-3 space-y-2">
                    <div className="font-serif italic text-xs font-bold truncate">{item.subjectName}</div>
                    <div className="flex gap-2 text-xs">
                      <div className="flex-1">
                        <label className="text-[8px] font-mono uppercase opacity-50">Questões</label>
                        <input 
                          type="number" 
                          value={item.total || ''} 
                          placeholder="0"
                          onChange={(e) => handleSubjectScoreChange(idx, 'total', Math.max(0, Number(e.target.value)))}
                          className="w-full p-1 border border-[#141414] font-mono text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[8px] font-mono uppercase opacity-50">Acertos</label>
                        <input 
                          type="number" 
                          value={item.correct || ''} 
                          placeholder="0"
                          onChange={(e) => handleSubjectScoreChange(idx, 'correct', Math.max(0, Math.min(item.total, Number(e.target.value))))}
                          className="w-full p-1 border border-[#141414] font-mono text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button 
              type="button" 
              onClick={() => { setShowAddForm(false); }}
              className="flex-1 border border-[#141414] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/5"
            >
              CANCELAR
            </button>
            <button 
              type="submit"
              className="flex-1 bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/90"
            >
              SALVAR REGISTRO
            </button>
          </div>
        </form>
      )}

      {exams.length === 0 ? (
        <div className="bg-white border border-[#141414] p-12 text-center text-[#141414]">
          <Brain className="mx-auto text-gray-400 mb-4 opacity-50 animate-pulse" size={48} />
          <h3 className="font-serif italic text-xl mb-1">Nenhum simulado registrado</h3>
          <p className="text-xs font-mono opacity-50 uppercase max-w-md mx-auto leading-relaxed">
            Comece a documentar sua evolução de simulados e provas antigas para construir um diagnóstico preciso com fundamentação científica de erros e priorização de assuntos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Visualizations: Left Side */}
          <div className="lg:col-span-2 space-y-8">
            {/* 1. Accuracy Evolution Over Time Chart */}
            <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif italic text-lg sm:text-xl">Acompanhamento da Evolução Mensal</h3>
                <span className="text-[9px] font-mono bg-[#141414] text-[#E4E3E0] px-2 py-1 uppercase font-bold tracking-widest">METRICA DE ACURACIA %</span>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#14141410" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={{ stroke: '#141414' }} 
                      tickLine={false}
                      tick={{ fontSize: 9, fontFamily: 'monospace' }}
                    />
                    <YAxis 
                      axisLine={{ stroke: '#141414' }} 
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 9, fontFamily: 'monospace' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '2px solid #141414',
                        borderRadius: '0px',
                        fontFamily: 'monospace',
                        fontSize: '11px'
                      }}
                      formatter={(v) => [`${v}%`, 'Acurácia']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="grade" 
                      stroke="#141414" 
                      strokeWidth={3}
                      activeDot={{ r: 8 }} 
                      dot={{ stroke: '#141414', strokeWidth: 2, r: 4, fill: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Systematic Errors Reason analysis (Caderno de Erros) */}
            <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-serif italic text-lg sm:text-xl">Diagnóstico Taxonômico dos Erros</h3>
                  <p className="text-[9px] font-mono opacity-50 uppercase tracking-tight mt-1">Sua maior falha está relacionada com qual vetor escolar?</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={errorData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#14141410" horizontal={false} />
                      <XAxis type="number" axisLine={{ stroke: '#141414' }} tickLine={false} tick={{ fontSize: 8, fontFamily: 'monospace' }} />
                      <YAxis dataKey="name" type="category" width={80} axisLine={{ stroke: '#141414' }} tickLine={false} tick={{ fontSize: 8, fontFamily: 'monospace' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '2px solid #141414',
                          borderRadius: '0px',
                          fontFamily: 'monospace',
                          fontSize: '10px'
                        }}
                      />
                      <Bar dataKey="count" fill="#141414">
                        {errorData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  {errorData.map((reason, idx) => {
                    const pct = totalClassifiedErrors > 0 ? (reason.count / totalClassifiedErrors * 100).toFixed(1) : '0';
                    return (
                      <div key={idx} className="flex items-start gap-3 p-3 border border-gray-100 bg-gray-50/50">
                        <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: reason.color }}></div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[10px] font-bold uppercase">{reason.name}</span>
                            <span className="font-mono text-[10px] font-bold">{pct}%</span>
                          </div>
                          <p className="text-[10px] font-mono text-gray-500">{reason.desc}</p>
                          <div className="text-[9px] font-sans italic text-gray-700 font-medium font-mono">Quantidade no banco: {reason.count} erros</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* List and breakdowns of exams taken */}
            <div className="bg-white border border-[#141414]">
              <div className="p-4 border-b border-[#141414] bg-[#141414]/5">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest">Histórico Detalhado de Simulados</h3>
              </div>
              <div className="divide-y divide-[#141414]">
                {exams.slice().reverse().map(exam => {
                  const accuracy = ((exam.correctAnswers / exam.totalQuestions) * 100).toFixed(1);
                  const isExpanded = expandedExam === exam.id;
                  
                  return (
                    <div key={exam.id} className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[8px] font-mono px-2 py-0.5 border ${exam.tag === 'Simulado' ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-black border-[#141414]'}`}>
                              {exam.tag.toUpperCase()}
                            </span>
                            <span className="text-[8px] font-mono px-2 py-0.5 border border-gray-200 bg-gray-50 uppercase">
                              {exam.conditions}
                            </span>
                          </div>
                          <h4 className="font-serif italic text-base font-bold text-[#141414]">{exam.title}</h4>
                          <p className="text-[9px] font-mono opacity-50 uppercase">{new Date(exam.date).toLocaleDateString('pt-BR')} — GASTOU {exam.timeSpentMinutes} MINUTOS</p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xl font-mono font-bold">{exam.correctAnswers}/{exam.totalQuestions}</div>
                            <div className="text-[9px] font-mono uppercase opacity-50 font-bold text-gray-500">Acurácia: {accuracy}%</div>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              type="button"
                              onClick={() => setExpandedExam(isExpanded ? null : exam.id)}
                              className="p-2 border border-[#141414] hover:bg-gray-50"
                              title="Visualizar Detalhes"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <button 
                              type="button"
                              onClick={() => deleteExam(exam.id)}
                              className="p-2 border border-red-200 text-red-500 hover:bg-red-50"
                              title="Excluir Registro"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pt-4 border-t border-[#141414]/10 space-y-4 text-xs font-mono bg-gray-50/50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Detailed errors */}
                            <div className="space-y-2">
                              <h5 className="font-bold text-[9px] uppercase tracking-wide opacity-70">Taxonomia do Erro no Exame</h5>
                              <div className="space-y-1 text-[10px]">
                                <div className="flex justify-between">
                                  <span>Falta de Conteúdo:</span>
                                  <span className="font-bold">{exam.errorsByReason?.lackOfContent || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Distração/Atenção:</span>
                                  <span className="font-bold">{exam.errorsByReason?.carelessness || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Pressão por Tempo:</span>
                                  <span className="font-bold">{exam.errorsByReason?.timePressure || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Interpretação Incorreta:</span>
                                  <span className="font-bold">{exam.errorsByReason?.misinterpretation || 0}</span>
                                </div>
                              </div>
                            </div>

                            {/* Subjects breakdown in this exam */}
                            {exam.performanceBySubject && exam.performanceBySubject.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-bold text-[9px] uppercase tracking-wide opacity-70">Performance Filtrada por Assuntos</h5>
                                <div className="space-y-1 text-[10px]">
                                  {exam.performanceBySubject.map((sub, idx) => (
                                    <div key={idx} className="flex justify-between items-center">
                                      <span>{sub.subjectName}:</span>
                                      <span className="font-bold">
                                        {sub.correct}/{sub.total} ({sub.total > 0 ? ((sub.correct / sub.total) * 100).toFixed(0) : 0}%)
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {exam.notes && (
                            <div className="space-y-1 pt-2 border-t border-gray-100">
                              <h5 className="font-bold text-[9px] uppercase tracking-wide opacity-70">Notas e Diagnóstico Qualitativo</h5>
                              <p className="text-[10px] italic text-gray-700 font-sans leading-relaxed">{exam.notes}</p>
                            </div>
                          )}

                          {/* AI Diagnostic Area */}
                          <div className="pt-3 border-t border-gray-100 space-y-2">
                            <h5 className="font-bold text-[9px] uppercase tracking-wide opacity-70 flex items-center gap-1">
                              <Sparkles size={11} className="text-indigo-600" />
                              Diagnóstico de Desempenho por IA (Mentoria)
                            </h5>
                            
                            {exam.deepAnalysis ? (
                              <div className="p-3 bg-indigo-50/50 border border-indigo-100 text-[10.5px] font-sans text-neutral-800 leading-relaxed space-y-2 max-w-none markdown-body">
                                <ReactMarkdown>{exam.deepAnalysis}</ReactMarkdown>
                              </div>
                            ) : (
                              <div className="bg-white border border-dashed border-neutral-300 p-4 text-center space-y-3">
                                <p className="text-[10px] font-sans text-neutral-500">
                                  Gere um relatório de diagnóstico aprofundado via Inteligência Artificial para este simulado, identificando lacunas conceituais e emocionais.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleGenerateAIDiagnostic(exam)}
                                  disabled={analyzingExamId === exam.id}
                                  className="px-4 py-2 bg-indigo-600 text-white font-mono text-[9px] uppercase font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 mx-auto cursor-pointer"
                                >
                                  {analyzingExamId === exam.id ? (
                                    <>
                                      <span className="animate-spin inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                                      Analisando com IA...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={11} />
                                      Gerar Análise por IA
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Meta-Prioritization (Diagnóstico por Matéria para alimentar o SRS) */}
          <div className="space-y-8">
            <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-6">
              <div>
                <h3 className="font-serif italic text-lg sm:text-xl">Prioridades de Revisão por Matéria</h3>
                <p className="text-[9px] font-mono opacity-50 uppercase tracking-tight mt-1">Recomendamos impulsionar as revisões das seguintes matérias no seu algoritmo de repetições</p>
              </div>

              {subjectRanking.length === 0 ? (
                <div className="text-center font-mono text-[10px] text-gray-500 py-6">
                  Preencha a distribuição de acertos por assunto de seus simulados para obter seu mapa de calor de vulnerabilidades.
                </div>
              ) : (
                <div className="space-y-4">
                  {subjectRanking.map((subItem, idx) => {
                    const isBelowThreshold = subItem.accuracy < 70;
                    return (
                      <div key={idx} className={`p-3 border ${isBelowThreshold ? 'border-red-400 bg-red-50/30' : 'border-[#141414]/10 bg-white'} space-y-2`}>
                        <div className="flex justify-between items-center">
                          <span className="font-serif italic text-xs font-bold text-[#141414]">{subItem.name}</span>
                          <span className={`font-mono text-xs font-bold ${isBelowThreshold ? 'text-red-500' : 'text-[#141414]'}`}>
                            {subItem.accuracy.toFixed(1)}%
                          </span>
                        </div>
                        
                        <div className="w-full bg-[#141414]/10 h-2">
                          <div 
                            className={`h-full ${isBelowThreshold ? 'bg-red-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${subItem.accuracy}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center text-[9px] font-mono text-gray-500">
                          <span>{subItem.correct} acertos de {subItem.total} questões</span>
                          {isBelowThreshold ? (
                            <span className="text-red-600 font-bold tracking-tight uppercase flex items-center gap-1">
                              <AlertCircle size={10} /> CRÍTICO (Abaixo de 70%)
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold uppercase">Consolidado</span>
                          )}
                        </div>

                        {isBelowThreshold && (
                          <div className="p-2 bg-red-50 border border-red-100 text-red-800 text-[10px] font-mono">
                            Dica: Vá na aba <strong>MATÉRIAS</strong> e diminua o intervalo das revisões deste assunto ou tome sessões diárias curtas via SRS.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scientific explanation on Exam Retrospective */}
            <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} />
                <h4 className="font-mono text-xs font-bold uppercase tracking-widest">O Caderno de Erros Ativo</h4>
              </div>
              <p className="text-[11px] leading-relaxed font-sans text-gray-700">
                A literatura de psicologia cognitiva aponta que o <strong>feedback imediato ou corretivo deliberado</strong> após um exame simulado reduz chances de fixação de informações incorretas (conhecido como perseverância do erro). 
              </p>
              <p className="text-[11px] leading-relaxed font-sans text-gray-700">
                Ao catalogar seus erros por <strong>Falta de Atenção</strong> ou <strong>Tempo</strong>, você passa a distinguir o <em>conhecimento conceitual</em> das <em>habilidades operacionais de realização de provas</em>. Isso muda o foco do seu estudo tradicional passivo para um monitoramento metacognitivo dinâmico de altíssima eficiência.
              </p>
            </div>
          </div>
          
        </div>
      )}

      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
        reason={upgradeReason} 
      />
    </div>
  );
}
