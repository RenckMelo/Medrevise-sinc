import React, { useEffect, useState } from 'react';
import { 
  X, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw,
  HelpCircle,
  FileText,
  BookOpen,
  Calendar,
  Check,
  Info,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getGlobalUsage, resetSpecialUsage } from '../services/geminiService';
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storageUtils';

interface ProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  status?: string;
  lastError?: string | null;
  requestsToday: number;
  errorsToday: number;
  lastUsed: string | null;
  pricing: string;
  limits: string;
  freeTierStatus: string;
  priorityForSpecialUsers: string;
}

interface StatsResponse {
  providers: {
    groq?: ProviderInfo;
    gemini: ProviderInfo;
  };
  lastActiveProvider: string;
  lastActiveModel: string;
  lastCallTime: string | null;
}

interface AiProviderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export default function AiProviderStatusModal({ isOpen, onClose, userEmail }: AiProviderStatusModalProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [siteUsage, setSiteUsage] = useState<{ count: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredEngine, setPreferredEngine] = useState<string>(() => safeLocalStorageGet('user_preferred_ai_provider') || 'auto');
  
  const [testingBilling, setTestingBilling] = useState(false);
  const [billingTestResult, setBillingTestResult] = useState<{
    success: boolean;
    isPaid: boolean;
    hitRateLimit: boolean;
    successCount: number;
    failureCount: number;
    averageLatencyMs: number;
    diagnosis: string;
    keyResults?: {
      code: string;
      name: string;
      configured: boolean;
      maskedKey: string;
      isPaid: boolean;
      hitRateLimit: boolean;
      successCount: number;
      failureCount: number;
      averageLatencyMs: number;
      diagnosis: string;
    }[];
  } | null>(null);

  const handleTestBilling = async (keyTarget = 'all') => {
    setTestingBilling(true);
    setBillingTestResult(null);
    try {
      const response = await fetch('/api/admin/test-key-billing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: userEmail, keyTarget })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro desconhecido ao testar faturamento.');
      }
      const data = await response.json();
      setBillingTestResult(data);
    } catch (err: any) {
      setBillingTestResult({
        success: false,
        isPaid: false,
        hitRateLimit: false,
        successCount: 0,
        failureCount: 1,
        averageLatencyMs: 0,
        diagnosis: `Falha no teste: ${err.message}`
      });
    } finally {
      setTestingBilling(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, usage] = await Promise.all([
        fetch(`/api/ai-provider-stats?email=${encodeURIComponent(userEmail || '')}`),
        getGlobalUsage().catch(() => ({ count: 0, limit: 3000 }))
      ]);
      if (!res.ok) throw new Error('Falha ao carregar status');
      const data: StatsResponse = await res.json();
      setStats(data);
      if (usage) setSiteUsage(usage);
    } catch (err: any) {
      setError(err.message || 'Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
    const handleCreditsUpdated = () => {
      if (isOpen) fetchStats();
    };
    window.addEventListener('ai-credits-updated', handleCreditsUpdated);
    return () => {
      window.removeEventListener('ai-credits-updated', handleCreditsUpdated);
    };
  }, [isOpen]);

  const handleSelectEngine = async (engineKey: string) => {
    setPreferredEngine(engineKey);
    safeLocalStorageSet('user_preferred_ai_provider', engineKey);
    await fetchStats();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-credits-updated'));
    }
  };

  const handleResetCredits = async () => {
    try {
      setLoading(true);
      await resetSpecialUsage();
      await fetchStats();
    } catch (err: any) {
      setError(err.message || 'Erro ao resetar créditos');
    } finally {
      setLoading(false);
    }
  };

  const normalizedEmail = (userEmail || '').toLowerCase().trim();
  const isSpecialUser = normalizedEmail === 'lucas1renck2melo@gmail.com' || normalizedEmail === 'ysabelleosaraiva@gmail.com' || normalizedEmail === 'yasabelleosaraiva@gmail.com';
  const isOwner = isSpecialUser;

  if (!isOpen || !isSpecialUser) return null;

  // Determine user plan details and Groq quota proportional to plan
  const userLimit = siteUsage?.limit || 10;
  let planName = "Plano Grátis (Visitante)";
  let groqAllowedDaily = 50;
  let groqRPM = 30;
  let planBadgeColor = "bg-stone-100 text-stone-800 border-stone-200";

  if (isSpecialUser || userLimit >= 3000) {
    planName = "Plano VIP / Admin (Acesso Irrestrito)";
    groqAllowedDaily = 14400;
    groqRPM = 30;
    planBadgeColor = "bg-amber-100 text-amber-900 border-amber-300 font-extrabold";
  } else if (userLimit >= 250) {
    planName = "Plano Combo Ouro VIP";
    groqAllowedDaily = 3000;
    groqRPM = 30;
    planBadgeColor = "bg-purple-100 text-purple-900 border-purple-300 font-extrabold";
  } else if (userLimit >= 200) {
    planName = "Plano MedInternato Premium";
    groqAllowedDaily = 1500;
    groqRPM = 30;
    planBadgeColor = "bg-blue-100 text-blue-900 border-blue-300 font-extrabold";
  } else {
    planName = "Plano MedRevise / Grátis (10 cr/dia)";
    groqAllowedDaily = 100;
    groqRPM = 30;
    planBadgeColor = "bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold";
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-[#E2E0D9] relative overflow-hidden my-auto">
        
        {/* Fixed Header */}
        <div className="p-5 sm:p-6 border-b border-[#E2E0D9] bg-white shrink-0 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[#1A1A1A] tracking-tight">
                  Status & Escolha da IA
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Triplo Fallback
                </span>
              </div>
              <p className="text-xs text-[#6E6A62] mt-0.5 font-medium">
                Escolha o motor de IA de sua preferência ou use o roteamento inteligente com custo quantificado por créditos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={loading}
              className="text-xs font-bold gap-1.5 cursor-pointer text-[#6E6A62] border-[#E2E0D9] hover:bg-[#F4F3EF]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">Atualizar</span>
            </Button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#F4F3EF] hover:bg-[#E2E0D9] text-[#6E6A62] flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Container */}
        <div className="p-5 sm:p-8 overflow-y-auto flex-1 space-y-6">

        {/* Live Active Status Banner */}
        {stats && isOwner && (
          <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Último Provedor Ativo no Servidor
                </p>
                <p className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                  {stats.lastActiveProvider} ({stats.lastActiveModel})
                </p>
              </div>
            </div>
            {stats.lastCallTime && (
              <div className="text-right text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                Última chamada: <strong className="text-amber-300">{stats.lastCallTime}</strong>
              </div>
            )}
          </div>
        )}

        {/* User Plan & Site Credits Balance Banner */}
        {siteUsage && (
          <div className="my-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md border border-emerald-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-black shrink-0 border border-emerald-500/30">
                <Zap className="w-5 h-5 fill-emerald-400 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
                    Seu Plano Atual:
                  </p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${planBadgeColor}`}>
                    {planName}
                  </span>
                </div>
                <p className="text-base font-extrabold text-white flex items-center flex-wrap gap-2">
                  <strong className="text-emerald-300 text-lg">
                    {Math.max(0, siteUsage.limit - siteUsage.count)}
                  </strong> / {siteUsage.limit} créditos disponíveis hoje
                  <span className="text-xs text-emerald-200 font-medium flex items-center gap-1.5">
                    ({siteUsage.count} consumidos hoje)
                    {isSpecialUser && (
                      <button
                        onClick={handleResetCredits}
                        disabled={loading}
                        className="ml-2 inline-flex items-center gap-1 text-[10px] bg-amber-500 hover:bg-amber-600 disabled:bg-amber-800 text-slate-950 font-extrabold px-2.5 py-0.5 rounded-md cursor-pointer transition-colors shadow-xs"
                        title="Restaurar cota especial de hoje para 3.000 créditos"
                      >
                        <RotateCcw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
                        Restaurar Saldo
                      </button>
                    )}
                  </span>
                </p>
              </div>
            </div>
            <div className="text-xs text-emerald-200/90 bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-800/80 max-w-xs">
              <span className="font-bold text-white">Importante:</span> Seus créditos são protegidos. Falhas de carregamento ou erros de cota <strong>nunca consomem seus créditos</strong>.
            </div>
          </div>
        )}

        {/* SECTION 1: USER AI ENGINE SELECTOR (EXCLUSIVE FOR SPECIAL USERS) */}
        {isSpecialUser && (
          <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-amber-50/80 via-purple-50/40 to-slate-50 border border-amber-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#1A1A1A] flex items-center gap-2">
                  <Cpu className="w-4.5 h-4.5 text-amber-600" />
                  Painel VIP: Escolha de Chaves & Motores de IA
                </h3>
                <p className="text-xs text-[#6E6A62] mt-0.5 font-medium">
                  Selecione a chave ou motor de sua preferência. O sistema dará prioridade total à sua escolha, mantendo o fallback automático em caso de alta demanda.
                </p>
              </div>
              <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 self-start sm:self-auto uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500" />
                {preferredEngine === 'gemini_key1' ? 'GEMINI CHAVE 1 (PAY-AS-YOU-GO)' :
                 preferredEngine === 'gemini_key2' ? 'GEMINI CHAVE 2 (VIP)' :
                 preferredEngine === 'gemini_key3' ? 'GEMINI CHAVE 3 (VIP)' :
                 preferredEngine === 'groq' ? 'GROQ CLOUD (LPU)' :
                 preferredEngine === 'gemini' ? 'GOOGLE GEMINI (TODAS)' : 'AUTOMÁTICO'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              
              {/* Option 1: Auto */}
              <button
                onClick={() => handleSelectEngine('auto')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  preferredEngine === 'auto'
                    ? 'bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-slate-400/50'
                    : 'bg-white text-[#1A1A1A] border-[#E2E0D9] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    ⚡ Automático (Inteligente)
                  </span>
                  {preferredEngine === 'auto' && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className={`text-[10px] leading-snug ${preferredEngine === 'auto' ? 'text-slate-300' : 'text-[#6E6A62]'}`}>
                  Garante menor tempo de resposta alternando dinamicamente entre todas as chaves e provedores.
                </p>
              </button>

              {/* Option 2: Gemini Key 1 (Pay As You Go / Priority) */}
              <button
                onClick={() => handleSelectEngine('gemini_key1')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  preferredEngine === 'gemini_key1'
                    ? 'bg-amber-950 text-white border-amber-900 shadow-md ring-2 ring-amber-400/60'
                    : 'bg-amber-50/80 text-[#1A1A1A] border-amber-300/80 hover:bg-amber-100/90'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-1 text-amber-900 dark:text-amber-100">
                    🔑 Gemini - Chave 1
                    <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-md uppercase">
                      gemini-3.1-flash-lite
                    </span>
                  </span>
                  {preferredEngine === 'gemini_key1' && <Check className="w-4 h-4 text-amber-300" />}
                </div>
                <p className={`text-[10px] leading-snug ${preferredEngine === 'gemini_key1' ? 'text-amber-200' : 'text-amber-900/80 font-medium'}`}>
                  Chave principal em modo Pay-As-You-Go operando com o modelo <strong>gemini-3.1-flash-lite</strong>.
                </p>
              </button>

              {/* Option 3: Gemini Key 2 */}
              <button
                onClick={() => handleSelectEngine('gemini_key2')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  preferredEngine === 'gemini_key2'
                    ? 'bg-purple-950 text-white border-purple-900 shadow-md ring-2 ring-purple-400/50'
                    : 'bg-white text-[#1A1A1A] border-[#E2E0D9] hover:bg-purple-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    💎 Gemini - Chave 2
                    <span className="text-[9px] bg-purple-200 text-purple-950 font-black px-1.5 py-0.2 rounded-md uppercase">
                      gemini-3.1-flash-lite
                    </span>
                  </span>
                  {preferredEngine === 'gemini_key2' && <Check className="w-4 h-4 text-purple-300" />}
                </div>
                <p className={`text-[10px] leading-snug ${preferredEngine === 'gemini_key2' ? 'text-purple-200' : 'text-[#6E6A62]'}`}>
                  Chave dedicada VIP para chamadas diretas do modelo <strong>gemini-3.1-flash-lite</strong>.
                </p>
              </button>

              {/* Option 4: Gemini Key 3 */}
              <button
                onClick={() => handleSelectEngine('gemini_key3')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  preferredEngine === 'gemini_key3'
                    ? 'bg-blue-950 text-white border-blue-900 shadow-md ring-2 ring-blue-400/50'
                    : 'bg-white text-[#1A1A1A] border-[#E2E0D9] hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    🛡️ Gemini - Chave 3
                    <span className="text-[9px] bg-blue-200 text-blue-950 font-black px-1.5 py-0.2 rounded-md uppercase">
                      gemini-3.1-flash-lite
                    </span>
                  </span>
                  {preferredEngine === 'gemini_key3' && <Check className="w-4 h-4 text-blue-300" />}
                </div>
                <p className={`text-[10px] leading-snug ${preferredEngine === 'gemini_key3' ? 'text-blue-200' : 'text-[#6E6A62]'}`}>
                  Chave reserva VIP com o modelo <strong>gemini-3.1-flash-lite</strong> ativado.
                </p>
              </button>

              {/* Option 5: Groq LPU */}
              <button
                onClick={() => handleSelectEngine('groq')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  preferredEngine === 'groq'
                    ? 'bg-emerald-950 text-white border-emerald-900 shadow-md ring-2 ring-emerald-400/50'
                    : 'bg-white text-[#1A1A1A] border-[#E2E0D9] hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black flex items-center gap-1.5">
                    🚀 Groq LPU (Llama 3.3)
                  </span>
                  {preferredEngine === 'groq' && <Check className="w-4 h-4 text-emerald-300" />}
                </div>
                <p className={`text-[10px] leading-snug ${preferredEngine === 'groq' ? 'text-emerald-200' : 'text-[#6E6A62]'}`}>
                  Incrível velocidade de resposta LPU para resumos e questões clínicas.
                </p>
              </button>

            </div>

            {/* Direct Billing Test Diagnostic Area */}
            <div className="mt-4 pt-4 border-t border-amber-200/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-100/10 p-4 rounded-xl border border-amber-200/40">
                <div className="max-w-xl">
                  <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    🔬 Diagnóstico de Faturamento de Todas as Chaves Gemini
                  </h4>
                  <p className="text-[11px] text-[#6E6A62] mt-1 leading-relaxed">
                    Teste o estresse (18 requisições simultâneas) em todas as suas chaves configuradas (Chave 1, Chave 2 e Chave 3) para verificar se estão operando em modo pago ou gratuito.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    onClick={() => handleTestBilling('all')}
                    disabled={testingBilling}
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    {testingBilling ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Testando...
                      </span>
                    ) : (
                      "Testar Todas"
                    )}
                  </Button>
                  <Button
                    onClick={() => handleTestBilling('key1')}
                    disabled={testingBilling}
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-xs px-2.5 py-2 rounded-xl"
                  >
                    Chave 1
                  </Button>
                  <Button
                    onClick={() => handleTestBilling('key2')}
                    disabled={testingBilling}
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-xs px-2.5 py-2 rounded-xl"
                  >
                    Chave 2
                  </Button>
                  <Button
                    onClick={() => handleTestBilling('key3')}
                    disabled={testingBilling}
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-xs px-2.5 py-2 rounded-xl"
                  >
                    Chave 3
                  </Button>
                  <Button
                    onClick={() => handleTestBilling('groq')}
                    disabled={testingBilling}
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-xs px-2.5 py-2 rounded-xl"
                  >
                    Groq
                  </Button>
                </div>
              </div>

              {billingTestResult && billingTestResult.keyResults && (
                <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  {billingTestResult.keyResults.map((kr) => (
                    <div key={kr.code} className={`p-4 rounded-xl border ${
                      !kr.configured
                        ? 'bg-stone-50 border-stone-200 text-stone-600 opacity-75'
                        : kr.isPaid 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                          : kr.hitRateLimit
                            ? 'bg-amber-50 border-amber-200 text-amber-950'
                            : 'bg-red-50 border-red-200 text-red-950'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {kr.configured ? (
                            kr.isPaid ? (
                              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                            )
                          ) : (
                            <span className="w-4.5 h-4.5 rounded-full bg-stone-300 text-stone-700 text-[10px] flex items-center justify-center font-bold"> - </span>
                          )}
                          <h5 className="text-xs font-black uppercase tracking-wider">
                            {kr.name} ({kr.maskedKey})
                          </h5>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          !kr.configured ? 'bg-stone-200 text-stone-700' : kr.isPaid ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                        }`}>
                          {!kr.configured ? 'Não Configurada' : kr.isPaid ? 'Pago (1.000+ RPM)' : 'Gratuito (15 RPM)'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold leading-relaxed mb-3">
                        {kr.diagnosis}
                      </p>
                      {kr.configured && (
                        <div className="grid grid-cols-3 gap-2 text-[10px] bg-white/85 p-2.5 rounded-lg border border-stone-200/55 font-mono text-center">
                          <div>
                            <span className="block text-[#6E6A62] text-[9px] font-sans font-bold uppercase">Sucessos</span>
                            <strong className="text-emerald-700 font-extrabold text-xs">{kr.successCount}/18</strong>
                          </div>
                          <div>
                            <span className="block text-[#6E6A62] text-[9px] font-sans font-bold uppercase">Falhas (429)</span>
                            <strong className={`font-extrabold text-xs ${kr.failureCount > 0 ? 'text-amber-600' : 'text-stone-500'}`}>{kr.failureCount}</strong>
                          </div>
                          <div>
                            <span className="block text-[#6E6A62] text-[9px] font-sans font-bold uppercase">Latência Média</span>
                            <strong className="text-slate-800 font-extrabold text-xs">{kr.averageLatencyMs}ms</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {billingTestResult && !billingTestResult.keyResults && (
                <div className={`mt-3 p-4 rounded-xl border animate-in slide-in-from-top-2 duration-200 ${
                  billingTestResult.isPaid 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                    : billingTestResult.hitRateLimit
                      ? 'bg-amber-50 border-amber-200 text-amber-950'
                      : 'bg-red-50 border-red-200 text-red-950'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {billingTestResult.isPaid ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                    )}
                    <h5 className="text-xs font-black uppercase tracking-wider">
                      Resultado do Teste: {billingTestResult.isPaid ? 'Chave Ativa em Modo Pago (1.000+ RPM)!' : 'Chave em Modo Gratuito (15 RPM)'}
                    </h5>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed mb-3">
                    {billingTestResult.diagnosis}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-[10px] bg-white/85 p-2.5 rounded-lg border border-stone-200/55 font-mono text-center">
                    <div>
                      <span className="block text-[#6E6A62] text-[9px] font-sans font-bold uppercase">Sucessos</span>
                      <strong className="text-emerald-700 font-extrabold text-xs">{billingTestResult.successCount}/18</strong>
                    </div>
                    <div>
                      <span className="block text-[#6E6A62] text-[9px] font-sans font-bold uppercase">Falhas (429)</span>
                      <strong className={`font-extrabold text-xs ${billingTestResult.failureCount > 0 ? 'text-amber-600' : 'text-stone-500'}`}>{billingTestResult.failureCount}</strong>
                    </div>
                    <div>
                      <span className="block text-[#6E6A62] text-[9px] font-sans font-bold uppercase">Latência Média</span>
                      <strong className="text-slate-800 font-extrabold text-xs">{billingTestResult.averageLatencyMs}ms</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* SECTION 2: QUANTIFIED CREDIT COSTS BREAKDOWN TABLE */}
        <div className="mb-6 p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
              Tabela de Custos em Créditos por Funcionalidade
            </h3>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
              Desconto por Ação Concluída
            </span>
          </div>

          <p className="text-xs text-amber-900/90 mb-4 leading-relaxed font-medium">
            Cada ação de estudo consome créditos do seu limite diário com base no processamento e complexidade do pedido:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            
            {/* Action Item 1 */}
            <div className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-2xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black shrink-0">
                <HelpCircle className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-[#1A1A1A]">Chat / Tira-Dúvidas</h4>
                  <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    1⚡ crédito
                  </span>
                </div>
                <p className="text-[11px] text-[#6E6A62] mt-1">
                  Perguntas diretas, dicas clínicas rápidas e explicações de conduta.
                </p>
              </div>
            </div>

            {/* Action Item 2 */}
            <div className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-2xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-black shrink-0">
                <FileText className="w-4 h-4 text-blue-700" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-[#1A1A1A]">Gerador de Questões</h4>
                  <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    2⚡ créditos
                  </span>
                </div>
                <p className="text-[11px] text-[#6E6A62] mt-1">
                  Casos clínicos inéditos, alternativas no padrão Revalida/ENARE e gabarito comentado.
                </p>
              </div>
            </div>

            {/* Action Item 3 */}
            <div className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-2xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-black shrink-0">
                <BookOpen className="w-4 h-4 text-purple-700" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-[#1A1A1A]">Resumo Padrão</h4>
                  <span className="font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                    5⚡ créditos
                  </span>
                </div>
                <p className="text-[11px] text-[#6E6A62] mt-1">
                  Resumos teóricos diretos com condutas, posologias e flashcards.
                </p>
              </div>
            </div>

            {/* Action Item 4 */}
            <div className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-2xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-black shrink-0">
                <Sparkles className="w-4 h-4 text-amber-700 fill-amber-400" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-[#1A1A1A]">Resumo Extensivo</h4>
                  <span className="font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                    10⚡ a 25⚡
                  </span>
                </div>
                <p className="text-[11px] text-[#6E6A62] mt-1">
                  Geração em profundidade com Dicas de Preceptor, tabelas e anatomia médica.
                </p>
              </div>
            </div>

            {/* Action Item 5 */}
            <div className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-2xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-800 flex items-center justify-center font-black shrink-0">
                <BookOpen className="w-4 h-4 text-red-700" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-[#1A1A1A]">Resumo Monográfico</h4>
                  <span className="font-black text-red-800 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                    50⚡ créditos
                  </span>
                </div>
                <p className="text-[11px] text-[#6E6A62] mt-1">
                  Múltiplas fases cobrindo Introdução, Desenvolvimento e Condutas completas.
                </p>
              </div>
            </div>

            {/* Action Item 6 */}
            <div className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-2xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-black shrink-0">
                <Calendar className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-[#1A1A1A]">Planejamento de Estudos</h4>
                  <span className="font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    20⚡ / 25⚡
                  </span>
                </div>
                <p className="text-[11px] text-[#6E6A62] mt-1">
                  Montagem de cronograma semanal e organização de temas de fixação.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* SECTION 3: PROVIDER CARDS WITH BENEFITS, LIMITS & COSTS */}
        {isOwner && (
          <>
            <h3 className="text-sm font-extrabold text-[#1A1A1A] mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              Provedores Integrados: Limites Proporcionais ao Seu Plano
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
              
              {/* Groq Cloud Card */}
              <div className={`p-4 rounded-2xl border transition-all ${
                stats?.providers.groq?.configured 
                  ? 'bg-purple-50/50 border-purple-200 shadow-xs' 
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                    <h3 className="font-extrabold text-xs text-purple-950">Groq Cloud</h3>
                  </div>
                  <span className="text-[9px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                    LPU Ultra-Rápido
                  </span>
                </div>

                <p className="text-[11px] text-purple-900/80 font-medium mb-2">
                  Modelo: <strong className="font-bold">llama-3.3-70b</strong>
                </p>

                <div className="space-y-1.5 text-[11px] text-[#4A4741] border-t border-purple-100 pt-2 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#6E6A62]">Sua Cota Diária:</span>
                    <strong className="text-purple-950 font-bold">{groqAllowedDaily} requisições/dia</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#6E6A62]">Uso Groq Hoje:</span>
                    <span className="font-extrabold text-purple-950 bg-purple-100 px-2 py-0.5 rounded-md">
                      {stats?.providers.groq?.requestsToday || 0} / {groqAllowedDaily}
                    </span>
                  </div>
                </div>

                <div className="border-t border-purple-100 pt-2 text-[10px] space-y-1">
                  <p className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Vantagem: Resposta instantânea e excelente raciocínio médico para textos.
                  </p>
                  <p className="text-amber-800 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> Limitação: Focado em texto (não faz leitura direta de arquivos PDF).
                  </p>
                </div>
              </div>

              {/* Google Gemini Card */}
              <div className={`p-4 rounded-2xl border transition-all ${
                stats?.providers.gemini.configured 
                  ? 'bg-amber-50/50 border-amber-200 shadow-xs' 
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" />
                    <h3 className="font-extrabold text-xs text-amber-950">Google Gemini</h3>
                  </div>
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    Multimodal 2.0
                  </span>
                </div>

                <p className="text-[11px] text-amber-900/80 font-medium mb-2">
                  Modelo Ativo: <strong className="font-bold">gemini-3.1-flash-lite</strong>
                </p>

                <div className="space-y-1.5 text-[11px] text-[#4A4741] border-t border-amber-100 pt-2 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#6E6A62]">Sistema de Chaves:</span>
                    <strong className="text-amber-900 font-bold">3 Chaves em Rotação Automática</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#6E6A62]">Uso Gemini Hoje:</span>
                    <span className="font-extrabold text-amber-950 bg-amber-100 px-2 py-0.5 rounded-md">
                      {stats?.providers.gemini.requestsToday || 0}
                    </span>
                  </div>
                </div>

                <div className="border-t border-amber-100 pt-2 text-[10px] space-y-1">
                  <p className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Vantagem: Lê PDFs e imagens perfeitamente (ótimo para importar cronogramas).
                  </p>
                  <p className="text-amber-800 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> Limitação: Limite de requisições por minuto no plano gratuito.
                  </p>
                </div>
              </div>

            </div>
          </>
        )}

        {/* Protection Explainer Box */}
        <div className="p-4 rounded-2xl bg-[#F4F3EF] border border-[#E2E0D9] text-xs text-[#4A4741] leading-relaxed">
          <h4 className="font-extrabold text-sm text-[#1A1A1A] mb-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 animate-pulse" />
            Garantia de Disponibilidade & Estabilidade
          </h4>
          <p className="text-[#6E6A62]">
            O MedRevise opera com cascata de inteligência artificial em múltiplos servidores (Google Cloud Gemini e Groq LPU). Se a cota de qualquer provedor for atingida, o sistema alterna silenciosamente para a próxima chave ou modelo em milissegundos sem interromper seus estudos e sem cobrar créditos adicionais.
          </p>
        </div>

        </div>

        {/* Sticky Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E2E0D9] bg-white shrink-0 flex justify-between items-center">
          <div className="text-xs text-[#6E6A62] font-medium">
            Sua preferência salva: <strong className="text-[#1A1A1A] uppercase">{preferredEngine}</strong>
          </div>
          <Button
            onClick={onClose}
            className="bg-[#1A1A1A] hover:bg-[#333333] text-white font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer"
          >
            Salvar e Fechar
          </Button>
        </div>

      </div>
    </div>
  );
}
