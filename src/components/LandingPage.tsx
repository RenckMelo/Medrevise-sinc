import React, { useState } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  Calendar, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  HelpCircle, 
  Brain, 
  TrendingUp, 
  Award, 
  Clock, 
  Check,
  FileText,
  Layers,
  ListChecks,
  XCircle,
  AlertTriangle,
  X,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LegalTerms from './LegalTerms';

interface LandingPageProps {
  onLogin: () => void;
  onGuestLogin?: () => void;
  loginError?: string | null;
  onClearError?: () => void;
}

export default function LandingPage({ onLogin, onGuestLogin, loginError, onClearError }: LandingPageProps) {
  // Slider state for Ebbinghaus Forgetting Curve Simulator
  const [elapsedDays, setElapsedDays] = useState<number>(3);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showLegal, setShowLegal] = useState<'terms' | 'privacy' | null>(null);

  // New States for highly interactive Step-by-Step Tour & Real Area Previews
  const [activeStep, setActiveStep] = useState<number>(1);
  const [activeAreaTab, setActiveAreaTab] = useState<'cronograma' | 'resumos' | 'questoes' | 'diferenciais'>('cronograma');
  const [resumoDepth, setResumoDepth] = useState<'minimo' | 'moderado' | 'maximo'>('minimo');
  const [realQuestionOption, setRealQuestionOption] = useState<string | null>(null);
  const [isRealMentorLoading, setIsRealMentorLoading] = useState<boolean>(false);
  const [realMentorQuestion, setRealMentorQuestion] = useState<string | null>(null);
  const [realMentorResponse, setRealMentorResponse] = useState<string | null>(null);

  // States for interactive MedInternato Demo
  const [activeDemoTab, setActiveDemoTab] = useState<'summary' | 'questions' | 'flashcards'>('summary');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [flashcardStep, setFlashcardStep] = useState<number>(0);
  const [mentorQuestion, setMentorQuestion] = useState<string | null>(null);
  const [mentorResponse, setMentorResponse] = useState<string | null>(null);
  const [isMentorLoading, setIsMentorLoading] = useState<boolean>(false);

  // Ebbinghaus formula: Retenção R = e^(-t/S) where t is time, S is relative strength of memory
  // Without review (S = 1.5) vs with 1 review (S = 6) vs with 3 reviews (S = 24)
  const calculateRetention = (t: number, strength: number) => {
    return Math.round(100 * Math.exp(-t / strength));
  };

  const retentionNoReview = calculateRetention(elapsedDays, 1.5);
  const retentionOneReview = calculateRetention(elapsedDays, 6);
  const retentionThreeReviews = calculateRetention(elapsedDays, 24);

  const handleSimulatedMentorPrompt = (questionType: string) => {
    setIsMentorLoading(true);
    setMentorQuestion(questionType === 'tc' 
      ? "Por que a Tomografia não é recomendada de rotina se o escore for ≥ 7?" 
      : "Qual o esquema de antibiótico profilático padrão-ouro?");
    setMentorResponse(null);
    
    setTimeout(() => {
      setIsMentorLoading(false);
      if (questionType === 'tc') {
        setMentorResponse("Excelente pergunta! Em homens jovens com Alvarado ≥ 7 (alta probabilidade), o diagnóstico clínico é suficiente para a indicação cirúrgica imediata. Pedir TC de rotina nestes casos atrasa o tratamento definitivo (apendicectomia), expõe o paciente a radiação desnecessária e aumenta custos. Já em mulheres em idade fértil, o exame de imagem (geralmente USG ou TC) é sempre indicado para afastar diagnósticos ginecológicos diferenciais importantes.");
      } else {
        setMentorResponse("O padrão-ouro para profilaxia cirúrgica em apendicite aguda não-complicada é a Cefoxitina venosa (2g) administrada na indução anestésica (até 60 minutos antes da incisão). Como alternativa viável, utiliza-se a associação de Cefazolina (2g) e Metronidazol (500mg). Se for apendicite complicada (com perfuração ou peritonite), o esquema passa a ser terapêutico.");
      }
    }, 800);
  };

  const handleSimulatedRealMentorPrompt = (questionType: string) => {
    setIsRealMentorLoading(true);
    setRealMentorQuestion(questionType === 'insulina'
      ? "Qual a taxa padrão de infusão de insulina regular e quando evitar?"
      : "Quais os critérios exatos para transição de insulina venosa para subcutânea?");
    setRealMentorResponse(null);

    setTimeout(() => {
      setIsRealMentorLoading(false);
      if (questionType === 'insulina') {
        setRealMentorResponse("Na Cetoacidose Diabética, a infusão contínua de insulina regular é iniciada em bomba na dose de 0,1 UI/kg/h após expansão volêmica adequada. O objetivo é reduzir a glicemia de 50 a 75 mg/dL por hora e cessar a cetogênese. Nunca inicie insulina se o potássio plasmático estiver < 3,3 mEq/L! Reponha o potássio primeiro para evitar arritmias letais por hipocalemia aguda induzida pela entrada celular de potássio facilitada pela insulina.");
      } else {
        setRealMentorResponse("A transição de insulina venosa para subcutânea (esquema basal-bolus) deve ocorrer quando a CAD estiver resolvida. Os critérios de resolução são: glicemia < 200 mg/dL somada a pelo menos dois dos seguintes: pH venoso > 7,3, bicarbonato sérico ≥ 15 mEq/L, ou anion gap calculado ≤ 12. Além disso, o paciente deve estar consciente e tolerando dieta oral. Mantenha a infusão venosa por mais 1 a 2 horas após a primeira dose de insulina SC rápida para evitar rebote glicêmico.");
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] antialiased text-[#141414] font-sans">
      
      {/* Top Banner with micro-branding */}
      <div className="bg-[#141414] text-[#E4E3E0] py-2 px-4 text-center text-[10px] font-mono uppercase tracking-widest flex items-center justify-center gap-2">
        <Sparkles size={12} className="text-yellow-400 animate-pulse" />
        <span>CONQUISTE A FIXAÇÃO DEFINITIVA COM O MÉTODO CIENTÍFICO DE EBBINGHAUS por apenas R$ 19,90/mês</span>
      </div>

      {/* Main Header / Navigation */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b-2 border-[#141414] z-50 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center font-serif text-lg italic font-extrabold shadow-[2px_2px_0px_0px_rgba(20,20,20,0.3)]">
              M
            </div>
            <div>
              <h1 className="font-serif italic text-2xl font-black tracking-tight leading-none">MedRevise</h1>
              <span className="font-mono text-[8px] uppercase tracking-wider text-neutral-400">Algoritmo Spaced Repetition</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onLogin}
              className="bg-[#141414] hover:bg-neutral-800 text-white px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider border border-transparent shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer"
            >
              Acessar Sistema
            </button>
          </div>
        </div>
      </header>

      {/* Gentle feedback banner if login is cancelled or fails */}
      <AnimatePresence>
        {loginError && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-rose-50 border-b-2 border-[#141414] text-[#141414] px-4 py-3 text-xs font-mono font-bold flex items-center justify-between overflow-hidden"
          >
            <div className="flex items-center gap-2.5 mx-auto">
              <span className="bg-rose-500 text-white px-1 py-0.5 rounded-none font-black text-[9px]">status: login cancelado</span>
              <span>{loginError}</span>
            </div>
            {onClearError && (
              <button 
                onClick={onClearError}
                className="text-neutral-500 hover:text-black font-extrabold ml-2 border border-[#141414] bg-white px-2 py-1 shadow-[1px_1px_0px_0px_rgba(20,20,20,1)] active:translate-y-0.5 active:shadow-none text-[9.5px] cursor-pointer"
              >
                [FECHAR]
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Block - Neobrutalism layout */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-105 border border-[#141414] text-[10px] font-mono uppercase font-bold tracking-wider shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]">
            <Brain size={12} className="text-indigo-600 animate-bounce" />
            Vença a curva do esquecimento de uma vez por todas
          </div>

          <h2 className="font-serif italic text-4xl sm:text-6xl font-extrabold text-neutral-950 leading-[1.05] tracking-tight">
            Estude menos, retenha muito mais.<br />Consolide o aprendizado no momento <span>científico exato</span>.
          </h2>

          <p className="text-neutral-600 text-sm sm:text-base max-w-xl leading-relaxed">
            MedRevise é um gerenciador inteligente de estudos estruturado estritamente sobre a 
            <strong> curva de repetição espaçada de Hermann Ebbinghaus</strong>. Nosso grande diferencial é que 
            <strong> usamos sua porcentagem de acertos em cada sessão de questões</strong> para calibrar e personalizar o intervalo 
            científico das suas revisões de forma cirúrgica, otimizando o tempo de estudo em busca da sua aprovação.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button 
              onClick={onLogin}
              className="px-8 py-5 bg-[#141414] hover:bg-neutral-800 text-[#E4E3E0] font-mono text-xs font-bold uppercase tracking-widest shadow-[5px_5px_0px_0px_rgba(30,30,30,0.2)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer flex items-center justify-center gap-2.5"
            >
              Começar a Estudar Grátis
              <ArrowRight size={14} />
            </button>
            <a 
              href="#ebbinghaus-curve"
              className="px-8 py-5 border border-[#141414] bg-[#E4E3E0]/50 hover:bg-neutral-100 text-neutral-800 font-mono text-xs font-bold uppercase tracking-widest shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] flex items-center justify-center"
            >
              Ver Prova Científica
            </a>
          </div>

          {/* Core Trust Indicators */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-dashed border-neutral-300">
            <div>
              <span className="font-serif italic text-2xl font-bold block text-neutral-900">30 dias</span>
              <span className="font-mono text-[9px] uppercase text-neutral-450 tracking-wider">De retenção ativa inicial</span>
            </div>
            <div>
              <span className="font-serif italic text-2xl font-bold block text-neutral-900">4x mais</span>
              <span className="font-mono text-[9px] uppercase text-neutral-450 tracking-wider">Velocidade de Recall</span>
            </div>
            <div>
              <span className="font-serif italic text-2xl font-bold block text-neutral-900">100%</span>
              <span className="font-mono text-[9px] uppercase text-neutral-450 tracking-wider">Adequação à LGPD</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive Element (Visual preview box) */}
        <div className="lg:col-span-5">
          <div className="bg-white border-2 border-[#141414] p-6 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-[#141414]/15">
              <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 font-bold">Ficha Dinâmica de Revisão</span>
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            
            <div className="space-y-3">
              <div className="bg-[#141414]/5 p-3.5 border border-dashed border-[#141414]/20 space-y-1">
                <span className="font-mono text-[8px] uppercase tracking-wider text-indigo-700 font-bold block">MATÉRIA: CARDIOLOGIA</span>
                <span className="font-serif italic text-md font-bold text-neutral-850 block">Arritmias e Bloqueios Atrioventriculares</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 text-center">
                  <span className="block font-mono text-[8px] text-neutral-450 uppercase">Último Estudo</span>
                  <span className="block font-mono text-[10px] font-bold text-emerald-800 mt-0.5">Há 24 horas</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-2.5 text-center animate-pulse">
                  <span className="block font-mono text-[8px] text-neutral-450 uppercase">Próxima Revisão</span>
                  <span className="block font-mono text-[10px] font-bold text-amber-800 mt-0.5">AGORA (Intervalo SRS)</span>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                  <span>Chance de Acerto (Retenção)</span>
                  <span className="text-rose-600 font-bold">Caindo para 33%</span>
                </div>
                {/* Horizontal Progress Bar representing decay */}
                <div className="w-full h-2 bg-neutral-200 rounded-none overflow-hidden border border-[#141414]/10">
                  <div className="bg-gradient-to-r from-rose-500 to-amber-500 h-full w-[33%] transition-all duration-500"></div>
                </div>
              </div>

              <button 
                onClick={onLogin}
                className="w-full py-3 bg-[#141414] hover:bg-neutral-850 text-white font-mono text-[10px] uppercase font-bold tracking-widest text-center cursor-pointer transition-all"
              >
                Simular Sessão Prática
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Hermann Ebbinghaus Forgetfulness Curve & Method Explanation Section */}
      <section id="ebbinghaus-curve" className="py-16 sm:py-24 bg-white border-y-2 border-[#141414] px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* Header block */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-indigo-700 bg-indigo-50 border border-indigo-250 px-3 py-1 rounded-none inline-block">
              CIÊNCIA DE APRENDIZADO
            </span>
            <h3 className="font-serif italic text-3xl sm:text-4xl font-extrabold text-neutral-950">
              O simulador interativo de Hermann Ebbinghaus
            </h3>
            <p className="text-neutral-500 text-xs sm:text-sm font-sans">
              Utilize o controle abaixo para observar matematicamente como a retenção da informação no cérebro se degrada com o passar dos dias sem revisões inteligentes.
            </p>
          </div>

          {/* Interactive Graph Box */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Slider / Explanation block (left) */}
            <div className="lg:col-span-5 bg-[#E4E3E0]/35 border border-[#141414] p-6 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <div className="space-y-4">
                <span className="font-mono text-[8.5px] uppercase tracking-wider text-neutral-400 block font-bold">CONTROLE DIÁRIO</span>
                
                <div className="space-y-2">
                  <div className="flex justify-between font-mono text-xs">
                    <span>Tempo decorrido:</span>
                    <span className="font-bold text-neutral-900 bg-white border border-[#141414] px-2 py-0.5 shadow-[1.5px_1.5px_0px_0px_rgba(20,20,20,1)]">
                      {elapsedDays} {elapsedDays === 1 ? 'dia' : 'dias'}
                    </span>
                  </div>
                  
                  <input 
                    type="range" 
                    min="1" 
                    max="15" 
                    step="1"
                    value={elapsedDays}
                    onChange={(e) => setElapsedDays(Number(e.target.value))}
                    className="w-full accent-[#141414] cursor-pointer h-2 bg-neutral-200 border border-[#141414]/10 rounded-none"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-neutral-400">
                    <span>Imediato (1 dia)</span>
                    <span>Consolidado (15 dias)</span>
                  </div>
                </div>

                {/* Simulated percentages comparative output */}
                <div className="space-y-2 pt-4">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-none flex justify-between items-center text-xs text-rose-950 font-sans">
                    <span className="flex items-center gap-1.5"><span className="text-rose-500 font-bold">●</span> Sem Revisões (Estudo Tradicional)</span>
                    <span className="font-mono font-bold text-sm text-rose-700">{retentionNoReview}%</span>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-none flex justify-between items-center text-xs text-amber-975 font-sans">
                    <span className="flex items-center gap-1.5"><span className="text-amber-500 font-bold">●</span> Com 1 Revisão MedRevise</span>
                    <span className="font-mono font-bold text-sm text-amber-700">{retentionOneReview}%</span>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-none flex justify-between items-center text-xs text-emerald-950 font-sans">
                    <span className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">●</span> Com 3 Revisões MedRevise (Pro)</span>
                    <span className="font-mono font-bold text-sm text-emerald-700">{retentionThreeReviews}%</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-dashed border-neutral-300 mt-6 md:mt-0 space-y-2.5">
                <p className="text-[10px] text-neutral-500 font-sans leading-relaxed">
                  <strong>Análise Científica:</strong> De acordo com Ebbinghaus, perdemos cerca de <strong>50%</strong> do que aprendemos nas primeiras 24 horas. Repetições espaçadas programadas pelo MedRevise blindam as conexões neuronais, reiniciando o nível de fixação para 100% de recall.
                </p>
                <p className="text-[8.5px] text-neutral-400 font-mono leading-relaxed border-t border-slate-200/50 pt-2 flex items-start gap-1 justify-start">
                  <span className="text-[#10b981] font-bold">[*]</span>
                  <span>Fundamentação: Ebbinghaus, H. (1885). <em>Über das Gedächtnis: Untersuchungen zur experimentellen Psychologie</em>. Duncker & Humblot.</span>
                </p>
              </div>
            </div>

            {/* Visual Chart / SVG Curve Representation (right) */}
            <div className="lg:col-span-7 bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between min-h-[340px]">
              <div className="flex items-center justify-between pb-3 border-b border-[#141414]/15">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-neutral-500" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 font-bold">Dramático declínio de fixação</span>
                </div>
                <div className="flex gap-3 text-[8.5px] font-mono">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-rose-500"></span> Sem SRS</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500"></span> Com SRS MedRevise</span>
                </div>
              </div>

              {/* Responsive SVG Graph representation */}
              <div className="relative flex-1 py-4 flex items-center justify-center">
                <svg viewBox="0 0 500 200" className="w-full h-44 overflow-visible">
                  {/* Grid Lines */}
                  <line x1="0" y1="1" x2="500" y2="1" stroke="#f1f1f1" strokeWidth="1" />
                  <line x1="0" y1="50" x2="500" y2="50" stroke="#f5f5f5" strokeWidth="1" />
                  <line x1="0" y1="100" x2="500" y2="100" stroke="#f5f5f5" strokeWidth="1" />
                  <line x1="0" y1="150" x2="500" y2="150" stroke="#f5f5f5" strokeWidth="1" />
                  <line x1="0" y1="199" x2="500" y2="199" stroke="#141414" strokeWidth="1.5" />
                  <line x1="1" y1="0" x2="1" y2="200" stroke="#141414" strokeWidth="1.5" />

                  {/* Curve 1: No Review (Decline to bottom) */}
                  <path 
                    d="M 0 10 C 50 120, 150 170, 500 185" 
                    fill="none" 
                    stroke="#ef4444" 
                    strokeWidth="3.5" 
                    strokeDasharray="4 2"
                  />

                  {/* Curve 2: Perfect SRS reviews resetting curve back up to 100% */}
                  {/* Reviews on T1 (1 day), T3 (3 days), T6 (6 days) */}
                  <path 
                    d="M 0 10 L 35 120 M 35 12 A 50 50 0 0 1 105 70 M 105 12 A 110 110 0 0 1 210 50 M 210 12 Q 350 20, 500 35" 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="3" 
                  />

                  {/* Interactive Day Marker representation */}
                  {elapsedDays && (
                    <g transform={`translate(${(elapsedDays / 15) * 450 + 20}, 0)`}>
                      <line x1="0" y1="0" x2="0" y2="200" stroke="#141414" strokeWidth="1" strokeDasharray="3 3" />
                      <circle cx="0" cy="110" r="5" fill="#141414" />
                      <rect x="-10" y="-12" width="20" height="12" fill="#141415" />
                      <text x="0" y="-4" fill="#ffffff" fontSize="8" fontFamily="monospace" textAnchor="middle">
                        D{elapsedDays}
                      </text>
                    </g>
                  )}

                  {/* Chart axis captions */}
                  <text x="10" y="25" fill="#a3a3a3" fontSize="8" fontFamily="monospace">100% Retenção</text>
                  <text x="10" y="195" fill="#a3a3a3" fontSize="8" fontFamily="monospace">0% Memória</text>
                  <text x="470" y="190" fill="#a3a3a3" fontSize="8" fontFamily="monospace">Tempo (Dias)</text>
                </svg>
              </div>

              <div className="text-[9.5px] font-mono text-neutral-400 border-t pt-2 gap-2 flex justify-between">
                <span>Eixo Y: Capacidade de Resposta Cognitiva ativa (Recall)</span>
                <span>Eixo X: Tempo decorrido (15 dias corridos)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🚀 Massiva transição visual para o MedInternato */}
      <div className="w-full bg-[#141414] py-16 text-[#E4E3E0] border-y-2 border-[#141414] text-center space-y-4 relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1.5px,transparent_1.5px)] [background-size:20px_20px] opacity-15"></div>
        <div className="max-w-4xl mx-auto px-4 relative z-10 space-y-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-emerald-400 font-extrabold border border-emerald-500/40 px-3.5 py-1.5 bg-emerald-950/60 inline-block">
            MÓDULO DE PRÁTICA MÉDICA ATIVA
          </span>
          <h2 className="font-serif italic text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            Med<span className="text-emerald-400 font-serif italic font-black">Internato</span> 🩺
          </h2>
          <p className="text-neutral-300 text-xs sm:text-base font-sans max-w-2xl mx-auto leading-relaxed">
            A primeira inteligência artificial integrada de simulação de condutas clínicas beira de leito, discussões detalhadas de casos e mapeamento inteligente para as principais provas de residência do Brasil.
          </p>
        </div>
      </div>

      {/* 🌟 SEÇÃO HISTÓRICA: PASSO A PASSO ILUSTRADO & RECORTES REAIS DAS ÁREAS */}
      <section className="py-16 sm:py-24 bg-[#F2F1EC] border-t-2 border-[#141414] px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-none inline-block shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]">
              MÉTODO E PLATAFORMAS NA PRÁTICA
            </span>
            <h2 className="font-serif italic text-3xl sm:text-5xl font-black text-[#141414] tracking-tight leading-tight">
              Passo a Passo Ilustrativo & <span className="text-emerald-700">Recortes Reais</span> das Áreas
            </h2>
            <p className="text-neutral-600 text-xs sm:text-sm font-sans max-w-xl mx-auto leading-relaxed">
              Explore o interior das nossas plataformas integradas. Veja exatamente como funciona cada ferramenta antes mesmo de realizar o login.
            </p>
          </div>

          {/* Platform Tab Switcher */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={() => {
                setActiveStep(1);
                setActiveAreaTab('cronograma');
              }}
              className={`w-full sm:w-auto px-8 py-4 font-mono text-xs font-bold uppercase tracking-widest border-2 border-[#141414] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeStep === 1 
                  ? "bg-indigo-600 text-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] translate-x-[-2px] translate-y-[-2px]" 
                  : "bg-white text-neutral-800 hover:bg-neutral-50 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:translate-x-[1px] hover:translate-y-[1px]"
              }`}
            >
              🧠 1. MedRevise (Ciclo de Fixação)
            </button>
            <button
              onClick={() => {
                setActiveStep(2);
                setActiveAreaTab('cronograma');
              }}
              className={`w-full sm:w-auto px-8 py-4 font-mono text-xs font-bold uppercase tracking-widest border-2 border-[#141414] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeStep === 2 
                  ? "bg-emerald-600 text-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] translate-x-[-2px] translate-y-[-2px]" 
                  : "bg-white text-neutral-800 hover:bg-neutral-50 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:translate-x-[1px] hover:translate-y-[1px]"
              }`}
            >
              🩺 2. MedInternato (Prática & Cronograma)
            </button>
          </div>

          {/* Main Area Container */}
          <div className="bg-white border-2 border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] overflow-hidden rounded-none grid grid-cols-1 lg:grid-cols-12">
            
            {/* Left Column: Interactive Navigation of Areas */}
            <div className="lg:col-span-4 border-b-2 lg:border-b-0 lg:border-r-2 border-[#141414] bg-[#F5F4F0] p-6 space-y-6">
              <div className="space-y-1">
                <h3 className="font-serif italic text-lg font-bold text-[#141414]">
                  Áreas de Destaque
                </h3>
                <p className="text-[11px] text-neutral-500 font-sans">
                  Selecione uma área abaixo para visualizar o recorte real e as vantagens integradas:
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'cronograma', title: '📅 Planejamento Inteligente', desc: 'Planejamento dinâmico baseado em dias, horas e pesos das provas.' },
                  { id: 'resumos', title: '📚 Resumos de Elite', desc: 'Resumos teóricos ultra-sintéticos com controle inteligente de revisão.' },
                  { id: 'questoes', title: '📝 Questões Comentadas', desc: 'Treino ativo integrado com feedback imediato e calibrador de revisão.' },
                  { id: 'diferenciais', title: '⚡ Diferenciais Exclusivos', desc: 'Sincronização acadêmica, IA Mentor de beira de leito e muito mais.' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAreaTab(tab.id as any)}
                    className={`w-full text-left p-3.5 border-2 transition-all flex flex-col gap-1 rounded-none cursor-pointer ${
                      activeAreaTab === tab.id
                        ? "bg-white border-[#141414] shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] translate-x-[-1px] translate-y-[-1px]"
                        : "bg-transparent border-transparent hover:bg-neutral-100/50"
                    }`}
                  >
                    <span className="text-xs font-bold text-[#141414] font-mono">{tab.title}</span>
                    <span className="text-[10px] text-neutral-500 leading-normal font-sans">{tab.desc}</span>
                  </button>
                ))}
              </div>

              <div className="p-4 bg-amber-50/50 border border-amber-200 text-[11px] text-neutral-700 leading-relaxed font-mono">
                <span className="font-bold text-amber-950 block">💡 DICA DO PREPARATÓRIO:</span>
                O MedRevise e o MedInternato trocam dados automaticamente. Quando você marca um tema como estudado ou responde questões no Internato, o algoritmo recalcula suas datas de revisão espaçada no Revise em tempo real.
              </div>
            </div>

            {/* Right Column: Dynamic Real Clipping Preview with high-fidelity layout */}
            <div className="lg:col-span-8 p-6 sm:p-8 space-y-6 bg-white min-h-[500px] flex flex-col justify-between">
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeStep}-${activeAreaTab}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 flex-1"
                >
                  {/* MEDREVISE PREVIEWS */}
                  {activeStep === 1 && (
                    <div className="space-y-6">
                      
                      {/* CRONOGRAMA - MEDREVISE */}
                      {activeAreaTab === 'cronograma' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 font-bold border border-indigo-200">
                              RECORTE REAL: CALENDÁRIO MENSAL UNIFICADO
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-600">● MODO VISUALIZAÇÃO</span>
                          </div>

                          <p className="text-xs text-neutral-600 leading-relaxed">
                            No <strong>MedRevise</strong>, o seu cronograma é focado no controle diário de <strong>Revisões Ativas Agendadas</strong>. Você tem um calendário mensal limpo onde cada evento possui uma cor específica de acordo com o status e tipo:
                          </p>

                          {/* Interactive Calendar Simulator */}
                          <div className="border border-neutral-300 rounded-none overflow-hidden bg-neutral-50 font-sans shadow-sm">
                            <div className="bg-[#141414] text-white p-3 flex justify-between items-center text-xs font-mono">
                              <span className="font-bold">📅 JUNHO DE 2026 - CALENDÁRIO DE REVISÕES</span>
                              <span>Média de acertos: 82% 🎯</span>
                            </div>
                            
                            <div className="p-3 grid grid-cols-7 gap-2 text-center text-[10px] font-bold border-b border-neutral-200 uppercase bg-neutral-100/50">
                              <div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div><div>Dom</div>
                            </div>
                            
                            <div className="p-3 grid grid-cols-7 gap-2">
                              {/* Empty slots for spacing */}
                              <div className="h-16 p-1 bg-white border border-neutral-200 rounded-none text-left opacity-30">
                                <span className="text-neutral-400 font-mono text-[9px]">28</span>
                              </div>
                              <div className="h-16 p-1 bg-white border border-neutral-200 rounded-none text-left opacity-30">
                                <span className="text-neutral-400 font-mono text-[9px]">29</span>
                              </div>
                              
                              {/* Real Slots */}
                              <div className="h-16 p-1 bg-indigo-50/40 border-2 border-indigo-500 rounded-none text-left relative overflow-hidden">
                                <span className="text-indigo-950 font-bold font-mono text-[9px]">1</span>
                                <div className="mt-1 text-[8px] bg-indigo-600 text-white p-0.5 font-mono truncate leading-tight">
                                  🔄 REVISE: Apendicite
                                </div>
                              </div>

                              <div className="h-16 p-1 bg-emerald-50/40 border border-neutral-200 rounded-none text-left relative overflow-hidden">
                                <span className="text-neutral-700 font-bold font-mono text-[9px]">2</span>
                                <div className="mt-1 text-[8px] bg-emerald-600 text-white p-0.5 font-mono truncate leading-tight">
                                  📖 ESTUDO: CAD
                                </div>
                              </div>

                              <div className="h-16 p-1 bg-amber-50/40 border border-neutral-200 rounded-none text-left relative overflow-hidden">
                                <span className="text-neutral-700 font-bold font-mono text-[9px]">3</span>
                                <div className="mt-1 text-[8px] bg-[#D44E3D] text-white p-0.5 font-mono truncate leading-tight">
                                  🔄 REVISE: Infarto
                                </div>
                              </div>

                              <div className="h-16 p-1 bg-rose-50/40 border border-rose-300 rounded-none text-left relative overflow-hidden">
                                <span className="text-rose-950 font-bold font-mono text-[9px]">4</span>
                                <div className="mt-1 text-[8px] bg-rose-600 text-white p-0.5 font-mono truncate leading-tight">
                                  📝 SIMULADO: SES-DF
                                </div>
                              </div>

                              <div className="h-16 p-1 bg-white border border-neutral-200 rounded-none text-left relative overflow-hidden">
                                <span className="text-neutral-700 font-bold font-mono text-[9px]">5</span>
                                <div className="mt-1 text-[8px] bg-neutral-400 text-white p-0.5 font-mono truncate leading-tight">
                                  🍀 DIA LIVRE
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3.5 pt-2 text-[10px] font-mono justify-center">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-indigo-600 rounded-none"></span> REVISÕES ATIVAS</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-600 rounded-none"></span> TEMAS DE ESTUDO</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-600 rounded-none"></span> SIMULADOS</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-neutral-400 rounded-none"></span> LIVRE / FOLGA</span>
                          </div>
                        </div>
                      )}

                      {/* RESUMOS - MEDREVISE */}
                      {activeAreaTab === 'resumos' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 font-bold border border-indigo-200">
                              RECORTE REAL: RESUMOS TEÓRICOS ULTRA-SINTÉTICOS
                            </span>
                            <span className="text-[10px] font-mono font-bold text-[#D44E3D]">🎯 CONTEÚDO INTEGRAL</span>
                          </div>

                          <p className="text-xs text-neutral-600 leading-relaxed">
                            Resumos extensos geram ilusão de competência. No MedRevise, cada assunto tem um resumo cirúrgico focado em <strong>mecanismos patológicos primários e condutas práticas imediatas</strong>. Experimente o switcher de profundidade interativo abaixo:
                          </p>

                          <div className="flex gap-2 pb-1 border-b border-neutral-100">
                            {(['minimo', 'moderado', 'maximo'] as const).map((depth) => (
                              <button
                                key={depth}
                                onClick={() => setResumoDepth(depth)}
                                className={`px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-wider transition-all border ${
                                  resumoDepth === depth
                                    ? "bg-[#141414] text-white border-[#141414]"
                                    : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
                                }`}
                              >
                                {depth === 'minimo' ? '⚡ Essencial' : depth === 'moderado' ? '📊 Diagnóstico' : '🩺 Tratamento Completo'}
                              </button>
                            ))}
                          </div>

                          <div className="border border-neutral-200 p-4 bg-neutral-50 rounded-none font-sans space-y-3 shadow-xs">
                            <h4 className="text-xs font-black uppercase text-stone-900 border-b border-stone-200 pb-1.5 font-serif italic">
                              Apendicite Aguda: Quadro Clínico e Manejo
                            </h4>
                            
                            {resumoDepth === 'minimo' && (
                              <div className="space-y-2 text-xs text-stone-700 animate-fade-in leading-relaxed">
                                <p><strong className="text-[#D44E3D]">● Fisiopatologia Básica:</strong> Obstrução do lúmen apendicular (geralmente por coprólito em adultos ou hiperplasia linfoide em jovens) causando proliferação bacteriana, congestão linfática e isquemia.</p>
                                <p><strong className="text-[#D44E3D]">● Dor Clássica:</strong> Início insidioso em região periumbilical (dor visceral, fibras simpáticas), que migra após 6-12 horas para a fossa ilíaca direita (dor somática, irritação do peritônio parietal na fossa de McBurney).</p>
                              </div>
                            )}

                            {resumoDepth === 'moderado' && (
                              <div className="space-y-2 text-xs text-stone-700 animate-fade-in leading-relaxed">
                                <p><strong className="text-indigo-950">● Sinais Propedeuticos Patognomônicos:</strong></p>
                                <ul className="list-disc pl-5 space-y-1 text-stone-600">
                                  <li><strong>Sinal de Blumberg:</strong> Dor à descompressão súbita no ponto de McBurney (indica peritonite localizada).</li>
                                  <li><strong>Sinal de Rovsing:</strong> Dor na fossa ilíaca direita ao realizar compressão retrógrada do cólon esquerdo.</li>
                                  <li><strong>Sinal do Psoas:</strong> Dor à hiperextensão da coxa direita (apêndice retrocecal).</li>
                                </ul>
                                <p><strong className="text-indigo-950">● Escore de Alvarado:</strong> Classificação diagnóstica baseada em Sintomas, Sinais e Laboratório (leucocitose com desvio). Alvarado &ge; 7 em homens indica laparotomia imediata sem necessidade de exames de imagem adicionais.</p>
                              </div>
                            )}

                            {resumoDepth === 'maximo' && (
                              <div className="space-y-2 text-xs text-stone-700 animate-fade-in leading-relaxed">
                                <p><strong className="text-emerald-950">● Conduta e Manejo Terapêutico Padrão:</strong></p>
                                <p><strong>Apendicite Não-Complicada (Sem perfuração):</strong> Apendicectomia cirúrgica convencional ou laparoscópica imediata + antibioticoprofilaxia venosa de largo espectro na indução anestésica (ex: Cefoxitina 2g IV dose única).</p>
                                <p><strong>Apendicite Complicada (Abscesso ou Peritonite Difusa):</strong> Antibioticoterapia terapêutica estendida (ex: Ceftriaxona + Metronidazol ou Piperacilina/Tazobactam) + drenagem percutânea guiada por TC em abscessos maiores de 4cm antes da apendicectomia tardia de intervalo (6-8 semanas).</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* QUESTOES - MEDREVISE */}
                      {activeAreaTab === 'questoes' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 font-bold border border-indigo-200">
                              RECORTE REAL: INTERFACE DE QUESTÕES COM FEEDBACK
                            </span>
                            <span className="text-[10px] font-mono font-bold text-blue-600">● TREINAMENTO ATIVO</span>
                          </div>

                          <p className="text-xs text-neutral-600 leading-relaxed">
                            Responda a questão ilustrativa real abaixo para testar o sistema de justificativa detalhada e ver o impacto imediato no agendamento da revisão cognitiva:
                          </p>

                          <div className="border border-neutral-300 p-4 bg-neutral-50 rounded-none space-y-4 font-sans text-xs">
                            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                              <span className="font-bold font-mono text-[#D44E3D]">QUESTÃO 01 • USP-SP</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-stone-200 text-stone-800 text-[9px] font-mono font-bold uppercase">CIRURGIA GERAL</span>
                            </div>

                            <p className="text-stone-800 leading-relaxed">
                              Paciente do sexo masculino, 24 anos, com quadro de dor abdominal iniciada há 18 horas em região periumbilical, associada a anorexia e febre aferida de 38,2°C. Nas últimas 4 horas, a dor migrou para a fossa ilíaca direita e tornou-se intensa. Ao exame físico: Sinal de Blumberg presente. Hemograma revela leucocitose de 14.500/mm³ com 10% de bastões. Qual a conduta imediata preconizada?
                            </p>

                            <div className="space-y-2">
                              {[
                                { id: 'A', text: 'Realizar Tomografia de Abdome com duplo contraste para confirmação diagnóstica imediata.' },
                                { id: 'B', text: 'Encaminhar o paciente imediatamente para Apendicectomia convencional ou laparoscópica sem exames de imagem adicionais.' },
                                { id: 'C', text: 'Prescrever amoxicilina com clavulanato via oral por 14 dias e reavaliar o paciente em regime ambulatorial.' },
                                { id: 'D', text: 'Indicar Colonoscopia imediata para descartar doença inflamatória intestinal ou obstrução mecânica por fecalito.' }
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  onClick={() => setRealQuestionOption(opt.id)}
                                  className={`w-full text-left p-3 border transition-all text-xs flex items-start gap-3 rounded-none cursor-pointer ${
                                    realQuestionOption === opt.id
                                      ? opt.id === 'B'
                                        ? "bg-emerald-50/50 border-emerald-500 font-bold text-emerald-950"
                                        : "bg-rose-50/50 border-rose-500 font-bold text-rose-950"
                                      : "bg-white border-stone-200 hover:bg-stone-50"
                                  }`}
                                >
                                  <span className="w-5 h-5 rounded-none border border-stone-300 bg-stone-100 flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                                    {opt.id}
                                  </span>
                                  <span>{opt.text}</span>
                                </button>
                              ))}
                            </div>

                            {realQuestionOption && (
                              <div className="p-3 bg-neutral-100 border-l-4 border-indigo-600 space-y-2 animate-fade-in text-[11px] leading-relaxed text-stone-700">
                                {realQuestionOption === 'B' ? (
                                  <p className="text-emerald-800 font-bold">✅ RESPOSTA EXATA! Parabéns!</p>
                                ) : (
                                  <p className="text-rose-800 font-bold">❌ RESPOSTA INCORRETA. A alternativa exata é a B!</p>
                                )}
                                <p><strong>Justificativa Anatomo-Clínica:</strong> Trata-se de apendicite aguda clássica em paciente jovem do sexo masculino. O Escore de Alvarado é de 9 pontos (Dor migratória: 1, Anorexia: 1, Febre: 1, Dor na FID: 2, Blumberg: 2, Leucocitose: 2). Como o escore é &ge; 7 e o paciente é homem, o diagnóstico é puramente clínico e a conduta preconizada é a apendicectomia cirúrgica imediata, evitando a perda de tempo e custos de uma tomografia.</p>
                                <p className="text-indigo-700 font-bold font-mono text-[10px] mt-2">
                                  ⚡ Impacto no MedRevise: O acerto deste assunto calibrou sua próxima revisão espaçada para daqui a 7 dias (Intervalo Médio-Fácil).
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* DIFERENCIAIS - MEDREVISE */}
                      {activeAreaTab === 'diferenciais' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 font-bold border border-indigo-200">
                              DIFERENCIAIS EXCLUSIVOS DO MEDREVISE
                            </span>
                            <span className="text-[10px] font-mono font-bold text-amber-600">💡 ALTA PERFORMANCE</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-none space-y-2">
                              <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-mono">Calibração Cognitiva Dinâmica</h4>
                              <p className="text-[11px] text-stone-600 leading-relaxed font-sans">
                                Diferente do Anki clássico onde você decide arbitrariamente o intervalo ("Fácil", "Difícil"), o MedRevise analisa estatisticamente a sua <strong>taxa real de acerto de questões</strong> na plataforma para agendar os prazos ideais das suas revisões de forma 100% matemática.
                              </p>
                            </div>

                            <div className="p-4 bg-emerald-50/40 border border-[#141414] rounded-none space-y-2">
                              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider font-mono">Unificação com o MedInternato</h4>
                              <p className="text-[11px] text-stone-600 leading-relaxed font-sans">
                                Ao realizar sessões de simulação e responder casos clínicos de beira de leito no MedInternato, o MedRevise integra as estatísticas imediatamente para que você nunca estude o mesmo tema de forma redundante ou desalinhada.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* MEDINTERNATO PREVIEWS */}
                  {activeStep === 2 && (
                    <div className="space-y-6">
                      
                      {/* CRONOGRAMA - MEDINTERNATO */}
                      {activeAreaTab === 'cronograma' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 font-bold border border-emerald-250">
                              RECORTE REAL: CRONOGRAMA INTELIGENTE ADAPTÁVEL
                            </span>
                            <span className="text-[10px] font-mono font-bold text-[#D44E3D]">● SISTEMA EXCLUSIVO</span>
                          </div>

                          <p className="text-xs text-neutral-600 leading-relaxed">
                            No <strong>MedInternato</strong>, os cronogramas não são estáticos ou iguais para todos. O cronograma se organiza dinamicamente com base nas suas horas diárias disponíveis, dias de estudo e o <strong>foco da banca regional desejada</strong>, dividindo os temas de forma proporcional aos pesos de prova:
                          </p>

                          {/* High Fidelity Schedule Mockup Preview */}
                          <div className="border-2 border-[#141414] rounded-none p-5 bg-stone-50 text-xs font-sans shadow-sm space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-stone-200 pb-2">
                              <div>
                                <h4 className="font-bold text-[#1a1a1a] text-xs">CRONOGRAMA ADAPTATIVO: USP-SP • Intensivo 6 Meses</h4>
                                <span className="text-[10px] font-mono text-stone-500">Fórmula de Pesos Regionais Ativada</span>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-mono font-bold">SEMANA 01 DE 24</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[10.5px]">
                              <div className="p-2.5 bg-white border border-stone-200 rounded-none space-y-1">
                                <span className="font-bold text-[#D44E3D] font-mono text-[10px] block border-b border-stone-100 pb-0.5">SEG • CIRURGIA GERAL</span>
                                <p className="font-bold text-stone-800">📖 Apendicite Aguda</p>
                                <span className="text-[9px] text-stone-400 block font-mono">Relevância regional: 88%</span>
                              </div>

                              <div className="p-2.5 bg-white border border-stone-200 rounded-none space-y-1">
                                <span className="font-bold text-[#D44E3D] font-mono text-[10px] block border-b border-stone-100 pb-0.5">TER • CLINICA MÉDICA</span>
                                <p className="font-bold text-stone-800">📖 Cetoacidose Diabética</p>
                                <span className="text-[9px] text-stone-400 block font-mono">Relevância regional: 76%</span>
                              </div>

                              <div className="p-2.5 bg-white border border-stone-200 rounded-none space-y-1">
                                <span className="font-bold text-[#D44E3D] font-mono text-[10px] block border-b border-stone-100 pb-0.5">QUA • PEDIATRIA</span>
                                <p className="font-bold text-stone-800">📖 Asma na Infância</p>
                                <span className="text-[9px] text-stone-400 block font-mono">Relevância regional: 82%</span>
                              </div>

                              <div className="p-2.5 bg-white border border-stone-200 rounded-none space-y-1">
                                <span className="font-bold text-[#D44E3D] font-mono text-[10px] block border-b border-stone-100 pb-0.5">QUI • GINECOLOGIA</span>
                                <p className="font-bold text-stone-800">📖 Ciclo Menstrual</p>
                                <span className="text-[9px] text-stone-400 block font-mono">Relevância regional: 68%</span>
                              </div>

                              <div className="p-2.5 bg-indigo-50 border-2 border-indigo-400 rounded-none space-y-1">
                                <span className="font-bold text-indigo-700 font-mono text-[10px] block border-b border-indigo-100 pb-0.5">SEX • REVISÃO DE CICLO</span>
                                <p className="font-bold text-indigo-900">🔄 Questões de Revisão</p>
                                <span className="text-[9px] text-indigo-400 block font-mono">Apendicite + CAD + Asma</span>
                              </div>
                            </div>

                            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-none text-[10px] text-rose-950 flex justify-between items-center">
                              <span>📝 <strong>Simulado de Fim de Semana:</strong> 50 Questões Clássicas e Inéditas de Cirurgia Geral e Clínica Médica</span>
                              <span className="font-mono font-bold text-rose-700 bg-white px-2 py-0.5 border border-rose-300">DOMINGO</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* RESUMOS - MEDINTERNATO */}
                      {activeAreaTab === 'resumos' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 font-bold border border-emerald-250">
                              RECORTE REAL: INTERAÇÃO CLÍNICA COM IA MENTOR
                            </span>
                            <span className="text-[10px] font-mono font-bold text-indigo-600">● ESTUDO DE BEIRA DE LEITO</span>
                          </div>

                          <p className="text-xs text-neutral-600 leading-relaxed">
                            No MedInternato, você discute condutas terapêuticas reais diretamente com o nosso <strong>IA Mentor especializado</strong> de beira de leito. Faça uma pergunta real abaixo e veja a resposta didática instantânea da nossa inteligência artificial:
                          </p>

                          {/* Real-time Simulator for IA Mentor */}
                          <div className="border border-neutral-300 rounded-none overflow-hidden bg-neutral-900 text-white font-mono text-xs">
                            <div className="bg-[#1A1A1A] p-3 border-b border-neutral-800 flex justify-between items-center">
                              <span className="text-emerald-400 flex items-center gap-1.5 font-bold">🩺 MENTOR CLÍNICO MEDINTERNATO</span>
                              <span className="text-[9px] text-neutral-500 font-bold">● ONLINE / RESIDÊNCIA INTEGRAL</span>
                            </div>

                            <div className="p-4 space-y-4 max-h-[220px] overflow-y-auto">
                              <div className="space-y-1.5 text-left">
                                <span className="text-stone-400 text-[10px] block">PERGUNTA CLÍNICA:</span>
                                <p className="text-stone-100 bg-stone-800/60 p-2.5 border-l-2 border-amber-500 rounded-none leading-relaxed">
                                  {realMentorQuestion || "Selecione uma dúvida abaixo para interagir em tempo real com o Mentor de Beira de Leito."}
                                </p>
                              </div>

                              {isRealMentorLoading ? (
                                <div className="flex items-center gap-2 text-stone-400 py-2">
                                  <span className="animate-spin text-emerald-400">⚡</span>
                                  <span>Mentor médico está analisando as condutas do edital...</span>
                                </div>
                              ) : realMentorResponse ? (
                                <div className="space-y-1.5 text-left animate-fade-in border-t border-stone-800 pt-3">
                                  <span className="text-emerald-400 text-[10px] block font-bold">MÉDICO ASSISTENTE / IA:</span>
                                  <p className="text-stone-300 leading-relaxed p-2 text-[11px]">
                                    {realMentorResponse}
                                  </p>
                                </div>
                              ) : null}
                            </div>

                            <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex flex-wrap gap-2 justify-center">
                              <button
                                onClick={() => handleSimulatedRealMentorPrompt('insulina')}
                                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[10px] text-stone-200 font-bold text-left block"
                              >
                                ❓ Taxa de Insulina na CAD e quando evitar?
                              </button>
                              <button
                                onClick={() => handleSimulatedRealMentorPrompt('transicao')}
                                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[10px] text-stone-200 font-bold text-left block"
                              >
                                ❓ Critérios de transição venosa/SC da insulina?
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* QUESTOES - MEDINTERNATO */}
                      {activeAreaTab === 'questoes' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 font-bold border border-emerald-250">
                              RECORTE REAL: SIMULAÇÃO DE CASO CLÍNICO PRÁTICO
                            </span>
                            <span className="text-[10px] font-mono font-bold text-amber-600">● CIRURGIA DE ALTA RENOVAÇÃO</span>
                          </div>

                          <p className="text-xs text-neutral-600 leading-relaxed">
                            No MedInternato, as questões não são simples decorebas de edital. Você enfrenta casos que simulam a <strong>verdadeira rotina do plantão de emergência médica</strong>, analisando exames de imagem e elegendo as condutas terapêuticas prioritárias de cada área.
                          </p>

                          <div className="p-4 border border-stone-200 bg-stone-50 text-xs text-stone-700 space-y-3 font-sans">
                            <h5 className="font-bold text-stone-900 uppercase font-mono text-[10px]">🚨 INTERNAÇÃO EM URGÊNCIA MÉDICA</h5>
                            <p className="leading-relaxed">
                              Diferente do formato estático, as sessões de questões oferecem fluxogramas integrados onde você deve decidir se o paciente necessita de <strong>Exames Complementares imediatos</strong> ou se a conduta inicial prioritária deve ser <strong>Estabilização Volêmica imediata</strong>, testando sua tomada de decisão rápida.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* DIFERENCIAIS - MEDINTERNATO */}
                      {activeAreaTab === 'diferenciais' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 font-bold border border-emerald-250">
                              DIFERENCIAIS EXCLUSIVOS DO MEDINTERNATO
                            </span>
                            <span className="text-[10px] font-mono font-bold text-indigo-600">● MAPEAMENTO EMERGENCIAL</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-emerald-50/40 border border-emerald-250 rounded-none space-y-2">
                              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider font-mono">Foco Duplo Acadêmico/Residência</h4>
                              <p className="text-[11px] text-stone-600 leading-relaxed font-sans">
                                Sincronize o cronograma diretamente com as disciplinas que você está cursando na faculdade de medicina hoje. O plano as agrupa no início do cronograma, garantindo notas excelentes nas provas do internato ao mesmo tempo em que avança no edital de residência.
                              </p>
                            </div>

                            <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-none space-y-2">
                              <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider font-mono">Análise de IA de Arquivos de Cronograma PDF</h4>
                              <p className="text-[11px] text-stone-600 leading-relaxed font-sans">
                                Se você já possui um cronograma estático em PDF fornecido pela sua faculdade ou cursinho tradicional (Medgrupo, Medcof, etc.), nossa Inteligência Artificial decodifica o arquivo e gera instantaneamente o plano adaptativo no sistema, economizando horas de planejamento manual.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Action Button footer */}
              <div className="pt-4 border-t border-neutral-150 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-[11px] text-neutral-500 font-mono">
                  Gostou da demonstração? Crie sua conta grátis para desbloquear o sistema completo.
                </div>
                <button
                  onClick={onLogin}
                  className="w-full sm:w-auto px-6 py-3 bg-[#141414] hover:bg-neutral-800 text-[#E4E3E0] font-mono text-xs font-bold uppercase tracking-widest shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Começar a Estudar Agora
                  <ArrowRight size={13} />
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* Unified MedInternato Explanation & Interactive Section */}
      <section className="py-16 sm:py-24 bg-white border-b-2 border-[#141414] px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          
          {/* Main Title Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-emerald-800 bg-emerald-50 border border-emerald-250 px-3 py-1 rounded-none inline-block">
              ECOSSISTEMA COMPLETO • MEDINTERNATO
            </span>
            <h3 className="font-serif italic text-3xl sm:text-4xl font-extrabold text-neutral-950">
              O que é o MedInternato e como funciona na prática?
            </h3>
            <p className="text-neutral-600 text-xs sm:text-sm font-sans leading-relaxed">
              A ponte definitiva entre a retenção teórica de longo prazo do MedRevise e a tomada de conduta médica ativa no internato, plantões e provas de residência.
            </p>
          </div>

          {/* Conceptual Foundation: Definição, Metodologia e Pilares */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left Column: Visual Explanation & 3 Steps */}
            <div className="lg:col-span-5 bg-emerald-50/20 border-2 border-[#141414] p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-600 inline-block"></span>
                  <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-emerald-800">
                    VISÃO GERAL
                  </span>
                </div>
                <h4 className="font-serif italic text-2xl font-extrabold text-neutral-950 leading-snug">
                  A sua arena de simulação prática médica
                </h4>
                <p className="text-neutral-700 text-xs sm:text-sm font-sans leading-relaxed">
                  Enquanto o <strong>MedRevise</strong> cuida da sua retenção teórica de longo prazo com o algoritmo de repetições espaçadas (Ebbinghaus), o <strong>MedInternato</strong> é a sua arena de simulação prática clínica.
                </p>
                <p className="text-neutral-600 text-xs font-sans leading-relaxed">
                  Desenvolvido para estudantes no internato e médicos generalistas, ele transforma matérias em condutas práticas ativas através de um ecossistema integrado que une bancos de questões de residência, discussões de casos reais e mentoria por Inteligência Artificial.
                </p>
                
                <div className="border-l-3 border-emerald-500 pl-4 py-2 bg-white p-3 border border-[#141414]/10 space-y-1">
                  <span className="font-mono text-[9px] text-emerald-850 font-bold uppercase block">Metodologia Unificada</span>
                  <p className="text-xs text-neutral-600 font-sans italic leading-normal">
                    "Você fixa os conceitos no MedRevise através do SRS, treina o raciocínio diagnóstico no MedInternato com o Mentor IA e reavalia suas fraquezas automaticamente."
                  </p>
                </div>
              </div>

              <div className="border-t border-dashed border-neutral-300 pt-5 space-y-3">
                <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block font-bold">PASSO A PASSO NA PRÁTICA</span>
                <div className="space-y-2.5">
                  <div className="flex gap-2.5 items-center">
                    <div className="w-5 h-5 bg-[#141414] text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0">1</div>
                    <p className="text-xs text-neutral-600 font-sans"><strong className="text-neutral-900">Planeje:</strong> Cadastre as matérias das suas aulas ou estágios no MedRevise.</p>
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <div className="w-5 h-5 bg-[#141414] text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0">2</div>
                    <p className="text-xs text-neutral-600 font-sans"><strong className="text-neutral-900">Organize e Pratique:</strong> No MedInternato, distribua matérias por semestres (S1-S12) e resolva questões e flashcards.</p>
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <div className="w-5 h-5 bg-emerald-600 text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0">3</div>
                    <p className="text-xs text-neutral-600 font-sans"><strong className="text-neutral-900">Sincronize:</strong> Veja o algoritmo agendar suas revisões de repetição espaçada com base no seu rendimento real.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: 4 Pillars */}
            <div className="lg:col-span-7 bg-white border-2 border-[#141414] p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between space-y-6">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block font-bold">RECURSOS E ESTRUTURA TÉCNICA</span>
                <h4 className="font-serif italic text-2xl font-bold text-neutral-950 mt-1">Os 4 Pilares de Funcionamento do MedInternato</h4>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-2">
                <div className="space-y-2 border-l-2 border-indigo-600 pl-3.5">
                  <h5 className="font-mono text-[10px] font-bold uppercase text-indigo-900 flex items-center gap-1.5">
                    1. Organização por Semestres (S1-S12)
                  </h5>
                  <p className="text-xs text-neutral-550 leading-relaxed font-sans">
                    Importe suas matérias para o MedInternato e organize-as de acordo com o semestre da faculdade de medicina para focar no que importa na sua rotação atual.
                  </p>
                </div>

                <div className="space-y-2 border-l-2 border-emerald-600 pl-3.5">
                  <h5 className="font-mono text-[10px] font-bold uppercase text-emerald-900 flex items-center gap-1.5">
                    2. Mentor de Conduta IA
                  </h5>
                  <p className="text-xs text-neutral-550 leading-relaxed font-sans">
                    Esclareça dúvidas em tempo real à beira do leito, debata diagnósticos diferenciais e peça explicações calibradas com as diretrizes médicas mais recentes.
                  </p>
                </div>

                <div className="space-y-2 border-l-2 border-amber-600 pl-3.5">
                  <h5 className="font-mono text-[10px] font-bold uppercase text-amber-900 flex items-center gap-1.5">
                    3. Banco Prático Ativo
                  </h5>
                  <p className="text-xs text-neutral-550 leading-relaxed font-sans">
                    Resolva questões clínicas reais de grandes bancas de residência e testes focados em condutas, desconstruindo as pegadinhas dos enunciados.
                  </p>
                </div>

                <div className="space-y-2 border-l-2 border-rose-600 pl-3.5">
                  <h5 className="font-mono text-[10px] font-bold uppercase text-neutral-900 flex items-center gap-1.5">
                    4. Sincronia de Recall
                  </h5>
                  <p className="text-xs text-neutral-550 leading-relaxed font-sans">
                    Sempre que praticar questões no MedInternato, sua assertividade retroalimenta a base do MedRevise, agendando revisões e flashes no SRS.
                  </p>
                </div>
              </div>

              <div className="bg-neutral-50 border border-[#141414] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5 text-center sm:text-left">
                  <span className="font-mono text-[9px] uppercase font-bold text-emerald-800">Experimente o ecossistema na prática</span>
                  <p className="text-xs text-neutral-600">Teste as ferramentas de resumos, questões e flashcards no simulador interativo abaixo.</p>
                </div>
                <button
                  onClick={onLogin}
                  className="px-5 py-2 bg-[#141414] hover:bg-neutral-800 text-white font-mono text-xs font-bold uppercase tracking-wider shrink-0 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer"
                >
                  Começar Grátis
                </button>
              </div>
            </div>

          </div>

          {/* Interactive Demonstration Section */}
          <div className="space-y-8 pt-8 border-t-2 border-dashed border-stone-200">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-emerald-800 bg-emerald-50 border border-emerald-250 px-2.5 py-0.5 inline-block">
                DEMONSTRAÇÃO EM TEMPO REAL
              </span>
              <h4 className="font-serif italic text-2xl sm:text-3xl font-extrabold text-neutral-950">
                Veja o MedInternato em Ação
              </h4>
              <p className="text-neutral-500 text-xs font-sans">
                Explore o ecossistema inteligente abaixo. Nós criamos, organizamos e otimizamos o seu aprendizado clínico com ferramentas cirúrgicas de alta performance.
              </p>
            </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setActiveDemoTab('summary')}
              className={`px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider border-2 border-[#141414] shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] transition-all flex items-center gap-2 cursor-pointer ${
                activeDemoTab === 'summary'
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-950 translate-x-[1px] translate-y-[1px] shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]'
                  : 'bg-white hover:bg-neutral-50 text-neutral-600 border-[#141414]'
              }`}
            >
              <FileText size={14} />
              1. Geração de Resumos
            </button>
            <button
              onClick={() => setActiveDemoTab('questions')}
              className={`px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider border-2 border-[#141414] shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] transition-all flex items-center gap-2 cursor-pointer ${
                activeDemoTab === 'questions'
                  ? 'bg-indigo-50 text-indigo-950 border-indigo-950 translate-x-[1px] translate-y-[1px] shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]'
                  : 'bg-white hover:bg-neutral-50 text-neutral-600 border-[#141414]'
              }`}
            >
              <ListChecks size={14} />
              2. Questões Clínicas
            </button>
            <button
              onClick={() => setActiveDemoTab('flashcards')}
              className={`px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider border-2 border-[#141414] shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] transition-all flex items-center gap-2 cursor-pointer ${
                activeDemoTab === 'flashcards'
                  ? 'bg-amber-50 text-amber-950 border-amber-950 translate-x-[1px] translate-y-[1px] shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]'
                  : 'bg-white hover:bg-neutral-50 text-neutral-600 border-[#141414]'
              }`}
            >
              <Layers size={14} />
              3. Flashcards de Memorização
            </button>
          </div>

          {/* Tab Content Canvas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left side: Functional description */}
            <div className="lg:col-span-5 bg-[#E4E3E0]/30 border-2 border-[#141414] p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between">
              {activeDemoTab === 'summary' && (
                <div className="space-y-4">
                  <span className="font-mono text-[8.5px] uppercase tracking-wider text-emerald-800 font-bold block">RECURSO #1 • RESUMOS CLÍNICOS IA</span>
                  <h4 className="font-serif italic text-2xl font-bold text-neutral-950">Geração de Condutas Médicas Reais em Segundos</h4>
                  <p className="text-xs text-neutral-650 leading-relaxed font-sans">
                    Insira qualquer tema da medicina interna, pediatria, cirurgia, ginecologia ou obstetrícia. Nossa Inteligência Artificial consulta as bases científicas e as principais diretrizes nacionais para estruturar um resumo de conduta prático, focado na rotina dos plantões e do internato.
                  </p>
                  <ul className="text-xs text-neutral-600 space-y-2 pt-2 list-none">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      <span>Diagnósticos diferenciais e critérios objetivos.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      <span>Diretrizes atualizadas passo a passo.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      <span>Sincronia automática com flashcards e calendários.</span>
                    </li>
                  </ul>
                </div>
              )}

              {activeDemoTab === 'questions' && (
                <div className="space-y-4">
                  <span className="font-mono text-[8.5px] uppercase tracking-wider text-indigo-800 font-bold block">RECURSO #2 • QUESTÕES DA ROTINA E PROVAS</span>
                  <h4 className="font-serif italic text-2xl font-bold text-neutral-950">Treino Ativo com Comentários Explicativos</h4>
                  <p className="text-xs text-neutral-650 leading-relaxed font-sans">
                    O MedInternato possui um banco integrado de questões de múltipla escolha focadas no raciocínio clínico diagnóstico e terapêutico. Ao errar ou acertar, você recebe um feedback cirúrgico da nossa IA explicando os distratores e a alternativa correta.
                  </p>
                  <ul className="text-xs text-neutral-600 space-y-2 pt-2 list-none">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-indigo-600 shrink-0" />
                      <span>Casos clínicos realistas e questões de grandes instituições.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-indigo-600 shrink-0" />
                      <span>Explicações minuciosas de cada alternativa.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-indigo-600 shrink-0" />
                      <span>Seu rendimento retroalimenta o seu cronograma do MedRevise.</span>
                    </li>
                  </ul>
                </div>
              )}

              {activeDemoTab === 'flashcards' && (
                <div className="space-y-4">
                  <span className="font-mono text-[8.5px] uppercase tracking-wider text-amber-800 font-bold block">RECURSO #3 • MEMORIZAÇÃO ATIVA SRS</span>
                  <h4 className="font-serif italic text-2xl font-bold text-neutral-950">Bloqueie o Esquecimento de Fatos Decoreba</h4>
                  <p className="text-xs text-neutral-650 leading-relaxed font-sans">
                    Utilize o poder das Repetições Espaçadas de Hermann Ebbinghaus diretamente nos seus estudos de caso. Nossos flashcards inteligentes testam seus limites cognitivos na memorização de doses, tríades e classificações cruciais.
                  </p>
                  <ul className="text-xs text-neutral-600 space-y-2 pt-2 list-none">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                      <span>Lógica de espaçamento adaptativa ao seu nível de dificuldade.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                      <span>Estudo de alta densidade focado no recall imediato.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                      <span>Evita revisões desnecessárias, poupando seu tempo precioso.</span>
                    </li>
                  </ul>
                </div>
              )}

              <div className="pt-6 border-t border-dashed border-neutral-300 mt-6 flex flex-col gap-3">
                <span className="font-mono text-[9px] text-neutral-455 uppercase font-bold">PRONTO PARA COLOCAR EM PRÁTICA?</span>
                <button
                  onClick={onLogin}
                  className="w-full text-center py-3.5 bg-[#141414] hover:bg-neutral-850 text-white font-mono text-xs font-bold uppercase tracking-widest cursor-pointer shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] transition-all flex items-center justify-center gap-2 border border-transparent"
                >
                  Criar Minha Conta Grátis
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Right side: Interactive Mockup Canvas */}
            <div className="lg:col-span-7 bg-[#E4E3E0]/20 border-2 border-[#141414] p-4 sm:p-6 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-center min-h-[420px]">
              {/* Mockup wrapper */}
              <div className="w-full h-full bg-white border border-[#141414] shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] overflow-hidden flex flex-col">
                
                {/* Mockup Toolbar */}
                <div className="bg-[#141414] text-white px-4 py-2.5 flex items-center justify-between font-mono text-[9.5px] tracking-wider uppercase font-bold select-none border-b border-[#141414]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  </div>
                  <span>
                    {activeDemoTab === 'summary' && 'Visualização de Resumo • MedInternato IA'}
                    {activeDemoTab === 'questions' && 'Simulador de Questões Médicas'}
                    {activeDemoTab === 'flashcards' && 'Estudo Ativo por Flashcards SRS'}
                  </span>
                  <span className="text-neutral-400 text-[8.5px]">v1.4</span>
                </div>

                {/* Mockup Content area */}
                <div className="p-4 sm:p-6 overflow-y-auto max-h-[420px] space-y-4">
                  {activeDemoTab === 'summary' && (
                    <div className="space-y-4 text-neutral-800">
                      {/* Summary Header */}
                      <div className="border-b-2 border-[#141414] pb-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-250 px-2 py-0.5 uppercase">CIRURGIA • APENDICITE AGUDA</span>
                          <span className="font-mono text-[8.5px] text-neutral-400 uppercase flex items-center gap-1 font-bold">
                            <Clock size={11} /> 3 min de leitura
                          </span>
                        </div>
                        <h5 className="font-serif italic text-2xl font-extrabold text-neutral-900 mt-1.5">Apendicite Aguda</h5>
                        <p className="text-[11px] text-neutral-500 font-sans mt-0.5">A principal causa de abdome agudo inflamatório de indicação cirúrgica no mundo.</p>
                      </div>

                      {/* Real-App Styled Alert Callout Boxes */}
                      <div className="p-3.5 bg-rose-50 border-l-4 border-rose-600 space-y-1 shadow-[2px_2px_0px_0px_rgba(225,29,72,0.1)]">
                        <span className="font-mono text-[8.5px] font-black uppercase text-rose-700 tracking-wider flex items-center gap-1">
                          ⚠️ ALERTA DE PLANTÃO • URGÊNCIA CLÍNICA
                        </span>
                        <p className="text-[11px] text-rose-950 font-sans leading-relaxed">
                          A apresentação da apendicite em <strong>gestantes</strong> é atípica. Devido ao crescimento uterino, há uma <strong>migração cefálica do apêndice cecal</strong>, mimetizando quadros de colecistite ou pancreatite aguda, com dor em hipocôndrio direito. Mantenha alto índice de suspeição!
                        </p>
                      </div>

                      <div className="p-3.5 bg-blue-50 border-l-4 border-blue-600 space-y-1 shadow-[2px_2px_0px_0px_rgba(37,99,235,0.1)]">
                        <span className="font-mono text-[8.5px] font-black uppercase text-blue-700 tracking-wider flex items-center gap-1">
                          🎓 QUESTÃO DE PROVA • RECORRÊNCIA ENARE
                        </span>
                        <p className="text-[11px] text-blue-950 font-sans leading-relaxed">
                          O ENARE e grandes bancas adoram cobrar os <strong>sinais de apendicite retrocecal ou pélvica</strong>. Lembre-se do <strong>Sinal do Psoas</strong> (dor à hiperextensão do quadril direito) e do <strong>Sinal do Obturador</strong> (dor à rotação interna da coxa flexionada).
                        </p>
                      </div>

                      {/* Summary Section 1 */}
                      <div className="space-y-1.5">
                        <h6 className="font-mono text-[10px] font-bold text-neutral-900 uppercase flex items-center gap-1.5 border-l-2 border-[#141414] pl-2">
                          <span className="text-neutral-400 font-bold">#01</span> Quadro Clínico Clássico
                        </h6>
                        <p className="text-xs text-neutral-650 font-sans leading-relaxed">
                          A dor abdominal tipicamente inicia de forma difusa na região <strong className="text-neutral-900">epigástrica ou periumbilical</strong>, migrando para a <strong className="text-neutral-900">fossa ilíaca direita (ponto de McBurney)</strong> após 12 a 24 horas, acompanhada de anorexia, náuseas, vômitos e febre baixa.
                        </p>
                      </div>

                      {/* Summary Callout Box: Sinais Clínicos */}
                      <div className="p-3 bg-neutral-50 border border-[#141414] shadow-[1.5px_1.5px_0px_0px_rgba(20,20,20,1)] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <strong className="font-mono text-[9.5px] uppercase text-neutral-800 block font-bold">Sinal de Blumberg:</strong>
                          <span className="text-neutral-600 font-sans">Dor à descompressão brusca no ponto de McBurney (indica irritação peritoneal).</span>
                        </div>
                        <div>
                          <strong className="font-mono text-[9.5px] uppercase text-neutral-800 block font-bold">Sinal de Rovsing:</strong>
                          <span className="text-neutral-600 font-sans">Dor na fossa ilíaca direita gerada pela palpação da fossa ilíaca esquerda.</span>
                        </div>
                      </div>

                      {/* Summary Section 2 */}
                      <div className="space-y-1.5">
                        <h6 className="font-mono text-[10px] font-bold text-neutral-900 uppercase flex items-center gap-1.5 border-l-2 border-[#141414] pl-2">
                          <span className="text-neutral-400 font-bold">#02</span> Escore de Alvarado
                        </h6>
                        <div className="text-xs text-neutral-600 font-sans space-y-1 leading-relaxed">
                          <p>Utilizado para estratificação de risco de apendicite aguda:</p>
                          <div className="bg-neutral-50 p-2.5 border border-[#141414]/10 rounded-none space-y-1">
                            <div className="flex justify-between font-mono text-[9.5px] text-neutral-455 border-b pb-0.5 mb-1 font-bold">
                              <span>CRITÉRIO</span>
                              <span>PONTOS</span>
                            </div>
                            <div className="flex justify-between"><span>Migração da dor para QID</span> <span>1</span></div>
                            <div className="flex justify-between"><span>Anorexia</span> <span>1</span></div>
                            <div className="flex justify-between"><span>Náuseas / Vômitos</span> <span>1</span></div>
                            <div className="flex justify-between font-bold text-neutral-900"><span>Dor à palpação profunda em QID</span> <span>2</span></div>
                            <div className="flex justify-between"><span>Descompressão dolorosa em QID (Blumberg)</span> <span>1</span></div>
                            <div className="flex justify-between font-bold text-neutral-900"><span>Leucocitose (≥ 10.000)</span> <span>2</span></div>
                          </div>
                          <p className="mt-1">
                            <strong className="text-neutral-900">Escore ≥ 7:</strong> Indica alta probabilidade. Em homens jovens, autoriza a <strong className="text-emerald-700 font-semibold">indicação cirúrgica imediata</strong> sem exames de imagem adicionais.
                          </p>
                        </div>
                      </div>

                      {/* Summary Section 3 */}
                      <div className="space-y-1.5">
                        <h6 className="font-mono text-[10px] font-bold text-neutral-900 uppercase flex items-center gap-1.5 border-l-2 border-[#141414] pl-2">
                          <span className="text-neutral-400 font-bold">#03</span> Conduta Recomendada
                        </h6>
                        <p className="text-xs text-neutral-650 font-sans leading-relaxed">
                          Manter o paciente em <strong className="text-neutral-900">jejum absoluto</strong>, iniciar <strong className="text-neutral-900">hidratação venosa</strong> vigorosa e antibioticoterapia profilática direcionada para flora entérica (ex: Cefoxitina, ou Ciprofloxacino + Metronidazol). A conduta definitiva é a <strong className="text-emerald-700 font-bold">Apendicectomia</strong> (preferencialmente laparoscópica).
                        </p>
                      </div>
                    </div>
                  )}

                  {activeDemoTab === 'questions' && (
                    <div className="space-y-4 text-neutral-800">
                      {/* Question Header */}
                      <div className="border-b border-[#141414]/15 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-indigo-850 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 uppercase">
                            PROVA REAL • UFG 2025 • RESIDÊNCIA MÉDICA
                          </span>
                          <span className="font-mono text-[8.5px] text-neutral-400 font-bold">ID: #40589</span>
                        </div>
                        <h5 className="font-sans text-xs font-bold text-neutral-950 mt-1.5 leading-relaxed">
                          Um paciente masculino, de 24 anos, previamente hígido, apresenta quadro de dor abdominal com início difuso em região epigástrica há 14 horas, que migrou posteriormente para a fossa ilíaca direita (FID). Associa anorexia, náuseas e temperatura axilar de 37.9ºC. Ao exame clínico, apresenta sinal de Blumberg e sinal de Rovsing positivos. Diante do escore clínico de Alvarado de 8 pontos, qual a conduta imediata mais adequada?
                        </h5>
                      </div>

                      {/* Question Options */}
                      <div className="space-y-2">
                        {[
                          { id: 'A', text: 'Prescrever sintomáticos e realizar acompanhamento clínico domiciliar por 48 horas.' },
                          { id: 'B', text: 'Encaminhar o paciente imediatamente para Apendicectomia cirúrgica.' },
                          { id: 'C', text: 'Solicitar Tomografia Computadorizada de abdome e pelve com contraste intravenoso para confirmação diagnóstica.' },
                          { id: 'D', text: 'Prescrever antibioticoterapia profilática e reavaliar o escore clínico em 24 horas.' }
                        ].map((opt) => {
                          const isSelected = selectedOption === opt.id;
                          const isCorrect = opt.id === 'B';
                          
                          let optStyle = 'border-neutral-200 bg-white hover:bg-neutral-50';
                          if (selectedOption !== null) {
                            if (isSelected) {
                              optStyle = isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-none animate-pulse' : 'border-rose-500 bg-rose-50 text-rose-950 shadow-none';
                            } else if (isCorrect) {
                              optStyle = 'border-emerald-500 bg-emerald-50/50';
                            }
                          }

                          return (
                            <button
                              key={opt.id}
                              disabled={selectedOption !== null}
                              onClick={() => setSelectedOption(opt.id)}
                              className={`w-full text-left p-3 border-2 font-sans text-xs flex items-start gap-3 transition-all cursor-pointer ${optStyle}`}
                            >
                              <span className={`w-5 h-5 shrink-0 rounded-none border border-black font-mono text-[10px] font-bold flex items-center justify-center ${
                                isSelected 
                                  ? (isCorrect ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600')
                                  : 'bg-neutral-150 text-neutral-700'
                              }`}>
                                {opt.id}
                              </span>
                              <span className="leading-relaxed">{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Question Feedback Box */}
                      {selectedOption !== null && (
                        <div className={`p-4 border-2 font-sans text-xs space-y-3 ${
                          selectedOption === 'B' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-rose-300 bg-rose-50 text-rose-900'
                        }`}>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-[10px] uppercase">
                            <span>RESULTADO COGNITIVO:</span>
                            {selectedOption === 'B' ? (
                              <span className="text-emerald-700">★ RESPOSTA CORRETA (ALT. B)</span>
                            ) : (
                              <span className="text-rose-700">✗ VOCÊ MARCOU {selectedOption} (INCORRETA)</span>
                            )}
                          </div>
                          <p className="leading-relaxed text-[11px]">
                            {selectedOption === 'B' 
                              ? 'Correto! Em homens jovens com escore de Alvarado ≥ 7 (neste caso, 8), a probabilidade de apendicite aguda é altíssima. O diagnóstico é eminentemente clínico e a conduta preconizada é o encaminhamento direto para apendicectomia.'
                              : 'Revisão diagnóstica: A resposta correta é a B. Para homens jovens com quadro clínico típico de Alvarado alto, exames de imagem adicionais (Opção C) atrasam o tratamento e não mudam a conduta, aumentando as chances de perfuração cecal.'
                            }
                          </p>

                          {/* Interactive Mentor IA Widget integrated right under the feedback */}
                          <div className="pt-3 border-t border-dashed border-[#141414]/15 mt-3 space-y-2 text-left">
                            <span className="font-mono text-[8.5px] uppercase text-indigo-850 block font-extrabold">
                              🧠 MENTOR IA INTEGRADO: ESCLAREÇA SUAS DÚVIDAS DO CASO
                            </span>
                            
                            {/* Preset dúvida prompts */}
                            {!mentorQuestion && !isMentorLoading && (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => handleSimulatedMentorPrompt('tc')}
                                  className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold tracking-tight rounded-none cursor-pointer flex items-center gap-1"
                                >
                                  💬 Perguntar ao Mentor: "Por que a Tomografia não é indicada?"
                                </button>
                                <button
                                  onClick={() => handleSimulatedMentorPrompt('ab')}
                                  className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold tracking-tight rounded-none cursor-pointer flex items-center gap-1"
                                >
                                  💬 Perguntar ao Mentor: "Qual o antibiótico profilático padrão?"
                                </button>
                              </div>
                            )}

                            {/* Simulated Mentor Loading */}
                            {isMentorLoading && (
                              <div className="flex items-center gap-2 py-1 font-mono text-[10px] text-indigo-600 font-bold">
                                <span className="animate-bounce">●</span>
                                <span className="animate-bounce [animation-delay:0.2s]">●</span>
                                <span className="animate-bounce [animation-delay:0.4s]">●</span>
                                <span>Mentor IA está analisando diretrizes médicas...</span>
                              </div>
                            )}

                            {/* Simulated Mentor Response */}
                            {mentorQuestion && (
                              <div className="bg-white border border-[#141414]/10 p-3 rounded-none space-y-1.5">
                                <div className="text-[10px] font-mono text-neutral-400 font-bold flex justify-between">
                                  <span>VOCÊ PERGUNTOU:</span>
                                  <button onClick={() => { setMentorQuestion(null); setMentorResponse(null); }} className="text-rose-600 underline hover:text-rose-800">Fechar</button>
                                </div>
                                <p className="font-mono text-[10px] text-neutral-700 italic">"{mentorQuestion}"</p>
                                
                                {mentorResponse && (
                                  <div className="pt-2 border-t border-dashed border-neutral-100 space-y-1">
                                    <span className="font-mono text-[8.5px] text-indigo-750 font-bold block">RESPOSTA DO MENTOR IA:</span>
                                    <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">{mentorResponse}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="pt-1">
                            <button
                              onClick={() => { setSelectedOption(null); setMentorQuestion(null); setMentorResponse(null); }}
                              className="text-[9.5px] font-mono uppercase tracking-wider font-bold underline text-neutral-500 hover:text-black cursor-pointer block mt-1"
                            >
                              Resetar Questão
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeDemoTab === 'flashcards' && (
                    <div className="space-y-4 text-neutral-800 py-4 text-center">
                      {/* Current simulated card index deck */}
                      <div className="max-w-md mx-auto bg-white border-2 border-[#141414] p-6 shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] rounded-none space-y-6 min-h-[180px] flex flex-col justify-between">
                        
                        <div className="space-y-2">
                          <span className="font-mono text-[8px] text-amber-800 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 uppercase tracking-widest">
                            FLASHCARD DE RECALL • {flashcardStep + 1} DE 3
                          </span>
                          
                          <div className="font-serif italic text-base sm:text-lg font-bold text-neutral-900 px-2 py-4">
                            {
                              [
                                '"Qual é o principal patógeno associado à apendicite aguda por obstrução do apêndice?"',
                                '"Qual o sinal semiológico caracterizado por dor na fossa ilíaca direita à palpação profunda da fossa ilíaca esquerda?"',
                                '"Qual a tríade clássica do diagnóstico de gravidez ectópica rota?"'
                              ][flashcardStep]
                            }
                          </div>
                        </div>

                        {/* Card flip side */}
                        {!showAnswer ? (
                          <button
                            onClick={() => setShowAnswer(true)}
                            className="w-full text-center py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white font-mono text-[10px] uppercase font-bold tracking-widest cursor-pointer shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_rgba(20,20,20,1)] transition-all"
                          >
                            Mostrar Resposta (Revelar Verso)
                          </button>
                        ) : (
                          <div className="space-y-4 pt-2 border-t border-dashed border-[#141414]/15">
                            <div className="font-sans text-xs font-bold text-emerald-850 bg-emerald-50 border border-emerald-150 p-3 leading-relaxed">
                              {
                                [
                                  'Bacteroides fragilis (anaeróbio predominante) e Escherichia coli (gram-negativo).',
                                  'Sinal de Rovsing (indica peritonite ou apendicite aguda devido ao deslocamento do gás retrógrado no cólon em direção ao ceco).',
                                  'Dor abdominal súbita intensa, atraso menstrual (amenorreia) e sangramento vaginal escasso.'
                                ][flashcardStep]
                              }
                            </div>

                            {/* SRS Rating Buttons */}
                            <div className="space-y-1.5 text-left">
                              <span className="font-mono text-[8px] text-neutral-450 uppercase tracking-widest block font-bold text-center">COMO FOI SUA TAXA DE RECALL?</span>
                              <div className="grid grid-cols-3 gap-2">
                                <button
                                  onClick={() => {
                                    setFlashcardStep((prev) => (prev + 1) % 3);
                                    setShowAnswer(false);
                                  }}
                                  className="py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-mono text-[8.5px] font-bold uppercase cursor-pointer"
                                >
                                  Errei (1 dia)
                                </button>
                                <button
                                  onClick={() => {
                                    setFlashcardStep((prev) => (prev + 1) % 3);
                                    setShowAnswer(false);
                                  }}
                                  className="py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 font-mono text-[8.5px] font-bold uppercase cursor-pointer"
                                >
                                  Bom (4 dias)
                                </button>
                                <button
                                  onClick={() => {
                                    setFlashcardStep((prev) => (prev + 1) % 3);
                                    setShowAnswer(false);
                                  }}
                                  className="py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-mono text-[8.5px] font-bold uppercase cursor-pointer"
                                >
                                  Fácil (7 dias)
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mockup Footer */}
                <div className="bg-neutral-50 px-4 py-2 border-t border-[#141414] flex items-center justify-between font-mono text-[8px] text-neutral-400 font-bold select-none">
                  <span>● STATUS: PRONTO PARA USO CLÍNICO</span>
                  <span className="text-emerald-700 animate-pulse">● CONECTADO COM REPETIÇÃO ESPAÇADA</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

      {/* 🚀 COMPELING PROPAGANDA SECTION FOR RESUMOS AND QUESTÕES */}
      <section className="py-20 sm:py-28 bg-[#F5F4F0] border-t-2 border-b-2 border-[#141414] px-4 sm:px-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-y-12 translate-x-12"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 translate-y-12 -translate-x-12"></div>
        
        <div className="max-w-7xl mx-auto space-y-16 relative z-10">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-widest font-black text-emerald-850 bg-emerald-50 border border-emerald-250 px-3 py-1 inline-block">
              POR QUE SOMOS DIFERENTES?
            </span>
            <h2 className="font-serif italic text-3xl sm:text-5xl font-black text-[#141414] tracking-tight leading-tight">
              Estudo Médico de Elite: O que torna o Med<span className="text-emerald-700">Internato</span> incomparável?
            </h2>
            <p className="text-neutral-600 text-xs sm:text-base font-sans max-w-2xl mx-auto leading-relaxed">
              Desenvolvemos uma engenharia de aprendizado clínico projetada especificamente para quem não tem tempo a perder. Veja como nossas ferramentas resolvem suas maiores dores na faculdade e nas provas de residência.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-stretch">
            
            {/* 📚 DIFFERENTIALS: RESUMOS */}
            <div className="bg-white border-2 border-[#141414] p-6 sm:p-10 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 border-2 border-emerald-600 rounded-none flex items-center justify-center font-bold text-emerald-800 shrink-0">
                    <FileText className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-800 font-bold block">PRESCRITIVO & CLÍNICO</span>
                    <h3 className="font-serif italic text-2xl font-extrabold text-[#141414]">1. Resumos de Conduta de Beira de Leito</h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-sans">
                  Esqueça resumos teóricos enfadonhos de 50 páginas. Nossos resumos estruturados por IA entregam <strong className="text-neutral-900">condutas médicas resolutivas imediatas</strong> baseadas estritamente nas diretrizes brasileiras mais recentes (Ministério da Saúde, SBC, SBP, FEBRASGO).
                </p>

                <div className="space-y-3.5 pt-2">
                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-1.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1A1A1A] font-mono uppercase">🚨 Alertas de Plantão & Urgência</h4>
                      <p className="text-xs text-neutral-500 font-sans mt-0.5 leading-relaxed">Destaques visuais vermelhos sinalizando condutas críticas para salvar lives e não cometer erros na emergência ou na enfermaria.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-1.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1A1A1A] font-mono uppercase">🎯 Regionalização Automatizada por IA</h4>
                      <p className="text-xs text-neutral-550 font-sans mt-0.5 leading-relaxed">Nossa tecnologia analisa sua região alvo (ex: Centro-Oeste, Paulistas) e destaca no resumo as particularidades epidemiológicas e de preferência de exames que as bancas locais adoram cobrar.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-1.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1A1A1A] font-mono uppercase">💊 Prescrição Prática e Doses</h4>
                      <p className="text-xs text-neutral-550 font-sans mt-0.5 leading-relaxed">Modelos de prescrição rápida e cálculo exato de doses beira de leito para facilitar suas rotações de internato.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-dashed border-stone-200 pt-6">
                <div className="bg-emerald-50/50 border border-emerald-600/10 p-3.5 rounded-none flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-emerald-800 font-bold font-mono uppercase">Diferencial Exclusivo</span>
                    <p className="text-[11px] text-stone-600 italic">"Gere resumos personalizados para qualquer que seja sua dúvida clínica de enfermaria."</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-800 font-mono text-[9px] uppercase border border-emerald-200 rounded-none font-bold">100% IA Ativa</span>
                </div>
              </div>
            </div>

            {/* 📝 DIFFERENTIALS: QUESTÕES */}
            <div className="bg-white border-2 border-[#141414] p-6 sm:p-10 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 border-2 border-indigo-600 rounded-none flex items-center justify-center font-bold text-indigo-850 shrink-0">
                    <ListChecks className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-800 font-bold block">ALTA RECORRÊNCIA</span>
                    <h3 className="font-serif italic text-2xl font-extrabold text-[#141414]">2. Questões Comentadas Alternativa por Alternativa</h3>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-sans">
                  Não se limite a gabaritos secos de uma linha. Nosso simulador traz as <strong className="text-neutral-900">questões reais das provas mais recentes</strong> de residência brasileira comentadas de forma minuciosa por IA, ensinando a malícia das bancas.
                </p>

                <div className="space-y-3.5 pt-2">
                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1A1A1A] font-mono uppercase">🕵️ A Desconstrução das Pegadinhas</h4>
                      <p className="text-xs text-neutral-550 font-sans mt-0.5 leading-relaxed">Nossa tecnologia revela qual pegadinha de redação ou distrator inteligente a banca incorporou no enunciado que costuma induzir os candidatos ao erro.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1A1A1A] font-mono uppercase">📊 Estatísticas de Incidência Regional</h4>
                      <p className="text-xs text-neutral-550 font-sans mt-0.5 leading-relaxed">Veja em tempo real o termômetro de calor do tema estudado e quantas vezes ele caiu nas bancas do Brasil e da sua região.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1A1A1A] font-mono uppercase">🔄 Sincronia de Recall com o MedRevise</h4>
                      <p className="text-xs text-neutral-550 font-sans mt-0.5 leading-relaxed">Sempre que você resolve questões no MedInternato, seus erros e acertos alimentam de forma automática o MedRevise, agendando revisões e flashcards para blindar sua memorização.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-dashed border-stone-200 pt-6">
                <div className="bg-indigo-50/50 border border-indigo-600/10 p-3.5 rounded-none flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-indigo-800 font-bold font-mono uppercase">Garantia Cognitiva</span>
                    <p className="text-[11px] text-stone-600 italic">"Estude de forma ativa com a segurança de que o que você errar será revisado no tempo correto."</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-800 font-mono text-[9px] uppercase border border-indigo-200 rounded-none font-bold">Sincronia SRS</span>
                </div>
              </div>
            </div>

          </div>

          {/* Symmetrical Bento Callout for Regions */}
          <div className="border-2 border-[#141414] bg-white p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#D44E3D] font-bold block">⚡ EXCLUSIVIDADE MEDINTERNATO</span>
              <h3 className="font-serif italic text-xl sm:text-2xl font-bold text-neutral-900">Seu Planejamento Inteligente calibrado por Região</h3>
              <p className="text-xs text-neutral-500 font-sans max-w-2xl">
                Seja para o <strong>Centro-Oeste</strong> (UFG, UnB, SES-DF, SES-GO), as grandes bancas <strong>Paulistas</strong> (USP, UNICAMP, SUS-SP) ou provas <strong>Nacionais</strong> (ENARE, AMRIGS), nosso algoritmo recalibra o peso e a prioridade das matérias do seu cronograma para maximizar sua nota.
              </p>
            </div>
            <button
              onClick={onLogin}
              className="px-6 py-3 bg-[#141414] hover:bg-neutral-850 text-[#E4E3E0] font-mono text-xs font-bold uppercase tracking-wider shrink-0 shadow-[4px_4px_0px_0px_rgba(20,20,20,0.15)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer rounded-none border-transparent"
            >
              Começar Estudos Inteligentes
            </button>
          </div>

        </div>
      </section>

      {/* Pricing comparison / contraction panel */}
      <section className="py-16 sm:py-24 bg-neutral-100 border-t-2 border-[#141414] px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-14">
          
          <div className="text-center max-w-xl mx-auto space-y-3">
            <span className="font-mono text-[9px] uppercase tracking-widest text-indigo-600 font-bold">Faturamento Transparente & Sem Pegadinhas</span>
            <h2 className="font-serif italic text-3xl sm:text-4xl font-extrabold text-[#141414]">
              Planos desenhados para cada fase da sua jornada
            </h2>
            <p className="text-neutral-600 text-xs sm:text-sm font-sans max-w-lg mx-auto">
              Sem taxas escondidas ou cláusulas de fidelização. Escolha a modalidade ideal e troque de plano quando quiser.
            </p>
          </div>

          {/* Detailed Plan Explanatory Cards Grid */}
          <div className="space-y-6 pt-2">
            <div className="text-center space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-indigo-600 font-bold">Acesso na Prática • Vantagens e Desvantagens</span>
              <h3 className="font-serif italic text-2xl sm:text-3xl font-extrabold text-[#141414]">
                Entenda o que você terá em mãos na prática
              </h3>
              <p className="text-xs text-neutral-500 max-w-lg mx-auto font-sans">
                Confira a visão clara do dia a dia, pontos fortes e restrições de cada opção.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              
              {/* PLAN 1: GRÁTIS */}
              <div className="bg-white border-2 border-[#141414] p-5 sm:p-6 shadow-[5px_5px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-neutral-500 block">Gratuito</span>
                      <h4 className="font-serif italic text-xl font-extrabold text-[#141414]">Plano Grátis</h4>
                    </div>
                    <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 font-mono text-[9px] font-bold border border-neutral-300">
                      R$ 0,00
                    </span>
                  </div>

                  {/* Acesso na prática */}
                  <div className="space-y-1.5">
                    <span className="font-mono text-[9px] uppercase font-bold text-neutral-500 block">Acesso na prática:</span>
                    <p className="text-xs text-neutral-700 leading-relaxed font-sans bg-neutral-50 p-2.5 border border-neutral-200">
                      Entrada no ecossistema MedRevise para testar o algoritmo da curva de esquecimento com até 3 disciplinas e 10 requisições diárias de IA.
                    </p>
                  </div>

                  {/* Vantagens */}
                  <div className="space-y-2">
                    <span className="font-mono text-[9px] uppercase font-bold text-emerald-800 block">Vantagens:</span>
                    <ul className="space-y-1.5 text-xs text-neutral-700 font-sans">
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>100% gratuito, sem exigir cartão de crédito.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Acesso livre no tempo para conhecer a metodologia.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Cálculo básico da curva de esquecimento (Ebbinghaus).</span>
                      </li>
                    </ul>
                  </div>

                  {/* Desvantagens */}
                  <div className="space-y-2 pt-1 border-t border-dashed border-neutral-200">
                    <span className="font-mono text-[9px] uppercase font-bold text-rose-700 block">Desvantagens:</span>
                    <ul className="space-y-1.5 text-xs text-neutral-600 font-sans">
                      <li className="flex items-start gap-1.5">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>Limite estrito de até 3 matérias cadastradas.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>Apenas 10 requisições de IA por dia.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>Sem banco de questões nem Mentor IA de conduta.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={onLogin}
                  className="w-full py-2.5 bg-[#141414] hover:bg-neutral-800 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer text-center"
                >
                  Entrar Grátis
                </button>
              </div>

              {/* PLAN 2: MEDREVISE PRO */}
              <div className="bg-white border-2 border-[#141414] p-5 sm:p-6 shadow-[5px_5px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-blue-800 block">Teoria & SRS</span>
                      <h4 className="font-serif italic text-xl font-extrabold text-[#141414]">MedRevise Pro</h4>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-900 font-mono text-[10px] font-bold border border-blue-200">
                      R$ 19,90/mês
                    </span>
                  </div>

                  {/* Acesso na prática */}
                  <div className="space-y-1.5">
                    <span className="font-mono text-[9px] uppercase font-bold text-blue-800 block">Acesso na prática:</span>
                    <p className="text-xs text-neutral-700 leading-relaxed font-sans bg-blue-50/40 p-2.5 border border-blue-100">
                      Organização teórica ilimitada de todas as matérias da faculdade, revisões agendadas pelo algoritmo SRS e 10 req/dia de IA (mesmo limite do plano Gratuito).
                    </p>
                  </div>

                  {/* Vantagens */}
                  <div className="space-y-2">
                    <span className="font-mono text-[9px] uppercase font-bold text-emerald-800 block">Vantagens:</span>
                    <ul className="space-y-1.5 text-xs text-neutral-700 font-sans">
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Matérias e disciplinas sem limite de cadastro.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>10 requisições diárias de IA (igual ao plano Gratuito).</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Curva de esquecimento e estatísticas avançadas.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Desvantagens */}
                  <div className="space-y-2 pt-1 border-t border-dashed border-neutral-200">
                    <span className="font-mono text-[9px] uppercase font-bold text-rose-700 block">Desvantagens:</span>
                    <ul className="space-y-1.5 text-xs text-neutral-600 font-sans">
                      <li className="flex items-start gap-1.5">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>Não inclui banco de questões do MedInternato.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>Sem acesso ao Mentor de Conduta IA de beira de leito.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={onLogin}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] border border-black transition-all cursor-pointer text-center"
                >
                  Assinar Pro (R$ 19,90)
                </button>
              </div>

              {/* PLAN 3: MEDINTERNATO PREMIUM */}
              <div className="bg-white border-2 border-[#141414] p-5 sm:p-6 shadow-[5px_5px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-emerald-800 block">Prática Clínica</span>
                      <h4 className="font-serif italic text-xl font-extrabold text-[#141414]">Internato Premium</h4>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-900 font-mono text-[10px] font-bold border border-emerald-200">
                      R$ 39,90/mês
                    </span>
                  </div>

                  {/* Acesso na prática */}
                  <div className="space-y-1.5">
                    <span className="font-mono text-[9px] uppercase font-bold text-emerald-800 block">Acesso na prática:</span>
                    <p className="text-xs text-neutral-700 leading-relaxed font-sans bg-emerald-50/40 p-2.5 border border-emerald-100">
                      Foco na simulação prática: banco de questões comentadas alternativa por alternativa, Mentor IA para condutas em plantões e 200 req/dia.
                    </p>
                  </div>

                  {/* Vantagens */}
                  <div className="space-y-2">
                    <span className="font-mono text-[9px] uppercase font-bold text-emerald-800 block">Vantagens:</span>
                    <ul className="space-y-1.5 text-xs text-neutral-700 font-sans">
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Banco de questões reais de residência com comentários.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Mentor de Conduta IA ativo para dúvidas em tempo real.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Organização por semestres (S1-S12) + 200 req/dia.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Desvantagens */}
                  <div className="space-y-2 pt-1 border-t border-dashed border-neutral-200">
                    <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-rose-700 block">Desvantagens:</span>
                    <ul className="space-y-1.5 text-xs text-neutral-600 font-sans">
                      <li className="flex items-start gap-1.5">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>Não inclui a gestão teórica ilimitada do MedRevise Pro.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>Por R$ 10,00 adicionais o Combo Ouro unifica tudo.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={onLogin}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] border border-black transition-all cursor-pointer text-center"
                >
                  Assinar Premium (R$ 39,90)
                </button>
              </div>

              {/* PLAN 4: COMBO OURO (HIGHLIGHTED) */}
              <div className="bg-[#141414] text-white border-2 border-amber-500 p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(245,158,11,1)] flex flex-col justify-between space-y-6 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 text-neutral-950 font-mono text-[9px] font-black uppercase tracking-widest border border-amber-300 whitespace-nowrap shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  👑 RECOMENDADO & COMPLETO
                </div>

                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-amber-400 block">Acesso Unificado Total</span>
                      <h4 className="font-serif italic text-xl font-extrabold text-amber-400">Combo Ouro 👑</h4>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold border border-amber-500/40">
                      R$ 49,90/mês
                    </span>
                  </div>

                  {/* Acesso na prática */}
                  <div className="space-y-1.5">
                    <span className="font-mono text-[9px] uppercase font-bold text-amber-400 block">Acesso na prática:</span>
                    <p className="text-xs text-neutral-300 leading-relaxed font-sans bg-neutral-900/90 p-2.5 border border-amber-500/30">
                      Experiência 100% unificada: MedRevise Pro + MedInternato Premium integrados, com 250 req/dia de IA e Cronograma Regional.
                    </p>
                  </div>

                  {/* Vantagens */}
                  <div className="space-y-2">
                    <span className="font-mono text-[9px] uppercase font-bold text-amber-400 block">Vantagens:</span>
                    <ul className="space-y-1.5 text-xs text-neutral-200 font-sans">
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>Acesso ilimitado às duas plataformas em um só lugar.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>Sincronia automática: erros em questões viram revisões SRS.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>Maior cota de IA (250 req/dia) + Cronograma Regional.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>Maior economia financeira em relação às assinaturas avulsas.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Desvantagens */}
                  <div className="space-y-2 pt-1 border-t border-dashed border-neutral-800">
                    <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-amber-300/80 block">Desvantagens:</span>
                    <ul className="space-y-1.5 text-xs text-neutral-400 font-sans">
                      <li className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-0.5" />
                        <span>Valor mensal um pouco superior aos avulsos (porém com o dobro de valor).</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={onLogin}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-mono text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(245,158,11,0.5)] border border-amber-400 transition-all cursor-pointer text-center"
                >
                  Assinar Combo (R$ 49,90) 👑
                </button>
              </div>

            </div>
          </div>

          {/* Master Comparison Table */}
          <div className="space-y-10 pt-6">
            <div className="text-center space-y-2 pt-6 border-t border-dashed border-neutral-300">
              <span className="font-mono text-[10px] uppercase tracking-widest text-indigo-600 font-black">Matriz Técnica de Recursos</span>
              <h3 className="font-serif italic text-3xl font-extrabold text-[#141414]">Comparativo Detalhado de Funcionalidades</h3>
              <p className="text-xs text-neutral-500 max-w-lg mx-auto font-sans">Compare as capacidades técnicas de cada modalidade lado a lado.</p>
            </div>

            <div className="border-2 border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-neutral-50 border-b-2 border-[#141414]">
                      <th className="p-4 font-mono text-[10px] uppercase tracking-wider font-bold text-neutral-600 w-1/3">Recurso / Funcionalidade</th>
                      <th className="p-4 font-mono text-[10px] uppercase tracking-wider font-bold text-neutral-600 text-center bg-neutral-100/30">Grátis</th>
                      <th className="p-4 font-mono text-[10px] uppercase tracking-wider font-bold text-neutral-600 text-center text-blue-800 bg-blue-50/20">MedRevise Pro</th>
                      <th className="p-4 font-mono text-[10px] uppercase tracking-wider font-bold text-neutral-600 text-center text-emerald-800 bg-emerald-50/20">Internato Premium</th>
                      <th className="p-4 font-mono text-[10px] uppercase tracking-wider text-center bg-[#141414] text-[#E4E3E0] font-black">👑 Combo Ouro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/10 font-sans text-xs">
                    <tr>
                      <td className="p-4 font-serif italic font-bold text-neutral-900 text-sm">Preço Mensal</td>
                      <td className="p-4 text-center font-mono font-bold bg-neutral-50/30 text-neutral-600 text-sm">R$ 0,00</td>
                      <td className="p-4 text-center font-mono font-bold text-blue-900 bg-blue-50/10 text-sm">R$ 19,90</td>
                      <td className="p-4 text-center font-mono font-bold text-emerald-900 bg-emerald-50/10 text-sm">R$ 39,90</td>
                      <td className="p-4 text-center font-mono font-bold text-amber-400 bg-[#141414] text-sm">R$ 49,90</td>
                    </tr>
                    <tr className="bg-amber-50/10">
                      <td className="p-4">
                        <span className="block font-bold text-neutral-850">Créditos de IA por Dia</span>
                        <span className="block text-[10px] text-neutral-500">Limite de requisições de Inteligência Artificial para resumos, discussões e perguntas</span>
                      </td>
                      <td className="p-4 text-center font-mono text-neutral-500 bg-neutral-50/30 font-bold">10 requisições</td>
                      <td className="p-4 text-center font-mono font-bold text-blue-900 bg-blue-50/10">10 requisições (Grátis)</td>
                      <td className="p-4 text-center font-mono font-bold text-emerald-900 bg-emerald-50/10">200 requisições</td>
                      <td className="p-4 text-center font-mono font-bold text-amber-500 bg-[#141414]">250 requisições</td>
                    </tr>
                    <tr>
                      <td className="p-4">
                        <span className="block font-bold text-neutral-850">Cadastro de Disciplinas</span>
                        <span className="block text-[10px] text-neutral-500">Número máximo de matérias gerenciáveis</span>
                      </td>
                      <td className="p-4 text-center font-mono text-neutral-500 bg-neutral-50/30">Até 3</td>
                      <td className="p-4 text-center font-mono font-bold text-green-700 bg-blue-50/10">Ilimitado</td>
                      <td className="p-4 text-center text-neutral-400 bg-emerald-50/10">—</td>
                      <td className="p-4 text-center font-mono font-bold text-amber-400 bg-[#141414]">Ilimitado</td>
                    </tr>
                    <tr>
                      <td className="p-4">
                        <span className="block font-bold text-neutral-850">Revisão Espaçada (Ebbinghaus)</span>
                        <span className="block text-[10px] text-neutral-500">Algoritmo matemático de cálculo da curva de esquecimento</span>
                      </td>
                      <td className="p-4 text-center text-neutral-500 bg-neutral-50/30">Básica</td>
                      <td className="p-4 text-center font-bold text-green-700 bg-blue-50/10">✓ Completa</td>
                      <td className="p-4 text-center text-neutral-400 bg-emerald-50/10">—</td>
                      <td className="p-4 text-center font-bold text-amber-400 bg-[#141414]">✓ Completa</td>
                    </tr>
                    <tr>
                      <td className="p-4">
                        <span className="block font-bold text-neutral-850">Banco de Questões Clínicas</span>
                        <span className="block text-[10px] text-neutral-500">Questões de provas reais com comentários detalhados baseados em evidências</span>
                      </td>
                      <td className="p-4 text-center text-red-500 bg-neutral-50/30">✗</td>
                      <td className="p-4 text-center text-red-500 bg-blue-50/10">✗</td>
                      <td className="p-4 text-center font-bold text-green-700 bg-emerald-50/10">✓ Completo</td>
                      <td className="p-4 text-center font-bold text-amber-400 bg-[#141414]">✓ Completo</td>
                    </tr>
                    <tr>
                      <td className="p-4">
                        <span className="block font-bold text-neutral-850">Mentor de Conduta Clínica IA</span>
                        <span className="block text-[10px] text-neutral-500">Orientação médica e discussão de casos práticos à beira do leito</span>
                      </td>
                      <td className="p-4 text-center text-red-500 bg-neutral-50/30">✗</td>
                      <td className="p-4 text-center text-red-500 bg-blue-50/10">✗</td>
                      <td className="p-4 text-center font-bold text-green-700 bg-emerald-50/10">✓ Ativo</td>
                      <td className="p-4 text-center font-bold text-amber-400 bg-[#141414]">✓ Ativo</td>
                    </tr>
                    <tr>
                      <td className="p-4">
                        <span className="block font-bold text-neutral-850">Escolha de Provas & Hospitais de Foco</span>
                        <span className="block text-[10px] text-neutral-500">Seleção personalizada de provas de residência de foco para direcionar o aprendizado</span>
                      </td>
                      <td className="p-4 text-center text-red-500 bg-neutral-50/30">✗</td>
                      <td className="p-4 text-center font-bold text-green-700 bg-blue-50/10">✓ Ativo (Foco Livre)</td>
                      <td className="p-4 text-center font-bold text-green-700 bg-emerald-50/10">✓ Ativo (Foco Livre)</td>
                      <td className="p-4 text-center font-bold text-amber-400 bg-[#141414]">✓ Unificado</td>
                    </tr>
                    <tr>
                      <td className="p-4">
                        <span className="block font-bold text-neutral-850">Geração de Flashcards com IA</span>
                        <span className="block text-[10px] text-neutral-500">Mapeamento automático de conceitos em cartões de memorização espaçada</span>
                      </td>
                      <td className="p-4 text-center text-red-500 bg-neutral-50/30">✗</td>
                      <td className="p-4 text-center text-red-500 bg-blue-50/10">✗</td>
                      <td className="p-4 text-center font-bold text-green-700 bg-emerald-50/10">✓ Ilimitado</td>
                      <td className="p-4 text-center font-bold text-amber-400 bg-[#141414]">✓ Ilimitado</td>
                    </tr>
                    <tr>
                      <td className="p-4">
                        <span className="block font-bold text-neutral-850">Gráficos de Evolução e Metas</span>
                        <span className="block text-[10px] text-neutral-500">Acompanhamento estatístico e análise científica de memorização</span>
                      </td>
                      <td className="p-4 text-center text-neutral-500 bg-neutral-50/30">Básico</td>
                      <td className="p-4 text-center font-bold text-green-700 bg-blue-50/10">✓ Avançado</td>
                      <td className="p-4 text-center font-bold text-green-700 bg-emerald-50/10">✓ Avançado</td>
                      <td className="p-4 text-center font-bold text-amber-400 bg-[#141414]">✓ Avançado Unificado</td>
                    </tr>
                    {/* MASTER ACTION CENTER ROW INSIDE THE TABLE */}
                    <tr className="bg-neutral-50 border-t-2 border-[#141414]">
                      <td className="p-4 font-mono text-[10px] uppercase font-black text-neutral-800">Pronto para começar?</td>
                      <td className="p-4 text-center bg-neutral-100/40">
                        <button
                          onClick={onLogin}
                          className="w-full py-2 bg-white hover:bg-neutral-100 text-neutral-800 font-mono text-[9px] font-bold uppercase tracking-wider border border-[#141414] shadow-[1.5px_1.5px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer text-center"
                        >
                          Entrar Grátis
                        </button>
                      </td>
                      <td className="p-4 text-center bg-blue-50/10">
                        <button
                          onClick={onLogin}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-[9px] font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(20,20,20,1)] border border-black transition-all cursor-pointer text-center"
                        >
                          Assinar Pro (R$ 19,90)
                        </button>
                      </td>
                      <td className="p-4 text-center bg-emerald-50/10">
                        <button
                          onClick={onLogin}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[9px] font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(20,20,20,1)] border border-black transition-all cursor-pointer text-center"
                        >
                          Assinar Premium (R$ 39,90)
                        </button>
                      </td>
                      <td className="p-4 text-center bg-[#141414]">
                        <button
                          onClick={onLogin}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-mono text-[9px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(245,158,11,1)] border border-amber-400 transition-all cursor-pointer text-center"
                        >
                          Assinar Combo (R$ 49,90) 👑
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-8 space-y-10">
        <div className="text-center space-y-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#141414]/50">Transparência jurídica</span>
          <h2 className="font-serif italic text-3xl font-extrabold text-[#141414]">Perguntas Frequentes FAQ</h2>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "Por que cobramos esses valores (R$ 19,90, R$ 39,90 e R$ 49,90)?",
              a: "Nossos planos são desenhados de forma transparente para cobrir os custos operacionais do nosso robusto motor de Inteligência Artificial (Gemini API) e do banco de dados na nuvem. Com a inclusão da plataforma MedInternato, oferecemos agora o MedRevise Pro por R$ 19,90/mês, o MedInternato Premium por R$ 39,90/mês e o Combo Ouro unificado por R$ 49,90/mês. Isso nos permite manter um ambiente 100% livre de anúncios, sem vender seus dados e em constante evolução acadêmica."
            },
            {
              q: "Posso utilizar a versão gratuita por quanto tempo?",
              a: "Para sempre! O plano Gratuito foi projetado para estudantes que possuem editais menores e pontuais. Você pode cadastrar até 3 disciplinas completas e revisar sem custos por tempo indefinido."
            },
            {
              q: "Como funciona a garantia e o reembolso?",
              a: "Em estrito alinhamento com a legislação brasileira de defesa do consumidor, oferecemos garantia incondicional de reembolso total dentro de 7 dias da contratação caso você mude de ideia por qualquer motivo."
            },
            {
              q: "O MedRevise é compatível com a LGPD?",
              a: "Sim. Todo o tráfego de dados estatísticos é criptografado por protocolo SSL/TLS, e mantemos rigoroso controle de acesso por políticas ABAC para que suas matérias e dados cadastrais de estudos sejam 100% confidenciais."
            }
          ].map((faq, i) => (
            <div 
              key={i} 
              className="bg-white border border-[#141414] p-5 cursor-pointer shadow-[3px_3px_0px_0px_rgba(20,20,20,0.15)] select-none"
              onClick={() => setActiveFaq(activeFaq === i ? null : i)}
            >
              <div className="flex justify-between items-center gap-4">
                <span className="font-serif italic font-bold text-sm text-neutral-850 sm:text-base">{faq.q}</span>
                <span className="font-mono text-xs opacity-50 shrink-0">{activeFaq === i ? '▲' : '▼'}</span>
              </div>
              <AnimatePresence>
                {activeFaq === i && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    className="overflow-hidden border-t border-dashed border-neutral-200 pt-3"
                  >
                    <p className="text-xs text-neutral-600 leading-relaxed font-sans">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* Custom footer in brutalism style */}
      <footer className="bg-[#141414] text-white/70 py-12 px-4 sm:px-8 border-t-2 border-[#141414] text-xs font-mono">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1 text-center md:text-left">
            <span className="font-serif italic text-lg font-bold text-white block">MedRevise</span>
            <p className="text-[10px] text-neutral-550 uppercase tracking-widest leading-none">O método Hermann Ebbinghaus na ponta dos seus dedos</p>
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            <span 
              onClick={() => setShowLegal('terms')}
              className="hover:underline cursor-pointer block text-[10px]"
            >
              TERMOS DE SERVIÇO
            </span>
            <span className="text-[#E4E3E0]/20">•</span>
            <span 
              onClick={() => setShowLegal('privacy')}
              className="hover:underline cursor-pointer block text-[10px]"
            >
              POLÍTICA DE PRIVACIDADE
            </span>
            <span className="text-[#E4E3E0]/20">•</span>
            <span className="block text-[10px] text-[#E4E3E0]/50 select-none">SÃO PAULO - BRASIL</span>
          </div>
        </div>
      </footer>

      {/* Legal terms overlay modal */}
      <AnimatePresence>
        {showLegal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLegal(null)}
            className="fixed inset-0 bg-[#141414]/75 backdrop-blur-sm z-[100] overflow-y-auto p-4 sm:p-6 md:p-8 flex items-start justify-center cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl mt-4 sm:mt-8 mb-8 cursor-default"
            >
              <LegalTerms initialSection={showLegal} onClose={() => setShowLegal(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
