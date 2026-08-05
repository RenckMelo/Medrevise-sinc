import React, { useState } from 'react';
import { Subject, Topic, Question, Semester } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, Save, Trash2, Book, HelpCircle, Calendar, 
  Search, ShieldAlert, Sparkles, Loader2, Database,
  User, Shield, Mail, Check, X, ShieldCheck, ChevronRight,
  Zap, Award, Edit3, Eye, FileText, CheckCircle2, AlertTriangle,
  ListChecks, RefreshCw, Layers, CheckCircle, ArrowLeft,
  BarChart3, TrendingUp, Users, BookOpen, Clock, Activity, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

// Common visual transition props for sub-components
const transitionProps = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: 'easeOut' as any }
};

// Pastel color generator for user initials avatar
const getAvatarColorClass = (name: string) => {
  const code = name.charCodeAt(0) % 5;
  switch (code) {
    case 0: return 'bg-rose-100 text-rose-700 border-rose-200';
    case 1: return 'bg-amber-100 text-amber-700 border-amber-200';
    case 2: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 3: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    default: return 'bg-teal-100 text-teal-700 border-teal-200';
  }
};

// ==========================================
// 1. SEMESTER MANAGER COMPONENT
// ==========================================
interface SemesterManagerProps {
  semesters: Semester[];
  subjects: Subject[];
  editingSemesterId: string | null;
  setEditingSemesterId: (id: string | null) => void;
  newSemester: { number: string; name: string };
  setNewSemester: React.Dispatch<React.SetStateAction<{ number: string; name: string }>>;
  handleAddSemester: () => void;
  setConfirmDelete: (del: { id: string; type: 'semester' | 'subject' | 'topic' | 'content' } | null) => void;
}

