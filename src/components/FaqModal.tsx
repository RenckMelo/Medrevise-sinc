import React, { useState, useMemo } from 'react';
import { 
  HelpCircle, 
  Search, 
  X, 
  Calendar, 
  Brain, 
  ArrowLeftRight, 
  Sparkles, 
  CheckCircle2, 
  ChevronDown, 
  BookOpen, 
  BarChart3, 
  ShieldCheck,
  Zap,
  GraduationCap,
  Layers,
  FileText,
  Target,
  Compass,
  ArrowRight,
  RotateCcw,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour?: () => void;
}

export default function FaqModal({ isOpen, onClose, onStartTour }: FaqModalProps) {
  const [activeTab, setActiveTab] = useState<'guias' | 'fluxos' | 'tour' | 'faq'>('guias');
  const [activeModule, setActiveModule] = useState<'medinternato' | 'medrevise'>('medinternato');
  const [expandedGuideId, setExpandedId] = useState<string | null>('resumos');
  const [searchQuery, setSearchQuery] = useState('');

  const handleLaunchTour = () => {
    onClose();
    if (onStartTour) {
      onStartTour();
    } else {
      window.dispatchEvent(new CustomEvent('start-onboarding-tour'));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-[#141414]/75 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="bg-[#FAF9F5] border-2 border-[#141414] rounded-3xl w-full max-w-4xl shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] overflow-hidden flex flex-col max-h-[92vh] my-auto"
        >
          {/* Header Bar */}
          <div className="p-5 sm:p-6 bg-[#141414] text-white border-b-2 border-[#141414] flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#D44E3D] text-white flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] shrink-0 font-bold">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D44E3D] bg-white/10 border border-white/15 px-2.5 py-0.5 rounded-full">
                  CENTRAL DE AJUDA & COMO USAR
                </span>
                <h2 className="font-serif italic text-xl sm:text-2xl font-bold text-white mt-0.5">
                  Guia do Sistema & Fluxos de Estudo
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-stone-300 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer border border-white/20"
              title="Fechar Guia"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Category Navigation Tabs */}
          <div className="bg-[#FAF9F5] border-b border-stone-300 p-2 sm:p-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            <button
              onClick={() => setActiveTab('guias')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer border ${
                activeTab === 'guias'
                  ? 'bg-[#141414] text-white border-[#141414] shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <BookOpen className="w-4 h-4 text-[#D44E3D]" />
              <span>GUIAS DAS FUNCIONALIDADES</span>
            </button>

            <button
              onClick={() => setActiveTab('fluxos')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer border ${
                activeTab === 'fluxos'
                  ? 'bg-[#141414] text-white border-[#141414] shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-600" />
              <span>FLUXO IDEAL SUGERIDO</span>
            </button>

            <button
              onClick={() => setActiveTab('tour')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer border ${
                activeTab === 'tour'
                  ? 'bg-[#141414] text-white border-[#141414] shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              <span>TUTORIAL NA TELA</span>
            </button>

            <button
              onClick={() => setActiveTab('faq')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer border ${
                activeTab === 'faq'
                  ? 'bg-[#141414] text-white border-[#141414] shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span>PERGUNTAS FREQUENTES</span>
            </button>
          </div>

          {/* TAB 1: GUIAS DAS FUNCIONALIDADES */}
          {activeTab === 'guias' && (
            <div className="flex flex-col flex-1 overflow-y-auto">
              {/* Module Toggle */}
              <div className="p-4 bg-white border-b border-stone-200 flex items-center justify-between gap-3 shrink-0">
                <span className="text-xs font-mono font-bold text-stone-600 uppercase">
                  Selecione a plataforma para visualizar as orientações:
                </span>
                <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-300 text-xs font-bold font-mono">
                  <button
                    onClick={() => setActiveModule('medinternato')}
                    className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModule === 'medinternato'
                        ? 'bg-[#D44E3D] text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    MEDINTERNATO
                  </button>
                  <button
                    onClick={() => setActiveModule('medrevise')}
                    className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModule === 'medrevise'
                        ? 'bg-[#141414] text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    MEDREVISE
                  </button>
                </div>
              </div>

              {/* Module Guide Cards */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#FAF9F5] flex-1">
                {activeModule === 'medinternato' ? (
                  <>
                    {/* MedInternato Guide 1: Resumos */}
                    <div className="bg-white border-2 border-[#141414]/15 rounded-2xl overflow-hidden p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[#D44E3D] shrink-0 mt-0.5">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase text-[#D44E3D] tracking-wider">
                            MEDINTERNATO
                          </span>
                          <h3 className="font-serif italic font-bold text-lg text-[#141414]">
                            Como Fazer Resumos Teóricos com Inteligência Artificial
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed font-sans">
                        A inteligência artificial do MedInternato é capaz de estruturar resumos em <strong>qualquer formato de sua preferência</strong> — seja uma síntese objetiva focada em pontos de prova, um material exaustivo e profundo, condutas práticas beira-leito, mapas mentais em texto ou diretrizes completas.
                      </p>
                      <div className="p-4 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-stone-600 block">
                          Passo a Passo de Execução:
                        </span>
                        <ul className="space-y-2 text-xs text-stone-800">
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <span>Acesse o menu <strong>Resumos Teóricos</strong> na barra lateral do MedInternato.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <span>Clique no botão <strong>Gerar Novo Resumo</strong> ou em <strong>Importar PDF</strong>.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <span>Digite o tema desejado, cole suas anotações de aula ou anexe seu documento PDF de diretriz.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                            <span>Escolha o estilo de resumo desejado (focado, síntese por tópicos, condutas clínicas ou exaustivo) e confirme a geração.</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* MedInternato Guide 2: Planejamentos */}
                    <div className="bg-white border-2 border-[#141414]/15 rounded-2xl overflow-hidden p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 shrink-0 mt-0.5">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase text-amber-800 tracking-wider">
                            MEDINTERNATO
                          </span>
                          <h3 className="font-serif italic font-bold text-lg text-[#141414]">
                            Como Criar e Gerenciar Planejamentos de Estudo
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed font-sans">
                        O planejador distribui de forma automática e inteligente todos os temas do internato ou do seu edital de residência de acordo com o seu tempo livre semanal e a data limite das suas avaliações.
                      </p>
                      <div className="p-4 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-stone-600 block">
                          Passo a Passo de Execução:
                        </span>
                        <ul className="space-y-2 text-xs text-stone-800">
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <span>Acesse o menu <strong>Planejamento / Cronograma</strong> na barra lateral.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <span>Clique em <strong>Criar Novo Cronograma</strong>.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <span>Defina a data final da prova, sua carga horária diária e selecione as especialidades prioritárias.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                            <span>Acompanhe o cronograma semanal gerado e marque os tópicos conforme estuda.</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* MedInternato Guide 3: Matérias e Tópicos */}
                    <div className="bg-white border-2 border-[#141414]/15 rounded-2xl overflow-hidden p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 shrink-0 mt-0.5">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase text-blue-800 tracking-wider">
                            MEDINTERNATO
                          </span>
                          <h3 className="font-serif italic font-bold text-lg text-[#141414]">
                            Como Criar e Organizar Matérias e Tópicos
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed font-sans">
                        Organize seu acervo acadêmico dividindo as grandes disciplinas médicas em tópicos específicos para acompanhamento e vincular conteúdos.
                      </p>
                      <div className="p-4 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-stone-600 block">
                          Passo a Passo de Execução:
                        </span>
                        <ul className="space-y-2 text-xs text-stone-800">
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <span>Clique em <strong>Matérias & Editais</strong> no menu lateral.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <span>Clique no botão <strong>+ Nova Matéria</strong> para cadastrar a disciplina (ex: Pediatria).</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <span>Abra a matéria e clique em <strong>+ Adicionar Tópico</strong> (ex: Calendário Vacinal 2026).</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* MedInternato Guide 4: Questões */}
                    <div className="bg-white border-2 border-[#141414]/15 rounded-2xl overflow-hidden p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-[#141414] text-white shrink-0 mt-0.5">
                          <Target className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase text-[#141414] tracking-wider">
                            MEDINTERNATO
                          </span>
                          <h3 className="font-serif italic font-bold text-lg text-[#141414]">
                            Como Criar e Praticar Questões Oficiais das Bancas
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed font-sans">
                        Pratique com lote de questões autênticas filtrando pelas 8 bancas de residência selecionadas no seu perfil, com rotação automática e explicações detalhadas em texto limpo.
                      </p>
                      <div className="p-4 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-stone-600 block">
                          Passo a Passo de Execução:
                        </span>
                        <ul className="space-y-2 text-xs text-stone-800">
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <span>Acesse o módulo de <strong>Questões & Simulados</strong>.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <span>Selecione os temas desejados para estudo.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <span>No modo 'Personalizado', o sistema buscará questões nas bancas cadastradas no seu perfil. No modo 'Edital Oficial', escolha uma banca específica.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                            <span>Responda às questões e leia a análise detalhada de todas as alternativas.</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* MedInternato Guide 5: Flashcards */}
                    <div className="bg-white border-2 border-[#141414]/15 rounded-2xl overflow-hidden p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 shrink-0 mt-0.5">
                          <Brain className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase text-purple-800 tracking-wider">
                            MEDINTERNATO
                          </span>
                          <h3 className="font-serif italic font-bold text-lg text-[#141414]">
                            Como Criar e Praticar Flashcards de Memorização
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed font-sans">
                        Fixe critérios diagnósticos, doses e pegadinhas com a ferramenta de memorização ativa por flashcards.
                      </p>
                      <div className="p-4 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-stone-600 block">
                          Passo a Passo de Execução:
                        </span>
                        <ul className="space-y-2 text-xs text-stone-800">
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <span>Acesse o módulo <strong>Flashcards</strong> na barra lateral.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <span>Clique em <strong>Gerar Rápido com IA</strong> dentro de um resumo ou crie cards manuais no botão <strong>+ Criar Flashcard</strong>.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <span>Execute a sessão de estudo virando os cards e indicando o seu nível de facilidade.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* MedRevise Guide 1: Semestres */}
                    <div className="bg-white border-2 border-[#141414]/15 rounded-2xl overflow-hidden p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 shrink-0 mt-0.5">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 tracking-wider">
                            MEDREVISE
                          </span>
                          <h3 className="font-serif italic font-bold text-lg text-[#141414]">
                            Como Criar e Estruturar Semestres Acadêmicos
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed font-sans">
                        Os semestres organizam as disciplinas do seu período letivo ou ciclo de estudos preparatório no MedRevise.
                      </p>
                      <div className="p-4 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-stone-600 block">
                          Passo a Passo de Execução:
                        </span>
                        <ul className="space-y-2 text-xs text-stone-800">
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <span>Acesse o menu <strong>Matérias & Editais</strong> na barra lateral do MedRevise.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <span>Clique no botão <strong>+ Novo Semestre</strong>.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <span>Insira o nome do período (ex: "Internato - Módulo 1" ou "Ciclo 2026") e salve.</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* MedRevise Guide 2: Matérias e Tópicos */}
                    <div className="bg-white border-2 border-[#141414]/15 rounded-2xl overflow-hidden p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 shrink-0 mt-0.5">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase text-indigo-800 tracking-wider">
                            MEDREVISE
                          </span>
                          <h3 className="font-serif italic font-bold text-lg text-[#141414]">
                            Como Cadastrar Matérias e Tópicos no MedRevise
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed font-sans">
                        Cadastre cada disciplina e seus tópicos de estudo para que o algoritmo de repetição espaçada calcule os intervalos ideais de revisão.
                      </p>
                      <div className="p-4 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-stone-600 block">
                          Passo a Passo de Execução:
                        </span>
                        <ul className="space-y-2 text-xs text-stone-800">
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <span>Dentro do semestre ativo, clique em <strong>+ Criar Matéria</strong> (ex: Ginecologia).</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <span>Abra o card da matéria criada e clique em <strong>+ Adicionar Tópico</strong> (ex: Hemorragias do Primeiro Trimestre).</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* MedRevise Guide 3: Registrar Estudo/Revisão */}
                    <div className="bg-white border-2 border-[#141414]/15 rounded-2xl overflow-hidden p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-[#141414] text-white shrink-0 mt-0.5">
                          <Zap className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase text-[#141414] tracking-wider">
                            MEDREVISE
                          </span>
                          <h3 className="font-serif italic font-bold text-lg text-[#141414]">
                            Como Registrar Estudo Primário, Revisões e Simulados
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed font-sans">
                        Entenda como registrar o primeiro contato com a matéria e como alimentar as revisões de acordo com o algoritmo de curva do esquecimento.
                      </p>
                      <div className="p-4 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase text-stone-600 block">
                          Passo a Passo de Execução:
                        </span>
                        <ul className="space-y-2 text-xs text-stone-800">
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <span><strong>Botão 'Estudar'</strong>: Clique quando for o primeiro contato teórico com a matéria. Registra seu tempo sem alterar o agendamento de revisões.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <span><strong>Botão 'Revisar'</strong>: Clique ao fazer as questões de revisão sugeridas e informe sua porcentagem de acertos.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <span>O sistema recalculará a data da próxima revisão em 24h, 7d, 15d ou 30d com base no seu desempenho.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#141414] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                            <span>No menu <strong>Simulados & Histórico</strong>, lance as notas das suas provas completas divididas por área médica.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FLUXOS SUGERIDOS POR TIPO DE ASSINATURA */}
          {activeTab === 'fluxos' && (
            <div className="p-5 sm:p-7 overflow-y-auto space-y-6 bg-[#FAF9F5] flex-1">
              <div className="bg-white p-5 rounded-2xl border-2 border-[#141414]/15 space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase text-[#D44E3D] bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                  FLUXO DE OURO DE ESTUDO
                </span>
                <h3 className="font-serif italic font-bold text-xl text-[#141414]">
                  Como Aproveitar ao Máximo a Sua Assinatura
                </h3>
                <p className="text-xs text-stone-700 leading-relaxed font-sans">
                  Siga o roteiro passo a passo desenhado especificamente para o seu perfil e garanta a retenção ideal de conteúdos até o dia da sua prova de residência médica.
                </p>
              </div>

              {/* Workflow 1: MedRevise */}
              <div className="bg-white border-2 border-[#141414]/15 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                    <h4 className="font-serif italic font-bold text-base text-[#141414]">
                      1. Fluxo do Assinante MedRevise (Foco em Revisão Espaçada)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-stone-500 uppercase bg-stone-100 px-2 py-0.5 rounded-md">
                    REPETIÇÃO ESPAÇADA
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 block">Etapa 01</span>
                    <h5 className="font-bold text-xs text-[#141414]">Criar Semestre</h5>
                    <p className="text-[11px] text-stone-600 font-sans">Cadastre seu semestre ou ciclo letivo atual no menu Matérias.</p>
                  </div>
                  <div className="p-3 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 block">Etapa 02</span>
                    <h5 className="font-bold text-xs text-[#141414]">Cadastrar Matéria & Tópico</h5>
                    <p className="text-[11px] text-stone-600 font-sans">Adicione a disciplina e os temas específicos que serão estudados.</p>
                  </div>
                  <div className="p-3 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 block">Etapa 03</span>
                    <h5 className="font-bold text-xs text-[#141414]">Registrar Estudo Primário</h5>
                    <p className="text-[11px] text-stone-600 font-sans">Aperte 'Estudar' ao ler ou assistir à aula do tema para marcar a data base.</p>
                  </div>
                  <div className="p-3 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 block">Etapa 04</span>
                    <h5 className="font-bold text-xs text-[#141414]">Executar Revisões Espaçadas</h5>
                    <p className="text-[11px] text-stone-600 font-sans">Faça as revisões nos dias indicados pelo painel (R1/R2/R3) para manter retenção alta.</p>
                  </div>
                </div>
              </div>

              {/* Workflow 2: MedInternato */}
              <div className="bg-white border-2 border-[#141414]/15 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#D44E3D]"></span>
                    <h4 className="font-serif italic font-bold text-base text-[#141414]">
                      2. Fluxo do Assinante MedInternato (Foco em Prática e Provas)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-stone-500 uppercase bg-stone-100 px-2 py-0.5 rounded-md">
                    INTERNATO & BANCAS
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono font-bold text-[#D44E3D] block">Etapa 01</span>
                    <h5 className="font-bold text-xs text-[#141414]">Criar Planejamento</h5>
                    <p className="text-[11px] text-stone-600 font-sans">Gere o cronograma semanal de estudos do seu rodízio ou edital.</p>
                  </div>
                  <div className="p-3 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono font-bold text-[#D44E3D] block">Etapa 02</span>
                    <h5 className="font-bold text-xs text-[#141414]">Gerar Resumos Teóricos</h5>
                    <p className="text-[11px] text-stone-600 font-sans">Gere resumos didáticos no formato desejado (focado, síntese ou exaustivo) com IA.</p>
                  </div>
                  <div className="p-3 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono font-bold text-[#D44E3D] block">Etapa 03</span>
                    <h5 className="font-bold text-xs text-[#141414]">Resolver Questões das Bancas</h5>
                    <p className="text-[11px] text-stone-600 font-sans">Pratique com lotes de questões das 8 bancas de residência cadastradas no seu perfil.</p>
                  </div>
                  <div className="p-3 bg-[#FAF9F5] border border-stone-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono font-bold text-[#D44E3D] block">Etapa 04</span>
                    <h5 className="font-bold text-xs text-[#141414]">Flashcards de Fixação</h5>
                    <p className="text-[11px] text-stone-600 font-sans">Revise cards ativos para fixar conceitos, dosagens e condutas críticas.</p>
                  </div>
                </div>
              </div>

              {/* Workflow 3: Combo Completo */}
              <div className="bg-[#141414] text-white rounded-2xl p-6 space-y-5 border-2 border-stone-900 shadow-md">
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h4 className="font-serif italic font-bold text-lg text-white">
                      3. O Fluxo de Ouro do Estudo Perfeito (Combo Completo)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase bg-white/10 px-2.5 py-1 rounded-md border border-white/15">
                    SINERGIA TOTAL
                  </span>
                </div>

                <p className="text-xs text-stone-300 leading-relaxed font-sans">
                  Para quem possui acesso a ambos os ecossistemas, este é o método científico ideal para obter máxima retenção e gabaritar as provas de residência médica:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 border border-white/15 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#D44E3D] text-white font-mono text-xs font-bold flex items-center justify-center">1</span>
                      <h5 className="font-bold text-sm text-white">Fase 1: Estudo Ativo no MedInternato</h5>
                    </div>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      Estude o tópico no MedInternato, gere o resumo no formato de sua escolha (focado, síntese ou exaustivo), resolva o lote de questões direcionadas para a sua banca-alvo e crie flashcards para os conceitos e pegadinhas que tiver dificuldade.
                    </p>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/15 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-mono text-xs font-bold flex items-center justify-center">2</span>
                      <h5 className="font-bold text-sm text-white">Fase 2: Retenção a Longo Prazo no MedRevise</h5>
                    </div>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      Vincule o tema estudado ao seu semestre ativo no MedRevise e registre a data do estudo primário. Nos dias indicados pelos alertas de revisão (24h, 7d, 15d, 30d), abra os flashcards e o resumo gerados no MedInternato para realizar uma revisão rápida e manter retenção acima de 90%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TUTORIAL NA TELA */}
          {activeTab === 'tour' && (
            <div className="p-6 sm:p-10 overflow-y-auto flex flex-col items-center justify-center text-center space-y-6 bg-[#FAF9F5] flex-1">
              <div className="w-16 h-16 rounded-3xl bg-[#141414] text-white flex items-center justify-center shadow-lg">
                <GraduationCap className="w-8 h-8 text-[#D44E3D]" />
              </div>

              <div className="max-w-lg space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase text-[#D44E3D] bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                  GUIA INTERATIVO PASSO A PASSO
                </span>
                <h3 className="font-serif italic font-bold text-2xl text-[#141414]">
                  Iniciar Tutorial Guiado na Tela
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed font-sans">
                  Você será guiado tela a tela pela interface do sistema. O assistente destacará onde clicar e o que preencher em cada campo para você dominar todas as ferramentas em minutos.
                </p>
              </div>

              <div className="p-4 bg-white border border-stone-300 rounded-2xl max-w-md text-left text-xs text-stone-700 space-y-1.5 shadow-xs">
                <div className="font-bold text-stone-900 flex items-center gap-1.5 font-mono text-[11px] uppercase">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Controle Total do Usuário
                </div>
                <p>
                  Você pode pular o tutorial a qualquer momento clicando no botão <strong>Pular Tutorial</strong> ou navegar entre os passos de forma voluntária.
                </p>
              </div>

              <button
                onClick={handleLaunchTour}
                className="px-8 py-3.5 bg-[#141414] hover:bg-black text-white font-mono text-xs font-bold uppercase rounded-xl transition-all cursor-pointer shadow-[4px_4px_0px_0px_rgba(212,78,61,1)] flex items-center gap-3"
              >
                <span>INICIAR TUTORIAL GUIADO NA TELA</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          )}

          {/* TAB 4: PERGUNTAS FREQUENTES */}
          {activeTab === 'faq' && (
            <div className="p-5 sm:p-7 overflow-y-auto space-y-4 bg-[#FAF9F5] flex-1">
              <div className="space-y-3">
                <div className="bg-white border border-stone-300 rounded-2xl p-4 space-y-1">
                  <h4 className="font-serif italic font-bold text-base text-[#141414]">
                    Como funciona a Curva do Esquecimento e as Revisões Espaçadas?
                  </h4>
                  <p className="text-xs text-stone-700 font-sans leading-relaxed">
                    Sempre que você conclui um tópico ou responde a questões, o sistema agenda automaticamente ciclos de revisão espaçada (24h, 7d, 15d e 30d). O algoritmo adaptativo ajusta a frequência com base no seu percentual de acertos informados.
                  </p>
                </div>

                <div className="bg-white border border-stone-300 rounded-2xl p-4 space-y-1">
                  <h4 className="font-serif italic font-bold text-base text-[#141414]">
                    Como funciona o Vínculo entre MedRevise e MedInternato?
                  </h4>
                  <p className="text-xs text-stone-700 font-sans leading-relaxed">
                    A ferramenta Vínculo & Integração conecta matérias do MedRevise com rodízios do MedInternato. Quando conectadas, seu progresso em questões e resumos é sincronizado automaticamente nos dois módulos.
                  </p>
                </div>

                <div className="bg-white border border-stone-300 rounded-2xl p-4 space-y-1">
                  <h4 className="font-serif italic font-bold text-base text-[#141414]">
                    Meus dados e progresso ficam salvos na nuvem?
                  </h4>
                  <p className="text-xs text-stone-700 font-sans leading-relaxed">
                    Sim! Todos os seus planejamentos, resumos, questões resolvidas, flashcards e notas ficam salvos em tempo real no banco de dados seguro na nuvem vinculados à sua conta.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Footer */}
          <div className="p-4 bg-white border-t-2 border-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <GraduationCap className="w-4 h-4 text-[#D44E3D]" />
              <span>Ainda com dúvidas? Acesse o <strong>Preceptor IA</strong> a qualquer momento!</span>
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 bg-[#141414] hover:bg-black text-white font-mono text-xs font-bold uppercase rounded-xl transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(212,78,61,1)]"
            >
              FECHAR GUIA
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
