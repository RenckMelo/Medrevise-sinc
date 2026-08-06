import React, { useState, useEffect } from 'react';
import { Topic, Subject, Semester } from '../types';
import { 
  Sparkles, 
  ArrowLeft, 
  BookOpen, 
  Plus, 
  Info, 
  Check, 
  Layers, 
  GraduationCap, 
  AlertCircle, 
  FileText, 
  Settings, 
  Activity,
  Shield,
  HelpCircle,
  Trash2,
  Lock,
  Crown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  analyzeSummaryNeeds, 
  recordUsage, 
  getGlobalUsage,
  calculateExtraCredits
} from '../services/geminiService';

interface TopicSyncWizardProps {
  syncData: {
    topic: Topic;
    subjectId: string;
    semesterId: string;
    title: string;
    references: string;
    depth: 'standard' | 'deep' | 'elite' | 'master' | 'monograph' | 'custom_analyzed';
    illustrationLevel?: string;
    alertBoxLevel?: string;
  };
  subjects: Subject[];
  semesters: Semester[];
  onCancel: () => void;
  onConfirm: (finalData: {
    title: string;
    subjectId: string;
    semesterId: string;
    references: string[];
    depth: 'standard' | 'deep' | 'elite' | 'master' | 'monograph' | 'custom_analyzed';
    illustrationLevel: string;
    alertBoxLevel: string;
    triggerAI: boolean;
    custom_analysis?: any;
  }) => Promise<void>;
  onCreateSubject: (name: string, semesterId: string) => Promise<Subject | undefined>;
  onCreateSemester?: (number: number, name: string) => Promise<Semester | undefined>;
}

