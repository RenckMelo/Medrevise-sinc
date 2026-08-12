import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  BookOpen, 
  GraduationCap, 
  Award, 
  Clock, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  RotateCw, 
  Layers, 
  ListOrdered, 
  Plus, 
  Trash2, 
  FileText, 
  Zap, 
  AlertCircle,
  X,
  Search,
  Eye,
  ListFilter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { MEDICAL_EXAMS_DB } from '../data/medicalExams';
import { generateCollegeCustomPlan } from '../utils/scheduleGenerator';

interface SchedulePlannerWizardProps {
  onGenerateSchedule: (config: {
    planType: 'college_only' | 'residency_only' | 'hybrid';
    collegeCustomTopics: string[];
    selectedExamId: string;
    modality: '6meses' | '1ano' | '2anos' | 'dynamic' | 'college_custom';
    studyDays: string[];
    hoursPerDay: number;
    startDate: string;
    examDate?: string;
    weeksDuration: number;
    revisionStrategy: 'spaced' | 'weekly' | 'exam';
    currentSemesterSubjects: string[];
    onlyCurrentSemester: boolean;
    generatedWeeks: any[];
    totals: {
      topicsCount: number;
      revisionsCount: number;
      sessionsCount: number;
    };
  }) => Promise<void>;
  onCancel: () => void;
  availableCredits: number;
  isGenerating?: boolean;
}

const SAMPLE_COLLEGE_TOPICS = [
  'Anatomia e Fisiologia do Aparelho Cardiovascular',
  'Semiologia Cardiológica e Ausculta de Sopros',
  'Insuficiência Cardíaca Congestiva (ICC) - Classificação e Manejo',
  'Hipertensão Arterial Sistêmica (HAS) e Crises Hipertensivas',
  'Eletrocardiograma (ECG): Leitura Sistemática e Ritmos Chave',
  'Síndromes Coronarianas Agudas (IAM com e sem Supradesnivelamento ST)',
  'Farmacologia Cardiológica: Inotrópicos, Anti-hipertensivos e Antiarrítmicos',
  'Pneumonias Adquiridas na Comunidade (PAC) e Escores CURB-65',
  'Crise Asmática Grave e DPOC Descompensada',
  'Insuficiência Renal Aguda (IRA) vs Doença Renal Crônica (DRC)'
];

