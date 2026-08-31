import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, orderBy, getDocs, where } from '../firebase';
import { Subject, Topic, StudySession, Semester } from '../types';
import { Plus, Trash2, BookOpen, ChevronRight, History, BarChart2, Clock, CheckCircle, X, Edit2, Sparkles, Lightbulb, Brain, Zap, AlertTriangle, TrendingDown, Globe, Link2, Unlink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { accuracyToQuality, calculateNextReview } from '../utils/srs';
import { useStudyData } from '../hooks/useStudyData';
import { useSubjectLinks } from '../hooks/useSubjectLinks';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import SubjectLinkerModal from './SubjectLinkerModal';
import UpgradeModal from './UpgradeModal';

const PALETTE = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#E11D48', // Rose
];

export function getSubjectColor(subject?: { color?: string; name?: string; id?: string } | null): string {
  if (!subject) return '#6366F1';
  if (subject.color && subject.color.startsWith('#')) return subject.color;
  
  if (subject.color) {
    if (subject.color.includes('pink')) return '#EC4899';
    if (subject.color.includes('purple')) return '#8B5CF6';
    if (subject.color.includes('green') || subject.color.includes('emerald')) return '#10B981';
    if (subject.color.includes('blue')) return '#3B82F6';
    if (subject.color.includes('orange')) return '#F97316';
  }
  
  const key = subject.name || subject.id || 'subject';
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

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

export function calculateRetention(topic: Topic) {
  if (!topic.repetitions || topic.repetitions === 0 || !topic.lastReviewDate) {
    return {
      retentionPct: 100,
      daysSince: 0,
      status: 'Aguardando 1º Estudo',
      statusColor: 'text-neutral-500 bg-neutral-50 border-neutral-200',
      ringColor: 'stroke-neutral-300',
      interval: 0
    };
  }
  const now = new Date();
  const baseDate = topic.lastReviewDate ? parseISO(topic.lastReviewDate) : parseISO(topic.createdAt);
  const diffTime = Math.max(0, now.getTime() - baseDate.getTime());
  const daysSince = diffTime / (1000 * 3600 * 24);
  
  const interval = topic.interval > 0 ? topic.interval : 1;
  // R = 0.9 ^ (t / I)
  const retention = Math.pow(0.9, daysSince / interval);
  const retentionPct = Math.min(100, Math.max(0, Math.round(retention * 100)));
  
  let status = '';
  let statusColor = '';
  let ringColor = '';
  
  if (retentionPct >= 80) {
    status = 'Excelente (Sólido)';
    statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    ringColor = 'stroke-emerald-500';
  } else if (retentionPct >= 60) {
    status = 'Adequado (Calibrado)';
    statusColor = 'text-blue-700 bg-blue-50 border-blue-200';
    ringColor = 'stroke-blue-500';
  } else if (retentionPct >= 40) {
    status = 'Instável (Revisar Breve)';
    statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
    ringColor = 'stroke-amber-500';
  } else {
    status = 'Esquecimento Crítico (Urgente)';
    statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
    ringColor = 'stroke-rose-500';
  }
  
  return {
    retentionPct,
    daysSince: Math.round(daysSince * 10) / 10,
    status,
    statusColor,
    ringColor,
    interval
  };
}

interface SubjectListProps {
  onSwitchMode?: (mode: 'revise' | 'internato') => void;
}

export default function SubjectList({ onSwitchMode }: SubjectListProps = {}) {
  const { user, profile } = useAuth();
  const { subjects, topics, sessions, loading } = useStudyData();
  const { links, isSubjectLinked, getLinkedSubjectId } = useSubjectLinks();

  const [sourceFilter, setSourceFilter] = useState<'all' | 'revise' | 'internato' | 'linked'>('all');
  const [isLinkerModalOpen, setIsLinkerModalOpen] = useState(false);
  
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);
  
  // Semester states
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [isAddingSemester, setIsAddingSemester] = useState(false);
  const [newSemesterNumber, setNewSemesterNumber] = useState('');
  const [newSemesterName, setNewSemesterName] = useState('');
  const [isSavingSemester, setIsSavingSemester] = useState(false);
  const [editSubjectSemesterId, setEditSubjectSemesterId] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');

  // Instant pre-computed subject module map
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
      const isExplicitInternato = (s as any).source === 'internato' || (s as any).createdIn === 'internato' || (s as any).isInternato === true;
      const hasRevise = reviseSubIds.has(s.id) || (linkedId ? reviseSubIds.has(linkedId) : false) || true; // Default subjects in Revise have theoretical study
      const hasInternato = isExplicitInternato || internatoSubIds.has(s.id) || (linkedId ? internatoSubIds.has(linkedId) : false) || linked;

      map.set(s.id, { hasRevise, hasInternato, linked });
    });

    return map;
  }, [topics, subjects, links]);

  const getSubjectModules = (subId: string) => {
    return subjectModulesMap.get(subId) || { hasRevise: true, hasInternato: true, linked: false };
  };

  const filteredSubjects = useMemo(() => {
    return (subjects || []).filter(s => {
      // 1. Source filter
      const { hasRevise, hasInternato, linked } = getSubjectModules(s.id);
      if (sourceFilter === 'revise' && !hasRevise) return false;
      if (sourceFilter === 'internato' && !hasInternato && !linked) return false;
      if (sourceFilter === 'linked' && !linked && !(hasRevise && hasInternato)) return false;

      // 2. Semester filter
      if (!semesterFilter || semesterFilter === 'all') return true;

      const targetSemester = semesters.find(sem => 
        sem.id === semesterFilter || 
        String(sem.number) === String(semesterFilter) ||
        (sem as any).aliasIds?.includes(semesterFilter)
      );

      const subSem = getSemesterForSubject(s.semesterId, semesters, s.name);

      if (subSem && targetSemester) {
        return (
          subSem.id === targetSemester.id ||
          subSem.number === targetSemester.number ||
          (subSem as any).aliasIds?.includes(targetSemester.id) ||
          (targetSemester as any).aliasIds?.includes(subSem.id) ||
          ((subSem as any).aliasIds && (targetSemester as any).aliasIds && 
            (subSem as any).aliasIds.some((id: string) => (targetSemester as any).aliasIds.includes(id)))
        );
      }

      if (subSem) {
        return (
          subSem.id === semesterFilter ||
          String(subSem.number) === String(semesterFilter) ||
          (subSem as any).aliasIds?.includes(semesterFilter)
        );
      }

      if (targetSemester) {
        return (
          String(s.semesterId) === String(targetSemester.id) ||
          String(s.semesterId) === String(targetSemester.number) ||
          (targetSemester as any).aliasIds?.includes(String(s.semesterId))
        );
      }

      return String(s.semesterId) === String(semesterFilter);
    });
  }, [subjects, semesterFilter, semesters, sourceFilter, topics, links, subjectModulesMap]);

  // Load user-specific semesters in real-time with deduplication
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'semesters'), orderBy('number'));
    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Semester));
      
      const uniqueSemesters: Semester[] = [];
      const seenKeys = new Set<string>();
      const duplicatesToDelete: string[] = [];

      for (const sem of loaded) {
        const key = sem.number ? `num_${sem.number}` : `name_${(sem.name || '').trim().toLowerCase()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const semWithAliases: Semester & { aliasIds: string[] } = {
            ...sem,
            aliasIds: [sem.id]
          };
          if (sem.number) {
            semWithAliases.aliasIds.push(`sem_${sem.number}`, String(sem.number));
          }
          uniqueSemesters.push(semWithAliases);
        } else {
          const existing = uniqueSemesters.find(s => 
            (s.number && s.number === sem.number) ||
            (s.name && s.name.trim().toLowerCase() === sem.name?.trim().toLowerCase())
          ) as (Semester & { aliasIds: string[] }) | undefined;

          if (existing) {
            if (!existing.aliasIds) existing.aliasIds = [existing.id];
            if (!existing.aliasIds.includes(sem.id)) {
              existing.aliasIds.push(sem.id);
            }
          }
          duplicatesToDelete.push(sem.id);
        }
      }

      setSemesters(uniqueSemesters);

      if (duplicatesToDelete.length > 0 && user?.uid) {
        duplicatesToDelete.forEach(dupId => {
          deleteDoc(doc(db, 'users', user.uid, 'semesters', dupId)).catch(err => {
            console.warn('Could not delete duplicate semester doc:', dupId, err);
          });
        });
      }
    }, (error) => {
      console.error('Error fetching semesters in MedRevise:', error);
    });
    return () => unsub();
  }, [user]);

  // Sync selectedSemesterId once semesters are loaded
  useEffect(() => {
    if (semesters.length > 0 && !selectedSemesterId) {
      setSelectedSemesterId(semesters[0].id);
    }
  }, [semesters, selectedSemesterId]);

  // Freemium states
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(() => {
    const saved = localStorage.getItem('selectedSubjectId');
    return null; // We'll handle this in a useEffect to match with fetched subjects
  });
  
  useEffect(() => {
    if (subjects.length > 0 && !selectedSubject) {
      const savedId = localStorage.getItem('selectedSubjectId');
      if (savedId) {
        const found = subjects.find(s => s.id === savedId);
        if (found) {
          setSelectedSubject(found);
          return;
        }
      }
      setSelectedSubject(subjects[0]);
    }
  }, [subjects, selectedSubject]);

  // Cross-App incoming navigation and handling
  useEffect(() => {
    const targetTopicId = localStorage.getItem('cross_app_nav_topic_id');
    const targetTopicTitle = localStorage.getItem('cross_app_nav_topic_title');
    const wasFromInternato = localStorage.getItem('was_navigated_from_internato') === 'true';
    
    if ((targetTopicId || targetTopicTitle) && topics.length > 0 && subjects.length > 0 && wasFromInternato) {
      localStorage.removeItem('cross_app_nav_topic_id');
      localStorage.removeItem('cross_app_nav_topic_title');
      localStorage.removeItem('was_navigated_from_internato');

      let foundTopic = targetTopicId ? topics.find(t => t.id === targetTopicId) : undefined;
      
      if (!foundTopic && targetTopicTitle) {
        const cleanTitle = targetTopicTitle.toLowerCase().trim();
        foundTopic = topics.find(t => t.name.toLowerCase().trim() === cleanTitle) ||
                     topics.find(t => cleanTitle.includes(t.name.toLowerCase().trim()) || t.name.toLowerCase().trim().includes(cleanTitle));
      }

      if (foundTopic) {
        const foundSubject = subjects.find(s => s.id === foundTopic.subjectId);
        if (foundSubject) {
          setSelectedSubject(foundSubject);
          localStorage.setItem('selectedSubjectId', foundSubject.id);

          // If the topic has never been studied/scheduled in MedRevise, open the study session form
          if (!foundTopic.repetitions || foundTopic.repetitions === 0) {
            localStorage.removeItem('auto_trigger_review_panel');
            setTimeout(() => {
              setShowSessionForm(foundTopic);
              alert(
                `🔔 NOTIFICAÇÃO: O assunto "${foundTopic.name}" foi importado do MedInternato, mas ainda não possui agendamento de repetição espaçada no MedRevise.\n\nPreencha os dados abaixo neste painel de criação completo para iniciar o agendamento de revisões!`
              );
            }, 300);
          } else {
            // Otherwise, highlight and notify
            setTimeout(() => {
              const shouldTriggerReview = localStorage.getItem('auto_trigger_review_panel') === 'true';
              if (shouldTriggerReview) {
                localStorage.removeItem('auto_trigger_review_panel');
                quickReview(foundTopic);
              } else {
                alert(`📍 Sincronizado do MedInternato: Tópico "${foundTopic.name}" selecionado no MedRevise.`);
                // Smooth scroll to the topic element
                const el = document.getElementById(`topic-${foundTopic.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-[#141414]', 'ring-offset-2');
                  setTimeout(() => {
                    el.classList.remove('ring-2', 'ring-[#141414]', 'ring-offset-2');
                  }, 3000);
                }
              }
            }, 500);
          }
        }
      } else if (targetTopicTitle) {
        alert(`📍 MedRevise: Redirecionado para visualizar o tópico "${targetTopicTitle}". Adicione este tópico no seu cadastro do MedRevise para acompanhar as revisões espaçadas.`);
      }
    }
  }, [topics, subjects]);

  const handleViewInInternato = (topic: { id: string; [key: string]: any }) => {
    // Set navigation context
    localStorage.setItem('cross_app_nav_topic_id', topic.id);
    localStorage.setItem('was_imported_from_revise', 'true');
    
    // Switch mode
    if (onSwitchMode) {
      onSwitchMode('internato');
    } else {
      window.dispatchEvent(new CustomEvent('switch-mode', { detail: 'internato' }));
    }
  };

  const handleSelectSubject = (sub: Subject) => {
    setSelectedSubject(sub);
    localStorage.setItem('selectedSubjectId', sub.id);
  };

  const [newTopicName, setNewTopicName] = useState('');
  
  const [showSessionForm, setShowSessionForm] = useState<Topic | null>(null);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [sessionData, setSessionData] = useState({
    questions: '',
    correct: '',
    time: '',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    description: ''
  });

  const [showHistory, setShowHistory] = useState<Topic | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [editTopicNoMoreReviews, setEditTopicNoMoreReviews] = useState(false);
  const [editTopicSubjectId, setEditTopicSubjectId] = useState('');

  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');

  const [isManageSemestersOpen, setIsManageSemestersOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [editSemesterName, setEditSemesterName] = useState('');
  const [editSemesterNumber, setEditSemesterNumber] = useState('');
  const [confirmDeleteSemesterId, setConfirmDeleteSemesterId] = useState<string | null>(null);

  const [reviewingTopic, setReviewingTopic] = useState<Topic | null>(null);
  const [reviewMethod, setReviewMethod] = useState<'perception' | 'questions'>('perception');
  const [reviewQuality, setReviewQuality] = useState<number | null>(null);
  const [reviewQuestionsCount, setReviewQuestionsCount] = useState<number | string>('');
  const [reviewCorrectCount, setReviewCorrectCount] = useState<number | string>('');
  const [reviewTime, setReviewTime] = useState<number | string>(15);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewDate, setReviewDate] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const subjectTopics = useMemo(() => {
    if (!selectedSubject || !topics || topics.length === 0) return [];

    const selId = String(selectedSubject.id).trim();
    const linkedId = getLinkedSubjectId(selectedSubject.id);
    const linkedIdStr = linkedId ? String(linkedId).trim() : null;

    const norm = (str: any) => {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
    };

    const selIdNorm = norm(selectedSubject.id);
    const selNameNorm = norm(selectedSubject.name);
    const linkedIdNorm = linkedIdStr ? norm(linkedIdStr) : '';

    const equivalentSubjectIds = new Set<string>();
    if (selId) equivalentSubjectIds.add(selId);
    if (linkedIdStr) equivalentSubjectIds.add(linkedIdStr);

    (subjects || []).forEach(s => {
      if (!s) return;
      const sId = String(s.id).trim();
      const sNorm = norm(s.name);
      if (sNorm && selNameNorm && sNorm === selNameNorm) {
        equivalentSubjectIds.add(sId);
      }
      if (isSubjectLinked(s.id) && (getLinkedSubjectId(s.id) === selId || (linkedIdStr && sId === linkedIdStr))) {
        equivalentSubjectIds.add(sId);
      }
    });

    const equivalentSubjectNames = new Set<string>();
    if (selNameNorm) equivalentSubjectNames.add(selNameNorm);
    (subjects || []).forEach(s => {
      if (equivalentSubjectIds.has(String(s.id).trim())) {
        const n = norm(s.name);
        if (n) equivalentSubjectNames.add(n);
      }
    });

    return topics.filter((t: any) => {
      if (!t) return false;

      const tSubId = t.subjectId ? String(t.subjectId).trim() : '';
      if (tSubId && (tSubId === selId || (linkedIdStr && tSubId === linkedIdStr) || equivalentSubjectIds.has(tSubId))) {
        return true;
      }

      const tSubIdNorm = norm(tSubId);
      if (tSubIdNorm && (tSubIdNorm === selIdNorm || (linkedIdNorm && tSubIdNorm === linkedIdNorm) || equivalentSubjectNames.has(tSubIdNorm))) {
        return true;
      }

      const tSubNameNorm = norm(t.subjectName || t.subject || t.subject_name);
      if (tSubNameNorm && equivalentSubjectNames.has(tSubNameNorm)) {
        return true;
      }

      return false;
    });
  }, [topics, selectedSubject, subjects, links]);

  const subjectRetentionStats = useMemo(() => {
    if (subjectTopics.length === 0) return null;
    
    let totalRetention = 0;
    let solidCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let lowestRetentionTopic: Topic | null = null;
    let lowestPct = 101;
    
    subjectTopics.forEach(topic => {
      let pct = 100;
      if (topic.repetitions && topic.repetitions > 0 && topic.lastReviewDate) {
        const now = new Date();
        const baseDate = parseISO(topic.lastReviewDate);
        const daysSince = Math.max(0, (now.getTime() - baseDate.getTime()) / (1000 * 3600 * 24));
        const interval = topic.interval > 0 ? topic.interval : 1;
        const retention = Math.pow(0.9, daysSince / interval);
        pct = Math.min(100, Math.max(0, Math.round(retention * 100)));
      }
      
      totalRetention += pct;
      
      if (pct >= 80) solidCount++;
      else if (pct >= 50) warningCount++;
      else criticalCount++;
      
      if (pct < lowestPct) {
        lowestPct = pct;
        lowestRetentionTopic = topic;
      }
    });
    
    const avgRetention = Math.round(totalRetention / subjectTopics.length);
    
    return {
      avgRetention,
      solidCount,
      warningCount,
      criticalCount,
      lowestRetentionTopic: lowestRetentionTopic as Topic | null,
      lowestPct
    };
  }, [subjectTopics]);

  const addSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newSemesterNumber || !newSemesterName.trim()) return;
    setIsSavingSemester(true);
    try {
      const num = parseInt(newSemesterNumber, 10);
      const docRef = await addDoc(collection(db, 'users', user.uid, 'semesters'), {
        number: isNaN(num) ? 1 : num,
        name: newSemesterName.trim()
      });
      setSelectedSemesterId(docRef.id);
      setNewSemesterName('');
      setNewSemesterNumber('');
      setIsAddingSemester(false);
    } catch (error) {
      console.error('Error creating semester in MedRevise:', error);
    } finally {
      setIsSavingSemester(false);
    }
  };

  const addSubject = async () => {
    if (!user || !newSubjectName.trim()) return;
    
    const isPremiumUser = profile?.isPremium || profile?.email === 'lucas1renck2melo@gmail.com';
    if (!isPremiumUser && subjects.length >= 3) {
      setUpgradeReason('Você atingiu o limite de 3 matérias recomendadas para o plano Gratuito. Adquira o Plano Pro para organizar seu edital completo!');
      setIsUpgradeModalOpen(true);
      return;
    }

    try {
      await addDoc(collection(db, 'users', user.uid, 'subjects'), {
        name: newSubjectName.trim(),
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        icon: 'book',
        createdAt: new Date().toISOString(),
        semesterId: selectedSemesterId || ''
      });
      setNewSubjectName('');
      setShowAddSubject(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/subjects`);
    }
  };

  const addTopic = async () => {
    if (!user || !newTopicName.trim() || !selectedSubject) return;
    
    const isPremiumUser = profile?.isPremium || profile?.email === 'lucas1renck2melo@gmail.com';
    if (!isPremiumUser && subjectTopics.length >= 5) {
      setUpgradeReason('No plano Gratuito, você pode registrar até 5 assuntos/tópicos em cada matéria. Desbloqueie o Plano Pro para obter tópicos ilimitados!');
      setIsUpgradeModalOpen(true);
      return;
    }

    try {
      await addDoc(collection(db, 'users', user.uid, 'topics'), {
        name: newTopicName,
        subjectId: selectedSubject.id,
        interval: 0,
        easinessFactor: 2.5,
        repetitions: 0,
        createdAt: new Date().toISOString(),
        nextReviewDate: '' // Set empty initially until studied
      });
      setNewTopicName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/topics`);
    }
  };

  const deleteTopic = async (topicId: string) => {
    if (!user) return;
    if (confirm('Deseja excluir este tópico e todo o seu histórico de estudos? Esta ação não pode ser desfeita.')) {
      try {
        // Delete associated sessions
        const topicSessions = sessions.filter(s => s.topicId === topicId);
        for (const session of topicSessions) {
          await deleteDoc(doc(db, 'users', user.uid, 'studySessions', session.id));
        }

        // Delete the topic itself
        await deleteDoc(doc(db, 'users', user.uid, 'topics', topicId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/topics/${topicId}`);
      }
    }
  };

  const updateTopic = async () => {
    if (!user || !editingTopic || !editTopicName.trim()) return;
    try {
      const oldSubjectId = editingTopic.subjectId;
      const newSubjectId = editTopicSubjectId || editingTopic.subjectId;

      await updateDoc(doc(db, 'users', user.uid, 'topics', editingTopic.id), {
        name: editTopicName.trim(),
        noMoreReviews: editTopicNoMoreReviews,
        subjectId: newSubjectId
      });

      // Update studySessions to match the new subjectId
      if (oldSubjectId !== newSubjectId) {
        const sessionsRef = collection(db, 'users', user.uid, 'studySessions');
        const q = query(sessionsRef, where('topicId', '==', editingTopic.id));
        const snap = await getDocs(q);
        for (const sessionDoc of snap.docs) {
          await updateDoc(doc(db, 'users', user.uid, 'studySessions', sessionDoc.id), {
            subjectId: newSubjectId
          });
        }
      }

      setEditingTopic(null);
      setEditTopicName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/topics/${editingTopic.id}`);
    }
  };

  const updateSemester = async () => {
    if (!user || !editingSemester || !editSemesterName.trim()) return;
    try {
      const num = parseInt(editSemesterNumber, 10);
      await updateDoc(doc(db, 'users', user.uid, 'semesters', editingSemester.id), {
        name: editSemesterName.trim(),
        number: isNaN(num) ? editingSemester.number : num
      });
      setEditingSemester(null);
      setEditSemesterName('');
      setEditSemesterNumber('');
    } catch (error) {
      console.error('Error updating semester:', error);
    }
  };

  const updateSubject = async () => {
    if (!user || !editingSubject || !editSubjectName.trim()) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'subjects', editingSubject.id), {
        name: editSubjectName.trim(),
        semesterId: editSubjectSemesterId || ''
      });
      if (selectedSubject?.id === editingSubject.id) {
        setSelectedSubject({ ...selectedSubject, name: editSubjectName.trim(), semesterId: editSubjectSemesterId });
      }
      setEditingSubject(null);
      setEditSubjectName('');
      setEditSubjectSemesterId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/subjects/${editingSubject.id}`);
    }
  };

  const deleteSubject = async (id: string) => {
    if (!user) return;
    if (confirm('Deseja excluir esta matéria e todos os seus tópicos e sessões de estudo? Esta ação não pode ser desfeita.')) {
      try {
        // Delete associated topics
        const subjectTopics = topics.filter(t => t.subjectId === id);
        for (const topic of subjectTopics) {
          await deleteDoc(doc(db, 'users', user.uid, 'topics', topic.id));
        }

        // Delete associated sessions
        const subjectSessions = sessions.filter(s => s.subjectId === id);
        for (const session of subjectSessions) {
          await deleteDoc(doc(db, 'users', user.uid, 'studySessions', session.id));
        }

        // Delete the subject itself
        await deleteDoc(doc(db, 'users', user.uid, 'subjects', id));
        
        if (selectedSubject?.id === id) {
          setSelectedSubject(null);
          localStorage.removeItem('selectedSubjectId');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/subjects/${id}`);
      }
    }
  };

  const submitSession = async () => {
    if (!user || (!showSessionForm && !editingSession)) return;
    
    const topic = showSessionForm || topics.find(t => t.id === editingSession?.topicId);
    if (!topic) return;

    const questions = parseInt(sessionData.questions) || 0;
    const correct = parseInt(sessionData.correct) || 0;
    const time = parseInt(sessionData.time) || 0;

    const quality = accuracyToQuality(correct, questions);
    const srsUpdate = calculateNextReview(
      quality, 
      topic.repetitions ?? 0, 
      topic.interval ?? 0, 
      topic.easinessFactor ?? 2.5
    );

    try {
      if (editingSession) {
        // Update session
        await updateDoc(doc(db, 'users', user.uid, 'studySessions', editingSession.id), {
          questionsCount: questions,
          correctCount: correct,
          studyTimeMinutes: time,
          date: sessionData.date,
          description: sessionData.description
        });
        setEditingSession(null);
      } else {
        // Add session
        await addDoc(collection(db, 'users', user.uid, 'studySessions'), {
          topicId: topic.id,
          subjectId: topic.subjectId,
          date: sessionData.date,
          questionsCount: questions,
          correctCount: correct,
          studyTimeMinutes: time,
          description: sessionData.description
        });

        // Update topic only for new sessions (SRS progression)
        await updateDoc(doc(db, 'users', user.uid, 'topics', topic.id), {
          interval: srsUpdate.interval,
          easinessFactor: srsUpdate.ease,
          repetitions: srsUpdate.repetitions,
          nextReviewDate: srsUpdate.nextReviewDate,
          lastReviewDate: sessionData.date,
          wasRescheduledOverdue: false,
          completed: false
        });
      }

      setShowSessionForm(null);
      setSessionData({ questions: '', correct: '', time: '', date: format(new Date(), "yyyy-MM-dd'T'HH:mm"), description: '' });
    } catch (error) {
      handleFirestoreError(error, editingSession ? OperationType.UPDATE : OperationType.CREATE, `users/${user.uid}/studySessions`);
    }
  };

  const quickReview = (topic: Topic) => {
    setReviewingTopic(topic);
    setReviewMethod('perception');
    setReviewQuality(null);
    setReviewQuestionsCount('');
    setReviewCorrectCount('');
    setReviewTime(15);
    setReviewNotes('');
    setReviewDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  };

  const submitReview = async () => {
    if (!user || !reviewingTopic) return;

    let quality = reviewQuality;
    let questions = 0;
    let correct = 0;

    if (reviewMethod === 'questions') {
      questions = parseInt(reviewQuestionsCount as string) || 0;
      correct = parseInt(reviewCorrectCount as string) || 0;
      quality = accuracyToQuality(correct, questions);
    } else {
      if (quality === null) return;
    }
    
    try {
      const parsedReviewDate = reviewDate ? new Date(reviewDate) : new Date();
      const dateIso = parsedReviewDate.toISOString();

      const srsUpdate = calculateNextReview(
        quality, 
        reviewingTopic.repetitions ?? 0, 
        reviewingTopic.interval ?? 0, 
        reviewingTopic.easinessFactor ?? 2.5,
        parsedReviewDate
      );

      const finalReviewTime = Number(reviewTime) || 15;

      // Add study session
      await addDoc(collection(db, 'users', user.uid, 'studySessions'), {
        topicId: reviewingTopic.id,
        subjectId: reviewingTopic.subjectId,
        date: dateIso,
        questionsCount: questions,
        correctCount: correct,
        studyTimeMinutes: finalReviewTime,
        description: reviewMethod === 'questions'
          ? `Revisão por Questões (${correct}/${questions} acertos)${reviewNotes.trim() ? ` - ${reviewNotes.trim()}` : ''}`
          : `Revisão Ativa (Autopercepção: ${quality}/5)${reviewNotes.trim() ? ` - ${reviewNotes.trim()}` : ''}`
      });

      // Update topic
      await updateDoc(doc(db, 'users', user.uid, 'topics', reviewingTopic.id), {
        interval: srsUpdate.interval,
        easinessFactor: srsUpdate.ease,
        repetitions: srsUpdate.repetitions,
        nextReviewDate: srsUpdate.nextReviewDate,
        lastReviewDate: dateIso,
        wasRescheduledOverdue: false,
        completed: false
      });

      setReviewingTopic(null);
      setReviewQuality(null);
      setReviewQuestionsCount('');
      setReviewCorrectCount('');
      setReviewTime(15);
      setReviewNotes('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/studySessions`);
    }
  };

  if (loading) return <div className="font-mono text-xs opacity-50">CARREGANDO MATÉRIAS...</div>;

  const isReviewSubmitDisabled = reviewMethod === 'perception'
    ? reviewQuality === null
    : (!reviewQuestionsCount || Number(reviewQuestionsCount) <= 0 || reviewCorrectCount === '' || Number(reviewCorrectCount) > Number(reviewQuestionsCount));

  return (
    <div className="space-y-6">


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar: Subjects */}
      <div className="lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest">Suas Matérias</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAddingSemester(!isAddingSemester)}
              className="px-2 py-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all border border-[#141414] font-mono text-[9px] uppercase font-bold"
              title="Criar Semestre"
            >
              + SEMESTRE
            </button>
            <button 
              onClick={() => setShowAddSubject(!showAddSubject)}
              className="p-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all border border-[#141414]"
              title="Adicionar Matéria"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {isAddingSemester && (
          <form onSubmit={addSemester} className="p-4 bg-white border border-[#141414] mb-4 space-y-3">
            <h4 className="font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-500">Novo Semestre</h4>
            <div className="grid grid-cols-3 gap-2">
              <input 
                type="number"
                placeholder="Nº"
                value={newSemesterNumber}
                onChange={e => setNewSemesterNumber(e.target.value)}
                className="col-span-1 p-2 font-mono text-xs border border-[#141414] focus:outline-none"
                required
              />
              <input 
                type="text"
                placeholder="Ex: 9º Semestre"
                value={newSemesterName}
                onChange={e => setNewSemesterName(e.target.value)}
                className="col-span-2 p-2 font-mono text-xs border border-[#141414] focus:outline-none"
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setIsAddingSemester(false)} 
                className="px-3 py-1.5 font-mono text-[9px] uppercase border border-[#141414]"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={isSavingSemester}
                className="px-3 py-1.5 bg-[#141414] text-[#E4E3E0] font-mono text-[9px] uppercase disabled:opacity-50"
              >
                {isSavingSemester ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        )}

        {showAddSubject && (
          <div className="p-4 bg-white border border-[#141414] mb-4 space-y-3">
            <h4 className="font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-500">Nova Matéria</h4>
            <input 
              type="text" 
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Nome da Matéria"
              className="w-full p-2 font-mono text-xs border border-[#141414] focus:outline-none"
            />
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-mono uppercase text-neutral-400">Semestre / Ciclo</label>
                <button 
                  type="button" 
                  onClick={() => setIsAddingSemester(true)} 
                  className="text-[9px] font-bold text-indigo-600 hover:underline uppercase tracking-wide font-mono"
                >
                  + Criar
                </button>
              </div>
              {semesters.length === 0 ? (
                <div className="text-[9px] font-mono p-2 border border-dashed border-[#141414]/20 text-amber-600 bg-amber-50">
                  Nenhum semestre cadastrado. Crie um primeiro.
                </div>
              ) : (
                <select
                  value={selectedSemesterId}
                  onChange={e => setSelectedSemesterId(e.target.value)}
                  className="w-full p-2 font-mono text-xs border border-[#141414] bg-white focus:outline-none"
                >
                  <option value="">Selecione um semestre...</option>
                  {semesters.map((s, sIdx) => (
                    <option key={`sem-select1-${s.id}-${sIdx}`} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            <button 
              onClick={addSubject}
              className="w-full bg-[#141414] text-[#E4E3E0] py-2 font-mono text-[10px] uppercase"
            >
              ADICIONAR
            </button>
          </div>
        )}

        {semesters.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Filtrar por Semestre</span>
              <button 
                onClick={() => setIsManageSemestersOpen(true)}
                className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 hover:text-indigo-800 uppercase font-mono tracking-wider transition-colors cursor-pointer"
                title="Editar semestres criados"
              >
                <Edit2 size={10} />
                <span>Editar Semestres</span>
              </button>
            </div>
            
            <div className="flex flex-wrap gap-1.5 p-1 bg-stone-100/60 border border-stone-200 rounded-lg">
              <button
                onClick={() => setSemesterFilter('all')}
                className={cn(
                  "flex-1 min-w-[70px] text-center px-2 py-1.5 rounded-md font-mono text-[10px] uppercase font-bold transition-all cursor-pointer truncate",
                  semesterFilter === 'all'
                    ? "bg-[#141414] text-[#E4E3E0] shadow-sm"
                    : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-900"
                )}
              >
                Todos
              </button>
              {semesters.map((s, sIdx) => {
                const subCount = subjects.filter(sub => String(sub.semesterId) === String(s.id)).length;
                return (
                  <button
                    key={`sem-pill-${s.id}-${sIdx}`}
                    onClick={() => setSemesterFilter(s.id)}
                    className={cn(
                      "flex-1 min-w-[85px] flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md font-mono text-[10px] uppercase font-bold transition-all cursor-pointer truncate",
                      semesterFilter === s.id
                        ? "bg-[#141414] text-[#E4E3E0] shadow-sm"
                        : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-900"
                    )}
                    title={`${s.name} (${subCount} matérias)`}
                  >
                    <span>{s.name}</span>
                    <span className={cn(
                      "text-[8px] px-1 rounded-full shrink-0 font-sans",
                      semesterFilter === s.id ? "bg-amber-400 text-neutral-900" : "bg-stone-200 text-stone-700"
                    )}>
                      {subCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {filteredSubjects.map((sub, subIdx) => (
            <div 
              key={`sub-item-${sub.id}-${subIdx}`}
              onClick={() => handleSelectSubject(sub)}
              className={cn(
                "group flex items-center justify-between p-4 border border-[#141414] cursor-pointer transition-all gap-3 min-w-0",
                selectedSubject?.id === sub.id ? "bg-[#141414] text-[#E4E3E0]" : "bg-white hover:bg-[#141414]/5"
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div 
                  className="w-4 h-4 rounded-md shrink-0 border border-black/20 shadow-sm transition-transform group-hover:scale-110 flex items-center justify-center text-white" 
                  style={{ backgroundColor: getSubjectColor(sub) }} 
                  title={`Matéria: ${sub.name}`}
                >
                  <BookOpen className="w-2.5 h-2.5 stroke-[2.5]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-serif italic text-sm truncate" title={sub.name}>{sub.name}</span>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap max-w-full min-w-0 overflow-hidden">
                    <span className={cn(
                      "text-[8.5px] font-mono uppercase tracking-wider font-bold block transition-colors shrink-0 max-w-full truncate",
                      selectedSubject?.id === sub.id ? "text-amber-200 opacity-90" : "text-neutral-500"
                    )}>
                      {getSemesterLabel(sub.semesterId, semesters, sub.name)}
                    </span>
                    {getSubjectModules(sub.id).hasRevise && (
                      <span className={cn("px-1 py-0.2 rounded text-[7.5px] font-mono font-bold uppercase shrink-0 max-w-full truncate", selectedSubject?.id === sub.id ? "bg-blue-900/80 text-blue-100" : "bg-blue-50 text-blue-700 border border-blue-200")}>
                        Revise
                      </span>
                    )}
                    {(getSubjectModules(sub.id).hasInternato || getSubjectModules(sub.id).linked) && (
                      <span className={cn("px-1 py-0.2 rounded text-[7.5px] font-mono font-bold uppercase shrink-0 max-w-full truncate", selectedSubject?.id === sub.id ? "bg-amber-900/80 text-amber-100" : "bg-amber-50 text-amber-700 border border-amber-200")}>
                        Internato
                      </span>
                    )}
                    {getSubjectModules(sub.id).linked && (
                      <span className={cn("px-1 py-0.2 rounded text-[7.5px] font-mono font-bold uppercase flex items-center gap-0.5 shrink-0 max-w-full truncate", selectedSubject?.id === sub.id ? "bg-emerald-900/80 text-emerald-100" : "bg-emerald-50 text-emerald-700 border border-emerald-200")}>
                        <Link2 size={8} className="shrink-0" /> Vinculada
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-inherit shrink-0">
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingSubject(sub); setEditSubjectName(sub.name); setEditSubjectSemesterId(sub.semesterId || ''); }}
                  className="p-1 hover:text-indigo-500 duration-150"
                  title="Editar Matéria"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteSubject(sub.id); }}
                  className="p-1 hover:text-red-500 duration-150"
                  title="Excluir Matéria"
                >
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main: Topics & Details */}
      <div className="lg:col-span-8">
        {selectedSubject ? (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif italic text-2xl sm:text-3xl">{selectedSubject.name}</h2>
                <p className="text-[9px] sm:text-[10px] font-mono opacity-50 uppercase mt-1">
                  {subjectTopics.length} Tópicos Registrados
                </p>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="Novo Tópico..."
                  className="flex-1 sm:flex-none p-2 font-mono text-xs border border-[#141414] focus:outline-none bg-white min-w-0"
                />
                <button 
                  onClick={addTopic}
                  className="bg-[#141414] text-[#E4E3E0] px-4 font-mono text-[10px] uppercase whitespace-nowrap"
                >
                  ADICIONAR
                </button>
              </div>
            </div>

            {/* Subject-wide cognitive overview of forgetting curve */}
            {subjectRetentionStats && (
              <div className="bg-white border text-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] bg-indigo-50/5 border-[#141414]">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-dashed border-[#141414]/15">
                  <Brain className="text-indigo-600 shrink-0" size={24} />
                  <div>
                    <h3 className="font-serif italic text-lg leading-tight">Saúde Mental & Curva de Esquecimento</h3>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#141414]/55 mt-0.5">Teoria da Recordação Ativa (Hermann Ebbinghaus)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Circular/Text Progress (Left) */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-dashed border-[#141414]/15 pb-4 md:pb-0 md:pr-4 text-center">
                    <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">Retenção Média</span>
                    <div className="text-4xl sm:text-5xl font-serif italic font-bold text-indigo-950">{subjectRetentionStats.avgRetention}%</div>
                    
                    <div className="w-full bg-neutral-100 h-2 border border-[#141414]/10 rounded-none overflow-hidden mt-3 max-w-[150px]">
                      <div 
                        className="h-full bg-indigo-600 transition-all"
                        style={{ width: `${subjectRetentionStats.avgRetention}%` }}
                      />
                    </div>
                    
                    <span className="text-[9.5px] font-mono mt-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 uppercase">
                      {subjectRetentionStats.avgRetention >= 80 ? '🔒 Retenção Blindada' :
                       subjectRetentionStats.avgRetention >= 65 ? '⚡ Zonas Toleráveis' :
                       '⚠️ Requer Revisão Ativa'}
                    </span>
                  </div>

                  {/* Health bars indicators (Center) */}
                  <div className="md:col-span-8 space-y-4">
                    <div>
                      <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest block mb-1.5">Comportamento do Conteúdo:</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 border border-emerald-250 bg-emerald-50/40 text-center">
                          <div className="font-mono text-sm font-bold text-emerald-800">{subjectRetentionStats.solidCount}</div>
                          <div className="font-mono text-[8px] uppercase text-emerald-600">Sólidos (≥80%)</div>
                        </div>
                        <div className="p-2 border border-amber-250 bg-amber-50/40 text-center">
                          <div className="font-mono text-sm font-bold text-amber-800">{subjectRetentionStats.warningCount}</div>
                          <div className="font-mono text-[8px] uppercase text-amber-600">Instáveis (50-79%)</div>
                        </div>
                        <div className="p-2 border border-rose-250 bg-rose-50/40 text-center">
                          <div className="font-mono text-sm font-bold text-rose-800">{subjectRetentionStats.criticalCount}</div>
                          <div className="font-mono text-[8px] uppercase text-[#DC2626]">Críticos (&lt;50%)</div>
                        </div>
                      </div>
                    </div>

                    {/* Direct suggestion to trigger active recall */}
                    {subjectRetentionStats.lowestRetentionTopic && subjectRetentionStats.lowestPct < 80 && (
                      <div className="bg-amber-50 border border-amber-200 p-3 flex items-center justify-between gap-3 text-left">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 text-amber-900 font-bold font-mono text-[8.5px] uppercase tracking-wide">
                            <Zap size={11} className="text-amber-600 animate-pulse" />
                            <span>Revisão Prioritária Ativa</span>
                          </div>
                          <h5 className="font-serif italic text-xs text-neutral-800 truncate mt-0.5">{subjectRetentionStats.lowestRetentionTopic.name}</h5>
                          <p className="text-[9px] text-neutral-500 leading-none mt-1">
                            A retenção calculada caiu para <span className="font-mono font-bold text-rose-600">{subjectRetentionStats.lowestPct}%</span>.
                          </p>
                        </div>
                        <button
                          onClick={() => quickReview(subjectRetentionStats!.lowestRetentionTopic!)}
                          className="shrink-0 bg-amber-800 text-white font-mono text-[9px] font-bold px-3 py-1.5 border border-amber-950 uppercase hover:bg-amber-900 active:translate-y-px cursor-pointer"
                        >
                          Revisar Agora
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Topics List */}
            <div className="space-y-4">
              {subjectTopics.length === 0 ? (
                <div className="bg-white border border-[#141414] p-8 text-center shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                  <p className="font-serif italic text-lg text-neutral-700">Nenhum tópico registrado para esta matéria ainda.</p>
                  <p className="font-mono text-xs text-neutral-500 mt-1 uppercase">Adicione um novo assunto acima para iniciar o ciclo de revisões.</p>
                </div>
              ) : (
                subjectTopics.map((topic, tIdx) => (
                <div key={`top-item-${topic.id}-${tIdx}`} id={`topic-${topic.id}`} className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                    <div>
                      <div className="flex items-center flex-wrap gap-2.5">
                        <div 
                          className="w-3.5 h-3.5 rounded-[3px] shrink-0 border border-[#141414]/30 shadow-[1px_1px_0px_0px_rgba(20,20,20,0.8)]" 
                          style={{ backgroundColor: getSubjectColor(selectedSubject) }} 
                          title={`Tópico de ${selectedSubject.name}`}
                        />
                        <h4 className="font-serif italic text-lg sm:text-xl">{topic.name}</h4>
                        {topic.noMoreReviews && (
                          <span className="px-1.5 py-0.5 border text-[7.5px] font-mono font-bold uppercase tracking-tight bg-blue-50 border-blue-200 text-blue-700" title="Revisões de repetição desativadas para preservação de foco">
                            Congelado (Sem Revisões)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono opacity-50">
                          <History size={12} />
                          <span>REVISÕES: {topic.repetitions || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono opacity-50">
                          <CalendarIcon size={12} />
                          <span>PRÓXIMA: {topic.nextReviewDate ? format(parseISO(topic.nextReviewDate), 'dd/MM/yyyy') : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => {
                            setEditingTopic(topic);
                            setEditTopicName(topic.name);
                            setEditTopicNoMoreReviews(topic.noMoreReviews || false);
                            setEditTopicSubjectId(topic.subjectId);
                          }}
                          className="p-2 border border-[#141414] hover:bg-[#141414]/5 transition-all"
                          title="Editar Tópico"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => deleteTopic(topic.id)}
                          className="p-2 border border-[#141414] hover:bg-red-500 hover:text-white transition-all"
                          title="Excluir Tópico"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button 
                          onClick={() => setShowHistory(topic)}
                          className="p-2 border border-[#141414] hover:bg-[#141414]/5 transition-all"
                          title="Ver Histórico"
                        >
                          <History size={14} />
                        </button>
                        <button 
                          onClick={() => setShowSessionForm(topic)}
                          className="flex-1 sm:flex-none border border-[#141414] text-[#141414] px-3 sm:px-4 py-2 font-mono text-[9px] sm:text-[10px] uppercase hover:bg-[#141414]/5"
                        >
                          ESTUDAR
                        </button>
                        <button 
                          onClick={() => quickReview(topic)}
                          className="flex-1 sm:flex-none bg-[#141414] text-[#E4E3E0] px-3 sm:px-4 py-2 font-mono text-[9px] sm:text-[10px] uppercase hover:bg-[#141414]/90"
                        >
                          REVISAR
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewInInternato(topic);
                          }}
                          className="flex-1 sm:flex-none bg-[#1A1A1A] text-white px-3.5 sm:px-5 py-2.5 font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hover:bg-black flex items-center justify-center gap-1.5 cursor-pointer border border-[#141414]"
                          title="Ver este assunto no MedInternato"
                        >
                          <Sparkles size={12} className="text-amber-400 fill-amber-400 animate-pulse" />
                          ver no medinternato
                        </button>
                      </div>
                  </div>

                  {/* Visual Forgetting Curve SVG */}
                  {(() => {
                    const { retentionPct, daysSince, status, statusColor, ringColor, interval } = calculateRetention(topic);
                    return (
                      <div className="mb-6 bg-neutral-50 border border-neutral-200 p-4 flex flex-col sm:flex-row items-center gap-4">
                        {/* Progress circle */}
                        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="28"
                              cy="28"
                              r="23"
                              className="stroke-neutral-200 fill-none"
                              strokeWidth="3.5"
                            />
                            <circle
                              cx="28"
                              cy="28"
                              r="23"
                              className={`fill-none transition-all duration-500 ${ringColor}`}
                              strokeWidth="3.5"
                              strokeDasharray={2 * Math.PI * 23}
                              strokeDashoffset={2 * Math.PI * 23 * (1 - retentionPct / 100)}
                            />
                          </svg>
                          <span className="absolute font-mono text-[10px] font-bold">{retentionPct}%</span>
                        </div>
                        
                        {/* Detailed text */}
                        <div className="flex-1 space-y-1 text-center sm:text-left min-w-0 w-full">
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                            <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-neutral-400">
                              Retenção Estimada
                            </span>
                            <span className={`px-1.5 py-0.5 border text-[7.5px] font-mono font-bold uppercase tracking-tight ${statusColor}`}>
                              {status}
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-neutral-600 leading-normal">
                            {topic.repetitions && topic.repetitions > 0 && topic.lastReviewDate
                              ? `Tema recordado de forma ativa há ${daysSince === 0 ? "menos de um" : daysSince} dia${daysSince !== 1 ? "s" : ""}.` 
                              : `Aguardando o primeiro registro de estudo para iniciar o cálculo da curva de Ebbinghaus.`}
                          </p>

                          {/* Inline interactive mini-curve SVG */}
                          {topic.repetitions && topic.repetitions > 0 && topic.lastReviewDate ? (
                            <div className="h-6 w-full mt-2 relative overflow-hidden bg-white border border-neutral-200 px-1 flex items-center">
                              <svg className="w-full h-full opacity-60 absolute inset-0">
                                <path
                                  d={(() => {
                                    let points = [];
                                    const steps = 15;
                                    for (let i = 0; i <= steps; i++) {
                                      const x = (i / steps) * 100;
                                      const tSim = (i / steps) * (interval * 2);
                                      const ySim = Math.pow(0.9, tSim / interval);
                                      const yPos = 24 - (ySim * 18 + 1);
                                      points.push(`${x},${yPos}`);
                                    }
                                    return `M ${points.join(' L ')}`;
                                  })()}
                                  fill="none"
                                  stroke="#141414"
                                  strokeWidth="1"
                                  strokeDasharray="2 1.5"
                                />
                                {(() => {
                                  const xPos = Math.min(95, Math.max(5, (daysSince / (interval * 2)) * 100));
                                  const ySim = Math.pow(0.9, daysSince / interval);
                                  const yPos = 24 - (ySim * 18 + 1);
                                  return (
                                    <circle
                                      cx={xPos}
                                      cy={yPos}
                                      r="3"
                                      className={retentionPct >= 80 ? "fill-emerald-500" : retentionPct >= 60 ? "fill-blue-500" : retentionPct >= 40 ? "fill-amber-500" : "fill-rose-500"}
                                      stroke="#141414"
                                      strokeWidth="1"
                                    />
                                  );
                                })()}
                              </svg>
                              <div className="absolute right-2 font-mono text-[7px] text-[#141414]/30 uppercase tracking-widest pointer-events-none">Meia-vida de retenção</div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Topic History Mini Dashboard */}
                  <div className="grid grid-cols-4 gap-4 border-t border-[#141414]/10 pt-4">
                    <TopicStat 
                      label="ACERTOS" 
                      value={(sessions || []).filter(s => s.topicId === topic.id).reduce((acc, s) => acc + (s.correctCount || 0), 0)} 
                      icon={<CheckCircle size={12} />}
                    />
                    <TopicStat 
                      label="QUESTÕES" 
                      value={(sessions || []).filter(s => s.topicId === topic.id).reduce((acc, s) => acc + (s.questionsCount || 0), 0)} 
                      icon={<BarChart2 size={12} />}
                    />
                    <TopicStat 
                      label="TEMPO" 
                      value={`${(sessions || []).filter(s => s.topicId === topic.id).reduce((acc, s) => acc + (s.studyTimeMinutes || 0), 0)}m`} 
                      icon={<Clock size={12} />}
                    />
                    <TopicStat 
                      label="PRECISÃO" 
                      value={`${(() => {
                        const topicSessions = (sessions || []).filter(s => s.topicId === topic.id);
                        const totalQuestions = topicSessions.reduce((acc, s) => acc + (s.questionsCount || 0), 0);
                        const totalCorrect = topicSessions.reduce((acc, s) => acc + (s.correctCount || 0), 0);
                        return totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(0) : 0;
                      })()}%`} 
                      icon={<Target size={12} />}
                    />
                  </div>
                </div>
              )))}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center border border-dashed border-[#141414]/20 p-20 text-center">
            <BookOpen size={48} className="opacity-10 mb-4" />
            <p className="font-serif italic text-xl opacity-40">Selecione uma matéria para ver os tópicos</p>
          </div>
        )}
      </div>

      {/* Session Entry Modal */}
      {(showSessionForm || editingSession) && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="font-serif italic text-2xl mb-2">
              {editingSession ? 'Editar Estudo' : 'Registrar Estudo'}
            </h3>
            <p className="text-[10px] font-mono opacity-50 uppercase mb-6">
              {showSessionForm?.name || topics.find(t => t.id === editingSession?.topicId)?.name}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase mb-1">Data do Estudo</label>
                <input 
                  type="datetime-local" 
                  value={sessionData.date}
                  onChange={(e) => setSessionData({...sessionData, date: e.target.value})}
                  className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase mb-1">Questões</label>
                  <input 
                    type="text" 
                    placeholder="0"
                    value={sessionData.questions}
                    onChange={(e) => setSessionData({...sessionData, questions: e.target.value})}
                    className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase mb-1">Acertos</label>
                  <input 
                    type="text" 
                    placeholder="0"
                    value={sessionData.correct}
                    onChange={(e) => setSessionData({...sessionData, correct: e.target.value})}
                    className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic SRS Quality calibration preview */}
              {(() => {
                const parsedQ = parseInt(sessionData.questions) || 0;
                const parsedC = parseInt(sessionData.correct) || 0;
                if (parsedQ <= 0) return null;
                const pct = Math.min(100, Math.max(0, Math.round((parsedC / parsedQ) * 100)));
                const qual = parsedC >= parsedQ ? 5 :
                             parsedC >= Math.ceil(parsedQ * 0.85) ? 4 :
                             parsedC >= Math.ceil(parsedQ * 0.70) ? 3 :
                             parsedC >= Math.ceil(parsedQ * 0.50) ? 2 :
                             parsedC >= Math.ceil(parsedQ * 0.30) ? 1 : 0;
                return (
                  <div className="p-3 bg-indigo-50 border border-indigo-250 space-y-1">
                    <div className="flex items-center gap-1 text-indigo-900 font-bold font-mono text-[9px] uppercase tracking-wide">
                      <Sparkles size={11} className="text-indigo-650 animate-pulse" />
                      <span>Calibração Cognitiva SM-2</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-600 font-sans">
                        Precisão de <strong className="font-mono">{pct}%</strong>
                      </span>
                      <span className="font-mono text-[9px] bg-indigo-900 text-white px-1.5 py-0.5 border border-indigo-950 font-bold uppercase">
                        Grau SRS: {qual}/5
                      </span>
                    </div>
                    <p className="text-[8.5px] leading-tight text-neutral-500">
                      {qual >= 4 ? "Excelente retenção! O intervalo Spaced Repetition para este tópico foi renovado e ampliado para fixação de longo prazo." :
                       qual === 3 ? "Lembrete sólido com esforço saudável. O intervalo foi mantido ou calibrado ligeiramente." :
                       "Taxa de erro sensível. O intervalo será reiniciado em 1 dia para evitar a solidificação de erros (Efeito de perseverança)."}
                    </p>
                  </div>
                );
              })()}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-mono uppercase font-bold">Tempo (minutos)</label>
                  <span className="text-[10px] font-mono text-indigo-600 font-bold">
                    {(parseInt(sessionData.time) || 0) >= 60 
                      ? `${Math.floor((parseInt(sessionData.time) || 0) / 60)}h ${(parseInt(sessionData.time) || 0) % 60}min`
                      : `${parseInt(sessionData.time) || 0} min`
                    }
                  </span>
                </div>
                
                <div className="flex items-center gap-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setSessionData({...sessionData, time: Math.max(0, (parseInt(sessionData.time) || 0) - 15).toString()})}
                    className="px-2 py-1.5 text-xs font-mono border border-[#141414] hover:bg-stone-100 cursor-pointer"
                  >
                    -15m
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionData({...sessionData, time: Math.max(0, (parseInt(sessionData.time) || 0) - 5).toString()})}
                    className="px-2 py-1.5 text-xs font-mono border border-[#141414] hover:bg-stone-100 cursor-pointer"
                  >
                    -5m
                  </button>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={sessionData.time}
                    onChange={(e) => setSessionData({...sessionData, time: e.target.value})}
                    className="w-full p-2 border border-[#141414] font-mono text-sm text-center focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSessionData({...sessionData, time: ((parseInt(sessionData.time) || 0) + 5).toString()})}
                    className="px-2 py-1.5 text-xs font-mono border border-[#141414] hover:bg-stone-100 cursor-pointer"
                  >
                    +5m
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionData({...sessionData, time: ((parseInt(sessionData.time) || 0) + 15).toString()})}
                    className="px-2 py-1.5 text-xs font-mono border border-[#141414] hover:bg-stone-100 cursor-pointer"
                  >
                    +15m
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSessionData({...sessionData, time: m.toString()})}
                      className={`px-2 py-1 text-[10px] font-mono border border-[#141414] cursor-pointer ${
                        parseInt(sessionData.time) === m ? 'bg-[#141414] text-white font-bold' : 'hover:bg-[#141414]/10'
                      }`}
                    >
                      {m >= 60 ? `${m / 60}h` : `${m}m`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase mb-1">Descrição / Notas</label>
                <textarea 
                  value={sessionData.description}
                  onChange={(e) => setSessionData({...sessionData, description: e.target.value})}
                  placeholder="O que você aprendeu hoje?"
                  className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none h-20"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => { setShowSessionForm(null); setEditingSession(null); }}
                className="flex-1 border border-[#141414] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/5"
              >
                CANCELAR
              </button>
              <button 
                onClick={submitSession}
                className="flex-1 bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/90"
              >
                {editingSession ? 'ATUALIZAR' : 'SALVAR SESSÃO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Topic Modal */}
      {editingTopic && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="font-serif italic text-2xl mb-6">Editar Tópico</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase mb-1">Nome do Tópico</label>
                <input 
                  type="text" 
                  value={editTopicName}
                  onChange={(e) => setEditTopicName(e.target.value)}
                  className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                  placeholder="Ex: Introdução ao Direito"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase mb-1">Matéria (Mover para outra)</label>
                <select
                  value={editTopicSubjectId}
                  onChange={(e) => setEditTopicSubjectId(e.target.value)}
                  className="w-full p-2 border border-[#141414] font-mono text-xs bg-white focus:outline-none font-bold uppercase"
                >
                  {subjects.map((sub, sIdx) => (
                    <option key={`edit-topic-sub-${sub.id}-${sIdx}`} value={sub.id}>
                      {sub.name} {sub.semesterId ? `(${getSemesterLabel(sub.semesterId, semesters, sub.name)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-2 border-t border-dashed border-gray-100 mt-2">
                <input 
                  type="checkbox" 
                  id="noMoreReviewsCheckbox"
                  checked={editTopicNoMoreReviews}
                  onChange={(e) => setEditTopicNoMoreReviews(e.target.checked)}
                  className="w-4 h-4 accent-[#141414] cursor-pointer"
                />
                <label htmlFor="noMoreReviewsCheckbox" className="text-[10px] font-mono uppercase cursor-pointer select-none leading-none">
                  Desativar revisões futuras (congelar)
                </label>
              </div>
              <p className="text-[8.5px] text-gray-500 leading-normal pl-6">
                Todas as estatísticas do tópico (tempo estudado, número de acertos, etc.) serão totalmente preservadas nos gráficos e relatórios históricos.
              </p>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => { setEditingTopic(null); setEditTopicName(''); }}
                className="flex-1 border border-[#141414] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/5"
              >
                CANCELAR
              </button>
              <button 
                onClick={updateTopic}
                className="flex-1 bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/90"
              >
                SALVAR ALTERAÇÕES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="font-serif italic text-2xl mb-6">Editar Matéria</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase mb-1">Nome da Matéria</label>
                <input 
                  type="text" 
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none"
                  placeholder="Ex: Cardiologia"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase mb-1">Semestre / Ciclo</label>
                {semesters.length === 0 ? (
                  <div className="text-[10px] font-mono p-2 border border-dashed border-[#141414]/20 text-amber-600 bg-amber-50">
                    Nenhum semestre cadastrado. Crie um semestre primeiro.
                  </div>
                ) : (
                  <select
                    value={editSubjectSemesterId}
                    onChange={(e) => setEditSubjectSemesterId(e.target.value)}
                    className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none bg-white"
                  >
                    <option value="">Selecione um semestre...</option>
                    {semesters.map((s, sIdx) => (
                      <option key={`sem-edit-opt-${s.id}-${sIdx}`} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => { setEditingSubject(null); setEditSubjectName(''); setEditSubjectSemesterId(''); }}
                className="flex-1 border border-[#141414] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/5"
              >
                CANCELAR
              </button>
              <button 
                onClick={updateSubject}
                className="flex-1 bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[10px] uppercase hover:bg-[#141414]/90"
              >
                SALVAR ALTERAÇÕES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Semesters Modal */}
      {isManageSemestersOpen && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#141414] p-8 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-[#141414]/10 pb-4">
              <h3 className="font-serif italic text-2xl">Gerenciar Semestres</h3>
              <button 
                onClick={() => { setIsManageSemestersOpen(false); setEditingSemester(null); setConfirmDeleteSemesterId(null); }}
                className="p-1.5 border border-[#141414] hover:bg-[#141414]/5 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Editing inline Form */}
            {editingSemester ? (
              <div className="p-4 bg-stone-50 border border-[#141414] mb-6 space-y-3">
                <h4 className="font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-500">Editar Semestre</h4>
                <div className="grid grid-cols-3 gap-2">
                  <input 
                    type="number"
                    placeholder="Nº"
                    value={editSemesterNumber}
                    onChange={e => setEditSemesterNumber(e.target.value)}
                    className="col-span-1 p-2 font-mono text-xs border border-[#141414] focus:outline-none bg-white"
                    required
                  />
                  <input 
                    type="text"
                    placeholder="Ex: 9º Semestre"
                    value={editSemesterName}
                    onChange={e => setEditSemesterName(e.target.value)}
                    className="col-span-2 p-2 font-mono text-xs border border-[#141414] focus:outline-none bg-white"
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => { setEditingSemester(null); }} 
                    className="px-3 py-1.5 font-mono text-[9px] uppercase border border-[#141414] hover:bg-stone-100 bg-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    onClick={updateSemester}
                    className="px-3 py-1.5 bg-[#141414] text-[#E4E3E0] font-mono text-[9px] uppercase hover:bg-neutral-800 cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center mb-4 p-3 bg-stone-100 rounded-md">
                <span className="text-[10px] font-mono text-stone-500 uppercase">Dica: Crie semestres usando o botão + SEMESTRE na barra lateral.</span>
              </div>
            )}

            {/* List of Semesters */}
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {semesters.map((s, idx) => {
                const subCount = subjects.filter(sub => String(sub.semesterId) === String(s.id)).length;
                const isConfirming = confirmDeleteSemesterId === s.id;

                return (
                  <div key={`manage-sem-${s.id}-${idx}`} className="flex flex-col p-3 border border-[#141414] bg-white hover:bg-stone-50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-serif italic text-base font-bold">{s.name}</span>
                        <span className="font-mono text-[9px] uppercase text-stone-400">Nº {s.number} • {subCount} matérias vinculadas</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingSemester(s);
                            setEditSemesterName(s.name);
                            setEditSemesterNumber(String(s.number));
                            setConfirmDeleteSemesterId(null);
                          }}
                          className="p-1.5 border border-[#141414] hover:bg-stone-100 text-stone-700 cursor-pointer"
                          title="Editar Semestre"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteSemesterId(s.id)}
                          className="p-1.5 border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Excluir Semestre"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {isConfirming && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 text-xs">
                        <p className="font-bold text-red-800">Deseja realmente excluir o semestre "{s.name}"?</p>
                        <p className="text-red-700 mt-0.5">As matérias vinculadas a este semestre ficarão sem semestre (não serão deletadas).</p>
                        <div className="flex gap-2 mt-2 justify-end">
                          <button
                            onClick={() => setConfirmDeleteSemesterId(null)}
                            className="px-2 py-1 bg-white border border-stone-300 text-[10px] font-mono uppercase font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                          >
                            Não
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'users', user.uid, 'semesters', s.id));
                                if (semesterFilter === s.id) {
                                  setSemesterFilter('all');
                                }
                                setConfirmDeleteSemesterId(null);
                              } catch (e) {
                                console.error('Error deleting semester:', e);
                              }
                            }}
                            className="px-2 py-1 bg-red-650 text-white border border-red-800 text-[10px] font-mono uppercase font-bold hover:bg-red-700 cursor-pointer"
                          >
                            Sim, Deletar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {semesters.length === 0 && (
                <div className="text-center py-6 text-stone-400 font-mono text-xs border border-dashed border-stone-300">
                  Nenhum semestre cadastrado ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#141414] p-8 max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-serif italic text-2xl">Histórico de Estudos</h3>
                <p className="text-[10px] font-mono opacity-50 uppercase">{showHistory.name}</p>
              </div>
              <button 
                onClick={() => setShowHistory(null)}
                className="p-2 hover:bg-[#141414]/5"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {sessions.filter(s => s.topicId === showHistory.id).sort((a, b) => b.date.localeCompare(a.date)).map((session, sIdx) => (
                <div key={`session-item-${session.id || sIdx}-${sIdx}`} className="p-4 border border-[#141414] flex items-center justify-between group">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold">{format(parseISO(session.date), 'dd/MM/yyyy HH:mm')}</span>
                      <span className="text-[10px] font-mono opacity-40">|</span>
                      <span className="text-[10px] font-mono uppercase">{session.questionsCount}Q / {session.correctCount}A</span>
                    </div>
                    {session.description && (
                      <p className="text-xs font-serif italic opacity-60">{session.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingSession(session);
                        setSessionData({
                          questions: session.questionsCount.toString(),
                          correct: session.correctCount.toString(),
                          time: session.studyTimeMinutes.toString(),
                          date: session.date.substring(0, 16),
                          description: session.description || ''
                        });
                        setShowHistory(null);
                      }}
                      className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] border border-[#141414] transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm('Excluir esta sessão?')) {
                          await deleteDoc(doc(db, 'users', user.uid, 'studySessions', session.id));
                        }
                      }}
                      className="p-2 hover:bg-red-500 hover:text-white border border-[#141414] transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {sessions.filter(s => s.topicId === showHistory.id).length === 0 && (
                <p className="text-center font-mono text-[10px] opacity-30 py-10 uppercase">Nenhuma sessão registrada</p>
              )}
            </div>
          </div>
        </div>
      )}
      {reviewingTopic && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#141414] p-8 max-w-xl w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-dashed border-[#141414]/15">
              <div className="flex items-center gap-2 text-indigo-700">
                <Sparkles size={20} className="animate-pulse" />
                <h3 className="font-serif italic text-2xl">Calibração e Registro de Revisão (SM-2)</h3>
              </div>
              <button 
                onClick={() => setReviewingTopic(null)}
                className="p-1 hover:bg-neutral-100 border border-neutral-300 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4 text-xs">
              <span className="font-mono text-[10px] opacity-50 uppercase tracking-widest block mb-1">Tópico sob revisão:</span>
              <span className="font-serif italic text-lg text-neutral-900">{reviewingTopic.name}</span>
            </div>

            <div className="mb-4 bg-indigo-50/50 p-4 border border-indigo-250">
              <h4 className="font-mono text-[10px] font-bold text-indigo-800 uppercase tracking-wider mb-1">Escolha seu método de validação da revisão:</h4>
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                Estudos comprovam que calibrar seu esforço mental de retenção é o pilar mais forte do Spaced Repetition. Você pode validar seu nível usando sua autopercepção metacognitiva ou registrando o resultado de questões práticas.
              </p>
            </div>

            {/* Method selection tabs */}
            <div className="flex border-2 border-[#141414] mb-5">
              <button
                type="button"
                onClick={() => setReviewMethod('perception')}
                className={cn(
                  "flex-1 py-2.5 font-mono text-[10px] uppercase font-bold text-center cursor-pointer transition-all border-r-2 border-[#141414]",
                  reviewMethod === 'perception'
                    ? "bg-[#141414] text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                )}
              >
                🧠 Autopercepção (0 a 5)
              </button>
              <button
                type="button"
                onClick={() => setReviewMethod('questions')}
                className={cn(
                  "flex-1 py-2.5 font-mono text-[10px] uppercase font-bold text-center cursor-pointer transition-all",
                  reviewMethod === 'questions'
                    ? "bg-[#141414] text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                )}
              >
                📝 Resolver Questões
              </button>
            </div>

            <div className="space-y-4">
              {reviewMethod === 'perception' ? (
                <div>
                  <label className="block text-[10px] font-mono uppercase mb-2 text-neutral-700 font-bold tracking-wider">Como foi o esforço de lembrança?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { value: 0, label: "0 • Apagão", desc: "Não lembrei nada" },
                      { value: 1, label: "1 • Vago", desc: "Lembrei só ao ler notas" },
                      { value: 2, label: "2 • Superficial", desc: "Pequena familiaridade" },
                      { value: 3, label: "3 • Com Esforço", desc: "Lembrei após pensar" },
                      { value: 4, label: "4 • Sólido", desc: "Lembrei com leve atraso" },
                      { value: 5, label: "5 • Instantâneo", desc: "Totalmente perfeito!" }
                    ].map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => setReviewQuality(lvl.value)}
                        className={cn(
                          "p-3 border text-left flex flex-col justify-between transition-all cursor-pointer h-20",
                          reviewQuality === lvl.value 
                            ? "bg-indigo-900 text-white border-indigo-950 shadow-[3px_3px_0px_0px_rgba(20,20,20,1)]" 
                            : "bg-white text-neutral-700 border-[#141414] hover:bg-neutral-50"
                        )}
                      >
                        <span className="font-mono text-[10px] font-bold leading-tight">{lvl.label}</span>
                        <span className={cn(
                          "text-[9px] leading-tight opacity-80 mt-1",
                          reviewQuality === lvl.value ? "text-indigo-100" : "text-neutral-500"
                        )}>{lvl.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-amber-50/50 border border-amber-250">
                  <h4 className="font-mono text-[10px] font-bold text-amber-900 uppercase tracking-wider">Registrar Desempenho em Questões de Revisão:</h4>
                  <p className="text-[10px] text-amber-850 leading-relaxed font-sans">
                    Informe quantas questões você resolveu sobre este tópico de revisão hoje e o seu total de acertos. Nós calcularemos proporcionalmente a sua fidelidade de retenção na curva de Ebbinghaus!
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase mb-1 text-neutral-700 font-bold">Total de Questões</label>
                      <input 
                        type="text" 
                        value={reviewQuestionsCount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setReviewQuestionsCount('');
                          } else {
                            const parsed = parseInt(val);
                            setReviewQuestionsCount(isNaN(parsed) || parsed < 0 ? '' : parsed);
                          }
                        }}
                        placeholder="Ex: 10"
                        className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none focus:bg-white bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase mb-1 text-neutral-700 font-bold">Número de Acertos</label>
                      <input 
                        type="text" 
                        value={reviewCorrectCount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setReviewCorrectCount('');
                          } else {
                            const parsed = parseInt(val);
                            setReviewCorrectCount(isNaN(parsed) || parsed < 0 ? '' : parsed);
                          }
                        }}
                        placeholder="Ex: 8"
                        className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none focus:bg-white bg-white"
                      />
                    </div>
                  </div>
                  {Number(reviewQuestionsCount) > 0 && (
                    <div className="text-[10px] font-mono text-neutral-600 bg-white border border-dashed border-[#141414]/20 p-2.5 mt-2">
                      <div className="flex justify-between">
                        <span>Aproveitamento:</span>
                        <strong className="text-[#141414]">{Math.round((Number(reviewCorrectCount || 0) / Number(reviewQuestionsCount)) * 100)}%</strong>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Calibração Estimada:</span>
                        {(() => {
                          const q = accuracyToQuality(Number(reviewCorrectCount || 0), Number(reviewQuestionsCount));
                          const labels = ["0 • Apagão", "1 • Vago", "2 • Superficial", "3 • Com Esforço", "4 • Sólido", "5 • Instantâneo"];
                          return <strong className="text-indigo-800 uppercase font-bold text-[9px]">{labels[q]}</strong>;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase mb-1 text-neutral-700 font-bold">Data da Revisão</label>
                  <input 
                    type="datetime-local" 
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none focus:bg-white bg-neutral-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase mb-1 text-neutral-700 font-bold">Tempo Despendido (minutos)</label>
                  <input 
                    type="text" 
                    value={reviewTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setReviewTime('');
                      } else {
                        const parsed = parseInt(val);
                        setReviewTime(isNaN(parsed) ? '' : parsed);
                      }
                    }}
                    className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none focus:bg-white bg-neutral-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase mb-1 text-neutral-700 font-bold">Comentários (Opcional)</label>
                  <input 
                    type="text" 
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Ex: Foco na dedução lógica"
                    className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none focus:bg-white bg-neutral-50"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-4 border-t border-neutral-200">
              <button 
                onClick={() => setReviewingTopic(null)}
                className="flex-1 border border-[#141414] py-3 font-mono text-[10px] uppercase hover:bg-neutral-50 cursor-pointer"
              >
                CANCELAR
              </button>
              <button 
                onClick={submitReview}
                disabled={isReviewSubmitDisabled}
                className={cn(
                  "flex-1 text-white py-3 font-mono text-[10px] uppercase transition-all",
                  isReviewSubmitDisabled 
                    ? "bg-neutral-300 border-neutral-300 cursor-not-allowed opacity-50" 
                    : "bg-indigo-700 hover:bg-indigo-800 cursor-pointer"
                )}
              >
                GRAVAR E CALIBRAR SRS
              </button>
            </div>
          </div>
        </div>
      )}

      <SubjectLinkerModal
        isOpen={isLinkerModalOpen}
        onClose={() => setIsLinkerModalOpen(false)}
        reviseSubjects={subjects}
        internatoSubjects={subjects}
        onSwitchMode={onSwitchMode}
      />

      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
        reason={upgradeReason} 
      />
    </div>
  </div>
  );
}

function TopicStat({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 opacity-40 mb-1">
        {icon}
        <span className="text-[7px] sm:text-[8px] font-mono uppercase">{label}</span>
      </div>
      <span className="text-[10px] sm:text-xs font-mono font-bold">{value}</span>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

function CalendarIcon({ size }: { size: number }) {
  return <CalendarIconLucide size={size} />;
}
import { Calendar as CalendarIconLucide } from 'lucide-react';
import { Target } from 'lucide-react';
