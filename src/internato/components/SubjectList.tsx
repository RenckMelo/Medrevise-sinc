import React, { useState, useEffect, useMemo } from 'react';
import { Subject, Semester, UserProgress, Topic } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as Icons from 'lucide-react';
import { ChevronRight, Plus, X, Edit2, AlertCircle, Search, Layers, BookOpen, Filter, Globe, Sparkles, Link2, ArrowLeft, Check, Trash2, History, Clock, Brain } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import SubjectLinkerModal from '../../components/SubjectLinkerModal';
import { useSubjectLinks } from '../../hooks/useSubjectLinks';
import { useStudyData } from '../../hooks/useStudyData';
import { db, collection, addDoc, doc, deleteDoc } from '../firebase';

const DEFAULT_SEMESTERS: Semester[] = Array.from({ length: 12 }, (_, i) => ({
  id: `sem_${i + 1}`,
  number: i + 1,
  name: `${i + 1}º Semestre`
}));

export function getSemesterForSubject(
  semesterId?: string | number,
  semestersList: Semester[] = [],
  subjectName?: string
): Semester | null {
  const allSemesters = [...(semestersList || []), ...DEFAULT_SEMESTERS];

  if (semesterId !== undefined && semesterId !== null && semesterId !== '') {
    const strId = String(semesterId).trim();
    if (strId) {
      // 1. Direct ID match or aliasIds match
      let match = allSemesters.find(
        sem => sem.id === strId || (sem as any).aliasIds?.includes(strId)
      );
      if (match) return match;

      // 2. Numeric match (e.g. "1" or 1)
      const num = Number(strId);
      if (!isNaN(num) && num > 0) {
        match = allSemesters.find(sem => sem.number === num);
        if (match) return match;
      }

      // 3. Name match (e.g. "1º Semestre", "9º Semestre")
      const lower = strId.toLowerCase();
      match = allSemesters.find(sem => sem.name?.toLowerCase().trim() === lower);
      if (match) return match;

      // 4. Safe pattern matching: e.g. "sem_9", "semestre 9", "9-semestre"
      if (
        /(semestre|sem|período|periodo)\s*\d+/i.test(strId) ||
        /\d+\s*º?\s*(semestre|sem|período|periodo)/i.test(strId) ||
        /^sem_\d+$/i.test(strId)
      ) {
        const digits = strId.match(/\d+/);
        if (digits) {
          const semNum = parseInt(digits[0], 10);
          match = allSemesters.find(sem => sem.number === semNum);
          if (match) return match;
        }
      }
    }
  }

  // 5. Fallback by subjectName
  if (subjectName) {
    const sName = subjectName.toLowerCase().trim();
    let knownNum: number | null = null;
    if (
      sName.includes('pediatria') ||
      sName.includes('ginecologia') ||
      sName.includes('obstetrícia') ||
      sName.includes('ortopedia') ||
      sName.includes('cirurgia geral') ||
      sName.includes('clínica médica')
    ) {
      knownNum = 9;
    } else if (
      sName.includes('família') ||
      sName.includes('comunidade') ||
      sName.includes('saúde coletiva') ||
      sName.includes('preventiva') ||
      sName.includes('infectologia') ||
      sName.includes('cardiologia')
    ) {
      knownNum = 10;
    } else if (
      sName.includes('urgência') ||
      sName.includes('emergência') ||
      sName.includes('uti') ||
      sName.includes('trauma')
    ) {
      knownNum = 11;
    } else if (
      sName.includes('estágio') ||
      sName.includes('optativo') ||
      sName.includes('prática final')
    ) {
      knownNum = 12;
    }

    if (knownNum) {
      const match = allSemesters.find(sem => sem.number === knownNum);
      if (match) return match;
    }
  }

  return null;
}

export function getSemesterLabel(
  semesterId?: string | number,
  semestersList: Semester[] = [],
  subjectName?: string
): string {
  const sem = getSemesterForSubject(semesterId, semestersList, subjectName);
  if (sem) return sem.name || `${sem.number}º Semestre`;

  if (semesterId) {
    const str = String(semesterId).trim();
    const num = Number(str);
    if (!isNaN(num) && num > 0) {
      return `${num}º Semestre`;
    }
    const isRawDocId = /^[A-Za-z0-9_-]{12,}$/.test(str) && !str.includes(' ');
    if (!isRawDocId) {
      return str;
    }
  }

  return 'Semestre Geral';
}

