import React, { useState, useMemo } from 'react';
import { Subject, Topic } from '../types';
import { useSubjectLinks } from '../hooks/useSubjectLinks';
import { useStudyData } from '../hooks/useStudyData';
import { 
  Link2, 
  Unlink, 
  Sparkles, 
  CheckCircle2, 
  BookOpen, 
  ArrowRight,
  Plus,
  Search,
  ArrowLeftRight,
  Layers,
  Activity,
  Zap,
  Check,
  ExternalLink,
  ShieldCheck,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SubjectLinkerInterfaceProps {
  onSwitchMode?: (mode: 'revise' | 'internato') => void;
  customReviseSubjects?: Subject[];
  customInternatoSubjects?: Subject[];
  isEmbeddedModal?: boolean;
  onCloseModal?: () => void;
}

export default function SubjectLinkerInterface({
  onSwitchMode,
  customReviseSubjects,
  customInternatoSubjects,
  isEmbeddedModal = false,
  onCloseModal
}: SubjectLinkerInterfaceProps) {
  const { subjects: studyDataSubjects, topics: studyDataTopics } = useStudyData();
  const { links, linkSubjects, unlinkSubjects, autoLinkMatchingSubjects, loading: linksLoading } = useSubjectLinks();

  const reviseSubjects = customReviseSubjects || studyDataSubjects;
  const internatoSubjects = customInternatoSubjects || studyDataSubjects;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'linked' | 'unlinked'>('all');
  
  const [selectedReviseId, setSelectedReviseId] = useState<string>('');
  const [selectedInternatoId, setSelectedInternatoId] = useState<string>('');
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);

  const showFeedback = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleManualLink = async () => {
    if (!selectedReviseId || !selectedInternatoId) return;
    const revSubObj = reviseSubjects.find(s => s.id === selectedReviseId) || internatoSubjects.find(s => s.id === selectedReviseId);
    const intSubObj = internatoSubjects.find(s => s.id === selectedInternatoId) || reviseSubjects.find(s => s.id === selectedInternatoId);
    
    await linkSubjects(
      selectedReviseId, 
      selectedInternatoId, 
      false, 
      revSubObj?.name || '', 
      intSubObj?.name || ''
    );
    
    setSelectedReviseId('');
    setSelectedInternatoId('');
    showFeedback('Matérias vinculadas e sincronizadas com sucesso em ambos os módulos!');
  };

  const handleQuickInlineLink = async (revId: string, intId: string) => {
    if (!revId || !intId) return;
    const revSubObj = reviseSubjects.find(s => s.id === revId);
    const intSubObj = internatoSubjects.find(s => s.id === intId);

    await linkSubjects(revId, intId, false, revSubObj?.name || '', intSubObj?.name || '');
    showFeedback(`Vínculo criado entre "${revSubObj?.name || 'Matéria'}" e "${intSubObj?.name || 'Rodízio'}"!`);
  };

  const handleAutoLink = async () => {
    setIsAutoLinking(true);
    const count = await autoLinkMatchingSubjects(reviseSubjects, internatoSubjects);
    setIsAutoLinking(false);
    if (count > 0) {
      showFeedback(`✨ ${count} matéria(s) vinculada(s) automaticamente com base na correspondência de nomes!`, 'success');
    } else {
      showFeedback('Nenhuma nova matéria não-vinculada com nome equivalente foi encontrada.', 'info');
    }
  };

  // Helper maps & statistics
  const linkedReviseIds = useMemo(() => new Set(links.map(l => l.reviseSubjectId)), [links]);
  const linkedInternatoIds = useMemo(() => new Set(links.map(l => l.internatoSubjectId)), [links]);

  const unlinkedReviseSubjects = useMemo(() => {
    return reviseSubjects.filter(s => !linkedReviseIds.has(s.id));
  }, [reviseSubjects, linkedReviseIds]);

  const unlinkedInternatoSubjects = useMemo(() => {
    return internatoSubjects.filter(s => !linkedInternatoIds.has(s.id));
  }, [internatoSubjects, linkedInternatoIds]);

  // Topic metrics for subject
  const getSubjectTopicStats = (subjectId: string) => {
    const subTopics = studyDataTopics.filter(t => t.subjectId === subjectId);
    const completedCount = subTopics.filter(t => t.completed).length;
    return {
      total: subTopics.length,
      completed: completedCount,
      percentage: subTopics.length > 0 ? Math.round((completedCount / subTopics.length) * 100) : 0
    };
  };

  // Filtered links list
  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      const revSub = reviseSubjects.find(s => s.id === link.reviseSubjectId);
      const intSub = internatoSubjects.find(s => s.id === link.internatoSubjectId);
      const revName = revSub?.name || (link as any).reviseSubjectName || '';
      const intName = intSub?.name || (link as any).internatoSubjectName || '';
      
      const matchesSearch = !searchQuery || 
        revName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        intName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [links, reviseSubjects, internatoSubjects, searchQuery]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="bg-white border-2 border-[#141414] rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <ArrowLeftRight className="w-48 h-48 text-[#141414]" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                <Link2 className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full">
                Sincronização em Tempo Real
              </span>
              {isEmbeddedModal && onCloseModal && (
                <button
                  onClick={onCloseModal}
                  className="ml-auto p-1.5 text-stone-500 hover:text-black hover:bg-stone-100 rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <h1 className="font-serif italic text-3xl font-bold text-[#141414] tracking-tight">
              Vínculo & Integração de Matérias
            </h1>
            <p className="text-xs text-[#141414]/70 mt-1 max-w-2xl leading-relaxed font-sans">
              Interligue os módulos teóricos do <strong>MedRevise</strong> aos rodízios do <strong>MedInternato</strong>. Quando vinculados, ao estudar ou responder simulados em um módulo, as revisões e estatísticas são refletidas automaticamente em ambos!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAutoLink}
              disabled={isAutoLinking}
              className="px-4 py-3 bg-[#D44E3D] hover:bg-[#b83f30] text-white font-mono text-xs font-bold uppercase rounded-xl transition-all shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>{isAutoLinking ? 'Mapeando...' : 'Auto-Vincular Mapeamento'}</span>
            </button>
          </div>
        </div>

        {/* Global Linking Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#141414]/10">
          <div className="bg-[#FAF9F5] border border-[#141414]/15 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-blue-700 text-[10px] font-mono font-bold uppercase">
              <BookOpen className="w-3.5 h-3.5" />
              <span>MedRevise</span>
            </div>
            <p className="text-xl font-mono font-bold text-[#141414] mt-1">
              {reviseSubjects.length} <span className="text-xs font-normal text-stone-500">matérias</span>
            </p>
          </div>

          <div className="bg-[#FAF9F5] border border-[#141414]/15 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-amber-700 text-[10px] font-mono font-bold uppercase">
              <Layers className="w-3.5 h-3.5" />
              <span>MedInternato</span>
            </div>
            <p className="text-xl font-mono font-bold text-[#141414] mt-1">
              {internatoSubjects.length} <span className="text-xs font-normal text-stone-500">módulos</span>
            </p>
          </div>

          <div className="bg-[#FAF9F5] border border-[#141414]/15 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-mono font-bold uppercase">
              <Link2 className="w-3.5 h-3.5" />
              <span>Vínculos Ativos</span>
            </div>
            <p className="text-xl font-mono font-bold text-emerald-700 mt-1">
              {links.length} <span className="text-xs font-normal text-stone-500">conectados</span>
            </p>
          </div>

          <div className="bg-[#FAF9F5] border border-[#141414]/15 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-indigo-700 text-[10px] font-mono font-bold uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Status Nuvem</span>
            </div>
            <p className="text-xs font-mono font-bold text-indigo-900 mt-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Sincronizado
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Notification Feedback Toast */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl border-2 border-[#141414] font-mono text-xs font-bold flex items-center justify-between gap-3 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] ${
              feedbackMsg.type === 'success' ? 'bg-emerald-100 text-emerald-950 border-emerald-900' :
              feedbackMsg.type === 'error' ? 'bg-rose-100 text-rose-950 border-rose-900' :
              'bg-blue-100 text-blue-950 border-blue-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Link Creator Box */}
      <div className="bg-white border-2 border-[#141414] rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] space-y-4">
        <div className="flex items-center justify-between border-b border-[#141414]/10 pb-3">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#141414] flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Criar Vínculo Direto Manual</span>
          </h2>
          <span className="text-[10px] text-stone-500 font-sans">
            Selecione uma matéria em cada lado para acoplá-las
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          {/* MedRevise Subject Selector */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-[10px] font-mono font-bold uppercase text-blue-900 flex items-center justify-between">
              <span>1. Matéria no MedRevise</span>
              <span className="text-[9px] text-stone-400">({reviseSubjects.length} disponíveis)</span>
            </label>
            <select
              value={selectedReviseId}
              onChange={(e) => setSelectedReviseId(e.target.value)}
              className="w-full p-3 bg-[#FAF9F5] border-2 border-[#141414] rounded-xl text-xs font-bold text-[#1A1A1A] focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
            >
              <option value="">-- Selecione a Matéria Teórica --</option>
              {reviseSubjects.map(s => {
                const isAlreadyLinked = linkedReviseIds.has(s.id);
                return (
                  <option key={`rev-opt-${s.id}`} value={s.id}>
                    {s.name} {isAlreadyLinked ? '✓ (Já vinculado)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Bi-directional Link Icon */}
          <div className="flex flex-col items-center justify-center md:col-span-1 pt-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-[#141414] flex items-center justify-center text-emerald-800 shadow-2xs">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>

          {/* MedInternato Subject Selector */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-[10px] font-mono font-bold uppercase text-amber-900 flex items-center justify-between">
              <span>2. Rodízio / Módulo MedInternato</span>
              <span className="text-[9px] text-stone-400">({internatoSubjects.length} disponíveis)</span>
            </label>
            <select
              value={selectedInternatoId}
              onChange={(e) => setSelectedInternatoId(e.target.value)}
              className="w-full p-3 bg-[#FAF9F5] border-2 border-[#141414] rounded-xl text-xs font-bold text-[#1A1A1A] focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
            >
              <option value="">-- Selecione o Módulo Prático --</option>
              {internatoSubjects.map(s => {
                const isAlreadyLinked = linkedInternatoIds.has(s.id);
                return (
                  <option key={`int-opt-${s.id}`} value={s.id}>
                    {s.name} {isAlreadyLinked ? '✓ (Já vinculado)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            onClick={handleManualLink}
            disabled={!selectedReviseId || !selectedInternatoId}
            className="px-6 py-3 bg-[#141414] hover:bg-black text-white font-mono text-xs font-bold uppercase rounded-xl transition-all shadow-[3px_3px_0px_0px_rgba(212,78,61,1)] disabled:opacity-40 disabled:shadow-none cursor-pointer flex items-center gap-2"
          >
            <Link2 className="w-4 h-4 text-emerald-400" />
            <span>Confirmar e Ativar Vínculo</span>
          </button>
        </div>
      </div>

      {/* Unlinked Subjects Quick-Attach Panel */}
      {(unlinkedReviseSubjects.length > 0 || unlinkedInternatoSubjects.length > 0) && (
        <div className="bg-[#FAF9F5] border-2 border-[#141414] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase text-[#141414] flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>Matérias Sem Vínculo (Atribuição Rápida 1-Clique)</span>
            </h3>
            <span className="text-[10px] font-mono text-stone-500">
              {unlinkedReviseSubjects.length} no MedRevise | {unlinkedInternatoSubjects.length} no MedInternato
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* MedRevise Unlinked List */}
            <div className="bg-white border border-[#141414]/20 rounded-xl p-3.5 space-y-2">
              <h4 className="text-[11px] font-bold text-blue-900 uppercase font-mono border-b border-stone-100 pb-1.5">
                Sem Vínculo no MedRevise ({unlinkedReviseSubjects.length})
              </h4>
              {unlinkedReviseSubjects.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-2">Todas as matérias do MedRevise estão vinculadas!</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {unlinkedReviseSubjects.slice(0, 10).map(sub => (
                    <div key={`unlinked-rev-${sub.id}`} className="flex items-center justify-between gap-2 p-2 bg-[#FAF9F5] rounded-lg border border-stone-200 text-xs">
                      <span className="font-serif italic font-bold text-[#141414] truncate">{sub.name}</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleQuickInlineLink(sub.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        className="text-[10px] font-mono font-bold bg-white border border-stone-300 rounded px-2 py-1 cursor-pointer focus:outline-none"
                      >
                        <option value="" disabled>Vincular a...</option>
                        {internatoSubjects.map(iSub => (
                          <option key={`inline-int-${iSub.id}`} value={iSub.id}>
                            {iSub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MedInternato Unlinked List */}
            <div className="bg-white border border-[#141414]/20 rounded-xl p-3.5 space-y-2">
              <h4 className="text-[11px] font-bold text-amber-900 uppercase font-mono border-b border-stone-100 pb-1.5">
                Sem Vínculo no MedInternato ({unlinkedInternatoSubjects.length})
              </h4>
              {unlinkedInternatoSubjects.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-2">Todos os módulos do MedInternato estão vinculados!</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {unlinkedInternatoSubjects.slice(0, 10).map(sub => (
                    <div key={`unlinked-int-${sub.id}`} className="flex items-center justify-between gap-2 p-2 bg-[#FAF9F5] rounded-lg border border-stone-200 text-xs">
                      <span className="font-serif italic font-bold text-[#141414] truncate">{sub.name}</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleQuickInlineLink(e.target.value, sub.id);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        className="text-[10px] font-mono font-bold bg-white border border-stone-300 rounded px-2 py-1 cursor-pointer focus:outline-none"
                      >
                        <option value="" disabled>Vincular a...</option>
                        {reviseSubjects.map(rSub => (
                          <option key={`inline-rev-${rSub.id}`} value={rSub.id}>
                            {rSub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Directory of Active Links */}
      <div className="bg-white border-2 border-[#141414] rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141414]/10 pb-4">
          <div>
            <h3 className="font-serif italic text-xl font-bold text-[#141414] flex items-center gap-2">
              Diretório de Matérias Vinculadas ({links.length})
            </h3>
            <p className="text-xs text-stone-500 font-sans mt-0.5">
              Gerencie a sincronização bidirecional de resumos, revisões e métricas
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar matéria vinculada..."
              className="w-full pl-9 pr-3 py-2 bg-[#FAF9F5] border border-[#141414]/30 rounded-xl text-xs text-[#141414] focus:outline-none focus:bg-white focus:border-[#141414] transition-all font-medium"
            />
          </div>
        </div>

        {/* Links Directory Cards */}
        {filteredLinks.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-[#141414]/20 rounded-2xl bg-[#FAF9F5] space-y-3">
            <Link2 className="w-10 h-10 mx-auto text-stone-400" />
            <h4 className="font-serif italic text-base font-bold text-[#141414]">
              {searchQuery ? 'Nenhum vínculo encontrado para a busca.' : 'Nenhuma matéria vinculada ainda.'}
            </h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Clique no botão <strong>"Auto-Vincular Mapeamento"</strong> no topo da página para mapear automaticamente matérias com nomes idênticos com um único clique!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredLinks.map((link) => {
              const revSub = reviseSubjects.find(s => s.id === link.reviseSubjectId) || internatoSubjects.find(s => s.id === link.reviseSubjectId);
              const intSub = internatoSubjects.find(s => s.id === link.internatoSubjectId) || reviseSubjects.find(s => s.id === link.internatoSubjectId);

              const revName = revSub?.name || (link as any).reviseSubjectName || 'Matéria MedRevise';
              const intName = intSub?.name || (link as any).internatoSubjectName || 'Módulo MedInternato';

              const revStats = revSub ? getSubjectTopicStats(revSub.id) : { total: 0, completed: 0, percentage: 0 };
              const intStats = intSub ? getSubjectTopicStats(intSub.id) : { total: 0, completed: 0, percentage: 0 };

              const isExpanded = expandedLinkId === link.id;

              return (
                <div
                  key={link.id}
                  className="bg-white border-2 border-[#141414] rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-emerald-600 space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Visual Connection Card */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
                      {/* MedRevise Card */}
                      <div className="sm:col-span-5 bg-[#F4F8FF] border border-blue-200 p-3.5 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-mono font-bold uppercase rounded">
                            MedRevise (Teoria)
                          </span>
                          <span className="text-[10px] font-mono text-blue-900 font-bold">
                            {revStats.completed}/{revStats.total} tópicos ({revStats.percentage}%)
                          </span>
                        </div>
                        <h4 className="font-serif italic font-bold text-base text-[#141414] truncate">
                          {revName}
                        </h4>
                      </div>

                      {/* Link Indicator */}
                      <div className="sm:col-span-1 flex items-center justify-center">
                        <div className="p-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full shrink-0 shadow-2xs">
                          <Link2 className="w-4 h-4" />
                        </div>
                      </div>

                      {/* MedInternato Card */}
                      <div className="sm:col-span-5 bg-[#FFFDF5] border border-amber-200 p-3.5 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 bg-amber-600 text-white text-[9px] font-mono font-bold uppercase rounded">
                            MedInternato (Prática)
                          </span>
                          <span className="text-[10px] font-mono text-amber-900 font-bold">
                            {intStats.completed}/{intStats.total} tópicos ({intStats.percentage}%)
                          </span>
                        </div>
                        <h4 className="font-serif italic font-bold text-base text-[#141414] truncate">
                          {intName}
                        </h4>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-stone-100">
                      {onSwitchMode && (
                        <button
                          onClick={() => onSwitchMode('internato')}
                          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-[#141414] text-xs font-mono font-bold rounded-xl border border-stone-300 transition-all cursor-pointer flex items-center gap-1.5"
                          title="Abrir este rodízio no MedInternato"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Ver no Internato</span>
                        </button>
                      )}

                      <button
                        onClick={() => setExpandedLinkId(isExpanded ? null : link.id)}
                        className="px-3 py-2 bg-[#FAF9F5] hover:bg-stone-100 text-[#141414] text-xs font-mono font-bold rounded-xl border border-stone-300 transition-all cursor-pointer"
                      >
                        {isExpanded ? 'Ocultar Detalhes' : 'Ver Tópicos'}
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Deseja mesmo desvincular a matéria "${revName}" de "${intName}"?`)) {
                            await unlinkSubjects(link.id);
                            showFeedback('Vínculo removido com sucesso.', 'info');
                          }
                        }}
                        className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer"
                        title="Desvincular estas matérias"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Topics Detail Section */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-3 border-t border-stone-200 space-y-3 bg-[#FAF9F5] p-4 rounded-xl"
                    >
                      <h5 className="text-xs font-mono font-bold uppercase text-[#141414] flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        <span>Sincronização de Conteúdos e Tópicos</span>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-1">
                          <p className="font-bold text-blue-900 font-mono text-[10px] uppercase">Tópicos Cadastrados no MedRevise</p>
                          <p className="text-stone-600">{revStats.total} tópicos registrados no banco teórico.</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-1">
                          <p className="font-bold text-amber-900 font-mono text-[10px] uppercase">Tópicos Cadastrados no MedInternato</p>
                          <p className="text-stone-600">{intStats.total} aulas e tópicos cadastrados no cronograma.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
