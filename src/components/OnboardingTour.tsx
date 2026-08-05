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
  BarChart3, 
  User, 
  Check,
  Zap,
  Brain,
  Search,
  Layers,
  GraduationCap,
  ShieldCheck,
  RotateCcw,
  ListFilter,
  CheckCircle2,
  FileText,
  Target
} from 'lucide-react';

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSwitchTab: (tab: 'dashboard' | 'subjects' | 'calendar' | 'profile' | 'schedule' | 'stats' | 'weekly' | 'exams' | 'admin' | 'terms') => void;
}

interface TourStep {
  id: string;
  tab: 'dashboard' | 'subjects' | 'calendar' | 'profile' | 'schedule' | 'stats' | 'weekly' | 'exams' | 'admin' | 'terms';
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
      tab: 'dashboard',
      title: 'Bem-vindo ao MedRevise! 🚀',
      subtitle: 'Seu Ecossistema Científico de Memorização e Aprovação Médica',
      description: 'O MedRevise foi concebido com base na neurociência da aprendizagem e na medicina baseada em evidências. Combinamos o Sistema de Repetição Espaçada (SRS) de Hermann Ebbinghaus com algoritmos ativos que calibram seus ciclos de revisão de acordo com sua taxa real de acertos.',
      accent: 'border-amber-500/30 bg-amber-500/5 text-amber-950',
      badgeBg: 'bg-amber-600 text-white',
      badge: 'BEM-VINDO',
      icon: <Sparkles className="text-amber-600 animate-pulse" size={28} />,
      keyBenefit: 'Evita a curva do esquecimento e garante retenção superior a 85% no dia da sua prova de residência.',
      howItWorks: [
        'Você cadastra o tópico estudado e realiza questões curtas.',
        'O algoritmo calcula a estabilidade da memória baseando-se nos seus acertos.',
        'O sistema agenda automaticamente revisões em 24h, 7d, 15d, 30d e 60d.',
        'Você só estuda o que está na iminência de esquecer, otimizando seu tempo.'
      ],
      goldenTip: 'Conclua este guia interativo para dominar todas as ferramentas avançadas do ecossistema!'
    },
    {
      id: 'dashboard',
      tab: 'dashboard',
      title: '1. Painel Consolidado de Estudos (Dashboard) 📊',
      subtitle: 'Sua Central Diária de Comando e Métricas em Tempo Real',
      description: 'No Dashboard, você monitora em tempo real suas revisões pendentes do dia, o cumprimento das suas metas diárias em minutos e questões, além de contar com um cronômetro flutuante integrado.',
      accent: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-950',
      badgeBg: 'bg-emerald-600 text-white',
      badge: 'PASSO 01 DE 11',
      icon: <LayoutDashboard className="text-emerald-600" size={28} />,
      keyBenefit: 'Clareza imediata sobre o trabalho que precisa ser feito hoje sem dispersão.',
      howItWorks: [
        'Acompanhe o contador de "Revisões Pendentes para Hoje".',
        'Inicie e pause o cronômetro flutuante durante suas leituras e questões.',
        'Monitore a meta diária de estudos (minutos) e barra de progresso acumulado.',
        'Consulte o histórico de últimas questões resolvidas e atalhos rápidos.'
      ],
      goldenTip: 'Mantenha a meta diária ajustada à sua rotina real no perfil para manter uma consistência inabalável.'
    },
    {
      id: 'subjects',
      tab: 'subjects',
      title: '2. Gerenciando Matérias e Tópicos 📚',
      subtitle: 'Organização Acadêmica Estruturada por Especialidades',
      description: 'Estruture todo o conteúdo das grandes áreas médicas (Ginecologia, Obstetrícia, Pediatria, Cirurgia, Clínica Médica e Preventiva) divididos em tópicos específicos.',
      accent: 'border-blue-500/30 bg-blue-500/5 text-blue-950',
      badgeBg: 'bg-blue-600 text-white',
      badge: 'PASSO 02 DE 11',
      icon: <BookOpen className="text-blue-600" size={28} />,
      keyBenefit: 'Controle total do progresso teórico de cada matéria com indicação visual de status.',
      howItWorks: [
        'Crie ou selecione Matérias principais e adicione seus Tópicos correspondentes.',
        'Veja a data da próxima revisão sugerida em cada card de tópico.',
        'Acompanhe o indicador visual de alerta quando a matéria entrar "Em Atraso".',
        'Use a barra de pesquisa para localizar qualquer tema em milissegundos.'
      ],
      goldenTip: 'Cadastre tópicos específicos (ex: "Pré-Eclâmpsia e Eclâmpsia") em vez de nomes genéricos para revisões mais precisas.'
    },
    {
      id: 'studyVsReview',
      tab: 'subjects',
      title: '3. Estudar vs. Revisar: A Regra de Ouro 🎯',
      subtitle: 'Entendendo a Diferença Crítica para Máxima Retenção',
      description: 'O sistema possui dois botões com propósitos inteiramente distintos: "ESTUDAR" é voltado para a teoria inicial passiva; "REVISAR" ativa a Recordação Ativa (Active Recall), que consolida a memória de longo prazo.',
      accent: 'border-rose-500/30 bg-rose-500/5 text-rose-950',
      badgeBg: 'bg-rose-600 text-white',
      badge: 'PASSO 03 DE 11',
      icon: <Zap className="text-rose-600" size={28} />,
      keyBenefit: 'A recordação ativa através do botão REVISAR aumenta em até 3x a retenção de dados complexos de prova.',
      howItWorks: [
        'Botão "ESTUDAR": Use no primeiro contato teórico (leitura de apostila ou videoaula). Registra tempo sem alterar drasticamente o SRS.',
        'Botão "REVISAR": Use ao fazer questões de revisão. Informe seu percentual de acertos.',
        'O algoritmo recalibra o intervalo de dias futuro com base no seu percentual informado.',
        'Se acertar 100%, o intervalo se amplia. Se errar, o tópico retorna para revisão em curto prazo.'
      ],
      goldenTip: 'Nunca use "Estudar" quando estiver fazendo questões de revisão. Use sempre "Revisar" para alimentar o algoritmo SRS!'
    },
    {
      id: 'forgettingIndex',
      tab: 'subjects',
      title: '4. O Risco de Esquecimento / Índice de Perda 🧠📉',
      subtitle: 'A Ciência Exata da Curva de Ebbinghaus no seu Estudo',
      description: 'O Risco de Esquecimento (expresso em %) estima matematicamente a probabilidade de você esquecer um assunto no dia de hoje, usando a fórmula de Ebbinghaus: R = e^(-t/S).',
      accent: 'border-purple-500/30 bg-purple-500/5 text-purple-950',
      badgeBg: 'bg-purple-600 text-white',
      badge: 'PASSO 04 DE 11',
      icon: <Brain className="text-purple-600 animate-pulse" size={28} />,
      keyBenefit: 'Identificação cirúrgica das matérias em estado crítico de apagão antes que você erre no simulado.',
      howItWorks: [
        '🟢 Verde (<30%): Retenção sólida e consolidada no córtex de longo prazo.',
        '🟡 Amarelo (30%-70%): Atenção, a associação sináptica começou a decair suavemente.',
        '🔴 Vermelho (>70% - Alerta): Curva crítica de esquecimento iminente; requer revisão urgente.',
        'Ao clicar em "Revisar" e registrar acertos, a força de retenção (S) aumenta e o risco despenca.'
      ],
      goldenTip: 'Priorize sempre as matérias com risco no vermelho (>70%) antes de iniciar novos conteúdos teóricos!'
    },
    {
      id: 'calendar',
      tab: 'calendar',
      title: '5. Calendário Científico de Distribuição 📅',
      subtitle: 'Previsão de Carga de Trabalho e Agendamentos Futuros',
      description: 'O Calendário proporciona uma visão panorâmica e limpa dos seus compromissos futuros, mostrando exatamente em quais dias do mês cada revisão cairá.',
      accent: 'border-sky-500/30 bg-sky-500/5 text-sky-950',
      badgeBg: 'bg-sky-600 text-white',
      badge: 'PASSO 05 DE 11',
      icon: <Calendar className="text-sky-600" size={28} />,
      keyBenefit: 'Evita acúmulo e sobrecarga de revisões em dias de plantão ou provas da faculdade.',
      howItWorks: [
        'Navegue entre os meses e identifique os dias com maior densidade de tarefas.',
        'Clique em qualquer dia para visualizar os tópicos específicos agendados.',
        'Adicione eventos personalizados, datas de provas de residência ou rodízios.',
        'Sincronize com sua rotina pessoal para remanejar sessões com antecedência.'
      ],
      goldenTip: 'Se observar que uma segunda-feira tem 15 revisões, você pode antecipar 5 delas no domingo para manter o ritmo calmo.'
    },
    {
      id: 'weekly',
      tab: 'weekly',
      title: '6. Planejador de Grade Semanal Vertical ⏰',
      subtitle: 'Visão Tática dos Próximos 7 Dias de Estudos',
      description: 'O planejador semanal exibe verticalmente sua rotina para os próximos 7 dias, distribuindo visualmente a carga de estudo com barras de intensidade.',
      accent: 'border-teal-500/30 bg-teal-500/5 text-teal-950',
      badgeBg: 'bg-teal-600 text-white',
      badge: 'PASSO 06 DE 11',
      icon: <Clock className="text-teal-600" size={28} />,
      keyBenefit: 'Ideal para alinhar a rotina semanal entre cursinho preparatório, internato e vida pessoal.',
      howItWorks: [
        'Visualize as tarefas organizadas dia por dia (Segunda a Domingo).',
        'Acompanhe o somatório de minutos previstos para cada dia.',
        'Marque tópicos concluídos diretamente da visão semanal.',
        'Ajuste o cronograma para que os dias de folga fiquem zerados de revisões.'
      ],
      goldenTip: 'Utilize a visão semanal nos domingos à noite para planejar seus horários de estudo da semana com precisão.'
    },
    {
      id: 'exams',
      tab: 'exams',
      title: '7. Módulo de Simulados & Histórico 🏆',
      subtitle: 'Registro do Treino em Condições Reais de Prova',
      description: 'Faça o acompanhamento longitudinal do seu rendimento em simulados completos ou provas na íntegra das principais bancas de residência.',
      accent: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-950',
      badgeBg: 'bg-cyan-600 text-white',
      badge: 'PASSO 07 DE 11',
      icon: <Award className="text-cyan-600" size={28} />,
      keyBenefit: 'Mapeamento preciso da sua nota média e identificação das grandes áreas deficitárias.',
      howItWorks: [
        'Cadastre o simulado realizado (ex: "Simulado 1 ENARE" ou "Provinha Internato").',
        'Registre a quantidade total de questões, acertos e tempo gasto.',
        'Lance a nota dividida pelas 5 grandes áreas da medicina.',
        'Acompanhe o gráfico de evolução temporal das suas notas ao longo do ano.'
      ],
      goldenTip: 'Ao identificar que sua nota em Cirurgia Geral está abaixo de 60%, direcione revisões adicionais nessa área.'
    },
    {
      id: 'schedule',
      tab: 'schedule',
      title: '8. Estêntil da Grade Acadêmica & Plantões 🏫',
      subtitle: 'Gestão da Sua Agenda Fixa do Internato e Faculdade',
      description: 'Cadastre seus horários fixos de aulas teóricas, rodízios de enfermaria, ambulatoriais, estágios e plantões semanais sem poluir a matriz do SRS.',
      accent: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-950',
      badgeBg: 'bg-indigo-600 text-white',
      badge: 'PASSO 08 DE 11',
      icon: <Layers className="text-indigo-600" size={28} />,
      keyBenefit: 'Separação cristalina entre compromissos fixos obrigatórios e horas livres de estudo individual.',
      howItWorks: [
        'Preencha a grade horária por turnos (Manhã, Tarde, Noite).',
        'Defina locais e nomes das disciplinas ou rodízios da faculdade.',
        'Consulte sua rotina diária em um relance antes de iniciar a jornada.',
        'Evite agendar revisões em horários comprometidos com cirurgias ou plantões.'
      ],
      goldenTip: 'Mantenha a grade atualizada a cada mudança de rodízio do internato.'
    },
    {
      id: 'stats',
      tab: 'stats',
      title: '9. Analytics & Métricas de Desempenho 📈',
      subtitle: 'Transformando seu Esforço em Dados Transparentes',
      description: 'Gráficos detalhados exibem de forma transparente o seu tempo investido por matéria, eficácia de acertos nas questões e constância diária.',
      accent: 'border-violet-500/30 bg-violet-500/5 text-violet-950',
      badgeBg: 'bg-violet-600 text-white',
      badge: 'PASSO 09 DE 11',
      icon: <BarChart3 className="text-violet-600" size={28} />,
      keyBenefit: 'Diagnóstico objetivo se você está estudando proporcionalmente ao peso das matérias na sua prova.',
      howItWorks: [
        'Gráfico de Pizza: Mostra a distribuição do seu tempo entre as matérias.',
        'Gráfico de Linha: Exibe a evolução do percentual de acertos em questões.',
        'Métricas de Consistência: Sequência de dias ativos (Streak) e total de horas acumuladas.',
        'Filtros por Período: Analise seu desempenho dos últimos 7 dias, 30 dias ou ano.'
      ],
      goldenTip: 'Mantenha sua taxa global de acertos acima de 75-80% nas matérias de alta relevância.'
    },
    {
      id: 'crossApp',
      tab: 'subjects',
      title: '10. Integração Nativa com o MedInternato 🔄',
      subtitle: 'A Sinergia Perfeita entre Teoria Profunda e Revisão Espaçada',
      description: 'O MedRevise e o MedInternato funcionam como um ecossistema unificado. Você pode transitar entre a teoria detalhada do internato e a curva do MedRevise em 1 clique.',
      accent: 'border-amber-500/30 bg-amber-500/5 text-amber-950',
      badgeBg: 'bg-amber-600 text-white',
      badge: 'PASSO 10 DE 11',
      icon: <RotateCcw className="text-amber-600" size={28} />,
      keyBenefit: 'Estude o resumo teórico no MedInternato e envie o tópico diretamente para o algoritmo do MedRevise.',
      howItWorks: [
        'Ao estudar um tema no MedInternato, clique em "Ver no MedRevise".',
        'O aplicativo alterna para o MedRevise e localiza ou sugere o vínculo do tópico.',
        'Sua sessão de estudos no internato registra tempo e atualiza a retenção do tópico.',
        'Retorne ao MedInternato quando quiser aprofundar resumos e bancos de questões.'
      ],
      goldenTip: 'Use o MedInternato no tablet durante a enfermaria e acompanhe suas revisões no MedRevise pelo celular!'
    },
    {
      id: 'profile',
      tab: 'profile',
      title: '11. Perfil, Metas e MedRevise Pro 👤💎',
      subtitle: 'Personalização do Seu Perfil e Desbloqueio de Recursos',
      description: 'Na tela de perfil, você ajusta sua meta diária de estudos em minutos, gerencia suas preferências de conta e tem acesso à ativação do plano Pro.',
      accent: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-950',
      badgeBg: 'bg-yellow-600 text-white',
      badge: 'PASSO 11 DE 11',
      icon: <User className="text-yellow-600" size={28} />,
      keyBenefit: 'Suporte prioritário, limites removidos e sincronização na nuvem protegida.',
      howItWorks: [
        'Ajuste sua Meta Diária de Minutos conforme seu semestre do curso.',
        'Gerencie dados pessoais e altere sua senha de forma segura.',
        'Consulte o status da sua assinatura Pro e benefícios ativos.',
        'Reative este Guia Passo a Passo sempre que quiser rever alguma função.'
      ],
      goldenTip: 'Ative as notificações de lembrete diário para nunca perder o horário ideal de revisão.'
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
    localStorage.setItem('medrevise_tour_completed', 'true');
    setCurrentStep(0);
    onSwitchTab('dashboard');
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
                <span className="text-xs font-bold text-stone-300">MedRevise & MedInternato</span>
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
                placeholder="Pesquisar por funcionalidade (ex: Repetição Espaçada, Simulados, Ebbinghaus...)"
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
                  <p className="text-xs">Tente buscar por termos como "questões", "revisão", "simulado" ou "cronograma".</p>
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
