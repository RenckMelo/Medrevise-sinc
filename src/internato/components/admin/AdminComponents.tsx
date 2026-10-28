import React, { useState, useEffect } from 'react';
import { Subject, Topic, Question, Semester } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Book from 'lucide-react/dist/esm/icons/book.js';
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle.js';
import Calendar from 'lucide-react/dist/esm/icons/calendar.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js';
import Database from 'lucide-react/dist/esm/icons/database.js';
import User from 'lucide-react/dist/esm/icons/user.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Mail from 'lucide-react/dist/esm/icons/mail.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import Award from 'lucide-react/dist/esm/icons/award.js';
import Edit3 from 'lucide-react/dist/esm/icons/edit-3.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import ListChecks from 'lucide-react/dist/esm/icons/list-checks.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import Layers from 'lucide-react/dist/esm/icons/layers.js';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import Activity from 'lucide-react/dist/esm/icons/activity.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import Wrench from 'lucide-react/dist/esm/icons/wrench.js';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js';
import UploadCloud from 'lucide-react/dist/esm/icons/upload-cloud.js';
import DownloadCloud from 'lucide-react/dist/esm/icons/download-cloud.js';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { generateQuestions, getUserFocusSettings } from '../../services/geminiService';
import { db, collection, addDoc, getDocs, where, query, deleteDoc, doc, limit, orderBy, auth } from '../../firebase';

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
  handleFixUserSchedule: (targetUser: any) => void;
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
  handleFixUserSchedule,
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
                  getAvatarColorClass(foundUser.displayName || (foundUser as any).name || (foundUser as any).nome || (foundUser.email || '').split('@')[0] || 'S')
                )}>
                  {(foundUser.displayName || (foundUser as any).name || (foundUser as any).nome || (foundUser.email || '').split('@')[0] || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-neutral-900">
                    {foundUser.displayName || (foundUser as any).name || (foundUser as any).nome || (foundUser.email || '').split('@')[0] || 'Aluno Visitante (Anônimo)'}
                  </h4>
                  <p className="text-[11px] font-mono text-[#8E8A82] flex items-center gap-1 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-[#8E8A82]" />
                    {foundUser.email || 'Acesso de Visitante (Sem e-mail)'}
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

              <div className="space-y-1.5 col-span-1 sm:col-span-2 pt-3 border-t border-dashed border-[#E2E0D9]">
                <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82] block">Ações Especiais de Suporte</span>
                <Button 
                  onClick={() => handleFixUserSchedule(foundUser)}
                  disabled={updatingUser}
                  className="w-full h-10 text-xs font-black uppercase tracking-wider rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <Wrench className="w-4 h-4" />
                  Reparar e Reestruturar Cronograma (11 semanas / Sem Choques / Manter Progresso)
                </Button>
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
                    {(() => {
                      const finalName = u.displayName || u.name || u.nome || (u.email || u.emailAddress || '').split('@')[0] || 'Aluno Visitante (Anônimo)';
                      const finalEmail = u.email || u.emailAddress || u.email_address || u.userEmail || 'Acesso de Visitante (Sem e-mail)';
                      return (
                        <>
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 border",
                            getAvatarColorClass(finalName)
                          )}>
                            {finalName.charAt(0).toUpperCase()}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-bold text-xs text-neutral-900 truncate leading-tight">{finalName}</p>
                            <p className="text-[10px] text-[#8E8A82] font-mono truncate">{finalEmail}</p>
                          </div>
                        </>
                      );
                    })()}
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
  const [isSeedingAll, setIsSeedingAll] = useState(false);
  const [seedingProgress, setSeedingProgress] = useState(0);
  const [seedingLogs, setSeedingLogs] = useState<string>('');
  const [seedingCurrentTopic, setSeedingCurrentTopic] = useState<string>('');
  const [seedingDelaySec, setSeedingDelaySec] = useState<number>(8);

  const startSeedingAll = async () => {
    if (isSeedingAll) {
      setIsSeedingAll(false);
      setSeedingLogs(p => p + '\n[Modo Noturno] Cancelamento solicitado pelo usuário. Finalizando tópico atual e parando...');
      return;
    }

    setIsSeedingAll(true);
    setSeedingProgress(0);
    setSeedingCurrentTopic('Iniciando...');
    setSeedingLogs('==== SEEDER EM MASSA MODO NOTURNO ====\nComeçando análise dos tópicos cadastrados...\n');

    const topicsToProcess = [...topics];
    let processed = 0;

    for (let i = 0; i < topicsToProcess.length; i++) {
      // Create a closure-safe check for cancellation
      let shouldContinue = true;
      setIsSeedingAll(current => {
        if (!current) shouldContinue = false;
        return current;
      });
      if (!shouldContinue) {
        break;
      }

      const topic = topicsToProcess[i];
      setSeedingCurrentTopic(topic.title);
      setSeedingLogs(prev => {
        const lines = prev.split('\n');
        const truncated = lines.slice(-20).join('\n'); // keep memory usage low
        return truncated + `\n\n[Tópico ${i+1}/${topicsToProcess.length}] Processando: "${topic.title}"`;
      });

      try {
        const subject = subjects.find(s => s.id === topic.subjectId);
        const subjectName = subject?.name || 'Clínica Médica';

        // Check current questions count
        const qSnap = await getDocs(query(collection(db, 'questions'), where('topicId', '==', topic.id)));
        const existingCount = qSnap.docs.length;

        if (existingCount >= 10) {
          setSeedingLogs(prev => {
            const lines = prev.split('\n');
            const truncated = lines.slice(-20).join('\n');
            return truncated + `\n✓ Já possui ${existingCount} questões cadastradas. Pulando para o próximo.`;
          });
          processed++;
          setSeedingProgress(Math.round((processed / topicsToProcess.length) * 100));
          continue;
        }

        const needed = 10 - existingCount;
        setSeedingLogs(prev => {
          const lines = prev.split('\n');
          const truncated = lines.slice(-20).join('\n');
          return truncated + `\n→ Encontradas ${existingCount} questões. Baixando ${needed} novas questões com IA (Google Search Grounding)...`;
        });

        const existingTexts = qSnap.docs.map(d => (d.data()?.text || ''));

        // Call our state-of-the-art generator with search grounding enabled
        const newQuestions = await generateQuestions(topic.title, subjectName, needed, existingTexts, 'admin', undefined);
        
        if (newQuestions && Array.isArray(newQuestions) && newQuestions.length > 0) {
          let added = 0;
          for (const qData of newQuestions) {
            await addDoc(collection(db, 'questions'), {
              ...qData,
              topicId: topic.id,
              subjectId: topic.subjectId
            });
            added++;
          }
          setSeedingLogs(prev => {
            const lines = prev.split('\n');
            const truncated = lines.slice(-20).join('\n');
            return truncated + `\n✓ Sucesso! ${added} novas questões reais salvas na base.`;
          });
        } else {
          setSeedingLogs(prev => {
            const lines = prev.split('\n');
            const truncated = lines.slice(-20).join('\n');
            return truncated + `\n⚠ Nenhuma questão nova gerada pelo modelo.`;
          });
        }

      } catch (err: any) {
        console.error('Error seeding topic:', topic.title, err);
        setSeedingLogs(prev => {
          const lines = prev.split('\n');
          const truncated = lines.slice(-20).join('\n');
          return truncated + `\n❌ Falha: ${err.message || 'Erro desconhecido'}`;
        });
      }

      processed++;
      setSeedingProgress(Math.round((processed / topicsToProcess.length) * 100));

      // Throttled pause between topics
      if (i < topicsToProcess.length - 1) {
        setSeedingLogs(prev => {
          const lines = prev.split('\n');
          const truncated = lines.slice(-20).join('\n');
          return truncated + `\n⏱ Aguardando ${seedingDelaySec} segundos para respeitar limites de cota...`;
        });

        for (let s = seedingDelaySec; s > 0; s--) {
          await new Promise(r => setTimeout(r, 1000));
          let cancelCheck = true;
          setIsSeedingAll(current => {
            if (!current) cancelCheck = false;
            return current;
          });
          if (!cancelCheck) break;
        }
      }
    }

    setIsSeedingAll(false);
    setSeedingLogs(prev => prev + '\n\n==== FIM DO SEEDING EM MASSA ====');
  };

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
                        {(() => {
                          const finalName = u.displayName || u.name || u.nome || (u.email || u.emailAddress || '').split('@')[0] || 'Aluno Visitante (Anônimo)';
                          const finalEmail = u.email || u.emailAddress || u.email_address || u.userEmail || 'Acesso de Visitante (Sem e-mail)';
                          return (
                            <>
                              <div className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 border",
                                getAvatarColorClass(finalName)
                              )}>
                                {finalName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-neutral-950 truncate leading-tight">{finalName}</p>
                                <p className="text-[9.5px] text-[#8E8A82] font-mono truncate">{finalEmail}</p>
                              </div>
                            </>
                          );
                        })()}
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
                onClick={() => setActiveTab('pdf-upload')}
                className="w-full p-3 bg-[#FFFBF0] hover:bg-[#FFF3CA] border border-[#FFEAB6] rounded-xl flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-amber-950">Extrair Prova (PDF)</p>
                    <p className="text-[9px] text-amber-700">Suba o caderno da prova e extraia com IA em lotes</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-800 group-hover:text-amber-950 group-hover:translate-x-0.5 transition-all shrink-0" />
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

          {/* Semeador de Questões em Massa Modo Noturno Card */}
          <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden">
            <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA]">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600 shrink-0" />
                <CardTitle className="text-xs font-black text-neutral-950 uppercase tracking-wide">Semeador de Questões (Modo Noturno)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <p className="text-[10px] text-[#8E8A82] leading-relaxed">
                Deixe a aba aberta durante a madrugada para que a IA busque no Google Search Grounding e salve até 10 questões oficiais de residência para <strong>cada tema médico cadastrado</strong> no sistema. Totalmente otimizado para o limite de 3GB do Supabase (ocupa menos de 20MB para 10.000 questões!).
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <span className="text-[8.5px] uppercase tracking-wider font-black text-[#8E8A82] block">Intervalo de Segurança (Cota)</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="5"
                        max="30"
                        value={seedingDelaySec}
                        onChange={(e) => setSeedingDelaySec(Math.max(5, parseInt(e.target.value, 10) || 8))}
                        disabled={isSeedingAll}
                        className="border-[#E2E0D9] focus:border-neutral-400 h-8 rounded-lg bg-white font-mono text-xs focus-visible:ring-0 text-neutral-900 w-20"
                      />
                      <span className="text-[9.5px] text-neutral-500 font-medium">segundos entre tópicos</span>
                    </div>
                  </div>
                </div>

                {isSeedingAll && (
                  <div className="space-y-1.5 p-3.5 bg-neutral-50 border border-neutral-150 rounded-xl">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase text-[#8E8A82]">
                      <span className="truncate">Semeando: <strong className="text-neutral-900">{seedingCurrentTopic}</strong></span>
                      <span className="font-mono text-neutral-900 shrink-0">{seedingProgress}%</span>
                    </div>
                    <div className="w-full bg-[#E2E0D9]/50 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-300" 
                        style={{ width: `${seedingProgress || 3}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={startSeedingAll}
                  className={cn(
                    "w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-wider cursor-pointer shadow-xs gap-2 flex items-center justify-center",
                    isSeedingAll 
                      ? "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                      : "bg-[#FFFBF0] hover:bg-[#FFF3CA] text-amber-800 border border-[#FFEAB6]"
                  )}
                >
                  {isSeedingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                      Interromper Semeador
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      Ativar Modo Noturno
                    </>
                  )}
                </Button>

                {seedingLogs && (
                  <div className="space-y-1.5">
                    <span className="text-[8.5px] uppercase tracking-wider font-black text-[#8E8A82] block">Logs do Processo (20 linhas mais recentes):</span>
                    <pre className="bg-[#2D2A26] text-[#EAD8B1] text-[8.5px] p-3.5 rounded-xl font-mono overflow-y-auto max-h-[160px] whitespace-pre-wrap leading-relaxed border border-[#3E3A36] select-text">
                      {seedingLogs}
                    </pre>
                  </div>
                )}
              </div>
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

interface PdfUploadManagerProps {
  subjects: Subject[];
  topics: Topic[];
}

export function PdfUploadManager({ subjects, topics }: PdfUploadManagerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [banca, setBanca] = useState<string>('ENARE');
  const [ano, setAno] = useState<number>(2025);
  const [tipoProva, setTipoProva] = useState<string>('Acesso Direto');
  
  const [isExtractingPdf, setIsExtractingPdf] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  
  const [isProcessingIA, setIsProcessingIA] = useState<boolean>(false);
  const [iaProgress, setIaProgress] = useState<number>(0);
  const [iaLogs, setIaLogs] = useState<string[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);
  
  const [importedExams, setImportedExams] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const q = query(collection(db, 'imported_exams'));
      const snapshot = await getDocs(q);
      const exams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setImportedExams(exams);
    } catch (err) {
      console.error("Erro ao buscar histórico de uploads:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadPdfJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = (err) => reject(new Error("Não foi possível carregar o motor PDF.js"));
      document.head.appendChild(script);
    });
  };

  const extractTextFromPdf = async (targetFile: File, onProg: (pct: number) => void): Promise<string> => {
    const pdfjsLib = await loadPdfJS();
    const arrayBuffer = await targetFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    const numPages = pdf.numPages;
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `\n--- PAGINA ${i} ---\n` + pageText;
      onProg(Math.round((i / numPages) * 100));
    }
    return fullText;
  };

  const addIaLog = (msg: string) => {
    const timeStr = new Date().toLocaleTimeString('pt-BR');
    setIaLogs(prev => [...prev, `[${timeStr}] ${msg}`]);
  };

  const handleProcessPdf = async () => {
    if (!file) return;
    
    setIsExtractingPdf(true);
    setExtractionProgress(0);
    setIaLogs([]);
    setExtractedQuestions([]);
    setIaProgress(0);
    
    addIaLog(`Iniciando extração do PDF: "${file.name}"...`);
    
    try {
      const fullText = await extractTextFromPdf(file, (pct) => {
        setExtractionProgress(pct);
      });
      
      setIsExtractingPdf(false);
      addIaLog(`Leitura concluída! Extraídos ${fullText.length} caracteres.`);
      
      // Step 2: Chunking & Gemini AI Extraction
      setIsProcessingIA(true);
      
      // Smart Chunking by Character Length (around 12,000 characters per batch ~ 5-10 questions)
      const chunkSize = 12000;
      const textChunks: string[] = [];
      for (let i = 0; i < fullText.length; i += chunkSize) {
        textChunks.push(fullText.substring(i, i + chunkSize));
      }
      
      addIaLog(`Fatiado o texto da prova em ${textChunks.length} blocos para envio à IA.`);
      
      const allExtracted: Question[] = [];
      
      for (let idx = 0; idx < textChunks.length; idx++) {
        addIaLog(`Enviando lote ${idx + 1} de ${textChunks.length} para processamento com Gemini 3.1-Flash-Lite...`);
        setIaProgress(Math.round(((idx + 1) / textChunks.length) * 100));
        
        const chunkText = textChunks[idx];
        const prompt = `Você é um extrator de inteligência artificial altamente especializado em exames de residência médica no Brasil.
Seu objetivo é analisar o seguinte fragmento de texto de prova de ${banca} (${ano}), identificar e extrair TODAS as questões médicas reais contidas nele.

Fragmento de Prova Médica:
${chunkText}

DIRETRIZES DE FORMATAÇÃO:
1. Extraia o enunciado completo ("text") em português do Brasil sem resumir o caso clínico.
2. Extraia todas as alternativas ("options") perfeitamente estruturadas. Remova indicações de letras (como "A)", "B)") no início delas para que fiquem limpas.
3. Identifique o índice correto da alternativa ("correctOptionIndex") sendo 0 para A, 1 para B, 2 para C, 3 para D.
4. Crie uma explicação de gabarito detalhada ("explanation") explicando didaticamente o motivo do erro de cada alternativa e a corretude da verdadeira.
5. Atribua o campo "source" rigorosamente como "${banca} (${ano})".
6. IMPORTANTE: Deduzi e classifique a sub-especialidade/sub-área ("subSubject") em português (ex: Gastroenterologia Pediátrica, Obstetrícia Patológica, Traumatologia, Neurologia, etc.).
7. IMPORTANTE: Deduzi e identifique o conceito ultra-específico focado ("subtopicTag") em português (ex: Plano A, B e C, Sulfato de Magnésio, Diretrizes SBP).

Retorne estritamente um array JSON de objetos contendo as questões extraídas. Se o fragmento não contiver nenhuma pergunta de múltipla escolha completa, retorne um array vazio [].
Não adicione explicações em Markdown fora do JSON.

Formato:
[
  {
    "text": "Caso clínico...",
    "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
    "correctOptionIndex": 0,
    "explanation": "Comentário...",
    "source": "${banca} (${ano})",
    "subSubject": "sub-área médica",
    "subtopicTag": "conceito focado"
  }
]`;

        try {
          const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'generateJson',
              prompt,
              model: 'gemini-3.1-flash-lite'
            })
          });
          
          if (!res.ok) {
            throw new Error(`Código de status ${res.status}`);
          }
          
          const data = await res.json();
          const resultJson = data.result;
          
          if (Array.isArray(resultJson)) {
            addIaLog(`Lote ${idx + 1} processado! Encontradas e formatadas ${resultJson.length} questões.`);
            allExtracted.push(...resultJson);
          } else if (resultJson && typeof resultJson === 'object') {
            const keys = Object.values(resultJson).filter((v: any) => v && typeof v === 'object' && ('text' in v));
            if (keys.length > 0) {
              addIaLog(`Lote ${idx + 1} processado! Encontradas ${keys.length} questões.`);
              allExtracted.push(...(keys as any[]));
            } else {
              addIaLog(`Lote ${idx + 1} processado, mas nenhuma questão pôde ser estruturada.`);
            }
          } else {
            addIaLog(`Lote ${idx + 1} processado, mas o formato de retorno não foi array.`);
          }
        } catch (err: any) {
          addIaLog(`Erro ao processar lote ${idx + 1}: ${err.message || 'Erro de cota/rede'}. Continuando...`);
        }
        
        // Brief pause to satisfy RPM limits
        await new Promise(r => setTimeout(r, 600));
      }
      
      setIsProcessingIA(false);
      setExtractedQuestions(allExtracted);
      addIaLog(`Processamento Geral Concluído! Extraímos com sucesso ${allExtracted.length} questões oficiais.`);
      
    } catch (err: any) {
      setIsExtractingPdf(false);
      setIsProcessingIA(false);
      addIaLog(`❌ Ocorreu um erro crítico durante a operação: ${err.message || err}`);
    }
  };

  const handleDownloadAndProcessUrl = async () => {
    if (!pdfUrl || !pdfUrl.trim()) return;
    
    setIsDownloading(true);
    setIaLogs([]);
    setExtractedQuestions([]);
    setIsExtractingPdf(true);
    setExtractionProgress(0);
    setIaProgress(0);
    
    addIaLog(`Iniciando download do arquivo da URL: "${pdfUrl}"...`);
    
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Autenticação necessária. Faça login como administrador para baixar a prova.");
      }

      const response = await fetch('/api/download-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ url: pdfUrl.trim() })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error || `Falha ao baixar arquivo: ${response.statusText}`);
      }
      
      const data = await response.json();
      addIaLog(`Download concluído com sucesso!`);
      
      // Convert base64 to File object to let existing logic work seamlessly
      const base64Response = await fetch(`data:${data.contentType};base64,${data.base64}`);
      const blob = await base64Response.blob();
      const filename = pdfUrl.split('/').pop()?.split('?')[0] || 'prova_baixada.pdf';
      const downloadedFile = new File([blob], filename, { type: data.contentType });
      
      setFile(downloadedFile);
      addIaLog(`Arquivo carregado: "${filename}" (${(downloadedFile.size / (1024 * 1024)).toFixed(2)} MB).`);
      
      // Proceed with extracting text from PDF
      const fullText = await extractTextFromPdf(downloadedFile, (pct) => {
        setExtractionProgress(pct);
      });
      
      setIsExtractingPdf(false);
      addIaLog(`Leitura concluída! Extraídos ${fullText.length} caracteres.`);
      
      // Step 2: Chunking & Gemini AI Extraction
      setIsProcessingIA(true);
      
      const chunkSize = 12000;
      const textChunks: string[] = [];
      for (let i = 0; i < fullText.length; i += chunkSize) {
        textChunks.push(fullText.substring(i, i + chunkSize));
      }
      
      addIaLog(`Fatiado o texto da prova em ${textChunks.length} blocos para envio à IA.`);
      
      const allExtracted: Question[] = [];
      
      for (let idx = 0; idx < textChunks.length; idx++) {
        addIaLog(`Enviando lote ${idx + 1} de ${textChunks.length} para processamento com Gemini 3.1-Flash-Lite...`);
        setIaProgress(Math.round(((idx + 1) / textChunks.length) * 100));
        
        const chunkText = textChunks[idx];
        const prompt = `Você é um extrator de inteligência artificial altamente especializado em exames de residência médica no Brasil.
Seu objetivo é analisar o seguinte fragmento de texto de prova de ${banca} (${ano}), identificar e extrair TODAS as questões médicas reais contidas nele.

Fragmento de Prova Médica:
\${chunkText}

DIRETRIZES DE FORMATAÇÃO:
1. Extraia o enunciado completo ("text") em português do Brasil sem resumir o caso clínico.
2. Extraia todas as alternativas ("options") perfeitamente estruturadas. Remova indicações de letras (como "A)", "B)") no início delas para que fiquem limpas.
3. Identifique o índice correto da alternativa ("correctOptionIndex") sendo 0 para A, 1 para B, 2 para C, 3 para D.
4. Crie uma explicação de gabarito detalhada ("explanation") explicando didaticamente o motivo do erro de cada alternativa e a corretude da verdadeira.
5. Atribua o campo "source" rigorosamente como "\${banca} (\${ano})".
6. IMPORTANTE: Deduzi e classifique a sub-especialidade/sub-área ("subSubject") em português (ex: Gastroenterologia Pediátrica, Obstetrícia Patológica, Traumatologia, Neurologia, etc.).
7. IMPORTANTE: Deduzi e identifique o conceito ultra-específico focado ("subtopicTag") em português (ex: Plano A, B e C, Sulfato de Magnésio, Diretrizes SBP).

Retorne estritamente um array JSON de objetos contendo as questões extraídas. Se o fragmento não contiver nenhuma pergunta de múltipla escolha completa, retorne um array vazio [].
Não adicione explicações em Markdown fora do JSON.

Formato:
[
  {
    "text": "Caso clínico...",
    "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
    "correctOptionIndex": 0,
    "explanation": "Comentário...",
    "source": "\${banca} (\${ano})",
    "subSubject": "sub-área médica",
    "subtopicTag": "conceito focado"
  }
]`;

        try {
          const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'generateJson',
              prompt,
              model: 'gemini-3.1-flash-lite'
            })
          });
          
          if (!res.ok) {
            throw new Error(`Código de status \${res.status}`);
          }
          
          const data = await res.json();
          const resultJson = data.result;
          
          if (Array.isArray(resultJson)) {
            addIaLog(`Lote \${idx + 1} processado! Encontradas e formatadas \${resultJson.length} questões.`);
            allExtracted.push(...resultJson);
          } else if (resultJson && typeof resultJson === 'object') {
            const keys = Object.values(resultJson).filter((v: any) => v && typeof v === 'object' && ('text' in v));
            if (keys.length > 0) {
              addIaLog(`Lote \${idx + 1} processado! Encontradas \${keys.length} questões.`);
              allExtracted.push(...(keys as any[]));
            } else {
              addIaLog(`Lote \${idx + 1} processado, mas nenhuma questão pôde ser estruturada.`);
            }
          } else {
            addIaLog(`Lote \${idx + 1} processado, mas nenhuma questão foi encontrada.`);
          }
        } catch (err: any) {
          addIaLog(`Erro no lote \${idx + 1}: \${err.message || err}`);
        }
        
        // Anti-throttling delay (2s between API calls to prevent rate limits)
        await new Promise(r => setTimeout(r, 2000));
      }
      
      setExtractedQuestions(allExtracted);
      addIaLog(`Análise de IA concluída! Total de \${allExtracted.length} questões estruturadas com sucesso.`);
    } catch (err: any) {
      console.error(err);
      addIaLog(`Falha geral: \${err.message || err}`);
      setIsExtractingPdf(false);
    } finally {
      setIsDownloading(false);
      setIsProcessingIA(false);
    }
  };

  const findBestTopicAndSubject = (qText: string, subSubject: string) => {
    const qLower = qText.toLowerCase();
    const sLower = subSubject.toLowerCase();
    
    // Direct overlap check among topics
    for (const t of topics) {
      const tLower = t.title.toLowerCase();
      if (qLower.includes(tLower) || tLower.includes(sLower) || sLower.includes(tLower)) {
        return { topicId: t.id, subjectId: t.subjectId };
      }
    }
    
    // Match by Subject
    const matchedSubject = subjects.find(s => 
      qLower.includes(s.name.toLowerCase()) || 
      sLower.includes(s.name.toLowerCase()) ||
      (s.name === 'Pediatria' && sLower.includes('pediá')) ||
      (s.name === 'Ginecologia e Obstetrícia' && (qLower.includes('ginec') || qLower.includes('obstet') || qLower.includes('gestan')))
    );
    
    if (matchedSubject) {
      const firstTopic = topics.find(t => t.subjectId === matchedSubject.id);
      return { topicId: firstTopic?.id || '', subjectId: matchedSubject.id };
    }
    
    // Global fallback
    return { topicId: topics[0]?.id || '', subjectId: subjects[0]?.id || '' };
  };

  const handleSaveQuestions = async () => {
    if (extractedQuestions.length === 0) return;
    
    setIsSaving(true);
    addIaLog("Salvando questões no banco de dados e mapeando para matérias de internação...");
    
    try {
      let savedCount = 0;
      
      for (const q of extractedQuestions) {
        const mapping = findBestTopicAndSubject(q.text, q.subSubject || '');
        await addDoc(collection(db, 'questions'), {
          text: q.text,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          explanation: q.explanation,
          source: q.source || `${banca} (${ano})`,
          subSubject: q.subSubject || 'Geral',
          subtopicTag: q.subtopicTag || 'Conceitos Chave',
          topicId: mapping.topicId,
          subjectId: mapping.subjectId,
          heatLevel: q.heatLevel || 'alto'
        });
        savedCount++;
      }
      
      // Save exam summary to imported history ledger
      await addDoc(collection(db, 'imported_exams'), {
        banca,
        ano: parseInt(ano as any, 10) || 2025,
        tipoProva,
        questionCount: savedCount,
        createdAt: new Date().toISOString()
      });
      
      addIaLog(`✓ Tudo pronto! ${savedCount} questões salvas e mapeadas com sucesso.`);
      setExtractedQuestions([]);
      setFile(null);
      fetchHistory();
      
    } catch (err: any) {
      addIaLog(`❌ Falha ao salvar no banco: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta prova? As questões já inseridas continuarão no banco, mas o registro deste upload será removido.")) return;
    
    try {
      await deleteDoc(doc(db, 'imported_exams', examId));
      setImportedExams(prev => prev.filter(e => e.id !== examId));
    } catch (err: any) {
      alert("Erro ao remover registro de upload: " + err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            Extrator Inteligente de Provas em PDF (Gemini 3.1)
          </h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Arraste o arquivo PDF oficial da prova, selecione o ano/banca e a IA fatiará e extrairá as questões com explicações detalhadas em menos de 5 minutos!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form Panel */}
        <Card className="lg:col-span-5 border-[#E2E0D9] shadow-xs rounded-2xl bg-white">
          <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA]">
            <CardTitle className="text-xs font-black text-neutral-950 uppercase tracking-wide">Configurações da Prova</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-black text-[#8E8A82]">Instituição / Banca</label>
              <Input
                type="text"
                value={banca}
                onChange={(e) => setBanca(e.target.value.toUpperCase())}
                placeholder="Ex: ENARE, USP-SP, PSU-MG"
                disabled={isExtractingPdf || isProcessingIA}
                className="border-[#E2E0D9] focus:border-neutral-400 h-10 rounded-xl bg-white focus-visible:ring-0 text-neutral-900 text-sm font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-black text-[#8E8A82]">Ano de Aplicação</label>
                <Input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(parseInt(e.target.value, 10) || 2025)}
                  disabled={isExtractingPdf || isProcessingIA}
                  className="border-[#E2E0D9] focus:border-neutral-400 h-10 rounded-xl bg-white focus-visible:ring-0 text-neutral-900 text-sm font-mono font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-black text-[#8E8A82]">Tipo de Prova</label>
                <Input
                  type="text"
                  value={tipoProva}
                  onChange={(e) => setTipoProva(e.target.value)}
                  placeholder="Ex: Acesso Direto"
                  disabled={isExtractingPdf || isProcessingIA}
                  className="border-[#E2E0D9] focus:border-neutral-400 h-10 rounded-xl bg-white focus-visible:ring-0 text-neutral-900 text-sm"
                />
              </div>
            </div>

            {/* Drop Zone */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider font-black text-[#8E8A82] block">Caderno de Questões (PDF)</label>
              <div className={cn(
                "border-2 border-dashed border-[#E2E0D9] rounded-2xl p-6 text-center hover:bg-stone-50 hover:border-neutral-400 transition-all select-none relative",
                file && "border-primary bg-primary/5"
              )}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={isExtractingPdf || isProcessingIA}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="space-y-2">
                  <FileText className={cn("w-8 h-8 mx-auto text-neutral-400", file && "text-primary")} />
                  {file ? (
                    <div className="space-y-1">
                      <p className="text-xs font-black text-neutral-950 truncate max-w-xs mx-auto">{file.name}</p>
                      <p className="text-[10px] font-mono text-[#8E8A82]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-neutral-800">Clique para selecionar ou arraste o PDF</p>
                      <p className="text-[9px] text-[#8E8A82]">Apenas arquivos .pdf contendo a prova oficial</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider OR option */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[#E2E0D9]"></div>
              <span className="flex-shrink mx-4 text-[10px] text-[#8E8A82] font-black uppercase tracking-wider">OU</span>
              <div className="flex-grow border-t border-[#E2E0D9]"></div>
            </div>

            {/* URL Input Area */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-black text-[#8E8A82] block">Baixar do Link Oficial (PDF)</label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="Cole o link direto do PDF da prova oficial..."
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  disabled={isExtractingPdf || isProcessingIA || isDownloading}
                  className="border-[#E2E0D9] focus:border-neutral-400 h-10 rounded-xl bg-white focus-visible:ring-0 text-neutral-900 text-sm flex-grow"
                />
                <Button
                  onClick={handleDownloadAndProcessUrl}
                  disabled={!pdfUrl.trim() || isExtractingPdf || isProcessingIA || isDownloading}
                  className="h-10 px-4 bg-amber-950 hover:bg-amber-900 text-white rounded-xl font-bold text-xs shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
                  Baixar e Processar
                </Button>
              </div>
              <p className="text-[9px] text-[#8E8A82]">O sistema baixará o arquivo através do nosso proxy e enviará para extração com o Gemini.</p>
            </div>

            {file && !isExtractingPdf && !isProcessingIA && extractedQuestions.length === 0 && (
              <Button
                onClick={handleProcessPdf}
                className="w-full h-11 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl font-black text-[10px] uppercase tracking-wider cursor-pointer shadow-sm mt-2"
              >
                Analisar e Extrair Questões
              </Button>
            )}

            {extractedQuestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-emerald-800 text-xs font-black block">✓ Extração Concluída com Sucesso!</span>
                  <span className="text-[10px] text-emerald-600 font-bold block mt-0.5 font-mono">{extractedQuestions.length} questões reais prontas para salvar</span>
                </div>
                <Button
                  onClick={handleSaveQuestions}
                  disabled={isSaving}
                  className="w-full h-11 bg-primary hover:bg-primary/95 text-white rounded-xl font-black text-[10px] uppercase tracking-wider cursor-pointer shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gravar Tudo no Banco de Dados"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtractedQuestions([]);
                    setFile(null);
                  }}
                  className="w-full h-11 border-stone-200 rounded-xl font-bold text-xs"
                >
                  Descartar e Escolher Outro
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Console & Ledger Panel */}
        <div className="lg:col-span-7 space-y-6">
          {/* Terminal Logs */}
          <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden">
            <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA]">
              <CardTitle className="text-xs font-black text-neutral-950 uppercase tracking-wide">Terminal de Extração e Conversão de IA</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {isExtractingPdf && (
                <div className="space-y-1.5 p-4 bg-[#FAF9F6] border border-[#E2E0D9] rounded-xl animate-pulse">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase text-[#8E8A82]">
                    <span>Lendo PDF Localmente...</span>
                    <span className="font-mono text-neutral-900">{extractionProgress}%</span>
                  </div>
                  <div className="w-full bg-[#E2E0D9]/50 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-neutral-800 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${extractionProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {isProcessingIA && (
                <div className="space-y-1.5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase text-amber-800 animate-pulse">
                    <span>Faturando e Estruturando Lotes com IA...</span>
                    <span className="font-mono text-amber-900">{iaProgress}%</span>
                  </div>
                  <div className="w-full bg-[#E2E0D9]/50 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${iaProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="bg-stone-900 text-stone-100 font-mono text-[10.5px] p-4 rounded-xl h-56 overflow-y-auto space-y-1.5 shadow-inner">
                {iaLogs.length === 0 ? (
                  <p className="text-stone-400 italic">Aguardando início de processamento de arquivo...</p>
                ) : (
                  iaLogs.map((log, lIdx) => (
                    <p key={lIdx} className={cn(
                      "leading-relaxed",
                      log.includes('❌') ? 'text-red-400 font-bold' :
                      log.includes('✓') ? 'text-green-400 font-bold' :
                      log.includes('Gemini') ? 'text-amber-400' : 'text-stone-300'
                    )}>
                      {log}
                    </p>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upload History Table */}
          <Card className="border-[#E2E0D9] shadow-xs rounded-2xl bg-white overflow-hidden">
            <CardHeader className="p-4 border-b border-[#E2E0D9] bg-[#FBFBFA]">
              <CardTitle className="text-xs font-black text-neutral-950 uppercase tracking-wide">Uploads Realizados de Provas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isHistoryLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#8E8A82]" /></div>
              ) : importedExams.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8E8A82] italic">
                  Nenhuma prova oficial importada até o momento. Faça o upload do primeiro PDF!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50/50 text-[9px] uppercase tracking-wider text-[#8E8A82] font-black border-b border-[#E2E0D9]">
                        <th className="p-4 pl-6">Prova</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Questões</th>
                        <th className="p-4">Data Importação</th>
                        <th className="p-4 pr-6 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E0D9]/60">
                      {importedExams.map((exam) => (
                        <tr key={exam.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="p-4 pl-6 font-bold text-xs text-neutral-950">
                            {exam.banca} ({exam.ano})
                          </td>
                          <td className="p-4 text-xs font-medium text-neutral-500">
                            {exam.tipoProva || exam.tipo || 'Acesso Direto'}
                          </td>
                          <td className="p-4">
                            <span className="text-[10px] font-mono font-black bg-stone-100 border border-stone-200 text-stone-800 px-2 py-0.5 rounded-full">
                              +{exam.questionCount}q
                            </span>
                          </td>
                          <td className="p-4 text-[10px] text-neutral-400 font-mono">
                            {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : 'N/D'}
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteExam(exam.id)}
                              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg p-0 w-7 flex items-center justify-center cursor-pointer ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