const COLOR_PALETTE = [
  'bg-blue-50 text-blue-600 border-blue-200/80',
  'bg-purple-50 text-purple-600 border-purple-200/80',
  'bg-pink-50 text-pink-600 border-pink-200/80',
  'bg-emerald-50 text-emerald-600 border-emerald-200/80',
  'bg-amber-50 text-amber-600 border-amber-200/80',
  'bg-indigo-50 text-indigo-600 border-indigo-200/80',
  'bg-teal-50 text-teal-600 border-teal-200/80',
  'bg-rose-50 text-rose-600 border-rose-200/80',
  'bg-cyan-50 text-cyan-600 border-cyan-200/80',
];

export function getSubjectBadgeStyle(subject: { color?: string; name?: string; id?: string }) {
  let classes = 'border shadow-xs';
  let style: React.CSSProperties = {};

  if (subject.color) {
    if (subject.color.startsWith('#')) {
      style = {
        backgroundColor: `${subject.color}15`,
        color: subject.color,
        borderColor: `${subject.color}40`,
      };
    } else if (subject.color.includes('bg-')) {
      classes += ` ${subject.color} border-black/5`;
    } else {
      classes += ` ${subject.color}`;
    }
  } else {
    const key = subject.name || subject.id || 'subject';
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
    classes += ` ${COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length]}`;
  }

  return { classes, style };
}

interface SubjectListProps {
  subjects: Subject[];
  semesters: Semester[];
  userProgress: UserProgress | null;
  onSelect: (subject: Subject) => void;
  onAddSubject?: (name: string, semesterId: string) => Promise<any>;
  onUpdateSubjectSemester?: (subjectId: string, semesterId: string) => Promise<void>;
  onCreateSemester?: (number: number, name: string) => Promise<Semester | undefined>;
  onUpdateSubject?: (subjectId: string, name: string, semesterId: string) => Promise<void>;
  onDeleteSubject?: (subjectId: string) => Promise<void>;
  selectedSubject?: Subject | null;
  onClearSelectedSubject?: () => void;
  onSelectTopic?: (topic: any) => void;
  userId?: string;
}