export function SemesterManager({
  semesters,
  subjects,
  editingSemesterId,
  setEditingSemesterId,
  newSemester,
  setNewSemester,
  handleAddSemester,
  setConfirmDelete
}: SemesterManagerProps) {
  const [selectedSemesterId, setSelectedSemesterId] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    if (editingSemesterId) {
      setIsCreating(true);
      setSelectedSemesterId(editingSemesterId);
    }
  }, [editingSemesterId]);

  const selectedSemester = semesters.find(s => s.id === selectedSemesterId);
  const selectedSemesterSubjects = selectedSemester ? subjects.filter(sub => sub.semesterId === selectedSemester.id) : [];

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      {/* Title Header area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-neutral-900 tracking-tight">Eixos de Ciclos e Semestres</h3>
          <p className="text-xs text-[#8E8A82]">Configure os semestres acadêmicos do Internato Médico.</p>
        </div>
        <Button 
          size="sm"
          onClick={() => {
            setIsCreating(true);
            setEditingSemesterId(null);
            setNewSemester({ number: '', name: '' });
          }}
          className="bg-neutral-950 hover:bg-neutral-900 text-white font-bold text-[10px] uppercase tracking-wider h-10 px-4 rounded-xl shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Adicionar Semestre
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Semesters List sidebar */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden">
            <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA]">
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#8E8A82] font-black block">Lista de Semestres</span>
            </CardHeader>
            <CardContent className="p-2 space-y-1.5 max-h-[500px] overflow-y-auto scrollbar-thin">
              {semesters.length === 0 ? (
                <div className="text-center py-12 text-[#8E8A82] italic text-xs">Nenhum semestre cadastrado.</div>
              ) : (
                semesters.map((s, idx) => {
                  const relatedSubjects = subjects.filter(sub => sub.semesterId === s.id);
                  const isSelected = s.id === selectedSemesterId && !isCreating;
                  return (
                    <div 
                      key={`adm-sem-${s.id || 'id'}-${idx}`} 
                      onClick={() => {
                        setSelectedSemesterId(s.id);
                        setIsCreating(false);
                        setEditingSemesterId(null);
                      }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl transition-all border cursor-pointer select-none",
                        isSelected 
                          ? "bg-neutral-900 border-neutral-900 text-white shadow-xs" 
                          : "bg-white border-[#E2E0D9] hover:border-neutral-400 text-neutral-900 hover:bg-[#FBFBFA]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn(
                          "w-8 h-8 rounded-lg font-mono text-[11px] font-black flex items-center justify-center shrink-0 border",
                          isSelected ? "bg-neutral-800 text-white border-neutral-700" : "bg-[#F0EEE9] text-[#8E8A82] border-transparent"
                        )}>
                          {String(s.number).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-xs block truncate leading-tight">{s.name}</span>
                          <span className={cn("text-[9px] block mt-0.5", isSelected ? "text-neutral-300" : "text-[#8E8A82]")}>
                            {relatedSubjects.length} {relatedSubjects.length === 1 ? 'matéria vinculada' : 'matérias vinculadas'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 shrink-0 transition-transform", isSelected ? "text-white translate-x-0.5" : "text-[#8E8A82]")} />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Working canvas (Preview or Create Form) */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {isCreating ? (
              <motion.div key="editor" {...transitionProps}>
                <Card className="border-[#E2E0D9] shadow-sm rounded-2xl overflow-hidden bg-white">
                  <CardHeader className="p-5 border-b border-[#E2E0D9] bg-[#FBFBFA] flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                        {editingSemesterId ? 'Editar Ciclo Letivo' : 'Novo Ciclo Letivo'}
                      </CardTitle>
                      <CardDescription className="text-[10px] text-[#8E8A82]">
                        Determine as informações básicas de estruturação.
                      </CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setIsCreating(false)} 
                      className="text-[9px] uppercase tracking-widest font-black h-8 px-2.5 hover:bg-neutral-100 text-neutral-700"
                    >
                      Cancelar
                    </Button>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                      <div className="space-y-1.5 sm:col-span-4">
                        <label htmlFor="sem-order" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Ordenação Curricular</label>
                        <Input 
                          id="sem-order"
                          type="number"
                          value={newSemester.number} 
                          onChange={(e) => setNewSemester({ ...newSemester, number: e.target.value })} 
                          placeholder="Ex: 9" 
                          className="border-[#E2E0D9] focus:border-neutral-400 h-10 rounded-xl bg-white font-mono text-xs focus-visible:ring-0 text-neutral-900"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-8">
                        <label htmlFor="sem-name" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Título do Ciclo / Semestre</label>
                        <Input 
                          id="sem-name"
                          value={newSemester.name} 
                          onChange={(e) => setNewSemester({ ...newSemester, name: e.target.value })} 
                          placeholder="Ex: 9º Semestre (Internato I)" 
                          className="border-[#E2E0D9] focus:border-neutral-400 h-10 rounded-xl bg-white text-xs focus-visible:ring-0 text-neutral-900 font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-3.5 border-t border-dashed border-[#E2E0D9]">
                      <Button 
                        onClick={() => {
                          handleAddSemester();
                          setIsCreating(false);
                        }} 
                        disabled={!newSemester.number || !newSemester.name}
                        className="flex-1 bg-[#1A1A1A] hover:bg-black text-white uppercase tracking-widest font-black h-11 rounded-xl text-[10px] gap-2 transition-all cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> {editingSemesterId ? 'Salvar Alterações' : 'Criar Novo Semestre'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : selectedSemester ? (
              <motion.div key="preview" {...transitionProps}>
                <Card className="border-[#E2E0D9] shadow-sm rounded-2xl overflow-hidden bg-white border-l-4 border-l-neutral-900">
                  <CardHeader className="p-5 border-b border-[#E2E0D9] bg-[#FBFBFA] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-neutral-900 shrink-0" />
                        <CardTitle className="text-base font-black text-neutral-900">{selectedSemester.name}</CardTitle>
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[#8E8A82] mt-1 block">Semestre Letivo • Ordem #{selectedSemester.number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setEditingSemesterId(selectedSemester.id);
                          setNewSemester({ number: String(selectedSemester.number), name: selectedSemester.name });
                          setIsCreating(true);
                        }}
                        className="text-[9px] uppercase tracking-widest font-black border-[#E2E0D9] hover:bg-[#F0EEE9] h-8 px-3 rounded-lg"
                      >
                        Editar
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setConfirmDelete({ id: selectedSemester.id, type: 'semester' })}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    {/* Related subjects lists */}
                    <div className="space-y-3">
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Disciplinas associadas a este Semestre</h4>
                      {selectedSemesterSubjects.length === 0 ? (
                        <div className="p-8 text-center border border-dashed border-[#E2E0D9] rounded-xl bg-neutral-50/40 text-xs text-[#8E8A82] italic">
                          Nenhuma matéria médica cadastrada para este semestre letivo.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedSemesterSubjects.map((sub, idx) => (
                            <div key={`sub-assoc-${sub.id || 'id'}-${idx}`} className="p-3 border border-[#E2E0D9] bg-[#FBFBFA] rounded-xl flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
                                <Book className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-neutral-850 text-xs block truncate">{sub.name}</span>
                                <span className="text-[8.5px] text-[#8E8A82] block truncate font-mono">ID: {sub.id}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="empty" {...transitionProps}>
                <Card className="border-[#E2E0D9] border-dashed shadow-xs rounded-2xl bg-white p-12 text-center flex flex-col items-center justify-center min-h-[250px]">
                  <div className="p-3 bg-neutral-100 rounded-full text-neutral-500 mb-3.5">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider mb-1">Estrutura Curricular</h4>
                  <p className="text-xs text-[#8E8A82] max-w-sm leading-relaxed">
                    Selecione um semestre acadêmico na barra lateral esquerda para verificar suas disciplinas e cargas letivas, ou crie um novo semestre do zero.
                  </p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. SUBJECT MANAGER COMPONENT
// ==========================================
interface SubjectManagerProps {
  subjects: Subject[];
  semesters: Semester[];
  topics: Topic[];
  editingSubjectId: string | null;
  setEditingSubjectId: (id: string | null) => void;
  newSubject: { name: string; icon: string; color: string; semesterId: string };
  setNewSubject: React.Dispatch<React.SetStateAction<{ name: string; icon: string; color: string; semesterId: string }>>;
  handleAddSubject: () => void;
  setConfirmDelete: (del: { id: string; type: 'semester' | 'subject' | 'topic' | 'content' } | null) => void;
  subjectSearch: string;
  setSubjectSearch: (s: string) => void;
}

export function SubjectManager({
  subjects,
  semesters,
  topics,
  editingSubjectId,
  setEditingSubjectId,
  newSubject,
  setNewSubject,
  handleAddSubject,
  setConfirmDelete,
  subjectSearch,
  setSubjectSearch
}: SubjectManagerProps) {
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    if (editingSubjectId) {
      setIsCreating(true);
      setSelectedSubjectId(editingSubjectId);
    }
  }, [editingSubjectId]);

  const filteredSubjects = subjects.filter(s => s.name.toLowerCase().includes(subjectSearch.toLowerCase()));

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const selectedSubjectSemester = selectedSubject ? semesters.find(sem => sem.id === selectedSubject.semesterId) : null;
  const selectedSubjectTopics = selectedSubject ? topics.filter(t => t.subjectId === selectedSubject.id) : [];

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-neutral-900 tracking-tight">Matérias e Grade Médica</h3>
          <p className="text-xs text-[#8E8A82]">Gerencie as disciplinas clínicas que compõem o currículo do Internato.</p>
        </div>
        <Button 
          size="sm"
          onClick={() => {
            setIsCreating(true);
            setEditingSubjectId(null);
            setNewSubject({ name: '', icon: 'BookOpen', color: 'bg-blue-100 text-blue-600', semesterId: '' });
          }}
          className="bg-neutral-950 hover:bg-neutral-900 text-white font-bold text-[10px] uppercase tracking-wider h-10 px-4 rounded-xl shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Adicionar Matéria
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Search + Subjects List */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden">
            <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA] space-y-3">
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#8E8A82] font-black block">Lista de Disciplinas</span>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8E8A82]" />
                <Input 
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  placeholder="Pesquisar matéria..."
                  className="pl-8.5 h-9 border-[#E2E0D9] bg-[#FBFBFA] hover:bg-[#FBFBFA]/50 focus:border-neutral-400 rounded-lg text-xs font-sans placeholder:text-neutral-400 focus-visible:ring-0 text-neutral-900"
                />
              </div>
            </CardHeader>
            <CardContent className="p-2 space-y-1.5 max-h-[460px] overflow-y-auto scrollbar-thin">
              {filteredSubjects.length === 0 ? (
                <div className="text-center py-10 text-[#8E8A82] italic text-xs">Nenhuma matéria correspondente.</div>
              ) : (
                filteredSubjects.map((s, idx) => {
                  const sSemester = semesters.find(sem => sem.id === s.semesterId);
                  const isSelected = s.id === selectedSubjectId && !isCreating;
                  return (
                    <div 
                      key={`adm-sub-${s.id || 'id'}-${idx}`} 
                      onClick={() => {
                        setSelectedSubjectId(s.id);
                        setIsCreating(false);
                        setEditingSubjectId(null);
                      }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl transition-all border cursor-pointer select-none",
                        isSelected 
                          ? "bg-neutral-900 border-neutral-900 text-white shadow-xs" 
                          : "bg-white border-[#E2E0D9] hover:border-neutral-400 text-neutral-900 hover:bg-[#FBFBFA]"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                          isSelected ? "bg-neutral-800 border-neutral-700 text-white" : "bg-neutral-50 border-neutral-100 text-neutral-700"
                        )}>
                          <Book className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs block truncate leading-tight">{s.name}</span>
                          <span className={cn("text-[8.5px] block truncate mt-0.5 font-medium", isSelected ? "text-neutral-300" : "text-[#8E8A82]")}>
                            {sSemester ? sSemester.name : 'Geral'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 shrink-0 transition-transform", isSelected ? "text-white translate-x-0.5" : "text-[#8E8A82]")} />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Working canvas */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {isCreating ? (
              <motion.div key="sub-editor" {...transitionProps}>
                <Card className="border-[#E2E0D9] shadow-sm rounded-2xl overflow-hidden bg-white">
                  <CardHeader className="p-5 border-b border-[#E2E0D9] bg-[#FBFBFA] flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                        {editingSubjectId ? 'Editar Matéria' : 'Nova Matéria Médica'}
                      </CardTitle>
                      <CardDescription className="text-[10px] text-[#8E8A82]">
                        Adicione novos blocos disciplinares na ementa.
                      </CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setIsCreating(false)} 
                      className="text-[9px] uppercase tracking-widest font-black h-8 px-2.5 hover:bg-neutral-100 text-neutral-700"
                    >
                      Cancelar
                    </Button>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="sub-name" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Nome da Matéria / Disciplina</label>
                        <Input 
                          id="sub-name"
                          value={newSubject.name} 
                          onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} 
                          placeholder="Ex: Ginecologia e Obstetrícia" 
                          className="border-[#E2E0D9] focus:border-neutral-400 h-10 rounded-xl bg-white text-xs focus-visible:ring-0 text-neutral-900 font-bold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="sub-semester" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Semestre de Vínculo</label>
                        <select 
                          id="sub-semester"
                          className="w-full h-10 px-3 border border-[#E2E0D9] rounded-xl bg-white focus:outline-none focus:border-neutral-400 text-xs text-neutral-800"
                          value={newSubject.semesterId}
                          onChange={(e) => setNewSubject({ ...newSubject, semesterId: e.target.value })}
                        >
                          <option value="">Selecione o Ciclo</option>
                          {semesters.map((s, idx) => <option key={`sem-opt-${s.id || 'id'}-${idx}`} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-dashed border-[#E2E0D9]">
                      <Button 
                        onClick={() => {
                          handleAddSubject();
                          setIsCreating(false);
                        }} 
                        disabled={!newSubject.name || !newSubject.semesterId}
                        className="flex-1 bg-[#1A1A1A] hover:bg-black text-white uppercase tracking-widest font-black h-11 rounded-xl text-[10px] gap-2 transition-all cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> {editingSubjectId ? 'Salvar Matéria' : 'Criar Matéria'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : selectedSubject ? (
              <motion.div key="sub-preview" {...transitionProps}>
                <Card className="border-[#E2E0D9] shadow-sm rounded-2xl overflow-hidden bg-white border-l-4 border-l-neutral-900">
                  <CardHeader className="p-5 border-b border-[#E2E0D9] bg-[#FBFBFA] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-neutral-900 shrink-0" />
                        <CardTitle className="text-base font-black text-neutral-900">{selectedSubject.name}</CardTitle>
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[#8E8A82] mt-1 block">
                        {selectedSubjectSemester ? `Semestre: ${selectedSubjectSemester.name}` : 'Sem Ciclo Vinculado'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setEditingSubjectId(selectedSubject.id);
                          setNewSubject({ name: selectedSubject.name, icon: selectedSubject.icon, color: selectedSubject.color, semesterId: selectedSubject.semesterId });
                          setIsCreating(true);
                        }}
                        className="text-[9px] uppercase tracking-widest font-black border-[#E2E0D9] hover:bg-[#F0EEE9] h-8 px-3 rounded-lg"
                      >
                        Editar
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setConfirmDelete({ id: selectedSubject.id, type: 'subject' })}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    {/* Stat indicators */}
                    <div className="p-3.5 bg-[#FBFBFA] rounded-xl border border-[#E2E0D9] flex items-center justify-between">
                      <span className="text-xs text-neutral-700">Esta ementa médica engloba <strong className="text-neutral-900">{selectedSubjectTopics.length}</strong> artigos teóricos.</span>
                      <span className="text-[9px] font-mono font-black bg-neutral-100 text-neutral-800 px-2.5 py-0.5 border border-neutral-200 rounded-full shrink-0">
                        {selectedSubjectTopics.length} Tópicos
                      </span>
                    </div>

                    {/* Topics Listing */}
                    <div className="space-y-2.5">
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Artigos teóricos vinculados</h4>
                      {selectedSubjectTopics.length === 0 ? (
                        <div className="p-8 text-center border border-dashed border-[#E2E0D9] rounded-xl bg-neutral-50/40 text-xs text-[#8E8A82] italic">
                          Nenhum tópico médico estruturado para esta disciplina ainda.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {selectedSubjectTopics.map((top, idx) => (
                            <div key={`top-assoc-${top.id || 'id'}-${idx}`} className="p-2.5 bg-white border border-[#E2E0D9] rounded-xl flex items-center justify-between hover:border-neutral-400 transition-colors">
                              <span className="text-xs font-bold text-neutral-800 truncate pr-2">{top.title || (top as any).name}</span>
                              <span className={cn(
                                "text-[8px] font-mono font-black border px-2 py-0.5 rounded uppercase tracking-wider shrink-0",
                                top.content && top.content.length > 100 
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                                  : "bg-amber-50 border-amber-200 text-amber-700"
                              )}>
                                {top.content && top.content.length > 100 ? "Com Resumo" : "Sem Resumo"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="sub-empty" {...transitionProps}>
                <Card className="border-[#E2E0D9] border-dashed shadow-xs rounded-2xl bg-white p-12 text-center flex flex-col items-center justify-center min-h-[250px]">
                  <div className="p-3 bg-neutral-100 rounded-full text-neutral-500 mb-3.5">
                    <Book className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider mb-1">Ementas Clínicas</h4>
                  <p className="text-xs text-[#8E8A82] max-w-sm leading-relaxed">
                    Selecione uma disciplina na lista lateral esquerda para conferir seus artigos comentados, ementas de estudo e estatísticas globais, ou adicione uma nova.
                  </p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. TOPIC MANAGER COMPONENT (CMS WITH DUAL PANE)
// ==========================================
interface TopicManagerProps {
  topics: Topic[];
  subjects: Subject[];
  semesters: Semester[];
  editingTopicId: string | null;
  setEditingTopicId: (id: string | null) => void;
  newTopic: { subjectId: string; title: string; content: string; references: string; semesterId: string };
  setNewTopic: React.Dispatch<React.SetStateAction<{ subjectId: string; title: string; content: string; references: string; semesterId: string }>>;
  handleAddTopic: () => void;
  setConfirmDelete: (del: { id: string; type: 'semester' | 'subject' | 'topic' | 'content' } | null) => void;
  topicSearch: string;
  setTopicSearch: (s: string) => void;
  handleGenerateAI: (force?: boolean) => void;
  isGenerating: boolean;
}

export function TopicManager({
  topics,
  subjects,
  semesters,
  editingTopicId,
  setEditingTopicId,
  newTopic,
  setNewTopic,
  handleAddTopic,
  setConfirmDelete,
  topicSearch,
  setTopicSearch,
  handleGenerateAI,
  isGenerating
}: TopicManagerProps) {
  const [selectedTopicId, setSelectedTopicId] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');

  React.useEffect(() => {
    if (editingTopicId) {
      setIsCreating(true);
      setSelectedTopicId(editingTopicId);
    }
  }, [editingTopicId]);

  const filteredTopics = topics.filter(t => (t.title || (t as any).name || '').toLowerCase().includes(topicSearch.toLowerCase()));

  const selectedTopic = topics.find(t => t.id === selectedTopicId);
  const selectedTopicSubject = selectedTopic ? subjects.find(s => s.id === selectedTopic.subjectId) : null;
  const selectedTopicSemester = selectedTopic ? semesters.find(sem => sem.id === selectedTopic.semesterId) : null;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-neutral-900 tracking-tight">Artigos e Resumos Clínicos</h3>
          <p className="text-xs text-[#8E8A82]">Gerencie os tópicos científicos de cada disciplina e gere ou escreva resumos completos de ementas.</p>
        </div>
        <Button 
          size="sm"
          onClick={() => {
            setIsCreating(true);
            setEditingTopicId(null);
            setNewTopic({ subjectId: '', title: '', content: '', references: '', semesterId: '' });
          }}
          className="bg-neutral-950 hover:bg-neutral-900 text-white font-bold text-[10px] uppercase tracking-wider h-10 px-4 rounded-xl shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Adicionar Tópico
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Search list */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden">
            <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA] space-y-3">
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#8E8A82] font-black block">Lista de Tópicos</span>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8E8A82]" />
                <Input 
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                  placeholder="Pesquisar tópico clínico..."
                  className="pl-8.5 h-9 border-[#E2E0D9] bg-[#FBFBFA] hover:bg-[#FBFBFA]/50 focus:border-neutral-400 rounded-lg text-xs font-sans placeholder:text-neutral-400 focus-visible:ring-0 text-neutral-900"
                />
              </div>
            </CardHeader>
            <CardContent className="p-2 space-y-1.5 max-h-[480px] overflow-y-auto scrollbar-thin">
              {filteredTopics.length === 0 ? (
                <div className="text-center py-10 text-[#8E8A82] italic text-xs">Nenhum tópico encontrado.</div>
              ) : (
                filteredTopics.map((t, idx) => {
                  const subjectObj = subjects.find(s => s.id === t.subjectId);
                  const isSelected = t.id === selectedTopicId && !isCreating;
                  const hasSummary = t.content && t.content.length > 100;
                  return (
                    <div 
                      key={`adm-top-${t.id || 'id'}-${idx}`} 
                      onClick={() => {
                        setSelectedTopicId(t.id);
                        setIsCreating(false);
                        setEditingTopicId(null);
                      }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl transition-all border cursor-pointer select-none",
                        isSelected 
                          ? "bg-neutral-900 border-neutral-900 text-white shadow-xs" 
                          : "bg-white border-[#E2E0D9] hover:border-neutral-400 text-neutral-900 hover:bg-[#FBFBFA]"
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-bold text-xs block truncate leading-tight">{t.title || (t as any).name}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn("text-[8.5px] truncate font-mono uppercase", isSelected ? "text-neutral-300" : "text-[#8E8A82]")}>
                            {subjectObj ? subjectObj.name : 'Geral'}
                          </span>
                          <span className={cn(
                            "text-[7px] font-mono px-1.5 py-0.5 rounded-full font-black uppercase shrink-0",
                            hasSummary 
                              ? "bg-emerald-100 text-emerald-850 border border-emerald-200/50" 
                              : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                          )}>
                            {hasSummary ? "Resumo" : "Pendente"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 shrink-0 transition-transform", isSelected ? "text-white translate-x-0.5" : "text-[#8E8A82]")} />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Working Pane */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {isCreating ? (
              <motion.div key="topic-editor" {...transitionProps}>
                <Card className="border-[#E2E0D9] shadow-sm rounded-2xl overflow-hidden bg-white">
                  <CardHeader className="p-5 border-b border-[#E2E0D9] bg-[#FBFBFA] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <CardTitle className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                        {editingTopicId ? 'Editar Resumo' : 'Criar Artigo Clínico'}
                      </CardTitle>
                      <CardDescription className="text-[10px] text-[#8E8A82]">
                        Escreva conteúdos e insira diretrizes de estudo.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5 text-neutral-900 border-neutral-300 bg-white hover:bg-[#FBFBFA] text-[9.5px] uppercase tracking-widest font-black h-8 rounded-full"
                        onClick={() => handleGenerateAI(false)}
                        disabled={isGenerating || !newTopic.title}
                      >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-800" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />}
                        {isGenerating ? 'Escrevendo...' : 'Gerar com IA'}
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={() => setIsCreating(false)} 
                        className="text-[9px] uppercase tracking-widest font-black h-8 px-2"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label htmlFor="top-sub" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Matéria Médica</label>
                        <select 
                          id="top-sub"
                          className="w-full h-10 px-3 border border-[#E2E0D9] rounded-xl bg-white focus:outline-none focus:border-neutral-450 text-xs text-neutral-800"
                          value={newTopic.subjectId}
                          onChange={(e) => {
                            const subject = subjects.find(s => s.id === e.target.value);
                            setNewTopic({ ...newTopic, subjectId: e.target.value, semesterId: subject?.semesterId || '' });
                          }}
                        >
                          <option value="">Selecione uma matéria</option>
                          {subjects.map((s, idx) => <option key={`sub-opt-${s.id || 'id'}-${idx}`} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="top-sem" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Ciclo / Semestre</label>
                        <select 
                          id="top-sem"
                          className="w-full h-10 px-3 border border-[#E2E0D9] rounded-xl bg-white focus:outline-none focus:border-neutral-450 text-xs text-neutral-800"
                          value={newTopic.semesterId}
                          onChange={(e) => setNewTopic({ ...newTopic, semesterId: e.target.value })}
                        >
                          <option value="">Selecione o semestre</option>
                          {semesters.map((s, idx) => <option key={`sem-opt2-${s.id || 'id'}-${idx}`} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="top-title" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Título do Tema Científico</label>
                      <Input 
                        id="top-title"
                        value={newTopic.title} 
                        onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} 
                        placeholder="Ex: Cetoacidose Diabética (CAD)"
                        className="border-[#E2E0D9] focus:border-neutral-400 h-10 rounded-xl text-xs focus-visible:ring-0 text-neutral-900 font-bold"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#E2E0D9]/60">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex bg-[#F0EEE9] p-0.5 rounded-lg border border-[#E2E0D9]/50 shrink-0">
                          <button 
                            type="button"
                            onClick={() => setEditorTab('write')}
                            className={cn(
                              "px-3 py-1 text-[8.5px] uppercase tracking-widest font-black rounded transition-all",
                              editorTab === 'write' ? 'bg-white text-neutral-900 shadow-xs' : 'text-[#8E8A82] hover:text-neutral-850'
                            )}
                          >
                            Escrever (Markdown)
                          </button>
                          <button 
                            type="button"
                            onClick={() => setEditorTab('preview')}
                            className={cn(
                              "px-3 py-1 text-[8.5px] uppercase tracking-widest font-black rounded transition-all",
                              editorTab === 'preview' ? 'bg-white text-neutral-900 shadow-xs' : 'text-[#8E8A82] hover:text-neutral-850'
                            )}
                          >
                            Visualizar Resumo
                          </button>
                        </div>
                        {editingTopicId && (
                          <Button 
                            variant="ghost" 
                            onClick={() => setConfirmDelete({ id: editingTopicId, type: 'content' })} 
                            className="text-red-500 hover:text-red-700 text-[8.5px] uppercase font-black"
                          >
                            Limpar Conteúdo
                          </Button>
                        )}
                      </div>

                      <div className="min-h-[260px] relative">
                        {editorTab === 'write' ? (
                          <Textarea 
                            id="top-content"
                            value={newTopic.content} 
                            onChange={(e) => setNewTopic({ ...newTopic, content: e.target.value })} 
                            placeholder="# Fisiopatologia da Doença..."
                            className="min-h-[260px] w-full border-[#E2E0D9] focus:border-neutral-400 rounded-xl p-4 font-mono text-xs leading-relaxed bg-white focus-visible:ring-0 text-neutral-900"
                          />
                        ) : (
                          <div className="min-h-[260px] p-4 bg-[#FBFBFA] border border-[#E2E0D9] rounded-xl text-xs leading-relaxed font-sans text-neutral-800 prose prose-slate max-w-none max-h-[350px] overflow-y-auto scrollbar-thin markdown-body">
                            {newTopic.content ? (
                              <ReactMarkdown>{newTopic.content}</ReactMarkdown>
                            ) : (
                              <p className="text-[#8E8A82] italic text-center py-10">Escreva algo no editor para visualizar em tempo real.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="top-ref" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Diretrizes Bibliográficas (uma por linha)</label>
                      <Textarea 
                        id="top-ref"
                        value={newTopic.references} 
                        onChange={(e) => setNewTopic({ ...newTopic, references: e.target.value })} 
                        placeholder="Ex: Protocolo de Cetoacidose - SBD (2024)"
                        className="border-[#E2E0D9] focus:border-neutral-450 rounded-xl min-h-[60px] text-xs bg-white focus-visible:ring-0 text-neutral-900"
                      />
                    </div>

                    <div className="flex gap-3 pt-3.5 border-t border-dashed border-[#E2E0D9]">
                      <Button 
                        onClick={() => {
                          handleAddTopic();
                          setIsCreating(false);
                        }} 
                        disabled={!newTopic.subjectId || !newTopic.title}
                        className="flex-1 h-11 bg-neutral-950 hover:bg-neutral-900 text-white text-[10px] uppercase tracking-widest font-black gap-2 rounded-xl"
                      >
                        <Save className="w-4 h-4" /> {editingTopicId ? 'Salvar Artigo Teórico' : 'Criar Artigo Teórico'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : selectedTopic ? (
              <motion.div key="topic-preview" {...transitionProps}>
                <Card className="border-[#E2E0D9] shadow-sm rounded-2xl overflow-hidden bg-white border-l-4 border-l-neutral-900">
                  <CardHeader className="p-5 border-b border-[#E2E0D9] bg-[#FBFBFA] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[8px] font-mono bg-[#F0EEE9] text-[#8E8A82] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                          {selectedTopicSemester?.name || 'Geral'}
                        </span>
                        <span className="text-[8px] font-mono bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                          {selectedTopicSubject?.name || 'Matéria'}
                        </span>
                      </div>
                      <CardTitle className="text-base font-black text-neutral-900 truncate">
                        {selectedTopic.title || (selectedTopic as any).name}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setEditingTopicId(selectedTopic.id);
                          setNewTopic({ 
                            subjectId: selectedTopic.subjectId, 
                            title: selectedTopic.title || (selectedTopic as any).name || '', 
                            content: selectedTopic.content || '', 
                            references: (selectedTopic.references || []).join('\n'),
                            semesterId: selectedTopic.semesterId || ''
                          });
                          setIsCreating(true);
                        }}
                        className="text-[9px] uppercase tracking-widest font-black border-[#E2E0D9] hover:bg-[#F0EEE9] h-8 px-3 rounded-lg"
                      >
                        Editar
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setConfirmDelete({ id: selectedTopic.id, type: 'topic' })}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4 max-h-[500px] overflow-y-auto scrollbar-thin">
                    <div className="space-y-2">
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Resumo Clínico</h4>
                      <div className="bg-[#FBFBFA] p-5 rounded-2xl border border-[#E2E0D9] leading-relaxed font-sans text-xs text-neutral-800 prose prose-slate max-w-none max-h-[300px] overflow-y-auto scrollbar-thin markdown-body">
                        {selectedTopic.content ? (
                          <ReactMarkdown>{selectedTopic.content}</ReactMarkdown>
                        ) : (
                          <div className="text-center py-8 space-y-3">
                            <p className="text-[#8E8A82] italic">Nenhum resumo teórico cadastrado.</p>
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                setEditingTopicId(selectedTopic.id);
                                setNewTopic({ 
                                  subjectId: selectedTopic.subjectId, 
                                  title: selectedTopic.title || (selectedTopic as any).name || '', 
                                  content: selectedTopic.content || '', 
                                  references: (selectedTopic.references || []).join('\n'),
                                  semesterId: selectedTopic.semesterId || ''
                                });
                                setIsCreating(true);
                              }}
                              className="text-[9px] uppercase tracking-widest font-black h-8"
                            >
                              Adicionar Resumo Teórico
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-dashed border-[#E2E0D9]">
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Protocolos & Diretrizes</h4>
                      {(!selectedTopic.references || selectedTopic.references.length === 0) ? (
                        <p className="text-xs text-[#8E8A82] italic">Nenhuma diretriz bibliográfica cadastrada.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {selectedTopic.references.map((ref, idx) => (
                            <div key={idx} className="text-xs text-neutral-700 flex items-start gap-2 bg-[#FBFBFA] border border-[#E2E0D9] p-2.5 rounded-xl">
                              <Book className="w-3.5 h-3.5 text-neutral-650 mt-0.5 shrink-0" />
                              <span className="font-bold">{ref}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="topic-empty" {...transitionProps}>
                <Card className="border-[#E2E0D9] border-dashed shadow-xs rounded-2xl bg-white p-12 text-center flex flex-col items-center justify-center min-h-[250px]">
                  <div className="p-3 bg-neutral-100 rounded-full text-neutral-500 mb-3.5">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider mb-1">Artigos Teóricos</h4>
                  <p className="text-xs text-[#8E8A82] max-w-sm leading-relaxed">
                    Selecione um tópico na lista lateral esquerda para editar referências acadêmicas, redigir resumos clínicos estruturados ou gerar resumos automáticos com IA.
                  </p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. QUESTION MANAGER COMPONENT (DUAL PANE WORKSPACE)
// ==========================================
interface QuestionManagerProps {
  topics: Topic[];
  adminQuestions: Question[];
  loadingQuestions: boolean;
  newQuestion: { topicId: string; text: string; options: string[]; correctOptionIndex: number; explanation: string; source: string };
  setNewQuestion: React.Dispatch<React.SetStateAction<{ topicId: string; text: string; options: string[]; correctOptionIndex: number; explanation: string; source: string }>>;
  handleAddQuestion: () => void;
  selectedTopicForManage: string;
  setSelectedTopicForManage: (topicId: string) => void;
  handleDeleteAdminQuestion: (id: string) => void;
  questionsSubTab: 'manage' | 'create';
  setQuestionsSubTab: (t: 'manage' | 'create') => void;
}

export function QuestionManager({
  topics,
  adminQuestions,
  loadingQuestions,
  newQuestion,
  setNewQuestion,
  handleAddQuestion,
  selectedTopicForManage,
  setSelectedTopicForManage,
  handleDeleteAdminQuestion,
  questionsSubTab,
  setQuestionsSubTab
}: QuestionManagerProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  return (
    <Card className="border-[#E2E0D9] shadow-sm rounded-2xl overflow-hidden max-w-7xl mx-auto w-full bg-white">
      <CardHeader className="p-5 border-b border-[#E2E0D9] bg-[#FBFBFA] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <CardTitle className="text-sm font-black text-neutral-900 uppercase tracking-wide">Banco de Questões Clínicas</CardTitle>
          <CardDescription className="text-xs text-[#8E8A82]">
            Insira novas questões de residência ou faça a auditoria do banco existente.
          </CardDescription>
        </div>
        <div className="flex bg-[#F0EEE9] p-0.5 rounded-xl border border-[#E2E0D9]/50 shrink-0 self-stretch sm:self-auto select-none">
          <button 
            type="button"
            onClick={() => setQuestionsSubTab('manage')}
            className={cn(
              "flex-1 sm:flex-initial text-[9.5px] uppercase tracking-widest font-black h-8 px-4 rounded-lg transition-all cursor-pointer",
              questionsSubTab === 'manage' ? "bg-white text-neutral-900 shadow-sm font-bold" : "text-[#8E8A82] hover:text-neutral-900"
            )}
          >
            Auditar Banco
          </button>
          <button 
            type="button"
            onClick={() => setQuestionsSubTab('create')}
            className={cn(
              "flex-1 sm:flex-initial text-[9.5px] uppercase tracking-widest font-black h-8 px-4 rounded-lg transition-all cursor-pointer",
              questionsSubTab === 'create' ? "bg-white text-neutral-900 shadow-sm font-bold" : "text-[#8E8A82] hover:text-neutral-900"
            )}
          >
            Nova Questão
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <AnimatePresence mode="wait">
          {questionsSubTab === 'create' ? (
            <motion.div key="create-quest" {...transitionProps} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="quest-topic" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Tema Clínico Correspondente</label>
                  <select 
                    id="quest-topic"
                    className="w-full h-10 px-3 border border-[#E2E0D9] rounded-xl bg-white focus:outline-none focus:border-neutral-450 text-xs text-neutral-800"
                    value={newQuestion.topicId}
                    onChange={(e) => setNewQuestion({ ...newQuestion, topicId: e.target.value })}
                  >
                    <option value="">Selecione o tema correspondente</option>
                    {topics.map((t, idx) => <option key={`top-opt-${t.id || 'id'}-${idx}`} value={t.id}>{t.title || (t as any).name || ''}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="quest-source" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Fonte da Questão (Ano / Instituição)</label>
                  <Input 
                    id="quest-source"
                    value={newQuestion.source} 
                    onChange={(e) => setNewQuestion({ ...newQuestion, source: e.target.value })} 
                    placeholder="Ex: USP-SP 2024"
                    className="border-[#E2E0D9] focus:border-neutral-400 h-10 rounded-xl text-xs focus-visible:ring-0 text-neutral-900 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="quest-text" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Enunciado Principal</label>
                <Textarea 
                  id="quest-text"
                  value={newQuestion.text} 
                  onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })} 
                  placeholder="Insira o enunciado do caso clínico ou pergunta de residência médica..."
                  className="border-[#E2E0D9] focus:border-neutral-400 rounded-xl min-h-[100px] text-xs leading-relaxed focus-visible:ring-0 text-neutral-900"
                />
              </div>

              <div className="space-y-2.5">
                <label className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Alternativas de Resposta (Marque o gabarito)</label>
                <div className="grid grid-cols-1 gap-2.5">
                  {newQuestion.options.map((opt, i) => {
                    const isCorrect = newQuestion.correctOptionIndex === i;
                    const letter = String.fromCharCode(65 + i);
                    return (
                      <div 
                        key={i} 
                        onClick={() => setNewQuestion({ ...newQuestion, correctOptionIndex: i })}
                        className={cn(
                          "flex gap-3 items-center px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none",
                          isCorrect 
                            ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300/20" 
                            : "bg-[#FBFBFA] border-[#E2E0D9] hover:border-neutral-450"
                        )}
                      >
                        <span className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors",
                          isCorrect ? "bg-emerald-600 text-white" : "bg-neutral-900 text-white"
                        )}>
                          {letter}
                        </span>
                        
                        <Input 
                          id={`opt-input-${i}`}
                          value={opt} 
                          onClick={(e) => e.stopPropagation()} 
                          onChange={(e) => {
                            const opts = [...newQuestion.options];
                            opts[i] = e.target.value;
                            setNewQuestion({ ...newQuestion, options: opts });
                          }}
                          placeholder={`Alternativa ${letter}`}
                          className="border-none bg-transparent focus-visible:ring-0 h-8 text-xs flex-1 text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
                        />
                        
                        <div className="flex items-center gap-1.5 px-3 border-l border-[#E2E0D9]/80 shrink-0">
                          <input 
                            type="radio" 
                            id={`correct-radio-${i}`}
                            name="correct-option-radio" 
                            className="w-4 h-4 accent-emerald-600 cursor-pointer"
                            checked={isCorrect}
                            onChange={() => setNewQuestion({ ...newQuestion, correctOptionIndex: i })}
                          />
                          <label htmlFor={`correct-radio-${i}`} className="text-[8px] uppercase tracking-widest font-black text-[#8E8A82] cursor-pointer ml-1">Correta</label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="quest-exp" className="text-[9px] uppercase tracking-wider font-black text-[#8E8A82] block">Comentário Clínico / Resolução Comentada</label>
                <Textarea 
                  id="quest-exp"
                  value={newQuestion.explanation} 
                  onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })} 
                  placeholder="Escreva a justificativa fisiopatológica, diagnóstica ou terapêutica das alternativas..."
                  className="border-[#E2E0D9] focus:border-neutral-400 rounded-xl min-h-[80px] text-xs focus-visible:ring-0 text-neutral-900"
                />
              </div>

              <Button onClick={handleAddQuestion} className="w-full h-11 bg-neutral-950 hover:bg-neutral-900 text-white text-xs uppercase tracking-widest font-black gap-2 rounded-xl mt-4 cursor-pointer">
                <Save className="w-4 h-4" /> Cadastrar Questão no Banco
              </Button>
            </motion.div>
          ) : (
            <motion.div key="manage-quest" {...transitionProps} className="space-y-4">
              {/* Dual-Pane View inside tab */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left pane: Filter selector + list */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="p-3 bg-[#FBFBFA] border border-[#E2E0D9] rounded-xl space-y-2">
                    <label htmlFor="filter-top" className="text-[9.5px] uppercase tracking-wider font-black text-neutral-800 block">Tema do Filtro</label>
                    <select 
                      id="filter-top"
                      className="w-full h-9 px-3 border border-[#E2E0D9] rounded-lg bg-white focus:outline-none focus:border-neutral-400 text-xs text-neutral-800"
                      value={selectedTopicForManage}
                      onChange={(e) => {
                        setSelectedTopicForManage(e.target.value);
                        setSelectedQuestion(null);
                      }}
                    >
                      <option value="">Todas as Questões (Últimas 30)</option>
                      {topics.map((t, idx) => <option key={`top-opt2-${t.id || 'id'}-${idx}`} value={t.id}>{t.title || (t as any).name || ''}</option>)}
                    </select>
                  </div>

                  <Card className="border-[#E2E0D9] shadow-none rounded-xl bg-white overflow-hidden">
                    <CardHeader className="p-3 border-b border-[#E2E0D9] bg-[#FBFBFA]">
                      <span className="text-[9px] uppercase tracking-widest font-mono text-[#8E8A82] font-black">Questões Encontradas</span>
                    </CardHeader>
                    <CardContent className="p-2 space-y-1.5 max-h-[380px] overflow-y-auto scrollbar-thin">
                      {loadingQuestions ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-neutral-800" /></div>
                      ) : adminQuestions.length === 0 ? (
                        <div className="text-center py-10 text-[#8E8A82] italic text-xs">Nenhuma questão cadastrada para este tópico.</div>
                      ) : (
                        adminQuestions.map((q, idx) => {
                          const isSelected = selectedQuestion?.id === q.id;
                          return (
                            <div 
                              key={`admin-q-${q.id || 'id'}-${idx}`} 
                              onClick={() => setSelectedQuestion(q)}
                              className={cn(
                                "p-2.5 rounded-lg border text-left cursor-pointer transition-all select-none",
                                isSelected 
                                  ? "bg-neutral-900 border-neutral-900 text-white shadow-xs" 
                                  : "bg-white border-[#E2E0D9] hover:border-neutral-400 hover:bg-[#FBFBFA]"
                              )}
                            >
                              <p className="text-[11px] font-bold line-clamp-2 leading-tight mb-1">{q.text}</p>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[7.5px] font-mono px-1.5 py-0.5 rounded uppercase font-black tracking-wider border",
                                  isSelected ? "bg-neutral-800 border-neutral-700 text-neutral-300" : "bg-neutral-50 border-neutral-200 text-neutral-500"
                                )}>
                                  {q.source || 'Internato'}
                                </span>
                                <span className="text-[8px] font-mono font-black text-emerald-600">Gabarito: {String.fromCharCode(65 + q.correctOptionIndex)}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Pane: Question Detailed auditing card */}
                <div className="lg:col-span-7">
                  <AnimatePresence mode="wait">
                    {selectedQuestion ? (
                      <motion.div key="quest-detail" {...transitionProps}>
                        <Card className="border-[#E2E0D9] shadow-none rounded-xl bg-[#FBFBFA]/50 border-l-4 border-l-neutral-900">
                          <CardHeader className="p-4 border-b border-[#E2E0D9] bg-white flex flex-row justify-between items-center shrink-0">
                            <div>
                              <span className="text-[8.5px] font-mono bg-[#F0EEE9] text-[#8E8A82] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                                {selectedQuestion.source || 'USP-SP / MEDICINA'}
                              </span>
                              <span className="text-[8.5px] font-mono text-emerald-700 ml-2 font-black">Gabarito: {String.fromCharCode(65 + selectedQuestion.correctOptionIndex)}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                handleDeleteAdminQuestion(selectedQuestion.id!);
                                setSelectedQuestion(null);
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-[9px] uppercase tracking-widest font-black h-8 px-2.5"
                            >
                              Excluir Questão
                            </Button>
                          </CardHeader>
                          <CardContent className="p-4 space-y-4 max-h-[440px] overflow-y-auto scrollbar-thin">
                            {/* Question context body */}
                            <div className="space-y-1.5">
                              <h4 className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Enunciado</h4>
                              <p className="text-xs text-neutral-900 leading-relaxed font-medium bg-white p-3.5 border border-[#E2E0D9] rounded-xl">{selectedQuestion.text}</p>
                            </div>

                            {/* Alternatives visual review */}
                            <div className="space-y-2">
                              <h4 className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Gabaritos / Alternativas</h4>
                              <div className="space-y-1.5">
                                {selectedQuestion.options.map((opt, i) => {
                                  const isCorrect = selectedQuestion.correctOptionIndex === i;
                                  return (
                                    <div 
                                      key={i} 
                                      className={cn(
                                        "p-2.5 rounded-xl border text-xs flex items-center gap-2.5",
                                        isCorrect 
                                          ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold" 
                                          : "bg-white border-[#E2E0D9] text-neutral-700"
                                      )}
                                    >
                                      <span className={cn(
                                        "w-5 h-5 rounded-full flex items-center justify-center text-[9.5px] font-black shrink-0",
                                        isCorrect ? "bg-emerald-650 text-white" : "bg-neutral-800 text-white"
                                      )}>
                                        {String.fromCharCode(65 + i)}
                                      </span>
                                      <span className="flex-1 truncate">{opt}</span>
                                      {isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Comments explanation */}
                            <div className="space-y-1.5 pt-2 border-t border-dashed border-[#E2E0D9]">
                              <h4 className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Justificativa e Comentário Clínico</h4>
                              <p className="text-xs text-neutral-700 leading-relaxed bg-white border border-[#E2E0D9] p-3.5 rounded-xl italic">
                                {selectedQuestion.explanation || 'Comentário em desenvolvimento pelo corpo docente.'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ) : (
                      <motion.div key="quest-empty" {...transitionProps}>
                        <Card className="border-[#E2E0D9] border-dashed shadow-xs rounded-2xl bg-white p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                          <div className="p-3 bg-neutral-100 rounded-full text-neutral-500 mb-3.5">
                            <HelpCircle className="w-6 h-6" />
                          </div>
                          <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider mb-1">Auditoria de Questões</h4>
                          <p className="text-xs text-[#8E8A82] max-w-sm leading-relaxed">
                            Selecione um tema de filtro na barra esquerda e clique em uma das questões listadas para conferir gabaritos, comentários clínicos ou excluí-la de forma definitiva.
                          </p>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ==========================================
// 5. MODERATION MANAGER COMPONENT
// ==========================================
interface ModerationManagerProps {
  searchEmail: string;
  setSearchEmail: (s: string) => void;
  isSearchingUser: boolean;
  userSearchError: string | null;
  foundUser: any;
  updatingUser: boolean;
  handleSearchUser: (e?: React.FormEvent) => void;
  handleToggleUserPremium: (targetUser: any) => void;
  handleChangeUserPlan: (targetUser: any, plan: string) => void;
  recentUsers: any[];
}

export function ModerationManager({
  searchEmail,
  setSearchEmail,
  isSearchingUser,
  userSearchError,
  foundUser,
  updatingUser,
  handleSearchUser,
  handleToggleUserPremium,
  handleChangeUserPlan,
  recentUsers
}: ModerationManagerProps) {
  // Simple quick counts
  const premiumUsersCount = recentUsers.filter(u => u.isPremium).length;
  const conversionRate = recentUsers.length > 0 ? Math.round((premiumUsersCount / recentUsers.length) * 100) : 0;

  return (
    <Card className="border-[#E2E0D9] shadow-sm rounded-2xl overflow-hidden max-w-7xl mx-auto w-full bg-white">
      <CardHeader className="p-5 border-b border-[#E2E0D9] bg-[#FBFBFA]">
        <div className="space-y-1">
          <CardTitle className="text-sm font-black text-neutral-900 uppercase tracking-wide">Moderação de Estudantes & Assinantes</CardTitle>
          <CardDescription className="text-xs text-[#8E8A82]">
            Busque por alunos cadastrados, verifique planos de acesso, e conceda ou revogue cotas premium.
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="p-5 space-y-6">
        {/* Quick Mini Status Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-700">Total de Usuários</span>
            <span className="font-mono text-sm font-black text-neutral-900">{recentUsers.length} Alunos</span>
          </div>
          <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">Assinantes PRO</span>
            <span className="font-mono text-sm font-black text-amber-900">{premiumUsersCount} Contas</span>
          </div>
          <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Taxa de Conversão</span>
            <span className="font-mono text-sm font-black text-emerald-900">{conversionRate}%</span>
          </div>
        </div>

        {/* Search Input Area */}
        <form onSubmit={handleSearchUser} className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-3.5 w-3.5 text-[#8E8A82]" />
            <Input 
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Digite o e-mail exato do aluno..."
              className="pl-9.5 h-11 border-[#E2E0D9] focus:border-neutral-450 rounded-xl bg-white text-xs placeholder:text-neutral-400 focus-visible:ring-0 text-neutral-900 font-medium"
            />
          </div>
          <Button 
            type="submit" 
            disabled={isSearchingUser || !searchEmail.trim()}
            className="h-11 px-5 bg-neutral-950 hover:bg-neutral-900 text-white text-[10px] uppercase tracking-widest font-black rounded-xl shrink-0 gap-1.5 cursor-pointer transition-colors"
          >
            {isSearchingUser ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              'Buscar Aluno'
            )}
          </Button>
        </form>

        {userSearchError && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 animate-fade-in flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{userSearchError}</span>
          </div>
        )}

        {/* Found User Row Details */}
        {foundUser && (
          <div className="p-5 bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border",
                  getAvatarColorClass(foundUser.displayName || 'S')
                )}>
                  {foundUser.displayName ? foundUser.displayName.charAt(0).toUpperCase() : '?'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-neutral-900">{foundUser.displayName || 'Estudante Sem Nome'}</h4>
                  <p className="text-[11px] font-mono text-[#8E8A82] flex items-center gap-1 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-[#8E8A82]" />
                    {foundUser.email}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 self-end sm:self-auto select-none">
                <span className={cn(
                  "text-[8.5px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full border font-black",
                  foundUser.isPremium 
                    ? 'bg-amber-100 border-amber-300 text-amber-800' 
                    : 'bg-neutral-100 border-neutral-300 text-neutral-500'
                )}>
                  {foundUser.isPremium ? '★ PREMIUM' : 'GRATUITO'}
                </span>
                {foundUser.premiumPlan && (
                  <span className="text-[8.5px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase font-black tracking-wider">
                    {foundUser.premiumPlan.replace('med_internato_', '')}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-dashed border-[#E2E0D9]">
              <div className="space-y-1.5">
                <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82] block">Nível de Assinatura</span>
                <Button 
                  onClick={() => handleToggleUserPremium(foundUser)}
                  disabled={updatingUser}
                  className={cn(
                    "w-full h-10 text-xs font-black uppercase tracking-wider rounded-xl border cursor-pointer transition-colors",
                    foundUser.isPremium 
                      ? 'bg-white border-red-200 text-red-600 hover:bg-red-50' 
                      : 'bg-neutral-950 hover:bg-neutral-900 text-white border-transparent'
                  )}
                >
                  {foundUser.isPremium ? 'Revogar Acesso Premium' : 'Liberar Acesso Premium'}
                </Button>
              </div>

              <div className="space-y-1.5">
                <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82] block">Plano de Cobrança</span>
                <div className="flex gap-1.5">
                  {['combo_ouro', 'med_internato_premium', 'med_revise_pro'].map((p) => {
                    const isActive = foundUser.premiumPlan === p;
                    return (
                      <Button
                        key={p}
                        size="sm"
                        onClick={() => handleChangeUserPlan(foundUser, p)}
                        disabled={updatingUser || isActive}
                        variant="outline"
                        className={cn(
                          "flex-1 text-[8.5px] h-10 font-mono uppercase truncate rounded-lg transition-all",
                          isActive 
                            ? 'bg-neutral-900 text-white border-neutral-900 font-bold' 
                            : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                        )}
                      >
                        {p.replace('med_internato_', '').replace('_', ' ')}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Registered Users list */}
        <div className="space-y-3.5 pt-4 border-t border-[#E2E0D9]/75">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-neutral-800" />
            <h3 className="text-xs font-black uppercase text-neutral-800 tracking-wide">
              Estudantes Ativos Recentemente
            </h3>
          </div>
          
          {recentUsers.length === 0 ? (
            <div className="text-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-600 mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto scrollbar-thin pr-1 select-none">
              {recentUsers.map((u, uIdx) => (
                <div key={`usr-admin-${u.id || 'id'}-${uIdx}`} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-white border border-[#E2E0D9] hover:border-neutral-450 rounded-xl transition-all gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 border",
                      getAvatarColorClass(u.displayName || 'S')
                    )}>
                      {u.displayName ? u.displayName.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-xs text-neutral-900 truncate leading-tight">{u.displayName || 'Sem Nome'}</p>
                      <p className="text-[10px] text-[#8E8A82] font-mono truncate">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end shrink-0">
                      <span className={cn(
                        "text-[8px] font-mono px-2 py-0.5 rounded-full border font-black uppercase tracking-wider",
                        u.isPremium 
                          ? 'bg-amber-50 border-amber-200 text-amber-700' 
                          : 'bg-neutral-50 border-neutral-200 text-neutral-400'
                      )}>
                        {u.isPremium ? 'PRO' : 'FREE'}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleUserPremium(u)}
                      disabled={updatingUser}
                      className={cn(
                        "h-7 px-2.5 text-[8px] uppercase tracking-wider font-black cursor-pointer rounded-lg border-neutral-200 hover:bg-neutral-50"
                      )}
                    >
                      {u.isPremium ? 'Rebaixar' : 'Ativar Pro'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// 6. ADMIN DASHBOARD COMPONENT
// ==========================================
interface AdminDashboardProps {
  semesters: Semester[];
  subjects: Subject[];
  topics: Topic[];
  recentUsers: any[];
  setActiveTab: (t: string) => void;
  handleToggleUserPremium: (u: any) => void;
  updatingUser: boolean;
}

export function AdminDashboard({
  semesters,
  subjects,
  topics,
  recentUsers,
  setActiveTab,
  handleToggleUserPremium,
  updatingUser
}: AdminDashboardProps) {
  const totalSemesters = semesters.length;
  const totalSubjects = subjects.length;
  const totalTopics = topics.length;
  
  const aiGeneratedCount = topics.filter(t => t.content && !t.content.includes('Conteúdo em desenvolvimento') && t.content.trim().length > 100).length;
  const aiPercentage = totalTopics > 0 ? Math.round((aiGeneratedCount / totalTopics) * 100) : 0;

  const premiumUsersCount = recentUsers.filter(u => u.isPremium).length;

  const semStats = semesters.map(sem => {
    const subs = subjects.filter(s => s.semesterId === sem.id);
    const subIds = subs.map(s => s.id);
    const tops = topics.filter(t => subIds.includes(t.subjectId));
    return {
      ...sem,
      subjectsCount: subs.length,
      topicsCount: tops.length,
    };
  });

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        {/* Semesters */}
        <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden hover:border-neutral-450 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Ciclos Letivos</span>
              <p className="text-xl font-black text-neutral-900 font-mono">{totalSemesters}</p>
              <p className="text-[9.5px] text-neutral-400 font-medium">Semestres de internação</p>
            </div>
            <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-800 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Subjects */}
        <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden hover:border-neutral-450 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Matérias Médicas</span>
              <p className="text-xl font-black text-neutral-900 font-mono">{totalSubjects}</p>
              <p className="text-[9.5px] text-neutral-400 font-medium">Disciplinas médicas ativas</p>
            </div>
            <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-800 shrink-0">
              <Book className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Topics */}
        <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden hover:border-neutral-450 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Artigos Clínicos</span>
              <p className="text-xl font-black text-neutral-900 font-mono">
                {totalTopics}
                {totalTopics > 0 && (
                  <span className="text-[11px] font-black text-emerald-600 ml-1.5 font-sans">
                    ({aiPercentage}% IA)
                  </span>
                )}
              </p>
              <p className="text-[9.5px] text-neutral-400 font-medium">{aiGeneratedCount} resumos completos</p>
            </div>
            <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-800 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Premium Users */}
        <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden hover:border-neutral-450 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Estudantes Cadastrados</span>
              <p className="text-xl font-black text-neutral-900 font-mono">{recentUsers.length}</p>
              <p className="text-[9.5px] text-amber-600 font-black">{premiumUsersCount} Contas Premium</p>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Two Columns Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Curriculum Coverage Status */}
          <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white">
            <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA]">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-neutral-900 shrink-0" />
                <CardTitle className="text-xs font-black text-neutral-950 uppercase tracking-wide">Mapeamento Curricular por Semestre</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              {semStats.length === 0 ? (
                <div className="text-center py-10 text-[#8E8A82] text-xs italic">
                  Nenhum semestre letivo cadastrado para distribuição.
                </div>
              ) : (
                semStats.map((sem, idx) => {
                  const maxTopicsExpected = Math.max(...semStats.map(s => s.topicsCount), 1);
                  const progressWidth = Math.min((sem.topicsCount / maxTopicsExpected) * 100, 100);
                  
                  return (
                    <div key={`stat-sem-${sem.id || 'id'}-${idx}`} className="p-3 bg-[#FBFBFA] border border-[#E2E0D9] rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-neutral-900 text-xs block leading-tight">{sem.name}</span>
                          <span className="text-[8.5px] font-mono uppercase text-[#8E8A82] mt-0.5 block">Ordem #{sem.number}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9.5px] font-mono font-black bg-neutral-100 border border-neutral-200 text-neutral-800 px-2 py-0.5 rounded-full">
                            {sem.subjectsCount} mat. • {sem.topicsCount} tópicos
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="w-full bg-[#E2E0D9]/40 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-neutral-900 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${progressWidth || 4}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[8px] text-[#8E8A82] font-black font-mono">
                          <span>Volume Relativo de Estudos</span>
                          <span>{sem.topicsCount} Temas de Residência</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Quick Student Activity */}
          <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white">
            <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA] flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-neutral-900 shrink-0" />
                <CardTitle className="text-xs font-black text-neutral-950 uppercase tracking-wide">Estudantes Recentes</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setActiveTab('moderation')}
                className="text-[9px] uppercase tracking-widest font-black text-neutral-900 hover:bg-neutral-100 rounded-lg h-8 cursor-pointer"
              >
                Auditar Todos
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              {recentUsers.length === 0 ? (
                <div className="text-center py-6 text-[#8E8A82] text-xs italic">Nenhum aluno cadastrado.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recentUsers.slice(0, 4).map((u, uIdx) => (
                    <div key={`usr-slice-${u.id || 'id'}-${uIdx}`} className="p-3 bg-[#FBFBFA] border border-[#E2E0D9] rounded-xl flex items-center justify-between">
                      <div className="min-w-0 pr-2 flex items-center gap-2">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 border",
                          getAvatarColorClass(u.displayName || 'S')
                        )}>
                          {u.displayName ? u.displayName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-neutral-950 truncate leading-tight">{u.displayName || 'Sem Nome'}</p>
                          <p className="text-[9.5px] text-[#8E8A82] font-mono truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          "text-[7.5px] font-mono px-1.5 py-0.5 rounded-full border font-black uppercase tracking-wider",
                          u.isPremium 
                            ? 'bg-amber-50 border-amber-200 text-amber-700' 
                            : 'bg-neutral-50 border-neutral-200 text-neutral-400'
                        )}>
                          {u.isPremium ? 'PRO' : 'FREE'}
                        </span>
                        <Button 
                          size="sm"
                          variant="outline"
                          disabled={updatingUser}
                          onClick={() => handleToggleUserPremium(u)}
                          className="h-7 text-[8px] uppercase tracking-wider font-black px-2 cursor-pointer border-neutral-200"
                        >
                          {u.isPremium ? 'Bloquear' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Actions Panel */}
          <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white">
            <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-neutral-900 shrink-0" />
                <CardTitle className="text-xs font-black text-neutral-950 uppercase tracking-wide">Central de Atalhos Rápidos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              <button 
                onClick={() => setActiveTab('semesters')}
                className="w-full p-3 bg-[#FBFBFA] hover:bg-neutral-50 border border-[#E2E0D9] hover:border-neutral-450 rounded-xl flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-100 rounded-lg text-neutral-800 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-neutral-900">Gerenciar Semestres</p>
                    <p className="text-[9px] text-[#8E8A82]">Configure os ciclos letivos do internato</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8E8A82] group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              <button 
                onClick={() => setActiveTab('subjects')}
                className="w-full p-3 bg-[#FBFBFA] hover:bg-neutral-50 border border-[#E2E0D9] hover:border-neutral-450 rounded-xl flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-100 rounded-lg text-neutral-800 shrink-0">
                    <Book className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-neutral-900">Ementas e Disciplinas</p>
                    <p className="text-[9px] text-[#8E8A82]">Adicione ou organize as disciplinas médicas</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8E8A82] group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              <button 
                onClick={() => setActiveTab('topics')}
                className="w-full p-3 bg-[#FBFBFA] hover:bg-neutral-50 border border-[#E2E0D9] hover:border-neutral-450 rounded-xl flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-100 rounded-lg text-neutral-850 shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-neutral-900">Artigos & Resumos Clínicos</p>
                    <p className="text-[9px] text-[#8E8A82]">Escreva resumos ou gere com Inteligência Artificial</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8E8A82] group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              <button 
                onClick={() => setActiveTab('questions')}
                className="w-full p-3 bg-[#FBFBFA] hover:bg-neutral-50 border border-[#E2E0D9] hover:border-neutral-450 rounded-xl flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-100 rounded-lg text-neutral-800 shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-neutral-900">Banco de Questões</p>
                    <p className="text-[9px] text-[#8E8A82]">Gerencie perguntas, alternativas e justificativas</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8E8A82] group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              <button 
                onClick={() => setActiveTab('moderation')}
                className="w-full p-3 bg-[#FBFBFA] hover:bg-neutral-50 border border-[#E2E0D9] hover:border-neutral-450 rounded-xl flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-100 rounded-lg text-neutral-800 shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-neutral-900">Moderação de Estudantes</p>
                    <p className="text-[9px] text-[#8E8A82]">Busque e libere planos premium aos alunos</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8E8A82] group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 7. REFERRAL LOGS MANAGER COMPONENT
// ==========================================
import { db, collection, query, orderBy, limit, getDocs } from '../../../firebase';

export function ReferralLogsManager() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(collection(db, 'referralLogs'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(fetched);
      } catch (err) {
        console.error('Error fetching referral logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight">Logs de Indicações (Referral)</h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium">Acompanhe quem utilizou as chaves de compartilhamento e os bônus concedidos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLoading(true)} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-neutral-400" /></div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 font-mono text-sm bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
          Nenhum log de indicação encontrado.
        </div>
      ) : (
        <div className="grid gap-3">
          {logs.map((log: any) => (
            <div key={log.id} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-neutral-900">{log.usedByName}</span>
                  <span className="text-xs text-neutral-500">({log.usedByEmail})</span>
                </div>
                <p className="text-xs text-neutral-600 font-medium">
                  Utilizou a chave <span className="font-mono bg-neutral-100 px-1 rounded font-bold text-indigo-600">{log.referralKey}</span> de <span className="font-bold text-neutral-800">{log.friendName}</span> ({log.friendEmail}).
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-mono bg-neutral-100 px-2 py-0.5 rounded text-neutral-600 uppercase tracking-widest border border-neutral-200">
                    Tipo: {log.type === 'premium_activation' ? 'Assinatura Premium' : 'Ativação Imediata'}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {log.createdAt ? new Date(log.createdAt.seconds ? log.createdAt.seconds * 1000 : log.createdAt).toLocaleString('pt-BR') : 'Data não disponível'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