export default function TopicSyncWizard({
  syncData,
  subjects,
  semesters,
  onCancel,
  onConfirm,
  onCreateSubject,
  onCreateSemester
}: TopicSyncWizardProps) {
  const [title, setTitle] = useState(syncData.title);
  const [selectedSemesterId, setSelectedSemesterId] = useState(syncData.semesterId);
  const [selectedSubjectId, setSelectedSubjectId] = useState(syncData.subjectId);
  const [references, setReferences] = useState(syncData.references);
  const [depth, setDepth] = useState<'standard' | 'deep' | 'elite' | 'master' | 'monograph' | 'custom_analyzed'>(syncData.depth || 'standard');
  const [illustrationLevel, setIllustrationLevel] = useState<'minimum' | 'moderate' | 'maximum'>(
    syncData.illustrationLevel === 'schematic' ? 'moderate' :
    syncData.illustrationLevel === 'clinical_real' ? 'maximum' :
    (syncData.illustrationLevel as any) || 'moderate'
  );
  const [alertBoxLevel, setAlertBoxLevel] = useState<string>(
    (syncData.alertBoxLevel as any) || 'moderate'
  );
  
  // Inline subject creator states
  const [showSubjectCreator, setShowSubjectCreator] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubSemesterId, setNewSubSemesterId] = useState('');
  const [isCreatingSub, setIsCreatingSub] = useState(false);
  
  // Inline semester creator states
  const [showSemesterCreator, setShowSemesterCreator] = useState(false);
  const [newSemNumber, setNewSemNumber] = useState('');
  const [newSemName, setNewSemName] = useState('');
  const [isCreatingSem, setIsCreatingSem] = useState(false);

  const [wizardError, setWizardError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Credit system states
  const { profile } = useAuth();
  const [availableCredits, setAvailableCredits] = useState<number>(0);
  const [maxCredits, setMaxCredits] = useState<number>(0);
  const [loadingCredits, setLoadingCredits] = useState(true);

  // Pre-Analysis states
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [customChapters, setCustomChapters] = useState<string[]>([]);
  const [newChapterText, setNewChapterText] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Load available credits on mount
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const usage = await getGlobalUsage();
        const available = Math.max(0, usage.limit - usage.count);
        setAvailableCredits(available);
        setMaxCredits(usage.limit);
      } catch (e) {
        console.error("Error loading credits in wizard:", e);
      } finally {
        setLoadingCredits(false);
      }
    };
    fetchCredits();
  }, []);

  // Filter subjects based on selected semester
  const filteredSubjects = subjects.filter(
    sub => !selectedSemesterId || sub.semesterId === selectedSemesterId
  );

  const handleInlineCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubSemesterId) {
      setWizardError('Por favor, preencha o nome da matéria e selecione o semestre.');
      return;
    }

    setIsCreatingSub(true);
    setWizardError(null);
    try {
      const createdSub = await onCreateSubject(newSubName.trim(), newSubSemesterId);
      if (createdSub) {
        setSelectedSubjectId(createdSub.id);
        setSelectedSemesterId(createdSub.semesterId);
        setNewSubName('');
        setShowSubjectCreator(false);
      } else {
        setWizardError('Erro desconhecido ao criar matéria.');
      }
    } catch (err: any) {
      setWizardError(err.message || 'Erro ao criar matéria.');
    } finally {
      setIsCreatingSub(false);
    }
  };

  const handleInlineCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    const semNum = parseInt(newSemNumber);
    if (!newSemNumber || isNaN(semNum) || semNum <= 0) {
      setWizardError('Por favor, insira um número válido para o semestre.');
      return;
    }
    if (!newSemName.trim()) {
      setWizardError('Por favor, insira um nome para o semestre.');
      return;
    }

    if (!onCreateSemester) {
      setWizardError('Serviço de criação de semestre não disponível.');
      return;
    }

    setIsCreatingSem(true);
    setWizardError(null);
    try {
      const createdSem = await onCreateSemester(semNum, newSemName.trim());
      if (createdSem) {
        setSelectedSemesterId(createdSem.id);
        setNewSemNumber('');
        setNewSemName('');
        setShowSemesterCreator(false);
      } else {
        setWizardError('Erro desconhecido ao criar semestre.');
      }
    } catch (err: any) {
      setWizardError(err.message || 'Erro ao criar semestre.');
    } finally {
      setIsCreatingSem(false);
    }
  };

  const getExtraCost = () => {
    return calculateExtraCredits(illustrationLevel, alertBoxLevel);
  };
  
  const getBaseCost = (d: string) => {
    if (d === 'custom_analyzed') {
      const count = customChapters.length > 0 ? customChapters.length : (analysisResult?.chapters?.length || 5);
      return Math.max(10, count * 10);
    }
    const costMap: Record<string, number> = {
      standard: 1,
      deep: 5,
      elite: 10,
      master: 50,
      monograph: 100
    };
    return costMap[d] || 1;
  };

  const currentSelectionCost = Math.max(1, getBaseCost(depth) + getExtraCost());

  const handleRunPreAnalysis = async () => {
    const subjectName = subjects.find(s => s.id === selectedSubjectId)?.name || '';
    if (!title.trim()) {
      setWizardError('Digite o título do tópico antes de realizar a análise.');
      return;
    }
    if (!selectedSubjectId) {
      setWizardError('Selecione uma matéria antes de realizar a análise inteligente.');
      return;
    }
    
    setIsAnalyzing(true);
    setWizardError(null);
    try {
      // 1. Run Gemini Analysis (0 credits charged for pre-analysis)
      const analysis = await analyzeSummaryNeeds(title.trim(), subjectName, 'custom_analyzed');
      if (analysis) {
        setAnalysisResult(analysis);
        setCustomChapters(analysis.chapters || []);
      } else {
        setWizardError('Erro ao realizar a análise inteligente via Gemini.');
      }
    } catch (err: any) {
      console.error(err);
      setWizardError('Erro na análise inteligente: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddSuggestedExtraInSync = (extra: { title: string; reason?: string; insertAtIndex: number }, extraIndex: number) => {
    const targetIdx = Math.max(0, Math.min(extra.insertAtIndex, customChapters.length));
    
    // Insert extra.title into customChapters at targetIdx
    const updatedChapters = [...customChapters];
    updatedChapters.splice(targetIdx, 0, extra.title);
    setCustomChapters(updatedChapters);

    // Update analysisResult.suggestedExtraChapters
    if (analysisResult) {
      const currentExtras = [...(analysisResult.suggestedExtraChapters || [])];
      currentExtras.splice(extraIndex, 1);
      const adjustedExtras = currentExtras.map((item: any) => {
        if (item.insertAtIndex >= targetIdx) {
          return { ...item, insertAtIndex: item.insertAtIndex + 1 };
        }
        return item;
      });
      setAnalysisResult({
        ...analysisResult,
        suggestedExtraChapters: adjustedExtras
      });
    }
  };

  const handleSave = async (triggerAI: boolean) => {
    if (!title.trim()) {
      setWizardError('O título do tópico é obrigatório.');
      return;
    }
    if (!selectedSemesterId) {
      setWizardError('Selecione um semestre para organizar o tópico.');
      return;
    }
    if (!selectedSubjectId) {
      setWizardError('Selecione uma matéria para classificar o tópico.');
      return;
    }

    if (triggerAI && depth === 'custom_analyzed' && !analysisResult) {
      setWizardError('Por favor, realize a pré-análise do tema antes de prosseguir com a geração inteligente customizada.');
      return;
    }

    // If they want to generate, check if they have enough credits
    if (triggerAI && availableCredits < currentSelectionCost) {
      setShowUpgradeModal(true);
      return;
    }

    setWizardError(null);
    setIsSubmitting(true);
    try {
      const parsedReferences = references
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);

      // Prepare custom_analysis object if depth is custom_analyzed
      let customAnalysisData = null;
      if (depth === 'custom_analyzed' && analysisResult) {
        customAnalysisData = {
          ...analysisResult,
          chapters: customChapters,
          cost: getBaseCost('custom_analyzed')
        };
      }

      await onConfirm({
        title: title.trim(),
        semesterId: selectedSemesterId,
        subjectId: selectedSubjectId,
        references: parsedReferences,
        depth,
        illustrationLevel,
        alertBoxLevel,
        triggerAI,
        custom_analysis: customAnalysisData
      });
    } catch (err: any) {
      setWizardError(err.message || 'Erro ao salvar o tópico.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7F2] text-[#1A1A1A] p-4 lg:p-10 font-sans flex flex-col justify-between">
      {/* Container */}
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E2E0D9] pb-6 mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={onCancel}
              className="p-2.5 border border-[#E2E0D9] rounded-xl hover:bg-[#F3EFE9] transition-all cursor-pointer bg-white shrink-0"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5 text-stone-700" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 border border-amber-300 text-amber-850 bg-amber-50 text-[9px] font-mono font-black uppercase rounded-full tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500 animate-pulse" />
                  Sincronização Ativa
                </span>
                <span className="text-[10px] text-stone-500 font-mono">MedRevise → MedInternato</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight">Criar & Sincronizar Tópico Clínico</h1>
            </div>
          </div>
          
          <button
            onClick={onCancel}
            className="text-[11px] font-bold text-stone-500 hover:text-stone-900 transition-colors uppercase tracking-widest cursor-pointer self-start sm:self-center"
          >
            Cancelar e Voltar
          </button>
        </div>

        {wizardError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <div>
              <h5 className="font-bold text-sm">Ops! Identificamos um problema</h5>
              <p className="text-xs mt-1 leading-relaxed">{wizardError}</p>
            </div>
          </div>
        )}

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
          
          {/* LEFT: Topic details & Organization (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Topic Info Card */}
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5 border-b border-stone-100 pb-2">
                <FileText className="w-4 h-4 text-stone-600" />
                Informações do Assunto
              </h3>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-stone-600">Título do Tópico Clínico</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-11 px-4 border border-[#E2E0D9] focus:outline-none focus:border-stone-500 rounded-xl font-medium bg-stone-50/50"
                  placeholder="Ex: Apendicite Aguda"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-stone-600 block">Referências Médicas / Diretrizes (Opcional)</label>
                <textarea
                  value={references}
                  onChange={(e) => setReferences(e.target.value)}
                  className="w-full h-24 p-3 border border-[#E2E0D9] focus:outline-none focus:border-stone-500 rounded-xl text-xs font-mono bg-stone-50/50 resize-none leading-relaxed"
                  placeholder="Ex: Diretrizes Brasileiras de Cardiologia (SBC)&#10;Harrison - Medicina Interna 21ª Ed."
                />
                <span className="text-[10px] text-stone-400 block mt-1 leading-none">Insira uma referência por linha. O Preceptor Médico as priorizará rigorosamente.</span>
              </div>
            </div>

            {/* Semester Selection */}
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-stone-600" />
                  1. Selecione o Semestre Clínico
                </h3>
                
                {onCreateSemester && (
                  <button
                    type="button"
                    onClick={() => setShowSemesterCreator(!showSemesterCreator)}
                    className="text-[10px] font-black uppercase text-amber-700 hover:text-amber-800 transition-colors flex items-center gap-1 cursor-pointer bg-amber-50 px-2 py-1 rounded-lg border border-amber-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Criar Semestre
                  </button>
                )}
              </div>

              {showSemesterCreator && (
                <form onSubmit={handleInlineCreateSemester} className="p-4 bg-amber-50/40 border border-amber-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-900 uppercase">Adicionar Novo Semestre</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-stone-500 block">Número do Semestre</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={newSemNumber}
                        onChange={(e) => setNewSemNumber(e.target.value)}
                        placeholder="Ex: 9"
                        className="w-full h-9 px-3 border border-[#E2E0D9] rounded-lg text-xs bg-white focus:outline-none focus:border-stone-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-stone-500 block">Nome/Descrição do Semestre</label>
                      <input
                        type="text"
                        value={newSemName}
                        onChange={(e) => setNewSemName(e.target.value)}
                        placeholder="Ex: Internato Médico"
                        className="w-full h-9 px-3 border border-[#E2E0D9] rounded-lg text-xs bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSemesterCreator(false)}
                      className="px-3 py-1.5 border border-stone-200 text-stone-600 text-xs font-bold rounded-lg hover:bg-stone-50 cursor-pointer bg-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingSem}
                      className="px-3 py-1.5 bg-[#1A1A1A] text-white text-xs font-bold rounded-lg hover:bg-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isCreatingSem ? 'Criando...' : 'Adicionar'}
                    </button>
                  </div>
                </form>
              )}
              
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {semesters.map((sem) => {
                  const isActive = selectedSemesterId === sem.id;
                  return (
                    <button
                      key={sem.id}
                      type="button"
                      onClick={() => {
                        setSelectedSemesterId(sem.id);
                        // Reset subject selection if it doesn't match new semester
                        const sub = subjects.find(s => s.id === selectedSubjectId);
                        if (sub && sub.semesterId !== sem.id) {
                          setSelectedSubjectId('');
                        }
                      }}
                      className={`h-11 rounded-xl text-xs font-mono font-bold flex items-center justify-center border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-sm'
                          : 'bg-white border-[#E2E0D9] hover:bg-[#FBFBFA] hover:border-stone-400 text-stone-700'
                      }`}
                    >
                      {sem.number}º
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-stone-400 block">Identifique em qual semestre da graduação este tema é ministrado para organizá-lo em seu painel.</span>
            </div>

            {/* Subject Selection */}
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-stone-600" />
                  2. Selecione a Matéria / Disciplina
                </h3>
                
                <button
                  type="button"
                  onClick={() => setShowSubjectCreator(!showSubjectCreator)}
                  className="text-[10px] font-black uppercase text-amber-700 hover:text-amber-800 transition-colors flex items-center gap-1 cursor-pointer bg-amber-50 px-2 py-1 rounded-lg border border-amber-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Criar Matéria
                </button>
              </div>

              {showSubjectCreator && (
                <form onSubmit={handleInlineCreateSubject} className="p-4 bg-amber-50/40 border border-amber-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-900 uppercase">Adicionar Nova Matéria</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-stone-500 block">Nome da Disciplina</label>
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        placeholder="Ex: Ginecologia e Obstetrícia"
                        className="w-full h-9 px-3 border border-[#E2E0D9] rounded-lg text-xs bg-white focus:outline-none focus:border-stone-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-stone-500 block">Semestre da Disciplina</label>
                      <select
                        value={newSubSemesterId}
                        onChange={(e) => setNewSubSemesterId(e.target.value)}
                        className="w-full h-9 px-2 border border-[#E2E0D9] rounded-lg text-xs bg-white focus:outline-none"
                      >
                        <option value="">Selecione...</option>
                        {semesters.map(sem => (
                          <option key={sem.id} value={sem.id}>{sem.number}º Semestre ({sem.name})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSubjectCreator(false)}
                      className="px-3 py-1.5 border border-stone-200 text-stone-600 text-xs font-bold rounded-lg hover:bg-stone-50 cursor-pointer bg-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingSub}
                      className="px-3 py-1.5 bg-[#1A1A1A] text-white text-xs font-bold rounded-lg hover:bg-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isCreatingSub ? 'Criando...' : 'Adicionar'}
                    </button>
                  </div>
                </form>
              )}

              {/* Subject Grid */}
              <div className="space-y-3">
                {selectedSemesterId && filteredSubjects.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-stone-200 rounded-xl text-stone-400 text-xs">
                    Nenhuma matéria cadastrada neste semestre.<br />
                    Use o botão <strong className="text-stone-600">Criar Matéria</strong> acima para começar!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {(selectedSemesterId ? filteredSubjects : subjects).map((sub, sIdx) => {
                      const isSelected = selectedSubjectId === sub.id;
                      const semesterNum = semesters.find(sem => sem.id === sub.semesterId)?.number;
                      
                      return (
                        <button
                          key={`${sub.id || 'sub'}-${sIdx}`}
                          type="button"
                          onClick={() => {
                            setSelectedSubjectId(sub.id);
                            setSelectedSemesterId(sub.semesterId);
                          }}
                          className={`p-3 border rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-sm'
                              : 'bg-[#FDFDFD] border-[#E2E0D9] hover:bg-[#FBFBFA] text-stone-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs truncate leading-snug">{sub.name}</h4>
                            <p className={`text-[9px] font-mono mt-0.5 uppercase tracking-wide ${isSelected ? 'text-stone-300' : 'text-stone-400'}`}>
                              {semesterNum}º Semestre
                            </p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT: Gemini AI Personalization (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-[#1A1A1A] text-[#E4E3E0] p-6 rounded-2xl shadow-lg border border-stone-900 space-y-6">
              
              <div className="flex items-center justify-between border-b border-stone-850 pb-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-4 h-4 fill-amber-400" />
                    Preceptoria Inteligente
                  </h3>
                  <p className="text-[10px] text-stone-400 leading-none">
                    Configure a geração médica via Gemini
                  </p>
                </div>
                {/* Credit indicator */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-right shrink-0">
                  <span className="text-[8px] font-black uppercase text-stone-500 block leading-none">Seu Saldo</span>
                  <span className="text-xs font-mono font-black text-amber-400 leading-none block mt-0.5">
                    {loadingCredits ? '...' : `${availableCredits} cr`}
                  </span>
                </div>
              </div>

              {/* Generation Depth Selector */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Nível de Detalhamento do Resumo
                </span>
                
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'standard', label: 'Padrão (Standard)', desc: 'Resumo completo e estruturado ideal para revisão geral.', badge: '1cr', rawCost: 1 },
                    { id: 'deep', label: 'Aprofundado (Deep)', desc: 'Mais denso em dados e definições de diagnósticos diferenciais.', badge: '5cr', rawCost: 5 },
                    { id: 'elite', label: 'Clínica de Elite', desc: 'Raciocínio de alta performance para discussão em rounds.', badge: '10cr', rawCost: 10 },
                    { id: 'master', label: 'Preceptor Médico (Master)', desc: 'Caso clínico integrado, fluxogramas e correlação acadêmica pura.', badge: '50cr', rawCost: 50 },
                    { id: 'monograph', label: 'Tratado Médico (Monograph)', desc: 'Densidade máxima de conteúdo científico para embasamento profundo.', badge: '100cr', rawCost: 100 },
                    { id: 'custom_analyzed', label: 'Personalizado Inteligente', desc: 'Análise profunda e capítulos sob medida para você editar antes de gerar.', badge: 'Análise (Grátis)', rawCost: null }
                  ].map((opt) => {
                    const isSel = depth === opt.id;
                    const rawBase = opt.id === 'custom_analyzed' ? (customChapters.length > 0 ? customChapters.length * 5 : (analysisResult?.chapters?.length ? analysisResult.chapters.length * 5 : 'Pendente')) : (opt.rawCost || 1);
                    const calculatedOptionCost = typeof rawBase === 'number' ? Math.max(1, rawBase + getExtraCost()) : rawBase;
                    const isUnavailable = typeof calculatedOptionCost === 'number' && availableCredits < calculatedOptionCost;
                    
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setDepth(opt.id as any);
                          setWizardError(null);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 relative ${
                          isSel
                            ? 'bg-amber-400/10 border-amber-400 text-white shadow-sm'
                            : 'bg-stone-900 border-stone-850 hover:bg-stone-850 text-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold ${isSel ? 'text-amber-400' : 'text-stone-200'}`}>{opt.label}</span>
                            {isSel && <Check className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                          <span className={`text-[8.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            isSel ? 'bg-amber-400/20 text-amber-400' : 'bg-stone-800 text-stone-400'
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-400 leading-snug">{opt.desc}</p>
                        
                        {/* Display specific credit cost for active alert level */}
                        <div className="flex items-center justify-between w-full border-t border-stone-800/50 pt-1.5 mt-1 text-[9px] font-mono">
                          <span className="text-stone-500">Custo Final Estimado:</span>
                          <span className={`font-bold ${isUnavailable && isSel ? 'text-red-400' : 'text-amber-400'}`}>
                            {calculatedOptionCost} {typeof calculatedOptionCost === 'number' ? 'créditos' : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Intelligent Pre-Analysis Section */}
              {depth === 'custom_analyzed' && (
                <div className="border-t border-stone-850 pt-4 space-y-3 bg-stone-900/40 p-4 rounded-xl border border-stone-850">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-stone-200">Preceptoria Personalizada</h4>
                  </div>
                  
                  {!analysisResult ? (
                    <div className="space-y-3">
                      <p className="text-[10px] text-stone-400 leading-relaxed">
                        A inteligência mapeará o tema e montará um escopo de capítulos ideal. Você poderá adicionar ou remover tópicos antes de gerar o conteúdo final.
                      </p>
                      
                      <button
                        type="button"
                        disabled={isAnalyzing}
                        onClick={handleRunPreAnalysis}
                        className="w-full h-10 bg-amber-400 hover:bg-amber-500 text-black font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow disabled:opacity-55"
                      >
                        {isAnalyzing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            Analisando complexidade...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 fill-black" />
                            Analisar Tema (Consome 5cr)
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Summary insights */}
                      <div className="p-3 bg-stone-900 rounded-lg space-y-1 border border-stone-800">
                        <span className="text-[8px] uppercase tracking-wider text-stone-500 font-bold">Diagnóstico do Tema</span>
                        <p className="text-[10px] text-stone-300 leading-relaxed italic">"{analysisResult.justification}"</p>
                      </div>

                      {/* Chapters Editable list */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 block">Capítulos sob medida (Edite livremente)</span>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {customChapters.map((ch, idx) => (
                            <div key={`chapter-${idx}-${ch}`} className="flex items-center justify-between p-2 bg-stone-900 border border-stone-850 rounded-lg gap-2 text-[11px]">
                              <span className="text-stone-300 truncate font-mono">{ch}</span>
                              <button
                                type="button"
                                onClick={() => setCustomChapters(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1 hover:bg-stone-800 text-stone-400 hover:text-red-400 rounded transition-all cursor-pointer"
                                title="Excluir Capítulo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add Custom Chapter */}
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newChapterText}
                            onChange={(e) => setNewChapterText(e.target.value)}
                            placeholder="Adicionar novo capítulo..."
                            className="flex-1 h-8 px-2 bg-stone-900 border border-stone-800 rounded text-[11px] focus:outline-none focus:border-stone-600 text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newChapterText.trim()) {
                                setCustomChapters(prev => [...prev, newChapterText.trim()]);
                                setNewChapterText('');
                              }
                            }}
                            className="h-8 px-2.5 bg-stone-800 text-white text-xs font-bold rounded hover:bg-stone-700 transition-colors cursor-pointer"
                          >
                            Add
                          </button>
                        </div>

                        {/* Suggested Extra Chapters Block */}
                        {analysisResult?.suggestedExtraChapters && analysisResult.suggestedExtraChapters.length > 0 && (
                          <div className="mt-3 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-300 text-[10px] flex items-center gap-1.5 uppercase tracking-wider">
                                <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                                Sugestões da Preceptoria IA
                              </span>
                              <span className="text-[9px] text-amber-400/80 font-mono">
                                Inserção sequencial ideal
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {analysisResult.suggestedExtraChapters.map((extra: any, eIdx: number) => {
                                const totalCh = customChapters.length;
                                const targetPos = Math.max(0, Math.min(extra.insertAtIndex || 0, totalCh));
                                const posText = targetPos === 0 
                                  ? "Início (Cap. 1)" 
                                  : targetPos >= totalCh
                                  ? `Final (Cap. ${totalCh + 1})`
                                  : `Entre Cap. ${targetPos} e Cap. ${targetPos + 1}`;

                                return (
                                  <div key={eIdx} className="bg-stone-900 p-2 rounded-lg border border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px]">
                                    <div className="space-y-0.5 flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-stone-200">{extra.title}</span>
                                        <span className="text-[8px] font-mono font-bold bg-amber-900/60 text-amber-200 px-1.5 py-0.5 rounded">
                                          📍 {posText}
                                        </span>
                                      </div>
                                      {extra.reason && (
                                        <p className="text-[9px] text-stone-400 leading-tight">
                                          {extra.reason}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddSuggestedExtraInSync(extra, eIdx)}
                                      className="h-6 px-2 bg-amber-400 hover:bg-amber-500 text-black text-[10px] font-bold rounded flex items-center gap-1 shrink-0 self-start sm:self-center cursor-pointer transition-all"
                                    >
                                      <Plus className="w-3 h-3" /> Adicionar na Posição
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Casos Clínicos style */}
              <div className="border-t border-stone-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    Casos Clínicos por Patologia
                  </span>
                  <span className="text-[9px] font-mono text-stone-500">Exemplos Práticos</span>
                </div>
                
                <div className="space-y-2">
                  {[
                    { id: 'minimum', label: 'Sem Casos (Apenas Teoria)', impact: '-3 créditos' },
                    { id: 'moderate', label: '1 Caso por Patologia (Equilibrado)', impact: '+0 créditos' },
                    { id: 'maximum', label: 'Casos Detalhados (Anamnese & Conduta)', impact: '+10 créditos' }
                  ].map((lvl) => {
                    const isSel = illustrationLevel === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setIllustrationLevel(lvl.id as any)}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isSel
                            ? 'bg-amber-400/10 border-amber-400 text-white font-bold'
                            : 'bg-stone-900/60 border-stone-850 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSel ? 'border-amber-400' : 'border-stone-700'}`}>
                            {isSel && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                          </div>
                          <span>{lvl.label}</span>
                        </div>
                        <span className={`text-[9px] font-mono ${isSel ? 'text-amber-400' : 'text-stone-500'}`}>{lvl.impact}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Alert style */}
              <div className="border-t border-stone-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-stone-400" />
                    Intensidade de Alertas Clínicos
                  </span>
                  <span className="text-[9px] font-mono text-stone-500">Quadros Laranjas</span>
                </div>
                
                <div className="space-y-2">
                  {[
                    { id: 'off', label: 'Desativado (Sem Alertas)', impact: '-2 créditos' },
                    { id: 'light', label: 'Essencial (Frequência Leve)', impact: '+0 créditos' },
                    { id: 'moderate', label: 'Moderado (Frequentes)', impact: '+2 créditos' },
                    { id: 'academic', label: 'Avançado (Acadêmicos)', impact: '+5 créditos' },
                    { id: 'extreme', label: 'Rigor Extremo (Elite)', impact: '+10 créditos' }
                  ].map((lvl) => {
                    const isSel = alertBoxLevel === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setAlertBoxLevel(lvl.id as any)}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isSel
                            ? 'bg-amber-400/10 border-amber-400 text-white font-bold'
                            : 'bg-stone-900/60 border-stone-850 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSel ? 'border-amber-400' : 'border-stone-700'}`}>
                            {isSel && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                          </div>
                          <span>{lvl.label}</span>
                        </div>
                        <span className={`text-[9px] font-mono ${isSel ? 'text-amber-400' : 'text-stone-500'}`}>{lvl.impact}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Insufficient credits upgrade warning */}
              {!loadingCredits && availableCredits < currentSelectionCost && (
                <div className="p-4 bg-amber-450/10 border border-amber-400/30 rounded-2xl space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <h4 className="text-xs font-black text-white">Upgrade Recomendado ⭐</h4>
                      <p className="text-[10px] text-stone-300 leading-relaxed mt-0.5">
                        Sua geração exige <strong>{currentSelectionCost} créditos</strong>, mas seu saldo atual é de apenas <strong>{availableCredits} créditos</strong>.
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-stone-400 leading-relaxed">
                    Assine o <strong>MedRevise PRO</strong> e garanta acesso completo ILIMITADO (até 300 gerações diárias) para potencializar seu internato clínico!
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowUpgradeModal(true)}
                    className="w-full h-9 bg-amber-400 hover:bg-amber-500 text-black font-black text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 border border-amber-500 shadow"
                  >
                    Fazer Upgrade para o Plano PRO 🚀
                  </button>
                </div>
              )}

            </div>

          </div>

        </div>

        {/* FOOTER ACTIONS: Stick on bottom of the container */}
        <div className="border-t border-[#E2E0D9] pt-6 mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-stone-500 max-w-md text-center md:text-left">
            💡 Ao confirmar a criação inteligente, o MedInternato irá atualizar este tópico com o semestre e disciplina selecionados e iniciar o processamento Gemini para fabricar seu material de apoio imediatamente.
          </p>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="px-5 h-12 border border-[#E2E0D9] bg-white text-stone-800 text-xs font-mono font-bold uppercase rounded-xl hover:bg-stone-50 hover:border-stone-400 transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
            >
              Apenas Salvar & Organizar
            </button>
            <button
              type="button"
              disabled={isSubmitting || (availableCredits < currentSelectionCost)}
              onClick={() => handleSave(true)}
              className={`px-6 h-12 text-xs font-mono font-bold uppercase rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 border disabled:opacity-40 ${
                availableCredits >= currentSelectionCost
                  ? 'bg-amber-400 hover:bg-amber-500 text-black border-amber-500 animate-pulse-subtle'
                  : 'bg-stone-800 text-stone-500 border-stone-850 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4 fill-black text-black" />
              {isSubmitting ? 'Gerando Resumo...' : `Criar & Gerar (${currentSelectionCost}cr)`}
            </button>
          </div>
        </div>

      </div>

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-stone-900">Seja MedRevise PRO ⭐</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Você atingiu o limite de créditos do seu plano atual. Ative a sua assinatura PRO agora mesmo e ganhe:
              </p>
            </div>
            <ul className="text-xs text-stone-600 space-y-2 font-medium bg-stone-50 p-3.5 rounded-2xl border border-stone-150">
              <li className="flex items-center gap-2">✓ <strong>Até 300 gerações diárias</strong> de resumos clínicos</li>
              <li className="flex items-center gap-2">✓ Preceptoria de Elite, Master & Tratados Médicos</li>
              <li className="flex items-center gap-2">✓ Flashcards e Questões de residência ilimitadas</li>
              <li className="flex items-center gap-2">✓ Suporte prioritário e novas atualizações constantes</li>
            </ul>
            <div className="bg-amber-50 border border-amber-250 p-3 rounded-2xl text-[11px] text-amber-850 leading-relaxed font-medium">
              💡 <strong>Como ativar?</strong> Acesse a aba <strong>Meu Perfil</strong> na tela inicial e realize a ativação via PIX ou Mercado Pago! É rápido, seguro e automático.
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 h-11 border border-stone-200 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  onCancel(); // exit wizard so they can go to profile
                }}
                className="flex-1 h-11 bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold rounded-xl transition-colors shadow-md border border-amber-500 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Ir para Meu Perfil
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
