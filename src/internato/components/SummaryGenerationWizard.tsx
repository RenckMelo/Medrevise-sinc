import React, { useState, useEffect } from 'react';
import { Sparkles, Check, ArrowRight, ArrowLeft, BookOpen, Stethoscope, AlertTriangle, ShieldCheck, Trash2, Plus, CheckCircle2, Loader2, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { recordUsage } from '../services/geminiService';

interface SummaryGenerationWizardProps {
  topicTitle: string;
  onGenerate: (config: {
    depth: string;
    illustrationLevel: 'minimum' | 'moderate' | 'maximum';
    alertBoxLevel: 'minimum' | 'moderate' | 'maximum';
    referencePref: string;
    chapters: string[];
    analysisResult?: any;
  }) => void;
  onCancel: () => void;
  isGenerating: boolean;
  availableCredits: number;
  initialAnalysis?: any;
  onRunAnalysis?: (depth: string) => Promise<any>;
}

export default function SummaryGenerationWizard({
  topicTitle,
  onGenerate,
  onCancel,
  isGenerating,
  availableCredits,
  initialAnalysis,
  onRunAnalysis
}: SummaryGenerationWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [depth, setDepth] = useState<string>('custom_analyzed');
  const [illustrationLevel, setIllustrationLevel] = useState<'minimum' | 'moderate' | 'maximum'>('moderate');
  const [alertBoxLevel, setAlertBoxLevel] = useState<'moderate' | 'minimum' | 'maximum'>('moderate');
  const [referencePref, setReferencePref] = useState<string>('');
  
  const [hasAnalysisEnabled, setHasAnalysisEnabled] = useState<boolean>(true);
  const [hasRunAnalysis, setHasRunAnalysis] = useState<boolean>(!!initialAnalysis);
  const [analysisError, setAnalysisError] = useState<string>('');

  const [analysis, setAnalysis] = useState<any>(initialAnalysis || {
    justification: 'Abordagem focada em diretrizes atuais do Ministério da Saúde, SBC, SBH e ABRAMED, cobrindo fisiopatologia, diagnóstico diferencial e condutas de emergência cobradas em bancas de residência.',
    chapters: [
      'Introdução e Epidemiologia',
      'Fisiopatologia e Mecanismos',
      'Critérios Diagnósticos Oficiais',
      'Conduta Imediata e Tratamento Farmacológico',
      'Complicações e Armadilhas de Prova'
    ],
    clinicalHighlights: [
      'Manejo de crise hipertensiva com PA > 180/120 mmHg',
      'Diferenciação entre urgência e emergência hipertensiva',
      'Critérios de internação em UTI e monitorização'
    ]
  });

  const [isAnalyzingLocal, setIsAnalyzingLocal] = useState<boolean>(false);
  const [newChapter, setNewChapter] = useState<string>('');

  // Clear analysis error when depth changes
  useEffect(() => {
    setAnalysisError('');
  }, [depth]);

  const handleFetchAnalysis = async (selectedDepth: string) => {
    if (onRunAnalysis) {
      setIsAnalyzingLocal(true);
      setAnalysisError('');
      try {
        const res = await onRunAnalysis(selectedDepth);
        if (res) {
          setAnalysis(res);
        }
      } catch (err) {
        console.error('Error analyzing topic:', err);
        setAnalysisError('Erro ao obter a análise com o preceptor IA.');
      } finally {
        setIsAnalyzingLocal(false);
      }
    }
  };

  const handleRunPreAnalysis = async (selectedDepth: string) => {
    if (availableCredits < 2) {
      setAnalysisError(`Créditos insuficientes! Você possui ${availableCredits} créditos, mas são necessários 2 créditos para rodar a pré-análise do tema.`);
      return;
    }
    setAnalysisError('');
    setIsAnalyzingLocal(true);
    try {
      // Deduct 2 credits for running the analysis
      await recordUsage(2);
      if (onRunAnalysis) {
        const res = await onRunAnalysis(selectedDepth);
        if (res) {
          setAnalysis(res);
          setHasRunAnalysis(true);
          setStep(2); // Auto advance to Step 2
        } else {
          setAnalysisError("Não foi possível gerar a pré-análise estruturada no momento.");
        }
      }
    } catch (err) {
      console.error('Error running pre-analysis:', err);
      setAnalysisError("Ocorreu um erro ao realizar o planejamento estratégico de capítulos.");
    } finally {
      setIsAnalyzingLocal(false);
    }
  };

  const handleReRunAnalysisInStep2 = async () => {
    if (availableCredits < 2) {
      setAnalysisError(`Créditos insuficientes para atualizar a análise! Você possui ${availableCredits} créditos (necessário: 2 cr).`);
      return;
    }
    setIsAnalyzingLocal(true);
    try {
      await recordUsage(2);
      if (onRunAnalysis) {
        const res = await onRunAnalysis(depth);
        if (res) {
          setAnalysis(res);
        }
      }
    } catch (err) {
      console.error('Error updating pre-analysis:', err);
    } finally {
      setIsAnalyzingLocal(false);
    }
  };

  const handleAddChapter = () => {
    if (!newChapter.trim()) return;
    setAnalysis(prev => ({
      ...prev,
      chapters: [...(prev?.chapters || []), newChapter.trim()]
    }));
    setNewChapter('');
  };

  const handleRemoveChapter = (index: number) => {
    setAnalysis(prev => ({
      ...prev,
      chapters: (prev?.chapters || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddSuggestedExtra = (extra: { title: string; reason?: string; insertAtIndex: number }, extraIndex: number) => {
    setAnalysis((prev: any) => {
      if (!prev) return prev;
      const currentChapters = [...(prev.chapters || [])];
      const targetIdx = Math.max(0, Math.min(extra.insertAtIndex, currentChapters.length));
      
      // Insert title at targetIdx
      currentChapters.splice(targetIdx, 0, extra.title);

      // Remove added extra from suggestedExtraChapters and adjust indices of remaining ones
      const currentExtras = [...(prev.suggestedExtraChapters || [])];
      currentExtras.splice(extraIndex, 1);

      const adjustedExtras = currentExtras.map((item: any) => {
        if (item.insertAtIndex >= targetIdx) {
          return { ...item, insertAtIndex: item.insertAtIndex + 1 };
        }
        return item;
      });

      return {
        ...prev,
        chapters: currentChapters,
        suggestedExtraChapters: adjustedExtras
      };
    });
  };

  const getCost = () => {
    if (depth === 'standard') return 1;
    if (depth === 'deep') return 5;
    if (depth === 'elite') return 10;
    if (depth === 'master') return 50;
    if (depth === 'monograph') return 100;
    
    // For custom_analyzed (Resumo Inteligente), strictly priced by chapter count (10 credits per chapter)
    const chapterCount = analysis?.chapters?.length || 5;
    return Math.max(10, chapterCount * 10);
  };

  const cost = getCost();

  return (
    <div className="bg-white border-2 border-stone-200 rounded-3xl shadow-2xl overflow-hidden max-w-2xl w-full mx-auto my-6 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 p-5 text-white flex items-center justify-between shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-700/80 text-indigo-200 text-[10px] font-mono px-2.5 py-0.5 rounded-md uppercase tracking-wider font-bold">
              Assistente de Geração de Resumos
            </span>
            <span className="text-xs text-indigo-300 font-mono">Etapa {step} de 4</span>
          </div>
          <h3 className="font-display font-black text-lg text-white">
            Planejamento Inteligente: <span className="text-indigo-200 italic">{topicTitle}</span>
          </h3>
        </div>
        <button
          onClick={onCancel}
          disabled={isGenerating}
          className="text-indigo-300 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-stone-100 h-1.5 shrink-0">
        <div 
          className="bg-indigo-600 h-full transition-all duration-300" 
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      <div className="p-6 space-y-6 overflow-y-auto flex-1">
        {analysisError && (
          <div className="bg-rose-50 border border-rose-200/60 text-rose-800 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-rose-950 mb-0.5">Falha no Processamento</span>
              <span className="text-[11px] text-rose-700/90 font-medium">{analysisError}</span>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Passo 1: Selecione o Nível de Profundidade Acadêmica</span>
            </div>
            <p className="text-xs text-stone-500">
              Escolha o padrão de aprofundamento do preceptor para suas revisões de internato e provas de residência.
            </p>

            {isAnalyzingLocal && (
              <div className="flex items-center gap-3 bg-amber-50/80 border border-amber-200/60 text-amber-800 px-4 py-3 rounded-2xl text-xs font-semibold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <div className="flex-1">
                  <span className="font-bold block text-amber-900 mb-0.5">Análise em Andamento...</span>
                  <span className="text-[11px] text-amber-700/90 font-medium">O preceptor IA está analisando os editais e a complexidade clínica do tema para estruturar os capítulos de forma estratégica e didática.</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                { id: 'standard', name: 'Resumo Padrão', cost: '1cr', desc: 'Direto ao ponto, essencial para revisões rápidas.' },
                { id: 'deep', name: 'Resumo Avançado', cost: '5cr', desc: 'Foco em diretrizes nacionais e condutas práticas.' },
                { id: 'elite', name: 'Resumo Elite', cost: '10cr', desc: 'Altamente detalhado para bancas paulistas e ENARE.' },
                { id: 'custom_analyzed', name: 'Resumo Adaptado (Inteligente)', cost: '10cr / capítulo', desc: 'Personalizado com ementa dinâmica. Custo final calculado com base na quantidade de capítulos gerados (10cr por capítulo).' },
                { id: 'master', name: 'Resumo Master', cost: '50cr', desc: 'Tratado clínico completo com fluxogramas.' },
                { id: 'monograph', name: 'Monografia Completa', cost: '100cr', desc: 'Estudo acadêmico exaustivo do tema.' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setDepth(item.id);
                  }}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden",
                    depth === item.id 
                      ? "border-indigo-600 bg-indigo-600 shadow-md ring-2 ring-indigo-600 ring-offset-2 scale-[1.02]" 
                      : "border-stone-200 hover:border-stone-300 bg-white"
                  )}
                >
                  {depth === item.id && (
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-bl-full" />
                  )}
                  <div className="flex items-center justify-between mb-1 relative z-10">
                    <span className={cn("font-bold text-xs", depth === item.id ? "text-white" : "text-stone-900")}>
                      {item.name}
                    </span>
                    <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded", depth === item.id ? "bg-indigo-500/50 text-indigo-50" : "text-indigo-700 bg-indigo-100")}>
                      {item.cost}
                    </span>
                  </div>
                  <p className={cn("text-[11px] leading-relaxed relative z-10", depth === item.id ? "text-indigo-100" : "text-stone-500")}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Opções de Pré-Análise Estratégica */}
            <div className="space-y-3 pt-4 border-t border-stone-200">
              <span className="font-bold text-stone-950 text-xs block">
                Planejamento Didático: Pré-Análise Estratégica do Tema
              </span>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Mapeie as diretrizes das principais bancas de residência (ENARE, SUS, USP, etc.) e ajuste a ementa de capítulos antes de disparar a geração final.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => {
                    setHasAnalysisEnabled(false);
                    setHasRunAnalysis(false);
                  }}
                  className={cn(
                    "p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between bg-white relative",
                    !hasAnalysisEnabled 
                      ? "border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-600 ring-offset-1 scale-[1.01]" 
                      : "border-stone-200 hover:border-stone-300 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                      <span className={cn("w-3 h-3 rounded-full flex items-center justify-center border", !hasAnalysisEnabled ? "bg-indigo-600 border-indigo-600" : "bg-white border-stone-300")}>
                        {!hasAnalysisEnabled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      Sem Pré-Análise (Padrão)
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                      Grátis
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    Geração imediata usando a ementa de capítulos pré-definida de fábrica pelo preceptor IA.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setHasAnalysisEnabled(true);
                  }}
                  className={cn(
                    "p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between bg-white relative",
                    hasAnalysisEnabled 
                      ? "border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-600 ring-offset-1 scale-[1.01]" 
                      : "border-stone-200 hover:border-stone-300 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                      <span className={cn("w-3 h-3 rounded-full flex items-center justify-center border", hasAnalysisEnabled ? "bg-indigo-600 border-indigo-600" : "bg-white border-stone-300")}>
                        {hasAnalysisEnabled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      Com Pré-Análise (+2cr)
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      +2cr
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    Estude as justificativas didáticas e edite (insira, remova, renomeie) os capítulos antes de gerar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && hasAnalysisEnabled && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Passo 2: Análise, Diretrizes & Capítulos do Resumo</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReRunAnalysisInStep2}
                disabled={isAnalyzingLocal}
                className="text-[10px] font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-7 px-2.5 rounded-lg flex items-center gap-1"
              >
                {isAnalyzingLocal ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  'Reciclar Análise (+2cr)'
                )}
              </Button>
            </div>

            <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
              <div>
                <span className="font-bold text-indigo-950 block uppercase tracking-wider text-[10px] mb-1">Diretrizes e Justificativa Didática</span>
                <p className="text-stone-700 leading-relaxed bg-white p-3 rounded-xl border border-stone-200/60">
                  {analysis?.justification}
                </p>
              </div>

              <div>
                <span className="font-bold text-indigo-950 block uppercase tracking-wider text-[10px] mb-1">Destaques Clínicos Cobertos</span>
                <ul className="space-y-1 bg-white p-3 rounded-xl border border-stone-200/60">
                  {analysis?.clinicalHighlights?.map((hl: string, idx: number) => (
                    <li key={idx} className="text-stone-700 flex gap-2">
                      <span className="text-amber-600 font-bold">•</span> {hl}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-indigo-950 block uppercase tracking-wider text-[10px]">Capítulos Sugeridos (Adicione, Remova ou Edite)</span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {analysis?.chapters?.map((ch: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-sm text-xs">
                      <span className="font-semibold text-stone-800 flex items-center gap-2">
                        <span className="text-indigo-600 font-mono text-[10px]">{idx + 1}.</span> {ch}
                      </span>
                      <button
                        onClick={() => handleRemoveChapter(idx)}
                        className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                        title="Excluir capítulo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Nome do novo capítulo..."
                    value={newChapter}
                    onChange={(e) => setNewChapter(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddChapter()}
                    className="h-9 text-xs bg-white border-stone-300 rounded-xl px-3"
                  />
                  <Button
                    onClick={handleAddChapter}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9 px-3 rounded-xl shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </Button>
                </div>

                {/* Sugestões de Capítulos Complementares com Inserção Inteligente */}
                {analysis?.suggestedExtraChapters && analysis.suggestedExtraChapters.length > 0 && (
                  <div className="mt-4 p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-950 text-[11px] flex items-center gap-1.5 uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                        Capítulos Complementares Sugeridos Pela IA
                      </span>
                      <span className="text-[10px] text-amber-800 font-medium bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        Inclusão no local ideal
                      </span>
                    </div>
                    <div className="space-y-2">
                      {analysis.suggestedExtraChapters.map((extra: any, eIdx: number) => {
                        const totalCh = analysis.chapters?.length || 0;
                        const targetPos = Math.max(0, Math.min(extra.insertAtIndex || 0, totalCh));
                        const posText = targetPos === 0 
                          ? "Início do resumo (Cap. 1)" 
                          : targetPos >= totalCh
                          ? `Final do resumo (Cap. ${totalCh + 1})`
                          : `Entre o Cap. ${targetPos} e Cap. ${targetPos + 1}`;

                        return (
                          <div key={eIdx} className="bg-white p-2.5 rounded-xl border border-amber-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-stone-900 text-xs">{extra.title}</span>
                                <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md shrink-0">
                                  📍 Encaixe ideal: {posText}
                                </span>
                              </div>
                              {extra.reason && (
                                <p className="text-[10px] text-stone-500 leading-tight">
                                  {extra.reason}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              type="button"
                              onClick={() => handleAddSuggestedExtra(extra, eIdx)}
                              className="bg-amber-500 hover:bg-amber-600 text-stone-950 text-[11px] font-bold h-7 px-3 rounded-lg shrink-0 self-start sm:self-center flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Adicionar na Posição Ideal
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Stethoscope className="w-4 h-4 text-indigo-600" />
              <span>Passo 3: Casos Clínicos & Quadros de Dicas</span>
            </div>
            <p className="text-xs text-stone-500">
              Configure a densidade de casos práticos de beira de leito e quadros laranjas de alerta para provas de residência.
            </p>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wide">Casos Clínicos por Patologia</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['minimum', 'moderate', 'maximum'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setIllustrationLevel(lvl)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs font-bold uppercase transition-all cursor-pointer",
                        illustrationLevel === lvl
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-600 ring-offset-1"
                          : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                      )}
                    >
                      {lvl === 'minimum' ? 'Sem Casos (+0cr)' : lvl === 'moderate' ? 'Moderado (+2cr)' : 'Detalhado (+5cr)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wide">Quadros Laranjas / Dicas de Prova</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['minimum', 'moderate', 'maximum'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setAlertBoxLevel(lvl)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs font-bold uppercase transition-all cursor-pointer",
                        alertBoxLevel === lvl
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-600 ring-offset-1"
                          : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                      )}
                    >
                      {lvl === 'minimum' ? 'Mínimo (+0cr)' : lvl === 'moderate' ? 'Médio (+2cr)' : 'Máximo (+5cr)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Passo 4: Revisão e Custo Final do Resumo</span>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-stone-200/60 pb-2">
                <span className="text-stone-500">Tópico:</span>
                <span className="font-bold text-stone-900">{topicTitle}</span>
              </div>
              <div className="flex justify-between border-b border-stone-200/60 pb-2">
                <span className="text-stone-500">Nível Acadêmico:</span>
                <span className="font-bold text-indigo-700 uppercase">
                  {depth === 'standard' ? 'Padrão' : depth === 'deep' ? 'Avançado' : depth === 'elite' ? 'Elite' : depth === 'master' ? 'Extensivo' : depth === 'monograph' ? 'Monografia' : 'Resumo Adaptado'}
                </span>
              </div>
              <div className="flex justify-between border-b border-stone-200/60 pb-2">
                <span className="text-stone-500">Capítulos Planejados:</span>
                <span className="font-bold text-stone-900">{analysis?.chapters?.length || 0} capítulos</span>
              </div>
              <div className="flex justify-between border-b border-stone-200/60 pb-2">
                <span className="text-stone-500">Casos Clínicos:</span>
                <span className="font-bold text-stone-900 uppercase">
                  {illustrationLevel === 'minimum' ? 'Sem Casos' : illustrationLevel === 'moderate' ? 'Médio' : 'Máximo'}
                </span>
              </div>
              <div className="flex justify-between border-b border-stone-200/60 pb-2">
                <span className="text-stone-500">Dicas Práticas:</span>
                <span className="font-bold text-stone-900 uppercase">
                  {alertBoxLevel === 'minimum' ? 'Mínimo' : alertBoxLevel === 'moderate' ? 'Médio' : 'Máximo'}
                </span>
              </div>
              <div className="flex justify-between border-b border-stone-200/60 pb-2">
                <span className="text-stone-500">Pré-Análise IA:</span>
                <span className="font-bold text-stone-900">
                  {hasAnalysisEnabled ? 'Cobrado (+2cr / Já debitado)' : 'Desativada (+0cr)'}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-stone-500 font-bold">Custo de Geração (A Cobrar):</span>
                <span className="font-bold text-indigo-700 font-mono text-sm">{cost} créditos</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wide">Tratado ou Diretriz Específica (Opcional)</label>
              <Input
                placeholder="Ex: Diretriz SBC 2024 / Harrison..."
                value={referencePref}
                onChange={(e) => setReferencePref(e.target.value)}
                className="h-10 text-xs border-stone-300 rounded-xl px-3"
              />
            </div>

            {availableCredits < cost && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Créditos insuficientes! Você possui {availableCredits} créditos, mas são necessários {cost}.</span>
              </div>
            )}
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => {
                if (step === 3 && !hasAnalysisEnabled) {
                  setStep(1); // Skip Step 2 going back
                } else {
                  setStep(step - 1);
                }
              }}
              disabled={isGenerating}
              className="text-xs font-bold uppercase tracking-wider h-10 px-4 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button
              onClick={async () => {
                if (step === 1) {
                  if (hasAnalysisEnabled) {
                    if (hasRunAnalysis) {
                      setStep(2);
                    } else {
                      await handleRunPreAnalysis(depth);
                    }
                  } else {
                    setStep(3); // Skip Step 2 going forward
                  }
                } else {
                  setStep(step + 1);
                }
              }}
              disabled={isAnalyzingLocal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider h-10 px-6 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              {isAnalyzingLocal ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Carregando...
                </>
              ) : step === 1 && hasAnalysisEnabled && !hasRunAnalysis ? (
                <>
                  Solicitar Pré-Análise (+2cr)
                  <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                </>
              ) : (
                <>
                  Avançar
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => onGenerate({ 
                depth, 
                illustrationLevel, 
                alertBoxLevel, 
                referencePref, 
                chapters: analysis?.chapters || [],
                analysisResult: hasAnalysisEnabled ? analysis : undefined
              })}
              disabled={isGenerating || availableCredits < cost}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider h-11 px-8 rounded-xl shadow-lg shadow-indigo-200 cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Confirmar e Gerar Resumo ({cost}cr)</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