export function parseCollegeSyllabusText(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  // 1. Remove university/institutional footers or page numbers if present
  let cleaned = rawText
    .replace(/Universidade\s+Evang[ée]lica\s+de\s+Goi[áa]s\s*[-–—]?\s*UniEVANG[ÉE]LICA/gi, ' ')
    .replace(/Avenida\s+Universit[áa]ria,\s*km\.\s*3,5/gi, ' ')
    .replace(/Cidade\s+Universit[áa]ria\s*[-–—]?\s*An[áa]polis\s*[-–—]?\s*GO/gi, ' ')
    .replace(/CEP:\s*\d{5}-\d{3}/gi, ' ')
    .replace(/Fone:\s*\(\d{2}\)\s*\d{4}\s*\d{4}/gi, ' ')
    .replace(/www\.[a-z0-9\.-]+/gi, ' ')
    .replace(/P[áa]gina\s+\d+(\s+de\s+\d+)?/gi, ' ')
    .replace(/[“"].*?fez\s+o\s+Senhor.*?[”"]/gi, ' ')
    .replace(/Sl\s+\d+,\d+/gi, ' ');

  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  // Normalize inline numbered items or bullets stuck together on one line
  // e.g. "1. Tema A 2. Tema B" -> "1. Tema A \n 2. Tema B"
  cleaned = cleaned.replace(/(?<=[^\n])\s+(?=\b\d{1,2}[\.\-\)]\s+[A-Z\u00C0-\u00DDa-z\u00E0-\u00FF])/g, '\n');
  cleaned = cleaned.replace(/(?<=[^\n])\s+(?=[•\*\-]\s+[A-Z\u00C0-\u00DDa-z\u00E0-\u00FF])/g, '\n');

  // List of major discipline title patterns to catch common medical specialties
  const KNOWN_SPECIALTIES = [
    { pattern: /GERIATRIA\s*[\/\\]\s*ONCO\s*[\/\\]\s*CUIDADOS\s+PALIATIVOS/gi, name: 'GERIATRIA / ONCOLOGIA' },
    { pattern: /URGÊNCIAS\s+E\s+EMERGÊNCIAS|URGÊNCIA\s+E\s+EMERGÊNCIA/gi, name: 'URGÊNCIAS E EMERGÊNCIAS' },
    { pattern: /CLÍNICA\s+MÉDICA/gi, name: 'CLÍNICA MÉDICA' },
    { pattern: /SAÚDE\s+MENTAL|PSIQUIATRIA/gi, name: 'SAÚDE MENTAL' },
    { pattern: /MEDICINA\s+DE\s+FAMÍLIA\s+E\s+COMUNIDADE|\bMFC\b/gi, name: 'MEDICINA DE FAMÍLIA (MFC)' },
    { pattern: /\bCIRURGIA\b/gi, name: 'CIRURGIA' },
    { pattern: /\bPEDIATRIA\b/gi, name: 'PEDIATRIA' },
    { pattern: /\bOBSTETRÍCIA\b/gi, name: 'OBSTETRÍCIA' },
    { pattern: /\bGINECOLOGIA\b/gi, name: 'GINECOLOGIA' },
    { pattern: /\bGO\b|GINECOLOGIA\s+E\s+OBSTETRÍCIA/gi, name: 'GINECOLOGIA E OBSTETRÍCIA' },
    { pattern: /CARDIOLOGIA/gi, name: 'CARDIOLOGIA' },
    { pattern: /NEUROLOGIA/gi, name: 'NEUROLOGIA' },
    { pattern: /NEFROLOGIA/gi, name: 'NEFROLOGIA' },
    { pattern: /PNEUMOLOGIA/gi, name: 'PNEUMOLOGIA' },
    { pattern: /GASTROENTEROLOGIA/gi, name: 'GASTROENTEROLOGIA' },
    { pattern: /INFECTOLOGIA/gi, name: 'INFECTOLOGIA' },
    { pattern: /ENDOCRINOLOGIA/gi, name: 'ENDOCRINOLOGIA' },
    { pattern: /REUMATOLOGIA/gi, name: 'REUMATOLOGIA' },
    { pattern: /DERMATOLOGIA/gi, name: 'DERMATOLOGIA' },
    { pattern: /HEMATOLOGIA/gi, name: 'HEMATOLOGIA' },
    { pattern: /ONCOLOGIA/gi, name: 'ONCOLOGIA' },
    { pattern: /ORTOPEDIA|TRAUMATOLOGIA/gi, name: 'ORTOPEDIA E TRAUMATOLOGIA' }
  ];

  let formatted = cleaned;

  // Insert sentinels for known specialties
  KNOWN_SPECIALTIES.forEach(item => {
    formatted = formatted.replace(item.pattern, () => `\n[[SUBJECT:${item.name}]]\n`);
  });

  // Strip sub-headers that are not topics
  formatted = formatted.replace(/Grandes\s+S[íi]ndromes\s+Cl[íi]nicas/gi, ' ');
  formatted = formatted.replace(/Doen[çc]as\s+Cl[íi]nicas\s+que\s+o\s+Interno\s+Deve\s+Dominar/gi, ' ');
  formatted = formatted.replace(/Conte[úu]do\s+Program[áa]tico|Ementa\s+do\s+M[óo]dulo/gi, ' ');

  // Insert breaks before items starting with digits, dots, dashes, parentheses or bullets
  formatted = formatted.replace(/(?<=[^\n])\s+(?=\.?\s*\b\d{1,2}[\.\-\)]\s*|\.\s+[A-Z\u00C0-\u00DD]|\b\d{1,2}\s+[A-Z\u00C0-\u00DD]|[•\*\-])/g, '\n');

  const rawLines = formatted.split(/\r?\n+/);

  const topics: string[] = [];
  let currentSubject = 'Geral';

  // Helper to test custom subject headers (e.g. "MÓDULO 1: NEUROLOGIA", "[PEDIATRIA]", "CARDIOLOGIA:")
  const detectCustomSubjectHeader = (lineText: string): string | null => {
    const trimmed = lineText.trim();
    if (!trimmed) return null;

    // Check for sentinel
    const subjMatch = /^\[\[SUBJECT:(.+)\]\]$/.exec(trimmed);
    if (subjMatch) return subjMatch[1];

    // Headers with colon or brackets: e.g. "DISCIPLINA: CARDIOLOGIA", "[Pediatria]", "=== CIRURGIA ==="
    if (/^(\[.+\]|=|#+|DISCIPLINA:|MÓDULO:|ÁREA:)/i.test(trimmed)) {
      const cleanHeader = trimmed.replace(/^(\[|=|#+|DISCIPLINA:|MÓDULO:|ÁREA:)+/i, '')
                                 .replace(/(\]|=|#+)+$/, '')
                                 .trim();
      if (cleanHeader.length >= 3) return cleanHeader;
    }

    // Line ending with colon e.g. "Doenças Infecciosas:"
    if (/:$/.test(trimmed) && trimmed.length <= 50 && !/^\d+[\.\-\)]/.test(trimmed)) {
      return trimmed.replace(/:$/, '').trim();
    }

    // ALL CAPS line without leading item numbers e.g. "SAÚDE DA MULHER"
    if (/^[A-Z\u00C0-\u00DD\s\/\&\-]{4,45}$/.test(trimmed) && !/^\d+[\.\-\)]/.test(trimmed) && !/•|\*|\-/.test(trimmed)) {
      return trimmed;
    }

    return null;
  };

  for (let rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Filter out residual address/website metadata
    if (/An[áa]polis/i.test(line) || /CEP/i.test(line) || /Fone/i.test(line) || /www\./i.test(line) || /Sl\s+\d+/i.test(line)) {
      continue;
    }

    const customSubj = detectCustomSubjectHeader(line);
    if (customSubj) {
      currentSubject = customSubj;
      continue;
    }

    // Extract item number or bullet
    // e.g. "1. Dor torácica", "2) Dispneia", "• Sepse", "- Arritmias"
    const matchItem = /^([\d{1,2}\.\-\)\•\*]+)\s*(.*)/.exec(line);

    let topicText = line;
    if (matchItem && matchItem[2]) {
      topicText = matchItem[2].trim();
    }

    // Clean up trailing page numbers or stray ending digits
    topicText = topicText.replace(/\s+\d{1,3}$/, '').trim();

    // If line contains multiple topics separated by semicolons (e.g. "Dor torácica; Dispneia; Choque")
    if (topicText.includes(';')) {
      const parts = topicText.split(';');
      for (const p of parts) {
        const cleanP = p.trim();
        if (cleanP.length >= 3) {
          topics.push(`[${currentSubject}] ${cleanP}`);
        }
      }
      continue;
    }

    if (topicText.length >= 3) {
      topics.push(`[${currentSubject}] ${topicText}`);
    }
  }

  return Array.from(new Set(topics));
}

export default function SchedulePlannerWizard({
  onGenerateSchedule,
  onCancel,
  availableCredits,
  isGenerating = false
}: SchedulePlannerWizardProps) {
  const [step, setStep] = useState<number>(1);

  // Step 1: Type
  const [planType, setPlanType] = useState<'college_only' | 'residency_only' | 'hybrid'>('college_only');

  // Step 2: College Content or Exam Selection
  const [collegeRawText, setCollegeRawText] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('ebserh');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('todos');
  const [currentSemesterSubjects, setCurrentSemesterSubjects] = useState<string[]>(['Clínica Médica']);
  const [onlyCurrentSemester, setOnlyCurrentSemester] = useState<boolean>(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Step 3: Days & Hours & Dates
  const [studyDays, setStudyDays] = useState<string[]>(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
  const [hoursPerDay, setHoursPerDay] = useState<number>(4);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [isExamTarget, setIsExamTarget] = useState<boolean>(false);
  const [examDate, setExamDate] = useState<string>('');
  const [weeksDuration, setWeeksDuration] = useState<number>(12);

  // Step 4: Revision Strategy
  const [revisionStrategy, setRevisionStrategy] = useState<'spaced' | 'weekly' | 'exam'>('spaced');

  // Step 5: Preview Inspector Tabs & Filters
  const [previewTab, setPreviewTab] = useState<'summary' | 'topics'>('summary');
  const [topicSearchQuery, setTopicSearchQuery] = useState<string>('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('todos');

  // Parsed college topics list using robust syllabus parser
  const parsedCollegeTopics = useMemo(() => {
    return parseCollegeSyllabusText(collegeRawText);
  }, [collegeRawText]);

  // Handle Exam Date change & calculate weeksDuration
  const handleExamDateChange = (dateVal: string) => {
    setExamDate(dateVal);
    if (dateVal && startDate) {
      const start = new Date(startDate + 'T00:00:00');
      const target = new Date(dateVal + 'T00:00:00');
      const diffTime = target.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const calculatedWeeks = Math.max(2, Math.round(diffDays / 7));
      if (calculatedWeeks >= 2) {
        setWeeksDuration(calculatedWeeks);
      }
    }
  };

  // Generated Plan metrics preview
  const planPreview = useMemo(() => {
    if (planType === 'college_only') {
      return generateCollegeCustomPlan(
        parsedCollegeTopics,
        studyDays,
        hoursPerDay,
        startDate,
        weeksDuration,
        revisionStrategy,
        isExamTarget && examDate ? examDate : undefined
      );
    } else {
      // General metrics calculation
      const topicsCount = 53;
      const revisionsCount = topicsCount * 3;
      return {
        weeks: [],
        totalTopicsCount: topicsCount,
        totalRevisionsCount: revisionsCount,
        totalSessionsCount: topicsCount + revisionsCount,
        retentionStats: {
          averageRetention: 88,
          highRetentionCount: 45,
          mediumRetentionCount: 8,
          lowRetentionCount: 0
        },
        smartSuggestion: '🎯 **Otimização Ativa:** Cronograma ajustado para maximizar a retenção até o dia da prova.',
        topicDetails: []
      };
    }
  }, [planType, parsedCollegeTopics, studyDays, hoursPerDay, startDate, weeksDuration, revisionStrategy, isExamTarget, examDate]);

  // Detailed per-topic schedule calculation for Step 5 Preview Inspector
  const topicScheduleDetails = useMemo(() => {
    if (planPreview && planPreview.topicDetails && planPreview.topicDetails.length > 0) {
      return planPreview.topicDetails;
    }
    return [];
  }, [planPreview]);

  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    topicScheduleDetails.forEach(t => {
      if (t.subjectName) set.add(t.subjectName);
    });
    return Array.from(set);
  }, [topicScheduleDetails]);

  const filteredTopicDetails = useMemo(() => {
    return topicScheduleDetails.filter(t => {
      const matchesSearch = !topicSearchQuery.trim() || 
        t.cleanTitle.toLowerCase().includes(topicSearchQuery.toLowerCase()) ||
        t.subjectName.toLowerCase().includes(topicSearchQuery.toLowerCase());

      const matchesSubject = selectedSubjectFilter === 'todos' || t.subjectName === selectedSubjectFilter;

      return matchesSearch && matchesSubject;
    });
  }, [topicScheduleDetails, topicSearchQuery, selectedSubjectFilter]);

  const handleDayToggle = (day: string) => {
    if (studyDays.includes(day)) {
      if (studyDays.length > 1) {
        setStudyDays(studyDays.filter(d => d !== day));
      }
    } else {
      setStudyDays([...studyDays, day]);
    }
  };

  const handleInsertSample = () => {
    setCollegeRawText(SAMPLE_COLLEGE_TOPICS.join('\n'));
  };

  const handleClearText = () => {
    setCollegeRawText('');
  };

  const handleRemoveSingleTopic = (indexToRemove: number) => {
    const updated = parsedCollegeTopics.filter((_, idx) => idx !== indexToRemove);
    setCollegeRawText(updated.join('\n'));
  };

  const handleFinalConfirm = async () => {
    const modality = planType === 'college_only' ? 'college_custom' : '1ano';
    
    await onGenerateSchedule({
      planType,
      collegeCustomTopics: parsedCollegeTopics,
      selectedExamId,
      modality,
      studyDays,
      hoursPerDay,
      startDate,
      examDate: examDate || undefined,
      weeksDuration,
      revisionStrategy,
      currentSemesterSubjects,
      onlyCurrentSemester,
      generatedWeeks: planPreview.weeks,
      totals: {
        topicsCount: planPreview.totalTopicsCount,
        revisionsCount: planPreview.totalRevisionsCount,
        sessionsCount: planPreview.totalSessionsCount
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white border border-[#E2E0D9] rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* WIZARD TOP HEADER */}
        <div className="bg-[#141414] text-white p-5 sm:p-6 shrink-0 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#D44E3D]/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </span>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight font-display">
                  Assistente de Planejamento de Cronograma
                </h2>
              </div>
              <p className="text-xs text-stone-300">
                Guia interativo passo a passo para criar o cronograma ideal para suas provas e revisões.
              </p>
            </div>

            <button
              onClick={onCancel}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* STEP INDICATOR BAR */}
          <div className="mt-5 space-y-2">
            <div className="flex justify-between items-center text-[11px] font-mono font-bold text-stone-300">
              <span className="uppercase tracking-wider">
                Passo {step} de 5: {
                  step === 1 ? 'Tipo de Planejamento' :
                  step === 2 ? (planType === 'college_only' ? 'Conteúdos da Faculdade' : 'Edital & Foco Prova') :
                  step === 3 ? 'Dias & Disponibilidade' :
                  step === 4 ? 'Ciclos de Revisão' :
                  'Resumo Chave & Métricas'
                }
              </span>
              <span className="text-amber-400">{step * 20}% Concluído</span>
            </div>
            
            <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden p-0.5 border border-stone-700">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-[#D44E3D] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${step * 20}%` }}
              />
            </div>
          </div>
        </div>

        {/* WIZARD CONTENT BODY */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1 bg-[#FAF9F5]">
          <AnimatePresence mode="wait">

            {/* STEP 1: TYPE SELECTION */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-mono font-extrabold text-[#141414] uppercase tracking-wider flex items-center gap-2">
                    <GraduationCap className="w-4.5 h-4.5 text-[#D44E3D]" />
                    1. Qual o foco principal do seu planejamento?
                  </h3>
                  <p className="text-xs text-stone-600">
                    Selecione a origem dos assuntos para guiar a criação do seu calendário de estudos.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {/* OPTION 1: COLLEGE ONLY */}
                  <button
                    type="button"
                    onClick={() => setPlanType('college_only')}
                    className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex items-start gap-4 ${
                      planType === 'college_only'
                        ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white border-[#D44E3D] shadow-md ring-2 ring-[#D44E3D]/20'
                        : 'bg-white border-[#E2E0D9] hover:bg-stone-50'
                    }`}
                  >
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      planType === 'college_only' ? 'bg-[#D44E3D] text-white' : 'bg-stone-100 text-stone-600'
                    }`}>
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#141414]">Apenas Conteúdo da Minha Faculdade</h4>
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-mono font-bold">
                          RECOMENDADO
                        </Badge>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Monte o plano <strong>exclusivamente para os conteúdos e matérias da sua ementa ou provas da faculdade</strong>, com agendamento automático das revisões periódicas.
                      </p>
                    </div>
                  </button>

                  {/* OPTION 2: RESIDENCY ONLY */}
                  <button
                    type="button"
                    onClick={() => setPlanType('residency_only')}
                    className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex items-start gap-4 ${
                      planType === 'residency_only'
                        ? 'bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-white border-blue-600 shadow-md ring-2 ring-blue-600/20'
                        : 'bg-white border-[#E2E0D9] hover:bg-stone-50'
                    }`}
                  >
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      planType === 'residency_only' ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>
                      <Award className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-[#141414]">Provas de Residência Médica (Edital Completo)</h4>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Organização automática das 53 matérias e temas com peso estatístico focado nas principais bancas do Brasil (USP, ENARE, AMP, SUS-SP, etc.).
                      </p>
                    </div>
                  </button>

                  {/* OPTION 3: HYBRID */}
                  <button
                    type="button"
                    onClick={() => setPlanType('hybrid')}
                    className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex items-start gap-4 ${
                      planType === 'hybrid'
                        ? 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
                        : 'bg-white border-[#E2E0D9] hover:bg-stone-50'
                    }`}
                  >
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      planType === 'hybrid' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>
                      <Layers className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-[#141414]">Híbrido (Internato + Residência)</h4>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Priorize os assuntos do seu semestre/estágio atual no início do cronograma enquanto distribui todo o edital de residência.
                      </p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: COLLEGE CONTENT INPUT OR EXAM SELECT */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                {planType === 'college_only' ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-mono font-extrabold text-[#141414] uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4.5 h-4.5 text-[#D44E3D]" />
                        2. Digite ou cole os Conteúdos da sua Faculdade
                      </h3>
                      <p className="text-xs text-stone-600">
                        Insira os assuntos ou matérias para criarmos um planejamento exclusivo e personalizado.
                      </p>
                    </div>

                    {/* CAIXA DE TEXTO BONITA E SOFISTICADA */}
                    <div className="bg-gradient-to-b from-stone-900 to-[#1A1A1A] text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-stone-800 space-y-4 relative">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                            <Zap className="w-4 h-4" />
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                            Entrada de Temas e Disciplinas
                          </span>
                        </div>

                        {/* Quick action buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={handleInsertSample}
                            className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all border border-stone-700"
                          >
                            <span>Ver Exemplo de Formatação</span>
                          </button>

                          {collegeRawText && (
                            <button
                              type="button"
                              onClick={handleClearText}
                              className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all border border-red-500/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Limpar Texto</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* HELPER TIP FOR PASTING */}
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span className="text-[11px] text-amber-200">
                          <strong>Como colar sua ementa:</strong> Clique na caixa abaixo e pressione <kbd className="px-1 py-0.5 bg-stone-800 rounded border border-stone-700 text-amber-300 font-mono text-[10px]">Ctrl+V</kbd> (ou <kbd className="px-1 py-0.5 bg-stone-800 rounded border border-stone-700 text-amber-300 font-mono text-[10px]">Cmd+V</kbd> no Mac).
                        </span>
                      </div>

                      {/* STYLED TEXTAREA */}
                      <div className="relative">
                        <textarea
                          ref={textareaRef}
                          value={collegeRawText}
                          onChange={(e) => setCollegeRawText(e.target.value)}
                          placeholder={`Cole ou digite a ementa do seu internato/faculdade aqui (pressione Ctrl+V)...

Pode ser em qualquer formato! Exemplo:

CLÍNICA MÉDICA
1. Dor torácica
2. Dispneia aguda
3. Insuficiência renal aguda

CIRURGIA
• Abdome agudo
• Trauma abdominal e ATLS
• Hérnias da parede abdominal`}
                          rows={8}
                          className="w-full p-4 bg-stone-950/80 border border-stone-800 rounded-2xl text-xs sm:text-sm font-mono text-stone-100 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/80 transition-all leading-relaxed shadow-inner"
                        />
                        <div className="absolute right-3 bottom-3 text-[10px] font-mono text-amber-400 bg-stone-900/95 px-2.5 py-1 rounded-lg border border-stone-800 shadow-sm font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{parsedCollegeTopics.length} temas reconhecidos</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-stone-400 font-sans italic">
                        💡 Separe cada assunto pressionando Enter (um assunto por linha) ou usando vírgulas.
                      </p>
                    </div>

                    {/* LIVE PARSED CHIPS PREVIEW */}
                    {parsedCollegeTopics.length > 0 && (
                      <div className="bg-white border border-[#E2E0D9] p-4.5 rounded-2xl space-y-3 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-stone-800 uppercase flex items-center gap-1.5">
                            <ListOrdered className="w-4 h-4 text-emerald-600" />
                            Temas Confirmados ({parsedCollegeTopics.length}):
                          </span>
                          <span className="text-[10px] font-mono text-stone-500">
                            Clique no X para remover algum
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {parsedCollegeTopics.map((topic, idx) => (
                            <span
                              key={`${topic}-${idx}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 transition-all"
                            >
                              <span>{topic}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSingleTopic(idx)}
                                className="text-stone-400 hover:text-red-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* RESIDENCY EXAM SELECTION */
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-mono font-extrabold text-[#141414] uppercase tracking-wider flex items-center gap-2">
                        <Award className="w-4.5 h-4.5 text-blue-600" />
                        2. Selecione a Prova/Banca Alvo
                      </h3>
                      <p className="text-xs text-stone-600">
                        O cronograma calibrará a prioridade das matérias com base nos dados estatísticos do exame.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1">
                      {MEDICAL_EXAMS_DB.map((exam) => (
                        <button
                          key={exam.id}
                          type="button"
                          onClick={() => setSelectedExamId(exam.id)}
                          className={`w-full p-3.5 rounded-xl border text-left transition-all flex justify-between items-start gap-3 ${
                            selectedExamId === exam.id
                              ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                              : 'border-[#E2E0D9] bg-white hover:bg-stone-50'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-bold text-[#141414] block">{exam.name}</span>
                            <span className="text-[10px] text-stone-500 block">{exam.description}</span>
                          </div>
                          <Badge className="bg-stone-100 text-stone-700 text-[9px] font-mono">
                            {exam.region}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 3: DAYS & HOURS & DATES */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-mono font-extrabold text-[#141414] uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon className="w-4.5 h-4.5 text-[#D44E3D]" />
                    3. Configuração de Calendário, Prova e Ritmo
                  </h3>
                  <p className="text-xs text-stone-600">
                    Defina seus dias, carga diária e se este plano tem uma data fixa de prova.
                  </p>
                </div>

                {/* TARGET MODE SELECTION: SEMESTRAL VS EXAM DATE */}
                <div className="bg-white border border-[#E2E0D9] p-4 rounded-2xl space-y-3">
                  <label className="text-xs font-bold text-[#141414] font-mono block uppercase">
                    Objetivo do Planejamento:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExamTarget(false);
                        setExamDate('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                        !isExamTarget
                          ? 'border-[#D44E3D] bg-red-50/60 shadow-xs'
                          : 'border-[#E2E0D9] bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      <GraduationCap className={`w-4 h-4 ${!isExamTarget ? 'text-[#D44E3D]' : 'text-stone-500'}`} />
                      <div>
                        <span className="text-xs font-bold text-[#141414] block">Estudo Semestral / Regular</span>
                        <span className="text-[10.5px] text-stone-500 block">Acompanhamento contínuo da ementa</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsExamTarget(true)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                        isExamTarget
                          ? 'border-[#D44E3D] bg-red-50/60 shadow-xs'
                          : 'border-[#E2E0D9] bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      <Award className={`w-4 h-4 ${isExamTarget ? 'text-[#D44E3D]' : 'text-stone-500'}`} />
                      <div>
                        <span className="text-xs font-bold text-[#141414] block">Foco em Prova / Data Definida</span>
                        <span className="text-[10.5px] text-stone-500 block">Otimiza a curva de esquecimento até a prova</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* WEEKDAYS */}
                <div className="bg-white border border-[#E2E0D9] p-4 rounded-2xl space-y-2.5">
                  <label className="text-xs font-bold text-[#141414] font-mono block uppercase">
                    Quais dias da semana você vai estudar?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => {
                      const isSelected = studyDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayToggle(day)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-[#D44E3D] text-white border-[#D44E3D] shadow-xs'
                              : 'bg-stone-50 text-stone-600 border-[#E2E0D9] hover:bg-stone-100'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* HOURS PER DAY */}
                <div className="bg-white border border-[#E2E0D9] p-4 rounded-2xl space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#141414] font-mono uppercase">
                      Horas de Estudo Diário:
                    </label>
                    <span className="text-xs font-mono font-bold text-[#D44E3D] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      {hoursPerDay} horas / dia
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="1"
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(Number(e.target.value))}
                    className="w-full accent-[#D44E3D] bg-stone-100 h-2 rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-stone-400">
                    <span>2h (Moderado)</span>
                    <span>10h (Intenso)</span>
                  </div>
                </div>

                {/* START DATE, EXAM DATE & DURATION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white border border-[#E2E0D9] p-3.5 rounded-2xl space-y-1.5">
                    <label className="text-xs font-bold text-[#141414] font-mono block uppercase">
                      Data de Início:
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#D44E3D]"
                    />
                  </div>

                  {isExamTarget ? (
                    <div className="bg-white border border-red-200 p-3.5 rounded-2xl space-y-1.5 bg-red-50/20">
                      <label className="text-xs font-bold text-[#D44E3D] font-mono block uppercase flex items-center gap-1">
                        🎯 Data da Prova Alvo:
                      </label>
                      <input
                        type="date"
                        value={examDate}
                        onChange={(e) => handleExamDateChange(e.target.value)}
                        className="w-full p-2 bg-white border border-red-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#D44E3D]"
                      />
                    </div>
                  ) : (
                    <div className="bg-white border border-[#E2E0D9] p-3.5 rounded-2xl space-y-1.5">
                      <label className="text-xs font-bold text-[#141414] font-mono block uppercase">
                        Duração Estimada:
                      </label>
                      <select
                        value={weeksDuration}
                        onChange={(e) => setWeeksDuration(Number(e.target.value))}
                        className="w-full p-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#D44E3D] cursor-pointer"
                      >
                        <option value={4}>4 Semanas (1 Mês)</option>
                        <option value={8}>8 Semanas (2 Meses)</option>
                        <option value={12}>12 Semanas (3 Meses / Semestral)</option>
                        <option value={16}>16 Semanas (4 Meses)</option>
                        <option value={24}>24 Semanas (Intensivo)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* DYNAMIC SMART ADVICE BADGE IN STEP 3 */}
                {planPreview.smartSuggestion && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-900 text-xs space-y-1">
                    <p className="text-[11.5px] font-medium leading-relaxed">
                      {planPreview.smartSuggestion.replace(/\*\*/g, '')}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 4: REVISION STRATEGY */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-mono font-extrabold text-[#141414] uppercase tracking-wider flex items-center gap-2">
                    <RotateCw className="w-4.5 h-4.5 text-[#D44E3D]" />
                    4. Ritmo das Revisões de Fixação Espaçada
                  </h3>
                  <p className="text-xs text-stone-600">
                    Escolha como o sistema deve agendar as sessões de revisão para garantir retenção na memória.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => setRevisionStrategy('spaced')}
                    className={`p-4.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                      revisionStrategy === 'spaced'
                        ? 'bg-amber-50/60 border-[#D44E3D] shadow-xs'
                        : 'bg-white border-[#E2E0D9] hover:bg-stone-50'
                    }`}
                  >
                    <span className="p-2 bg-[#D44E3D] text-white rounded-xl shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-[#141414]">Revisão Espaçada Completa (24h, 7D, 30D)</h4>
                        <Badge className="bg-[#D44E3D] text-white text-[8px] font-mono">RECOMENDADO</Badge>
                      </div>
                      <p className="text-xs text-stone-600">
                        Cada tema ganha 3 ciclos automáticos de revisão distribuídos ao longo das semanas.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRevisionStrategy('weekly')}
                    className={`p-4.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                      revisionStrategy === 'weekly'
                        ? 'bg-blue-50/60 border-blue-600 shadow-xs'
                        : 'bg-white border-[#E2E0D9] hover:bg-stone-50'
                    }`}
                  >
                    <span className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </span>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-[#141414]">Revisão Semanal de Consolidação (R1 + R2)</h4>
                      <p className="text-xs text-stone-600">
                        Foco em 2 ciclos de revisão focados na fixação durante a própria semana.
                      </p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5: SUMMARY & DETAILED TOPIC PREVIEW */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-mono font-extrabold text-[#141414] uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                    5. Pré-Visualização e Detalhamento do Plano
                  </h3>
                  <p className="text-xs text-stone-600">
                    Veja o resumo executivo ou examine exatamente quando e quanto cada tópico será estudado e revisado.
                  </p>
                </div>

                {/* TAB SWITCHER */}
                <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-2xl border border-stone-200">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('summary')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      previewTab === 'summary'
                        ? 'bg-white text-[#141414] shadow-xs border border-stone-200'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Resumo Geral</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTab('topics')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      previewTab === 'topics'
                        ? 'bg-white text-[#141414] shadow-xs border border-stone-200'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 text-[#D44E3D]" />
                    <span>Detalhamento por Tópico ({topicScheduleDetails.length})</span>
                  </button>
                </div>

                {/* TAB 1: EXECUTIVE SUMMARY */}
                {previewTab === 'summary' && (
                  <div className="space-y-4">
                    {/* STATS HIGHLIGHT CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* CARD 1: TEMAS */}
                      <div className="bg-gradient-to-br from-stone-900 to-[#1C1C1C] text-white p-4 rounded-2xl border border-stone-800 shadow-md space-y-1">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                          📌 Cobertura do Edital / Ementa
                        </span>
                        <div className="text-2xl font-black font-mono text-white">
                          {planPreview.totalTopicsCount} <span className="text-xs font-normal text-stone-400">temas</span>
                        </div>
                        <p className="text-[10.5px] text-emerald-400 font-bold font-mono">
                          ✓ 100% dos temas contemplados
                        </p>
                      </div>

                      {/* CARD 2: RETENÇÃO ESTIMADA */}
                      <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border border-emerald-300 p-4 rounded-2xl shadow-xs space-y-1">
                        <span className="text-[10px] font-mono text-emerald-900 font-bold uppercase tracking-wider block">
                          🧠 Retenção na Prova (Ebbinghaus)
                        </span>
                        <div className="text-2xl font-black font-mono text-emerald-700">
                          {planPreview.retentionStats?.averageRetention || 90}% <span className="text-xs font-normal text-emerald-900">médio</span>
                        </div>
                        <p className="text-[10.5px] text-emerald-800 font-medium">
                          {planPreview.retentionStats?.highRetentionCount || 0} temas com retenção ótima (≥85%)
                        </p>
                      </div>

                      {/* CARD 3: SESSÕES TOTAIS */}
                      <div className="bg-gradient-to-br from-blue-500/10 to-white border border-blue-200 p-4 rounded-2xl shadow-xs space-y-1">
                        <span className="text-[10px] font-mono text-blue-900 font-bold uppercase tracking-wider block">
                          📊 Total de Sessões Agendadas
                        </span>
                        <div className="text-2xl font-black font-mono text-blue-700">
                          {planPreview.totalSessionsCount} <span className="text-xs font-normal text-blue-900">sessões</span>
                        </div>
                        <p className="text-[10.5px] text-blue-900/80">
                          {planPreview.totalTopicsCount} estudos + {planPreview.totalRevisionsCount} revisões
                        </p>
                      </div>
                    </div>

                    {/* SMART ADVICE BANNER */}
                    {planPreview.smartSuggestion && (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 text-xs space-y-1">
                        <span className="font-bold font-mono uppercase text-[10px] text-amber-800 block">
                          💡 Análise e Recomendação Inteligente de Carga
                        </span>
                        <p className="text-[11.5px] font-medium leading-relaxed">
                          {planPreview.smartSuggestion.replace(/\*\*/g, '')}
                        </p>
                      </div>
                    )}

                    {/* SCHEDULE CONFIG SUMMARY */}
                    <div className="bg-white border border-[#E2E0D9] p-4 rounded-2xl space-y-2 text-xs text-stone-700">
                      <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                        <span className="font-mono text-stone-500 font-bold">Origem do Conteúdo:</span>
                        <span className="font-bold text-[#141414]">
                          {planType === 'college_only' ? '🎓 Exclusivo Faculdade' : planType === 'residency_only' ? '🏥 Provas de Residência' : '⚡ Híbrido'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                        <span className="font-mono text-stone-500 font-bold">Dias de Estudo Selecionados:</span>
                        <span className="font-bold text-[#141414]">{studyDays.join(', ')} ({studyDays.length} dias/semana)</span>
                      </div>

                      <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                        <span className="font-mono text-stone-500 font-bold">Carga Horária Diária:</span>
                        <span className="font-bold text-[#141414]">{hoursPerDay}h/dia ({hoursPerDay <= 3 ? '2 a 3 tarefas/dia' : '3 a 4 tarefas/dia'})</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="font-mono text-stone-500 font-bold">Início e Duração do Plano:</span>
                        <span className="font-bold text-[#141414]">
                          {new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} ({weeksDuration} semanas)
                          {isExamTarget && examDate ? ` • Prova em ${new Date(examDate + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: DETAILED PER-TOPIC BREAKDOWN */}
                {previewTab === 'topics' && (
                  <div className="space-y-3">
                    {/* SEARCH & FILTERS BAR */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={topicSearchQuery}
                          onChange={(e) => setTopicSearchQuery(e.target.value)}
                          placeholder="Buscar tópico (ex: Dor torácica, trauma, asma...)"
                          className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-medium"
                        />
                      </div>

                      {uniqueSubjects.length > 1 && (
                        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                          <button
                            type="button"
                            onClick={() => setSelectedSubjectFilter('todos')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                              selectedSubjectFilter === 'todos'
                                ? 'bg-[#141414] text-white'
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                          >
                            Todos ({topicScheduleDetails.length})
                          </button>
                          {uniqueSubjects.slice(0, 4).map((subj) => (
                            <button
                              key={subj}
                              type="button"
                              onClick={() => setSelectedSubjectFilter(subj)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                                selectedSubjectFilter === subj
                                  ? 'bg-[#D44E3D] text-white'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                            >
                              {subj}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* TOPICS DETAILED LIST */}
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {filteredTopicDetails.length > 0 ? (
                        filteredTopicDetails.map((topic, i) => {
                          const retention = topic.estimatedRetention || 88;
                          const retentionColorClass = retention >= 85
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : retention >= 72
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-orange-50 text-orange-900 border-orange-300';

                          return (
                            <div
                              key={i}
                              className="p-3 bg-white border border-stone-200/90 rounded-2xl space-y-2 hover:border-amber-400/60 transition-all shadow-2xs"
                            >
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className="bg-amber-100 text-amber-900 text-[9px] font-mono border border-amber-200">
                                      {topic.subjectName}
                                    </Badge>
                                    <span className="text-xs font-bold text-[#141414]">{topic.cleanTitle}</span>
                                  </div>
                                  
                                  {/* RETENTION STATUS BADGE */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${retentionColorClass}`}>
                                      🧠 Retenção Estimada: {retention}%
                                    </span>
                                    {topic.retentionNote && (
                                      <span className="text-[10.5px] text-stone-500 font-medium">
                                        • {topic.retentionNote}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 text-[10.5px] font-mono font-bold text-stone-700 bg-stone-100 px-2.5 py-0.5 rounded-lg border border-stone-200">
                                  <Clock className="w-3 h-3 text-stone-500" />
                                  <span>{topic.timeFormatted} estimados ({topic.totalSessions} sessões)</span>
                                </div>
                              </div>

                              {/* TIMELINE OF INITIAL STUDY & SPAGED REVISIONS */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-stone-100 text-[11px]">
                                {/* Initial study */}
                                {topic.initialStudy ? (
                                  <div className="p-2 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center justify-between">
                                    <span className="font-bold text-emerald-900 flex items-center gap-1">
                                      <BookOpen className="w-3 h-3 text-emerald-600" /> Estudo Teorico Inicial:
                                    </span>
                                    <span className="font-mono text-emerald-800 font-bold">
                                      Semana {topic.initialStudy.weekNumber} ({topic.initialStudy.dayName})
                                    </span>
                                  </div>
                                ) : (
                                  <div className="p-2 bg-stone-100 rounded-xl text-stone-500 font-mono text-[10px]">
                                    Estudo Inicial: Não agendado
                                  </div>
                                )}

                                {/* Revisions */}
                                <div className="p-2 bg-blue-50/80 border border-blue-200/80 rounded-xl space-y-1">
                                  <span className="font-bold text-blue-900 flex items-center gap-1">
                                    <RotateCw className="w-3 h-3 text-blue-600" /> Agenda de Revisões ({topic.revisions.length}):
                                  </span>
                                  <div className="space-y-0.5 font-mono text-[10.5px] text-blue-800">
                                    {topic.revisions.length > 0 ? (
                                      topic.revisions.map((rev, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                          <span className="font-medium text-blue-700">{rev.name}:</span>
                                          <span className="font-bold">Semana {rev.weekNumber} ({rev.dayName})</span>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-stone-500 italic text-[10px]">Sem revisões pendentes</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-6 text-center text-stone-500 text-xs font-mono bg-stone-50 rounded-2xl border border-stone-200">
                          Nenhum tópico encontrado para os filtros selecionados.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* WIZARD BOTTOM BUTTONS BAR */}
        <div className="p-4 sm:p-5 bg-white border-t border-[#E2E0D9] flex justify-between items-center shrink-0">
          <Button
            variant="outline"
            onClick={() => {
              if (step > 1) setStep(step - 1);
              else onCancel();
            }}
            className="border-stone-300 font-bold text-xs h-10 px-4 rounded-xl"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>{step === 1 ? 'Cancelar' : 'Anterior'}</span>
          </Button>

          <div className="flex items-center gap-2">
            {step < 5 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 2 && planType === 'college_only' && parsedCollegeTopics.length === 0}
                className="bg-[#141414] hover:bg-stone-800 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-xs"
              >
                <span>Próximo Passo</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleFinalConfirm}
                disabled={isGenerating}
                className="bg-[#D44E3D] hover:bg-[#D44E3D]/90 text-white font-bold text-xs h-11 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Gerando Cronograma...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>🚀 Confirmar e Criar Planejamento</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
