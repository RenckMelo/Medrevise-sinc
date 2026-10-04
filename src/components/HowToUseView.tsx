import React, { useState } from 'react';
import { 
  BookOpen, 
  Layers, 
  HelpCircle, 
  Compass, 
  FileText, 
  Calendar, 
  Brain, 
  Target, 
  Zap, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  GraduationCap,
  MousePointer,
  ChevronDown,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HowToUseViewProps {
  onStartActionTour: (tourId: string, module: 'medinternato' | 'medrevise') => void;
  onNavigateToProfile: () => void;
  userProfile?: any;
  isAdmin?: boolean;
}

export default function HowToUseView({ 
  onStartActionTour, 
  onNavigateToProfile, 
  userProfile, 
  isAdmin 
}: HowToUseViewProps) {
  const [activeGuideModule, setActiveGuideModule] = useState<'medinternato' | 'medrevise'>('medinternato');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');
  const [upgradeModalInfo, setUpgradeModalInfo] = useState<{ isOpen: boolean; featureName: string; requiredPlan: string } | null>(null);

  // Check if user has permission to access a module feature
  const checkFeaturePermission = (module: 'medinternato' | 'medrevise', featureName: string) => {
    if (isAdmin) return true;

    const isPremium = userProfile?.isPremium || false;
    const planType = userProfile?.planType || 'free';

    if (!isPremium && planType === 'free') {
      return false;
    }

    if (module === 'medinternato') {
      if (planType === 'medrevise') {
        return false;
      }
    } else if (module === 'medrevise') {
      if (planType === 'medinternato') {
        return false;
      }
    }

    return true;
  };

  const handleActionBtnClick = (tourId: string, module: 'medinternato' | 'medrevise', featureName: string) => {
    const hasAccess = checkFeaturePermission(module, featureName);
    if (!hasAccess) {
      const requiredPlan = module === 'medinternato' ? 'MedInternato Pro' : 'MedRevise Pro';
      setUpgradeModalInfo({
        isOpen: true,
        featureName,
        requiredPlan
      });
      return;
    }

    localStorage.setItem('active_action_tour_id', tourId);
    onStartActionTour(tourId, module);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="bg-[#141414] text-white p-6 sm:p-8 rounded-3xl border-2 border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D44E3D] bg-white/10 border border-white/15 px-3 py-1 rounded-full">
              CENTRAL DO ESTUDANTE
            </span>
            <span className="text-xs font-mono font-bold text-stone-300">MedRevise & MedInternato</span>
          </div>

          <h1 className="font-serif italic font-bold text-2xl sm:text-4xl text-white">
            Como Usar a Plataforma & Guia de Estudo
          </h1>

          <p className="text-xs sm:text-sm text-stone-300 font-sans leading-relaxed max-w-3xl">
            Aprenda a explorar todas as ferramentas do sistema, conheça o fluxo ideal de estudos sugerido para o seu perfil e acione tutoriais interativos guiados diretamente na sua tela.
          </p>
        </div>
      </div>

      {/* SECTION 1: BOTÕES INTERATIVOS DE TUTORIAL GUIADO */}
      <div className="bg-white border-2 border-[#141414] rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] space-y-6">
        <div className="flex items-center justify-between border-b-2 border-stone-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D44E3D] text-white rounded-2xl shadow-xs">
              <MousePointer className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-[#D44E3D] block">
                TUTORIAIS GUIADOS NA TELA
              </span>
              <h2 className="font-serif italic font-bold text-xl sm:text-2xl text-[#141414]">
                Qual função você deseja aprender a usar agora?
              </h2>
            </div>
          </div>
          <span className="hidden md:inline-block text-[11px] font-mono font-bold text-stone-500 bg-stone-100 px-3 py-1 rounded-lg border border-stone-200">
            CLIQUE PARA INICIAR O TUTORIAL
          </span>
        </div>

        <p className="text-xs text-stone-600 font-sans leading-relaxed">
          Ao clicar em um dos botões abaixo, a plataforma te guiará passo a passo até a tela correspondente, destacando onde clicar e o que preencher na sua rotina de estudos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* MedInternato Guided Actions */}
          <div className="bg-[#FAF9F5] border-2 border-rose-200 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center gap-2 border-b border-rose-200 pb-2.5">
              <span className="w-3 h-3 rounded-full bg-[#D44E3D]"></span>
              <h3 className="font-serif italic font-bold text-base text-[#141414]">
                Funções do MedInternato
              </h3>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleActionBtnClick('internato-resumos', 'medinternato', 'Resumos Teóricos com IA')}
                className="w-full p-3 bg-white hover:bg-rose-50 border-2 border-stone-200 hover:border-[#D44E3D] rounded-xl text-left text-xs font-bold text-stone-900 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#D44E3D] shrink-0" />
                  <span>Como fazer resumos teóricos com IA?</span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#D44E3D] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              <button
                onClick={() => handleActionBtnClick('internato-cronograma', 'medinternato', 'Planejamentos de Estudo')}
                className="w-full p-3 bg-white hover:bg-rose-50 border-2 border-stone-200 hover:border-[#D44E3D] rounded-xl text-left text-xs font-bold text-stone-900 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-[#D44E3D] shrink-0" />
                  <span>Como criar planejamentos de estudo?</span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#D44E3D] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              <button
                onClick={() => handleActionBtnClick('internato-materias', 'medinternato', 'Matérias e Tópicos no Internato')}
                className="w-full p-3 bg-white hover:bg-rose-50 border-2 border-stone-200 hover:border-[#D44E3D] rounded-xl text-left text-xs font-bold text-stone-900 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#D44E3D] shrink-0" />
                  <span>Como criar matérias e tópicos no MedInternato?</span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#D44E3D] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              <button
                onClick={() => handleActionBtnClick('internato-questoes', 'medinternato', 'Banco de Questões das Bancas')}
                className="w-full p-3 bg-white hover:bg-rose-50 border-2 border-stone-200 hover:border-[#D44E3D] rounded-xl text-left text-xs font-bold text-stone-900 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Target className="w-4 h-4 text-[#D44E3D] shrink-0" />
                  <span>Como criar e praticar questões das bancas?</span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#D44E3D] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              <button
                onClick={() => handleActionBtnClick('internato-flashcards', 'medinternato', 'Flashcards de Memorização')}
                className="w-full p-3 bg-white hover:bg-rose-50 border-2 border-stone-200 hover:border-[#D44E3D] rounded-xl text-left text-xs font-bold text-stone-900 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Brain className="w-4 h-4 text-[#D44E3D] shrink-0" />
                  <span>Como criar e praticar flashcards?</span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#D44E3D] group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            </div>
          </div>

          {/* MedRevise Guided Actions */}
          <div className="bg-[#FAF9F5] border-2 border-emerald-200 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center gap-2 border-b border-emerald-200 pb-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
              <h3 className="font-serif italic font-bold text-base text-[#141414]">
                Funções do MedRevise
              </h3>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleActionBtnClick('revise-semestres', 'medrevise', 'Estruturação de Semestres')}
                className="w-full p-3 bg-white hover:bg-emerald-50 border-2 border-stone-200 hover:border-emerald-600 rounded-xl text-left text-xs font-bold text-stone-900 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Como criar semestres no MedRevise?</span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              <button
                onClick={() => handleActionBtnClick('revise-materias', 'medrevise', 'Matérias e Tópicos no MedRevise')}
                className="w-full p-3 bg-white hover:bg-emerald-50 border-2 border-stone-200 hover:border-emerald-600 rounded-xl text-left text-xs font-bold text-stone-900 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Como criar matérias e tópicos no MedRevise?</span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              <button
                onClick={() => handleActionBtnClick('revise-registros', 'medrevise', 'Registros de Estudo e Revisões Espaçadas')}
                className="w-full p-3 bg-white hover:bg-emerald-50 border-2 border-stone-200 hover:border-emerald-600 rounded-xl text-left text-xs font-bold text-stone-900 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Como registrar estudo primário, revisões e simulados?</span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: GUIAS DAS FUNCIONALIDADES */}
      <div className="bg-white border-2 border-[#141414] rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-stone-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#141414] text-white rounded-2xl shadow-xs">
              <BookOpen className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-[#141414] block">
                MANUAL DETALHADO
              </span>
              <h2 className="font-serif italic font-bold text-xl sm:text-2xl text-[#141414]">
                Guias das Funcionalidades por Módulo
              </h2>
            </div>
          </div>

          <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-300 font-mono text-xs font-bold shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setActiveGuideModule('medinternato')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeGuideModule === 'medinternato'
                  ? 'bg-[#D44E3D] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              MEDINTERNATO
            </button>
            <button
              onClick={() => setActiveGuideModule('medrevise')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                activeGuideModule === 'medrevise'
                  ? 'bg-[#141414] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              MEDREVISE
            </button>
          </div>
        </div>

        {activeGuideModule === 'medinternato' ? (
          <div className="space-y-4">
            <div className="bg-[#FAF9F5] border-2 border-stone-200 rounded-2xl p-5 space-y-2">
              <h3 className="font-serif italic font-bold text-lg text-[#141414] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#D44E3D]" />
                1. Resumos Teóricos com Inteligência Artificial
              </h3>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                A IA pode gerar resumos em <strong>qualquer formato de sua escolha</strong> (focado em pontos de prova, síntese em tópicos, condutas clínicas beira-leito ou exaustivo). Você pode enviar anotações, fornecer um tema ou carregar documentos e livros em formato PDF.
              </p>
            </div>

            <div className="bg-[#FAF9F5] border-2 border-stone-200 rounded-2xl p-5 space-y-2">
              <h3 className="font-serif italic font-bold text-lg text-[#141414] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#D44E3D]" />
                2. Gerador de Planejamentos de Estudo
              </h3>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                Monte seu cronograma de estudos personalizado indicando suas semanas/rodízios do internato, tempo livre semanal e a data limite da prova de residência.
              </p>
            </div>

            <div className="bg-[#FAF9F5] border-2 border-stone-200 rounded-2xl p-5 space-y-2">
              <h3 className="font-serif italic font-bold text-lg text-[#141414] flex items-center gap-2">
                <Target className="w-5 h-5 text-[#D44E3D]" />
                3. Banco de Questões Oficiais das Bancas
              </h3>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                Pratique com questões oficiais filtradas pelas suas 8 bancas de preferência cadastradas no perfil. Alterne entre Modo Treino e Modo Simulado cronometrado com comentários dissecados sem emojis.
              </p>
            </div>

            <div className="bg-[#FAF9F5] border-2 border-stone-200 rounded-2xl p-5 space-y-2">
              <h3 className="font-serif italic font-bold text-lg text-[#141414] flex items-center gap-2">
                <Brain className="w-5 h-5 text-[#D44E3D]" />
                4. Flashcards de Memorização Ativa
              </h3>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                Produza flashcards manuais ou crie decks automaticamente via IA dentro do resumo teórico para fixar dosagens, condutas e critérios diagnósticos.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#FAF9F5] border-2 border-stone-200 rounded-2xl p-5 space-y-2">
              <h3 className="font-serif italic font-bold text-lg text-[#141414] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                1. Estruturação de Semestres
              </h3>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                Defina os semestres ou ciclos letivos acadêmicos para organizar suas disciplinas e provas.
              </p>
            </div>

            <div className="bg-[#FAF9F5] border-2 border-stone-200 rounded-2xl p-5 space-y-2">
              <h3 className="font-serif italic font-bold text-lg text-[#141414] flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                2. Cadastro de Matérias e Tópicos
              </h3>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                Cadastre as disciplinas e tópicos específicos para que o algoritmo do MedRevise monitore o Risco de Esquecimento de cada matéria em tempo real.
              </p>
            </div>

            <div className="bg-[#FAF9F5] border-2 border-stone-200 rounded-2xl p-5 space-y-2">
              <h3 className="font-serif italic font-bold text-lg text-[#141414] flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                3. Registros de Estudo e Repetição Espaçada
              </h3>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                Clique em 'Estudar' no primeiro contato teórico e em 'Revisar' ao fazer questões de fixação informando seus acertos. O algoritmo recalcula automaticamente os ciclos de revisão em 24h, 7d, 15d e 30d.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: FLUXO IDEAL SUGERIDO */}
      <div className="bg-white border-2 border-[#141414] rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] space-y-6">
        <div className="flex items-center gap-3 border-b-2 border-stone-200 pb-4">
          <div className="p-2.5 bg-[#D44E3D] text-white rounded-2xl shadow-xs">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-[#D44E3D] block">
              METODOLOGIA CIENTÍFICA
            </span>
            <h2 className="font-serif italic font-bold text-xl sm:text-2xl text-[#141414]">
              Fluxos Sugeridos de Acordo com a Sua Assinatura
            </h2>
          </div>
        </div>

        {/* Workflow 1 */}
        <div className="bg-[#FAF9F5] border-2 border-stone-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-300 pb-2.5">
            <h3 className="font-serif italic font-bold text-base text-[#141414]">
              Fluxo MedRevise (Foco em Repetição Espaçada)
            </h3>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md">
              CURVA DE EBBINGHAUS
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 bg-white border border-stone-200 rounded-xl">
              <span className="font-mono text-[9px] font-bold text-stone-400 block">PASSO 01</span>
              <strong className="text-stone-900 block mt-0.5">Criar Semestre</strong>
              <p className="text-[11px] text-stone-600 mt-0.5">Cadastre o período letivo ativo.</p>
            </div>
            <div className="p-2.5 bg-white border border-stone-200 rounded-xl">
              <span className="font-mono text-[9px] font-bold text-stone-400 block">PASSO 02</span>
              <strong className="text-stone-900 block mt-0.5">Criar Matéria & Tópico</strong>
              <p className="text-[11px] text-stone-600 mt-0.5">Estruture os assuntos de estudo.</p>
            </div>
            <div className="p-2.5 bg-white border border-stone-200 rounded-xl">
              <span className="font-mono text-[9px] font-bold text-stone-400 block">PASSO 03</span>
              <strong className="text-stone-900 block mt-0.5">Registrar Estudo</strong>
              <p className="text-[11px] text-stone-600 mt-0.5">Clique em 'Estudar' na leitura inicial.</p>
            </div>
            <div className="p-2.5 bg-white border border-stone-200 rounded-xl">
              <span className="font-mono text-[9px] font-bold text-stone-400 block">PASSO 04</span>
              <strong className="text-stone-900 block mt-0.5">Executar Revisões</strong>
              <p className="text-[11px] text-stone-600 mt-0.5">Aperte 'Revisar' nos alertas do painel.</p>
            </div>
          </div>
        </div>

        {/* Workflow 2 */}
        <div className="bg-[#FAF9F5] border-2 border-stone-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-300 pb-2.5">
            <h3 className="font-serif italic font-bold text-base text-[#141414]">
              Fluxo MedInternato (Foco em Prática e Provas)
            </h3>
            <span className="text-[10px] font-mono font-bold text-[#D44E3D] bg-rose-100 px-2.5 py-0.5 rounded-md">
              BANCAS & PROVAS
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 bg-white border border-stone-200 rounded-xl">
              <span className="font-mono text-[9px] font-bold text-stone-400 block">PASSO 01</span>
              <strong className="text-stone-900 block mt-0.5">Gerar Planejamento</strong>
              <p className="text-[11px] text-stone-600 mt-0.5">Defina as semanas e rodízios.</p>
            </div>
            <div className="p-2.5 bg-white border border-stone-200 rounded-xl">
              <span className="font-mono text-[9px] font-bold text-stone-400 block">PASSO 02</span>
              <strong className="text-stone-900 block mt-0.5">Gerar Resumo com IA</strong>
              <p className="text-[11px] text-stone-600 mt-0.5">Gere o resumo no formato desejado.</p>
            </div>
            <div className="p-2.5 bg-white border border-stone-200 rounded-xl">
              <span className="font-mono text-[9px] font-bold text-stone-400 block">PASSO 03</span>
              <strong className="text-stone-900 block mt-0.5">Praticar Questões</strong>
              <p className="text-[11px] text-stone-600 mt-0.5">Resolva o lote das suas 8 bancas.</p>
            </div>
            <div className="p-2.5 bg-white border border-stone-200 rounded-xl">
              <span className="font-mono text-[9px] font-bold text-stone-400 block">PASSO 04</span>
              <strong className="text-stone-900 block mt-0.5">Revisar Flashcards</strong>
              <p className="text-[11px] text-stone-600 mt-0.5">Fixe os pontos de dificuldade.</p>
            </div>
          </div>
        </div>

        {/* Workflow 3: Combo Completo */}
        <div className="bg-[#141414] text-white border-2 border-[#141414] rounded-2xl p-6 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-white/15 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-serif italic font-bold text-lg text-white">
                Fluxo Combo Completo (O Fluxo de Estudo Perfeito)
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-amber-400 bg-white/10 px-2.5 py-1 rounded-md border border-white/15">
              SINERGIA TOTAL
            </span>
          </div>

          <p className="text-xs text-stone-300 font-sans leading-relaxed">
            A integração perfeita entre absorção rápida de conteúdo no MedInternato e sistematização de memória de longo prazo no MedRevise:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 border border-white/15 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#D44E3D] text-white font-mono text-xs font-bold flex items-center justify-center">1</span>
                <strong className="text-sm text-white">Fase 1: Preparação no MedInternato</strong>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed font-sans">
                Estude o tema, gere o resumo no formato de sua preferência, resolva o lote de questões direcionadas das suas bancas preferidas e crie flashcards para os conceitos em que tiver dificuldade.
              </p>
            </div>

            <div className="p-4 bg-white/5 border border-white/15 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-mono text-xs font-bold flex items-center justify-center">2</span>
                <strong className="text-sm text-white">Fase 2: Consolidação no MedRevise</strong>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed font-sans">
                Vincule o tema ao seu semestre ativo do MedRevise, registre a data do estudo primário e acompanhe as notificações de revisões espaçadas para manter retenção acima de 90% até a prova de residência.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: PERGUNTAS FREQUENTES (FAQ) */}
      <div className="bg-white border-2 border-[#141414] rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] space-y-6">
        <div className="flex items-center gap-3 border-b-2 border-stone-200 pb-4">
          <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xs">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-indigo-600 block">
              DÚVIDAS E RESPOSTAS
            </span>
            <h2 className="font-serif italic font-bold text-xl sm:text-2xl text-[#141414]">
              Perguntas Frequentes
            </h2>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 'faq-1',
              q: 'Como funciona a Curva do Esquecimento no MedRevise?',
              a: 'Sempre que você conclui um tópico ou faz questões de revisão, o sistema calcula ciclos de repetição espaçada em 24h, 7d, 15d e 30d. O algoritmo recalibra esses intervalos de acordo com a sua porcentagem de acertos informada.'
            },
            {
              id: 'faq-2',
              q: 'Como funciona o Vínculo entre MedRevise e MedInternato?',
              a: 'A ferramenta Vínculo conecta disciplinas teóricas do MedRevise aos rodízios do MedInternato. Quando duas matérias estão vinculadas, seus resumos, questões e revisões pendentes são sincronizados automaticamente nos dois módulos.'
            },
            {
              id: 'faq-3',
              q: 'Meus dados ficam salvos de forma segura?',
              a: 'Sim! Todos os seus planejamentos, resumos, questões, flashcards e estatísticas são salvos em tempo real na nuvem no Firebase, permitindo o acesso de qualquer dispositivo.'
            }
          ].map(faq => {
            const isExpanded = expandedFaqId === faq.id;
            return (
              <div 
                key={faq.id}
                className="bg-[#FAF9F5] border-2 border-stone-200 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer bg-white hover:bg-stone-50 transition-all font-serif italic font-bold text-base text-[#141414]"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${isExpanded ? 'rotate-180 text-[#141414]' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="p-4 border-t border-stone-200 text-xs text-stone-700 font-sans leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* UPGRADE INVITATION POPOVER / MODAL */}
      <AnimatePresence>
        {upgradeModalInfo?.isOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#141414]/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border-2 border-[#141414] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[10px_10px_0px_0px_rgba(20,20,20,1)] space-y-5 text-center relative overflow-hidden"
            >
              <button
                onClick={() => setUpgradeModalInfo(null)}
                className="absolute right-4 top-4 p-2 text-stone-400 hover:text-stone-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-14 h-14 bg-rose-50 border-2 border-rose-200 text-[#D44E3D] rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase text-[#D44E3D] bg-rose-50 border border-rose-200 px-3 py-0.5 rounded-full">
                  RECURSO EXCLUSIVO PRO
                </span>
                <h3 className="font-serif italic font-bold text-xl text-[#141414]">
                  {upgradeModalInfo.featureName}
                </h3>
                <p className="text-xs text-stone-600 font-sans leading-relaxed">
                  O seu plano atual não contempla esta funcionalidade. Para ter acesso a este recurso no <strong>{upgradeModalInfo.requiredPlan}</strong> e desbloquear o ecossistema completo de estudos, faça o upgrade da sua assinatura!
                </p>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  onClick={() => {
                    setUpgradeModalInfo(null);
                    onNavigateToProfile();
                  }}
                  className="w-full py-3.5 bg-[#141414] hover:bg-[#D44E3D] text-white font-mono text-xs font-bold uppercase rounded-xl transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(212,78,61,1)] flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Conhecer Planos & Fazer Upgrade</span>
                </button>

                <button
                  onClick={() => setUpgradeModalInfo(null)}
                  className="w-full py-2 text-xs font-mono font-bold text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Continuar Explorando
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
