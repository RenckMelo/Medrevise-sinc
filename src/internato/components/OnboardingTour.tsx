import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  BookOpen, 
  LayoutDashboard, 
  Calendar, 
  Clock, 
  Award, 
  Search, 
  Check,
  Zap,
  Brain,
  GraduationCap,
  HelpCircle,
  RotateCcw,
  RefreshCw,
  ListFilter,
  CheckCircle2,
  FileText,
  Target,
  Layers,
  Cpu,
  BookmarkCheck,
  CalendarDays
} from 'lucide-react';

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSwitchTab: (tab: 'home' | 'subject' | 'questions' | 'flashcards' | 'cronograma' | 'search' | 'admin') => void;
}

interface TourStep {
  id: string;
  tab: 'home' | 'subject' | 'questions' | 'flashcards' | 'cronograma' | 'search' | 'admin';
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  badgeBg: string;
  icon: React.ReactNode;
  badge: string;
  howItWorks: string[];
  keyBenefit: string;
  goldenTip: string;
}

export default function OnboardingTour({ isOpen, onClose, activeTab, onSwitchTab }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState<'stepByStep' | 'fullManual'>('stepByStep');
  const [searchQuery, setSearchQuery] = useState('');

  const steps: TourStep[] = [
    {
      id: 'welcome',
      tab: 'home',
      title: 'Bem-vindo ao MedInternato! 🚀',
      subtitle: 'Sua Plataforma Definitiva para Internato Médico e Residência',
      description: 'O MedInternato é a central de alta inteligência desenvolvida para acompanhar o estudante durante os 2 anos de internato e a preparação de alta performance para a prova de residência médica. Integramos teoria de alta densidade, resolução ativa de questões, memorização por flashcards e o exclusivo Gerador de Cronograma com Reorganizador de Atrasos.',
      accent: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-950',
      badgeBg: 'bg-indigo-600 text-white',
      badge: 'BEM-VINDO',
      icon: <GraduationCap className="text-indigo-600 animate-pulse" size={28} />,
      keyBenefit: 'Une teoria acadêmica rigorosa, prática beira-de-leito e simulados em um ecossistema sinérgico.',
      howItWorks: [
        'Acesse resumos teóricos com diretrizes médicas atualizadas.',
        'Pratique questões oficiais de bancas brasileiras com comentários linha a linha.',
        'Gere seu cronograma semanal de estudos adaptado ao seu tempo livre.',
        'Use a IA beira-de-leito para tirar dúvidas em plantões e enfermarias.'
      ],
      goldenTip: 'Conclua este guia visual para dominar 100% das ferramentas do MedInternato!'
    },
    {
      id: 'dashboard',
      tab: 'home',
      title: '1. Painel de Controle Teórico (Dashboard) 📊',
      subtitle: 'Monitoramento Unificado do Seu Tempo e Rendimento',
      description: 'Acompanhe de forma consolidada o tempo total investido em cada disciplina, o progresso percentual de conclusão dos tópicos do internato e seu rendimento em questões resolvidas hoje e na semana.',
      accent: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-950',
      badgeBg: 'bg-emerald-600 text-white',
      badge: 'PASSO 01 DE 10',
      icon: <LayoutDashboard className="text-emerald-600" size={28} />,
      keyBenefit: 'Visão clara do ritmo semanal e metas atingidas para evitar procrastinação.',
      howItWorks: [
        'Acompanhe os cards com contagem de "Questões Hoje" e "Meta Semanal".',
        'Veja o progresso percentual acumulado em relação ao total de tópicos do internato.',
        'Consulte o histórico de sessões de estudo com opção de exclusão/reajuste.',
        'Acesse o botão "Guia Passo a Passo" a qualquer momento para rever este manual.'
      ],
      goldenTip: 'Revise o Dashboard todos os dias ao encerrar os estudos para avaliar sua constância.'
    },
    {
      id: 'subject',
      tab: 'subject',
      title: '2. Matérias & Resumos Teóricos com IA 📚',
      subtitle: 'Acervo Acadêmico de Alta Densidade e Casos Clínicos',
      description: 'Consulte resumos organizados pelas grandes áreas médicas (Ginecologia, Obstetrícia, Pediatria, Cirurgia, Clínica Médica e Saúde Coletiva). Cada resumo traz diretrizes de conduta, algoritmos, dosagens e destaques de pegadinhas de bancas.',
      accent: 'border-amber-500/30 bg-amber-500/5 text-amber-950',
      badgeBg: 'bg-amber-600 text-white',
      badge: 'PASSO 02 DE 10',
      icon: <BookOpen className="text-amber-600" size={28} />,
      keyBenefit: 'Leitura médica padronizada no formato de livro acadêmico com formatação rica e limpa.',
      howItWorks: [
        'Navegue pelos semestres ou busque por temas específicos do seu rodízio.',
        'Abra o resumo completo com tópicos de fisiopatologia, diagnóstico e conduta.',
        'Visualize caixas de alerta coloridas (`📝 NOTA`, `⚠️ ATENÇÃO`, `💡 DICA DE PROVA`).',
        'Gere Casos Clínicos interativos com IA para testar seu raciocínio diagnóstico.'
      ],
      goldenTip: 'Utilize o filtro por rodízio ativo para focar no assunto que você está vivenciando no hospital!'
    },
    {
      id: 'aiTutor',
      tab: 'subject',
      title: '3. Assistente Beira-de-Leito & Redundância IA 🤖⚡',
      subtitle: 'Tutor Médico com Cascata de Inteligência em Tempo Real',
      description: 'Tire dúvidas médicas beira-de-leito, solicite cálculos de doses ou esquemas terapêuticos de emergência. O sistema possui arquitetura em cascata: usa Gemini 2.5 Flash de alta velocidade com failover automático para Groq Llama-3.3.',
      accent: 'border-purple-500/30 bg-purple-500/5 text-purple-950',
      badgeBg: 'bg-purple-600 text-white',
      badge: 'PASSO 03 DE 10',
      icon: <Cpu className="text-purple-600 animate-pulse" size={28} />,
      keyBenefit: 'Garantia de resposta imediata mesmo em horários de alta demanda ou instabilidade na nuvem.',
      howItWorks: [
        'Clique no chat do Tutor IA localizado dentro do resumo ou menu lateral.',
        'Pergunte sobre condutas, diagnósticos diferenciais, dosagens ou critérios clínicos.',
        'A IA responde em segundos fundamentada nas diretrizes médicas brasileiras.',
        'Caso um provedor fique indisponível, a cascata alterna silenciosamente de servidor.'
      ],
      goldenTip: 'Faça perguntas diretas como: "Qual a dose de manutenção de Sulfato de Magnésio no protocolo Pritchett?"'
    },
    {
      id: 'questions',
      tab: 'questions',
      title: '4. Banco de Questões de Residência Médica ❓',
      subtitle: 'Treinamento Ativo com Provas Oficiais e Comentários',
      description: 'Estude por questões selecionadas de exames de residência de todo o Brasil (ENARE, USP, UNIFESP, AMRIGS, SUS-SP, etc.). Filtre por banca, especialidade e ano, e veja justificativas alternativa por alternativa.',
      accent: 'border-rose-500/30 bg-rose-500/5 text-rose-950',
      badgeBg: 'bg-rose-600 text-white',
      badge: 'PASSO 04 DE 10',
      icon: <HelpCircle className="text-rose-600" size={28} />,
      keyBenefit: 'Treino em condições reais de prova com explicações detalhadas por que cada alternativa está certa ou errada.',
      howItWorks: [
        'Escolha o Modo Estudo (feedback imediato) ou Modo Simulado (sem gabarito durante a prova).',
        'Filtre por grandes áreas ou selecione bancas de residência específicas.',
        'Responda e leia a justificativa médica e comentários da comunidade.',
        'A IA gera novas questões personalizadas em caso de escassez no tema escolhido.'
      ],
      goldenTip: 'A resolução ativa de questões é o método cientificamente comprovado de maior impacto para aprovação!'
    },
    {
      id: 'flashcards',
      tab: 'flashcards',
      title: '5. Flashcards & Repetição Espaçada 🧠',
      subtitle: 'Memorização Rápida de Dosagens, Critérios e Mnemônicos',
      description: 'Evite o esquecimento de dados cruciais como doses, contraindicações e classificações. Use nosso módulo de flashcards com algoritmos de repetição espaçada estilo Anki.',
      accent: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-950',
      badgeBg: 'bg-cyan-600 text-white',
      badge: 'PASSO 05 DE 10',
      icon: <Brain className="text-cyan-600 animate-pulse" size={28} />,
      keyBenefit: 'Fixação duradoura de detalhes de rodapé de prova em poucos minutos diários.',
      howItWorks: [
        'Selecione o baralho por área médica ou tema específico.',
        'Veja a pergunta no card e clique para virar a resposta.',
        'Classifique a dificuldade: Errei (revisão imediata), Difícil, Médio ou Fácil.',
        'O sistema reagenda o card para o momento ideal de fixação.'
      ],
      goldenTip: 'Faça uma rodada rápida de 10 flashcards no celular durante os intervalos do plantão!'
    },
    {
      id: 'cronograma',
      tab: 'cronograma',
      title: '6. Novo Planejamento Inteligente 📅',
      subtitle: 'Planejamento Personalizado de 6 Meses, 1 Ano ou 2 Anos',
      description: 'Gere um plano de estudos perfeito para suas metas de residência. Informe quais dias da semana você tem disponíveis, quantas horas pode estudar por dia e escolha sua banca/região alvo.',
      accent: 'border-teal-500/30 bg-teal-500/5 text-teal-950',
      badgeBg: 'bg-teal-600 text-white',
      badge: 'PASSO 06 DE 10',
      icon: <Calendar className="text-teal-600" size={28} />,
      keyBenefit: 'Distribuição proporcional das matérias de acordo com a incidência estatística da banca escolhida.',
      howItWorks: [
        'Acesse a aba "Cronograma" e clique em "Criar Novo Cronograma".',
        'Insira a data inicial e o período desejado (ex: 1 ano até a prova).',
        'Selecione a banca alvo (ex: ENARE, USP, AMRIGS, Geral).',
        'O algoritmo gera a grade completa semana por semana com revisões e simulados.'
      ],
      goldenTip: 'Matérias com maior peso na sua banca escolhida receberão mais semanas e sessões de questões!'
    },
    {
      id: 'delayReorganizer',
      tab: 'cronograma',
      title: '7. Reorganizador de Atrasos & Simulados 🏆🔄',
      subtitle: 'Flexibilidade Total Quando a Vida Hospitalar Acontecer',
      description: 'Atrasou semanas por causa de plantões extras ou tirou nota baixa no simulado? O painel de Reestruturação recalcula automaticamente o cronograma e redistribui as matérias sem perder o ritmo.',
      accent: 'border-violet-500/30 bg-violet-500/5 text-violet-950',
      badgeBg: 'bg-violet-600 text-white',
      badge: 'PASSO 07 DE 10',
      icon: <RefreshCw className="text-violet-600" size={28} />,
      keyBenefit: 'Elimina a culpa e o caos de ficar com matéria acumulada ao reorganizar tudo com 1 clique.',
      howItWorks: [
        'Registre seus simulados periódicos no cronograma e lance suas notas.',
        'Se o rendimento em uma matéria for fraco, o sistema adiciona semanas de reforço.',
        'Caso tenha acumulado semanas atrasadas, abra o modal "Reorganizar Atrasos".',
        'O algoritmo compacta ou remaneja os tópicos para as semanas futuras de forma harmoniosa.'
      ],
      goldenTip: 'Nunca desista de um cronograma atrasado: use a reorganização automática para reequilibrar seu plano!'
    },
    {
      id: 'calendarExport',
      tab: 'cronograma',
      title: '8. Sincronização com Google Calendar & iCal 🗓️',
      subtitle: 'Exportação Direta de Compromissos para sua Agenda',
      description: 'Sincronize todo o seu cronograma semanal de estudos com seu Google Calendar, Apple Calendar ou iCal com desduplicação automática e atualização em massa.',
      accent: 'border-sky-500/30 bg-sky-500/5 text-sky-950',
      badgeBg: 'bg-sky-600 text-white',
      badge: 'PASSO 08 DE 10',
      icon: <CalendarDays className="text-sky-600" size={28} />,
      keyBenefit: 'Seus compromissos de estudo integrados com seus alarmes e agenda pessoal no celular.',
      howItWorks: [
        'No Cronograma, clique em "Sincronizar com Calendário".',
        'O sistema varre os eventos e insere compromissos com horários e títulos claros.',
        'Utiliza desduplicação por chave única para evitar eventos repetidos.',
        'Receba notificações nativas do Google Calendar no seu celular antes das sessões.'
      ],
      goldenTip: 'Mantenha a sincronização em dia a cada nova semana de cronograma gerada!'
    },
    {
      id: 'crossApp',
      tab: 'cronograma',
      title: '9. Conexão Cross-App com MedRevise 🔄',
      subtitle: 'Navegação Direta entre Teoria do Internato e Ebbinghaus',
      description: 'Ao lado de cada tópico do seu cronograma no MedInternato, existe o botão "Ver no MedRevise →". Ele alterna instantaneamente para o MedRevise, localizando o tópico e abrindo os ciclos de revisão.',
      accent: 'border-amber-500/30 bg-amber-500/5 text-amber-950',
      badgeBg: 'bg-amber-600 text-white',
      badge: 'PASSO 09 DE 10',
      icon: <RotateCcw className="text-amber-600" size={28} />,
      keyBenefit: 'União da profundidade teórica do Internato com a ciência da repetição espaçada do MedRevise.',
      howItWorks: [
        'Clique em "Ver no MedRevise →" em qualquer card de tópico ou cronograma.',
        'O app alterna sem recarregar a tela e abre a página no MedRevise.',
        'Se o tópico não estiver cadastrado no MedRevise, um aviso orienta o vínculo rápido.',
        'Ao terminar, você pode retornar ao MedInternato com 1 clique.'
      ],
      goldenTip: 'Estude a teoria pelo MedInternato e use o MedRevise para agendar os ciclos de 24h, 7d e 30d!'
    },
    {
      id: 'search',
      tab: 'search',
      title: '10. Busca Ultra-Rápida & Finalização 🔍🏁',
      subtitle: 'Localização Instantânea de Qualquer Termo Médico',
      description: 'Utilize a busca global para pesquisar em milissegundos por doenças, condutas, medicamentos, diretrizes ou perguntas de prova em todo o acervo.',
      accent: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-950',
      badgeBg: 'bg-yellow-600 text-white',
      badge: 'PASSO 10 DE 10',
      icon: <Search className="text-yellow-600" size={28} />,
      keyBenefit: 'Respostas em tempo de execução sem perda de tempo navegando em menus.',
      howItWorks: [
        'Clique na aba "Busca" ou use a barra superior.',
        'Digite o termo desejado (ex: "Cetoacidose Diabética" ou "Apendicite").',
        'Veja resultados categorizados por Resumos Teóricos, Questões e Flashcards.',
        'Clique no resultado para abrir o conteúdo imediatamente.'
      ],
      goldenTip: 'Sua preparação para a residência está pronta para decolar! Cadastre seu primeiro cronograma agora.'
    }
  ];

  useEffect(() => {
    if (isOpen && viewMode === 'stepByStep') {
      const step = steps[currentStep];
      if (step && activeTab !== step.tab) {
        onSwitchTab(step.tab);
      }
    }
  }, [currentStep, isOpen, viewMode]);

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('medinternato_tour_completed', 'true');
    setCurrentStep(0);
    onSwitchTab('home');
    onClose();
  };

  const filteredSteps = steps.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.howItWorks.some(h => h.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-md flex items-center justify-center z-[200] p-3 sm:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-[#FAF9F5] border-2 border-[#141414] shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] w-full max-w-3xl relative flex flex-col rounded-2xl overflow-hidden my-auto max-h-[92vh]">
        
        {/* Header bar */}
        <div className="bg-[#141414] text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#D44E3D] rounded-xl text-white font-black text-xs">
              <GraduationCap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#D44E3D] bg-white/10 px-2 py-0.5 rounded-full">
                  GUIA OFICIAL
                </span>
                <span className="text-xs font-bold text-stone-300">MedInternato & MedRevise</span>
              </div>
              <h2 className="text-base sm:text-lg font-serif italic font-bold text-white">
                Manual de Funcionalidades e Passo a Passo
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white/10 p-1 rounded-xl border border-white/15 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('stepByStep')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${viewMode === 'stepByStep' ? 'bg-[#D44E3D] text-white shadow-xs' : 'text-stone-300 hover:text-white'}`}
              >
                🎯 Passo a Passo
              </button>
              <button
                type="button"
                onClick={() => setViewMode('fullManual')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${viewMode === 'fullManual' ? 'bg-[#D44E3D] text-white shadow-xs' : 'text-stone-300 hover:text-white'}`}
              >
                📖 Manual Completo
              </button>
            </div>

            <button 
              type="button"
              onClick={handleComplete}
              title="Fechar Guia"
              className="p-1.5 text-stone-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* View Mode 1: Step By Step Modal */}
        {viewMode === 'stepByStep' && (
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Step navigation pills */}
            <div className="px-5 py-3 bg-[#E2E0D9]/50 border-b border-[#E2E0D9] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              {steps.map((st, idx) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`px-2.5 py-1 text-[11px] font-bold font-mono rounded-lg transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                    idx === currentStep 
                      ? 'bg-[#141414] text-white shadow-xs' 
                      : 'bg-white text-stone-600 hover:bg-stone-200 border border-[#E2E0D9]'
                  }`}
                >
                  <span>{idx === 0 ? '🚀' : `#${idx}`}</span>
                  <span className="hidden sm:inline truncate max-w-[100px]">{st.title.split('.')[1] || st.title.split('!')[0]}</span>
                </button>
              ))}
            </div>

            {/* Main content body */}
            <div className="p-5 sm:p-7 space-y-6 flex-1 overflow-y-auto">
              
              {/* Badge & Title */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white border border-[#E2E0D9] rounded-2xl shadow-xs shrink-0">
                    {currentStepData.icon}
                  </div>
                  <div>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${currentStepData.badgeBg}`}>
                      {currentStepData.badge}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-serif italic font-black text-stone-900 mt-1 leading-tight">
                      {currentStepData.title}
                    </h3>
                  </div>
                </div>

                <div className="text-xs font-mono text-stone-500 font-bold bg-white px-3 py-1.5 rounded-xl border border-[#E2E0D9] shrink-0 self-start sm:self-auto">
                  Passo {currentStep + 1} de {steps.length}
                </div>
              </div>

              {/* Subtitle & Description */}
              <div className="space-y-2 bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E0D9] shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#D44E3D] font-mono">
                  {currentStepData.subtitle}
                </h4>
                <p className="text-sm sm:text-base text-stone-800 leading-relaxed font-sans">
                  {currentStepData.description}
                </p>
              </div>

              {/* Grid: How It Works & Key Benefit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* How it works */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E0D9] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-stone-900 font-mono">
                    <ListFilter size={16} className="text-[#D44E3D]" />
                    Como Usar na Prática:
                  </div>
                  <ul className="space-y-2 text-xs text-stone-700">
                    {currentStepData.howItWorks.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-stone-100 border border-stone-300 text-stone-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Benefit & Golden Tip */}
                <div className="space-y-4 flex flex-col">
                  <div className={`p-4 rounded-2xl border ${currentStepData.accent} space-y-1.5 flex-1`}>
                    <div className="flex items-center gap-1.5 font-bold text-xs font-mono uppercase tracking-wider">
                      <Target size={15} />
                      Diferencial / Benefício
                    </div>
                    <p className="text-xs leading-relaxed font-medium">
                      {currentStepData.keyBenefit}
                    </p>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-amber-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-extrabold text-[11px] font-mono uppercase tracking-wider text-amber-900">
                      💡 Dica de Ouro
                    </div>
                    <p className="text-xs leading-relaxed font-medium text-amber-900">
                      {currentStepData.goldenTip}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer controls */}
            <div className="px-5 py-4 bg-white border-t border-[#E2E0D9] flex items-center justify-between gap-3 shrink-0">
              <div>
                {!isFirstStep ? (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all cursor-pointer border border-stone-200"
                  >
                    <ArrowLeft size={16} />
                    Anterior
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleComplete}
                    className="text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-wider text-[11px] font-mono font-bold cursor-pointer"
                  >
                    Pular Guia
                  </button>
                )}
              </div>

              {/* Progress dots */}
              <div className="hidden sm:flex items-center gap-1">
                {steps.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentStep ? 'w-6 bg-[#D44E3D]' : 'w-2 bg-stone-300'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-3 bg-[#141414] hover:bg-[#D44E3D] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                {isLastStep ? (
                  <>
                    <span>Concluir Tutorial</span>
                    <CheckCircle2 size={16} />
                  </>
                ) : (
                  <>
                    <span>Próximo Passo</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* View Mode 2: Full Detailed Manual */}
        {viewMode === 'fullManual' && (
          <div className="flex flex-col flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por funcionalidade (ex: Cronograma, Redundância, Banco de Questões...)"
                className="w-full pl-10 pr-4 py-3 bg-white border border-[#E2E0D9] rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#D44E3D]/50 shadow-xs"
              />
            </div>

            {/* List of all steps as manual cards */}
            <div className="space-y-6">
              {filteredSteps.map((st, idx) => (
                <div key={st.id} className="bg-white border border-[#E2E0D9] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 hover:border-[#D44E3D]/40 transition-all">
                  <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-xl text-stone-800 shrink-0">
                        {st.icon}
                      </div>
                      <div>
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${st.badgeBg}`}>
                          {st.badge}
                        </span>
                        <h3 className="text-lg font-serif italic font-bold text-stone-900 mt-0.5">
                          {st.title}
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep(steps.findIndex(s => s.id === st.id));
                        setViewMode('stepByStep');
                      }}
                      className="text-xs font-bold font-mono text-[#D44E3D] hover:underline shrink-0 cursor-pointer"
                    >
                      Ver no Passo a Passo →
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-sans">
                    {st.description}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[#FAF9F5] p-3.5 rounded-xl border border-[#E2E0D9]">
                    <div>
                      <span className="font-bold text-stone-900 font-mono block mb-1">📋 Passos de Uso:</span>
                      <ul className="space-y-1 text-stone-600 list-disc list-inside">
                        {st.howItWorks.map((hw, hidx) => (
                          <li key={hidx}>{hw}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="font-bold text-stone-900 font-mono block">🎯 Benefício Direto:</span>
                        <p className="text-stone-600">{st.keyBenefit}</p>
                      </div>
                      <div className="text-amber-900 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        <span className="font-bold font-mono block">💡 Dica:</span>
                        <p>{st.goldenTip}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredSteps.length === 0 && (
                <div className="text-center py-12 text-stone-500 space-y-2">
                  <p className="font-bold text-sm">Nenhuma funcionalidade encontrada para "{searchQuery}".</p>
                  <p className="text-xs">Tente buscar por termos como "questões", "resumo", "cronograma", "banca" ou "tutor".</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E2E0D9] flex justify-center">
              <button
                type="button"
                onClick={handleComplete}
                className="px-8 py-3 bg-[#141414] hover:bg-[#D44E3D] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
              >
                Concluir Leitura do Manual ✓
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
