import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, query, orderBy, limit } from '../firebase';
import { 
  updateSystemErrorStatus, 
  deleteSystemErrorLog, 
  logSystemError, 
  SystemErrorLog 
} from '../internato/services/errorLogger';
import { 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  Trash2, 
  Eye, 
  X, 
  Loader2, 
  Sparkles, 
  CheckCircle2,
  Bug,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export default function ErrorLogsManager() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SystemErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<SystemErrorLog | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Security check: ONLY lucas1renck2melo@gmail.com
  const isAuthorized = user?.email === 'lucas1renck2melo@gmail.com';

  const fetchLogs = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'systemErrors'), orderBy('timestamp', 'desc'), limit(150));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SystemErrorLog[];
      setLogs(fetched);
    } catch (err) {
      console.error('Error fetching system errors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchLogs();
    }
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center bg-white border border-[#141414]/15 rounded-2xl max-w-lg mx-auto my-12 space-y-3 font-mono">
        <Shield className="w-10 h-10 text-stone-400 mx-auto" />
        <h3 className="font-serif italic text-lg font-bold text-stone-900">Acesso Restrito</h3>
        <p className="text-xs text-stone-500">
          A central de diagnósticos de erros do MedRevise é exclusiva do usuário proprietário (lucas1renck2melo@gmail.com).
        </p>
      </div>
    );
  }

  const handleUpdateStatus = async (logId: string, status: 'new' | 'investigating' | 'resolved' | 'ignored') => {
    try {
      await updateSystemErrorStatus(logId, status);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, status } : l));
      if (selectedLog && selectedLog.id === logId) {
        setSelectedLog({ ...selectedLog, status });
      }
    } catch (err) {
      alert('Erro ao atualizar status do log.');
    }
  };

  const handleDelete = async (logId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este log de erro?')) return;
    try {
      await deleteSystemErrorLog(logId);
      setLogs(prev => prev.filter(l => l.id !== logId));
      if (selectedLog?.id === logId) setSelectedLog(null);
    } catch (err) {
      alert('Erro ao excluir log.');
    }
  };

  const handleClearResolved = async () => {
    const resolvedLogs = logs.filter(l => l.status === 'resolved' || l.status === 'ignored');
    if (resolvedLogs.length === 0) {
      alert('Nenhum log resolvido ou ignorado para limpar.');
      return;
    }
    if (!window.confirm(`Deseja remover ${resolvedLogs.length} logs resolvidos/ignorados?`)) return;

    for (const log of resolvedLogs) {
      if (log.id) {
        try {
          await deleteSystemErrorLog(log.id);
        } catch (e) {}
      }
    }
    fetchLogs();
  };

  const handleSimulateTestError = async () => {
    setIsSimulating(true);
    try {
      await logSystemError({
        action: 'Teste de Diagnóstico de Erro (MedRevise Admin)',
        error: new Error('Erro de Teste Simulado: Teste do painel de controle do Lucas.'),
        module: 'MedRevise',
        metadata: {
          testMode: true,
          adminEmail: user?.email,
          browser: navigator.userAgent
        }
      });
      await fetchLogs();
      alert('Erro de teste registrado no MedRevise com sucesso!');
    } catch (err) {
      alert('Falha ao registrar erro de teste.');
    } finally {
      setIsSimulating(false);
    }
  };

  const availableModules = Array.from(new Set(logs.map(l => l.module || 'Geral'))).filter(Boolean);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.errorMessage || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.module || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userId || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || (log.status || 'new') === selectedStatus;
    const matchesModule = selectedModule === 'all' || (log.module || 'Geral') === selectedModule;

    return matchesSearch && matchesStatus && matchesModule;
  });

  const totalNew = logs.filter(l => (l.status || 'new') === 'new').length;
  const totalInvestigating = logs.filter(l => l.status === 'investigating').length;
  const totalResolved = logs.filter(l => l.status === 'resolved').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border-2 border-[#141414]/15 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 text-red-700 rounded-xl border border-red-200">
              <Bug className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif italic text-2xl font-bold text-[#141414]">Central de Erros & Diagnóstico (MedRevise)</h2>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-stone-900 text-white px-2 py-0.5 rounded">
                  Exclusivo Lucas
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1 font-mono">
                Registros em tempo real de falhas técnicas, timeouts e exceções enfrentadas pelos alunos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={handleSimulateTestError} 
              disabled={isSimulating}
              className="text-[11px] font-mono font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
              Testar Log
            </button>
            <button 
              onClick={fetchLogs} 
              className="text-[11px] font-mono font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-stone-600", loading && "animate-spin")} />
              Atualizar
            </button>
            {logs.some(l => l.status === 'resolved' || l.status === 'ignored') && (
              <button 
                onClick={handleClearResolved}
                className="text-[11px] font-mono font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-all cursor-pointer"
              >
                Limpar Resolvidos
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-500">Total Gravado</span>
            <p className="text-2xl font-serif italic font-bold text-stone-900">{logs.length}</p>
          </div>
          <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose-800">Novos Erros</span>
            <p className="text-2xl font-serif italic font-bold text-rose-900">{totalNew}</p>
          </div>
          <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-800">Em Análise</span>
            <p className="text-2xl font-serif italic font-bold text-amber-900">{totalInvestigating}</p>
          </div>
          <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-800">Resolvidos</span>
            <p className="text-2xl font-serif italic font-bold text-emerald-900">{totalResolved}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input 
            type="text"
            placeholder="Buscar por aluno, ação, erro ou módulo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-3 h-10 text-xs rounded-xl border border-stone-200 w-full outline-none focus:border-stone-900 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-[10px] font-mono font-bold">
            <span className="px-2 text-stone-400 uppercase">Status:</span>
            {(['all', 'new', 'investigating', 'resolved', 'ignored'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={cn(
                  "px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all cursor-pointer",
                  selectedStatus === st
                    ? "bg-stone-900 text-white shadow-xs font-bold"
                    : "text-stone-600 hover:text-stone-900"
                )}
              >
                {st === 'all' ? 'Todos' : st === 'new' ? 'Novos' : st === 'investigating' ? 'Análise' : st === 'resolved' ? 'OK' : 'Ignorados'}
              </button>
            ))}
          </div>

          {availableModules.length > 0 && (
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="bg-stone-100 border border-stone-200 text-stone-800 text-[10px] font-mono font-bold uppercase rounded-xl px-3 h-9 outline-none cursor-pointer"
            >
              <option value="all">Módulos (Todos)</option>
              {availableModules.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Errors List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
          <p className="text-xs font-mono text-stone-500 uppercase tracking-widest">Carregando histórico de erros...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-16 text-center text-stone-500 font-mono text-xs bg-white rounded-2xl border border-dashed border-stone-300">
          Nenhum log de erro encontrado para a busca selecionada.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredLogs.map((log) => {
            const statusColor = 
              log.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              log.status === 'investigating' ? 'bg-amber-100 text-amber-800 border-amber-300' :
              log.status === 'ignored' ? 'bg-stone-100 text-stone-600 border-stone-300' :
              'bg-rose-100 text-rose-800 border-rose-300 font-bold';

            const statusLabel = 
              log.status === 'resolved' ? 'Resolvido' :
              log.status === 'investigating' ? 'Em Análise' :
              log.status === 'ignored' ? 'Ignorado' :
              'Novo / Erro';

            return (
              <div 
                key={log.id} 
                className={cn(
                  "bg-white p-4 sm:p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs hover:border-stone-400",
                  log.status === 'new' ? "border-rose-300 bg-rose-50/20" : "border-stone-200"
                )}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className={cn("p-2.5 rounded-xl shrink-0 mt-0.5", log.status === 'new' ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-700")}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap font-mono">
                      <span className={cn("text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border", statusColor)}>
                        {statusLabel}
                      </span>
                      <span className="text-[10px] bg-stone-100 text-stone-800 px-2 py-0.5 rounded border border-stone-200 font-bold">
                        {log.module || 'MedRevise'}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : ''}
                      </span>
                    </div>

                    <div className="font-serif italic font-bold text-base text-stone-900 truncate">
                      {log.action}
                    </div>

                    <p className="text-xs font-mono text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 break-words line-clamp-2">
                      {log.errorMessage}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] font-mono text-stone-500 pt-1">
                      <span className="font-bold text-stone-800">Aluno: {log.userEmail || 'Anônimo'}</span>
                      <span>•</span>
                      <span className="opacity-75">UID: {log.userId}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => setSelectedLog(log)}
                    className="text-[10px] font-mono font-bold uppercase tracking-wider h-9 px-3 rounded-xl border border-stone-300 hover:bg-stone-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Detalhes
                  </button>

                  <select
                    value={log.status || 'new'}
                    onChange={(e) => log.id && handleUpdateStatus(log.id, e.target.value as any)}
                    className="bg-stone-100 border border-stone-300 text-stone-800 text-[10px] font-mono font-bold uppercase rounded-xl px-2 h-9 outline-none cursor-pointer"
                  >
                    <option value="new">Novo</option>
                    <option value="investigating">Em Análise</option>
                    <option value="resolved">Resolvido</option>
                    <option value="ignored">Ignorar</option>
                  </select>

                  <button
                    onClick={() => log.id && handleDelete(log.id)}
                    className="h-9 w-9 text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl flex items-center justify-center cursor-pointer"
                    title="Excluir log"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl border-2 border-[#141414] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl font-sans"
          >
            <div className="p-6 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl border border-rose-200">
                  <Bug className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif italic font-bold text-stone-900">Detalhes do Registro do Erro</h3>
                  <p className="text-xs font-mono text-stone-500">{selectedLog.action}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="rounded-xl h-9 w-9 border border-stone-300 flex items-center justify-center hover:bg-stone-100">
                <X className="w-4 h-4 text-stone-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div>
                  <span className="text-[9px] font-bold uppercase text-stone-400">Aluno</span>
                  <p className="font-bold text-stone-900">{selectedLog.userEmail || 'Anônimo'}</p>
                  <p className="text-[10px] text-stone-500">{selectedLog.userId}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-stone-400">Módulo / Data</span>
                  <p className="font-bold text-stone-900">{selectedLog.module || 'MedRevise'}</p>
                  <p className="text-[10px] text-stone-500">{selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString('pt-BR') : ''}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-rose-800">Mensagem de Erro Retornada</span>
                <div className="p-4 bg-rose-950 text-rose-200 rounded-2xl text-xs border border-rose-800 break-words font-semibold">
                  {selectedLog.errorMessage}
                </div>
              </div>

              {selectedLog.errorStack && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-stone-600">Rastreamento de Pilha (Stack Trace)</span>
                  <pre className="p-4 bg-stone-900 text-stone-300 rounded-2xl text-[10px] leading-relaxed overflow-x-auto max-h-48 border border-stone-800 whitespace-pre-wrap">
                    {selectedLog.errorStack}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-stone-600">Contexto & Parâmetros (Metadata)</span>
                  <pre className="p-4 bg-stone-100 text-stone-800 rounded-2xl text-[10px] overflow-x-auto border border-stone-200">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="space-y-1 text-[10px] text-stone-500 border-t border-stone-200 pt-3">
                <p><strong>Navegador:</strong> {selectedLog.userAgent}</p>
                <p><strong>Página:</strong> {selectedLog.url}</p>
              </div>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3 font-mono">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-stone-500 uppercase">Status:</span>
                <select
                  value={selectedLog.status || 'new'}
                  onChange={(e) => selectedLog.id && handleUpdateStatus(selectedLog.id, e.target.value as any)}
                  className="bg-white border border-stone-300 text-stone-800 text-[10px] font-bold uppercase rounded-xl px-3 h-9 outline-none cursor-pointer"
                >
                  <option value="new">Novo</option>
                  <option value="investigating">Em Análise</option>
                  <option value="resolved">Resolvido</option>
                  <option value="ignored">Ignorar</option>
                </select>
              </div>

              <button 
                onClick={() => setSelectedLog(null)} 
                className="bg-stone-900 hover:bg-black text-white text-[10px] uppercase font-bold tracking-widest px-6 h-9 rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