export default function SubjectList({ 
  subjects, 
  semesters, 
  userProgress, 
  onSelect, 
  onAddSubject, 
  onUpdateSubjectSemester,
  onCreateSemester,
  onUpdateSubject,
  onDeleteSubject,
  selectedSubject,
  onClearSelectedSubject,
  onSelectTopic,
  userId
}: SubjectListProps) {
  const { topics } = useStudyData();
  const { links, isSubjectLinked, getLinkedSubjectId } = useSubjectLinks();

  const [sourceFilter, setSourceFilter] = useState<'all' | 'internato' | 'revise' | 'linked'>('all');
  const [isLinkerModalOpen, setIsLinkerModalOpen] = useState(false);
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Subject creation state
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Semester creation state
  const [isAddingSemester, setIsAddingSemester] = useState(false);
  const [newSemesterNumber, setNewSemesterNumber] = useState('');
  const [newSemesterName, setNewSemesterName] = useState('');
  const [isSavingSemester, setIsSavingSemester] = useState(false);

  // Subject editing state
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectSemesterId, setEditSubjectSemesterId] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Topic states for MedInternato
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [isAddingTopicLoading, setIsAddingTopicLoading] = useState(false);
  const [topicSearchQuery, setTopicSearchQuery] = useState('');

  // Helpers for determining depth
  const isRealContent = (text?: string) => {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 30) return false;
    if (trimmed.toLowerCase().includes('conteúdo simulado') || trimmed.toLowerCase().includes('summary placeholder') || trimmed.toLowerCase().includes('standard summary for')) {
      return false;
    }
    return true;
  };

  const detectRealDepth = (topic: any): string => {
    if (isRealContent(topic.content_custom_analyzed)) return 'custom_analyzed';
    if (isRealContent(topic.content_monograph)) return 'monograph';
    if (isRealContent(topic.content_master)) return 'master';
    if (isRealContent(topic.content_elite)) return 'elite';
    if (isRealContent(topic.content_deep)) return 'deep';
    if (isRealContent(topic.content_standard) || isRealContent(topic.content)) return 'standard';
    return 'none';
  };

  const handleAddTopic = async () => {
    if (!userId || !newTopicTitle.trim() || !selectedSubject) return;
    setIsAddingTopicLoading(true);
    try {
      await addDoc(collection(db, 'users', userId, 'topics'), {
        title: newTopicTitle.trim(),
        subjectId: selectedSubject.id,
        content: '',
        lastUpdated: new Date().toISOString(),
        interval: 0,
        easinessFactor: 2.5,
        repetitions: 0,
        nextReviewDate: '',
        completed: false
      });
      setNewTopicTitle('');
    } catch (err) {
      console.error('Error adding topic in SubjectList:', err);
    } finally {
      setIsAddingTopicLoading(false);
    }
  };

  const subjectTopics = useMemo(() => {
    if (!selectedSubject) return [];
    return (topics || []).filter(t => t.subjectId === selectedSubject.id);
  }, [topics, selectedSubject]);

  const filteredSubjectTopics = useMemo(() => {
    const query = topicSearchQuery.toLowerCase().trim();
    if (!query) return subjectTopics;
    return subjectTopics.filter(t => {
      const title = ((t as any).title || (t as any).name || '').toLowerCase();
      return title.includes(query);
    });
  }, [subjectTopics, topicSearchQuery]);

  // Pre-computed instant module map
  const subjectModulesMap = useMemo(() => {
    const map = new Map<string, { hasRevise: boolean; hasInternato: boolean; linked: boolean }>();

    const reviseSubIds = new Set<string>();
    const internatoSubIds = new Set<string>();

    (topics || []).forEach((t: any) => {
      if (!t.subjectId) return;
      const isClinical = !!(
        t.content || t.content_standard || t.content_deep || t.content_elite ||
        t.content_master || t.content_monograph || t.importedPdfData ||
        t.treatment || t.diagnosis || t.conduct
      );
      if (isClinical) {
        internatoSubIds.add(t.subjectId);
      } else {
        reviseSubIds.add(t.subjectId);
      }
    });

    (subjects || []).forEach(s => {
      const linked = isSubjectLinked(s.id);
      const linkedId = getLinkedSubjectId(s.id);
      const hasRevise = reviseSubIds.has(s.id) || (linkedId ? reviseSubIds.has(linkedId) : false);
      const hasInternato = internatoSubIds.has(s.id) || (linkedId ? internatoSubIds.has(linkedId) : false) || true; // Default in MedInternato

      map.set(s.id, { hasRevise, hasInternato, linked });
    });

    return map;
  }, [topics, subjects, links]);

  const getSubjectModules = (subId: string) => {
    return subjectModulesMap.get(subId) || { hasRevise: false, hasInternato: true, linked: false };
  };

  const availableSemesters = useMemo(() => {
    if (semesters && semesters.length > 0) return semesters;
    return DEFAULT_SEMESTERS;
  }, [semesters]);

  useEffect(() => {
    if (availableSemesters.length > 0 && !selectedSemesterId) {
      setSelectedSemesterId(availableSemesters[0].id);
    }
  }, [availableSemesters, selectedSemesterId]);

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateSemester || !newSemesterNumber || !newSemesterName.trim()) return;

    setIsSavingSemester(true);
    try {
      const num = parseInt(newSemesterNumber, 10);
      const created = await onCreateSemester(isNaN(num) ? 1 : num, newSemesterName.trim());
      if (created) {
        setSelectedSemesterId(created.id);
        setNewSemesterName('');
        setNewSemesterNumber('');
        setIsAddingSemester(false);
      }
    } catch (err) {
      console.error('Error creating semester inside SubjectList:', err);
    } finally {
      setIsSavingSemester(false);
    }
  };

  const handleSaveEditSubject = async () => {
    if (!editingSubject || !editSubjectName.trim() || !editSubjectSemesterId) return;
    setIsSavingEdit(true);
    try {
      if (onUpdateSubject) {
        await onUpdateSubject(editingSubject.id, editSubjectName.trim(), editSubjectSemesterId);
      } else if (onUpdateSubjectSemester) {
        await onUpdateSubjectSemester(editingSubject.id, editSubjectSemesterId);
      }
      setEditingSubject(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Compute subject counts per semester
  const subjectCountsBySemester = React.useMemo(() => {
    const counts: Record<string, number> = {};
    subjects.forEach(s => {
      const sem = getSemesterForSubject(s.semesterId, semesters, s.name);
      if (sem) {
        counts[sem.id] = (counts[sem.id] || 0) + 1;
      }
    });
    return counts;
  }, [subjects, semesters]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      // Source module filter
      const { hasRevise, hasInternato, linked } = getSubjectModules(s.id);
      if (sourceFilter === 'revise' && !hasRevise) return false;
      if (sourceFilter === 'internato' && !hasInternato) return false;
      if (sourceFilter === 'linked' && !linked && !(hasRevise && hasInternato)) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatches = s.name.toLowerCase().includes(q);
        const semLabel = getSemesterLabel(s.semesterId, semesters, s.name).toLowerCase();
        if (!nameMatches && !semLabel.includes(q)) return false;
      }

      // Semester filter
      if (!semesterFilter || semesterFilter === 'all') return true;

      const selectedSemester = semesters.find(sem => 
        sem.id === semesterFilter || 
        String(sem.number) === String(semesterFilter) ||
        (sem as any).aliasIds?.includes(semesterFilter)
      );

      const subSem = getSemesterForSubject(s.semesterId, semesters, s.name);

      if (subSem && selectedSemester) {
        return (
          subSem.id === selectedSemester.id ||
          subSem.number === selectedSemester.number ||
          (subSem as any).aliasIds?.includes(selectedSemester.id) ||
          (selectedSemester as any).aliasIds?.includes(subSem.id) ||
          ((subSem as any).aliasIds && (selectedSemester as any).aliasIds && 
            (subSem as any).aliasIds.some((id: string) => (selectedSemester as any).aliasIds.includes(id)))
        );
      }

      if (subSem) {
        return (
          subSem.id === semesterFilter ||
          String(subSem.number) === String(semesterFilter) ||
          (subSem as any).aliasIds?.includes(semesterFilter)
        );
      }

      if (selectedSemester) {
        return (
          String(s.semesterId) === String(selectedSemester.id) ||
          String(s.semesterId) === String(selectedSemester.number) ||
          (selectedSemester as any).aliasIds?.includes(String(s.semesterId))
        );
      }

      return String(s.semesterId) === String(semesterFilter);
    });
  }, [subjects, semesterFilter, semesters, sourceFilter, searchQuery, topics, links, subjectModulesMap]);

  if (selectedSubject) {
    const IconComponent = (Icons as any)[selectedSubject.icon] || Icons.BookOpen;
    const semesterLabel = getSemesterLabel(selectedSubject.semesterId, semesters, selectedSubject.name);
    const badgeStyle = getSubjectBadgeStyle(selectedSubject);

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E2E0D9] p-4 sm:p-6 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={onClearSelectedSubject}
              className="p-2 sm:p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl transition-all cursor-pointer group flex items-center justify-center text-stone-700 hover:text-stone-900"
              title="Voltar para Matérias"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div 
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${badgeStyle.classes}`}
              style={badgeStyle.style}
            >
              <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#D44E3D]">
                Matéria • {semesterLabel}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                {selectedSubject.name}
              </h1>
            </div>
          </div>

          {/* Quick Topic Creator form */}
          <div className="flex items-center gap-2 max-w-sm w-full">
            <Input
              type="text"
              placeholder="Novo Tópico (Ex: Apendicite)..."
              value={newTopicTitle}
              onChange={e => setNewTopicTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTopic()}
              className="h-10 bg-white border-[#E2E0D9] rounded-xl text-xs font-medium pl-3.5"
            />
            <Button
              onClick={handleAddTopic}
              disabled={isAddingTopicLoading || !newTopicTitle.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] uppercase tracking-wider font-bold rounded-xl h-10 px-4 whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </Button>
          </div>
        </div>

        {/* Search inside subject topics */}
        <div className="flex items-center justify-between gap-3 bg-stone-50 border border-stone-200 p-3 rounded-xl">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              type="text"
              placeholder="Buscar tópico por nome..."
              value={topicSearchQuery}
              onChange={e => setTopicSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 bg-white border-stone-200 rounded-xl text-xs font-medium"
            />
            {topicSearchQuery && (
              <button
                onClick={() => setTopicSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="text-[11px] font-mono font-extrabold text-stone-500">
            {filteredSubjectTopics.length} de {subjectTopics.length} TÓPICOS
          </div>
        </div>

        {/* Grid or List of Topics */}
        {filteredSubjectTopics.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white border border-[#E2E0D9] rounded-2xl max-w-md mx-auto space-y-3 shadow-xs">
            <BookOpen className="w-8 h-8 text-stone-300 mx-auto" />
            <h3 className="text-sm font-bold text-stone-800">Nenhum tópico registrado</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Crie um novo tópico ou assunto para começar a carregar os protocolos médicos, resumos e questões.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSubjectTopics.map((topic, tIdx) => {
              const depth = detectRealDepth(topic);
              const isCompleted = Boolean(userProgress?.completedTopicIds?.includes?.(topic.id) || topic.completed);

              return (
                <Card 
                  key={`topic-card-${topic.id}-${tIdx}`}
                  className="bg-white border-[#E2E0D9] shadow-xs rounded-2xl overflow-hidden hover:border-amber-500 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-base text-[#1A1A1A] leading-snug">
                          {(topic as any).title || (topic as any).name}
                        </h3>
                        
                        {/* Depth Level Badge */}
                        <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                          {depth === 'standard' && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200/80 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                              Resumo Padrão (1cr)
                            </span>
                          )}
                          {depth === 'deep' && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-300/80 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500" />
                              Avançado (5cr)
                            </span>
                          )}
                          {depth === 'elite' && (
                            <span className="bg-amber-500/10 text-amber-900 border border-amber-500/20 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-700 fill-amber-500" />
                              Elite (10cr)
                            </span>
                          )}
                          {depth === 'master' && (
                            <span className="bg-violet-50 text-violet-700 border border-violet-200/80 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-violet-500 fill-violet-500" />
                              Extensivo (50cr)
                            </span>
                          )}
                          {depth === 'monograph' && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                              Monografia (100cr)
                            </span>
                          )}
                          {depth === 'custom_analyzed' && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200/80 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-blue-500 fill-blue-500" />
                              Inteligente (Especial)
                            </span>
                          )}
                          {depth === 'none' && (
                            <span className="bg-stone-50 text-stone-500 border border-stone-200 text-[9px] font-bold px-2 py-0.5 rounded-md">
                              Sem conteúdo (Clique para gerar)
                            </span>
                          )}

                          {isCompleted && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Concluído
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete Topic Button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!userId) return;
                          if (confirm(`Excluir o tópico "${(topic as any).title || (topic as any).name}" permanentemente?`)) {
                            try {
                              await deleteDoc(doc(db, 'users', userId, 'topics', topic.id));
                            } catch (err) {
                              console.error('Error deleting topic:', err);
                            }
                          }
                        }}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-[#8E8A82] hover:text-rose-600 transition-all cursor-pointer"
                        title="Excluir Tópico"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-stone-50 px-5 py-3 border-t border-[#E2E0D9]/60 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-stone-500">
                      Protocolos & Resumos
                    </span>
                    <Button
                      size="sm"
                      onClick={() => onSelectTopic && onSelectTopic(topic)}
                      className="bg-[#1A1A1A] hover:bg-black text-white text-[10px] uppercase font-bold tracking-wider rounded-lg h-8 px-3 cursor-pointer flex items-center gap-1"
                    >
                      <span>Acessar</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-10">


      {/* Header section */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5 text-left">
            <div className="text-[10px] lg:text-[11px] uppercase tracking-widest text-[#8E8A82] font-bold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              Explorar Conteúdo
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-display font-black text-stone-900 tracking-tight">
                Matérias do Internato
              </h1>
              <span className="bg-amber-100/80 text-amber-900 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200">
                {subjects.length} Matérias
              </span>
            </div>
            <p className="text-[#8E8A82] italic font-display text-xs sm:text-sm lg:text-base">
              Selecione uma área médica para ver resumos, protocolos e questões.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onAddSubject && (
              <Button
                onClick={() => setIsAddingSubject(!isAddingSubject)}
                className="bg-[#1A1A1A] hover:bg-black text-white text-[11px] uppercase tracking-wider font-bold rounded-xl h-10 px-3.5 sm:px-4 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isAddingSubject ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>+ Matéria</span>
              </Button>
            )}
            {onCreateSemester && (
              <Button
                onClick={() => setIsAddingSemester(!isAddingSemester)}
                variant="outline"
                className="border-[#E2E0D9] hover:bg-stone-50 text-[11px] uppercase tracking-wider font-bold rounded-xl h-10 px-3.5 sm:px-4 flex items-center gap-1.5 shadow-xs bg-white text-stone-800 cursor-pointer"
              >
                {isAddingSemester ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>+ Semestre</span>
              </Button>
            )}
          </div>
        </div>

        {/* Search & Semester Navigation Controls - High Mobile Focus */}
        <div className="bg-[#FBFBFA] border border-[#E2E0D9] p-3 sm:p-4 rounded-2xl shadow-xs space-y-3">
          
          {/* Search bar & Dropdown selector on Mobile/Tablet */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
            {/* Search Input */}
            <div className="relative md:col-span-5 lg:col-span-4">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <Input
                type="text"
                placeholder="Buscar matéria por nome..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-10 bg-white border-[#E2E0D9] rounded-xl text-xs focus:ring-1 focus:ring-stone-400 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile / Tablet Dropdown Selector for All Semesters */}
            <div className="md:col-span-7 lg:col-span-8 flex items-center gap-2">
              <div className="relative w-full block sm:hidden">
                <select
                  value={semesterFilter}
                  onChange={e => setSemesterFilter(e.target.value)}
                  className="w-full h-10 pl-3 pr-8 bg-white border border-[#E2E0D9] rounded-xl text-xs font-bold text-stone-800 focus:outline-none appearance-none shadow-xs"
                >
                  <option value="all">🌟 Ver Todos os Semestres ({subjects.length})</option>
                  {semesters.map((s, sIdx) => (
                    <option key={`sem-opt-${s.id}-${sIdx}`} value={s.id}>
                      {s.name} {subjectCountsBySemester[s.id] ? `(${subjectCountsBySemester[s.id]})` : ''}
                    </option>
                  ))}
                </select>
                <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
              </div>

              {/* Mobile / Tablet / Desktop Horizontal Scrollable Pill Bar with Touch Targets */}
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto w-full pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSemesterFilter('all')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    semesterFilter === 'all'
                      ? 'bg-[#1A1A1A] text-white shadow-xs'
                      : 'bg-white text-stone-600 border border-[#E2E0D9] hover:bg-stone-100'
                  }`}
                >
                  <span>🌟 Todos os Semestres</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    semesterFilter === 'all' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                  }`}>
                    {subjects.length}
                  </span>
                </button>

                {semesters.map((s, sIdx) => {
                  const isActive = semesterFilter === s.id;
                  const count = subjectCountsBySemester[s.id] || 0;
                  return (
                    <button
                      key={`sem-btn-${s.id}-${sIdx}`}
                      type="button"
                      onClick={() => setSemesterFilter(s.id)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        isActive
                          ? 'bg-[#1A1A1A] text-white shadow-xs'
                          : 'bg-white text-stone-600 border border-[#E2E0D9] hover:bg-stone-100'
                      }`}
                    >
                      <span>{s.name}</span>
                      {count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Active Filter Indicator */}
          <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1 border-t border-[#E2E0D9]/60">
            <div className="flex items-center gap-1.5 font-medium">
              <span>Exibindo:</span>
              <strong className="text-stone-900 font-bold">
                {semesterFilter === 'all' 
                  ? 'Todos os Semestres' 
                  : (semesters.find(s => s.id === semesterFilter)?.name || 'Semestre Selecionado')}
              </strong>
              {searchQuery && <span className="text-amber-700"> matching "{searchQuery}"</span>}
            </div>

            {(semesterFilter !== 'all' || searchQuery !== '') && (
              <button
                onClick={() => {
                  setSemesterFilter('all');
                  setSearchQuery('');
                }}
                className="text-[10px] font-bold uppercase text-stone-600 hover:text-black underline cursor-pointer"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {/* Add Semester Form Inline */}
        {isAddingSemester && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleCreateSemester} className="bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl p-4 sm:p-6 shadow-xs max-w-xl space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-bold text-gray-800">Novo Semestre / Ciclo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82]">Número (Ordenação)</label>
                  <Input
                    type="number"
                    placeholder="Ex: 9"
                    value={newSemesterNumber}
                    onChange={e => setNewSemesterNumber(e.target.value)}
                    className="border-[#E2E0D9] bg-white rounded-xl h-11 text-xs focus:ring-primary"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82]">Nome do Semestre</label>
                  <Input
                    placeholder="Ex: 9º Semestre"
                    value={newSemesterName}
                    onChange={e => setNewSemesterName(e.target.value)}
                    className="border-[#E2E0D9] bg-white rounded-xl h-11 text-xs focus:ring-primary"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsAddingSemester(false)} className="text-[10px] uppercase tracking-widest font-bold h-10 px-4 rounded-xl">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingSemester || !newSemesterName.trim() || !newSemesterNumber}
                  className="bg-[#1A1A1A] hover:bg-black text-white text-[10px] uppercase tracking-widest font-bold h-10 px-6 rounded-xl disabled:opacity-50"
                >
                  {isSavingSemester ? 'Salvando...' : 'Criar Semestre'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Add Subject Form Inline */}
        {isAddingSubject && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#FBFBFA] border border-[#E2E0D9] rounded-2xl p-4 sm:p-6 shadow-xs max-w-xl space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-bold text-gray-800">Nova Matéria</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82]">Nome da Matéria</label>
                  <Input
                    placeholder="Ex: Pediatria"
                    value={newSubjectName}
                    onChange={e => setNewSubjectName(e.target.value)}
                    className="border-[#E2E0D9] bg-white rounded-xl h-11 text-xs focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82]">Ciclo / Semestre</label>
                    <button 
                      type="button" 
                      onClick={() => setIsAddingSemester(true)} 
                      className="text-[9px] font-bold text-indigo-600 hover:underline uppercase tracking-wide cursor-pointer"
                    >
                      + Novo Semestre
                    </button>
                  </div>
                  <select
                    value={selectedSemesterId}
                    onChange={e => setSelectedSemesterId(e.target.value)}
                    className="w-full h-11 border border-[#E2E0D9] bg-white rounded-xl px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    {availableSemesters.map((s, sIdx) => (
                      <option key={`sem-create-${s.id}-${sIdx}`} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setIsAddingSubject(false)} className="text-[10px] uppercase tracking-widest font-bold h-10 px-4 rounded-xl">
                  Cancelar
                </Button>
                <Button
                  disabled={isSaving || !newSubjectName.trim() || !selectedSemesterId}
                  onClick={async () => {
                    if (!newSubjectName.trim() || !selectedSemesterId) return;
                    setIsSaving(true);
                    try {
                      if (onAddSubject) {
                        await onAddSubject(newSubjectName.trim(), selectedSemesterId);
                      }
                      setNewSubjectName('');
                      setIsAddingSubject(false);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="bg-[#1A1A1A] hover:bg-black text-white text-[10px] uppercase tracking-widest font-bold h-10 px-6 rounded-xl disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Criar Matéria'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {filteredSubjects.length === 0 && (
        <div className="text-center py-12 px-4 bg-stone-50 border border-dashed border-stone-200 rounded-2xl max-w-md mx-auto space-y-3">
          <BookOpen className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="text-sm font-bold text-stone-800">Nenhuma matéria encontrada</h3>
          <p className="text-xs text-stone-500">
            Não encontramos matérias para o filtro selecionado ({semesterFilter === 'all' ? 'Todos os Semestres' : 'Semestre atual'}).
          </p>
          <Button
            onClick={() => {
              setSemesterFilter('all');
              setSearchQuery('');
            }}
            variant="outline"
            className="text-xs rounded-xl border-stone-300 font-bold h-9 px-4"
          >
            Ver Todos os Semestres
          </Button>
        </div>
      )}

      {/* Grid of Subjects - Responsive for Mobile/Tablet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5 lg:gap-8">
        {filteredSubjects.map((subject, subIdx) => {
          const IconComponent = (Icons as any)[subject.icon] || Icons.BookOpen;
          const semesterLabel = getSemesterLabel(subject.semesterId, semesters, subject.name);
          const badgeStyle = getSubjectBadgeStyle(subject);
          
          return (
            <Card 
              key={`subject-card-${subject.id}-${subIdx}`} 
              className="group cursor-pointer border-[#E2E0D9] shadow-xs hover:border-stone-800 hover:shadow-md active:scale-[0.99] transition-all duration-200 rounded-2xl overflow-hidden bg-white relative flex flex-col justify-between"
              onClick={() => onSelect(subject)}
            >
              <CardHeader className="p-5 sm:p-6 lg:p-8 pb-4">
                <div className="flex justify-between items-start mb-4 sm:mb-6">
                  <div 
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 relative ${badgeStyle.classes}`}
                    style={badgeStyle.style}
                  >
                    <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
                    {(userProgress as any)?.stats?.subjectQuestions?.[subject.id] > 0 && (
                      <div className="absolute -top-2 -right-2 bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                        {(userProgress as any).stats.subjectQuestions[subject.id]} Q
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end min-w-0 flex-1 max-w-[calc(100%-3.5rem)] overflow-hidden">
                    {semesterLabel && (
                      <span className="text-[9px] uppercase tracking-wider font-semibold bg-stone-100/80 border border-stone-200/60 px-2 py-0.5 rounded-md text-stone-500 shrink-0 max-w-full truncate">
                        {semesterLabel}
                      </span>
                    )}
                    {getSubjectModules(subject.id).hasInternato && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-amber-100 text-amber-900 border border-amber-200 shrink-0 max-w-full truncate">
                        Internato
                      </span>
                    )}
                    {getSubjectModules(subject.id).hasRevise && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-blue-100 text-blue-900 border border-blue-200 shrink-0 max-w-full truncate">
                        Revise
                      </span>
                    )}
                    {getSubjectModules(subject.id).linked && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-0.5 shrink-0 max-w-full truncate">
                        <Link2 size={10} className="shrink-0" /> Vinculada
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSubject(subject);
                        setEditSubjectName(subject.name);
                        setEditSubjectSemesterId(subject.semesterId || '');
                      }}
                      className="p-1.5 hover:bg-stone-100 rounded-lg text-[#8E8A82] hover:text-[#141414] transition-all cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="Editar Matéria"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <CardTitle className="text-xl sm:text-2xl font-display font-bold group-hover:text-primary transition-colors mb-1.5">
                  {subject.name}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-[#8E8A82] font-sans leading-relaxed line-clamp-2">
                  Protocolos, diagnósticos e condutas essenciais para {subject.name}.
                </CardDescription>
              </CardHeader>

              <CardContent className="px-5 sm:px-6 lg:px-8 pb-5 sm:pb-6 lg:pb-8 pt-0">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-stone-600 pt-4 border-t border-[#E2E0D9]">
                  <span>Ver Tópicos e Protocolos</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-stone-800" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E2E0D9] p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-gray-900">Editar Matéria</h3>
              {onDeleteSubject && (
                <button
                  onClick={async () => {
                    if (window.confirm(`Tem certeza que deseja excluir a matéria "${editingSubject.name}"?`)) {
                      setIsSavingEdit(true);
                      try {
                        await onDeleteSubject(editingSubject.id);
                        setEditingSubject(null);
                      } catch (err) {
                        console.error('Error deleting subject:', err);
                      } finally {
                        setIsSavingEdit(false);
                      }
                    }
                  }}
                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Excluir Matéria"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82]">Nome da Matéria</label>
                <Input 
                  value={editSubjectName}
                  onChange={e => setEditSubjectName(e.target.value)}
                  className="border-[#E2E0D9] bg-white rounded-xl h-11 text-xs focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8A82]">Semestre</label>
                <select
                  value={editSubjectSemesterId}
                  onChange={e => setEditSubjectSemesterId(e.target.value)}
                  className="w-full h-11 border border-[#E2E0D9] bg-white rounded-xl px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  {availableSemesters.map((s, sIdx) => (
                    <option key={`sem-edit-${s.id}-${sIdx}`} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setEditingSubject(null)} 
                className="text-[10px] uppercase tracking-widest font-bold h-10 px-4 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                disabled={isSavingEdit || !editSubjectName.trim() || !editSubjectSemesterId}
                onClick={handleSaveEditSubject}
                className="bg-[#1A1A1A] hover:bg-black text-white text-[10px] uppercase tracking-widest font-bold h-10 px-6 rounded-xl"
              >
                {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Subject Linker Modal */}
      <SubjectLinkerModal
        isOpen={isLinkerModalOpen}
        onClose={() => setIsLinkerModalOpen(false)}
        reviseSubjects={subjects as any}
        internatoSubjects={subjects as any}
      />
    </div>
  );
}
