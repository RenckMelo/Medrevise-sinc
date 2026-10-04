import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles, 
  Target, 
  MousePointer,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface TourStepDefinition {
  stepIndex: number;
  title: string;
  targetDescription: string;
  fieldInstruction: string;
  goldenTip: string;
  targetSelector?: string; // CSS selector to highlight
  targetView?: string; // View name to navigate to in parent app
  isFreeExplore?: boolean; // If true, lets user explore freely with ultra-light transparent backdrops
}

export interface FeatureTourDefinition {
  id: string;
  featureName: string;
  module: 'medinternato' | 'medrevise';
  steps: TourStepDefinition[];
}

export const FEATURE_TOURS: Record<string, FeatureTourDefinition> = {
  'internato-resumos': {
    id: 'internato-resumos',
    featureName: 'Como Fazer Resumos Teóricos com IA',
    module: 'medinternato',
    steps: [
      {
        stepIndex: 1,
        title: 'Acessar Especialidades',
        targetDescription: 'Aba de Especialidades no menu',
        fieldInstruction: 'Clique na aba "Especialidades" no menu superior para abrir a lista de matérias.',
        goldenTip: 'A IA pode gerar resumos em qualquer formato de sua escolha: focado em pontos de prova, síntese em tópicos, condutas de beira-leito ou exaustivo.',
        targetSelector: '[data-tour="internato-subjects-tab"]',
        targetView: 'subjects'
      },
      {
        stepIndex: 2,
        title: 'Abrir Formulário de Matéria',
        targetDescription: 'Botão de inclusão de matéria',
        fieldInstruction: 'Clique no botão "+ Matéria" para cadastrar uma nova disciplina, ou selecione uma existente abaixo.',
        goldenTip: 'Se você já tiver matérias cadastradas, pode avançar diretamente para o passo 5 selecionando sua matéria na lista.',
        targetSelector: '[data-tour="internato-new-subject-btn"]',
        targetView: 'subjects'
      },
      {
        stepIndex: 3,
        title: 'Digitar Nome da Matéria',
        targetDescription: 'Campo para o nome da matéria',
        fieldInstruction: 'Sinta-se livre para encontrar o campo destacado e digitar o nome da matéria (Ex: Pediatria ou Cardiologia).',
        goldenTip: 'Selecione também o semestre/ciclo correto para deixar seu painel de estudos organizado.',
        targetSelector: '[data-tour="internato-subject-input"]',
        targetView: 'subjects',
        isFreeExplore: true
      },
      {
        stepIndex: 4,
        title: 'Confirmar Cadastro de Matéria',
        targetDescription: 'Botão de confirmação de matéria',
        fieldInstruction: 'Clique em "Criar Matéria" para salvar o registro no banco de dados.',
        goldenTip: 'Uma vez cadastrada, a matéria aparecerá instantaneamente no seu painel de especialidades.',
        targetSelector: '[data-tour="internato-save-subject-btn"]',
        targetView: 'subjects'
      },
      {
        stepIndex: 5,
        title: 'Selecionar a Matéria Criada',
        targetDescription: 'Matéria na lista',
        fieldInstruction: 'Sinta-se livre para clicar em qualquer matéria na listagem abaixo para abrir os tópicos correspondentes.',
        goldenTip: 'As matérias guardam todos os temas específicos, resumos, revisões e questões daquela disciplina.',
        targetSelector: '[data-tour="internato-subject-card-0"]',
        targetView: 'subjects',
        isFreeExplore: true
      },
      {
        stepIndex: 6,
        title: 'Adicionar Tópico de Estudo',
        targetDescription: 'Campo de inclusão de novo tópico',
        fieldInstruction: 'Sinta-se livre para digitar o assunto que deseja estudar (Ex: Apendicite ou Asma) no campo destacado e clique em Adicionar.',
        goldenTip: 'Cadastrar tópicos específicos garante resumos e simulados direcionados e precisos.',
        targetSelector: '[data-tour="internato-add-topic-btn"]',
        targetView: 'subjects',
        isFreeExplore: true
      },
      {
        stepIndex: 7,
        title: 'Abrir Tópico do Tema',
        targetDescription: 'Card do tópico de estudo',
        fieldInstruction: 'Clique no card do tópico de estudo. Isso abrirá a central inteligente com o resumo gerado automaticamente pela IA!',
        goldenTip: 'O tutorial se encerra aqui para que você explore o assistente de IA que já se abre de forma totalmente autônoma!',
        targetSelector: '[data-tour="internato-topic-card"]',
        targetView: 'subjects'
      }
    ]
  },
  'internato-cronograma': {
    id: 'internato-cronograma',
    featureName: 'Como Criar Planejamentos de Estudo',
    module: 'medinternato',
    steps: [
      {
        stepIndex: 1,
        title: 'Acessar o Planejamento',
        targetDescription: 'Menu de Cronogramas do MedInternato',
        fieldInstruction: 'Clique na aba "Planejamento" no menu superior.',
        goldenTip: 'O planejador adapta o volume de estudo à sua carga horária livre do internato.',
        targetSelector: '[data-tour="internato-cronograma-tab"]',
        targetView: 'cronograma'
      },
      {
        stepIndex: 2,
        title: 'Criar Novo Cronograma',
        targetDescription: 'Ajuste de metas e datas limite',
        fieldInstruction: 'Clique em "+ Novo Cronograma" para definir seu ciclo de estudos.',
        goldenTip: 'Se você tiver plantões fixos, indique as horas reais disponíveis para que o sistema organize sem acúmulos.',
        targetSelector: '[data-tour="internato-new-cronograma-btn"]',
        targetView: 'cronograma'
      },
      {
        stepIndex: 3,
        title: 'Escolher Foco de Estudo',
        targetDescription: 'Modalidade de estudos',
        fieldInstruction: 'Sinta-se livre para selecionar o modo ideal de planejamento (Minha Faculdade, Residência ou Híbrido).',
        goldenTip: 'Ao escolher o modo de Faculdade, você pode opcionalmente colar ou digitar a ementa do período para agendamentos inteligentes.',
        targetSelector: '[data-tour="internato-cronograma-mode-btn"]',
        targetView: 'cronograma',
        isFreeExplore: true
      },
      {
        stepIndex: 4,
        title: 'Avançar no Formulário',
        targetDescription: 'Botão para o próximo passo do cronograma',
        fieldInstruction: 'Sinta-se livre para avançar os passos do assistente de cronograma definindo seus dias de estudo e horas disponíveis.',
        goldenTip: 'A IA calculará dinamicamente seu cronograma com base nas horas diárias selecionadas.',
        targetSelector: '[data-tour="internato-cronograma-next-step"]',
        targetView: 'cronograma',
        isFreeExplore: true
      },
      {
        stepIndex: 5,
        title: 'Confirmar e Criar Cronograma',
        targetDescription: 'Botão de salvamento final',
        fieldInstruction: 'Clique no botão destacado para gerar seu cronograma. O sistema fará todo o processamento de forma automática!',
        goldenTip: 'Bons estudos! Seu cronograma estará pronto em segundos no seu painel diário.',
        targetSelector: '[data-tour="internato-cronograma-confirm-btn"]',
        targetView: 'cronograma'
      }
    ]
  },
  'internato-materias': {
    id: 'internato-materias',
    featureName: 'Como Criar Matérias e Tópicos no MedInternato',
    module: 'medinternato',
    steps: [
      {
        stepIndex: 1,
        title: 'Acessar Especialidades',
        targetDescription: 'Aba de Especialidades',
        fieldInstruction: 'Clique no menu "Especialidades" no menu superior.',
        goldenTip: 'Organize suas matérias de acordo com os rodízios do internato.',
        targetSelector: '[data-tour="internato-subjects-tab"]',
        targetView: 'subjects'
      },
      {
        stepIndex: 2,
        title: 'Abrir Formulário de Matéria',
        targetDescription: 'Botão de inclusão de matéria',
        fieldInstruction: 'Clique no botão "+ Matéria" para abrir o formulário de cadastro de disciplina.',
        goldenTip: 'Se você já tiver matérias cadastradas, pode avançar diretamente para o passo 5 selecionando sua matéria na lista.',
        targetSelector: '[data-tour="internato-new-subject-btn"]',
        targetView: 'subjects'
      },
      {
        stepIndex: 3,
        title: 'Digitar Nome da Matéria',
        targetDescription: 'Campo para o nome da matéria',
        fieldInstruction: 'Sinta-se livre para encontrar o campo destacado e digitar o nome da matéria (Ex: Pediatria ou Ginecologia).',
        goldenTip: 'Atribuir a matéria a um ciclo ou semestre ajuda você a localizá-la mais rápido na tela.',
        targetSelector: '[data-tour="internato-subject-input"]',
        targetView: 'subjects',
        isFreeExplore: true
      },
      {
        stepIndex: 4,
        title: 'Confirmar Cadastro de Matéria',
        targetDescription: 'Botão de confirmação de matéria',
        fieldInstruction: 'Clique em "Criar Matéria" para salvar o registro no banco de dados.',
        goldenTip: 'Sua nova matéria aparecerá imediatamente na listagem geral.',
        targetSelector: '[data-tour="internato-save-subject-btn"]',
        targetView: 'subjects'
      },
      {
        stepIndex: 5,
        title: 'Selecionar a Matéria Criada',
        targetDescription: 'Matéria na lista',
        fieldInstruction: 'Sinta-se livre para clicar em qualquer matéria na listagem abaixo para abrir a sua central de temas e tópicos.',
        goldenTip: 'Selecione a matéria criada para começarmos a adicionar os temas e subtemas específicos.',
        targetSelector: '[data-tour="internato-subject-card-0"]',
        targetView: 'subjects',
        isFreeExplore: true
      },
      {
        stepIndex: 6,
        title: 'Adicionar Tópicos',
        targetDescription: 'Inclusão de temas específicos',
        fieldInstruction: 'Sinta-se livre para digitar o assunto específico (Ex: Calendário Vacinal ou Colecistite) no campo destacado e clique em Adicionar.',
        goldenTip: 'Tópicos específicos garantem simulados de revisão e flashcards altamente focados.',
        targetSelector: '[data-tour="internato-add-topic-btn"]',
        targetView: 'subjects',
        isFreeExplore: true
      }
    ]
  },
  'internato-questoes': {
    id: 'internato-questoes',
    featureName: 'Como Criar e Praticar Questões das Bancas',
    module: 'medinternato',
    steps: [
      {
        stepIndex: 1,
        title: 'Acessar Módulo de Questões',
        targetDescription: 'Menu de Questões',
        fieldInstruction: 'Clique no menu "Questões" no menu superior.',
        goldenTip: 'O banco de dados reúne questões oficiais na íntegra das principais bancas de residência.',
        targetSelector: '[data-tour="internato-questions-tab"]',
        targetView: 'questions'
      },
      {
        stepIndex: 2,
        title: 'Escolher Metodologia do Simulado',
        targetDescription: 'Formato de seleção de questões',
        fieldInstruction: 'Sinta-se livre para clicar no modo "Filtro Personalizado" para customizar suas questões.',
        goldenTip: 'Você também pode escolher o modo "Bancas Foco", selecionar seus erros da IA ou criar simulados oficiais com pesos de editais como ENARE.',
        targetSelector: '[data-tour="internato-questoes-mode-custom"]',
        targetView: 'questions',
        isFreeExplore: true
      },
      {
        stepIndex: 3,
        title: 'Filtrar por Especialidades',
        targetDescription: 'Listagem de matérias do internato',
        fieldInstruction: 'Sinta-se livre para clicar em qualquer especialidade (Ex: Cardiologia) para carregar os seus tópicos.',
        goldenTip: 'Ao escolher uma especialidade, você foca os estudos exatamente nas disciplinas do seu rodízio atual.',
        targetSelector: '[data-tour="internato-questoes-subject-btn"]',
        targetView: 'questions',
        isFreeExplore: true
      },
      {
        stepIndex: 4,
        title: 'Selecionar Temas Específicos',
        targetDescription: 'Subtemas de estudos',
        fieldInstruction: 'Sinta-se livre para escolher os subtemas que deseja treinar clicando neles.',
        goldenTip: 'Estudar por temas altamente granulares melhora a precisão na fixação teórica.',
        targetSelector: '[data-tour="internato-questoes-topic-btn"]',
        targetView: 'questions',
        isFreeExplore: true
      },
      {
        stepIndex: 5,
        title: 'Ajuste de Filtros Avançados',
        targetDescription: 'Seleção de temas e bancas examinadoras',
        fieldInstruction: 'Sinta-se livre para explorar os filtros de exclusão de resolvidas, escolher Modo Treino ou Simulado.',
        goldenTip: 'O Modo Treino exibe comentários pedagógicos detalhados e gabarito na hora. O Modo Simulado simula a tensão real da prova.',
        targetSelector: '[data-tour="internato-question-filters"]',
        targetView: 'questions',
        isFreeExplore: true
      },
      {
        stepIndex: 6,
        title: 'Iniciar Simulado',
        targetDescription: 'Geração do caderno de questões',
        fieldInstruction: 'Clique no botão "Iniciar Simulado" para começar a resolver as questões!',
        goldenTip: 'Todas as questões são transcritas de forma 100% fiel às provas oficiais das bancas.',
        targetSelector: '[data-tour="internato-start-questions-btn"]',
        targetView: 'questions'
      }
    ]
  },
  'internato-flashcards': {
    id: 'internato-flashcards',
    featureName: 'Como Praticar e Criar Flashcards',
    module: 'medinternato',
    steps: [
      {
        stepIndex: 1,
        title: 'Acessar Central de Flashcards',
        targetDescription: 'Aba de Flashcards',
        fieldInstruction: 'Clique no menu "Flashcards" no menu superior.',
        goldenTip: 'O estudo por flashcards utiliza recordação ativa (active recall) e repetição espaçada, as técnicas cientificamente mais eficazes de retenção.',
        targetSelector: '[data-tour="internato-flashcards-tab"]',
        targetView: 'flashcards'
      },
      {
        stepIndex: 2,
        title: 'Método: Devidos Hoje (Algoritmo SRS)',
        targetDescription: 'Cards agendados para revisão',
        fieldInstruction: 'Clique em "Devidos Hoje" para abrir os cards agendados pelo algoritmo de repetição espaçada.',
        goldenTip: 'O sistema calcula o exato dia e hora em que sua memória está prestes a esquecer para sugerir a revisão ideal, achatando a curva de esquecimento.',
        targetSelector: '[data-tour="internato-flashcards-tab-srs"]',
        targetView: 'flashcards',
        isFreeExplore: true
      },
      {
        stepIndex: 3,
        title: 'Prática Por Matéria',
        targetDescription: 'Praticar especialidades isoladas',
        fieldInstruction: 'Sinta-se livre para clicar na aba "Por Matéria" para estudar temas focados sob demanda.',
        goldenTip: 'Ideal para revisar uma matéria específica antes de uma prova da faculdade.',
        targetSelector: '[data-tour="internato-flashcards-tab-subject"]',
        targetView: 'flashcards',
        isFreeExplore: true
      },
      {
        stepIndex: 4,
        title: 'Análise de Diagnóstico',
        targetDescription: 'Mapa de domínio de disciplinas',
        fieldInstruction: 'Sinta-se livre para clicar em "Diagnóstico" para ver o seu mapa de dominância cognitiva.',
        goldenTip: 'O diagnóstico destaca quais especialidades possuem mais cards vermelhos (com erros), ajudando você a focar seus esforços.',
        targetSelector: '[data-tour="internato-flashcards-tab-diagnostic"]',
        targetView: 'flashcards',
        isFreeExplore: true
      },
      {
        stepIndex: 5,
        title: 'Histórico de Estudo',
        targetDescription: 'Painel de revisões passadas',
        fieldInstruction: 'Sinta-se livre para clicar em "Histórico" para conferir sua consistência diária.',
        goldenTip: 'Manter o histórico em dia ajuda a criar hábitos sólidos e acompanhar seu progresso no internato.',
        targetSelector: '[data-tour="internato-flashcards-tab-history"]',
        targetView: 'flashcards',
        isFreeExplore: true
      },
      {
        stepIndex: 6,
        title: 'Estudos Aprofundados',
        targetDescription: 'Cards de raciocínio avançado',
        fieldInstruction: 'Sinta-se livre para clicar em "Aprofundados" para abrir desafios de casos clínicos.',
        goldenTip: 'Flashcards normais focam em decorebas rápidas; os aprofundados testam seu julgamento clínico e diagnóstico diferencial.',
        targetSelector: '[data-tour="internato-flashcards-tab-deepdives"]',
        targetView: 'flashcards',
        isFreeExplore: true
      },
      {
        stepIndex: 7,
        title: 'Criar Seu Próprio Card',
        targetDescription: 'Formulário de cadastro manual',
        fieldInstruction: 'Sinta-se livre para clicar em "Novo Card" para escrever suas próprias perguntas e respostas.',
        goldenTip: 'Cadastrar suas próprias anotações em formato de perguntas de recordação ativa acelera a assimilação de novos conceitos.',
        targetSelector: '[data-tour="internato-flashcards-tab-create"]',
        targetView: 'flashcards',
        isFreeExplore: true
      },
      {
        stepIndex: 8,
        title: 'Gerar com Inteligência Artificial',
        targetDescription: 'Decks rápidos com IA',
        fieldInstruction: 'Clique no botão "Gerar Rápido com IA" para que o sistema crie novos cards instantaneamente sobre seus tópicos!',
        goldenTip: 'A IA lê os resumos da matéria para confeccionar cards de alta qualidade no formato de pergunta-resposta curta.',
        targetSelector: '[data-tour="internato-gen-flashcards-btn"]',
        targetView: 'flashcards'
      }
    ]
  },
  'revise-semestres': {
    id: 'revise-semestres',
    featureName: 'Como Criar Semestres no MedRevise',
    module: 'medrevise',
    steps: [
      {
        stepIndex: 1,
        title: 'Acessar Matérias & Editais',
        targetDescription: 'Aba de Matérias do MedRevise',
        fieldInstruction: 'Acesse o menu "Matérias & Editais" no MedRevise.',
        goldenTip: 'Os semestres organizam os períodos da faculdade ou ciclos preparatórios.',
        targetSelector: '[data-tour="revise-subjects-tab"]',
        targetView: 'subjects'
      },
      {
        stepIndex: 2,
        title: 'Cadastrar Semestre',
        targetDescription: 'Botão de incluir novo semestre',
        fieldInstruction: 'Clique no botão "+ SEMESTRE". Digite o nome do ciclo e salve.',
        goldenTip: 'Filtrar por semestre mantém o painel diário focado no seu período letivo.',
        targetSelector: '[data-tour="revise-new-semester-btn"]',
        targetView: 'subjects',
        isFreeExplore: true
      }
    ]
  },
  'revise-materias': {
    id: 'revise-materias',
    featureName: 'Como Criar Matérias e Tópicos no MedRevise',
    module: 'medrevise',
    steps: [
      {
        stepIndex: 1,
        title: 'Criar Matéria',
        targetDescription: 'Inclusão de disciplina',
        fieldInstruction: 'No semestre ativo, clique no botão para adicionar matéria.',
        goldenTip: 'Defina cores para cada matéria para visualização rápida no calendário.',
        targetSelector: '[data-tour="revise-new-subject-btn"]',
        targetView: 'subjects'
      },
      {
        stepIndex: 2,
        title: 'Adicionar Tópicos',
        targetDescription: 'Assuntos acompanhados pela Curva de Ebbinghaus',
        fieldInstruction: 'Abra a matéria e clique em "+ Adicionar Tópico" para cadastrar o assunto.',
        goldenTip: 'Nomes específicos como "Pré-Eclâmpsia e Eclâmpsia" garantem revisões mais precisas.',
        targetSelector: '[data-tour="revise-add-topic-btn"]',
        targetView: 'subjects',
        isFreeExplore: true
      }
    ]
  },
  'revise-registros': {
    id: 'revise-registros',
    featureName: 'Como Registrar Estudo Primário, Revisões e Simulados',
    module: 'medrevise',
    steps: [
      {
        stepIndex: 1,
        title: 'Registrar Estudo Primário',
        targetDescription: 'Primeira leitura teórica',
        fieldInstruction: 'Clique no botão "Estudar" no card do tópico ao concluir a leitura teórica inicial.',
        goldenTip: 'Use "Estudar" somente no primeiro contato com a matéria.',
        targetSelector: '[data-tour="revise-study-btn"]',
        targetView: 'subjects',
        isFreeExplore: true
      },
      {
        stepIndex: 2,
        title: 'Registrar Revisão',
        targetDescription: 'Atualização do algoritmo SRS',
        fieldInstruction: 'Aperte no botão "Revisar" ao refazer questões do tema e informe seu percentual de acertos.',
        goldenTip: 'O algoritmo recalculará as datas das próximas revisões (R1 24h, R2 7d, R3 15d, R4 30d) de acordo com seu desempenho.',
        targetSelector: '[data-tour="revise-review-btn"]',
        targetView: 'subjects',
        isFreeExplore: true
      }
    ]
  }
};

interface ActionGuidedTourProps {
  tourId: string | null;
  onClose: () => void;
  onNavigateView?: (viewName: string) => void;
  currentView?: string; // High-precision current view tracking to avoid redundant clicks
  onSwitchTour?: (tourId: string) => void;
}

export default function ActionGuidedTour({ tourId, onClose, onNavigateView, currentView, onSwitchTour }: ActionGuidedTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [hasPrerequisite, setHasPrerequisite] = useState(true);

  useEffect(() => {
    setCurrentStepIndex(0);
  }, [tourId]);

  useEffect(() => {
    if (tourId === 'revise-registros') {
      // Keep it true initially to allow Firestore data to load and render
      setHasPrerequisite(true);
      
      const timer = setTimeout(() => {
        const studyBtn = document.querySelector('[data-tour="revise-study-btn"]');
        const hasCards = document.querySelector('.group.cursor-pointer') !== null || studyBtn !== null;
        setHasPrerequisite(hasCards);
      }, 5000); // 5 seconds generous delay to allow network results to arrive
      
      return () => clearTimeout(timer);
    } else {
      setHasPrerequisite(true);
    }
  }, [tourId, currentStepIndex]);

  const tour = tourId ? FEATURE_TOURS[tourId] : null;
  const step = tour ? tour.steps[currentStepIndex] : null;

  // Whenever step or tour changes, tell parent app to navigate to step's target view
  useEffect(() => {
    if (step?.targetView && onNavigateView) {
      onNavigateView(step.targetView);
    }
  }, [step, onNavigateView]);

  // Smart Skip/Auto-Advance: If they are already on the target page for the first step, skip to next step!
  useEffect(() => {
    if (tour && step && currentView && currentStepIndex === 0) {
      const stepTargetSelector = step.targetSelector;
      const onSubjectsPage = currentView === 'subjects' || currentView === 'topicDetail';
      
      const isSubjectsTab = stepTargetSelector === '[data-tour="internato-subjects-tab"]' || 
                            stepTargetSelector === '[data-tour="revise-subjects-tab"]';
      const isCronogramaTab = stepTargetSelector === '[data-tour="internato-cronograma-tab"]' && currentView === 'cronograma';
      const isQuestionsTab = stepTargetSelector === '[data-tour="internato-questions-tab"]' && currentView === 'questions';
      const isFlashcardsTab = stepTargetSelector === '[data-tour="internato-flashcards-tab"]' && currentView === 'flashcards';

      if ((isSubjectsTab && onSubjectsPage) || isCronogramaTab || isQuestionsTab || isFlashcardsTab) {
        // Already on correct page - auto advance so they don't have to click a button that's already active!
        if (tour.steps.length > 1) {
          setCurrentStepIndex(1);
        }
      }
    }
  }, [step, currentView, tour, currentStepIndex]);

  // Track and locate target element bounding box on screen
  useEffect(() => {
    if (!step?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(step.targetSelector!);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    const timer = setTimeout(updateRect, 300);
    const interval = setInterval(updateRect, 600);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [step, currentStepIndex]);

  const isTargetInRightHalf = targetRect ? (targetRect.left + targetRect.width / 2 > window.innerWidth / 2) : false;

  const totalSteps = tour ? tour.steps.length : 0;
  const isFirst = currentStepIndex === 0;
  const isLast = tour ? currentStepIndex === totalSteps - 1 : false;

  const handleNext = () => {
    if (!tour) return;
    if (isLast) {
      localStorage.removeItem('active_action_tour_id');
      onClose();
    } else {
      const nextIndex = currentStepIndex + 1;
      const nextStep = tour.steps[nextIndex];
      setCurrentStepIndex(nextIndex);
      if (nextStep?.targetView && onNavigateView) {
        onNavigateView(nextStep.targetView);
      }
    }
  };

  const handlePrev = () => {
    if (!tour) return;
    if (!isFirst) {
      const prevIndex = currentStepIndex - 1;
      const prevStep = tour.steps[prevIndex];
      setCurrentStepIndex(prevIndex);
      if (prevStep?.targetView && onNavigateView) {
        onNavigateView(prevStep.targetView);
      }
    }
  };

  // Listen to global click events to detect if the user clicked the target element or its children, and auto-advance!
  useEffect(() => {
    if (!step?.targetSelector) return;

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const targetSelector = step.targetSelector!;

      // Special case: If they click on any subject card (even if not card-0)
      if (
        targetSelector === '[data-tour="internato-subject-card-0"]' &&
        (target.closest('[data-tour^="internato-subject-card-"]') || target.closest('.group.cursor-pointer'))
      ) {
        setTimeout(() => {
          handleNext();
        }, 300);
        return;
      }

      // If the clicked element is an input, select dropdown, or textarea, don't auto-advance on click!
      // The user needs to type/select first, and the next step is usually clicking a button which will advance.
      if (target.tagName) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
          return;
        }
      }

      // Robust check: matches targetSelector or is inside any element matching targetSelector
      if (target.closest(targetSelector) !== null) {
        // User interacted with the correct highlighted target element!
        // Advance the step automatically after a tiny delay so the element's onClick logic executes first!
        setTimeout(() => {
          handleNext();
        }, 300);
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [step, currentStepIndex, tour]);

  if (!tourId || !tour || !step) return null;

  if (!hasPrerequisite) {
    const handleSwitchToMaterials = () => {
      localStorage.setItem('active_action_tour_id', 'revise-materias');
      if (onSwitchTour) {
        onSwitchTour('revise-materias');
      } else {
        window.location.reload();
      }
    };

    return (
      <div className="fixed inset-0 z-[10000] flex flex-col justify-end p-4 sm:p-6 animate-fade-in bg-black/40 pointer-events-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="pointer-events-auto z-[10020] bg-[#FAF9F5] border-2 border-red-600 shadow-[12px_12px_0px_0px_rgba(220,38,38,1)] rounded-2xl max-w-xl w-full mx-auto overflow-hidden flex flex-col space-y-0"
        >
          {/* Card Header */}
          <div className="p-4 bg-red-600 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-white rounded-xl text-red-600 font-black shrink-0">
                <AlertCircle className="w-4 h-4 text-red-600 fill-red-100 animate-pulse" />
              </div>
              <div className="truncate">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-red-100 block">
                  Aviso de Pré-requisito
                </span>
                <h3 className="font-serif italic font-bold text-sm sm:text-base text-white truncate">
                  Nenhuma Matéria Cadastrada
                </h3>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('active_action_tour_id');
                onClose();
              }}
              className="p-1.5 text-red-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Card Body */}
          <div className="p-5 space-y-4 bg-white text-stone-900">
            <p className="text-sm font-bold text-stone-800 leading-relaxed">
              Você iniciou o tutorial de <strong className="text-red-700">"Registrar Estudos e Revisões"</strong>, mas ainda não possui nenhuma matéria ou tópico cadastrado no seu MedRevise.
            </p>
            <p className="text-xs text-stone-600 leading-relaxed">
              Para simular o registro de estudos com a nossa Curva de Repetição Espaçada, é necessário cadastrar suas disciplinas primeiro.
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <span className="text-[10px] font-mono font-bold uppercase text-red-800 flex items-center gap-1.5">
                💡 O que fazer agora:
              </span>
              <p className="text-xs text-red-950 font-sans font-medium pt-1">
                Sugerimos que você veja primeiro o nosso passo a passo detalhado de como criar matérias e tópicos no MedRevise!
              </p>
            </div>
          </div>

          {/* Card Controls */}
          <div className="p-4 bg-[#FAF9F5] border-t border-stone-200 flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={() => {
                localStorage.removeItem('active_action_tour_id');
                onClose();
              }}
              className="px-4 py-2 bg-white border border-stone-300 text-stone-700 text-xs font-bold rounded-xl hover:bg-stone-50 cursor-pointer"
            >
              Fechar Tutorial
            </button>

            <button
              onClick={handleSwitchToMaterials}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-black uppercase rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>👉 Como Criar Matérias</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleSpotlightTargetClick = () => {
    if (step.targetSelector) {
      const el = document.querySelector(step.targetSelector) as HTMLElement;
      if (el) {
        el.click();
      }
    }
    handleNext();
  };

  // backdrop color configuration (regular is less dark - 42% opacity instead of 75%, freeExplore is ultra-light 5% opacity for typing)
  const backdropColor = step.isFreeExplore ? 'rgba(10, 10, 10, 0.05)' : 'rgba(10, 10, 10, 0.42)';
  const backdropPointerEvents = step.isFreeExplore ? 'none' : 'auto';

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none flex flex-col justify-end p-4 sm:p-6 animate-fade-in">
      {/* 4-Backdrop Dimmed Layout (Leaves center spotlight hole 100% untouched by any DOM element, ensuring native browser click-through!) */}
      {targetRect ? (
        <>
          {/* Top Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: Math.max(0, targetRect.top - 6),
              backgroundColor: backdropColor,
              pointerEvents: backdropPointerEvents,
              zIndex: 9990,
            }}
          />
          {/* Bottom Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: targetRect.top + targetRect.height + 6,
              left: 0,
              width: '100vw',
              bottom: 0,
              backgroundColor: backdropColor,
              pointerEvents: backdropPointerEvents,
              zIndex: 9990,
            }}
          />
          {/* Left Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: Math.max(0, targetRect.top - 6),
              left: 0,
              width: Math.max(0, targetRect.left - 6),
              height: targetRect.height + 12,
              backgroundColor: backdropColor,
              pointerEvents: backdropPointerEvents,
              zIndex: 9990,
            }}
          />
          {/* Right Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: Math.max(0, targetRect.top - 6),
              left: targetRect.left + targetRect.width + 6,
              right: 0,
              height: targetRect.height + 12,
              backgroundColor: backdropColor,
              pointerEvents: backdropPointerEvents,
              zIndex: 9990,
            }}
          />
        </>
      ) : (
        <div 
          className="fixed inset-0 bg-black/45 backdrop-blur-xs pointer-events-auto z-[9990]" 
        />
      )}

      {/* Target Element Glowing Animated Border Frame (pointer-events-none so click passes directly to underlying inputs/buttons) */}
      {targetRect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'fixed',
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
          className="z-[10010] pointer-events-none rounded-2xl border-2 border-amber-400 ring-4 ring-amber-400/80 shadow-[0_0_35px_rgba(245,158,11,1)] animate-pulse flex items-center justify-center bg-transparent"
        >
          <div 
            onClick={handleNext}
            className="absolute -top-8 left-1/2 -translate-x-1/2 bg-amber-400 text-stone-950 font-mono text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1.5 shrink-0 z-20 pointer-events-auto cursor-pointer hover:bg-amber-300 transition-colors"
            title="Interaja com o campo abaixo ou clique aqui para avançar o passo!"
          >
            <MousePointer className="w-3.5 h-3.5 animate-bounce text-stone-950" />
            <span>INTERAÇÃO LIBERADA • CLIQUE NO CAMPO OU AQUI</span>
          </div>
        </motion.div>
      )}

      {/* Floating Spotlight Action Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`pointer-events-auto z-[10020] bg-[#FAF9F5] border-2 border-[#141414] shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] rounded-2xl max-w-xl w-full mx-auto overflow-hidden flex flex-col space-y-0 transition-all duration-300 ${
          isTargetInRightHalf ? 'sm:ml-4 sm:mr-auto' : 'sm:mr-4 sm:ml-auto'
        }`}
      >
        {/* Card Header */}
        <div className="p-4 bg-[#141414] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-[#D44E3D] rounded-xl text-white font-black shrink-0">
              <MousePointer className="w-4 h-4 animate-bounce" />
            </div>
            <div className="truncate">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-300 block">
                TUTORIAL INTERATIVO • PASSO {step.stepIndex} DE {totalSteps}
              </span>
              <h3 className="font-serif italic font-bold text-sm sm:text-base text-white truncate">
                {tour.featureName}
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('active_action_tour_id');
              onClose();
            }}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Pular / Encerrar Tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-4 py-2 bg-[#E2E0D9]/80 border-b border-[#E2E0D9] flex items-center justify-between gap-2 text-[10px] font-mono font-bold">
          <span className="text-stone-800">{step.title}</span>
          <span className="text-[#D44E3D]">{step.stepIndex}/{totalSteps}</span>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 space-y-3 bg-white text-stone-900">
          <div className="p-3 bg-amber-50/90 border-2 border-amber-300 rounded-xl space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase text-amber-900 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#D44E3D]" />
              Onde clicar agora na tela:
            </span>
            <p className="text-xs sm:text-sm font-bold text-stone-900 leading-relaxed font-sans">
              {step.fieldInstruction}
            </p>
            {targetRect && (
              <p className="text-[10px] text-amber-800 font-mono font-semibold pt-1">
                Dica: O botão/campo está 100% claro e destacado em amarelo na sua tela! Você pode clicar diretamente nele para avançar.
              </p>
            )}
          </div>

          <div className="p-3 bg-[#FAF9F5] border border-stone-200 rounded-xl space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase text-stone-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Orientação Médica do Passo:
            </span>
            <p className="text-xs text-stone-700 font-sans leading-relaxed">
              {step.goldenTip}
            </p>
          </div>
        </div>

        {/* Card Controls */}
        <div className="p-3.5 bg-[#FAF9F5] border-t border-stone-300 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-1 ${
                isFirst
                  ? 'opacity-30 cursor-not-allowed text-stone-400 bg-stone-100 border border-stone-200'
                  : 'bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 cursor-pointer'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>

            <button
              onClick={() => {
                localStorage.removeItem('active_action_tour_id');
                onClose();
              }}
              className="text-[10px] font-mono font-bold text-stone-500 hover:text-stone-900 underline cursor-pointer px-1"
            >
              Pular Tutorial
            </button>
          </div>

          <button
            onClick={handleSpotlightTargetClick}
            className="px-5 py-2 bg-[#141414] hover:bg-[#D44E3D] text-white font-mono text-xs font-bold uppercase rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            {isLast ? (
              <>
                <span>Concluir Tutorial</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Avançar Passo</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
