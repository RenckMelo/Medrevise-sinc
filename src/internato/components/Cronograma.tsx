import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCw, 
  Award, 
  BookOpen, 
  BarChart3, 
  ChevronRight, 
  ChevronLeft, 
  Lightbulb, 
  Settings, 
  Check, 
  AlertCircle,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeftRight,
  FileText,
  UploadCloud,
  Brain,
  PieChart,
  Loader2,
  Download,
  Zap,
  Layers,
  RefreshCw,
  Link as LinkIcon,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, collection, doc, addDoc, updateDoc, getDocs, getDoc, where, query, limit, deleteDoc, writeBatch, onSnapshot } from '../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { accuracyToQuality, calculateNextReview } from '../../utils/srs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { recordUsage, importPdfSchedule, analyzeSummaryNeeds } from '../services/geminiService';
import { extractTextFromPdf } from '../utils/pdfExtractor';
import { safeLocalStorageSet } from '../utils/storageUtils';
import { MEDICAL_EXAMS_DB, GLOBAL_RESIDENCY_TOPICS, CANONICAL_SUBTOPICS_MAP } from '../data/medicalExams';
import { generatePlan, generateCollegeCustomPlan, extendScheduleWithScientificRevisions, StudyPlanTopic, StudyPlanWeek, calculateCoverage } from '../utils/scheduleGenerator';
import SchedulePlannerWizard from './SchedulePlannerWizard';

const MEDICAL_ABBREVIATIONS: { [key: string]: string[] } = {
  "has": ["hipertensao arterial sistemica", "hipertensao"],
  "icc": ["insuficiencia cardiaca congestiva", "insuficiencia cardiaca"],
  "ic": ["insuficiencia cardiaca"],
  "dm": ["diabetes mellitus", "diabetes"],
  "dm1": ["diabetes mellitus tipo 1", "diabetes tipo 1"],
  "dm2": ["diabetes mellitus tipo 2", "diabetes tipo 2"],
  "iam": ["infarto agudo do miocardio", "infarto"],
  "dpoc": ["doenca pulmonar obstrutiva cronica"],
  "tev": ["tromboembolismo venoso"],
  "tep": ["tromboembolismo pulmonar", "tromboembolia pulmonar"],
  "avc": ["acidente vascular cerebral", "acidente vascular encefalico", "ave"],
  "avci": ["acidente vascular cerebral isquemico", "acidente vascular encefalico isquemico", "avei"],
  "avch": ["acidente vascular cerebral hemorragico", "acidente vascular encefalico hemorragico", "aveh"],
  "ave": ["acidente vascular encefalico", "acidente vascular cerebral", "avc"],
  "go": ["ginecologia e obstetricia", "ginecologia", "obstetricia"],
  "g&o": ["ginecologia e obstetricia", "ginecologia", "obstetricia"],
  "ivas": ["infeccao de vias aereas superiores", "infeccoes de vias aereas superiores", "resfriado"],
  "ira": ["insuficiencia renal aguda", "injuria renal aguda"],
  "irc": ["insuficiencia renal cronica"],
  "drc": ["doenca renal cronica"],
  "dheg": [
    "doenca hipertensiva especifica da gravidez", 
    "doenca hipertensiva especifica da gestacao", 
    "sindromes hipertensivas da gestacao", 
    "sindrome hipertensiva da gestacao", 
    "sindrome hipertensiva na gestacao",
    "sindromes hipertensivas na gravidez",
    "hipertensao na gravidez",
    "hipertensao gestacional"
  ],
  "sindromes hipertensivas da gestacao": [
    "dheg",
    "doenca hipertensiva especifica da gestacao",
    "hipertensao gestacional"
  ],
  "sindromes hipertensivas na gestacao": [
    "dheg",
    "doenca hipertensiva especifica da gestacao",
    "hipertensao gestacional"
  ],
  "dst": ["doenca sexualmente transmissivel", "infeccao sexualmente transmissivel", "ist"],
  "ist": ["infeccao sexualmente transmissivel", "doenca sexualmente transmissivel", "dst"],
  "itu": ["infeccao do trato urinario", "infeccao urinaria"],
  "pcr": ["parada cardiorrespiratoria"],
  "rcp": ["reanimacao cardiopulmonar"],
  "dac": ["doenca arterial coronariana"],
  "daop": ["doenca arterial obstrutiva periferica"],
  "geca": ["gastroenterocolite aguda", "gastroenterite aguda", "gea"],
  "gea": ["gastroenterite aguda", "gastroenterocolite aguda", "geca"],
  "fa": ["fibrilacao atrial"],
  "tvp": ["trombose venosa profunda"],
  "drge": ["doenca do refluxo gastroesofagico", "refluxo gastroesofagico"],
  "les": ["lupus eritematoso sistemico", "lupus"],
  "ar": ["artrite reumatoide"],
  "tb": ["tuberculose"],
  "sdra": ["sindrome do desconforto respiratorio agudo", "sindrome da angustia respiratoria aguda", "sara"],
  "sara": ["sindrome da angustia respiratoria aguda", "sindrome do desconforto respiratorio agudo", "sdra"],
  "tpp": ["trabalho de parto prematuro"],
  "rpmo": ["ruptura prematura de membranas ovulares", "amniorrexe prematura"],
  "civd": ["coagulacao intravascular disseminada"],
  "hda": ["hemorragia digestiva alta"],
  "hdb": ["hemorragia digestiva baixa"],
  "anestesio": ["anestesiologia"],
  "anestesiologia": ["anestesio"],
  "obstet": ["obstetricia"],
  "ginec": ["ginecologia"]
};

const expandPhrase = (cleanText: string): string[] => {
  if (!cleanText) return [];
  const words = cleanText.split(" ");
  let combinations = [words];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (MEDICAL_ABBREVIATIONS[w]) {
      const expansions = MEDICAL_ABBREVIATIONS[w];
      const nextCombos: string[][] = [];
      for (const combo of combinations) {
        nextCombos.push(combo);
        for (const exp of expansions) {
          const newCombo = [...combo];
          newCombo[i] = exp;
          nextCombos.push(newCombo);
        }
      }
      combinations = nextCombos.slice(0, 8);
    }
  }

  const resultSet = new Set<string>();
  combinations.forEach(c => resultSet.add(c.join(" ").replace(/\s+/g, " ").trim()));
  return Array.from(resultSet);
};

interface CronogramaProps {
  user: any;
  subjects: any[];
  topics: any[];
  setView: (view: any) => void;
  setSelectedTopic: (topic: any) => void;
  setSelectedSubject: (subject: any) => void;
  setCronogramaFilterTopics: (topics: string[]) => void;
  setCronogramaQuestionsCount: (count: number) => void;
  setCronogramaMode: (mode: 'study' | 'exam') => void;
  availableCredits: number;
  setAvailableCredits: React.Dispatch<React.SetStateAction<number>>;
  setSubjects?: React.Dispatch<React.SetStateAction<any[]>>;
  setTopics?: React.Dispatch<React.SetStateAction<any[]>>;
}

interface StudySchedule {
  id: string;
  exam: string;
  modality: '6meses' | '1ano' | '2anos' | 'extensivo' | 'intensivo' | 'dynamic' | 'pdf_imported' | 'college_custom';
  studyDays: string[];
  hoursPerDay: number;
  weeks: StudyPlanWeek[];
  createdAt: string;
  progress: number;
  coveragePercentage?: number;
  currentSemesterSubjects?: string[];
  examDate?: string | null;
  collegeExamDate?: string | null;
  collegeSelectedTopics?: string[];
  startDate?: string;
}

const calculateWeeksToDate = (dateStr: string): number => {
  if (!dateStr) return 24;
  const today = new Date();
  const exam = new Date(dateStr);
  const diffTime = exam.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(diffDays / 7);
  return weeks > 0 ? weeks : 24;
};

const getDayDisplayName = (day: string, full = false): string => {
  if (!day) return '';
  const d = day.trim().toLowerCase();
  if (d.startsWith('seg')) return full ? 'Segunda-feira' : 'Segunda';
  if (d.startsWith('ter')) return full ? 'Terça-feira' : 'Terça';
  if (d.startsWith('qua')) return full ? 'Quarta-feira' : 'Quarta';
  if (d.startsWith('qui')) return full ? 'Quinta-feira' : 'Quinta';
  if (d.startsWith('sex')) return full ? 'Sexta-feira' : 'Sexta';
  if (d.startsWith('sáb') || d.startsWith('sab')) return 'Sábado';
  if (d.startsWith('dom')) return 'Domingo';
  return day;
};

export const getDayIndexInOrder = (dayStr: string): number => {
  if (!dayStr) return -1;
  const s = dayStr.trim().toLowerCase();
  if (s.startsWith('seg')) return 0;
  if (s.startsWith('ter')) return 1;
  if (s.startsWith('qua')) return 2;
  if (s.startsWith('qui')) return 3;
  if (s.startsWith('sex')) return 4;
  if (s.startsWith('sáb') || s.startsWith('sab')) return 5;
  if (s.startsWith('dom')) return 6;
  return -1;
};

const getOrderedDaysForWeek = (studyDaysArray: string[], startDateStr?: string): string[] => {
  const MAP_DAY_INDEX_TO_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const standardOrder = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const daysArray = Array.isArray(studyDaysArray) ? studyDaysArray : [];

  const isDayInStudyDays = (abbr: string) => {
    return daysArray.some(userDay => {
      const uIdx = getDayIndexInOrder(userDay);
      const aIdx = getDayIndexInOrder(abbr);
      if (uIdx !== -1 && aIdx !== -1) return uIdx === aIdx;
      return userDay.trim().toLowerCase().includes(abbr.trim().toLowerCase());
    });
  };

  if (!startDateStr) {
    return standardOrder.filter(isDayInStudyDays);
  }
  const d = new Date(startDateStr + 'T00:00:00');
  if (isNaN(d.getTime())) {
    return standardOrder.filter(isDayInStudyDays);
  }
  const startAbbr = MAP_DAY_INDEX_TO_ABBR[d.getDay()];
  const startIdx = MAP_DAY_INDEX_TO_ABBR.indexOf(startAbbr);
  const rotated = [
    ...MAP_DAY_INDEX_TO_ABBR.slice(startIdx),
    ...MAP_DAY_INDEX_TO_ABBR.slice(0, startIdx)
  ];
  return rotated.filter(isDayInStudyDays);
};

export const getTodayWeekAndDay = (schedule: StudySchedule): { weekIndex: number; dayTab: string } => {
  if (!schedule || !schedule.weeks || schedule.weeks.length === 0) {
    return { weekIndex: 0, dayTab: 'Seg' };
  }

  const startDateStr = (schedule as any).startDate || schedule.createdAt;
  const now = new Date();
  const jsDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const todayStandardIdx = (jsDay + 6) % 7; // 0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex, 5=Sáb, 6=Dom

  if (startDateStr) {
    const startDate = new Date(startDateStr.includes('T') ? startDateStr : startDateStr + 'T00:00:00');
    if (!isNaN(startDate.getTime())) {
      const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startZero = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const diffMs = todayZero.getTime() - startZero.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays >= 0) {
        let calculatedWeek = Math.floor(diffDays / 7);
        if (calculatedWeek >= schedule.weeks.length) {
          calculatedWeek = schedule.weeks.length - 1;
        }

        const week = schedule.weeks[calculatedWeek];
        const orderedDays = getOrderedDaysForWeek(schedule.studyDays, startDateStr);

        // 1. First, check if today's day matches any day in orderedDays!
        const matchOrdered = orderedDays.find(d => getDayIndexInOrder(d) === todayStandardIdx);
        if (matchOrdered) {
          return { weekIndex: calculatedWeek, dayTab: matchOrdered };
        }

        // 2. Next, check if today's day matches any key in week.days!
        if (week && week.days) {
          const matchWeek = Object.keys(week.days).find(k => getDayIndexInOrder(k) === todayStandardIdx);
          if (matchWeek) {
            return { weekIndex: calculatedWeek, dayTab: matchWeek };
          }
        }

        // 3. Fallback: if today is a non-study day (e.g. weekend), pick the closest study day in orderedDays!
        if (orderedDays.length > 0) {
          let bestDay = orderedDays[0];
          let minDistance = 999;
          orderedDays.forEach(day => {
            const dayIdx = getDayIndexInOrder(day);
            if (dayIdx !== -1) {
              let dist = Math.abs(dayIdx - todayStandardIdx);
              if (dist > 3) dist = 7 - dist;
              if (dist < minDistance) {
                minDistance = dist;
                bestDay = day;
              }
            }
          });
          return { weekIndex: calculatedWeek, dayTab: bestDay };
        }
      }
    }
  }

  const orderedDays = getOrderedDaysForWeek(schedule.studyDays, startDateStr);
  const matchOrdered = orderedDays.find(d => getDayIndexInOrder(d) === todayStandardIdx);
  if (matchOrdered) {
    return { weekIndex: 0, dayTab: matchOrdered };
  }
  return { weekIndex: 0, dayTab: orderedDays[0] || 'Seg' };
};

const findMatchingTopic = (title: string, userTopics: any[], manualTopicId?: string): any | null => {
  if (!title || !userTopics || userTopics.length === 0) return null;

  // 0. ID matching (if manually linked)
  if (manualTopicId) {
    const foundById = userTopics.find(t => t.id === manualTopicId);
    if (foundById) return foundById;
  }

  // 1. Core normalization function
  const cleanAndNormalize = (text: string): string => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ") // replace symbols with space
      .replace(/\s+/g, " ") // collapse multiple spaces
      .trim();
  };

  const stopWords = new Set(["de", "da", "do", "em", "com", "e", "o", "a", "os", "as", "para", "por", "um", "uma", "tipo", "apos", "pos"]);

  const getCleanWords = (text: string): string[] => {
    return cleanAndNormalize(text)
      .split(" ")
      .filter(w => w.length > 0 && !stopWords.has(w));
  };

  const titleClean = cleanAndNormalize(title);
  const titleExpanded = expandPhrase(titleClean);

  // Rule 1: Exact or expanded exact match (highest confidence)
  for (const t of userTopics) {
    const tTitle = t.title || t.name || '';
    const tClean = cleanAndNormalize(tTitle);
    const tExpanded = expandPhrase(tClean);

    for (const te of titleExpanded) {
      for (const tte of tExpanded) {
        if (te === tte && te.length > 0) {
          return t;
        }
      }
    }
  }

  // Helper to compare word roots/prefixes to handle suffixes like Anestesiologia vs Anestesio
  const areWordsSimilar = (w1: string, w2: string): boolean => {
    if (w1 === w2) return true;
    if (w1.startsWith(w2) && w2.length >= 5) return true;
    if (w2.startsWith(w1) && w1.length >= 5) return true;
    return false;
  };

  // Rule 2: Substring matching with multi-word terms (to avoid matching single generic words like "aguda")
  // e.g. "Insuficiência Cardíaca Congestiva" should match "Insuficiência Cardíaca" because "Insuficiência Cardíaca" has >= 2 words.
  for (const t of userTopics) {
    const tTitle = t.title || t.name || '';
    const tClean = cleanAndNormalize(tTitle);
    
    // Check if one clean title is a subset of another, BUT only if both have at least 2 words
    const wordsTitle = getCleanWords(title);
    const wordsTopic = getCleanWords(tTitle);

    if (wordsTitle.length >= 2 && wordsTopic.length >= 2) {
      if (tClean.includes(titleClean) || titleClean.includes(tClean)) {
        // Double check they share the primary medical noun (first word) to prevent wrong mappings
        if (areWordsSimilar(wordsTitle[0], wordsTopic[0])) {
          return t;
        }
      }
    }
  }

  // Rule 3: Jaccard similarity / Token overlap with stem/prefix support (very strict)
  // Requires at least 70% of the non-stop words of the shorter topic to be present in the longer topic,
  // and they must share at least one key noun (the first or second word) to be considered a match.
  // Also, we exclude generic words from being the only match.
  const genericWords = new Set(["aguda", "agudo", "cronica", "cronico", "doenca", "sindrome", "infantil", "clinica", "cirurgia", "geral", "tratamento", "diagnostico", "exame", "prevencao", "fisiopatologia", "quadro", "clinico"]);

  for (const t of userTopics) {
    const tTitle = t.title || t.name || '';
    const wordsTitle = getCleanWords(title);
    const wordsTopic = getCleanWords(tTitle);

    if (wordsTitle.length === 0 || wordsTopic.length === 0) continue;

    let intersectionCount = 0;
    let sharedKeyWord = false;

    for (const w1 of wordsTitle) {
      // Check if there is any similar word in wordsTopic
      const hasSimilar = wordsTopic.some(w2 => areWordsSimilar(w1, w2));
      if (hasSimilar) {
        intersectionCount++;
        if (!genericWords.has(w1)) {
          sharedKeyWord = true;
        }
      }
    }

    const minWords = Math.min(wordsTitle.length, wordsTopic.length);
    const matchRatio = intersectionCount / minWords;

    // Strict threshold: at least 70% overlap of words, and must share at least one non-generic word
    if (matchRatio >= 0.70 && sharedKeyWord) {
      return t;
    }
  }

  return null;
};

const calculateEstimatedRetention = (topic: any): number | null => {
  if (!topic || !topic.lastReviewDate) return null;

  const lastReview = new Date(topic.lastReviewDate).getTime();
  const now = new Date().getTime();
  const elapsedDays = (now - lastReview) / (1000 * 60 * 60 * 24);

  // interval is in days
  const interval = topic.interval || 1;

  // Exponential decay R = e^(-lambda * t) where R=0.90 at t=interval
  const lambda = 0.10536 / interval;
  const retention = Math.exp(-lambda * elapsedDays) * 100;

  return Math.max(10, Math.min(100, Math.round(retention)));
};

export default function Cronograma({ 
  user, 
  subjects,
  topics,
  setView, 
  setSelectedTopic, 
  setSelectedSubject,
  setCronogramaFilterTopics,
  setCronogramaQuestionsCount,
  setCronogramaMode,
  availableCredits,
  setAvailableCredits,
  setSubjects,
  setTopics
}: CronogramaProps) {
  const { profile } = useAuth();
  
  const [schedule, setSchedule] = useState<StudySchedule | null>(null);
  const [schedules, setSchedules] = useState<StudySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | 'incidence' | 'config' | 'methodology' | 'all-topics' | 'college-sync' | 'analysis' | 'calendar-sync' | 'completed-imported'>('plan');
  const [showExtraTools, setShowExtraTools] = useState(false);

  // PREVIEW STATES FOR IN-PROGRESS SCHEDULE REVIEWS
  const [previewSchedule, setPreviewSchedule] = useState<StudySchedule | null>(null);
  const [previewWeeklyMock, setPreviewWeeklyMock] = useState<boolean>(true);
  const [previewMonthlyMock, setPreviewMonthlyMock] = useState<boolean>(true);
  const [previewQuarterlyMock, setPreviewQuarterlyMock] = useState<boolean>(false);
  const [previewSemiAnnualMock, setPreviewSemiAnnualMock] = useState<boolean>(false);
  const [previewAnnualMock, setPreviewAnnualMock] = useState<boolean>(false);
  const [previewWeeksCount, setPreviewWeeksCount] = useState<number>(24);
  const [previewTab, setPreviewTab] = useState<'weeks' | 'topics' | 'analysis' | 'config'>('weeks');
  const [previewSearchText, setPreviewSearchText] = useState<string>('');
  
  const [studyingTopicTitle, setStudyingTopicTitle] = useState<string | null>(null);

  // MedRevise Synchronization preference state
  const [medReviseSyncMode, setMedReviseSyncMode] = useState<'ask' | 'sync' | 'internato_only'>(() => {
    try {
      const saved = localStorage.getItem('medinternato_sync_medrevise_mode');
      if (saved === 'sync' || saved === 'internato_only' || saved === 'ask') return saved;
    } catch (e) {}
    return 'ask';
  });

  const [syncConfirmModalOpen, setSyncConfirmModalOpen] = useState(false);
  const [pendingStudyArgs, setPendingStudyArgs] = useState<{ scheduleTopic: any; targetView: 'topicDetail' | 'questions' | 'flashcards' } | null>(null);
  const [rememberSyncChoice, setRememberSyncChoice] = useState(true);

  const updateSyncMode = (mode: 'ask' | 'sync' | 'internato_only') => {
    setMedReviseSyncMode(mode);
    try {
      localStorage.setItem('medinternato_sync_medrevise_mode', mode);
    } catch (e) {}
  };

  const displayCoverage = schedule 
    ? (schedule.coveragePercentage !== undefined ? schedule.coveragePercentage : calculateCoverage(schedule.weeks, schedule.exam))
    : 0;

  let hasCycle2 = false;
  let hasCycle3 = false;
  if (schedule && Array.isArray(schedule.weeks)) {
    schedule.weeks.forEach(w => {
      if (w && w.days) {
        Object.values(w.days).forEach(dayTopics => {
          if (Array.isArray(dayTopics)) {
            dayTopics.forEach(t => {
              if (t && typeof t.title === 'string') {
                if (t.title.includes('⚡ [QUESTÕES AVANÇADAS]')) {
                  hasCycle2 = true;
                }
                if (t.title.includes('🔄 [REVISÃO DE REFORÇO]')) {
                  hasCycle3 = true;
                }
              }
            });
          }
        });
      }
    });
  }

  const matchTopicForSchedule = (cleanTitle: string, topicsList: any[]) => {
    if (!cleanTitle || !topicsList || topicsList.length === 0) return undefined;
    const targetLower = cleanTitle.toLowerCase().trim();
    const exact = topicsList.find(t => t.title && t.title.toLowerCase().trim() === targetLower);
    if (exact) return exact;

    return topicsList.find(t => {
      if (!t.title) return false;
      const tLower = t.title.toLowerCase().trim();
      return tLower.length > 3 && (tLower.includes(targetLower) || targetLower.includes(tLower));
    });
  };

  const handleContinueStudy = async (
    scheduleTopic: any, 
    targetView: 'topicDetail' | 'questions' | 'flashcards' = 'topicDetail',
    overrideSyncChoice?: 'sync' | 'internato_only'
  ) => {
    if (!user) return;

    const currentChoice = overrideSyncChoice || medReviseSyncMode;

    if (currentChoice === 'ask' && !overrideSyncChoice) {
      setPendingStudyArgs({ scheduleTopic, targetView });
      setSyncConfirmModalOpen(true);
      return;
    }

    setStudyingTopicTitle(scheduleTopic.title);

    try {
      const cleanTitle = (scheduleTopic?.title || '')
        .replace(/^Revisão Ativa \+ Flashcards: /, '')
        .replace(/^⚡ \[QUESTÕES AVANÇADAS\] /, '')
        .replace(/^🔄 \[REVISÃO DE REFORÇO\] /, '')
        .trim();

      const topicIdToTry = scheduleTopic.topicId || scheduleTopic.linkedTopicId || scheduleTopic.id;

      let targetSubject: any;
      let targetTopic: any;

      // 1. Fast path: check in-memory cache and topics list using O(1) cache map and findMatchingTopic
      const matchedFromCache = getMatchedDbTopic(scheduleTopic.title, topicIdToTry, scheduleTopic.type);
      const matchedInMemory = matchedFromCache || findMatchingTopic(cleanTitle, topics || [], topicIdToTry) || matchTopicForSchedule(cleanTitle, topics || []);

      if (matchedInMemory) {
        targetTopic = matchedInMemory;
        targetSubject = (subjects || []).find(s => s.id === matchedInMemory.subjectId) || {
          id: matchedInMemory.subjectId,
          name: scheduleTopic.subjectName || 'Geral',
          semesterId: matchedInMemory.semesterId || 'cronograma_local',
          icon: 'BookOpen',
          color: 'bg-blue-100 text-[#0066cc]'
        };
      } else {
        // 2. Query Firestore before creating a new topic to prevent duplicate empty topic creation
        let foundInFirestore: any = null;

        // A. If topicIdToTry exists, fetch by ID
        if (topicIdToTry && typeof topicIdToTry === 'string' && !topicIdToTry.startsWith('local_')) {
          try {
            const topicDocRef = doc(db, 'users', user.uid, 'topics', topicIdToTry);
            const topicSnap = await getDoc(topicDocRef);
            if (topicSnap.exists()) {
              foundInFirestore = { id: topicSnap.id, ...topicSnap.data() };
            }
          } catch (err) {
            console.warn('Error fetching topic by ID from Firestore:', err);
          }
        }

        // B. Query users/{uid}/topics by exact cleanTitle
        if (!foundInFirestore && cleanTitle) {
          try {
            const qTitle = query(collection(db, 'users', user.uid, 'topics'), where('title', '==', cleanTitle), limit(1));
            const snapTitle = await getDocs(qTitle);
            if (!snapTitle.empty) {
              foundInFirestore = { id: snapTitle.docs[0].id, ...snapTitle.docs[0].data() };
            }
          } catch (err) {
            console.warn('Error querying topic by title from Firestore:', err);
          }
        }

        // C. Fallback: fetch user topics from Firestore and run findMatchingTopic
        if (!foundInFirestore) {
          try {
            const userTopicsSnap = await getDocs(collection(db, 'users', user.uid, 'topics'));
            if (!userTopicsSnap.empty) {
              const allUserTopics = userTopicsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              foundInFirestore = findMatchingTopic(cleanTitle, allUserTopics, topicIdToTry);
            }
          } catch (err) {
            console.warn('Error querying all user topics from Firestore:', err);
          }
        }

        if (foundInFirestore) {
          targetTopic = foundInFirestore;
          targetSubject = (subjects || []).find(s => s.id === foundInFirestore.subjectId) || {
            id: foundInFirestore.subjectId,
            name: scheduleTopic.subjectName || 'Geral',
            semesterId: foundInFirestore.semesterId || 'cronograma_sem',
            icon: 'BookOpen',
            color: 'bg-blue-100 text-[#0066cc]'
          };
          if (setTopics) {
            setTopics(prev => {
              if (prev.some(t => t.id === foundInFirestore.id)) return prev;
              return [...prev, foundInFirestore];
            });
          }
        } else if (currentChoice === 'sync') {
          // 3. Create Subject & Topic in Firestore ONLY if it really doesn't exist anywhere
          let foundSubject = (subjects || []).find(
            s => s.name?.toLowerCase().trim() === scheduleTopic.subjectName?.toLowerCase().trim()
          );

          if (!foundSubject) {
            const colors = [
              'bg-blue-100 text-[#0066cc]',
              'bg-[#FAF0E6] text-[#b45309]',
              'bg-purple-100 text-purple-700',
              'bg-rose-100 text-rose-700',
              'bg-emerald-100 text-emerald-700',
              'bg-indigo-100 text-indigo-700',
              'bg-cyan-100 text-cyan-700'
            ];
            const icons = ['BookOpen', 'Brain', 'Pill', 'FileText', 'GraduationCap', 'Activity', 'ClipboardList'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const icon = icons[Math.floor(Math.random() * icons.length)];

            const subjectsRef = collection(db, 'users', user.uid, 'subjects');
            const newSubjectRef = await addDoc(subjectsRef, {
              name: scheduleTopic.subjectName || 'Geral',
              semesterId: 'cronograma_sem',
              icon,
              color,
              createdAt: new Date().toISOString()
            });
            foundSubject = {
              id: newSubjectRef.id,
              name: scheduleTopic.subjectName || 'Geral',
              semesterId: 'cronograma_sem',
              icon,
              color
            };

            if (setSubjects) {
              setSubjects(prev => {
                const list = [...prev, foundSubject];
                list.sort((a, b) => a.name.localeCompare(b.name));
                return list;
              });
            }
          }
          targetSubject = foundSubject;

          const tIncidence = scheduleTopic.historicalIncidence || 15;
          const tImportance = scheduleTopic.importanceDegree || (
            tIncidence >= 25 ? 'extremo' : tIncidence >= 22 ? 'alto' : tIncidence >= 18 ? 'medio' : 'baixo'
          );

          const topicsRef = collection(db, 'users', user.uid, 'topics');
          const newTopicRef = await addDoc(topicsRef, {
            title: cleanTitle,
            subjectId: targetSubject.id,
            semesterId: targetSubject.semesterId || 'cronograma_sem',
            references: "",
            createdAt: new Date().toISOString(),
            historicalIncidence: tIncidence,
            importanceDegree: tImportance,
            completed: false
          });
          targetTopic = {
            id: newTopicRef.id,
            title: cleanTitle,
            subjectId: targetSubject.id,
            semesterId: targetSubject.semesterId || 'cronograma_sem',
            references: "",
            historicalIncidence: tIncidence,
            importanceDegree: tImportance,
            completed: false
          };

          if (setTopics) {
            setTopics(prev => [...prev, targetTopic]);
          }
        } else {
          // 'internato_only': Keep planning strictly inside MedInternato
          targetSubject = {
            id: `local_subj_${(scheduleTopic.subjectName || 'Geral').toLowerCase().replace(/\s+/g, '_')}`,
            name: scheduleTopic.subjectName || 'Geral',
            semesterId: 'cronograma_local',
            icon: 'BookOpen',
            color: 'bg-blue-100 text-[#0066cc]'
          };
          targetTopic = {
            id: scheduleTopic.id || `local_topic_${cleanTitle.toLowerCase().replace(/\s+/g, '_')}`,
            title: cleanTitle,
            subjectId: targetSubject.id,
            semesterId: 'cronograma_local',
            references: "",
            historicalIncidence: scheduleTopic.historicalIncidence || 15,
            importanceDegree: scheduleTopic.importanceDegree || 'medio',
            completed: false
          };
        }
      }

      setSelectedSubject(targetSubject);
      setSelectedTopic(targetTopic);

      if (targetView === 'questions') {
        setCronogramaFilterTopics([targetTopic.id]);
        setCronogramaQuestionsCount(15);
        setCronogramaMode('study');
        setView('questions');
      } else if (targetView === 'flashcards') {
        setView('flashcards');
      } else {
        // Direct view transition without blocking AI pre-analysis delay
        setView('topicDetail');
      }

    } catch (err: any) {
      console.error('Error in handling continue study:', err);
      alert('Erro ao carregar/preparar o tópico de estudos: ' + err.message);
    } finally {
      setStudyingTopicTitle(null);
    }
  };
  
  // Config Form States
  const [showPlannerWizard, setShowPlannerWizard] = useState<boolean>(false);
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('todos');
  const [selectedExamId, setSelectedExamId] = useState<string>('ses-df');
  const [modality, setModality] = useState<'6meses' | '1ano' | '2anos' | 'dynamic'>('6meses');
  const [studyDays, setStudyDays] = useState<string[]>(['Seg', 'Ter', 'Qui', 'Sáb']);
  const [hoursPerDay, setHoursPerDay] = useState<number>(4);
  const [generating, setGenerating] = useState(false);
  const [activeWeekIndex, setActiveWeekIndex] = useState<number>(0);
  const [currentSemesterSubjects, setCurrentSemesterSubjects] = useState<string[]>([]);
  const [onlyCurrentSemester, setOnlyCurrentSemester] = useState<boolean>(false);
  const [examDate, setExamDate] = useState<string>('');

  // Pagination filters for Month / Week list
  const [activeMonthFilter, setActiveMonthFilter] = useState<number>(1);

  // College Import and Topic Swap States
  const [collegeExamDate, setCollegeExamDate] = useState<string>('');
  const [collegeInputText, setCollegeInputText] = useState<string>('');
  const [selectedCollegeTopics, setSelectedCollegeTopics] = useState<string[]>([]);
  const [showSwapModal, setShowSwapModal] = useState<boolean>(false);
  const [swapWeekIdx, setSwapWeekIdx] = useState<number>(0);
  const [swapDayName, setSwapDayName] = useState<string>('');
  const [swapTopicIdx, setSwapTopicIdx] = useState<number>(0);
  const [swapSearchText, setSwapSearchText] = useState<string>('');
  const [analysisSearchText, setAnalysisSearchText] = useState<string>('');
  const [targetCoverage, setTargetCoverage] = useState<'85' | '95'>('95');

  // Topic Performance and Detailed Review states
  const [topicPerformanceInputs, setTopicPerformanceInputs] = useState<Record<string, { total: number; correct: number }>>({});
  const [selectedDeficitReviews, setSelectedDeficitReviews] = useState<string[]>([]);
  const [isDetailedFill, setIsDetailedFill] = useState<boolean>(true);
  const [simuladoTab, setSimuladoTab] = useState<'weekly' | 'monthly'>('weekly');

  // PDF Import states
  const [pdfImporting, setPdfImporting] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string>('');
  const [isAiMatching, setIsAiMatching] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<string>('');
  const [pdfProgressPercent, setPdfProgressPercent] = useState<number>(0);

  // Manual topic linking states
  const [linkingTopic, setLinkingTopic] = useState<{ weekIdx: number; dayName: string; topicIdx: number; title: string; currentLinkedId?: string } | null>(null);
  const [topicLinkSearch, setTopicLinkSearch] = useState<string>('');

  // Helper to robustly clean any scheduling prefix/formatting to match database titles
  const getCleanTopicTitle = (title: string): string => {
    if (!title) return '';
    return title
      .replace(/^⚡\s*\[[^\]]+\]\s*/i, '')
      .replace(/^🔄\s*\[[^\]]+\]\s*/i, '')
      .replace(/^Revisão Ativa \+ Flashcards:\s*/i, '')
      .replace(/^REVISÃO R\d:\s*/i, '')
      .replace(/^REVISÃO R\d\s*/i, '')
      .trim();
  };

  // Helper to identify if a topic is a revision session (spaced repetition / review slot)
  const isRevisionTopic = (t: StudyPlanTopic): boolean => {
    if (!t || !t.title) return false;
    if (t.type === 'revisao') return true;
    const titleUpper = t.title.toUpperCase();
    if (
      t.title.startsWith('🔄') ||
      t.title.startsWith('⚡') ||
      titleUpper.includes('REVISÃO ATIVA') ||
      titleUpper.includes('REVISAO ATIVA') ||
      titleUpper.startsWith('REVISÃO R') ||
      titleUpper.startsWith('REVISAO R') ||
      titleUpper.includes('FLASHCARD')
    ) {
      return true;
    }
    return false;
  };

  // Pre-process user topics for fast matching
  const preprocessedUserTopics = useMemo(() => {
    if (!topics || topics.length === 0) return [];

    const cleanAndNormalize = (text: string): string => {
      return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ") // replace symbols with space
        .replace(/\s+/g, " ") // collapse multiple spaces
        .trim();
    };

    const stopWords = new Set(["de", "da", "do", "em", "com", "e", "o", "a", "os", "as", "para", "por", "um", "uma", "tipo", "apos", "pos"]);

    const getCleanWords = (text: string): string[] => {
      return cleanAndNormalize(text)
        .split(" ")
        .filter(w => w.length > 0 && !stopWords.has(w));
    };

    return topics.map(t => {
      const tTitle = t.title || t.name || '';
      const tClean = cleanAndNormalize(tTitle);
      return {
        topic: t,
        id: t.id,
        cleanTitle: tClean,
        expandedPhrases: expandPhrase(tClean),
        cleanWords: getCleanWords(tTitle)
      };
    });
  }, [topics]);

  // Build a cache Map to resolve matching topics in O(1) during render
  const matchedTopicsMap = useMemo(() => {
    const cache = new Map<string, any | null>();
    if (preprocessedUserTopics.length === 0) return cache;

    // Create O(1) indexing maps to completely eliminate slow loops
    const userTopicsById = new Map<string, any>();
    const userTopicsByExpandedPhrase = new Map<string, any>();

    preprocessedUserTopics.forEach(t => {
      if (t.id) {
        userTopicsById.set(t.id, t.topic);
      }
      if (t.expandedPhrases) {
        t.expandedPhrases.forEach(phrase => {
          if (phrase.length > 0 && !userTopicsByExpandedPhrase.has(phrase)) {
            userTopicsByExpandedPhrase.set(phrase, t.topic);
          }
        });
      }
    });

    const cleanAndNormalize = (text: string): string => {
      return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ") // replace symbols with space
        .replace(/\s+/g, " ") // collapse multiple spaces
        .trim();
    };

    const stopWords = new Set(["de", "da", "do", "em", "com", "e", "o", "a", "os", "as", "para", "por", "um", "uma", "tipo", "apos", "pos"]);

    const getCleanWords = (text: string): string[] => {
      return cleanAndNormalize(text)
        .split(" ")
        .filter(w => w.length > 0 && !stopWords.has(w));
    };

    const areWordsSimilar = (w1: string, w2: string): boolean => {
      if (w1 === w2) return true;
      if (w1.startsWith(w2) && w2.length >= 5) return true;
      if (w2.startsWith(w1) && w1.length >= 5) return true;
      return false;
    };

    const genericWords = new Set([
      "aguda", "agudo", "cronica", "cronico", "doenca", "sindrome", "infantil", "clinica", "cirurgia", "geral",
      "tratamento", "diagnostico", "exame", "prevencao", "fisiopatologia", "quadro", "clinico",
      "revisao", "revisoes", "reforco", "questoes", "avancadas", "simulado", "semanal", "mensal"
    ]);

    const findMatch = (title: string, manualTopicId?: string): any | null => {
      if (!title) return null;

      // 0. ID matching
      if (manualTopicId) {
        const foundById = userTopicsById.get(manualTopicId);
        if (foundById) return foundById;
      }

      const titleClean = cleanAndNormalize(title);
      const titleExpanded = expandPhrase(titleClean);

      // Rule 1: Exact or expanded exact match (using O(1) prebuilt phrases map)
      for (const te of titleExpanded) {
        if (te.length > 0) {
          const matched = userTopicsByExpandedPhrase.get(te);
          if (matched) return matched;
        }
      }

      // Rule 2: Substring matching with multi-word terms (fall back to list if Rule 1 misses)
      const wordsTitle = getCleanWords(title);
      for (const t of preprocessedUserTopics) {
        const wordsTopic = t.cleanWords;
        if (wordsTitle.length >= 2 && wordsTopic.length >= 2) {
          if (t.cleanTitle.includes(titleClean) || titleClean.includes(t.cleanTitle)) {
            if (areWordsSimilar(wordsTitle[0], wordsTopic[0])) {
              return t.topic;
            }
          }
        }
      }

      // Rule 3: Jaccard similarity / Token overlap
      for (const t of preprocessedUserTopics) {
        const wordsTopic = t.cleanWords;
        if (wordsTitle.length === 0 || wordsTopic.length === 0) continue;

        let intersectionCount = 0;
        let sharedKeyWord = false;

        for (const w1 of wordsTitle) {
          const hasSimilar = wordsTopic.some(w2 => areWordsSimilar(w1, w2));
          if (hasSimilar) {
            intersectionCount++;
            if (!genericWords.has(w1)) {
              sharedKeyWord = true;
            }
          }
        }

        const minWords = Math.min(wordsTitle.length, wordsTopic.length);
        const matchRatio = intersectionCount / minWords;

        if (matchRatio >= 0.70 && sharedKeyWord) {
          return t.topic;
        }
      }

      return null;
    };

    // Cache schedule topics
    if (schedule && schedule.weeks) {
      schedule.weeks.forEach(week => {
        if (week && week.days) {
          Object.values(week.days).forEach(topicsArr => {
            if (Array.isArray(topicsArr)) {
              topicsArr.forEach(planTopic => {
                const planTitle = planTopic.title || '';
                const canonicalTitle = getCleanTopicTitle(planTitle);

                const matchVal = findMatch(canonicalTitle, planTopic.topicId);
                const keys = [
                  `${canonicalTitle}::${planTopic.topicId || ''}`,
                  `${planTitle}::${planTopic.topicId || ''}`,
                  `${canonicalTitle}::`,
                  `${planTitle}::`
                ];
                keys.forEach(k => {
                  if (!cache.has(k)) {
                    cache.set(k, matchVal);
                  }
                });
              });
            }
          });
        }
      });
    }

    // Cache previewSchedule topics
    if (previewSchedule && previewSchedule.weeks) {
      previewSchedule.weeks.forEach(week => {
        if (week && week.days) {
          Object.values(week.days).forEach(topicsArr => {
            if (Array.isArray(topicsArr)) {
              topicsArr.forEach(planTopic => {
                const planTitle = planTopic.title || '';
                const canonicalTitle = getCleanTopicTitle(planTitle);

                const matchVal = findMatch(canonicalTitle, planTopic.topicId);
                const keys = [
                  `${canonicalTitle}::${planTopic.topicId || ''}`,
                  `${planTitle}::${planTopic.topicId || ''}`,
                  `${canonicalTitle}::`,
                  `${planTitle}::`
                ];
                keys.forEach(k => {
                  if (!cache.has(k)) {
                    cache.set(k, matchVal);
                  }
                });
              });
            }
          });
        }
      });
    }

    return cache;
  }, [preprocessedUserTopics, schedule, previewSchedule]);

  // Fast O(1) getter for matched database topic
  const getMatchedDbTopic = (title: string, topicId?: string, type?: string) => {
    if (!title) return null;
    const canonicalTitle = getCleanTopicTitle(title);

    const key1 = `${canonicalTitle}::${topicId || ''}`;
    if (matchedTopicsMap.has(key1)) return matchedTopicsMap.get(key1);

    const key2 = `${title}::${topicId || ''}`;
    if (matchedTopicsMap.has(key2)) return matchedTopicsMap.get(key2);

    const key3 = `${canonicalTitle}::`;
    if (matchedTopicsMap.has(key3)) return matchedTopicsMap.get(key3);

    const key4 = `${title}::`;
    if (matchedTopicsMap.has(key4)) return matchedTopicsMap.get(key4);

    return null;
  };

  // Helper to dynamically check if a topic from the study plan is completed in database
  const isTopicDone = (planTopic: StudyPlanTopic) => {
    if (!planTopic) return false;
    
    // Explicit completion flags checked in schedule (handle boolean and string-boolean formats)
    const isCompletedVal = planTopic.isCompleted === true || planTopic.isCompleted === 'true';
    const isPreCompletedVal = planTopic.isPreCompleted === true || planTopic.isPreCompleted === 'true';
    if (isCompletedVal || isPreCompletedVal) return true;

    const found = getMatchedDbTopic(planTopic.title, planTopic.topicId, planTopic.type);

    if (found) {
      // Must ONLY be marked as done if actual study or review activity was recorded in MedRevise.
      // Existence of the topic record alone in MedRevise does NOT imply it was studied.
      const hasRecordedStudy = !!(
        found.completed === true ||
        found.completed === 'true' ||
        (typeof found.repetitions === 'number' && found.repetitions > 0) ||
        (found.lastReviewDate && typeof found.lastReviewDate === 'string' && found.lastReviewDate.trim().length > 0)
      );

      if (!hasRecordedStudy) {
        return false;
      }

      // Distinguish Initial Study (estudo) vs Scheduled Revisions (revisao):
      // For a 'revisao' slot in the schedule:
      // Initial study (repetitions === 1) completes the 'estudo' session.
      // A revision session requires at least 2 repetitions (or explicit planTopic.isCompleted).
      if (planTopic.type === 'revisao') {
        return (typeof found.repetitions === 'number' && found.repetitions >= 2) || isCompletedVal || isPreCompletedVal;
      }

      return true;
    }

    // Fallback for custom topics not linked/found in MedRevise catalog
    return isCompletedVal || isPreCompletedVal;
  };

  // Helper to dynamically calculate schedule completion progress based on isTopicDone
  const getScheduleProgress = (s: StudySchedule | null) => {
    if (!s) return 0;
    let total = 0;
    let done = 0;
    s.weeks.forEach(w => {
      Object.values(w.days).forEach((arr: any) => {
        if (Array.isArray(arr)) {
          arr.forEach((t: any) => {
            total++;
            if (isTopicDone(t)) done++;
          });
        }
      });
    });
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const dynamicProgress = schedule ? getScheduleProgress(schedule) : 0;

  // Premium Layout States
  const [studyViewMode, setStudyViewMode] = useState<'focused' | 'grid'>('focused');
  const [ciclosCollapsed, setCiclosCollapsed] = useState(true);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [activeDayTab, setActiveDayTab] = useState<string>('Seg');
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Helper functions for timezone-safe local date calculations
  const getLocalYYYYMMDD = (d: Date = new Date()): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalCompactYYYYMMDD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const getNextMondayLocal = (): string => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
    return getLocalYYYYMMDD(nextMon);
  };

  // Calendar Synchronization States
  const [syncStartDate, setSyncStartDate] = useState<string>(() => {
    return getNextMondayLocal();
  });
  const [syncStartTime, setSyncStartTime] = useState<string>('08:00');
  const [syncReviewColor, setSyncReviewColor] = useState<string>('#8B5CF6'); // Beautiful Violet
  const [syncExamColor, setSyncExamColor] = useState<string>('#EF4444'); // Vibrant Red
  const [clearPreviousSync, setClearPreviousSync] = useState<boolean>(true);
  const [syncReminderTime, setSyncReminderTime] = useState<string>('15');
  const [syncStudyDurationHours, setSyncStudyDurationHours] = useState<number>(2);
  const [syncReviewDurationHours, setSyncReviewDurationHours] = useState<number>(1);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);
  const [syncProgressWeek, setSyncProgressWeek] = useState<number>(0);

  // Internato / College Sync Filters
  const [collegeSearchQuery, setCollegeSearchQuery] = useState<string>('');
  const [selectedInternatoRotation, setSelectedInternatoRotation] = useState<string>('');

  // Canonical Topics 53 Modal States
  const [showCanonicalModal, setShowCanonicalModal] = useState<boolean>(false);
  const [canonicalFilterArea, setCanonicalFilterArea] = useState<string>('Todas');
  const [canonicalSearchQuery, setCanonicalSearchQuery] = useState<string>('');

  const handleDownloadICSFile = () => {
    if (!schedule) return;
    try {
      const eventsToExport: { title: string; description: string; start: string; end: string }[] = [];
      const ALL_WEEKDAYS_MAP = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const scheduleStartDate = (schedule as any)?.startDate || syncStartDate;
      const startDateObj = new Date(scheduleStartDate + 'T00:00:00');
      const startDayIdx = !isNaN(startDateObj.getTime()) ? startDateObj.getDay() : 1;
      
      schedule.weeks.forEach((week, wIdx) => {
        // Weekly mock exam (Sunday)
        if (week.mockExam) {
          const daysToAdd = wIdx * 7 + 6;
          const eventDate = new Date(startDateObj);
          eventDate.setDate(eventDate.getDate() + daysToAdd);
          const dateStr = getLocalCompactYYYYMMDD(eventDate);
          eventsToExport.push({
            title: `📝 [SIMULADO SEMANAL] ${week.mockExam.title}`,
            description: `Simulado semanal programado contendo ${week.mockExam.questionsCount} questões.`,
            start: `${dateStr}T140000`,
            end: `${dateStr}T180000`
          });
        }

        // Monthly cumulative mock exam (Saturday of end-of-month week)
        if (week.monthlyMockExam) {
          const daysToAdd = wIdx * 7 + 5;
          const eventDate = new Date(startDateObj);
          eventDate.setDate(eventDate.getDate() + daysToAdd);
          const dateStr = getLocalCompactYYYYMMDD(eventDate);
          eventsToExport.push({
            title: `📝 [SIMULADO MENSAL] ${week.monthlyMockExam.title}`,
            description: `Simulado mensal acumulativo contendo ${week.monthlyMockExam.questionsCount} questões.`,
            start: `${dateStr}T140000`,
            end: `${dateStr}T180000`
          });
        }

        Object.entries(week.days || {}).forEach(([dayAbbr, dayTopics]) => {
          const targetDayIdx = ALL_WEEKDAYS_MAP.indexOf(dayAbbr);
          let offsetInWeek = targetDayIdx >= 0 ? targetDayIdx - startDayIdx : 0;
          if (offsetInWeek < 0) offsetInWeek += 7;
          const daysToAdd = wIdx * 7 + offsetInWeek;
          const eventDate = new Date(startDateObj);
          eventDate.setDate(eventDate.getDate() + daysToAdd);
          const dateStr = getLocalCompactYYYYMMDD(eventDate);
          const [startH, startM] = syncStartTime.split(':').map(Number);

          (dayTopics as any[]).forEach((topic, tIdx) => {
            const dur = topic.type === 'revisao' ? syncReviewDurationHours : syncStudyDurationHours;
            const topicStartH = (startH || 8) + (tIdx * dur);
            const topicEndH = topicStartH + dur;
            const pad = (n: number) => String(n).padStart(2, '0');

            eventsToExport.push({
              title: topic.type === 'revisao' 
                ? `🔄 [REVISÃO] ${topic.title}` 
                : `📖 [${topic.subjectName}] ${topic.title}`,
              description: `Estudo programado para ${topic.title}. Relevância histórica: ${topic.historicalIncidence || 15}%.`,
              start: `${dateStr}T${pad(topicStartH)}${pad(startM || 0)}00`,
              end: `${dateStr}T${pad(topicEndH)}${pad(startM || 0)}00`
            });
          });
        });
      });

      const icsLines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MedInternato//Cronograma Medico//PT-BR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:MedInternato Cronograma'
      ];

      eventsToExport.forEach((evt, idx) => {
        icsLines.push(
          'BEGIN:VEVENT',
          `UID:medinternato-${idx}-${Date.now()}@medrevise.app`,
          `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
          `DTSTART:${evt.start}`,
          `DTEND:${evt.end}`,
          `SUMMARY:${evt.title}`,
          `DESCRIPTION:${evt.description}`,
          'END:VEVENT'
        );
      });

      icsLines.push('END:VCALENDAR');

      const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cronograma_medinternato_${syncStartDate}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Arquivo .ics baixado com ${eventsToExport.length} eventos! Abra no Google Agenda, Apple iCal ou Outlook para importar.`, "success");
    } catch (icsErr) {
      console.error('Error generating ICS file:', icsErr);
      showToast("Erro ao gerar arquivo .ics do calendário.", "error");
    }
  };

  const handleExportToCalendar = async () => {
    if (!user || !schedule) return;
    setIsSyncingCalendar(true);
    setSyncProgressWeek(0);

    try {
      // Clear previous events if requested
      if (clearPreviousSync) {
        try {
          const calendarEventsRef = collection(db, 'users', user.uid, 'calendarEvents');
          const existingSnap = await getDocs(calendarEventsRef);
          const docsToDelete = existingSnap.docs.filter(d => {
            const data = d.data();
            return data.isCronograma && (data.scheduleId === schedule.id || !data.scheduleId);
          });
          for (let i = 0; i < docsToDelete.length; i += 400) {
            const chunk = docsToDelete.slice(i, i + 400);
            const batch = writeBatch(db);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        } catch (cleanErr) {
          console.warn('Notice cleaning previous calendar events:', cleanErr);
        }
      }

      const ALL_WEEKDAYS_MAP = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const scheduleStartDate = (schedule as any)?.startDate || syncStartDate;
      const startDateObj = new Date(scheduleStartDate + 'T00:00:00');
      const startDayIdx = !isNaN(startDateObj.getTime()) ? startDateObj.getDay() : 1;

      // Gather all events to import
      const eventsToCreate: any[] = [];
      const totalSyncWeeks = schedule.weeks.length;

      for (let wIdx = 0; wIdx < totalSyncWeeks; wIdx++) {
        const week = schedule.weeks[wIdx];
        
        // Add weekly simulated exam if present
        if (week.mockExam) {
          const daysToAdd = wIdx * 7 + 6; // Sunday
          const eventDate = new Date(startDateObj);
          eventDate.setDate(eventDate.getDate() + daysToAdd);
          const dateStr = getLocalYYYYMMDD(eventDate);

          eventsToCreate.push({
            title: `📝 [SIMULADO SEMANAL] ${week.mockExam.title}`,
            description: `Simulado semanal programado contendo ${week.mockExam.questionsCount} questões sobre as matérias da semana.`,
            start: `${dateStr}T14:00`,
            end: `${dateStr}T18:00`,
            color: syncExamColor,
            reminderMinutes: parseInt(syncReminderTime, 10) || 0,
            completed: !!week.mockExam.isCompleted,
            isCronograma: true,
            cronogramaTopicTitle: week.mockExam.title,
            cronogramaWeekIdx: wIdx,
            isMockExam: true,
            scheduleId: schedule.id,
            createdAt: new Date().toISOString()
          });
        }

        // Add monthly cumulative simulated exam if present
        if (week.monthlyMockExam) {
          const daysToAdd = wIdx * 7 + 5; // Saturday
          const eventDate = new Date(startDateObj);
          eventDate.setDate(eventDate.getDate() + daysToAdd);
          const dateStr = getLocalYYYYMMDD(eventDate);

          eventsToCreate.push({
            title: `📝 [SIMULADO MENSAL] ${week.monthlyMockExam.title}`,
            description: `Simulado mensal acumulativo contendo ${week.monthlyMockExam.questionsCount} questões sobre o conteúdo estudado até este mês.`,
            start: `${dateStr}T14:00`,
            end: `${dateStr}T18:00`,
            color: syncExamColor,
            reminderMinutes: parseInt(syncReminderTime, 10) || 0,
            completed: !!week.monthlyMockExam.isCompleted,
            isCronograma: true,
            cronogramaTopicTitle: week.monthlyMockExam.title,
            cronogramaWeekIdx: wIdx,
            isMockExam: true,
            isMonthlyMockExam: true,
            scheduleId: schedule.id,
            createdAt: new Date().toISOString()
          });
        }

        // Process daily study topics
        Object.entries(week.days).forEach(([dayAbbr, dayTopics]) => {
          const targetDayIdx = ALL_WEEKDAYS_MAP.indexOf(dayAbbr);
          let offsetInWeek = targetDayIdx >= 0 ? targetDayIdx - startDayIdx : 0;
          if (offsetInWeek < 0) offsetInWeek += 7;
          const daysToAdd = wIdx * 7 + offsetInWeek;
          const eventDate = new Date(startDateObj);
          eventDate.setDate(eventDate.getDate() + daysToAdd);
          const dateStr = getLocalYYYYMMDD(eventDate);

          const [startHourStr, startMinStr] = syncStartTime.split(':');
          const startHour = parseInt(startHourStr, 10) || 8;
          const startMin = parseInt(startMinStr, 10) || 0;

          dayTopics.forEach((topic, tIdx) => {
            const duration = topic.type === 'revisao' ? syncReviewDurationHours : syncStudyDurationHours;
            const topicStartHour = startHour + (tIdx * duration);
            const topicEndHour = topicStartHour + duration;

            const formatHour = (h: number) => String(h).padStart(2, '0');
            const formatMin = (m: number) => String(m).padStart(2, '0');

            const startISO = `${dateStr}T${formatHour(topicStartHour)}:${formatMin(startMin)}`;
            const endISO = `${dateStr}T${formatHour(topicEndHour)}:${formatMin(startMin)}`;

            // Find existing subject for subjectId matching
            const matchedSubject = subjects.find(s => s.name?.toLowerCase().trim() === topic.subjectName?.toLowerCase().trim());
            
            let color = '';
            if (topic.type === 'revisao') {
              color = syncReviewColor;
            } else if (matchedSubject) {
              color = matchedSubject.color?.startsWith('#') ? matchedSubject.color : '';
              if (!color && matchedSubject.color) {
                const hexMatch = matchedSubject.color.match(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/);
                if (hexMatch) {
                  color = `#${hexMatch[1]}`;
                }
              }
            }

            eventsToCreate.push({
              title: topic.type === 'revisao' 
                ? `🔄 [REVISÃO] ${topic.title}` 
                : `📖 [${topic.subjectName}] ${topic.title}`,
              description: `Estudo programado para ${topic.title}. Relevância histórica: ${topic.historicalIncidence}%. Grau de prioridade: ${topic.importanceDegree || 'NORMAL'}.`,
              start: startISO,
              end: endISO,
              subjectId: matchedSubject?.id || '',
              color: color || undefined,
              reminderMinutes: parseInt(syncReminderTime, 10) || 0,
              completed: !!isTopicDone(topic),
              isCronograma: true,
              cronogramaTopicTitle: topic.title,
              cronogramaWeekIdx: wIdx,
              cronogramaDayAbbr: dayAbbr,
              cronogramaTopicIdx: tIdx,
              scheduleId: schedule.id,
              createdAt: new Date().toISOString()
            });
          });
        });
      }

      // Save to Firebase in calendarEvents collection with precise position deduplication
      const calendarEventsRef = collection(db, 'users', user.uid, 'calendarEvents');
      const existingSnap = await getDocs(calendarEventsRef);
      const existingEventsMap = new Map<string, string>(); // key -> docId

      existingSnap.docs.forEach(d => {
        const data = d.data();
        if (data.isCronograma && data.scheduleId === schedule.id) {
          if (data.cronogramaWeekIdx !== undefined && data.cronogramaDayAbbr !== undefined && data.cronogramaTopicIdx !== undefined) {
            existingEventsMap.set(`pos_${data.scheduleId}_w${data.cronogramaWeekIdx}_d${data.cronogramaDayAbbr}_t${data.cronogramaTopicIdx}`, d.id);
          } else if (data.isMockExam) {
            existingEventsMap.set(`pos_${data.scheduleId}_w${data.cronogramaWeekIdx}_mock_${data.isMonthlyMockExam ? 'monthly' : 'weekly'}`, d.id);
          }
        }
        const titleKey = (data.cronogramaTopicTitle || data.title || '').toLowerCase().trim();
        const dateKey = data.start ? String(data.start).substring(0, 10) : '';
        if (titleKey && dateKey) {
          existingEventsMap.set(`exact_${titleKey}___${dateKey}`, d.id);
        }
      });

      let addedCount = 0;
      let updatedCount = 0;

      for (let i = 0; i < eventsToCreate.length; i++) {
        const item = eventsToCreate[i];
        const dateKey = item.start ? String(item.start).substring(0, 10) : '';
        const titleKey = (item.cronogramaTopicTitle || item.title || '').toLowerCase().trim();

        const posKey = item.isMockExam
          ? `pos_${item.scheduleId}_w${item.cronogramaWeekIdx}_mock_${item.isMonthlyMockExam ? 'monthly' : 'weekly'}`
          : `pos_${item.scheduleId}_w${item.cronogramaWeekIdx}_d${item.cronogramaDayAbbr}_t${item.cronogramaTopicIdx}`;
        
        const exactKey = `exact_${titleKey}___${dateKey}`;

        const existingDocId = existingEventsMap.get(posKey) || existingEventsMap.get(exactKey);

        if (existingDocId) {
          // Update existing event instead of creating a duplicate
          await updateDoc(doc(db, 'users', user.uid, 'calendarEvents', existingDocId), item);
          updatedCount++;
        } else {
          // Add new event
          const newDocRef = await addDoc(calendarEventsRef, item);
          existingEventsMap.set(posKey, newDocRef.id);
          existingEventsMap.set(exactKey, newDocRef.id);
          addedCount++;
        }

        if (i % 10 === 0 || i === eventsToCreate.length - 1) {
          const percentage = Math.round(((i + 1) / eventsToCreate.length) * 100);
          setSyncProgressWeek(percentage);
        }
      }

      showToast(`Sincronização concluída! ${addedCount} novos eventos adicionados, ${updatedCount} eventos atualizados (sem duplicatas).`, 'success');
      setActiveTab('plan'); // return to study plan
    } catch (err: any) {
      console.error('Error syncing calendar:', err);
      showToast('Erro ao sincronizar o calendário. Tente novamente.', 'error');
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  // Adjust activeDayTab when activeWeekIndex changes
  useEffect(() => {
    if (schedule && schedule.weeks[activeWeekIndex]) {
      const daysOfThisWeek = getOrderedDaysForWeek(schedule.studyDays, (schedule as any).startDate);
      if (daysOfThisWeek.length > 0 && !daysOfThisWeek.includes(activeDayTab)) {
        setActiveDayTab(daysOfThisWeek[0]);
      }
    }
  }, [activeWeekIndex, schedule]);

  // Initialize topic performance inputs when activeWeekIndex or schedule changes
  useEffect(() => {
    if (schedule && schedule.weeks[activeWeekIndex]) {
      const mock = schedule.weeks[activeWeekIndex].mockExam;
      const weekTopics = getWeekTopics(activeWeekIndex);
      const initialPerformance: Record<string, { total: number; correct: number }> = {};
      
      const totalQuestions = mock?.questionsCount || 20;
      const defaultTotalPerTopic = weekTopics.length > 0 
        ? Math.max(5, Math.ceil(totalQuestions / weekTopics.length)) 
        : 10;

      weekTopics.forEach(title => {
        if (mock?.topicPerformance && mock.topicPerformance[title]) {
          initialPerformance[title] = { ...mock.topicPerformance[title] };
        } else {
          initialPerformance[title] = {
            total: defaultTotalPerTopic,
            correct: defaultTotalPerTopic // Default to 100% correct so they can subtract errors easily
          };
        }
      });
      setTopicPerformanceInputs(initialPerformance);

      // Pre-select deficit reviews if analysis exists
      if (mock?.analysis?.topicAnalysis) {
        const deficitList = Object.entries(mock.analysis.topicAnalysis)
          .filter(([_, data]) => data.status === 'insuficiente' || data.status === 'regular')
          .map(([title]) => title);
        setSelectedDeficitReviews(deficitList);
      } else {
        setSelectedDeficitReviews([]);
      }
    }
  }, [activeWeekIndex, schedule]);

  // Priority sorting of study/revision topics
  const getSortedTopics = (topicsList: StudyPlanTopic[]): StudyPlanTopic[] => {
    if (!topicsList) return [];
    return [...topicsList].sort((a, b) => {
      // 1. Reviews always come first (Active Reviews)
      if (a.type === 'revisao' && b.type !== 'revisao') return -1;
      if (a.type !== 'revisao' && b.type === 'revisao') return 1;

      // 2. Sorted by importance degree (extremo > alto > medio > baixo)
      const importanceWeight = { extremo: 4, alto: 3, medio: 2, baixo: 1 };
      const weightA = importanceWeight[a.importanceDegree || 'medio'] || 2;
      const weightB = importanceWeight[b.importanceDegree || 'medio'] || 2;

      if (weightA !== weightB) {
        return weightB - weightA;
      }

      // 3. Fallback to historical incidence
      return (b.historicalIncidence || 0) - (a.historicalIncidence || 0);
    });
  };

  // Get the single first incomplete topic across all days in the active week
  const firstIncompleteTopicOfWeek = useMemo(() => {
    if (!schedule || !schedule.weeks[activeWeekIndex]) return null;
    const week = schedule.weeks[activeWeekIndex];
    const dayOrder = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    for (const day of dayOrder) {
      const actualKey = Object.keys(week.days || {}).find(k => k.trim().toLowerCase().startsWith(day.toLowerCase().slice(0, 3)));
      if (!actualKey) continue;
      const topicsArr = week.days[actualKey] || [];
      const sorted = getSortedTopics(topicsArr);
      const incomplete = sorted.find(t => !isTopicDone(t));
      if (incomplete) {
        return { dayName: actualKey, title: incomplete.title };
      }
    }
    return null;
  }, [schedule, activeWeekIndex, matchedTopicsMap, topics]);

  // Get upcoming incomplete topics for study advancement
  const upcomingIncompleteTopics = useMemo(() => {
    if (!schedule) return [];
    const upcoming: { topic: StudyPlanTopic; weekIdx: number; dayName: string; originalIdx: number }[] = [];
    const dayOrder = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    const currentWeekIdx = activeWeekIndex;
    const currentDayName = activeDayTab;
    const currentDayOrderIdx = dayOrder.indexOf(currentDayName);

    for (let w = currentWeekIdx; w < schedule.weeks.length; w++) {
      const week = schedule.weeks[w];
      if (!week || !week.days) continue;

      // Determine which days of this week to check
      const daysToCheck = w === currentWeekIdx 
        ? dayOrder.slice(currentDayOrderIdx + 1) // Only future days of the active week
        : dayOrder; // All days of future weeks

      for (const day of daysToCheck) {
        const dayTopics = week.days[day];
        if (Array.isArray(dayTopics)) {
          for (let idx = 0; idx < dayTopics.length; idx++) {
            const topic = dayTopics[idx];
            if (!isTopicDone(topic)) {
              upcoming.push({
                topic,
                weekIdx: w,
                dayName: day,
                originalIdx: idx
              });
              if (upcoming.length >= 3) break;
            }
          }
        }
        if (upcoming.length >= 3) break;
      }

      if (upcoming.length >= 3) break;
    }

    return upcoming;
  }, [schedule, activeWeekIndex, activeDayTab, matchedTopicsMap, topics]);

  // Handle advancing an upcoming topic to the current study day
  const handleAdvanceTopicToToday = async (
    targetTopic: StudyPlanTopic,
    fromWeekIdx: number,
    fromDayName: string,
    fromTopicIdx: number
  ) => {
    if (!schedule) return;
    try {
      const updatedWeeks = [...schedule.weeks];

      // Remove from original future day
      const futureDayTopics = updatedWeeks[fromWeekIdx].days[fromDayName];
      futureDayTopics.splice(fromTopicIdx, 1);

      // Add to current active day
      const currentDayName = activeDayTab;
      const currentWeekIdx = activeWeekIndex;

      if (!updatedWeeks[currentWeekIdx].days[currentDayName]) {
        updatedWeeks[currentWeekIdx].days[currentDayName] = [];
      }

      const advancedTopic: StudyPlanTopic = {
        ...targetTopic,
        isPriority: true, // mark as priority
      };

      updatedWeeks[currentWeekIdx].days[currentDayName].push(advancedTopic);

      // Save to Firebase
      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      // Update local state
      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });

      showToast(`O tema "${targetTopic.title}" foi adiantado para hoje com sucesso!`, "success");
    } catch (err) {
      console.error("Error advancing topic:", err);
      showToast("Erro ao adiantar o tema de estudos.", "error");
    }
  };

  const handleExtendFutureRevisions = async () => {
    if (!schedule || !schedule.weeks || schedule.weeks.length === 0) return;
    try {
      const updatedWeeks = extendScheduleWithScientificRevisions(
        schedule.weeks,
        4,
        schedule.studyDays || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
        schedule.hoursPerDay || 4
      );

      if (user?.uid && db && schedule.id) {
        const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
        await updateDoc(scheduleRef, {
          weeks: updatedWeeks
        });
      }

      const updatedSchedule = {
        ...schedule,
        weeks: updatedWeeks
      };

      setSchedule(updatedSchedule);
      safeLocalStorageSet(`medinternato_schedule_${user?.uid || 'guest'}`, JSON.stringify(updatedSchedule));
      showToast(`Cronograma estendido! Foram adicionadas +4 semanas contendo todas as revisões científicas Ebbinghaus (R2/R3). Total: ${updatedWeeks.length} semanas.`, "success");
    } catch (err) {
      console.error("Error extending revisions:", err);
      showToast("Erro ao estender revisões futuras.", "error");
    }
  };

  const handleJumpToToday = () => {
    if (!schedule) return;
    const target = getTodayWeekAndDay(schedule);
    setActiveWeekIndex(target.weekIndex);
    setActiveDayTab(target.dayTab);
    const targetMonth = Math.floor(target.weekIndex / 4) + 1;
    setActiveMonthFilter(Math.min(totalMonths, targetMonth));
    showToast(`Redirecionado para hoje: Semana ${target.weekIndex + 1} (${target.dayTab})`, "info");
  };

  // Delay catch-up / restructuring modal states
  const [showRestructureModal, setShowRestructureModal] = useState(false);
  const [restructureMode, setRestructureMode] = useState<'postpone' | 'prioritize' | 'add_day'>('postpone');
  const [restructureDays, setRestructureDays] = useState<number>(5); // default to 5 study days
  const [restructureSaving, setRestructureSaving] = useState(false);

  const uncompletedBacklogList = useMemo(() => {
    if (!schedule) return [];
    const backlog: StudyPlanTopic[] = [];
    const currentDayIdx = getDayIndexInOrder(activeDayTab);

    schedule.weeks.forEach((week, wIdx) => {
      const isPastWeek = wIdx < activeWeekIndex;
      const isCurrentWeek = wIdx === activeWeekIndex;

      if (isPastWeek || isCurrentWeek) {
        Object.entries(week.days || {}).forEach(([dayName, topicsArr]) => {
          const dayIdxInWeek = getDayIndexInOrder(dayName);
          const isPastDayInCurrentWeek = isCurrentWeek && currentDayIdx !== -1 && dayIdxInWeek !== -1 && dayIdxInWeek < currentDayIdx;

          if ((isPastWeek || isPastDayInCurrentWeek) && Array.isArray(topicsArr)) {
            topicsArr.forEach(t => {
              if (t && t.title) {
                // EXCLUDE REVISIONS - Backlog is strictly scoped to primary study plan topics
                if (isRevisionTopic(t)) return;

                const done = isTopicDone(t);
                if (!done) {
                  backlog.push({
                    ...t,
                    isCompleted: false,
                    isPriority: true
                  });
                }
              }
            });
          }
        });
      }
    });
    return backlog;
  }, [schedule, activeWeekIndex, activeDayTab, topics, matchedTopicsMap]);

  const getRestructurePreview = () => {
    if (!schedule) return [];
    
    const activeStudyDays = schedule.studyDays && schedule.studyDays.length > 0
      ? schedule.studyDays
      : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

    let startIdx = activeStudyDays.findIndex(d => getDayIndexInOrder(d) === getDayIndexInOrder(activeDayTab));
    if (startIdx < 0) {
      const activeChronologicalIdx = getDayIndexInOrder(activeDayTab);
      const upcomingStudyDays = activeStudyDays
        .map(d => ({ name: d, idx: getDayIndexInOrder(d) }))
        .sort((a, b) => a.idx - b.idx);
      
      const nextStudyDay = upcomingStudyDays.find(d => d.idx >= activeChronologicalIdx) || upcomingStudyDays[0];
      startIdx = activeStudyDays.indexOf(nextStudyDay?.name || activeStudyDays[0]);
    }

    let tempDayPos = startIdx < 0 ? 0 : startIdx;
    const targetDaysCount = Math.max(1, restructureDays);
    
    const distribution: { dayName: string; count: number }[] = [];
    for (let i = 0; i < targetDaysCount; i++) {
      if (tempDayPos < 0 || tempDayPos >= activeStudyDays.length) {
        tempDayPos = 0;
      }
      const dayName = activeStudyDays[tempDayPos];
      distribution.push({ dayName, count: 0 });
      tempDayPos++;
    }

    if (uncompletedBacklogList.length > 0) {
      uncompletedBacklogList.forEach((_, index) => {
        const targetIdx = index % distribution.length;
        distribution[targetIdx].count++;
      });
    }

    return distribution;
  };

  // Load existing schedules with real-time sync across devices
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'users', user.uid, 'schedules')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      try {
        const fetchedSchedules: StudySchedule[] = [];
        snap.forEach(doc => {
          fetchedSchedules.push({ id: doc.id, ...doc.data() } as StudySchedule);
        });

        // Sort schedules by creation date descending (newest first)
        fetchedSchedules.sort((a, b) => {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        setSchedules(fetchedSchedules);

        if (fetchedSchedules.length > 0) {
          const savedActiveId = localStorage.getItem('active_schedule_id');

          setSchedule(prevSchedule => {
            const currentActiveId = prevSchedule?.id || savedActiveId;
            const found = fetchedSchedules.find(s => s.id === currentActiveId) || fetchedSchedules[0];
            if (found && (found as any).startDate) {
              setSyncStartDate((found as any).startDate);
            }
            if (found) {
              localStorage.setItem('active_schedule_id', found.id);
              if (!prevSchedule) {
                const todayTarget = getTodayWeekAndDay(found);
                setActiveWeekIndex(todayTarget.weekIndex);
                setActiveDayTab(todayTarget.dayTab);
                setActiveMonthFilter(Math.min(12, Math.floor(todayTarget.weekIndex / 4) + 1));
              }
            }
            return found || null;
          });

          setActiveTab(prev => (prev === 'config' && fetchedSchedules.length > 0) ? 'plan' : prev);
        } else {
          setSchedule(null);
          setActiveTab('config');
        }
      } catch (e) {
        console.error("Erro ao sincronizar cronogramas em tempo real:", e);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Erro no listener de cronogramas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSwitchSchedule = (scheduleId: string) => {
    const found = schedules.find(s => s.id === scheduleId);
    if (found) {
      setSchedule(found);
      if ((found as any).startDate) {
        setSyncStartDate((found as any).startDate);
      }
      localStorage.setItem('active_schedule_id', found.id);
      setActiveWeekIndex(0);
      if (found.weeks[0]?.days) {
        const orderedDays = getOrderedDaysForWeek(found.studyDays, (found as any).startDate);
        const firstDayName = orderedDays[0] || Object.keys(found.weeks[0].days)[0];
        if (firstDayName) setActiveDayTab(firstDayName);
      }
      setActiveMonthFilter(1);
      setActiveTab('plan');
      showToast(`Alternou para o cronograma: ${found.exam}`, 'info');
    }
  };

  // Adjust Month Filter when activeWeekIndex changes
  useEffect(() => {
    if (schedule) {
      const monthOfActiveWeek = Math.floor(activeWeekIndex / 4) + 1;
      setActiveMonthFilter(monthOfActiveWeek);
    }
  }, [activeWeekIndex, schedule]);

  const handleDayToggle = (day: string) => {
    if (studyDays.includes(day)) {
      setStudyDays(studyDays.filter(d => d !== day));
    } else {
      setStudyDays([...studyDays, day]);
    }
  };

  const getWeekdays = () => ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Cost calculation
  const getCost = () => {
    if (modality === '6meses') return 5;
    if (modality === '1ano') return 8;
    if (modality === '2anos') return 10;
    if (modality === 'dynamic') {
      const weeks = calculateWeeksToDate(examDate);
      if (weeks <= 24) return 5;
      if (weeks <= 48) return 8;
      return 10;
    }
    return 5;
  };

  const getCostLabel = (m: '6meses' | '1ano' | '2anos' | 'dynamic') => {
    if (m === '6meses') return '5 créditos';
    if (m === '1ano') return '8 créditos';
    if (m === '2anos') return '10 créditos';
    if (m === 'dynamic') {
      const weeks = calculateWeeksToDate(examDate);
      if (weeks <= 24) return '5 créditos';
      if (weeks <= 48) return '8 créditos';
      return '10 créditos';
    }
    return '';
  };

  const selectedExam = MEDICAL_EXAMS_DB.find(e => e.id === selectedExamId) || MEDICAL_EXAMS_DB[0];

  // Helper to generate the structured medical schedule dynamically
  const handleGenerateSchedule = async () => {
    const isCompletePlan = profile?.planType === 'combo_ouro' || 
                            profile?.isLifetimePremium || 
                            profile?.role === 'admin' || 
                            profile?.email === 'lucas1renck2melo@gmail.com';
    const maxSchedules = isCompletePlan ? 2 : 1;
    if (schedules.length >= maxSchedules) {
      if (maxSchedules === 1) {
        showToast("Limite de 1 cronograma ativo atingido. Assine o Plano Completo (Combo Ouro) para conseguir manter até 2 cronogramas ativos, ou apague o atual para criar um novo.", "error");
      } else {
        showToast("Você já atingiu o limite de 2 cronogramas ativos no plano completo. Apague um dos cronogramas para gerar um novo.", "error");
      }
      return;
    }

    if (modality === 'dynamic' && !examDate) {
      showToast("Por favor, selecione a data da sua prova para o cronograma personalizado.", "error");
      return;
    }

    const cost = getCost();
    if (availableCredits < cost) {
      showToast(`Créditos insuficientes! Você precisa de ${cost} créditos, mas possui apenas ${availableCredits}.`, 'error');
      return;
    }

    try {
      setGenerating(true);
      
      // Deduct credit usage
      await recordUsage(cost);
      setAvailableCredits(prev => Math.max(0, prev - cost));

      const examData = MEDICAL_EXAMS_DB.find(e => e.id === selectedExamId) || MEDICAL_EXAMS_DB[0];
      const generatedWeeks = generatePlan(selectedExamId, modality, studyDays, hoursPerDay, currentSemesterSubjects, examDate, syncStartDate, onlyCurrentSemester);

      // Map generated weeks to pre-mark topics already completed in database
      const mappedWeeks = generatedWeeks.map(w => {
        const updatedDays = { ...w.days };
        Object.keys(updatedDays).forEach(day => {
          updatedDays[day] = updatedDays[day].map(t => {
            const titleStr = t?.title || '';
            const canonicalTitle = t?.type === 'revisao' && titleStr.startsWith('Revisão Ativa + Flashcards: ')
              ? titleStr.replace('Revisão Ativa + Flashcards: ', '')
              : titleStr;
            const found = findMatchingTopic(canonicalTitle, topics);
            const hasRecordedStudy = found ? !!(
              found.completed === true ||
              (typeof found.repetitions === 'number' && found.repetitions > 0) ||
              (found.lastReviewDate && typeof found.lastReviewDate === 'string' && found.lastReviewDate.trim().length > 0)
            ) : false;

            const done = t?.type === 'revisao'
              ? (found ? (typeof found.repetitions === 'number' && found.repetitions >= 2) : false)
              : hasRecordedStudy;

            return {
              ...t,
              isCompleted: done,
              isPreCompleted: done
            };
          });
        });
        return {
          ...w,
          days: updatedDays
        };
      });

      let totalTopicsCount = 0;
      let completedCount = 0;
      mappedWeeks.forEach(w => {
        Object.values(w.days).forEach(arr => {
          arr.forEach(t => {
            totalTopicsCount++;
            if (t.isCompleted) completedCount++;
          });
        });
      });
      const initialProgress = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0;
      const initialCoverage = calculateCoverage(mappedWeeks, selectedExamId);

      const newSchedule: Omit<StudySchedule, 'id'> & { startDate?: string } = {
        exam: examData.name,
        modality,
        studyDays,
        hoursPerDay,
        weeks: mappedWeeks,
        createdAt: new Date().toISOString(),
        startDate: syncStartDate,
        progress: initialProgress,
        coveragePercentage: initialCoverage,
        currentSemesterSubjects,
        examDate: modality === 'dynamic' ? examDate : null
      };

      // Instead of storing in Firestore directly, open Preview mode!
      const created: StudySchedule = { id: 'preview_temp', ...newSchedule } as StudySchedule;
      setPreviewSchedule(created);
      setPreviewWeeksCount(created.weeks.length);
      setPreviewWeeklyMock(true);
      setPreviewMonthlyMock(true);
      setPreviewQuarterlyMock(false);
      setPreviewSemiAnnualMock(false);
      setPreviewAnnualMock(false);
      
      showToast("Rascunho de cronograma inteligente gerado! Revise e ative no painel.", "success");

    } catch (e) {
      console.error("Erro ao gerar cronograma:", e);
      showToast("Houve um erro técnico ao gerar o cronograma. Tente novamente.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleWizardGenerateSchedule = async (config: {
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
  }) => {
    try {
      setGenerating(true);
      let mappedWeeks: StudyPlanWeek[] = [];
      let examName = 'Planejamento da Faculdade';

      if (config.planType === 'college_only') {
        const res = generateCollegeCustomPlan(
          config.collegeCustomTopics,
          config.studyDays,
          config.hoursPerDay,
          config.startDate,
          config.weeksDuration,
          config.revisionStrategy,
          config.examDate
        );
        mappedWeeks = res.weeks;
        examName = 'Conteúdo da Faculdade';
      } else {
        const examData = MEDICAL_EXAMS_DB.find(e => e.id === config.selectedExamId) || MEDICAL_EXAMS_DB[0];
        examName = examData.name;
        mappedWeeks = generatePlan(
          config.selectedExamId,
          (config.modality === 'college_custom' ? 'dynamic' : config.modality) as any,
          config.studyDays,
          config.hoursPerDay,
          config.currentSemesterSubjects,
          config.examDate,
          config.startDate,
          config.onlyCurrentSemester
        );
      }

      mappedWeeks = mappedWeeks.map(w => {
        const updatedDays = { ...w.days };
        Object.keys(updatedDays).forEach(day => {
          updatedDays[day] = updatedDays[day].map(t => {
            const titleStr = t?.title || '';
            const canonicalTitle = t?.type === 'revisao' && titleStr.startsWith('Revisão Ativa + Flashcards: ')
              ? titleStr.replace('Revisão Ativa + Flashcards: ', '')
              : titleStr;
            const found = findMatchingTopic(canonicalTitle, topics);
            const hasRecordedStudy = found ? !!(
              found.completed === true ||
              (typeof found.repetitions === 'number' && found.repetitions > 0) ||
              (found.lastReviewDate && typeof found.lastReviewDate === 'string' && found.lastReviewDate.trim().length > 0)
            ) : false;

            const done = t?.type === 'revisao'
              ? (found ? (typeof found.repetitions === 'number' && found.repetitions >= 2) : false)
              : hasRecordedStudy;

            return {
              ...t,
              isCompleted: done,
              isPreCompleted: done
            };
          });
        });
        return {
          ...w,
          days: updatedDays
        };
      });

      let totalTopicsCount = 0;
      let completedCount = 0;
      mappedWeeks.forEach(w => {
        Object.values(w.days).forEach(arr => {
          arr.forEach(t => {
            totalTopicsCount++;
            if (t.isCompleted) completedCount++;
          });
        });
      });
      const initialProgress = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0;
      const initialCoverage = calculateCoverage(mappedWeeks, config.selectedExamId || 'ebserh');

      const newSchedule: Omit<StudySchedule, 'id'> & { startDate?: string; collegeSelectedTopics?: string[] } = {
        exam: examName,
        modality: config.modality,
        studyDays: config.studyDays,
        hoursPerDay: config.hoursPerDay,
        weeks: mappedWeeks,
        createdAt: new Date().toISOString(),
        startDate: config.startDate,
        progress: initialProgress,
        coveragePercentage: initialCoverage,
        currentSemesterSubjects: config.currentSemesterSubjects,
        collegeSelectedTopics: config.collegeCustomTopics,
        examDate: config.examDate || null
      };

      const created: StudySchedule = { id: 'preview_temp', ...newSchedule } as StudySchedule;
      setPreviewSchedule(created);
      setPreviewWeeksCount(created.weeks.length);
      setShowPlannerWizard(false);
      setActiveTab('plan');
      showToast("Planejamento personalizado gerado com sucesso! Confirme a ativação.", "success");

    } catch (e) {
      console.error("Erro ao gerar cronograma via assistente:", e);
      showToast("Erro ao gerar planejamento. Tente novamente.", "error");
    } finally {
      setGenerating(false);
    }
  };

  // Helper to ensure a schedule topic exists in MedRevise topics & subjects
  const ensureTopicInMedRevise = async (
    rawTitle: string,
    subjectNameHint: string = 'Geral',
    manualTopicId?: string
  ) => {
    if (!user) return null;

    const cleanTitle = (rawTitle || '')
      .replace(/^Revisão Ativa \+ Flashcards: /, '')
      .replace(/^⚡ \[QUESTÕES AVANÇADAS\] /, '')
      .replace(/^🔄 \[REVISÃO DE REFORÇO\] /, '')
      .trim();

    if (!cleanTitle) return null;

    // 1. Check in-memory topics first
    let found = findMatchingTopic(cleanTitle, topics || [], manualTopicId);
    if (found) return found;

    // 2. Query Firestore by ID or exact clean title
    try {
      if (manualTopicId && typeof manualTopicId === 'string' && !manualTopicId.startsWith('local_')) {
        const snap = await getDoc(doc(db, 'users', user.uid, 'topics', manualTopicId));
        if (snap.exists()) {
          const tData = { id: snap.id, ...snap.data() };
          if (setTopics) setTopics(prev => prev.some(x => x.id === tData.id) ? prev : [...prev, tData]);
          return tData;
        }
      }

      const qTitle = query(collection(db, 'users', user.uid, 'topics'), where('title', '==', cleanTitle), limit(1));
      const snapTitle = await getDocs(qTitle);
      if (!snapTitle.empty) {
        const tData = { id: snapTitle.docs[0].id, ...snapTitle.docs[0].data() };
        if (setTopics) setTopics(prev => prev.some(x => x.id === tData.id) ? prev : [...prev, tData]);
        return tData;
      }
    } catch (err) {
      console.warn("Notice: lookup topic in Firestore:", err);
    }

    // 3. Find or create Subject in MedRevise
    const targetSubjectName = subjectNameHint || 'Geral';
    let foundSubject = (subjects || []).find(
      s => s.name?.toLowerCase().trim() === targetSubjectName.toLowerCase().trim()
    );

    if (!foundSubject) {
      try {
        const subjectsRef = collection(db, 'users', user.uid, 'subjects');
        const newSubjRef = await addDoc(subjectsRef, {
          name: targetSubjectName,
          semesterId: 'cronograma_sem',
          icon: 'BookOpen',
          color: 'bg-blue-100 text-[#0066cc]',
          createdAt: new Date().toISOString()
        });
        foundSubject = {
          id: newSubjRef.id,
          name: targetSubjectName,
          semesterId: 'cronograma_sem',
          icon: 'BookOpen',
          color: 'bg-blue-100 text-[#0066cc]'
        };
        if (setSubjects) setSubjects(prev => [...prev, foundSubject]);
      } catch (err) {
        console.warn("Notice creating subject in Firestore:", err);
        foundSubject = { id: 'cronograma_subj', name: targetSubjectName };
      }
    }

    // 4. Create Topic document in MedRevise users/{uid}/topics
    try {
      const topicsRef = collection(db, 'users', user.uid, 'topics');
      const newTopicRef = await addDoc(topicsRef, {
        title: cleanTitle,
        name: cleanTitle,
        subjectId: foundSubject.id,
        semesterId: 'cronograma_sem',
        references: "",
        historicalIncidence: 15,
        importanceDegree: 'medio',
        completed: false,
        createdAt: new Date().toISOString()
      });

      const createdTopic = {
        id: newTopicRef.id,
        title: cleanTitle,
        name: cleanTitle,
        subjectId: foundSubject.id,
        semesterId: 'cronograma_sem',
        references: "",
        historicalIncidence: 15,
        importanceDegree: 'medio',
        completed: false
      };

      if (setTopics) setTopics(prev => [...prev, createdTopic]);
      return createdTopic;
    } catch (err) {
      console.error("Error creating topic in MedRevise:", err);
      return null;
    }
  };

  // Toggle completion of a specific topic in a specific day of a specific week
  const handleToggleTopic = async (weekIdx: number, dayName: string, topicIdx: number) => {
    if (!schedule) return;

    try {
      const updatedWeeks = [...schedule.weeks];
      const targetTopic = updatedWeeks[weekIdx].days[dayName][topicIdx];
      targetTopic.isCompleted = !targetTopic.isCompleted;

      // Recalculate total progress
      let totalTopicsCount = 0;
      let completedCount = 0;
      updatedWeeks.forEach(w => {
        Object.values(w.days).forEach(arr => {
          arr.forEach(t => {
            totalTopicsCount++;
            if (isTopicDone(t)) completedCount++;
          });
        });
      });
      const progress = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0;

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);

      // Check if user wants automatic sync to MedRevise or MedInternato only
      if (medReviseSyncMode === 'internato_only') {
        const canonicalTitle = targetTopic.type === 'revisao' && targetTopic.title.startsWith('Revisão Ativa + Flashcards: ')
          ? targetTopic.title.replace('Revisão Ativa + Flashcards: ', '')
          : targetTopic.title;

        showToast(
          `Tópico "${canonicalTitle}" ${targetTopic.isCompleted ? 'concluído' : 'desmarcado'} no cronograma (Modo Apenas MedInternato).`,
          "info"
        );
      } else {
        // SYNC TO MEDREVISE (topics & studySessions collections)
        const canonicalTitle = targetTopic.type === 'revisao' && targetTopic.title.startsWith('Revisão Ativa + Flashcards: ')
          ? targetTopic.title.replace('Revisão Ativa + Flashcards: ', '')
          : targetTopic.title;

        let foundTopic = await ensureTopicInMedRevise(
          canonicalTitle,
          targetTopic.subjectName || 'Geral',
          targetTopic.topicId
        );

        if (foundTopic) {
          // Guarantee topicId is linked in the schedule topic
          targetTopic.topicId = foundTopic.id;

          if (targetTopic.isCompleted) {
            // Calculate realistic estimated time for this topic session
            const dayTopics = updatedWeeks[weekIdx]?.days[dayName] || [];
            const dayTopicsCount = dayTopics.length || 3;
            const totalDayMinutes = (schedule.hoursPerDay || 4) * 60;
            const realisticMinutes = Math.max(15, Math.min(45, Math.round(totalDayMinutes / Math.max(1, dayTopicsCount))));

            // Register study session in MedRevise database
            await addDoc(collection(db, 'users', user.uid, 'studySessions'), {
              topicId: foundTopic.id,
              subjectId: foundTopic.subjectId,
              date: new Date().toISOString(),
              questionsCount: 0,
              correctCount: 0,
              studyTimeMinutes: realisticMinutes,
              description: targetTopic.type === 'revisao'
                ? 'Revisão concluída via Cronograma Inteligente (MedInternato)'
                : 'Estudo concluído via Cronograma Inteligente (MedInternato)'
            });

            // Set topic SM-2 parameters for scheduled reviews
            const currentReps = typeof foundTopic.repetitions === 'number' ? foundTopic.repetitions : 0;
            const nextReps = targetTopic.type === 'revisao' ? Math.max(2, currentReps + 1) : Math.max(1, currentReps + 1);

            await updateDoc(doc(db, 'users', user.uid, 'topics', foundTopic.id), {
              repetitions: nextReps,
              interval: 1,
              easinessFactor: 2.5,
              lastReviewDate: new Date().toISOString(),
              nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              completed: true
            });

            showToast(`Tópico "${canonicalTitle}" concluído e sincronizado ao MedRevise (+${realisticMinutes} min).`, "success");
          } else {
            // Unmark topic
            if (targetTopic.isPreCompleted) {
              // Preserves previous records! Just clear the flag now that it has been manually unmarked
              targetTopic.isPreCompleted = false;
              showToast('Tópico desmarcado no cronograma. O seu registro de estudo anterior ao planejamento foi preservado.', 'success');
            } else {
              const currentReps = typeof foundTopic.repetitions === 'number' ? foundTopic.repetitions : 1;
              const newReps = targetTopic.type === 'revisao' ? Math.max(1, currentReps - 1) : 0;

              await updateDoc(doc(db, 'users', user.uid, 'topics', foundTopic.id), {
                completed: newReps > 0,
                repetitions: newReps
              });

              // Clean up auto-created study session from today when unmarking to avoid duplicate accumulation
              try {
                const todayStr = new Date().toISOString().split('T')[0];
                const sessSnap = await getDocs(
                  query(
                    collection(db, 'users', user.uid, 'studySessions'),
                    where('topicId', '==', foundTopic.id)
                  )
                );
                const cronoSess = sessSnap.docs.filter(d => {
                  const data = d.data();
                  return (data.date || '').startsWith(todayStr) && (data.description || '').includes('via Cronograma Inteligente');
                });
                for (const docToDelete of cronoSess) {
                  await deleteDoc(doc(db, 'users', user.uid, 'studySessions', docToDelete.id));
                }
              } catch (delErr) {
                console.warn('Notice removing study session on topic unmark:', delErr);
              }

              showToast('Tópico desmarcado. A sessão de estudo de hoje foi removida do histórico.', 'info');
            }
          }
        }
      }

      await updateDoc(scheduleRef, {
        weeks: updatedWeeks,
        progress
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks,
        progress
      });

      // SYNC COMPLETION TO CALENDAR EVENTS IN FIRESTORE
      try {
        const calColRef = collection(db, 'users', user.uid, 'calendarEvents');
        const calSnap = await getDocs(calColRef);
        const targetCleanTitle = targetTopic.title.toLowerCase().trim();

        const updatePromises = calSnap.docs
          .filter(docSnap => {
            const data = docSnap.data();
            const cronoTitle = (data.cronogramaTopicTitle || '').toLowerCase().trim();
            const evtTitle = (data.title || '').toLowerCase().trim();
            return cronoTitle === targetCleanTitle || evtTitle.includes(targetCleanTitle) || targetCleanTitle.includes(cronoTitle);
          })
          .map(docSnap => updateDoc(doc(db, 'users', user.uid, 'calendarEvents', docSnap.id), {
            completed: targetTopic.isCompleted
          }));

        await Promise.all(updatePromises);
      } catch (calSyncErr) {
        console.warn('Notice syncing topic completion to calendar events:', calSyncErr);
      }

    } catch (e) {
      console.error("Erro ao atualizar progresso do tópico:", e);
    }
  };

  // Toggle sub-reviews (24h, 7d, 30d)
  const handleToggleReview = async (weekIdx: number, dayName: string, topicIdx: number, type: '24h' | '7d' | '30d') => {
    if (!schedule) return;

    try {
      const updatedWeeks = [...schedule.weeks];
      const targetTopic = updatedWeeks[weekIdx].days[dayName][topicIdx];
      
      if (type === '24h') targetTopic.review24h = !targetTopic.review24h;
      if (type === '7d') targetTopic.review7d = !targetTopic.review7d;
      if (type === '30d') targetTopic.review30d = !targetTopic.review30d;

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });
    } catch (e) {
      console.error("Erro ao atualizar revisão:", e);
    }
  };

  // Link/bind a scheduled study plan topic to a MedRevise topic manually
  const handleLinkTopic = async (weekIdx: number, dayName: string, topicIdx: number, linkedTopicId: string | null) => {
    if (!schedule) return;

    try {
      const updatedWeeks = [...schedule.weeks];
      const targetTopic = updatedWeeks[weekIdx].days[dayName][topicIdx];
      
      // Update topicId with the linked topic's id or delete if null
      if (linkedTopicId) {
        targetTopic.topicId = linkedTopicId;
      } else {
        delete targetTopic.topicId;
      }

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });
      
      showToast(linkedTopicId ? "Tópico vinculado com sucesso!" : "Vínculo removido com sucesso!", "success");
      setLinkingTopic(null);
    } catch (e) {
      console.error("Erro ao vincular tópico:", e);
      showToast("Erro ao salvar vínculo do tópico.", "error");
    }
  };

  // Toggle weekly mock exam completion & record percentage score
  const handleToggleMockExam = async (weekIdx: number, completed: boolean, scoreValue?: number) => {
    if (!schedule) return;

    try {
      const updatedWeeks = [...schedule.weeks];
      const mock = updatedWeeks[weekIdx].mockExam;
      if (mock) {
        mock.isCompleted = completed;
        if (scoreValue !== undefined) {
          mock.score = scoreValue;
        }
      }

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });

      // SYNC COMPLETION TO CALENDAR EVENTS IN FIRESTORE
      if (mock) {
        try {
          const calColRef = collection(db, 'users', user.uid, 'calendarEvents');
          const calSnap = await getDocs(calColRef);
          const targetTitleClean = mock.title.toLowerCase().trim();

          const updatePromises = calSnap.docs
            .filter(docSnap => {
              const data = docSnap.data();
              const cronoTitle = (data.cronogramaTopicTitle || '').toLowerCase().trim();
              const evtTitle = (data.title || '').toLowerCase().trim();
              return cronoTitle === targetTitleClean || evtTitle.includes(targetTitleClean);
            })
            .map(docSnap => updateDoc(doc(db, 'users', user.uid, 'calendarEvents', docSnap.id), {
              completed: completed
            }));

          await Promise.all(updatePromises);
        } catch (calSyncErr) {
          console.warn('Notice syncing mock exam completion to calendar:', calSyncErr);
        }
      }
    } catch (e) {
      console.error("Erro ao atualizar simulado:", e);
    }
  };

  // Helper to find the manually linked topic ID for a title in a given week
  const findLinkedTopicIdForTitle = (titleToFind: string, weekIndex: number): string | undefined => {
    if (!schedule) return undefined;
    const week = schedule.weeks[weekIndex];
    if (!week) return undefined;
    let foundId: string | undefined = undefined;
    Object.values(week.days || {}).forEach(topicsArr => {
      if (Array.isArray(topicsArr)) {
        topicsArr.forEach(t => {
          if (t && typeof t.title === 'string') {
            const clean = t.title
              .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
              .replace('🔄 [REVISÃO DE REFORÇO] ', '')
              .replace(/^Revisão Ativa \+ Flashcards: /, '')
              .trim();
            if (clean === titleToFind && t.topicId) {
              foundId = t.topicId;
            }
          }
        });
      }
    });
    return foundId;
  };

  // Helper to extract study plan topics of a given week
  const getWeekTopics = (weekIdx: number): string[] => {
    if (!schedule) return [];
    const week = schedule.weeks[weekIdx];
    if (!week) return [];
    const list: string[] = [];
    Object.values(week.days || {}).forEach(topicsArr => {
      if (Array.isArray(topicsArr)) {
        topicsArr.forEach(t => {
          if (t && typeof t.title === 'string' && t.type === 'estudo') {
            const clean = t.title
              .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
              .replace('🔄 [REVISÃO DE REFORÇO] ', '')
              .replace(/^Revisão Ativa \+ Flashcards: /, '')
              .trim();
            if (clean && !list.includes(clean)) {
              list.push(clean);
            }
          }
        });
      }
    });
    return list;
  };

  // Helper to extract cumulative study plan topics from week 0 up to given weekIdx (ensures no future unstudied topics, and includes all past remaining topics)
  const getMonthTopics = (weekIdx: number): string[] => {
    if (!schedule) return [];
    const list: string[] = [];
    for (let w = 0; w <= weekIdx; w++) {
      const week = schedule.weeks[w];
      if (week) {
        Object.values(week.days || {}).forEach(topicsArr => {
          if (Array.isArray(topicsArr)) {
            topicsArr.forEach(t => {
              if (t && typeof t.title === 'string' && t.type === 'estudo') {
                const clean = t.title
                  .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
                  .replace('🔄 [REVISÃO DE REFORÇO] ', '')
                  .replace(/^Revisão Ativa \+ Flashcards: /, '')
                  .trim();
                if (clean && !list.includes(clean)) {
                  list.push(clean);
                }
              }
            });
          }
        });
      }
    }
    return list;
  };

  // Toggle monthly mock exam completion & record percentage score
  const handleToggleMonthlyMockExam = async (weekIdx: number, completed: boolean, scoreValue?: number) => {
    if (!schedule) return;

    try {
      const updatedWeeks = [...schedule.weeks];
      if (!updatedWeeks[weekIdx].monthlyMockExam) {
        updatedWeeks[weekIdx].monthlyMockExam = {
          title: `Simulado de Consolidação Mensal - Mês ${Math.floor(weekIdx / 4) + 1}`,
          questionsCount: 100,
          isCompleted: false
        };
      }
      
      const mMock = updatedWeeks[weekIdx].monthlyMockExam;
      if (mMock) {
        mMock.isCompleted = completed;
        if (scoreValue !== undefined) {
          mMock.score = scoreValue;
        }
      }

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });
    } catch (e) {
      console.error("Erro ao atualizar simulado mensal:", e);
    }
  };

  // Helper to resolve Firestore Topic IDs based on titles in database
  const getTopicIdsByTitles = (titles: string[], weekIdx?: number): string[] => {
    const ids: string[] = [];
    titles.forEach(title => {
      const linkedId = weekIdx !== undefined ? findLinkedTopicIdForTitle(title, weekIdx) : undefined;
      const found = findMatchingTopic(title, topics, linkedId);
      if (found) {
        ids.push(found.id);
      }
    });
    return ids;
  };

  // Handle automatic prefilled launching of the mock exam quiz
  const handleLaunchMockExam = (weekIdx: number, isMonthly: boolean = false) => {
    if (!schedule) return;
    const week = schedule.weeks[weekIdx];
    if (!week) return;

    const titles = isMonthly ? getMonthTopics(weekIdx) : getWeekTopics(weekIdx);
    const matchedIds = getTopicIdsByTitles(titles, isMonthly ? undefined : weekIdx);
    const count = isMonthly ? 100 : 50;

    if (matchedIds.length === 0) {
      showToast("Selecione as matérias e configure as questões no módulo de Questões para iniciar.", "info");
      setView('questions');
      return;
    }

    // Prefill the global states
    setCronogramaFilterTopics(matchedIds);
    setCronogramaQuestionsCount(count);
    setCronogramaMode('exam');

    // Switch view to questions module!
    setView('questions');
  };

  const handleSwapTopic = async (selectedTopicTitle: string) => {
    if (!schedule) return;
    try {
      const updatedWeeks = [...schedule.weeks];
      const targetTopic = updatedWeeks[swapWeekIdx].days[swapDayName][swapTopicIdx];
      
      let incidence = 15;
      let subjectName = targetTopic.subjectName;
      
      for (const [subj, list] of Object.entries(GLOBAL_RESIDENCY_TOPICS)) {
        const found = list.find(t => t.title === selectedTopicTitle);
        if (found) {
          incidence = found.incidence;
          subjectName = subj;
          break;
        }
      }
      
      updatedWeeks[swapWeekIdx].days[swapDayName][swapTopicIdx] = {
        ...targetTopic,
        title: selectedTopicTitle,
        subjectName: subjectName,
        historicalIncidence: incidence,
        importanceDegree: incidence >= 25 ? 'extremo' : incidence >= 22 ? 'alto' : incidence >= 18 ? 'medio' : 'baixo'
      };
      
      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });
      
      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });
      
      setShowSwapModal(false);
      showToast(`Tema substituído por "${selectedTopicTitle}" com sucesso!`, 'success');
    } catch (err) {
      console.error('Error swapping topic:', err);
      showToast('Erro ao substituir o tema.', 'error');
    }
  };

  const calculateWeeksToDate = (targetDateStr: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDateStr);
    target.setHours(0,0,0,0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 0;
    return Math.max(1, Math.ceil(diffDays / 7));
  };

  const handleSyncCollegeSchedule = async () => {
    if (!collegeExamDate) {
      showToast("Por favor, selecione a data da prova da faculdade.", "error");
      return;
    }
    if (selectedCollegeTopics.length === 0) {
      showToast("Por favor, selecione ao menos um tema da faculdade para priorizar.", "error");
      return;
    }
    if (!schedule) {
      showToast("Por favor, crie um cronograma base antes de importar os temas da faculdade.", "error");
      return;
    }

    try {
      setGenerating(true);
      
      const originalWeeks = schedule.weeks;
      const N = originalWeeks.length;
      const currentWeek = activeWeekIndex;
      const scheduleStudyDays = schedule.studyDays || studyDays || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
      const hoursPerDay = schedule.hoursPerDay || 4;

      const weeksUntilExamInput = calculateWeeksToDate(collegeExamDate);
      const remainingWeeksCount = N - currentWeek;
      
      if (weeksUntilExamInput < 1) {
        showToast("A data da prova deve ser no futuro.", "error");
        setGenerating(false);
        return;
      }

      const preExamWeeksCount = Math.max(1, Math.min(remainingWeeksCount, weeksUntilExamInput));

      // Separate studied weeks (keep them exactly as they are)
      const updatedWeeks: StudyPlanWeek[] = [];
      for (let w = 0; w < currentWeek; w++) {
        updatedWeeks.push(originalWeeks[w]);
      }

      // Gather study topics from future weeks to reorganize
      interface FlatStudyTopic {
        title: string;
        subjectName: string;
        incidence: number;
        importanceDegree: 'baixo' | 'medio' | 'alto' | 'extremo';
        isCompleted: boolean;
      }
      const remainingEstudoTopics: FlatStudyTopic[] = [];

      for (let wIdx = currentWeek; wIdx < N; wIdx++) {
        const week = originalWeeks[wIdx];
        if (week && week.days) {
          Object.values(week.days).forEach((dayTopics) => {
            if (Array.isArray(dayTopics)) {
              dayTopics.forEach((topic) => {
                if (topic && topic.type === 'estudo') {
                  const cleanT = (topic.title || '')
                    .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
                    .replace('🔄 [REVISÃO DE REFORÇO] ', '')
                    .trim();
                  remainingEstudoTopics.push({
                    title: cleanT,
                    subjectName: topic.subjectName,
                    incidence: topic.historicalIncidence || 15,
                    importanceDegree: topic.importanceDegree || 'medio',
                    isCompleted: !!topic.isCompleted
                  });
                }
              });
            }
          });
        }
      }

      // Categorize topics: College Exam Topics vs Others
      const collegeMatched: FlatStudyTopic[] = [];
      const other: FlatStudyTopic[] = [];

      remainingEstudoTopics.forEach((topic) => {
        const titleLower = (topic?.title || '').toLowerCase();
        const isMatched = selectedCollegeTopics.some(ct => {
          const ctLower = (ct || '').toLowerCase().trim();
          return titleLower === ctLower || titleLower.includes(ctLower) || ctLower.includes(titleLower);
        });

        if (isMatched) {
          collegeMatched.push(topic);
        } else {
          other.push(topic);
        }
      });

      // Distribute College topics into Pre-Exam Weeks, and Others in Post-Exam Weeks
      const hoursBasedTopicsPerDay = 
        hoursPerDay <= 2 ? 1 : 
        hoursPerDay <= 4 ? 2 : 
        hoursPerDay <= 6 ? 3 : 
        hoursPerDay <= 8 ? 4 : 5;

      const preExamDaysCount = preExamWeeksCount * scheduleStudyDays.length;
      const minTopicsPerDayPre = preExamDaysCount > 0 ? Math.ceil(collegeMatched.length / preExamDaysCount) : 1;
      const finalTopicsPerDayPre = Math.max(hoursBasedTopicsPerDay, minTopicsPerDayPre, 1);

      const preExamQueue = [...collegeMatched];
      const postExamQueue = [...other];

      // Fill remaining pre-exam slots with post-exam topics if we have extra space
      const totalPreExamSlots = preExamDaysCount * finalTopicsPerDayPre;
      if (preExamQueue.length < totalPreExamSlots && postExamQueue.length > 0) {
        const extraNeeded = totalPreExamSlots - preExamQueue.length;
        const toMove = postExamQueue.splice(0, extraNeeded);
        preExamQueue.push(...toMove);
      }

      // Calculate topics density for Post-Exam Weeks
      const postExamWeeksCount = remainingWeeksCount - preExamWeeksCount;
      const postExamDaysCount = postExamWeeksCount * scheduleStudyDays.length;
      let finalTopicsPerDayPost = hoursBasedTopicsPerDay;
      if (postExamWeeksCount > 0 && postExamDaysCount > 0) {
        const minTopicsPerDayPost = Math.ceil(postExamQueue.length / postExamDaysCount);
        finalTopicsPerDayPost = Math.max(1, minTopicsPerDayPost);
      }

      let prePointer = 0;
      let postPointer = 0;
      const scheduledTopicsLog: FlatStudyTopic[] = [];

      const getImportanceDegree = (incidence: number): 'baixo' | 'medio' | 'alto' | 'extremo' => {
        if (incidence >= 25) return 'extremo';
        if (incidence >= 22) return 'alto';
        if (incidence >= 18) return 'medio';
        return 'baixo';
      };

      // Loop to rebuild weeks starting from currentWeek
      for (let w = currentWeek + 1; w <= N; w++) {
        const isPreExamWeek = (w - 1) < (currentWeek + preExamWeeksCount);
        const daysMap: { [dayName: string]: StudyPlanTopic[] } = {};
        const topicsCount = isPreExamWeek ? finalTopicsPerDayPre : finalTopicsPerDayPost;

        scheduleStudyDays.forEach((day, dIdx) => {
          const dayTopics: StudyPlanTopic[] = [];

          for (let i = 0; i < topicsCount; i++) {
            let topicData: FlatStudyTopic | null = null;
            if (isPreExamWeek) {
              if (prePointer < preExamQueue.length) {
                topicData = preExamQueue[prePointer++];
              } else if (postPointer < postExamQueue.length) {
                topicData = postExamQueue[postPointer++];
              }
            } else {
              if (postPointer < postExamQueue.length) {
                topicData = postExamQueue[postPointer++];
              } else if (prePointer < preExamQueue.length) {
                topicData = preExamQueue[prePointer++];
              }
            }

            if (topicData) {
              dayTopics.push({
                title: topicData.title,
                subjectName: topicData.subjectName,
                historicalIncidence: topicData.incidence,
                isPriority: topicData.incidence >= 23 || selectedCollegeTopics.includes(topicData.title),
                isCompleted: topicData.isCompleted,
                review24h: false,
                review7d: false,
                review30d: false,
                type: 'estudo',
                importanceDegree: topicData.importanceDegree
              });
              scheduledTopicsLog.push(topicData);
            }
          }

          // Generate Revision session
          let revisionTopicData: FlatStudyTopic | null = null;
          if (scheduledTopicsLog.length > 3) {
            const lookbackIndex = Math.floor((w * 5 + dIdx * 23) % (scheduledTopicsLog.length - 1));
            revisionTopicData = scheduledTopicsLog[lookbackIndex];
          }
          if (!revisionTopicData && remainingEstudoTopics.length > 0) {
            revisionTopicData = remainingEstudoTopics[(w + dIdx) % remainingEstudoTopics.length];
          }

          if (revisionTopicData) {
            dayTopics.push({
              title: `Revisão Ativa + Flashcards: ${revisionTopicData.title}`,
              subjectName: revisionTopicData.subjectName,
              historicalIncidence: revisionTopicData.incidence,
              isPriority: selectedCollegeTopics.includes(revisionTopicData.title),
              isCompleted: revisionTopicData.isCompleted,
              review24h: false,
              review7d: false,
              review30d: false,
              type: 'revisao',
              importanceDegree: revisionTopicData.importanceDegree
            });
          }

          daysMap[day] = dayTopics;
        });

        // Setup mock exams
        let mockExam = originalWeeks[w - 1]?.mockExam;
        if (!mockExam) {
          const wTopics: string[] = [];
          Object.values(daysMap).forEach(arr => {
            if (Array.isArray(arr)) {
              arr.forEach((t: any) => {
                if (t && typeof t.title === 'string' && t.type === 'estudo') {
                  const clean = t.title
                    .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
                    .replace('🔄 [REVISÃO DE REFORÇO] ', '')
                    .replace(/^Revisão Ativa \+ Flashcards: /, '')
                    .trim();
                  if (clean && !wTopics.includes(clean)) wTopics.push(clean);
                }
              });
            }
          });
          mockExam = {
            title: `Simulado Semanal - Semana ${w} (${wTopics.length} Matérias da Semana)`,
            questionsCount: Math.min(60, Math.max(15, wTopics.length * 5)),
            isCompleted: false
          };
        }

        let monthlyMockExam = originalWeeks[w - 1]?.monthlyMockExam;
        const isLastWeekOfMonth = (w % 4 === 0) || (w === N);
        if (!monthlyMockExam && isLastWeekOfMonth) {
          const monthNum = Math.ceil(w / 4);
          const cumulativeSet = new Set<string>();

          updatedWeeks.forEach(prevW => {
            if (prevW && prevW.days) {
              Object.values(prevW.days || {}).forEach(arr => {
                if (Array.isArray(arr)) {
                  arr.forEach((t: any) => {
                    if (t && typeof t.title === 'string' && t.type === 'estudo') {
                      const clean = t.title
                        .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
                        .replace('🔄 [REVISÃO DE REFORÇO] ', '')
                        .replace(/^Revisão Ativa \+ Flashcards: /, '')
                        .trim();
                      if (clean) cumulativeSet.add(clean);
                    }
                  });
                }
              });
            }
          });

          Object.values(daysMap).forEach(arr => {
            if (Array.isArray(arr)) {
              arr.forEach((t: any) => {
                if (t && typeof t.title === 'string' && t.type === 'estudo') {
                  const clean = t.title
                    .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
                    .replace('🔄 [REVISÃO DE REFORÇO] ', '')
                    .replace(/^Revisão Ativa \+ Flashcards: /, '')
                    .trim();
                  if (clean) cumulativeSet.add(clean);
                }
              });
            }
          });

          const cumList = Array.from(cumulativeSet);
          monthlyMockExam = {
            title: `Simulado Mensal Cumulativo - Mês ${monthNum} (${cumList.length} Matérias Estudadas até Semana ${w})`,
            questionsCount: Math.min(100, Math.max(30, cumList.length * 3)),
            isCompleted: false
          };
        }

        updatedWeeks.push({
          weekNumber: w,
          priorityTitle: originalWeeks[w - 1]?.priorityTitle || 'Revisão e Consolidação',
          days: daysMap,
          mockExam,
          monthlyMockExam
        });
      }

      // Calculate new progress stats
      let totalTopicsCount = 0;
      let completedCount = 0;
      updatedWeeks.forEach(w => {
        if (w && w.days) {
          Object.values(w.days).forEach(arr => {
            if (Array.isArray(arr)) {
              arr.forEach(t => {
                totalTopicsCount++;
                if (t && isTopicDone(t)) completedCount++;
              });
            }
          });
        }
      });
      const initialProgress = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0;

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks,
        collegeExamDate: collegeExamDate,
        collegeSelectedTopics: selectedCollegeTopics,
        progress: initialProgress
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks,
        collegeExamDate: collegeExamDate,
        collegeSelectedTopics: selectedCollegeTopics,
        progress: initialProgress
      });

      setActiveTab('plan');
      showToast("Cronograma atualizado! Tópicos da faculdade antecipados de forma estratégica antes da prova.", "success");
    } catch (err) {
      console.error("Error updating schedule for college:", err);
      showToast("Erro ao sincronizar cronograma da faculdade.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleAiCollegeMatching = async () => {
    if (!collegeInputText.trim()) {
      showToast("Por favor, digite ou cole as matérias no campo de texto para a IA analisar.", "info");
      return;
    }

    if (availableCredits < 20) {
      showToast("Você não possui créditos suficientes. O mapeamento semântico com IA custa 20⚡.", "error");
      return;
    }

    try {
      setIsAiMatching(true);

      // Extract all unique canonical titles from GLOBAL_RESIDENCY_TOPICS
      const canonicalTitles: string[] = [];
      Object.values(GLOBAL_RESIDENCY_TOPICS).flat().forEach(t => {
        if (!canonicalTitles.includes(t.title)) {
          canonicalTitles.push(t.title);
        }
      });

      const { matchCollegeTopicsWithAI } = await import('../services/geminiService');
      const matched = await matchCollegeTopicsWithAI(collegeInputText, canonicalTitles, user.uid);

      if (matched && matched.length > 0) {
        const validMatched = matched.filter(t => canonicalTitles.includes(t));
        if (validMatched.length > 0) {
          setSelectedCollegeTopics(prev => Array.from(new Set([...prev, ...validMatched])));
          setAvailableCredits(prev => Math.max(0, prev - 20));
          showToast(`Mapeamento Inteligente concluído! A IA identificou e marcou ${validMatched.length} temas canônicos correspondentes.`, "success");
        } else {
          showToast("A IA analisou os temas, mas nenhum pôde ser associado diretamente à grade de residência médica.", "info");
        }
      } else {
        showToast("Nenhum tema correspondente foi retornado pela IA. Verifique as matérias inseridas.", "info");
      }
    } catch (error: any) {
      console.error("Error in AI mapping:", error);
      showToast("Erro ao realizar o mapeamento inteligente por IA.", "error");
    } finally {
      setIsAiMatching(false);
    }
  };

  const handleImportPdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const isCompletePlan = profile?.planType === 'combo_ouro' || 
                            profile?.isLifetimePremium || 
                            profile?.role === 'admin' || 
                            profile?.email === 'lucas1renck2melo@gmail.com';
    const maxSchedules = isCompletePlan ? 2 : 1;
    if (schedules.length >= maxSchedules) {
      if (maxSchedules === 1) {
        showToast("Limite de 1 cronograma ativo atingido. Assine o Plano Completo (Combo Ouro) para conseguir manter até 2 cronogramas ativos, ou apague o atual para criar um novo.", "error");
      } else {
        showToast("Você já atingiu o limite de 2 cronogramas ativos no plano completo. Apague um dos cronogramas para importar um novo.", "error");
      }
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      showToast("Por favor, selecione um arquivo PDF válido.", "error");
      return;
    }

    const cost = 25;
    if (availableCredits < cost) {
      showToast(`Créditos insuficientes! Você precisa de ${cost} créditos para analisar este PDF, mas possui apenas ${availableCredits}.`, 'error');
      return;
    }

    try {
      setPdfImporting(true);
      setPdfError('');
      setPdfProgress("Iniciando carregamento do PDF...");
      setPdfProgressPercent(2);
      // Deduct credits upfront immediately upon starting import process
      setAvailableCredits(prev => Math.max(0, prev - cost));
      showToast("Extraindo e analisando o conteúdo do seu PDF...", "info");

      // Extract plain text from PDF on client side first
      let contentToSend = "";
      try {
        const extractedText = await extractTextFromPdf(file, (msg, percent) => {
          setPdfProgress(msg);
          setPdfProgressPercent(percent);
        });
        if (extractedText && extractedText.trim().length > 100) {
          console.log(`[PDF Import] Texto extraído com sucesso (${extractedText.length} caracteres).`);
          contentToSend = extractedText;
        }
      } catch (extractErr) {
        console.warn("[PDF Import] Falha ao extrair texto puro, recorrendo a base64:", extractErr);
      }

      // If text extraction didn't yield text, convert to base64 fallback
      if (!contentToSend) {
        setPdfProgress("Carregando arquivo binário para conversão (Base64)...");
        setPdfProgressPercent(65);
        const base64Promise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            resolve(res.includes(',') ? res.split(',')[1] : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        contentToSend = await base64Promise;
      }

      const importedPlan = await importPdfSchedule(
        contentToSend, 
        file.type, 
        studyDays, 
        hoursPerDay,
        (msg, percent) => {
          setPdfProgress(msg);
          setPdfProgressPercent(percent);
        }
      );
      
      if (!importedPlan || !importedPlan.weeks || !Array.isArray(importedPlan.weeks)) {
        throw new Error("A estrutura de semanas retornada do PDF é inválida.");
      }

      // Default all topics from the imported PDF schedule as uncompleted (isCompleted: false)
      // so the student can verify and choose what to mark as studied in the Preview step
      const mappedWeeks = importedPlan.weeks.map((w: any) => {
        const updatedDays = { ...w.days };
        Object.keys(updatedDays).forEach(day => {
          if (Array.isArray(updatedDays[day])) {
            updatedDays[day] = updatedDays[day].map((t: any) => ({
              ...t,
              isCompleted: false
            }));
          } else {
            updatedDays[day] = [];
          }
        });
        return {
          ...w,
          days: updatedDays
        };
      });

          // Calculate initial progress
          let totalTopicsCount = 0;
          let completedCount = 0;
          mappedWeeks.forEach((w: any) => {
            Object.values(w.days).forEach((arr: any) => {
              if (Array.isArray(arr)) {
                arr.forEach((t: any) => {
                  totalTopicsCount++;
                  if (t.isCompleted) completedCount++;
                });
              }
            });
          });
          const initialProgress = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0;

          const newSchedule: Omit<StudySchedule, 'id'> & { startDate?: string } = {
            exam: `Cronograma PDF: ${file.name.replace(/\.[^/.]+$/, "")}`,
            modality: 'pdf_imported',
            studyDays,
            hoursPerDay,
            weeks: mappedWeeks,
            createdAt: new Date().toISOString(),
            startDate: syncStartDate,
            progress: initialProgress,
            currentSemesterSubjects: []
          };

          // Instead of storing in Firestore directly, open Preview mode!
          const created: StudySchedule = { id: 'preview_temp', ...newSchedule } as StudySchedule;
          setPreviewSchedule(created);
          setPreviewWeeksCount(created.weeks.length);
          setPreviewWeeklyMock(true);
          setPreviewMonthlyMock(true);
          setPreviewQuarterlyMock(false);
          setPreviewSemiAnnualMock(false);
          setPreviewAnnualMock(false);

      showToast("PDF analisado com sucesso! Revise e configure no painel de pré-visualização.", "success");
    } catch (err: any) {
      console.error("Error reading/processing PDF:", err);
      setPdfError(err.message || "Erro de decodificação da Inteligência Artificial. Tente novamente.");
      showToast("Erro ao processar PDF com a IA.", "error");
    } finally {
      setPdfImporting(false);
      setPdfProgress('');
      setPdfProgressPercent(0);
    }
  };

  // ==========================================
  // PREVIEW AND DRAFT CONTROLS (PAINEL DE PRÉ-VISUALIZAÇÃO)
  // ==========================================

  // Apply selected mock configurations on top of a weeks array
  const applyMocksToWeeks = (
    weeks: StudyPlanWeek[], 
    config: { weekly: boolean, monthly: boolean, quarterly: boolean, semiAnnual: boolean, annual: boolean }
  ): StudyPlanWeek[] => {
    return weeks.map(w => {
      const weekNumber = w.weekNumber;
      
      // Determine weekly mock
      let mockExam = undefined;
      if (config.weekly) {
        const wTopics: string[] = [];
        Object.values(w.days || {}).forEach(arr => {
          if (Array.isArray(arr)) {
            arr.forEach((t: any) => {
              if (t && typeof t.title === 'string' && t.type === 'estudo') {
                const clean = t.title
                  .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
                  .replace('🔄 [REVISÃO DE REFORÇO] ', '')
                  .replace(/^Revisão Ativa \+ Flashcards: /, '')
                  .trim();
                if (clean && !wTopics.includes(clean)) wTopics.push(clean);
              }
            });
          }
        });
        mockExam = {
          title: `Simulado Semanal - Semana ${weekNumber} (${wTopics.length} Temas)`,
          questionsCount: Math.min(60, Math.max(15, wTopics.length * 5)),
          isCompleted: false
        };
      }

      // Determine monthly mock (every 4 weeks)
      let monthlyMockExam = undefined;
      const isLastWeekOfMonth = (weekNumber % 4 === 0) || (weekNumber === weeks.length);
      if (config.monthly && isLastWeekOfMonth) {
        monthlyMockExam = {
          title: `Simulado Mensal - Mês ${Math.ceil(weekNumber / 4)}`,
          questionsCount: 100,
          isCompleted: false
        };
      }

      // Determine quarterly mock (every 12 weeks)
      let quarterlyMockExam = undefined;
      const isLastWeekOfQuarter = (weekNumber % 12 === 0) || (weekNumber === weeks.length);
      if (config.quarterly && isLastWeekOfQuarter) {
        quarterlyMockExam = {
          title: `Simulado Trimestral - Trimestre ${Math.ceil(weekNumber / 12)}`,
          questionsCount: 120,
          isCompleted: false
        };
      }

      // Determine semiAnnual mock (every 24 weeks)
      let semiAnnualMockExam = undefined;
      const isLastWeekOfSemi = (weekNumber % 24 === 0) || (weekNumber === weeks.length);
      if (config.semiAnnual && isLastWeekOfSemi) {
        semiAnnualMockExam = {
          title: `Simulado Semestral - Semestre ${Math.ceil(weekNumber / 24)}`,
          questionsCount: 150,
          isCompleted: false
        };
      }

      // Determine annual mock (last week)
      let annualMockExam = undefined;
      const isLastWeekOfAll = weekNumber === weeks.length;
      if (config.annual && isLastWeekOfAll) {
        annualMockExam = {
          title: `Simulado Anual de Consolidação Geral`,
          questionsCount: 180,
          isCompleted: false
        };
      }

      return {
        ...w,
        mockExam,
        monthlyMockExam,
        quarterlyMockExam,
        semiAnnualMockExam,
        annualMockExam
      } as any;
    });
  };

  // Toggle mock configuration in draft preview mode
  const handleTogglePreviewMockConfig = (type: 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual', enabled: boolean) => {
    if (!previewSchedule) return;

    let updatedWeekly = previewWeeklyMock;
    let updatedMonthly = previewMonthlyMock;
    let updatedQuarterly = previewQuarterlyMock;
    let updatedSemiAnnual = previewSemiAnnualMock;
    let updatedAnnual = previewAnnualMock;

    if (type === 'weekly') { setPreviewWeeklyMock(enabled); updatedWeekly = enabled; }
    if (type === 'monthly') { setPreviewMonthlyMock(enabled); updatedMonthly = enabled; }
    if (type === 'quarterly') { setPreviewQuarterlyMock(enabled); updatedQuarterly = enabled; }
    if (type === 'semiannual') { setPreviewSemiAnnualMock(enabled); updatedSemiAnnual = enabled; }
    if (type === 'annual') { setPreviewAnnualMock(enabled); updatedAnnual = enabled; }

    const updatedWeeks = applyMocksToWeeks(previewSchedule.weeks, {
      weekly: updatedWeekly,
      monthly: updatedMonthly,
      quarterly: updatedQuarterly,
      semiAnnual: updatedSemiAnnual,
      annual: updatedAnnual
    });

    setPreviewSchedule({
      ...previewSchedule,
      weeks: updatedWeeks
    });
  };

  // Set all preview topics to completed or pending status
  const handleSetAllPreviewTopicsCompleted = (completed: boolean) => {
    if (!previewSchedule) return;
    const updatedWeeks = previewSchedule.weeks.map(w => {
      const updatedDays = { ...w.days };
      Object.keys(updatedDays).forEach(day => {
        if (Array.isArray(updatedDays[day])) {
          updatedDays[day] = updatedDays[day].map(t => ({
            ...t,
            isCompleted: completed
          }));
        }
      });
      return {
        ...w,
        days: updatedDays
      };
    });

    setPreviewSchedule({
      ...previewSchedule,
      weeks: updatedWeeks
    });
    showToast(completed ? "Todos os tópicos foram marcados como concluídos no rascunho!" : "Todos os tópicos foram desmarcados!", "success");
  };

  // Toggle completion of a single topic inside preview schedule
  const handleTogglePreviewTopicCompletion = (weekIdx: number, dayName: string, topicIdx: number) => {
    if (!previewSchedule) return;
    const updatedWeeks = [...previewSchedule.weeks];
    const dayTopics = updatedWeeks[weekIdx].days[dayName];
    if (dayTopics && dayTopics[topicIdx]) {
      dayTopics[topicIdx].isCompleted = !dayTopics[topicIdx].isCompleted;
    }
    setPreviewSchedule({
      ...previewSchedule,
      weeks: updatedWeeks
    });
  };

  // Analyze preview schedule coverage and ranking of missing / scheduled high-incidence topics
  const getPlanAnalysisStats = () => {
    if (!previewSchedule) return null;

    const scheduledTitles = new Set<string>();
    previewSchedule.weeks.forEach(w => {
      Object.values(w.days || {}).forEach(arr => {
        if (Array.isArray(arr)) {
          arr.forEach((t: any) => {
            if (t && typeof t.title === 'string') {
              const clean = t.title
                .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
                .replace('🔄 [REVISÃO DE REFORÇO] ', '')
                .replace(/^Revisão Ativa \+ Flashcards: /, '')
                .trim()
                .toLowerCase();
              if (clean) scheduledTitles.add(clean);
            }
          });
        }
      });
    });

    const canonicalFlatList: { title: string; subject: string; incidence: number }[] = [];
    Object.entries(GLOBAL_RESIDENCY_TOPICS).forEach(([subj, list]: [string, any]) => {
      if (Array.isArray(list)) {
        list.forEach(t => {
          canonicalFlatList.push({
            title: t.title,
            subject: subj,
            incidence: t.incidence || 0
          });
        });
      }
    });

    canonicalFlatList.sort((a, b) => b.incidence - a.incidence);

    const topicsWithStatus = canonicalFlatList.map(t => {
      const isScheduled = scheduledTitles.has(t.title.toLowerCase().trim());
      return {
        ...t,
        isScheduled
      };
    });

    const scheduledList = topicsWithStatus.filter(t => t.isScheduled);
    const missingList = topicsWithStatus.filter(t => !t.isScheduled);

    const coveragePercentage = topicsWithStatus.length > 0 
      ? Math.round((scheduledList.length / topicsWithStatus.length) * 100) 
      : 0;

    return {
      topicsWithStatus,
      scheduledList,
      missingList,
      coveragePercentage
    };
  };

  // Add a missing high-incidence topic directly into the week with the fewest topics in preview mode
  const handleAddTopicToPreview = (topicTitle: string, subject: string, incidence: number) => {
    if (!previewSchedule) return;

    const updatedWeeks = [...previewSchedule.weeks];
    let minTopicsCount = Infinity;
    let targetWeekIdx = 0;

    updatedWeeks.forEach((w, wIdx) => {
      let count = 0;
      Object.values(w.days || {}).forEach(arr => {
        if (Array.isArray(arr)) count += arr.length;
      });
      if (count < minTopicsCount) {
        minTopicsCount = count;
        targetWeekIdx = wIdx;
      }
    });

    const daysToUse = previewSchedule.studyDays && previewSchedule.studyDays.length > 0 
      ? previewSchedule.studyDays 
      : ['Seg', 'Ter', 'Qui', 'Sáb'];

    let targetDay = daysToUse[0] || 'Seg';
    let minDayCount = Infinity;

    daysToUse.forEach(day => {
      const arr = updatedWeeks[targetWeekIdx].days[day] || [];
      if (arr.length < minDayCount) {
        minDayCount = arr.length;
        targetDay = day;
      }
    });

    const newTopic = {
      title: topicTitle,
      subjectName: subject,
      historicalIncidence: incidence,
      isPriority: false,
      isCompleted: false,
      review24h: false,
      review7d: false,
      review30d: false,
      type: 'estudo',
      importanceDegree: incidence >= 25 ? 'extremo' : incidence >= 18 ? 'alto' : 'medio'
    };

    if (!updatedWeeks[targetWeekIdx].days[targetDay]) {
      updatedWeeks[targetWeekIdx].days[targetDay] = [];
    }
    updatedWeeks[targetWeekIdx].days[targetDay].push(newTopic as any);

    const finalWeeks = applyMocksToWeeks(updatedWeeks, {
      weekly: previewWeeklyMock,
      monthly: previewMonthlyMock,
      quarterly: previewQuarterlyMock,
      semiAnnual: previewSemiAnnualMock,
      annual: previewAnnualMock
    });

    setPreviewSchedule({
      ...previewSchedule,
      weeks: finalWeeks
    });

    showToast(`"${topicTitle}" adicionado na Semana ${targetWeekIdx + 1} (${getDayDisplayName(targetDay)})!`, "success");
  };

  // Redistribute all study topics in the preview schedule across a new total number of weeks
  const handleRedistributeWeeks = (newWeeksCount: number) => {
    if (!previewSchedule) return;
    
    const allTopicsList: any[] = [];
    previewSchedule.weeks.forEach(w => {
      Object.values(w.days || {}).forEach(arr => {
        if (Array.isArray(arr)) {
          arr.forEach(t => {
            if (t && t.type === 'estudo') {
              const isDup = allTopicsList.some(item => item.title.toLowerCase().trim() === t.title.toLowerCase().trim());
              if (!isDup) {
                allTopicsList.push({
                  ...t,
                  isCompleted: t.isCompleted || false
                });
              }
            }
          });
        }
      });
    });

    if (allTopicsList.length === 0) {
      showToast("Não há tópicos de estudo para redistribuir.", "error");
      return;
    }

    const newWeeks: StudyPlanWeek[] = [];
    const daysToUse = previewSchedule.studyDays && previewSchedule.studyDays.length > 0 
      ? previewSchedule.studyDays 
      : ['Seg', 'Ter', 'Qui', 'Sáb'];

    const K = allTopicsList.length;
    const N = newWeeksCount;
    
    const buckets: any[][] = Array.from({ length: N }, () => []);
    allTopicsList.forEach((t, index) => {
      const bucketIdx = Math.floor((index / K) * N);
      if (buckets[bucketIdx]) {
        buckets[bucketIdx].push(t);
      } else {
        buckets[N - 1].push(t);
      }
    });

    const ALL_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    for (let i = 0; i < N; i++) {
      const weekNumber = i + 1;
      const weekBucket = buckets[i];
      
      const daysMap: Record<string, any[]> = {};
      ALL_WEEKDAYS.forEach(d => {
        daysMap[d] = [];
      });

      if (weekBucket.length > 0) {
        weekBucket.forEach((topic, topicIdx) => {
          const dayName = daysToUse[topicIdx % daysToUse.length];
          daysMap[dayName].push(topic);
        });
      }

      let priorityTitle = "Consolidação de Temas";
      if (weekBucket.length > 0) {
        priorityTitle = weekBucket.slice(0, 2).map(t => t.title.substring(0, 25)).join(" e ");
      }

      newWeeks.push({
        weekNumber,
        priorityTitle,
        days: daysMap
      });
    }

    const updatedWeeks = applyMocksToWeeks(newWeeks, {
      weekly: previewWeeklyMock,
      monthly: previewMonthlyMock,
      quarterly: previewQuarterlyMock,
      semiAnnual: previewSemiAnnualMock,
      annual: previewAnnualMock
    });

    setPreviewSchedule({
      ...previewSchedule,
      weeks: updatedWeeks
    });

    setPreviewWeeksCount(newWeeksCount);
    showToast(`Cronograma redistribuído com sucesso para ${newWeeksCount} semanas!`, "success");
  };

  // Auto sync previously studied theory topics from student profile while preserving revision/exercise topics
  const handleAutoSyncStudiedTheory = () => {
    if (!previewSchedule) return;
    let matchedTheoryCount = 0;

    const updatedWeeks = previewSchedule.weeks.map(w => {
      const updatedDays = { ...w.days };
      Object.keys(updatedDays).forEach(day => {
        if (Array.isArray(updatedDays[day])) {
          updatedDays[day] = updatedDays[day].map(t => {
            // Do NOT auto-complete revisions or final exercise blocks
            if (t.type === 'revisao') {
              return { ...t, isCompleted: false };
            }
            
            const titleStr = typeof t.title === 'string' ? t.title : '';
            const found = findMatchingTopic(titleStr, topics);
            const hasTheoryDone = found ? !!(
              found.completed === true ||
              (typeof found.repetitions === 'number' && found.repetitions > 0) ||
              (found.lastReviewDate && typeof found.lastReviewDate === 'string' && found.lastReviewDate.trim().length > 0)
            ) : false;

            if (hasTheoryDone) matchedTheoryCount++;
            return {
              ...t,
              isCompleted: hasTheoryDone,
              isPreCompleted: hasTheoryDone
            };
          });
        }
      });
      return { ...w, days: updatedDays };
    });

    setPreviewSchedule({ ...previewSchedule, weeks: updatedWeeks });
    if (matchedTheoryCount > 0) {
      showToast(`${matchedTheoryCount} tópicos de teoria anteriores marcados como concluídos! Semanas de revisão e exercícios mantidas ativas.`, "success");
    } else {
      showToast("Nenhum tópico teórico anterior foi encontrado no seu histórico.", "info");
    }
  };

  // Save the customized preview schedule to Firestore and activate it as the current schedule
  const saveAndActivateSchedule = async () => {
    if (!previewSchedule) return;

    try {
      setGenerating(true);
      showToast("Salvando e ativando seu cronograma definitivo...", "info");

      let totalTopicsCount = 0;
      let completedCount = 0;
      previewSchedule.weeks.forEach(w => {
        Object.values(w.days || {}).forEach(arr => {
          if (Array.isArray(arr)) {
            arr.forEach(t => {
              totalTopicsCount++;
              if (t.isCompleted) completedCount++;
            });
          }
        });
      });
      const finalProgress = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0;
      const finalCoverage = calculateCoverage(previewSchedule.weeks, selectedExamId || 'custom');
      
      const cleanScheduleToSave = {
        exam: previewSchedule.exam,
        modality: previewSchedule.modality,
        studyDays: previewSchedule.studyDays,
        hoursPerDay: previewSchedule.hoursPerDay,
        weeks: previewSchedule.weeks,
        createdAt: previewSchedule.createdAt || new Date().toISOString(),
        startDate: previewSchedule.startDate || syncStartDate,
        progress: finalProgress,
        coveragePercentage: finalCoverage,
        currentSemesterSubjects: previewSchedule.currentSemesterSubjects || [],
        examDate: previewSchedule.examDate || null
      };

      const docRef = await addDoc(collection(db, 'users', user.uid, 'schedules'), cleanScheduleToSave);
      const created: StudySchedule = { id: docRef.id, ...cleanScheduleToSave } as StudySchedule;

      setSchedules(prev => [created, ...prev]);
      setSchedule(created);
      localStorage.setItem('active_schedule_id', docRef.id);
      
      setActiveWeekIndex(0);
      if (created.weeks[0]?.days) {
        const orderedDays = getOrderedDaysForWeek(created.studyDays, (created as any).startDate);
        const firstDayName = orderedDays[0] || Object.keys(created.weeks[0].days)[0];
        if (firstDayName) setActiveDayTab(firstDayName);
      }
      setActiveMonthFilter(1);
      setActiveTab('plan');
      
      setPreviewSchedule(null);
      showToast("Cronograma definitivo ativado com sucesso!", "success");

    } catch (err: any) {
      console.error("Error saving active schedule:", err);
      showToast("Falha ao salvar o cronograma na nuvem: " + err.message, "error");
    } finally {
      setGenerating(false);
    }
  };

  // Get clinical insight for error analysis of a specific topic
  const getClinicalInsightForTopic = (title: string, successRate: number): string => {
    const titleLower = title.toLowerCase();
    
    let subjectFocus = "conceitos gerais";
    let errorHypothesis = "detalhes de dosagem ou critérios secundários de diagnóstico";
    let reviewStrategy = "estudo ativo por flashcards e resolução de casos clínicos simulados";

    if (titleLower.includes("asma") || titleLower.includes("pneumologia") || titleLower.includes("dpoc")) {
      subjectFocus = "pneumologia";
      errorHypothesis = "classificação de gravidade do quadro e manejo terapêutico de crise de acordo com a GINA/GOLD";
      reviewStrategy = "esquematizar o algoritmo de resgate e manutenção em fluxogramas visuais";
    } else if (titleLower.includes("hipertens") || titleLower.includes("has") || titleLower.includes("cardiologia") || titleLower.includes("infarto") || titleLower.includes("iam") || titleLower.includes("insuficiência cardíaca") || titleLower.includes("ic")) {
      subjectFocus = "cardiologia";
      errorHypothesis = "metas terapêuticas de pressão arterial, contraindicações de anti-hipertensivos ou conduta imediata na síndrome coronariana aguda";
      reviewStrategy = "revisar as diretrizes brasileiras de HAS e fixar as drogas de escolha em comorbidades específicas";
    } else if (titleLower.includes("diabetes") || titleLower.includes("dm") || titleLower.includes("tireoide") || titleLower.includes("endocrinologia")) {
      subjectFocus = "endocrinologia";
      errorHypothesis = "mecanismos de ação dos hipoglicemiantes orais, critérios diagnósticos de cetoacidose diabética ou manejo de insulinoterapia";
      reviewStrategy = "criar flashcards focando na comparação direta de classes de drogas de DM2 e seus perfis de efeitos colaterais";
    } else if (titleLower.includes("obstetrícia") || titleLower.includes("ginecologia") || titleLower.includes("pré-natal") || titleLower.includes("gestant") || titleLower.includes("parto")) {
      subjectFocus = "ginecologia e obstetrícia";
      errorHypothesis = "fisiologia obstétrica, triagem de pré-natal, classificação de distúrbios hipertensivos da gestação ou indicação de via de parto";
      reviewStrategy = "praticar exaustivamente questões focadas no partograma e na conduta imediata em hemorragias de terceiro trimestre";
    } else if (titleLower.includes("pediatria") || titleLower.includes("asma infantil") || titleLower.includes("criança") || titleLower.includes("aleitamento") || titleLower.includes("vacin")) {
      subjectFocus = "pediatria";
      errorHypothesis = "calendário vacinal atualizado do PNI, marcos do desenvolvimento neuropsicomotor ou manejo de infecções respiratórias agudas";
      reviewStrategy = "revisar de forma ativa as tabelas de vacinação e marcos do desenvolvimento do Ministério da Saúde";
    } else if (titleLower.includes("cirurgia") || titleLower.includes("trauma") || titleLower.includes("apendicite") || titleLower.includes("abdome agudo")) {
      subjectFocus = "cirurgia geral";
      errorHypothesis = "sinalização propedêutica no abdome agudo, classificação de trauma pelo ATLS ou indicações cirúrgicas de urgência";
      reviewStrategy = "estudar por meio de mapas mentais de conduta inicial em trauma torácico e abdominal";
    } else if (titleLower.includes("preventiva") || titleLower.includes("sus") || titleLower.includes("epidemiologia") || titleLower.includes("vulnerabilidade")) {
      subjectFocus = "medicina preventiva";
      errorHypothesis = "leis orgânicas da saúde (8080/8142), princípios doutrinários do SUS, cálculo de indicadores de saúde (mortalidade, letalidade) ou níveis de prevenção de Leavell & Clark";
      reviewStrategy = "decorar regras de ouro do SUS através de mnemônicos e simular questões de cálculo epidemiológico";
    } else if (titleLower.includes("infecto") || titleLower.includes("antibiótico") || titleLower.includes("hiv") || titleLower.includes("sepse") || titleLower.includes("meningite")) {
      subjectFocus = "infectologia";
      errorHypothesis = "espectro de ação de antibióticos de escolha, critérios de sepse (qSOFA/SOFA) ou profilaxia pós-exposição";
      reviewStrategy = "sintetizar as principais famílias de antimicrobianos e suas coberturas bacterianas fundamentais";
    }

    if (successRate >= 75) {
      return `Excelente domínio em ${subjectFocus}! Você demonstrou sólida compreensão clínica de diretrizes de diagnóstico e terapia, minimizando erros comuns de pegadinhas de bancas. Mantenha revisões espaçadas normais para garantir a retenção na memória de longo prazo.`;
    } else if (successRate >= 60) {
      return `Rendimento regular em ${subjectFocus}. Provável confusão em ${errorHypothesis}. Sugere-se ${reviewStrategy} para sanar essas arestas antes das provas principais.`;
    } else {
      return `Desempenho deficitário e crítico em ${subjectFocus}! Identificada lacuna severa no assunto, afetando principalmente ${errorHypothesis}. É fundamental realizar ${reviewStrategy} com foco total em engenharia reversa de questões.`;
    }
  };

  // Handle detailed topic performance recording and automatic error analysis
  const handleSaveDetailedTopicPerformance = async (weekIdx: number) => {
    if (!schedule) return;
    try {
      const updatedWeeks = [...schedule.weeks];
      const mock = updatedWeeks[weekIdx].mockExam;
      if (!mock) return;

      const performance = topicPerformanceInputs;
      const weekTopics = getWeekTopics(weekIdx);
      
      let totalQuestions = 0;
      let totalCorrect = 0;
      const topicAnalysis: Record<string, {
        total: number;
        correct: number;
        errors: number;
        successRate: number;
        status: 'insuficiente' | 'regular' | 'excelente';
        reason: string;
      }> = {};

      const deficitTopics: string[] = [];

      weekTopics.forEach(title => {
        const perf = performance[title] || { total: 10, correct: 10 };
        const total = perf.total > 0 ? perf.total : 1;
        const correct = Math.min(perf.correct, total);
        const errors = total - correct;
        const successRate = Math.round((correct / total) * 100);
        
        totalQuestions += total;
        totalCorrect += correct;

        const status: 'insuficiente' | 'regular' | 'excelente' = 
          successRate >= 75 ? 'excelente' : successRate >= 60 ? 'regular' : 'insuficiente';

        if (status === 'insuficiente' || status === 'regular') {
          deficitTopics.push(title);
        }

        topicAnalysis[title] = {
          total,
          correct,
          errors,
          successRate,
          status,
          reason: getClinicalInsightForTopic(title, successRate)
        };
      });

      const overallScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
      
      let globalStatus: 'excellent' | 'good' | 'deficit' = 'deficit';
      let recommendation = '';

      if (overallScore >= 80) {
        globalStatus = 'excellent';
        recommendation = 'Rendimento unificado brilhante! Você sedimentou a maior parte dos conteúdos da semana na memória de longo prazo, com destaque para temas de excelência. Continue com o cronograma normal e foque pontualmente nos temas regulares/deficitários anotados abaixo.';
      } else if (overallScore >= 70) {
        globalStatus = 'good';
        recommendation = 'Bom aproveitamento global, mas o diagnóstico por tópicos mostra pontos cegos específicos de atenção. Sugerimos agendar a revisão dos temas sinalizados como regulares ou insuficientes para garantir a nota máxima.';
      } else {
        globalStatus = 'deficit';
        recommendation = 'Rendimento global deficitário. A análise aprofundada por tópicos aponta dificuldades cruciais no conteúdo teórico e prático desta semana. Recomendamos fortemente revisar e reagendar os temas de baixo aproveitamento.';
      }

      mock.isCompleted = true;
      mock.score = overallScore;
      mock.topicPerformance = performance;
      mock.analysis = {
        status: globalStatus,
        deficitTopics,
        recommendation,
        reviewsScheduled: false,
        topicAnalysis
      };

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });

      // Update deficit topics list in local state for checkbox selection
      setSelectedDeficitReviews(deficitTopics);

      // SYNC TO MEDREVISE (cross-linking mock exam outcomes to MedRevise topics)
      for (const title of weekTopics) {
        const perf = performance[title] || { total: 10, correct: 10 };
        const total = perf.total > 0 ? perf.total : 1;
        const correct = Math.min(perf.correct, total);
        const successRate = Math.round((correct / total) * 100);

        const linkedId = findLinkedTopicIdForTitle(title, weekIdx);
        const foundTopic = findMatchingTopic(title, topics, linkedId);
        if (foundTopic) {
          try {
            const quality = accuracyToQuality(correct, total);
            const srsUpdate = calculateNextReview(
              quality,
              foundTopic.repetitions ?? 0,
              foundTopic.interval ?? 0,
              foundTopic.easinessFactor ?? 2.5
            );

            // Register study session in MedRevise database
            await addDoc(collection(db, 'users', user.uid, 'studySessions'), {
              topicId: foundTopic.id,
              subjectId: foundTopic.subjectId,
              date: new Date().toISOString(),
              questionsCount: total,
              correctCount: correct,
              studyTimeMinutes: 15,
              description: `Simulado da Semana ${weekIdx + 1} (MedInternato) - Desempenho: ${correct}/${total} (${successRate}%)`
            });

            // Set topic SM-2 parameters for scheduled reviews
            await updateDoc(doc(db, 'users', user.uid, 'topics', foundTopic.id), {
              repetitions: srsUpdate.repetitions,
              interval: srsUpdate.interval,
              easinessFactor: srsUpdate.ease,
              lastReviewDate: new Date().toISOString(),
              nextReviewDate: srsUpdate.nextReviewDate,
              completed: successRate >= 75,
              wasRescheduledOverdue: false
            });
          } catch (err) {
            console.warn(`Erro ao sincronizar tópico ${title} com o MedRevise:`, err);
          }
        }
      }

      showToast("Resultados do simulado salvos com análise aprofundada e sincronizados ao MedRevise!", "success");
    } catch (e) {
      console.error("Erro ao registrar desempenho detalhado do simulado:", e);
      showToast("Erro ao registrar desempenho detalhado.", "error");
    }
  };

  // Handle scheduling of selected reviews
  const handleScheduleSelectedReviews = async (weekIdx: number, selectedTopics: string[]) => {
    if (!schedule) return;
    if (selectedTopics.length === 0) {
      showToast("Selecione pelo menos um tópico para revisão.", "info");
      return;
    }

    try {
      const updatedWeeks = [...schedule.weeks];
      const nextWeekIdx = weekIdx + 1;

      if (nextWeekIdx >= updatedWeeks.length) {
        // Last week fallback: insert as priority inside active week
        const week = updatedWeeks[weekIdx];
        Object.keys(week.days).forEach(day => {
          week.days[day].forEach(t => {
            if (t && t.title && selectedTopics.includes(t.title)) {
              t.isCompleted = false;
              t.isPriority = true;
              t.review24h = false;
              t.review7d = false;
              t.review30d = false;
            }
          });
        });
      } else {
        // Insert selected topics into the first study day of the NEXT week!
        const nextWeek = updatedWeeks[nextWeekIdx];
        const firstDay = Object.keys(nextWeek.days)[0] || 'Seg';
        
        selectedTopics.forEach(title => {
          const exists = Object.values(nextWeek.days).flat().some(t => t && t.title === title);
          if (!exists) {
            nextWeek.days[firstDay].push({
              title,
              subjectName: 'Revisão de Matéria Deficitária',
              historicalIncidence: 20,
              isPriority: true,
              isCompleted: false,
              review24h: false,
              review7d: false,
              review30d: false,
              type: 'revisao',
              importanceDegree: 'alto'
            });
          }
        });
      }

      // Mark that reviews have been successfully scheduled
      const mock = updatedWeeks[weekIdx].mockExam;
      if (mock && mock.analysis) {
        mock.analysis.reviewsScheduled = true;
        mock.analysis.recommendation = 'As revisões das matérias insuficientes selecionadas foram devidamente reprogramadas como prioridade máxima no início da sua próxima semana de estudos.';
      }

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });

      showToast(`Sucesso! ${selectedTopics.length} tópicos foram reagendados para a próxima semana!`, "success");
    } catch (e) {
      console.error("Erro ao programar revisões selecionadas:", e);
      showToast("Houve um erro ao reagendar as revisões.", "error");
    }
  };
  const handleSaveDetailedMonthlyPerformance = async (weekIdx: number) => {
    if (!schedule) return;
    try {
      const updatedWeeks = [...schedule.weeks];
      if (!updatedWeeks[weekIdx].monthlyMockExam) {
        updatedWeeks[weekIdx].monthlyMockExam = {
          title: `Simulado de Consolidação Mensal - Mês ${Math.floor(weekIdx / 4) + 1}`,
          questionsCount: 100,
          isCompleted: false
        };
      }
      const mock = updatedWeeks[weekIdx].monthlyMockExam;
      if (!mock) return;

      const performance = topicPerformanceInputs;
      const monthTopics = getMonthTopics(weekIdx);
      
      let totalQuestions = 0;
      let totalCorrect = 0;
      const topicAnalysis: Record<string, {
        total: number;
        correct: number;
        errors: number;
        successRate: number;
        status: 'insuficiente' | 'regular' | 'excelente';
        reason: string;
      }> = {};

      const deficitTopics: string[] = [];

      monthTopics.forEach(title => {
        const perf = performance[title] || { total: 10, correct: 10 };
        const total = perf.total > 0 ? perf.total : 1;
        const correct = Math.min(perf.correct, total);
        const errors = total - correct;
        const successRate = Math.round((correct / total) * 100);
        
        totalQuestions += total;
        totalCorrect += correct;

        const status: 'insuficiente' | 'regular' | 'excelente' = 
          successRate >= 75 ? 'excelente' : successRate >= 60 ? 'regular' : 'insuficiente';

        if (status === 'insuficiente' || status === 'regular') {
          deficitTopics.push(title);
        }

        topicAnalysis[title] = {
          total,
          correct,
          errors,
          successRate,
          status,
          reason: getClinicalInsightForTopic(title, successRate)
        };
      });

      const overallScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
      
      let globalStatus: 'excellent' | 'good' | 'deficit' = 'deficit';
      let recommendation = '';

      if (overallScore >= 80) {
        globalStatus = 'excellent';
        recommendation = 'Rendimento unificado brilhante no Simulado Mensal! Você sedimentou a maior parte dos conteúdos do mês na memória de longo prazo, com destaque para temas de excelência. Continue com o cronograma normal de revisões.';
      } else if (overallScore >= 70) {
        globalStatus = 'good';
        recommendation = 'Bom aproveitamento global no Simulado Mensal, mas o diagnóstico por tópicos mostra pontos cegos específicos de atenção. Sugerimos agendar a revisão dos temas sinalizados como regulares ou insuficientes.';
      } else {
        globalStatus = 'deficit';
        recommendation = 'Rendimento global deficitário no Simulado Mensal. A análise aponta dificuldades cruciais nos temas teóricos e práticos deste mês. Recomendamos agendar revisões urgentes desses temas.';
      }

      mock.isCompleted = true;
      mock.score = overallScore;
      mock.topicPerformance = performance;
      mock.analysis = {
        status: globalStatus,
        deficitTopics,
        recommendation,
        reviewsScheduled: false,
        topicAnalysis
      };

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });

      setSelectedDeficitReviews(deficitTopics);
    } catch (e) {
      console.error("Erro ao salvar performance detalhada do simulado mensal:", e);
    }
  };

  const handleSelectMonthlyScore = async (weekIdx: number, score: number) => {
    if (!schedule) return;
    try {
      const updatedWeeks = [...schedule.weeks];
      if (!updatedWeeks[weekIdx].monthlyMockExam) {
        updatedWeeks[weekIdx].monthlyMockExam = {
          title: `Simulado de Consolidação Mensal - Mês ${Math.floor(weekIdx / 4) + 1}`,
          questionsCount: 100,
          isCompleted: false
        };
      }
      const mock = updatedWeeks[weekIdx].monthlyMockExam;
      const monthTopics = getMonthTopics(weekIdx);
      if (mock) {
        mock.isCompleted = true;
        mock.score = score;
        
        let status: 'excellent' | 'good' | 'deficit' = 'deficit';
        let recommendation = '';

        if (score >= 80) {
          status = 'excellent';
          recommendation = 'Rendimento brilhante no Simulado Mensal! Você sedimentou o conteúdo do mês na memória de longo prazo com maestria. Continue com seu cronograma normal de revisões espaçadas.';
        } else if (score >= 70) {
          status = 'good';
          recommendation = 'Bom aproveitamento no Simulado Mensal, mas há pontos específicos a serem reforçados. Sugerimos revisar os tópicos mais complexos deste mês.';
        } else {
          status = 'deficit';
          recommendation = 'Rendimento abaixo do esperado no Simulado Mensal. O estudo deste mês foi classificado como Deficitário pelo algoritmo médico do MedRevise. Recomendamos reagendar imediatamente esses temas.';
        }

        mock.analysis = {
          status,
          deficitTopics: monthTopics,
          recommendation,
          reviewsScheduled: mock.analysis?.reviewsScheduled || false
        };
      }

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });
    } catch (e) {
      console.error("Erro ao salvar nota unificada do simulado mensal:", e);
    }
  };

  const handleSelectScore = async (weekIdx: number, score: number) => {
    if (!schedule) return;
    try {
      const updatedWeeks = [...schedule.weeks];
      const mock = updatedWeeks[weekIdx].mockExam;
      const weekTopics = getWeekTopics(weekIdx);
      if (mock) {
        mock.isCompleted = true;
        mock.score = score;
        
        let status: 'excellent' | 'good' | 'deficit' = 'deficit';
        let recommendation = '';

        if (score >= 80) {
          status = 'excellent';
          recommendation = 'Rendimento brilhante! Você sedimentou o conteúdo desta semana na memória de longo prazo com maestria. Continue com seu cronograma normal de revisões espaçadas.';
        } else if (score >= 70) {
          status = 'good';
          recommendation = 'Bom aproveitamento, mas há pontos específicos a serem reforçados. Sugerimos revisar os tópicos mais complexos antes de avançar para a próxima semana.';
        } else {
          status = 'deficit';
          recommendation = 'Rendimento abaixo do esperado. O estudo desta semana foi classificado como Deficitário pelo algoritmo médico do MedRevise. Recomendamos reagendar imediatamente esses temas na próxima semana.';
        }

        mock.analysis = {
          status,
          deficitTopics: weekTopics,
          recommendation,
          reviewsScheduled: mock.analysis?.reviewsScheduled || false
        };
      }

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });

      // SYNC TO MEDREVISE (cross-linking fast score to MedRevise topics)
      for (const title of weekTopics) {
        const total = 10;
        const correct = Math.round(10 * (score / 100));
        const successRate = score;

        const linkedId = findLinkedTopicIdForTitle(title, weekIdx);
        const foundTopic = findMatchingTopic(title, topics, linkedId);
        if (foundTopic) {
          try {
            const quality = accuracyToQuality(correct, total);
            const srsUpdate = calculateNextReview(
              quality,
              foundTopic.repetitions ?? 0,
              foundTopic.interval ?? 0,
              foundTopic.easinessFactor ?? 2.5
            );

            // Register study session in MedRevise database
            await addDoc(collection(db, 'users', user.uid, 'studySessions'), {
              topicId: foundTopic.id,
              subjectId: foundTopic.subjectId,
              date: new Date().toISOString(),
              questionsCount: total,
              correctCount: correct,
              studyTimeMinutes: 15,
              description: `Simulado Rápido da Semana ${weekIdx + 1} (MedInternato) - Desempenho: ${successRate}%`
            });

            // Set topic SM-2 parameters for scheduled reviews
            await updateDoc(doc(db, 'users', user.uid, 'topics', foundTopic.id), {
              repetitions: srsUpdate.repetitions,
              interval: srsUpdate.interval,
              easinessFactor: srsUpdate.ease,
              lastReviewDate: new Date().toISOString(),
              nextReviewDate: srsUpdate.nextReviewDate,
              completed: successRate >= 75,
              wasRescheduledOverdue: false
            });
          } catch (err) {
            console.warn(`Erro ao sincronizar tópico rápido ${title} com o MedRevise:`, err);
          }
        }
      }

      showToast(`Resultado do simulado (${score}%) registrado e sincronizado ao MedRevise!`, "success");
    } catch (e) {
      console.error("Erro ao registrar desempenho do simulado:", e);
    }
  };

  // Handle automated dynamic rescheduling of deficit subjects
  const handleScheduleDeficitReviews = async (weekIdx: number) => {
    if (!schedule) return;
    try {
      const updatedWeeks = [...schedule.weeks];
      const nextWeekIdx = weekIdx + 1;
      const weekTopics = getWeekTopics(weekIdx);

      if (nextWeekIdx >= updatedWeeks.length) {
        // Last week fallback: insert as priority inside active week
        const week = updatedWeeks[weekIdx];
        Object.keys(week.days).forEach(day => {
          week.days[day].forEach(t => {
            if (t && t.title && weekTopics.includes(t.title)) {
              t.isCompleted = false;
              t.isPriority = true;
              t.review24h = false;
              t.review7d = false;
              t.review30d = false;
            }
          });
        });
      } else {
        // Insert as priority items into the first study day of the NEXT week!
        const nextWeek = updatedWeeks[nextWeekIdx];
        const firstDay = Object.keys(nextWeek.days)[0] || 'Seg';
        
        weekTopics.forEach(title => {
          const exists = Object.values(nextWeek.days).flat().some(t => t && t.title === title);
          if (!exists) {
            nextWeek.days[firstDay].push({
              title,
              subjectName: 'Revisão de Matéria Deficitária',
              historicalIncidence: 20,
              isPriority: true,
              isCompleted: false,
              review24h: false,
              review7d: false,
              review30d: false,
              type: 'revisao',
              importanceDegree: 'medio'
            });
          }
        });
      }

      // Mark that reviews have been successfully scheduled
      const mock = updatedWeeks[weekIdx].mockExam;
      if (mock) {
        mock.analysis = {
          status: mock.analysis?.status || 'deficit',
          deficitTopics: weekTopics,
          recommendation: 'As matérias deficitárias foram devidamente reprogramadas como revisões de prioridade máxima no início da sua próxima semana de estudos.',
          reviewsScheduled: true
        };
      }

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks
      });

      showToast("Algoritmo reorganizou seu cronograma e inseriu as matérias deficitárias na próxima semana!", "success");
    } catch (e) {
      console.error("Erro ao programar revisões deficitárias:", e);
      showToast("Houve um erro ao reorganizar as revisões.", "error");
    }
  };

  // Trigger Restructuring catching-up logic ("Desatrasar Planejamento / Recuperar Atraso")
  const handleRestructureSubmit = async () => {
    if (!schedule) return;

    try {
      setRestructureSaving(true);
      const updatedWeeks = [...schedule.weeks];
      const currentDayIdx = getDayIndexInOrder(activeDayTab);

      // Gather ALL uncompleted topics from past weeks AND past days of the current week
      const uncompletedBacklog: StudyPlanTopic[] = [];

      for (let w = 0; w < updatedWeeks.length; w++) {
        const week = updatedWeeks[w];
        const isPastWeek = w < activeWeekIndex;
        const isCurrentWeek = w === activeWeekIndex;

        if (isPastWeek || isCurrentWeek) {
          Object.entries(week.days || {}).forEach(([dayName, topicsArr]) => {
            const dayIdxInWeek = getDayIndexInOrder(dayName);
            const isPastDayInCurrentWeek = isCurrentWeek && currentDayIdx !== -1 && dayIdxInWeek !== -1 && dayIdxInWeek < currentDayIdx;

            if ((isPastWeek || isPastDayInCurrentWeek) && Array.isArray(topicsArr)) {
              const remainingTopics: StudyPlanTopic[] = [];
              topicsArr.forEach(t => {
                if (t && t.title) {
                  // EXCLUDE REVISIONS - Keep reviews in their original days, do not pull them into backlog
                  if (isRevisionTopic(t)) {
                    remainingTopics.push(t);
                    return;
                  }

                  if (!isTopicDone(t)) {
                    uncompletedBacklog.push({
                      ...t,
                      isCompleted: false,
                      isPriority: true, // Mark as priority because it's delayed!
                      isRescheduled: true // Tag as recalculated delayed topic!
                    });
                  } else {
                    remainingTopics.push(t);
                  }
                }
              });
              // Keep completed study topics and all reviews in past days
              week.days[dayName] = remainingTopics;
            }
          });
        }
      }

      if (uncompletedBacklog.length === 0) {
        showToast("Você não possui matérias pendentes/atrasadas anteriores a este dia!", "info");
        setShowRestructureModal(false);
        setRestructureSaving(false);
        return;
      }

      // Collect only the study days marked by the user
      const activeStudyDays = schedule.studyDays && schedule.studyDays.length > 0
        ? schedule.studyDays
        : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

      // Sort backlog by priority: Extremo > Alto > Médio > Baixo, then higher incidence first
      const getImportanceScore = (degree?: string) => {
        switch (degree) {
          case 'extremo': return 4;
          case 'alto': return 3;
          case 'medio': return 2;
          case 'baixo': return 1;
          default: return 0;
        }
      };

      uncompletedBacklog.sort((a, b) => {
        const scoreDiff = getImportanceScore(b.importanceDegree) - getImportanceScore(a.importanceDegree);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.historicalIncidence || 0) - (a.historicalIncidence || 0);
      });

      // Generate sequence of the next N study days
      const studyDaysSequence: { weekIdx: number; dayName: string }[] = [];
      let tempW = activeWeekIndex;
      let startIdx = activeStudyDays.findIndex(d => getDayIndexInOrder(d) === getDayIndexInOrder(activeDayTab));
      
      if (startIdx < 0) {
        const activeChronologicalIdx = getDayIndexInOrder(activeDayTab);
        const upcomingStudyDays = activeStudyDays
          .map(d => ({ name: d, idx: getDayIndexInOrder(d) }))
          .sort((a, b) => a.idx - b.idx);
        
        const nextStudyDay = upcomingStudyDays.find(d => d.idx >= activeChronologicalIdx) || upcomingStudyDays[0];
        startIdx = activeStudyDays.findIndex(d => getDayIndexInOrder(d) === getDayIndexInOrder(nextStudyDay?.name));
        if (nextStudyDay && nextStudyDay.idx < activeChronologicalIdx) {
          tempW++;
        }
      }
      if (startIdx < 0) startIdx = 0;

      let tempDayPos = startIdx;
      const targetDaysCount = Math.max(1, restructureDays);

      for (let i = 0; i < targetDaysCount; i++) {
        // Safe check for day position index
        if (tempDayPos < 0 || tempDayPos >= activeStudyDays.length) {
          tempDayPos = 0;
        }
        const dayName = activeStudyDays[tempDayPos];

        if (tempW >= updatedWeeks.length) {
          const newWeekNum = updatedWeeks.length + 1;
          const newWeekObj: StudyPlanWeek = {
            weekNumber: newWeekNum,
            priorityTitle: 'Recuperação & Consolidação de Atrasos',
            days: {}
          };
          activeStudyDays.forEach(d => { newWeekObj.days[d] = []; });
          updatedWeeks.push(newWeekObj);
        }

        studyDaysSequence.push({ weekIdx: tempW, dayName });

        tempDayPos++;
        if (tempDayPos >= activeStudyDays.length) {
          tempDayPos = 0;
          tempW++;
        }
      }

      // Distribute sorted backlog sequentially across the calculated sequence of study days
      uncompletedBacklog.forEach((backlogTopic, index) => {
        const targetDay = studyDaysSequence[index % studyDaysSequence.length];
        const week = updatedWeeks[targetDay.weekIdx];
        if (!week.days[targetDay.dayName]) {
          week.days[targetDay.dayName] = [];
        }
        week.days[targetDay.dayName].push(backlogTopic);
      });

      // Sort topics within each modified study day so highest priority sit on top
      studyDaysSequence.forEach(targetDay => {
        const week = updatedWeeks[targetDay.weekIdx];
        if (week.days[targetDay.dayName]) {
          week.days[targetDay.dayName].sort((a, b) => {
            const scoreDiff = getImportanceScore(b.importanceDegree) - getImportanceScore(a.importanceDegree);
            if (scoreDiff !== 0) return scoreDiff;
            return (b.historicalIncidence || 0) - (a.historicalIncidence || 0);
          });
        }
      });

      // Recalculate progress
      let totalTopicsCount = 0;
      let completedCount = 0;
      updatedWeeks.forEach(w => {
        Object.values(w.days).forEach(arr => {
          arr.forEach(t => {
            totalTopicsCount++;
            if (isTopicDone(t)) completedCount++;
          });
        });
      });
      const progress = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0;

      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await updateDoc(scheduleRef, {
        weeks: updatedWeeks,
        studyDays: activeStudyDays,
        progress
      });

      setSchedule({
        ...schedule,
        weeks: updatedWeeks,
        studyDays: activeStudyDays,
        progress
      });

      setShowRestructureModal(false);
      showToast(`${uncompletedBacklog.length} tópicos em atraso foram redistribuídos prioritariamente em ${targetDaysCount} dias de estudo!`, "success");
    } catch (e) {
      console.error("Erro ao reestruturar cronograma:", e);
      showToast("Houve um erro ao reorganizar o plano.", "error");
    } finally {
      setRestructureSaving(false);
    }
  };

  // Safe handler to execute schedule deletion from our custom overlay
  const executeReset = async () => {
    setShowConfirmReset(false);
    if (!schedule) return;
    try {
      setLoading(true);
      const scheduleRef = doc(db, 'users', user.uid, 'schedules', schedule.id);
      await deleteDoc(scheduleRef);
      
      const remaining = schedules.filter(s => s.id !== schedule.id);
      setSchedules(remaining);
      
      if (remaining.length > 0) {
        setSchedule(remaining[0]);
        localStorage.setItem('active_schedule_id', remaining[0].id);
        setActiveTab('plan');
      } else {
        setSchedule(null);
        localStorage.removeItem('active_schedule_id');
        setActiveTab('config');
      }
      showToast("Cronograma apagado com sucesso!", "success");
    } catch (e) {
      console.error("Erro ao deletar cronograma:", e);
      showToast("Houve um erro ao apagar o cronograma.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Soft/Hard delete active schedule to generate a new one
  const handleDeleteSchedule = async () => {
    if (!schedule) return;
    setShowConfirmReset(true);
  };

  // Dynamic stats calculation for active schedule analysis
  const getScheduleAnalysisStats = () => {
    if (!schedule) return null;

    const uniqueScheduledTitles = new Set<string>();
    const topicDetailsMap: { [title: string]: { studies: number; reviews: number; subject: string; incidence?: number } } = {};

    // Get all canonical topics in a flat list to map subjects easily
    const canonicalFlatList: { title: string; subject: string; incidence: number }[] = [];
    Object.entries(GLOBAL_RESIDENCY_TOPICS).forEach(([subj, topicsArr]) => {
      topicsArr.forEach(t => {
        canonicalFlatList.push({ title: t.title, subject: subj, incidence: t.incidence });
      });
    });

    schedule.weeks.forEach(week => {
      if (week && week.days) {
        Object.entries(week.days).forEach(([day, dayTopics]) => {
          if (Array.isArray(dayTopics)) {
            dayTopics.forEach(topic => {
              if (topic) {
                // Clean name
                const isRev = topic.type === 'revisao';
                const titleStr = typeof topic.title === 'string' ? topic.title : '';
                const cleanTitle = titleStr.replace('Revisão Ativa + Flashcards: ', '').trim();
                uniqueScheduledTitles.add(cleanTitle);

                if (!topicDetailsMap[cleanTitle]) {
                  // Find subject
                  const foundCanonical = canonicalFlatList.find(c => c.title.toLowerCase().trim() === cleanTitle.toLowerCase().trim());
                  topicDetailsMap[cleanTitle] = {
                    studies: 0,
                    reviews: 0,
                    subject: foundCanonical?.subject || topic.subjectName || 'Geral',
                    incidence: foundCanonical?.incidence || topic.historicalIncidence || 15
                  };
                }

                if (isRev) {
                  topicDetailsMap[cleanTitle].reviews += 1;
                } else {
                  topicDetailsMap[cleanTitle].studies += 1;
                }
              }
            });
          }
        });
      }
    });

    const filterIncidence = targetCoverage === '85' ? 18 : 14;
    const filteredCanonicalList = canonicalFlatList.filter(c => c.incidence >= filterIncidence);
    const totalCanonicalCount = filteredCanonicalList.length;

    const coveredCount = Object.keys(topicDetailsMap).filter(title => {
      return filteredCanonicalList.some(c => c.title.toLowerCase().trim() === title.toLowerCase().trim());
    }).length;

    const coveragePercentage = Math.round((coveredCount / totalCanonicalCount) * 100);

    return {
      coveredCount,
      totalCanonicalCount,
      coveragePercentage,
      topicDetails: Object.entries(topicDetailsMap).map(([title, info]) => ({
        title,
        ...info
      })).sort((a, b) => (b.incidence || 0) - (a.incidence || 0))
    };
  };

  const analysisStats = getScheduleAnalysisStats();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <RotateCw className="w-8 h-8 text-[#D44E3D] animate-spin" />
        <p className="text-xs text-[#8E8A82] font-mono">Processando matrizes de incidência...</p>
      </div>
    );
  }

  // PREVIEW / DRAFT INTERCEPT PANEL
  if (previewSchedule) {
    const stats = getPlanAnalysisStats();
    const scheduledCount = stats?.scheduledList.length || 0;
    const missingCount = stats?.missingList.length || 0;
    const totalCanonicalCount = stats?.topicsWithStatus.length || 1;
    const coveragePercent = stats?.coveragePercentage || 0;

    // Calculate topics done / total in draft
    let draftTotalTopics = 0;
    let draftDoneTopics = 0;
    previewSchedule.weeks.forEach(w => {
      Object.values(w.days || {}).forEach(arr => {
        if (Array.isArray(arr)) {
          arr.forEach(t => {
            draftTotalTopics++;
            if (t.isCompleted) draftDoneTopics++;
          });
        }
      });
    });
    const draftProgress = draftTotalTopics > 0 ? Math.round((draftDoneTopics / draftTotalTopics) * 100) : 0;

    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-16 px-4 md:px-0">
        {/* PREMIUM HEADER CONTROLS */}
        <div className="bg-white border border-[#E2E0D9] rounded-2xl shadow-xs overflow-hidden">
          <div className="p-6 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                  Rascunho / Pré-visualização
                </span>
              </div>
              <h1 className="text-xl font-bold text-[#1A1A1A] font-display">
                {previewSchedule.exam}
              </h1>
              <p className="text-xs text-stone-500">
                Configure os simulados, ajuste a duração e marque os temas concluídos antes de ativar seu cronograma final.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setPreviewSchedule(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl border border-stone-200 transition-all cursor-pointer"
              >
                Descartar Rascunho
              </button>
              <button
                onClick={saveAndActivateSchedule}
                disabled={generating}
                className="px-5 py-2 bg-[#D44E3D] hover:bg-[#b03f30] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
              >
                {generating ? "Salvando..." : "Salvar e Ativar Cronograma"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-t border-stone-100 bg-stone-50/50">
            <div className="p-4 border-r border-stone-100 text-center">
              <span className="text-[10px] font-mono font-bold text-stone-400 uppercase block">DURAÇÃO</span>
              <span className="text-lg font-extrabold text-stone-800 font-mono">{previewSchedule.weeks.length} Semanas</span>
            </div>
            <div className="p-4 border-r md:border-r border-stone-100 text-center">
              <span className="text-[10px] font-mono font-bold text-stone-400 uppercase block">TOTAL DE TEMAS</span>
              <span className="text-lg font-extrabold text-stone-800 font-mono">{draftTotalTopics} Tópicos</span>
            </div>
            <div className="p-4 border-r border-stone-100 text-center">
              <span className="text-[10px] font-mono font-bold text-stone-400 uppercase block">COBERTURA DA BANCA</span>
              <span className="text-lg font-extrabold text-emerald-600 font-mono">{coveragePercent}%</span>
            </div>
            <div className="p-4 text-center">
              <span className="text-[10px] font-mono font-bold text-stone-400 uppercase block">TEMAS JÁ CONCLUÍDOS</span>
              <span className="text-lg font-extrabold text-stone-700 font-mono">{draftProgress}%</span>
            </div>
          </div>
        </div>

        {/* TAB CONTROLLER */}
        <div className="flex border-b border-stone-200 bg-stone-50 p-1.5 rounded-xl gap-1">
          <button
            onClick={() => setPreviewTab('weeks')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              previewTab === 'weeks' 
                ? 'bg-white text-stone-900 shadow-3xs border border-stone-200' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Semanas & Distribuição
          </button>
          <button
            onClick={() => setPreviewTab('analysis')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              previewTab === 'analysis' 
                ? 'bg-white text-stone-900 shadow-3xs border border-stone-200' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Análise & Incidência da Banca
          </button>
          <button
            onClick={() => setPreviewTab('config')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              previewTab === 'config' 
                ? 'bg-white text-stone-900 shadow-3xs border border-stone-200' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Simulados & Funções
          </button>
          <button
            onClick={() => setPreviewTab('topics')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              previewTab === 'topics' 
                ? 'bg-white text-stone-900 shadow-3xs border border-stone-200' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Duração & Redistribuição
          </button>
        </div>

        {/* TAB 1: WEEKS VIEW */}
        {previewTab === 'weeks' && (
          <div className="space-y-4">
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-sm font-bold text-stone-800 flex items-center justify-center sm:justify-start gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#D44E3D]" />
                  Mapear Tópicos Já Concluídos
                </h3>
                <p className="text-xs text-stone-500">
                  Defina o seu ponto de partida marcando ou desmarcando os tópicos que você já domina.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleAutoSyncStudiedTheory}
                  className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  title="Marca automaticamente como concluídos apenas os tópicos teóricos já estudados no seu histórico MedRevise, sem alterar as semanas de revisão e exercícios."
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  Sincronizar Teoria
                </button>
                <button
                  onClick={() => handleSetAllPreviewTopicsCompleted(false)}
                  className="px-3 py-1.5 bg-white border border-stone-200 text-stone-600 hover:text-stone-800 hover:bg-stone-50 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Limpar Todos
                </button>
                <button
                  onClick={() => handleSetAllPreviewTopicsCompleted(true)}
                  className="px-3 py-1.5 bg-white border border-stone-200 text-[#D44E3D] hover:bg-stone-50 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Marcar Todos
                </button>
              </div>
            </div>

            {/* Weeks Accordion List */}
            <div className="space-y-3">
              {previewSchedule.weeks.map((week, wIdx) => {
                // Count topics in this week
                let wTopicsCount = 0;
                let wCompletedCount = 0;
                Object.values(week.days || {}).forEach(arr => {
                  if (Array.isArray(arr)) {
                    arr.forEach(t => {
                      wTopicsCount++;
                      if (t.isCompleted) wCompletedCount++;
                    });
                  }
                });

                return (
                  <div key={wIdx} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-3xs">
                    {/* Week Header */}
                    <div className="px-5 py-3.5 bg-stone-50/70 border-b border-stone-100 flex justify-between items-center gap-2">
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold text-stone-800 block">Semana {week.weekNumber}</span>
                        <span className="text-[10px] text-stone-400 font-mono uppercase font-bold">
                          {week.priorityTitle || "Estudo Geral"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Weekly Mock indicators */}
                        <div className="flex gap-1">
                          {week.mockExam && (
                            <span className="px-1.5 py-0.5 bg-red-50 text-red-700 text-[8px] font-bold uppercase rounded font-mono border border-red-200/50">
                              S. Semanal
                            </span>
                          )}
                          {week.monthlyMockExam && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-bold uppercase rounded font-mono border border-blue-200/50">
                              S. Mensal
                            </span>
                          )}
                          {week.quarterlyMockExam && (
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[8px] font-bold uppercase rounded font-mono border border-purple-200/50">
                              S. Trimestral
                            </span>
                          )}
                          {week.semiAnnualMockExam && (
                            <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 text-[8px] font-bold uppercase rounded font-mono border border-orange-200/50">
                              S. Semestral
                            </span>
                          )}
                          {week.annualMockExam && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[8px] font-bold uppercase rounded font-mono border border-amber-200/50">
                              S. Anual
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono bg-stone-100 px-2 py-0.5 rounded border border-stone-200/50 font-bold text-stone-600">
                          {wCompletedCount}/{wTopicsCount} temas
                        </span>
                      </div>
                    </div>

                    {/* Week Days list */}
                    <div className="p-5 divide-y divide-stone-100">
                      {Object.entries(week.days || {}).map(([dayName, dayTopics]) => {
                        const studyDayTopics = Array.isArray(dayTopics) ? dayTopics : [];
                        if (studyDayTopics.length === 0) return null;

                        return (
                          <div key={dayName} className="py-3 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start gap-3">
                            <div className="w-20 shrink-0">
                              <span className="text-xs font-extrabold text-[#D44E3D] font-mono tracking-wide">
                                {getDayDisplayName(dayName)}
                              </span>
                            </div>
                            <div className="flex-1 space-y-2">
                              {studyDayTopics.map((topic, tIdx) => {
                                const dbTopic = getMatchedDbTopic(topic.title, topic.topicId, topic.type);

                                return (
                                  <div 
                                    key={tIdx} 
                                    className={`flex items-start justify-between p-2.5 rounded-lg border transition-all ${
                                      topic.isCompleted 
                                        ? "bg-stone-50 border-stone-200/50 text-stone-400" 
                                        : "bg-white border-stone-100 text-stone-800 hover:border-stone-200"
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                      <input
                                        type="checkbox"
                                        checked={!!topic.isCompleted}
                                        onChange={() => handleTogglePreviewTopicCompletion(wIdx, dayName, tIdx)}
                                        className="w-4 h-4 text-[#D44E3D] border-stone-300 rounded focus:ring-[#D44E3D] cursor-pointer mt-0.5 shrink-0"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <span className={`text-xs font-bold leading-tight block ${topic.isCompleted ? 'line-through' : ''}`}>
                                          {topic.title}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                          <span className="text-[10px] text-stone-400 font-mono">
                                            {topic.subjectName} • Incidência: {topic.historicalIncidence}%
                                          </span>
                                        </div>

                                        {/* Forgetting Curve & Accuracy minimalist indicators */}
                                        {dbTopic && (dbTopic.repetitions > 0 || dbTopic.lastReviewDate) && (
                                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                            {(() => {
                                              const retention = calculateEstimatedRetention(dbTopic);
                                              if (retention === null) return null;
                                              let dotColor = 'bg-emerald-500';
                                              let textColor = 'text-emerald-700 bg-emerald-50 border-emerald-100/50';
                                              if (retention < 50) {
                                                dotColor = 'bg-rose-500';
                                                textColor = 'text-rose-700 bg-rose-50 border-rose-100/50';
                                              } else if (retention < 80) {
                                                dotColor = 'bg-amber-500';
                                                textColor = 'text-amber-700 bg-amber-50 border-amber-100/50';
                                              }
                                              return (
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] ${textColor} font-medium`}>
                                                  <span className={`w-1 h-1 rounded-full ${dotColor} animate-pulse`} />
                                                  Retenção: {retention}%
                                                </span>
                                              );
                                            })()}

                                            {(() => {
                                              const acc = dbTopic.accuracyAfterStudy !== undefined
                                                ? dbTopic.accuracyAfterStudy * 100
                                                : dbTopic.accuracyInSimulados !== undefined
                                                ? dbTopic.accuracyInSimulados * 100
                                                : null;
                                              if (acc === null) return null;
                                              let textColor = 'text-stone-600 bg-stone-50 border-stone-200/60';
                                              if (acc >= 80) textColor = 'text-emerald-700 bg-emerald-50 border-emerald-100/50';
                                              else if (acc < 60) textColor = 'text-rose-700 bg-rose-50 border-rose-100/50';
                                              else textColor = 'text-amber-700 bg-amber-50 border-amber-100/50';
                                              return (
                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] ${textColor} font-mono font-bold`}>
                                                  🎯 {Math.round(acc)}% acertos
                                                </span>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase font-bold shrink-0 ml-2 ${
                                      topic.importanceDegree === 'extremo' 
                                        ? 'bg-red-100 text-red-800' 
                                        : topic.importanceDegree === 'alto' 
                                        ? 'bg-amber-100 text-amber-800' 
                                        : 'bg-stone-100 text-stone-700'
                                    }`}>
                                      {topic.importanceDegree}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: COVERAGE & INCIDENCE RANKING */}
        {previewTab === 'analysis' && stats && (
          <div className="space-y-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-stone-800">Mapeamento de Cobertura Estatística</h3>
                  <p className="text-xs text-stone-500">
                    Abaixo estão listados os tópicos mais recorrentes na banca nacional. Em verde estão os incluídos em seu cronograma, em vermelho os que faltam.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono font-bold text-stone-400 uppercase block">COBERTURA ATUAL</span>
                  <span className="text-2xl font-black text-emerald-600 font-mono">{coveragePercent}%</span>
                </div>
              </div>

              {/* Dynamic split panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Scheduled topics (Verde) */}
                <div className="border border-emerald-200 bg-emerald-50/20 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                    <span className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                      Temas Programados ({scheduledCount})
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      Incluídos no Plano
                    </span>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                    {stats.scheduledList.map((topic, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-emerald-100/50 flex justify-between items-center gap-3">
                        <div>
                          <span className="text-xs font-bold text-stone-800 block">{topic.title}</span>
                          <span className="text-[9px] text-stone-400 font-mono">{topic.subject}</span>
                        </div>
                        <span className="text-xs font-extrabold text-emerald-600 font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          {topic.incidence}%
                        </span>
                      </div>
                    ))}
                    {stats.scheduledList.length === 0 && (
                      <p className="text-xs text-stone-400 italic text-center py-6">Nenhum tema mapeado ainda.</p>
                    )}
                  </div>
                </div>

                {/* Missing topics (Vermelho/Amber) */}
                <div className="border border-rose-200 bg-rose-50/10 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                    <span className="text-xs font-extrabold text-rose-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse"></span>
                      Temas Faltantes ({missingCount})
                    </span>
                    <span className="text-[10px] font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 font-bold">
                      Sugestão de Acréscimo
                    </span>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                    {stats.missingList.map((topic, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-stone-200/60 flex justify-between items-center gap-3">
                        <div className="flex-1">
                          <span className="text-xs font-bold text-stone-800 block leading-tight">{topic.title}</span>
                          <span className="text-[9px] text-stone-400 font-mono">{topic.subject}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-rose-600 font-mono bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 shrink-0">
                            {topic.incidence}%
                          </span>
                          <button
                            onClick={() => handleAddTopicToPreview(topic.title, topic.subject, topic.incidence)}
                            className="px-2 py-1 bg-[#D44E3D] hover:bg-[#b03f30] text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shrink-0 animate-pulse hover:animate-none"
                          >
                            + Adicionar
                          </button>
                        </div>
                      </div>
                    ))}
                    {stats.missingList.length === 0 && (
                      <p className="text-xs text-emerald-600 font-bold text-center py-6">Parabéns! Seu cronograma cobre 100% dos temas estatísticos.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SIMULADOS & CONFIGS */}
        {previewTab === 'config' && (
          <div className="space-y-4 bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs">
            <h3 className="text-sm font-bold text-stone-800 border-b border-stone-100 pb-3 flex items-center gap-1.5">
              <Sparkles className="w-4.5 h-4.5 text-[#D44E3D]" />
              Injetar Módulos de Simulado no Cronograma
            </h3>
            <p className="text-xs text-stone-500">
              Personalize o seu cronograma inserindo blocos automáticos de testes simulados em diferentes intervalos. Nosso motor inteligente recalculará e injetará os exames correspondentes de forma transparente.
            </p>

            <div className="space-y-4 pt-2">
              {/* Weekly mock */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition-all">
                <input
                  type="checkbox"
                  checked={previewWeeklyMock}
                  onChange={(e) => handleTogglePreviewMockConfig('weekly', e.target.checked)}
                  className="w-5 h-5 text-[#D44E3D] border-stone-300 rounded focus:ring-[#D44E3D] cursor-pointer mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-stone-800 block">Simulado Semanal (Consolidação de Matéria)</span>
                  <span className="text-xs text-stone-500 block">
                    Adiciona um minisimulado com questões específicas dos temas abordados naquela respectiva semana. Ideal para reter o conteúdo imediato.
                  </span>
                </div>
              </div>

              {/* Monthly mock */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition-all">
                <input
                  type="checkbox"
                  checked={previewMonthlyMock}
                  onChange={(e) => handleTogglePreviewMockConfig('monthly', e.target.checked)}
                  className="w-5 h-5 text-[#D44E3D] border-stone-300 rounded focus:ring-[#D44E3D] cursor-pointer mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-stone-800 block">Simulado Mensal (Revisão Espaçada de Médio Prazo)</span>
                  <span className="text-xs text-stone-500 block">
                    Insere um simulado cumulativo amplo ao final de cada 4 semanas, cobrando matérias de todos os meses anteriores para evitar a curva do esquecimento.
                  </span>
                </div>
              </div>

              {/* Quarterly mock */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition-all">
                <input
                  type="checkbox"
                  checked={previewQuarterlyMock}
                  onChange={(e) => handleTogglePreviewMockConfig('quarterly', e.target.checked)}
                  className="w-5 h-5 text-[#D44E3D] border-stone-300 rounded focus:ring-[#D44E3D] cursor-pointer mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-stone-800 block">Simulado Trimestral (Revisão de Longo Prazo)</span>
                  <span className="text-xs text-stone-500 block">
                    Insere um teste simulado amplo a cada 12 semanas cobrando todo o escopo de temas estudados nos últimos 3 meses.
                  </span>
                </div>
              </div>

              {/* Semi-annual mock */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition-all">
                <input
                  type="checkbox"
                  checked={previewSemiAnnualMock}
                  onChange={(e) => handleTogglePreviewMockConfig('semiannual', e.target.checked)}
                  className="w-5 h-5 text-[#D44E3D] border-stone-300 rounded focus:ring-[#D44E3D] cursor-pointer mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-stone-800 block">Simulado Semestral (Grande Simulado Clínico)</span>
                  <span className="text-xs text-stone-500 block">
                    Insere uma prova simulada com 150 questões de grande profundidade a cada 24 semanas para medir o nível de proficiência em grandes blocos.
                  </span>
                </div>
              </div>

              {/* Annual mock */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition-all">
                <input
                  type="checkbox"
                  checked={previewAnnualMock}
                  onChange={(e) => handleTogglePreviewMockConfig('annual', e.target.checked)}
                  className="w-5 h-5 text-[#D44E3D] border-stone-300 rounded focus:ring-[#D44E3D] cursor-pointer mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-stone-800 block">Simulado Anual (Exame de Residência Geral)</span>
                  <span className="text-xs text-stone-500 block">
                    Insere um mega simulado de consolidação geral ao final do cronograma para treinamento em condições idênticas às das provas de residência médica oficiais.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REDISTRIBUTE WEEKS */}
        {previewTab === 'topics' && (
          <div className="space-y-4 bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs">
            <h3 className="text-sm font-bold text-stone-800 border-b border-stone-100 pb-3 flex items-center gap-1.5">
              <CalendarIcon className="w-4.5 h-4.5 text-[#D44E3D]" />
              Redistribuir Temas e Alterar Duração do Plano
            </h3>
            <p className="text-xs text-stone-500">
              Seu cronograma atual tem <strong className="font-mono">{previewSchedule.weeks.length} semanas</strong>. Se a análise do arquivo importado gerou menos semanas do que o desejado (por exemplo, 3 meses em vez de 42 semanas), você pode selecionar a duração ideal abaixo e redistribuir todos os temas sequencialmente de forma automática!
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
              {[12, 16, 24, 30, 36, 42, 48, 52].map((wCount) => {
                const isCurrent = previewWeeksCount === wCount;
                return (
                  <button
                    key={wCount}
                    onClick={() => setPreviewWeeksCount(wCount)}
                    className={`p-3 border rounded-xl font-mono text-xs font-extrabold transition-all cursor-pointer ${
                      previewWeeksCount === wCount
                        ? 'bg-[#D44E3D] text-white border-[#D44E3D]'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {wCount} semanas
                    <span className="block text-[8px] font-sans font-bold opacity-80 mt-0.5">
                      (~ {Math.round(wCount / 4)} meses)
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => handleRedistributeWeeks(previewWeeksCount)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer font-mono"
              >
                Redistribuir Temas Agora
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Helper variables for month paging
  const totalWeeks = schedule?.weeks.length || 0;
  const totalMonths = Math.ceil(totalWeeks / 4);
  const weeksInActiveMonth = schedule?.weeks.slice((activeMonthFilter - 1) * 4, activeMonthFilter * 4) || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
      {/* PREMIUM HEADER CONTROLS & META */}
      <div className="bg-white border border-[#E2E0D9] rounded-2xl shadow-xs overflow-hidden">
        {/* Title and main header info */}
        <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-white to-stone-50/40">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#D44E3D]/5 text-[#D44E3D] rounded-xl border border-[#D44E3D]/10 shadow-3xs">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#1A1A1A] tracking-tight font-display flex items-center gap-2">
                  Cronograma Inteligente de Estudos
                </h1>
                <p className="text-xs text-[#8E8A82]">
                  Planejamento médico baseado nas estatísticas reais de recorrência das bancas do Brasil.
                </p>
              </div>
            </div>
          </div>

          {/* User Credit Pool Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50/60 border border-amber-200/50 text-amber-900 rounded-xl text-xs font-mono font-bold shadow-3xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500/20" />
            <span>Pool de Créditos:</span>
            <span className="text-amber-700 bg-white px-1.5 py-0.5 rounded border border-amber-200/60">{availableCredits} ⚡</span>
          </div>
        </div>

        {/* Dynamic Context Settings & Dropdowns */}
        <div className="px-6 py-4 bg-stone-50/40 flex flex-wrap items-center justify-between gap-4 border-t border-stone-100">
          {schedules.length > 0 && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold font-mono text-stone-500 uppercase tracking-wider">Cronograma Ativo:</span>
                <div className="relative">
                  <select
                    value={schedule?.id || ''}
                    onChange={(e) => handleSwitchSchedule(e.target.value)}
                    className="appearance-none pr-8 pl-3 py-1.5 text-xs font-bold bg-white border border-[#E2E0D9] hover:border-stone-400 text-stone-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D44E3D] cursor-pointer max-w-xs md:max-w-md truncate shadow-3xs transition-all"
                  >
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.exam} ({s.modality === 'pdf_imported' ? 'PDF' : s.modality === 'dynamic' ? 'Foco Prova' : 'Extensivo'})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-stone-500">
                    <ChevronRight className="w-3.5 h-3.5 transform rotate-90" />
                  </div>
                </div>
              </div>

              {schedules.length < 2 ? (
                <button
                  onClick={() => {
                    const isCompletePlan = profile?.planType === 'combo_ouro' || 
                                            profile?.isLifetimePremium || 
                                            profile?.role === 'admin' || 
                                            profile?.email === 'lucas1renck2melo@gmail.com';
                    if (isCompletePlan) {
                      setShowPlannerWizard(true);
                    } else {
                      showToast("Esta funcionalidade de manter até dois cronogramas ativos simultaneamente é exclusiva do Plano Completo (Combo Ouro).", "error");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-stone-900 to-[#141414] hover:from-black hover:to-stone-900 text-amber-300 text-[11px] font-bold rounded-lg border border-amber-500/30 shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>➕ Novo Cronograma</span>
                  {!(profile?.planType === 'combo_ouro' || profile?.isLifetimePremium || profile?.role === 'admin' || profile?.email === 'lucas1renck2melo@gmail.com') && (
                    <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.2 rounded-sm uppercase tracking-wider scale-90 font-mono">PRO</span>
                  )}
                </button>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/50 px-2.5 py-1 rounded-lg">
                  👑 Limite de 2 Cronogramas Ativos atingido
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MedRevise Sync Preferences Switcher */}
      <div className="bg-white border border-[#E2E0D9] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-200/80 shrink-0">
            <ArrowLeftRight className="w-4 h-4 text-[#D44E3D]" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1.5">
              Integração do Planejamento com o MedRevise
            </span>
            <p className="text-[10.5px] text-stone-500 font-medium">
              Escolha se os estudos do planejamento criam matérias automaticamente no MedRevise ou ficam contidos no MedInternato
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#F4F3EF] p-1 rounded-xl border border-[#E2E0D9] text-xs font-bold">
          <button
            onClick={() => updateSyncMode('ask')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              medReviseSyncMode === 'ask' 
                ? 'bg-white text-[#D44E3D] shadow-2xs font-extrabold' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
            title="Sempre perguntar antes de criar o semestre/matéria no MedRevise"
          >
            Perguntar Antes
          </button>

          <button
            onClick={() => updateSyncMode('sync')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              medReviseSyncMode === 'sync' 
                ? 'bg-white text-emerald-700 shadow-2xs font-extrabold' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
            title="Criar matérias e semestres no MedRevise automaticamente"
          >
            Sincronizar
          </button>

          <button
            onClick={() => updateSyncMode('internato_only')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              medReviseSyncMode === 'internato_only' 
                ? 'bg-white text-amber-800 shadow-2xs font-extrabold' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
            title="Manter o planejamento 100% contido no MedInternato sem criar no MedRevise"
          >
            Apenas MedInternato
          </button>
        </div>
      </div>

      {/* SEGMENTED TAB NAVIGATION */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="border border-stone-200 bg-stone-50/30 p-1 rounded-xl flex overflow-x-auto gap-1 no-scrollbar shadow-3xs flex-1 max-w-full">
          {[
            { id: 'plan', label: 'Plano de Estudo', icon: BookOpen },
            { id: 'all-topics', label: 'Grade de Temas', icon: Clock },
            { id: 'completed-imported', label: 'Feitos no Cronograma 🎯', icon: CheckCircle2 },
            { id: 'analysis', label: 'Análise da IA 🧠', icon: Brain }
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setShowExtraTools(false);
                }}
                className={`relative flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                  isSelected 
                    ? "bg-white text-[#D44E3D] shadow-2xs font-bold border border-stone-200/40" 
                    : "text-stone-600 hover:text-[#1A1A1A] hover:bg-white/40"
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-[#D44E3D]' : 'text-stone-400'}`} />
                <span>{tab.label}</span>
                {isSelected && (
                  <motion.div 
                    layoutId="activeTabUnderline" 
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D44E3D]" 
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Floating expander button for advanced tools */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExtraTools(!showExtraTools)}
          className={`h-11 border-stone-200 font-bold text-xs gap-1.5 rounded-xl shrink-0 transition-all duration-305 ${
            showExtraTools 
              ? "bg-stone-100 text-[#D44E3D] border-[#D44E3D]/30" 
              : "bg-white text-stone-700 hover:text-stone-900"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Ferramentas & Conexões</span>
          <ChevronRight className={`w-3.5 h-3.5 transform transition-transform duration-300 ${showExtraTools ? 'rotate-90 text-[#D44E3D]' : 'rotate-0 text-stone-400'}`} />
        </Button>
      </div>

      {/* COLLAPSIBLE TOOLS BENTO GRID */}
      <AnimatePresence>
        {showExtraTools && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-br from-[#FAF9F5]/40 to-stone-50/20 border border-stone-200/70 rounded-2xl p-4 md:p-5 shadow-3xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Bento Card 1: Importar Faculdade */}
                <button
                  onClick={() => {
                    setActiveTab('college-sync');
                    setShowExtraTools(false);
                  }}
                  className={`text-left p-4 rounded-xl border transition-all duration-300 group hover:scale-[1.02] hover:shadow-2xs flex flex-col justify-between h-[115px] ${
                    activeTab === 'college-sync'
                      ? "bg-[#D44E3D]/5 border-[#D44E3D]/30"
                      : "bg-white border-stone-150 hover:border-stone-350"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600 group-hover:bg-amber-100 transition-colors">
                      <Sparkles className="w-4 h-4 fill-amber-500/10" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest group-hover:text-stone-500">FACULDADE</span>
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1">
                      Priorizar Faculdade
                      <ArrowRight className="w-3 h-3 text-stone-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </h4>
                    <p className="text-[10px] text-stone-500 line-clamp-1">Sincronize matérias do internato e provas</p>
                  </div>
                </button>

                {/* Bento Card 2: Sincronizar Calendário */}
                <button
                  onClick={() => {
                    setActiveTab('calendar-sync');
                    setShowExtraTools(false);
                  }}
                  className={`text-left p-4 rounded-xl border transition-all duration-300 group hover:scale-[1.02] hover:shadow-2xs flex flex-col justify-between h-[115px] ${
                    activeTab === 'calendar-sync'
                      ? "bg-[#D44E3D]/5 border-[#D44E3D]/30"
                      : "bg-white border-stone-150 hover:border-stone-350"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <CalendarIcon className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest group-hover:text-stone-500">AGENDA</span>
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1">
                      Exportar Calendário
                      <ArrowRight className="w-3 h-3 text-stone-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </h4>
                    <p className="text-[10px] text-stone-500 line-clamp-1">Agende semanas no seu planner mensal</p>
                  </div>
                </button>

                {/* Bento Card 3: Pesos de Prova */}
                <button
                  onClick={() => {
                    setActiveTab('incidence');
                    setShowExtraTools(false);
                  }}
                  className={`text-left p-4 rounded-xl border transition-all duration-300 group hover:scale-[1.02] hover:shadow-2xs flex flex-col justify-between h-[115px] ${
                    activeTab === 'incidence'
                      ? "bg-[#D44E3D]/5 border-[#D44E3D]/30"
                      : "bg-white border-stone-150 hover:border-stone-350"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600 group-hover:bg-purple-100 transition-colors">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest group-hover:text-stone-500">ESTATÍSTICAS</span>
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1">
                      Pesos de Prova
                      <ArrowRight className="w-3 h-3 text-stone-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </h4>
                    <p className="text-[10px] text-stone-500 line-clamp-1">Veja os pesos históricos das 5 grandes áreas</p>
                  </div>
                </button>

                {/* Bento Card 4: Metodologia Médica */}
                <button
                  onClick={() => {
                    setActiveTab('methodology');
                    setShowExtraTools(false);
                  }}
                  className={`text-left p-4 rounded-xl border transition-all duration-300 group hover:scale-[1.02] hover:shadow-2xs flex flex-col justify-between h-[115px] ${
                    activeTab === 'methodology'
                      ? "bg-[#D44E3D]/5 border-[#D44E3D]/30"
                      : "bg-white border-stone-150 hover:border-stone-350"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <div className="p-2 bg-rose-50 rounded-lg text-rose-600 group-hover:bg-rose-100 transition-colors">
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest group-hover:text-stone-500">CIÊNCIA</span>
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1">
                      Metodologia Científica
                      <ArrowRight className="w-3 h-3 text-stone-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </h4>
                    <p className="text-[10px] text-stone-500 line-clamp-1">Neurociência, Ebbinghaus e curva de fixação</p>
                  </div>
                </button>
              </div>

              {/* Collapsible drawer footer: Dangerous zone hidden neatly */}
              {schedule && (
                <div className="pt-3.5 border-t border-stone-200/60 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <span className="text-[10px] text-stone-400 font-mono flex items-center gap-1">
                    <Settings className="w-3.5 h-3.5 text-stone-400 animate-spin-slow" />
                    Zona de Configurações do Cronograma Ativo
                  </span>
                  <Button 
                    variant="outline" 
                    size="xs"
                    onClick={() => {
                      handleDeleteSchedule();
                      setShowExtraTools(false);
                    }}
                    className="text-red-600 hover:bg-red-50/70 hover:text-red-750 border-red-200/80 hover:border-red-300 text-[10px] font-mono uppercase tracking-wider font-bold h-8 rounded-xl px-4 bg-white shadow-3xs transition-all"
                  >
                    Resetar Plano Ativo
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Return Banner if active tab is a secondary advanced view */}
      {['college-sync', 'calendar-sync', 'incidence', 'methodology'].includes(activeTab) && (
        <div className="bg-[#1A1A1A] text-white px-5 py-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D44E3D] animate-pulse shrink-0" />
            <p className="text-xs font-medium">
              Você está visualizando <strong className="font-bold">{
                activeTab === 'college-sync' ? 'Priorização do Internato 🎓' :
                activeTab === 'calendar-sync' ? 'Sincronizador de Calendário 📅' :
                activeTab === 'incidence' ? 'Incidência de Provas 📊' : 'Estatísticas de Metodologia 💡'
              }</strong>.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setActiveTab('plan')}
            className="bg-white hover:bg-stone-100 text-stone-900 text-xs font-bold px-4 py-2 rounded-xl gap-1.5 shrink-0 transition-all border border-stone-200"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-stone-600" />
            Voltar ao Plano de Estudos
          </Button>
        </div>
      )}

      <AnimatePresence mode="wait">
        
        {/* VIEW 1: ACTIVE PLAN STUDY */}
        {activeTab === 'plan' && schedule && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* PANORAMA GERAL COMPACTO / EXPANSIBILIDADE */}
            {!infoExpanded ? (
              <Card className="border-[#E2E0D9] shadow-2xs bg-white overflow-hidden hover:border-stone-300 transition-all duration-300">
                <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Left Column: Basic Title & Subtitle */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#D44E3D]/5 text-[#D44E3D] flex items-center justify-center shrink-0 border border-[#D44E3D]/10">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-[#1A1A1A] tracking-tight">
                          Preparatório {schedule.exam}
                        </h2>
                        <span className="text-[9px] font-bold font-mono text-[#D44E3D] bg-[#D44E3D]/5 px-2 py-0.5 rounded border border-[#D44E3D]/10">
                          ATIVO
                        </span>
                      </div>
                      <p className="text-xs text-[#8E8A82]">
                        Plano calibrado por peso estatístico • {schedule.hoursPerDay}h/dia • {
                          schedule.modality === '6meses' ? '6 Meses (Intensivo)' : 
                          schedule.modality === '1ano' ? '1 Ano (Extensivo)' : 
                          schedule.modality === '2anos' ? '2 Anos (Longo Prazo)' : 
                          schedule.modality === 'dynamic' && schedule.examDate ? `Até Prova (${new Date(schedule.examDate).toLocaleDateString('pt-BR')})` :
                          schedule.modality
                        }
                      </p>
                    </div>
                  </div>

                  {/* Center Column: Quick Progress Stats */}
                  <div className="flex flex-wrap items-center gap-4 text-xs w-full md:w-auto">
                    {/* General Progress */}
                    <div className="flex items-center gap-2.5 bg-stone-50/80 px-3 py-1.5 rounded-lg border border-stone-200/60">
                      <span className="text-[10px] text-stone-500 font-mono font-bold uppercase">Conclusão:</span>
                      <strong className="text-[#D44E3D] font-black font-mono">{dynamicProgress}%</strong>
                      <div className="w-16 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div className="bg-[#D44E3D] h-full" style={{ width: `${dynamicProgress}%` }} />
                      </div>
                    </div>

                    {/* Cobertura */}
                    <div className="flex items-center gap-2.5 bg-indigo-50/20 px-3 py-1.5 rounded-lg border border-indigo-100/40">
                      <span className="text-[10px] text-indigo-700 font-mono font-bold uppercase">Edital:</span>
                      <strong className="text-indigo-800 font-black font-mono">{displayCoverage}%</strong>
                      <div className="w-16 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full" style={{ width: `${displayCoverage}%` }} />
                      </div>
                    </div>

                    {/* Ciclos status */}
                    <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-stone-600 font-mono font-bold bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/50">
                      <Brain className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{hasCycle3 ? "3 Ciclos Liberados" : hasCycle2 ? "2 Ciclos Liberados" : "1 Ciclo Base"}</span>
                    </div>
                  </div>

                  {/* Right Column: Expand Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInfoExpanded(true)}
                    className="border-[#E2E0D9] text-[#1A1A1A] hover:bg-stone-50 hover:text-[#D44E3D] hover:border-stone-400 font-bold text-xs h-9 shrink-0 w-full md:w-auto flex items-center justify-center gap-1.5"
                  >
                    Exibir Métricas & Método ➔
                  </Button>
                </div>
              </Card>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* PANORAMA GERAL DO CRONOGRAMA (DASHBOARD HEADER) */}
                <Card className="border-[#E2E0D9] shadow-sm overflow-hidden bg-white">
                  <div className="bg-[#FAF9F5] border-b border-[#E2E0D9] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-bold text-[#D44E3D] bg-[#D44E3D]/5 px-2.5 py-0.5 rounded-full border border-[#D44E3D]/10">
                        PLANO DE ESTUDOS ATIVO 🎯
                      </span>
                      <h2 className="text-xl font-bold text-[#1A1A1A] tracking-tight font-display">
                        Preparatório {schedule.exam}
                      </h2>
                      <p className="text-xs text-[#8E8A82]">
                        Planejamento de alto rendimento calibrado de acordo com o peso estatístico de cada tema.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-stone-100 px-3 py-2 rounded-xl border border-stone-200 text-center min-w-[100px]">
                        <span className="text-[9px] font-mono text-stone-500 uppercase block">Duração</span>
                        <strong className="text-xs font-bold text-stone-800">
                          {schedule.modality === '6meses' ? '6 Meses (Intensivo)' : 
                           schedule.modality === '1ano' ? '1 Ano (Extensivo)' : 
                           schedule.modality === '2anos' ? '2 Anos (Longo Prazo)' : 
                           schedule.modality === 'dynamic' && schedule.examDate ? `Até Prova (${new Date(schedule.examDate).toLocaleDateString('pt-BR')})` :
                           schedule.modality}
                        </strong>
                      </div>
                      <div className="bg-stone-100 px-3 py-2 rounded-xl border border-stone-200 text-center min-w-[100px]">
                        <span className="text-[9px] font-mono text-stone-500 uppercase block">Carga Diária</span>
                        <strong className="text-xs font-bold text-stone-800">{schedule.hoursPerDay}h / dia</strong>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInfoExpanded(false)}
                        className="text-stone-500 hover:text-[#D44E3D] hover:bg-[#D44E3D]/5 font-mono text-xs font-bold shrink-0 self-center h-8"
                      >
                        Ocultar Painel ✖
                      </Button>
                    </div>
                  </div>

                  <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gradient-to-br from-white to-[#FBFBFA]/50">
                    {/* PROGRESSO GERAL BAR */}
                    <div className="space-y-2 bg-stone-50/50 p-4 rounded-xl border border-[#E2E0D9]/60">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-[#D44E3D]" />
                          Conclusão Geral do Plano
                        </span>
                        <span className="text-sm font-black text-[#D44E3D] font-mono">{dynamicProgress}%</span>
                      </div>
                      <Progress value={dynamicProgress} className="h-2 bg-stone-200" />
                      <p className="text-[10px] text-stone-500 font-mono">
                        Mapeia todos os temas do seu edital concluídos e revisados.
                      </p>
                    </div>

                    {/* COBERTURA DO EDITAL BAR */}
                    <div className="space-y-2 bg-indigo-50/10 p-4 rounded-xl border border-indigo-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-indigo-600" />
                          Cobertura Estimada do Edital
                        </span>
                        <span className="text-sm font-black text-indigo-700 font-mono">{displayCoverage}%</span>
                      </div>
                      <Progress value={displayCoverage} className="h-2 bg-indigo-100" />
                      <p className="text-[10px] text-indigo-600 font-mono">
                        Grau de profundidade do edital que será coberto na data da prova.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* PAINEL DE CICLOS COGNITIVOS COMPLEMENTARES (COMPACT STEPPER) */}
                <div className="bg-white border border-[#E2E0D9] rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-indigo-600" />
                        Etapas de Aprendizado • Ciclos de Fixação
                      </h3>
                      <p className="text-xs text-stone-600 font-bold">
                        Sua jornada de memorização em 3 passagens progressivas:
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setCiclosCollapsed(!ciclosCollapsed)}
                      className="text-indigo-600 hover:text-indigo-700 font-mono text-[11px] font-bold p-0 h-auto flex items-center gap-1"
                    >
                      {ciclosCollapsed ? "Ver Detalhes do Método ➔" : "Ocultar Detalhes ✖"}
                    </Button>
                  </div>

                  {/* Horizonal Stepper */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {/* CICLO 1 STEP */}
                    <div className="border border-emerald-100 rounded-xl p-3 bg-emerald-50/20 flex items-center gap-3 justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          1
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900">Teoria & Prática Base</h4>
                          <p className="text-[10px] text-stone-500">Ciclo Ativo • Progresso: {dynamicProgress}%</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-emerald-100/50 text-emerald-800 border-emerald-200 text-[9px] font-mono font-bold shrink-0">
                        ATIVO
                      </Badge>
                    </div>

                    {/* CICLO 2 STEP */}
                    <div className={`border rounded-xl p-3 flex items-center gap-3 justify-between transition-all ${
                      hasCycle2 
                        ? "border-indigo-100 bg-indigo-50/20" 
                        : "border-stone-100 bg-stone-50/40 opacity-70"
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                          hasCycle2 ? "bg-indigo-600 text-white" : "bg-stone-200 text-stone-500"
                        }`}>
                          {hasCycle2 ? "2" : "🔒"}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900">Questões Avançadas</h4>
                          <p className="text-[10px] text-stone-500">{hasCycle2 ? "Desbloqueado com sucesso!" : "Requer mais carga horária"}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[9px] font-mono font-bold shrink-0 ${
                        hasCycle2 
                          ? "bg-indigo-100/50 text-indigo-800 border-indigo-200" 
                          : "bg-stone-100 text-stone-500 border-stone-200"
                      }`}>
                        {hasCycle2 ? "LIBERADO" : "BLOQUEADO"}
                      </Badge>
                    </div>

                    {/* CICLO 3 STEP */}
                    <div className={`border rounded-xl p-3 flex items-center gap-3 justify-between transition-all ${
                      hasCycle3 
                        ? "border-purple-100 bg-purple-50/20" 
                        : "border-stone-100 bg-stone-50/40 opacity-70"
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                          hasCycle3 ? "bg-purple-600 text-white" : "bg-stone-200 text-stone-500"
                        }`}>
                          {hasCycle3 ? "3" : "🔒"}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900">Revisão & Maestria</h4>
                          <p className="text-[10px] text-stone-500">{hasCycle3 ? "Pronto para memorização total!" : "Carga horária reduzida"}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[9px] font-mono font-bold shrink-0 ${
                        hasCycle3 
                          ? "bg-purple-100/50 text-purple-800 border-purple-200" 
                          : "bg-stone-100 text-stone-500 border-stone-200"
                      }`}>
                        {hasCycle3 ? "LIBERADO" : "BLOQUEADO"}
                      </Badge>
                    </div>
                  </div>

                  {/* Collapsed view detailed breakdown */}
                  {!ciclosCollapsed && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-stone-100"
                    >
                      {/* CICLO 1 DETAILS */}
                      <div className="border border-stone-200 rounded-xl p-4 space-y-2 bg-stone-50/40">
                        <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                          Ciclo 1: Teoria & Prática Base
                        </span>
                        <p className="text-[11px] text-stone-500 leading-relaxed">
                          Construção do fundamento teórico do edital de residência. Estudo estruturado de cada tema com questões diagnósticas e revisão síncrona.
                        </p>
                        <div className="pt-1">
                          <Progress value={dynamicProgress} className="h-1 bg-emerald-600" />
                          <span className="text-[10px] font-mono text-stone-400 mt-1 block">Progresso: {dynamicProgress}%</span>
                        </div>
                      </div>

                      {/* CICLO 2 DETAILS */}
                      <div className={`border rounded-xl p-4 space-y-2 bg-stone-50/40 ${!hasCycle2 && "opacity-75"}`}>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                          hasCycle2 ? "text-indigo-700 bg-indigo-50 border-indigo-200" : "text-stone-500 bg-stone-100 border-stone-200"
                        }`}>
                          Ciclo 2: Questões Avançadas
                        </span>
                        <p className="text-[11px] text-[#8E8A82] leading-relaxed">
                          Sessões de aprofundamento focadas em pegadinhas e distorções comuns das bancas regionais, resolvendo as questões mais complexas.
                        </p>
                        {!hasCycle2 ? (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[9px] text-amber-900 leading-normal font-mono">
                            ⚠️ <strong>Tempo reduzido:</strong> Aumente as horas diárias ou mude a modalidade de estudo para programar este ciclo complementar!
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-indigo-600 block font-bold">✨ Programado com sucesso no cronograma!</span>
                        )}
                      </div>

                      {/* CICLO 3 DETAILS */}
                      <div className={`border rounded-xl p-4 space-y-2 bg-stone-50/40 ${!hasCycle3 && "opacity-75"}`}>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                          hasCycle3 ? "text-purple-700 bg-purple-50 border-purple-200" : "text-stone-500 bg-stone-100 border-stone-200"
                        }`}>
                          Ciclo 3: Revisão & Maestria
                        </span>
                        <p className="text-[11px] text-stone-500 leading-relaxed">
                          Revisões super ativas focadas na curva de esquecimento, flashcards calibrados por IA e preenchimento de lacunas de desempenho.
                        </p>
                        {!hasCycle3 ? (
                          <div className="p-2 bg-[#FAF0E6] border border-amber-200 rounded text-[9px] text-[#b45309] leading-normal font-mono">
                            ⚠️ Aumente a intensidade de estudos nas Configurações para cobrir o edital mais rápido e programar este ciclo de maestria!
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-purple-600 block font-bold">🏆 Programado com sucesso no cronograma!</span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {schedule.currentSemesterSubjects && schedule.currentSemesterSubjects.length > 0 && (
              <div className="bg-stone-50 border border-stone-200/60 rounded-xl p-4 flex items-start gap-2.5">
                <Sparkles className="w-4.5 h-4.5 text-amber-500 fill-amber-500/10 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-stone-900 font-mono uppercase">Semestre Acadêmico / Internato Priorizado:</p>
                  <p className="text-[11px] text-stone-600">
                    O plano organizou a grade de estudos para cobrir prioritariamente as matérias do seu semestre da faculdade: <strong className="text-stone-800">{schedule.currentSemesterSubjects.join(', ')}</strong>. Todas as demais matérias da prova de residência foram perfeitamente distribuídas ao longo das {schedule.weeks.length} semanas de preparação.
                  </p>
                </div>
              </div>
            )}

            {/* MONTH-BASED WEEK PAGINATION CONTAINER */}
            <div className="bg-white border border-[#E2E0D9] rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-[#FBFBFA] border-b border-[#E2E0D9] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                
                {/* Month navigation */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-[10px] font-bold font-mono text-[#8E8A82] shrink-0">PÁGINA DO PLANO:</span>
                  <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
                    <button
                      disabled={activeMonthFilter === 1}
                      onClick={() => {
                        setActiveMonthFilter(prev => Math.max(1, prev - 1));
                        setActiveWeekIndex((activeMonthFilter - 2) * 4);
                      }}
                      className="p-1 rounded-md hover:bg-white disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 text-[#1A1A1A]" />
                    </button>
                    <span className="text-xs font-bold font-mono text-stone-700 min-w-[70px] text-center">
                      Mês {activeMonthFilter} / {totalMonths}
                    </span>
                    <button
                      disabled={activeMonthFilter === totalMonths}
                      onClick={() => {
                        setActiveMonthFilter(prev => Math.min(totalMonths, prev + 1));
                        setActiveWeekIndex((activeMonthFilter) * 4);
                      }}
                      className="p-1 rounded-md hover:bg-white disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-4 h-4 text-[#1A1A1A]" />
                    </button>
                  </div>
                </div>

                {/* Week Buttons of selected Month */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold font-mono text-[#8E8A82]">SEMANAS:</span>
                  <div className="flex gap-1">
                    {weeksInActiveMonth.map((wk) => {
                      const absoluteIndex = (activeMonthFilter - 1) * 4 + schedule.weeks.indexOf(wk) - schedule.weeks.indexOf(weeksInActiveMonth[0]);
                      const actualWeekIndex = (activeMonthFilter - 1) * 4 + (schedule.weeks.indexOf(wk) % 4);
                      const isSelected = activeWeekIndex === wk.weekNumber - 1;
                      return (
                        <button
                          key={`week-${wk.weekNumber}-${absoluteIndex}`}
                          onClick={() => setActiveWeekIndex(wk.weekNumber - 1)}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                            isSelected 
                              ? "bg-[#D44E3D] text-white shadow-sm" 
                              : "bg-white border border-[#E2E0D9] text-[#1A1A1A] hover:bg-stone-50"
                          }`}
                        >
                          S{wk.weekNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="xs"
                    onClick={handleJumpToToday}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-500/20 text-xs font-bold"
                    title="Navegar imediatamente para a semana e dia de hoje"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Ir para Hoje
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => setShowRestructureModal(true)}
                    className="bg-[#D44E3D]/5 hover:bg-[#D44E3D]/10 text-[#D44E3D] border border-[#D44E3D]/10 text-xs font-bold"
                  >
                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                    Recuperar Atraso
                  </Button>
                  <Button
                    size="xs"
                    onClick={handleExtendFutureRevisions}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold shadow-2xs"
                    title="Adiciona +4 semanas ao final do cronograma trazendo todas as revisões R2 e R3 no espaçamento Ebbinghaus correto"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1 text-indigo-600 fill-indigo-600/20" />
                    Adiantar Revisões (+4 Semanas)
                  </Button>
                </div>
              </div>

              {/* CURRENT WEEK DETAILS */}
              <div className="p-6 border-b border-[#E2E0D9] bg-stone-50/20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#1A1A1A] tracking-tight">
                      Semana {activeWeekIndex + 1} de {totalWeeks} - Foco: {schedule.weeks[activeWeekIndex]?.priorityTitle}
                    </h2>
                    <p className="text-xs text-[#8E8A82]">
                      Cronograma adaptado ao peso estatístico. Complete os tópicos e assinale os ciclos de revisão.
                    </p>
                  </div>
                  <Badge className="bg-[#D44E3D]/10 text-[#D44E3D] border-[#D44E3D]/20 hover:bg-[#D44E3D]/10 text-[10px] font-mono px-2.5 py-0.5">
                    Módulo Ativo
                  </Badge>
                </div>
              </div>

              {/* DAILY DISTRIBUTIONS WITH PREMIUM VIEW MODES */}
              {/* VIEW SWITCHER AND WEEKLY PROGRESS */}
              <div className="bg-[#FBFBFA] border-y border-[#E2E0D9] px-6 py-3 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <span className="text-[10px] font-bold font-mono text-[#8E8A82] tracking-wider">EXIBIÇÃO:</span>
                  <div className="inline-flex rounded-xl border border-[#E2E0D9] p-0.5 bg-stone-100">
                    <button
                      onClick={() => setStudyViewMode('focused')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${
                        studyViewMode === 'focused'
                          ? "bg-white text-[#1A1A1A] shadow-xs font-bold"
                          : "text-stone-500 hover:text-stone-900"
                      }`}
                    >
                      Dia Focado (Linha do Tempo)
                    </button>
                    <button
                      onClick={() => setStudyViewMode('grid')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${
                        studyViewMode === 'grid'
                          ? "bg-white text-[#1A1A1A] shadow-xs font-bold"
                          : "text-stone-500 hover:text-stone-900"
                      }`}
                    >
                      Semana Completa (Grade)
                    </button>
                  </div>
                </div>

                {/* Inline Legend */}
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-stone-600 font-mono font-bold bg-white px-3 py-1.5 rounded-lg border border-stone-200/60">
                  <span className="text-stone-400 font-normal mr-1">Peso da Prova:</span>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-red-500 shrink-0" />
                    <span>Extrema (≥25%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-amber-500 shrink-0" />
                    <span>Alta (22-24%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-blue-500 shrink-0" />
                    <span>Média (18-21%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-stone-400 shrink-0" />
                    <span>Baixa (&lt;18%)</span>
                  </div>
                </div>

                <div className="text-[11px] text-stone-600 font-medium font-mono shrink-0">
                  Progresso Semanal: <strong className="text-[#D44E3D] font-bold">{
                    (() => {
                      const days = schedule.weeks[activeWeekIndex]?.days || {};
                      const allTopics = Object.values(days).flat();
                      const completedCount = allTopics.filter(t => isTopicDone(t)).length;
                      return `${completedCount} de ${allTopics.length}`;
                    })()
                  } concluídos</strong>
                </div>
              </div>

              {/* Day selection tabs for Focused Day mode */}
              {studyViewMode === 'focused' && (
                <div className="px-6 pt-5 pb-1 flex flex-wrap gap-1.5 bg-stone-50/10 border-b border-stone-100">
                  {getOrderedDaysForWeek(schedule.studyDays, (schedule as any).startDate).map((dayName) => {
                    const topicsArr = schedule.weeks[activeWeekIndex]?.days[dayName] || [];
                    const stats = (() => {
                      const completed = topicsArr.filter(t => isTopicDone(t)).length;
                      return {
                        completed,
                        total: topicsArr.length,
                        isAllDone: topicsArr.length > 0 && completed === topicsArr.length
                      };
                    })();
                    const isSelected = activeDayTab === dayName;
                    return (
                      <button
                        key={dayName}
                        onClick={() => setActiveDayTab(dayName)}
                        className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-300 ${
                          isSelected
                            ? "border-transparent text-white shadow-sm"
                            : stats.isAllDone
                              ? "bg-emerald-50 border-emerald-150 text-emerald-800 hover:bg-emerald-100/50"
                              : "bg-white border-[#E2E0D9] text-stone-700 hover:bg-stone-50 hover:text-stone-900"
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="activeDayBackground"
                            className="absolute inset-0 bg-[#D44E3D] rounded-xl z-0"
                            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                          />
                        )}
                        <span className="font-display relative z-10">
                          {getDayDisplayName(dayName)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold relative z-10 ${
                          isSelected 
                            ? "bg-white/20 text-white" 
                            : stats.isAllDone 
                              ? "bg-emerald-100 text-emerald-800" 
                              : "bg-stone-100 text-stone-600"
                        }`}>
                          {stats.completed}/{stats.total}
                        </span>
                        {stats.isAllDone && (
                          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 relative z-10 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="p-6 space-y-6">
                {/* STUDY DAYS GRID/FOCUSED TIMELINE */}
                {studyViewMode === 'focused' ? (
                  // Focused single day view
                  <div className="space-y-4">
                    {(() => {
                      const dayName = activeDayTab;
                      const topicsArr = schedule.weeks[activeWeekIndex]?.days[dayName] || [];
                      return (
                        <div className="border border-[#E2E0D9] rounded-2xl p-6 bg-gradient-to-br from-white to-[#FBFBFA]/40 shadow-sm space-y-4">
                          <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                            <span className="text-sm font-bold text-[#1A1A1A] font-display flex items-center gap-2">
                              <Clock className="w-4 h-4 text-[#D44E3D]" />
                              Timeline de Estudos: {getDayDisplayName(dayName, true)}
                            </span>
                            <span className="text-xs text-[#8E8A82] font-mono bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200">
                              {schedule.hoursPerDay}h recomendadas
                            </span>
                          </div>

                          {topicsArr.length === 0 ? (
                            <div className="space-y-6">
                              <p className="text-xs text-stone-500 italic py-4 text-center">Consolidação de questões e revisões de longo prazo programadas para hoje.</p>
                              
                              {/* DYNAMIC STUDY ADVANCEMENT SECTION WHEN TODAY IS EMPTY */}
                              {(() => {
                                const upcoming = upcomingIncompleteTopics;
                                if (upcoming.length === 0) return null;
                                return (
                                  <div className="pt-6 border-t border-stone-150">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Sparkles className="w-4 h-4 text-[#D44E3D]" />
                                      <h4 className="text-xs font-bold font-display text-[#1A1A1A] uppercase tracking-wider">
                                        Adiantar Próximas Matérias de Estudo ➔
                                      </h4>
                                    </div>
                                    <p className="text-[11px] text-stone-500 mb-4 leading-relaxed">
                                      Você já terminou suas tarefas programadas para hoje! Mantenha a alta performance adiantando temas futuros de forma estratégica.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      {upcoming.map(({ topic, weekIdx, dayName, originalIdx }, uIdx) => (
                                        <div 
                                          key={`upcoming-a-${uIdx}-${weekIdx}-${originalIdx}-${topic.title}`}
                                          className="p-3 bg-[#FBFBFA] rounded-xl border border-stone-200 flex flex-col justify-between gap-3 hover:border-stone-300 transition-all duration-300"
                                        >
                                          <div>
                                            <div className="flex flex-wrap gap-1 mb-1">
                                              <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200/50 px-1 py-0.5 rounded">
                                                Semana {weekIdx + 1}
                                              </span>
                                              <span className="text-[9px] font-bold bg-stone-100 text-stone-700 px-1 py-0.5 rounded uppercase font-mono">
                                                {getDayDisplayName(dayName)}
                                              </span>
                                            </div>
                                            <h5 className="text-[11px] font-bold text-stone-800 line-clamp-2 leading-snug">
                                              {topic.title}
                                            </h5>
                                            <span className="text-[9px] font-mono font-medium text-stone-500 block mt-1">
                                              {topic.subjectName}
                                            </span>
                                          </div>
                                          
                                          <Button
                                            size="sm"
                                            onClick={() => handleAdvanceTopicToToday(topic, weekIdx, dayName, originalIdx)}
                                            className="w-full bg-[#D44E3D] hover:bg-[#b83c2c] text-white text-[10px] font-bold h-7 rounded-lg shadow-2xs flex items-center justify-center gap-1"
                                          >
                                            Puxar para Hoje <ArrowRight className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4">
                              {getSortedTopics(topicsArr).map((topic, sortedIdx) => {
                                const tIdx = topicsArr.findIndex(t => t.title === topic.title);
                                const tType = topic.type || 'estudo';
                                const tIncidence = topic.historicalIncidence || 15;
                                const tImportance = topic.importanceDegree || (
                                  tIncidence >= 25 ? 'extremo' : tIncidence >= 22 ? 'alto' : tIncidence >= 18 ? 'medio' : 'baixo'
                                );

                                let borderLeftClass = "border-l-4 border-l-stone-300";
                                let importanceBadgeColor = "bg-stone-50 text-stone-600 border-stone-200";
                                let importanceText = "Secundário";
                                
                                if (tImportance === 'extremo') {
                                  borderLeftClass = "border-l-4 border-l-red-500 shadow-xs";
                                  importanceBadgeColor = "bg-red-50 text-red-700 border-red-200 font-bold";
                                  importanceText = "🚨 CRÍTICO";
                                } else if (tImportance === 'alto') {
                                  borderLeftClass = "border-l-4 border-l-amber-500 shadow-xs";
                                  importanceBadgeColor = "bg-amber-50 text-amber-800 border-amber-200 font-bold";
                                  importanceText = "🔥 RECORRÊNCIA ALTA";
                                } else if (tImportance === 'medio') {
                                  borderLeftClass = "border-l-4 border-l-blue-500";
                                  importanceBadgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                                  importanceText = "📊 RECORRÊNCIA MÉDIA";
                                }

                                const isRescheduled = !!topic.isRescheduled;

                                return (
                                  <div 
                                    key={`sorted-topic-${sortedIdx}-${topic.title}-${tType}`} 
                                    className={`p-5 rounded-2xl border transition-all duration-300 hover:shadow-sm ${borderLeftClass} ${
                                      isTopicDone(topic) 
                                        ? "bg-stone-50/70 border-stone-200/60 opacity-80" 
                                        : isRescheduled
                                          ? "bg-amber-50/40 border-amber-300/80 ring-1 ring-amber-400/20 hover:border-amber-400 shadow-3xs"
                                          : tType === 'revisao'
                                            ? "bg-purple-50/10 border-purple-150/30 hover:bg-purple-50/20"
                                            : "bg-white border-[#E2E0D9] hover:border-stone-400"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="space-y-2 flex-1">
                                        {/* UNIFIED SINGLE COHESIVE METADATA LINE WITH PRIORITY BADGE */}
                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] font-mono text-stone-500 font-medium">
                                          {isTopicDone(topic) ? (
                                            <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md text-[9px] font-mono font-black tracking-wider uppercase shadow-3xs flex items-center gap-1">
                                              ✓ Concluído
                                            </span>
                                          ) : (
                                            (() => {
                                              const firstIncompleteGlobal = firstIncompleteTopicOfWeek;
                                              const isFirstIncompleteOverall = firstIncompleteGlobal && firstIncompleteGlobal.dayName === dayName && firstIncompleteGlobal.title === topic.title;
                                              if (isFirstIncompleteOverall) {
                                                return (
                                                  <span className="bg-[#D44E3D] text-white px-2 py-0.5 rounded-md text-[9px] font-mono font-black tracking-wider uppercase shadow-3xs">
                                                    {sortedIdx + 1}º Fazer Primeiro
                                                  </span>
                                                );
                                              } else {
                                                return (
                                                  <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[9px] font-mono font-black tracking-wider uppercase shadow-3xs">
                                                    {sortedIdx + 1}º A Seguir
                                                  </span>
                                                );
                                              }
                                            })()
                                          )}
                                          {isRescheduled && !isTopicDone(topic) && (
                                            <span className="bg-amber-100/90 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider uppercase shadow-3xs flex items-center gap-1">
                                              <RefreshCw className="w-2.5 h-2.5 text-amber-700" /> Atraso Recalculado
                                            </span>
                                          )}
                                          <span className="font-bold text-stone-700 uppercase tracking-wide bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">{topic.subjectName}</span>
                                          <span className="text-stone-300">•</span>
                                          <span className="flex items-center gap-1 font-bold text-[#b45309]">
                                            {tType === 'revisao' ? '🔄 REVISÃO ATIVA' : '📖 ESTUDO TEÓRICO'}
                                          </span>
                                          <span className="text-stone-300">•</span>
                                          <span className="flex items-center gap-1 font-bold">
                                            <span className={`w-1.5 h-1.5 rounded-full ${tImportance === 'extremo' ? 'bg-red-500 animate-pulse' : tImportance === 'alto' ? 'bg-amber-500' : tImportance === 'medio' ? 'bg-blue-500' : 'bg-stone-400'}`} />
                                            {tImportance === 'extremo' ? 'Incidência Extrema' : tImportance === 'alto' ? 'Incidência Alta' : tImportance === 'medio' ? 'Incidência Média' : 'Incidência Baixa'}
                                          </span>
                                          <span className="text-stone-300">•</span>
                                          <span className="text-indigo-600 font-bold">{tIncidence}% Peso de Prova</span>
                                        </div>

                                        <h3 className={`text-sm font-bold leading-snug tracking-tight transition-all duration-300 ${
                                          isTopicDone(topic) ? 'line-through text-stone-400 font-normal' : 'text-[#1A1A1A]'
                                        }`}>
                                          {topic.title.replace('Revisão Ativa + Flashcards: ', '')}
                                        </h3>

                                        {/* Forgetting Curve & MedRevise Integration Row */}
                                        {(() => {
                                          const dbTopic = getMatchedDbTopic(topic.title, topic.topicId, topic.type);
                                          return (
                                            <div className="mt-2.5 space-y-2">
                                              {/* Retention & Accuracy Minimalist Indicators */}
                                              {dbTopic && (dbTopic.repetitions > 0 || dbTopic.lastReviewDate) && (
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                  {(() => {
                                                    const retention = calculateEstimatedRetention(dbTopic);
                                                    if (retention === null) return null;
                                                    let dotColor = 'bg-emerald-500';
                                                    let textColor = 'text-emerald-700 bg-emerald-50 border-emerald-100/50';
                                                    if (retention < 50) {
                                                      dotColor = 'bg-rose-500';
                                                      textColor = 'text-rose-700 bg-rose-50 border-rose-100/50';
                                                    } else if (retention < 80) {
                                                      dotColor = 'bg-amber-500';
                                                      textColor = 'text-amber-700 bg-amber-50 border-amber-100/50';
                                                    }
                                                    return (
                                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] ${textColor} font-medium`}>
                                                        <span className={`w-1 h-1 rounded-full ${dotColor} animate-pulse`} />
                                                        Curva: {retention}% Retenção
                                                      </span>
                                                    );
                                                  })()}

                                                  {(() => {
                                                    const acc = dbTopic.accuracyAfterStudy !== undefined
                                                      ? dbTopic.accuracyAfterStudy * 100
                                                      : dbTopic.accuracyInSimulados !== undefined
                                                      ? dbTopic.accuracyInSimulados * 100
                                                      : null;
                                                    if (acc === null) return null;
                                                    let textColor = 'text-stone-600 bg-stone-50 border-stone-200/60';
                                                    if (acc >= 80) textColor = 'text-emerald-700 bg-emerald-50 border-emerald-100/50';
                                                    else if (acc < 60) textColor = 'text-rose-700 bg-rose-50 border-rose-100/50';
                                                    else textColor = 'text-amber-700 bg-amber-50 border-amber-100/50';
                                                    return (
                                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] ${textColor} font-mono font-bold`}>
                                                        🎯 {Math.round(acc)}% acertos
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                              )}

                                              {/* Binding status & actions */}
                                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-stone-500">
                                                {dbTopic ? (
                                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-medium ${
                                                    topic.topicId 
                                                      ? "bg-indigo-50 border-indigo-100 text-indigo-700" 
                                                      : "bg-stone-50 border-stone-100 text-stone-600"
                                                  }`}>
                                                    <LinkIcon className="w-2.5 h-2.5" />
                                                    {topic.topicId ? "Vinculado" : "Mapeado Automático"}
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-amber-100 bg-amber-50/50 text-amber-700 text-[9px] font-medium">
                                                    ⚠️ Não vinculado
                                                  </span>
                                                )}

                                                <button
                                                  onClick={() => {
                                                    setLinkingTopic({
                                                      weekIdx: activeWeekIndex,
                                                      dayName,
                                                      topicIdx: tIdx,
                                                      title: topic.title,
                                                      currentLinkedId: topic.topicId
                                                    });
                                                    setTopicLinkSearch(topic.title);
                                                  }}
                                                  className="hover:text-indigo-600 font-bold transition-colors flex items-center gap-0.5"
                                                >
                                                  {topic.topicId ? "Alterar vínculo" : "Vincular ao MedRevise"}
                                                </button>

                                                <span className="text-stone-300 hidden sm:inline">|</span>
                                                <button
                                                  onClick={() => {
                                                    if (dbTopic?.id) {
                                                      localStorage.setItem('cross_app_nav_topic_id', dbTopic.id);
                                                    } else {
                                                      localStorage.removeItem('cross_app_nav_topic_id');
                                                    }
                                                    localStorage.setItem('cross_app_nav_topic_title', topic.title);
                                                    localStorage.setItem('was_navigated_from_internato', 'true');
                                                    window.dispatchEvent(new CustomEvent('switch-mode', { detail: 'revise' }));
                                                  }}
                                                  className="hover:text-[#D44E3D] text-[#D44E3D] font-bold transition-colors flex items-center gap-0.5"
                                                >
                                                  Ver no MedRevise →
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>

                                      <button 
                                        onClick={() => handleToggleTopic(activeWeekIndex, dayName, tIdx)}
                                        className={`p-2 rounded-xl border transition-all duration-200 shrink-0 ${
                                          isTopicDone(topic) 
                                            ? "bg-emerald-500 text-white border-emerald-600 shadow-sm scale-105" 
                                            : "bg-white border-[#E2E0D9] text-stone-300 hover:text-[#D44E3D] hover:border-[#D44E3D] hover:bg-[#D44E3D]/5"
                                        }`}
                                        title={isTopicDone(topic) ? "Marcar como não concluído" : "Concluir tópico"}
                                      >
                                        <Check className="w-4 h-4 stroke-[3px]" />
                                      </button>
                                    </div>

                                    {/* UNIFIED PREMIUM INTERACTIVE FOOTER */}
                                    <div className="mt-4 pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleContinueStudy(topic, 'topicDetail')}
                                          disabled={studyingTopicTitle === topic.title}
                                          className="h-8 text-[11px] font-bold text-amber-900 border-amber-300/80 bg-amber-50 hover:bg-amber-100/90 rounded-lg px-2.5 flex items-center gap-1 shrink-0 transition-all shadow-2xs"
                                          title="Ver o Resumo Teórico Interativo do Tópico"
                                        >
                                          {studyingTopicTitle === topic.title ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                                              Acessando...
                                            </>
                                          ) : (
                                            <>
                                              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                                              📖 Ver Resumo
                                            </>
                                          )}
                                        </Button>

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleContinueStudy(topic, 'questions')}
                                          disabled={studyingTopicTitle === topic.title}
                                          className="h-8 text-[11px] font-bold text-indigo-900 border-indigo-300/80 bg-indigo-50 hover:bg-indigo-100/90 rounded-lg px-2.5 flex items-center gap-1 shrink-0 transition-all shadow-2xs"
                                          title="Fazer Questões direcionadas para este Tópico"
                                        >
                                          <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600/20" />
                                          ⚡ Questões
                                        </Button>

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleContinueStudy(topic, 'flashcards')}
                                          disabled={studyingTopicTitle === topic.title}
                                          className="h-8 text-[11px] font-bold text-purple-900 border-purple-300/80 bg-purple-50 hover:bg-purple-100/90 rounded-lg px-2.5 flex items-center gap-1 shrink-0 transition-all shadow-2xs"
                                          title="Abrir Flashcards para Memorização Ativa"
                                        >
                                          <Layers className="w-3.5 h-3.5 text-purple-600" />
                                          🎴 Flashcards
                                        </Button>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                                        <span className="text-[10px] text-stone-400 font-mono flex items-center gap-1">
                                          <Clock className="w-3.5 h-3.5" />
                                          Revisões:
                                        </span>
                                        <div className="flex gap-1">
                                          {[
                                            { key: '24h', label: '24h', active: topic.review24h },
                                            { key: '7d', label: '7d', active: topic.review7d },
                                            { key: '30d', label: '30d', active: topic.review30d }
                                          ].map((rev) => (
                                            <button
                                              key={rev.key}
                                              onClick={() => handleToggleReview(activeWeekIndex, dayName, tIdx, rev.key as '24h' | '7d' | '30d')}
                                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all duration-200 ${
                                                rev.active 
                                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-3xs" 
                                                  : "bg-white text-stone-500 border-stone-200 hover:bg-stone-50 hover:border-stone-300 hover:text-stone-700"
                                              }`}
                                            >
                                              {rev.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* DYNAMIC STUDY ADVANCEMENT SECTION AT THE BOTTOM OF THE DAY LIST */}
                              {(() => {
                                const upcoming = upcomingIncompleteTopics;
                                if (upcoming.length === 0) return null;
                                return (
                                  <div className="mt-8 pt-6 border-t-2 border-dashed border-stone-200">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Sparkles className="w-4 h-4 text-[#D44E3D] animate-pulse" />
                                      <h4 className="text-xs font-bold font-display text-[#1A1A1A] uppercase tracking-wider">
                                        Adiantar Estudos (Acelerar Cronograma) 🚀
                                      </h4>
                                    </div>
                                    <p className="text-[11px] text-stone-500 mb-4 leading-relaxed">
                                      Quer ir além da sua meta de hoje? Você pode puxar os próximos temas programados no seu cronograma para estudar e registrar hoje de forma integrada.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      {upcoming.map(({ topic, weekIdx, dayName, originalIdx }, uIdx) => (
                                        <div 
                                          key={`upcoming-b-${uIdx}-${topic.title}`}
                                          className="p-3 bg-[#FBFBFA]/80 rounded-xl border border-stone-200 flex flex-col justify-between gap-3 hover:border-stone-300 hover:bg-[#FBFBFA] transition-all duration-300"
                                        >
                                          <div>
                                            <div className="flex flex-wrap gap-1 mb-1">
                                              <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200/50 px-1 py-0.5 rounded">
                                                Semana {weekIdx + 1}
                                              </span>
                                              <span className="text-[9px] font-bold bg-stone-100 text-stone-700 px-1 py-0.5 rounded uppercase font-mono">
                                                {getDayDisplayName(dayName)}
                                              </span>
                                            </div>
                                            <h5 className="text-[11px] font-bold text-stone-800 line-clamp-2 leading-snug">
                                              {topic.title}
                                            </h5>
                                            <span className="text-[9px] font-mono font-medium text-stone-500 block mt-1">
                                              {topic.subjectName}
                                            </span>
                                          </div>
                                          
                                          <Button
                                            size="sm"
                                            onClick={() => handleAdvanceTopicToToday(topic, weekIdx, dayName, originalIdx)}
                                            className="w-full bg-[#D44E3D] hover:bg-[#b83c2c] text-white text-[10px] font-bold h-7 rounded-lg shadow-2xs flex items-center justify-center gap-1"
                                          >
                                            Puxar para Hoje <ArrowRight className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  // Full grid view of all days stacked
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getOrderedDaysForWeek(schedule.studyDays, (schedule as any).startDate).map((dayName) => {
                      const topicsArr = schedule.weeks[activeWeekIndex]?.days[dayName] || [];
                      return (
                        <div key={dayName} className="border border-[#E2E0D9] rounded-2xl p-4 bg-gradient-to-br from-white to-[#FBFBFA]/50 shadow-xs space-y-3">
                          <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                            <span className="text-xs font-bold text-[#1A1A1A] font-display flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#D44E3D]" />
                              {getDayDisplayName(dayName, true)}
                            </span>
                            <span className="text-[10px] text-stone-500 font-mono">{schedule.hoursPerDay}h recomendadas</span>
                          </div>

                          {topicsArr.length === 0 ? (
                            <p className="text-xs text-stone-400 italic py-2 text-center">Consolidação e revisões de longo prazo.</p>
                          ) : (
                            <div className="space-y-3">
                              {getSortedTopics(topicsArr).map((topic, sortedIdx) => {
                                const tIdx = topicsArr.findIndex(t => t.title === topic.title);
                                const tType = topic.type || 'estudo';
                                const tIncidence = topic.historicalIncidence || 15;
                                const tImportance = topic.importanceDegree || (
                                  tIncidence >= 25 ? 'extremo' : tIncidence >= 22 ? 'alto' : tIncidence >= 18 ? 'medio' : 'baixo'
                                );

                                let borderLeftClass = "border-l-4 border-l-stone-300";
                                let importanceBadgeColor = "bg-stone-50 text-stone-600 border-stone-200";
                                let importanceText = "Secundário";
                                
                                if (tImportance === 'extremo') {
                                  borderLeftClass = "border-l-4 border-l-red-500 shadow-2xs";
                                  importanceBadgeColor = "bg-red-50 text-red-700 border-red-200 font-bold";
                                  importanceText = "🚨 CRÍTICO";
                                } else if (tImportance === 'alto') {
                                  borderLeftClass = "border-l-4 border-l-amber-500 shadow-2xs";
                                  importanceBadgeColor = "bg-amber-50 text-amber-800 border-amber-200 font-bold";
                                  importanceText = "🔥 ALTA RECORRÊNCIA";
                                } else if (tImportance === 'medio') {
                                  borderLeftClass = "border-l-4 border-l-blue-500";
                                  importanceBadgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                                  importanceText = "📊 RECORRÊNCIA MÉDIA";
                                }

                                const isRescheduledGrid = !!topic.isRescheduled;

                                return (
                                  <div 
                                    key={`sorted-grid-${sortedIdx}-${topic.title}`} 
                                    className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-2xs ${borderLeftClass} ${
                                      isTopicDone(topic) 
                                        ? "bg-stone-50/70 border-stone-200/60 opacity-80" 
                                        : isRescheduledGrid
                                          ? "bg-amber-50/40 border-amber-300/80 ring-1 ring-amber-400/20 hover:border-amber-400"
                                          : tType === 'revisao'
                                            ? "bg-purple-50/10 border-purple-100/30 hover:bg-purple-50/20"
                                            : "bg-white border-[#E2E0D9] hover:border-stone-400"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-1.5 flex-1">
                                        {/* UNIFIED COMPACT METADATA LINE FOR GRID VIEW */}
                                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-stone-500 font-medium">
                                          {isTopicDone(topic) ? (
                                            <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[8px] font-mono font-black tracking-wider uppercase">
                                              ✓ Concluído
                                            </span>
                                          ) : (
                                            (() => {
                                              const firstIncompleteGlobal = firstIncompleteTopicOfWeek;
                                              const isFirstIncompleteOverall = firstIncompleteGlobal && firstIncompleteGlobal.dayName === dayName && firstIncompleteGlobal.title === topic.title;
                                              if (isFirstIncompleteOverall) {
                                                return (
                                                  <span className="bg-[#D44E3D] text-white px-1.5 py-0.5 rounded text-[8px] font-mono font-black tracking-wider uppercase">
                                                    {sortedIdx + 1}º Fazer Primeiro
                                                  </span>
                                                );
                                              } else {
                                                return (
                                                  <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[8px] font-mono font-black tracking-wider uppercase">
                                                    {sortedIdx + 1}º A Seguir
                                                  </span>
                                                );
                                              }
                                            })()
                                          )}
                                          {isRescheduledGrid && !isTopicDone(topic) && (
                                            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider uppercase flex items-center gap-1">
                                              <RefreshCw className="w-2 h-2 text-amber-700" /> Recalculado
                                            </span>
                                          )}
                                          <span className="font-bold text-stone-700 uppercase tracking-tight bg-stone-100 px-1 py-0.5 rounded border border-stone-150">{topic.subjectName}</span>
                                          <span className="text-stone-300">•</span>
                                          <span className="font-bold text-[#b45309]">
                                            {tType === 'revisao' ? '🔄 REVISÃO' : '📖 ESTUDO'}
                                          </span>
                                          <span className="text-stone-300">•</span>
                                          <span className="text-indigo-600 font-bold">{tIncidence}% Peso</span>
                                        </div>

                                        <h3 className={`text-xs font-bold leading-tight transition-all duration-300 ${
                                          isTopicDone(topic) ? 'line-through text-stone-400 font-normal' : 'text-[#1A1A1A]'
                                        }`}>
                                          {topic.title.replace('Revisão Ativa + Flashcards: ', '')}
                                        </h3>

                                        {/* Forgetting Curve & MedRevise Integration Row */}
                                        {(() => {
                                          const dbTopic = getMatchedDbTopic(topic.title, topic.topicId, topic.type);
                                          return (
                                            <div className="mt-1.5 space-y-1">
                                              {/* Retention & Accuracy Minimalist Indicators */}
                                              {dbTopic && (dbTopic.repetitions > 0 || dbTopic.lastReviewDate) && (
                                                <div className="flex flex-wrap items-center gap-1">
                                                  {(() => {
                                                    const retention = calculateEstimatedRetention(dbTopic);
                                                    if (retention === null) return null;
                                                    let dotColor = 'bg-emerald-500';
                                                    let textColor = 'text-emerald-700 bg-emerald-50 border-emerald-100/50';
                                                    if (retention < 50) {
                                                      dotColor = 'bg-rose-500';
                                                      textColor = 'text-rose-700 bg-rose-50 border-rose-100/50';
                                                    } else if (retention < 80) {
                                                      dotColor = 'bg-amber-500';
                                                      textColor = 'text-amber-700 bg-amber-50 border-amber-100/50';
                                                    }
                                                    return (
                                                      <span className={`inline-flex items-center gap-1 px-1 py-0.5 rounded border text-[8px] ${textColor} font-medium`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
                                                        Curva: {retention}%
                                                      </span>
                                                    );
                                                  })()}

                                                  {(() => {
                                                    const acc = dbTopic.accuracyAfterStudy !== undefined
                                                      ? dbTopic.accuracyAfterStudy * 100
                                                      : dbTopic.accuracyInSimulados !== undefined
                                                      ? dbTopic.accuracyInSimulados * 100
                                                      : null;
                                                    if (acc === null) return null;
                                                    let textColor = 'text-stone-600 bg-stone-50 border-stone-200/60';
                                                    if (acc >= 80) textColor = 'text-emerald-700 bg-emerald-50 border-emerald-100/50';
                                                    else if (acc < 60) textColor = 'text-rose-700 bg-rose-50 border-rose-100/50';
                                                    else textColor = 'text-amber-700 bg-amber-50 border-amber-100/50';
                                                    return (
                                                      <span className={`inline-flex items-center px-1 py-0.5 rounded border text-[8px] ${textColor} font-mono font-bold`}>
                                                        🎯 {Math.round(acc)}%
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                              )}

                                              {/* Binding status & actions */}
                                              <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-stone-500">
                                                {dbTopic ? (
                                                  <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[8px] font-medium ${
                                                    topic.topicId 
                                                      ? "bg-indigo-50 border-indigo-100 text-indigo-700" 
                                                      : "bg-stone-50 border-stone-100 text-stone-600"
                                                  }`}>
                                                    <LinkIcon className="w-2 h-2" />
                                                    {topic.topicId ? "Vinculado" : "Auto"}
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded border border-amber-100 bg-amber-50/50 text-amber-700 text-[8px] font-medium">
                                                    ⚠️ Sem vínculo
                                                  </span>
                                                )}

                                                <button
                                                  onClick={() => {
                                                    setLinkingTopic({
                                                      weekIdx: activeWeekIndex,
                                                      dayName,
                                                      topicIdx: tIdx,
                                                      title: topic.title,
                                                      currentLinkedId: topic.topicId
                                                    });
                                                    setTopicLinkSearch(topic.title);
                                                  }}
                                                  className="hover:text-indigo-600 font-bold transition-colors"
                                                >
                                                  {topic.topicId ? "Mudar" : "Vincular"}
                                                </button>

                                                <span className="text-stone-300 hidden sm:inline">|</span>
                                                <button
                                                  onClick={() => {
                                                    if (dbTopic?.id) {
                                                      localStorage.setItem('cross_app_nav_topic_id', dbTopic.id);
                                                    } else {
                                                      localStorage.removeItem('cross_app_nav_topic_id');
                                                    }
                                                    localStorage.setItem('cross_app_nav_topic_title', topic.title);
                                                    localStorage.setItem('was_navigated_from_internato', 'true');
                                                    window.dispatchEvent(new CustomEvent('switch-mode', { detail: 'revise' }));
                                                  }}
                                                  className="hover:text-[#D44E3D] text-[#D44E3D] font-bold transition-colors"
                                                >
                                                  Ver no MedRevise →
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>

                                      <button 
                                        onClick={() => handleToggleTopic(activeWeekIndex, dayName, tIdx)}
                                        className={`p-1.5 rounded-lg border transition-all duration-200 shrink-0 ${
                                          isTopicDone(topic) 
                                            ? "bg-emerald-500 text-white border-emerald-600 shadow-sm scale-105" 
                                            : "bg-white border-[#E2E0D9] text-stone-300 hover:text-[#D44E3D] hover:border-[#D44E3D]"
                                        }`}
                                        title={isTopicDone(topic) ? "Marcar não concluído" : "Concluir"}
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                      </button>
                                    </div>

                                    {/* UNIFIED COMPACT FOOTER FOR GRID VIEW */}
                                    <div className="mt-3 pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleContinueStudy(topic, 'topicDetail')}
                                          disabled={studyingTopicTitle === topic.title}
                                          className="h-7 text-[9px] font-bold uppercase bg-amber-50 text-amber-900 border-amber-300/80 hover:bg-amber-100 rounded-lg px-2 py-0 flex items-center gap-1 shrink-0"
                                          title="Ver Resumo Teórico"
                                        >
                                          {studyingTopicTitle === topic.title ? (
                                            <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-600" />
                                          ) : (
                                            <BookOpen className="w-2.5 h-2.5 text-amber-700" />
                                          )}
                                          Resumo
                                        </Button>

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleContinueStudy(topic, 'questions')}
                                          disabled={studyingTopicTitle === topic.title}
                                          className="h-7 text-[9px] font-bold uppercase bg-indigo-50 text-indigo-900 border-indigo-300/80 hover:bg-indigo-100 rounded-lg px-2 py-0 flex items-center gap-1 shrink-0"
                                          title="Fazer Questões"
                                        >
                                          <Zap className="w-2.5 h-2.5 text-indigo-600 fill-indigo-600/20" />
                                          Questões
                                        </Button>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <span className="text-[9px] text-stone-400 font-mono hidden sm:inline">Revisões:</span>
                                        <div className="flex gap-1">
                                          {[
                                            { key: '24h', label: '24h', active: topic.review24h },
                                            { key: '7d', label: '7d', active: topic.review7d },
                                            { key: '30d', label: '30d', active: topic.review30d }
                                          ].map((rev) => (
                                            <button
                                              key={rev.key}
                                              onClick={() => handleToggleReview(activeWeekIndex, dayName, tIdx, rev.key as '24h' | '7d' | '30d')}
                                              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-black border transition-all duration-200 ${
                                                rev.active 
                                                  ? "bg-emerald-500 text-white border-emerald-600 shadow-2xs" 
                                                  : "bg-white text-stone-400 border-stone-150 hover:bg-stone-50 hover:border-stone-250 hover:text-stone-700"
                                              }`}
                                            >
                                              {rev.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* WEEKLY & MONTHLY MOCK EXAMS (SIMULADOS) */}
                {(() => {
                  const weeklyMock = schedule.weeks[activeWeekIndex]?.mockExam || {
                    title: `Simulado de Consolidação Semanal - Semana ${activeWeekIndex + 1}`,
                    questionsCount: 50,
                    isCompleted: false
                  };
                  const monthlyMock = schedule.weeks[activeWeekIndex]?.monthlyMockExam || {
                    title: `Simulado de Consolidação Mensal - Mês ${Math.floor(activeWeekIndex / 4) + 1}`,
                    questionsCount: 100,
                    isCompleted: false
                  };

                  const currentMockExam = simuladoTab === 'weekly' ? weeklyMock : monthlyMock;
                  const currentTopics = simuladoTab === 'weekly' ? getWeekTopics(activeWeekIndex) : getMonthTopics(activeWeekIndex);
                  const isCompleted = currentMockExam.isCompleted;

                  return (
                    <div className="border border-[#D44E3D]/20 rounded-xl p-5 bg-[#D44E3D]/5 space-y-5">
                      {/* Tab Switcher */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#D44E3D]/10 pb-4">
                        <div className="flex bg-stone-100 p-1 rounded-xl gap-1">
                          <button
                            type="button"
                            onClick={() => setSimuladoTab('weekly')}
                            className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                              simuladoTab === 'weekly' 
                                ? 'bg-[#D44E3D] text-white shadow-xs' 
                                : 'text-stone-500 hover:text-stone-800'
                            }`}
                          >
                            Simulado Semanal (50 Qs)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimuladoTab('monthly')}
                            className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                              simuladoTab === 'monthly' 
                                ? 'bg-[#D44E3D] text-white shadow-xs' 
                                : 'text-stone-500 hover:text-stone-800'
                            }`}
                          >
                            Simulado Mensal (100 Qs)
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            if (simuladoTab === 'weekly') {
                              handleToggleMockExam(activeWeekIndex, !weeklyMock.isCompleted);
                            } else {
                              handleToggleMonthlyMockExam(activeWeekIndex, !monthlyMock.isCompleted);
                            }
                          }}
                          className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isCompleted
                              ? "bg-[#D44E3D] text-white border-[#D44E3D]"
                              : "bg-white border-[#D44E3D]/20 text-[#D44E3D] hover:bg-white/50"
                          }`}
                        >
                          {isCompleted ? 'Reiniciar Simulado' : 'Marcar Concluído'}
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#D44E3D] block">
                            {simuladoTab === 'weekly' ? 'META DE DESEMPENHO SEMANAL' : 'META DE DESEMPENHO MENSAL'}
                          </span>
                          <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-[#D44E3D]" />
                            {simuladoTab === 'weekly' 
                              ? `Simulado de Consolidação Semanal - Semana ${activeWeekIndex + 1}`
                              : `Simulado de Consolidação Mensal - Mês ${Math.floor(activeWeekIndex / 4) + 1} (Semanas ${(Math.floor(activeWeekIndex / 4) * 4) + 1} a ${(Math.floor(activeWeekIndex / 4) * 4) + 4})`
                            }
                          </h3>
                          <p className="text-xs text-[#8E8A82]">
                            {simuladoTab === 'weekly' 
                              ? `Este simulado consolida todos os tópicos estudados nesta semana. Realize 50 questões de provas passadas sobre os temas estudados.`
                              : `Este simulado consolida todos os tópicos estudados neste mês (bloco de 4 semanas). Realize 100 questões de provas passadas abrangendo todos os temas estudados no período.`
                            }
                          </p>
                        </div>

                        {!isCompleted ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-white/70 border border-[#D44E3D]/10 rounded-lg space-y-3">
                              <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide flex items-center gap-1">
                                <SlidersHorizontal className="w-3.5 h-3.5 text-[#D44E3D]" />
                                Configuração Recomendada no MedInternato
                              </h4>
                              
                              <div className="text-xs text-[#1A1A1A] space-y-2">
                                <p>Siga o caminho abaixo para realizar este simulado manualmente ou use o atalho automático:</p>
                                <ol className="list-decimal pl-4 space-y-1 text-[#8E8A82] text-[11px]">
                                  <li>Navegue até a aba <strong className="text-[#1A1A1A]">Questões</strong> no painel esquerdo.</li>
                                  <li>Filtre a seleção de questões marcando estes tópicos estudados {simuladoTab === 'weekly' ? 'nesta semana' : 'neste mês'}:</li>
                                  <div className="flex flex-wrap gap-1 mt-1.5 mb-1.5 max-h-[120px] overflow-y-auto p-1 border border-stone-150 rounded bg-stone-50">
                                    {currentTopics.map((title, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded-full text-[10px] border border-stone-200">
                                        {title}
                                      </span>
                                    ))}
                                  </div>
                                  <li>Configure o total de <strong className="text-[#1A1A1A]">{simuladoTab === 'weekly' ? 50 : 100} questões</strong>.</li>
                                  <li>Inicie o simulado para averiguar seu nível de retenção!</li>
                                </ol>
                              </div>

                              <div className="pt-3 flex flex-col sm:flex-row gap-2">
                                <button
                                  onClick={() => handleLaunchMockExam(activeWeekIndex, simuladoTab === 'monthly')}
                                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#D44E3D] hover:bg-[#c34333] text-white font-mono font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 fill-white/20" />
                                  Fazer Simulado no MedInternato (Configuração Automática)
                                </button>
                              </div>
                            </div>

                            {/* SECTION FOR SELECTING SCORE RECORDING METHOD */}
                            <div className="bg-white/80 border border-[#D44E3D]/10 rounded-xl p-4 space-y-4 shadow-sm">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                                <div className="space-y-0.5">
                                  <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5 text-[#D44E3D]" />
                                    Registrar Resultados do Simulado
                                  </h4>
                                  <p className="text-[10px] text-stone-500">Escolha a modalidade de preenchimento para salvar suas métricas.</p>
                                </div>

                                <div className="flex bg-stone-100 p-1 rounded-lg gap-1 self-start sm:self-center">
                                  <button
                                    onClick={() => setIsDetailedFill(true)}
                                    type="button"
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                      isDetailedFill 
                                        ? 'bg-[#D44E3D] text-white shadow-xs' 
                                        : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                  >
                                    por Tópico (Completo)
                                  </button>
                                  <button
                                    onClick={() => setIsDetailedFill(false)}
                                    type="button"
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                      !isDetailedFill 
                                        ? 'bg-[#D44E3D] text-white shadow-xs' 
                                        : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                  >
                                    Rápido (Nota Geral)
                                  </button>
                                </div>
                              </div>

                              {isDetailedFill ? (
                                <div className="space-y-4">
                                  <p className="text-[11px] text-stone-600">
                                    Preencha a quantidade de questões feitas e os seus acertos em cada tema. O sistema computará sua nota final automaticamente e gerará um relatório detalhado de erros por tópico com insights de revisão.
                                  </p>

                                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                    {currentTopics.map((title, idx) => {
                                      const inputVal = topicPerformanceInputs[title] || { total: 5, correct: 5 };
                                      const successRate = inputVal.total > 0 ? Math.round((inputVal.correct / inputVal.total) * 100) : 0;
                                      
                                      const statusColor = successRate >= 75 
                                        ? "text-emerald-700 bg-emerald-50 border-emerald-100" 
                                        : successRate >= 60 
                                          ? "text-amber-700 bg-amber-50 border-amber-100" 
                                          : "text-rose-700 bg-rose-50 border-rose-100";
                                      
                                      return (
                                        <div key={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 bg-stone-50 border border-stone-200/50 rounded-lg">
                                          <div className="space-y-0.5 md:max-w-[45%]">
                                            <span className="text-xs font-bold text-stone-800 block leading-tight">{title}</span>
                                            <span className="text-[10px] text-stone-500 font-mono block">Rendimento estimado: {successRate}%</span>
                                          </div>

                                          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                            {/* Questions Count counter */}
                                            <div className="flex items-center bg-white border border-stone-200 rounded-md overflow-hidden h-7 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const nextTotal = Math.max(1, inputVal.total - 1);
                                                  const nextCorrect = Math.min(inputVal.correct, nextTotal);
                                                  setTopicPerformanceInputs({
                                                    ...topicPerformanceInputs,
                                                    [title]: { total: nextTotal, correct: nextCorrect }
                                                  });
                                                }}
                                                className="px-2 text-stone-500 hover:bg-stone-100 h-full font-bold text-xs cursor-pointer"
                                              >
                                                -
                                              </button>
                                              <span className="px-2 text-xs font-mono font-bold text-stone-700 min-w-[20px] text-center">{inputVal.total} Qs</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const nextTotal = inputVal.total + 1;
                                                  setTopicPerformanceInputs({
                                                    ...topicPerformanceInputs,
                                                    [title]: { total: nextTotal, correct: inputVal.correct }
                                                  });
                                                }}
                                                className="px-2 text-stone-500 hover:bg-stone-100 h-full font-bold text-xs cursor-pointer"
                                              >
                                                +
                                              </button>
                                            </div>

                                            {/* Correct count counter */}
                                            <div className="flex items-center bg-white border border-stone-200 rounded-md overflow-hidden h-7 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const nextCorrect = Math.max(0, inputVal.correct - 1);
                                                  setTopicPerformanceInputs({
                                                    ...topicPerformanceInputs,
                                                    [title]: { total: inputVal.total, correct: nextCorrect }
                                                  });
                                                }}
                                                className="px-2 text-stone-500 hover:bg-stone-100 h-full font-bold text-xs cursor-pointer"
                                              >
                                                -
                                              </button>
                                              <span className="px-2 text-xs font-mono font-bold text-stone-700 min-w-[20px] text-center">{inputVal.correct} acertos</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const nextCorrect = Math.min(inputVal.total, inputVal.correct + 1);
                                                  setTopicPerformanceInputs({
                                                    ...topicPerformanceInputs,
                                                    [title]: { total: inputVal.total, correct: nextCorrect }
                                                  });
                                                }}
                                                className="px-2 text-stone-500 hover:bg-stone-100 h-full font-bold text-xs cursor-pointer"
                                              >
                                                +
                                              </button>
                                            </div>

                                            {/* Visual status */}
                                            <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded border min-w-[75px] text-center shrink-0 ${statusColor}`}>
                                              {successRate >= 75 ? "Excelente" : successRate >= 60 ? "Regular" : "Insuficiente"}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (simuladoTab === 'weekly') {
                                        handleSaveDetailedTopicPerformance(activeWeekIndex);
                                      } else {
                                        handleSaveDetailedMonthlyPerformance(activeWeekIndex);
                                      }
                                    }}
                                    className="w-full py-2 bg-[#D44E3D] hover:bg-[#c34333] text-white font-mono text-xs font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Registrar e Gerar Diagnóstico de Erros por Tópico
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <span className="text-[11px] text-stone-600 block">Qual foi o seu rendimento unificado global aproximado?</span>
                                  <div className="flex flex-wrap gap-1">
                                    {[50, 60, 70, 80, 90, 100].map(score => (
                                      <button
                                        key={score}
                                        type="button"
                                        onClick={() => {
                                          if (simuladoTab === 'weekly') {
                                            handleSelectScore(activeWeekIndex, score);
                                          } else {
                                            handleSelectMonthlyScore(activeWeekIndex, score);
                                          }
                                        }}
                                        className="px-3 py-1.5 rounded bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 font-mono text-xs font-bold transition-all cursor-pointer"
                                      >
                                        {score}%
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-4 border-t border-[#D44E3D]/10 space-y-4">
                            {/* GLOBAL SCORE BANNER */}
                            <div className="p-4 rounded-lg border bg-white space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold font-mono tracking-wider text-stone-500 uppercase">DIAGNÓSTICO MÉDICO DE RENDIMENTO ({simuladoTab === 'weekly' ? 'SEMANAL' : 'MENSAL'})</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-stone-500">Nota Global:</span>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                                    (currentMockExam.score || 0) >= 80
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                      : (currentMockExam.score || 0) >= 70
                                        ? "bg-amber-50 border-amber-200 text-amber-800"
                                        : "bg-rose-50 border-rose-200 text-rose-800"
                                  }`}>
                                    {currentMockExam.score || 0}% - {
                                      (currentMockExam.score || 0) >= 80
                                        ? "Excelente"
                                        : (currentMockExam.score || 0) >= 70
                                          ? "Regular"
                                          : "Deficitário"
                                    }
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-stone-600 italic border-l-2 border-[#D44E3D]/30 pl-3">
                                "{currentMockExam.analysis?.recommendation || 
                                  ((currentMockExam.score || 0) >= 80 
                                    ? "Rendimento brilhante! Você sedimentou o conteúdo estudado na memória de longo prazo com maestria. Continue com seu cronograma normal de revisões espaçadas." 
                                    : (currentMockExam.score || 0) >= 70
                                      ? "Bom aproveitamento, mas há pontos específicos a serem reforçados. Sugerimos revisar os tópicos mais complexos antes de avançar."
                                      : "Rendimento abaixo do esperado. O estudo foi classificado como Deficitário pelo algoritmo médico do MedRevise. Recomendamos reagendar imediatamente esses temas na próxima semana.")}"
                              </p>

                              {/* GRANULAR ANALYSIS DISPLAY BY TOPIC */}
                              {currentMockExam.analysis?.topicAnalysis ? (
                                <div className="pt-2 border-t border-stone-100 space-y-3">
                                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                                    <Brain className="w-3.5 h-3.5 text-[#D44E3D]" />
                                    Relatório Médico e Diagnóstico por Tema
                                  </h4>
                                  
                                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {Object.entries(currentMockExam.analysis.topicAnalysis).map(([title, data]: [string, any], idx) => {
                                      const statusColor = data.status === 'excelente' 
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                                        : data.status === 'regular' 
                                          ? "bg-amber-50 text-amber-800 border-amber-100" 
                                          : "bg-rose-50 text-rose-800 border-rose-100";
                                      
                                      return (
                                        <div key={idx} className="p-3 bg-stone-50 border border-stone-100 rounded-lg space-y-2">
                                          <div className="flex items-center justify-between flex-wrap gap-2">
                                            <span className="text-xs font-bold text-stone-900 leading-tight">{title}</span>
                                            <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                              <span className="text-stone-500">{data.correct}/{data.total} acertos ({data.successRate}%)</span>
                                              <span className={`px-2 py-0.5 rounded border font-bold uppercase text-[9px] ${statusColor}`}>
                                                {data.status === 'excelente' ? 'Excelente' : data.status === 'regular' ? 'Regular' : 'Insuficiente'}
                                              </span>
                                            </div>
                                          </div>
                                          <p className="text-[11px] text-stone-600 leading-relaxed bg-white p-2 rounded border border-stone-100">
                                            {data.reason}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* REORGANIZATION CONTROL FOR DEFICIT TOPICS */}
                                  {Object.values(currentMockExam.analysis.topicAnalysis).some((d: any) => d.status === 'insuficiente' || d.status === 'regular') && (
                                    <div className="pt-4 mt-2 border-t border-stone-100 space-y-3 bg-rose-50/20 p-3 rounded-lg border border-rose-200/40">
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-mono font-black text-[#D44E3D] block uppercase tracking-wide">PLANO DE RECUPERAÇÃO DE CONTEÚDO</span>
                                        <p className="text-[11px] text-stone-600">
                                          Selecione abaixo os temas de baixo rendimento que deseja reagendar automaticamente como matérias de revisão prioritária para a próxima semana de estudos:
                                        </p>
                                      </div>

                                      <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                                        {Object.entries(currentMockExam.analysis.topicAnalysis)
                                          .filter(([_, data]: [string, any]) => data.status === 'insuficiente' || data.status === 'regular')
                                          .map(([title, data]: [string, any]) => (
                                            <label key={title} className="flex items-center gap-2 p-2 bg-white border border-stone-200/70 rounded-md cursor-pointer hover:bg-stone-50/50 transition-all">
                                              <input
                                                type="checkbox"
                                                checked={selectedDeficitReviews.includes(title)}
                                                onChange={(e) => {
                                                  if (e.target.checked) {
                                                    setSelectedDeficitReviews([...selectedDeficitReviews, title]);
                                                  } else {
                                                    setSelectedDeficitReviews(selectedDeficitReviews.filter(t => t !== title));
                                                  }
                                                }}
                                                className="rounded text-[#D44E3D] focus:ring-[#D44E3D]"
                                              />
                                              <div className="flex-1 flex items-center justify-between">
                                                <span className="text-xs font-semibold text-stone-700">{title}</span>
                                                <span className="text-[10px] font-mono text-stone-400">Erros: {data.errors} ({data.successRate}% acertos)</span>
                                              </div>
                                            </label>
                                          ))}
                                      </div>

                                      {currentMockExam.analysis?.reviewsScheduled ? (
                                        <div className="p-2.5 bg-emerald-50 border border-emerald-200/60 rounded-lg text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5">
                                          <Check className="w-4 h-4 text-emerald-600" />
                                          Revisões programadas com sucesso! Elas foram inseridas no início da sua próxima semana.
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleScheduleSelectedReviews(activeWeekIndex, selectedDeficitReviews)}
                                          className="w-full py-2 bg-[#D44E3D] hover:bg-[#c34333] text-white font-mono text-xs font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                          <RotateCw className="w-3.5 h-3.5" />
                                          Agendar Revisões Selecionadas no Cronograma
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                /* FALLBACK LEGACY RECORDING DISPLAY */
                                (currentMockExam.score || 0) < 70 && (
                                  <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div className="space-y-0.5">
                                      <span className="text-[10px] font-mono font-bold text-rose-600 block uppercase">AÇÕES DE REORGANIZAÇÃO</span>
                                      <p className="text-[11px] text-stone-500">
                                        O algoritmo médico do MedRevise pode reagendar esses temas como prioridade absoluta no início da próxima semana para sanar a lacuna.
                                      </p>
                                    </div>
                                    
                                    {currentMockExam.analysis?.reviewsScheduled ? (
                                      <span className="px-3 py-1.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-mono font-bold flex items-center gap-1">
                                        <Check className="w-3.5 h-3.5" />
                                        Revisões Reagendadas!
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => handleScheduleDeficitReviews(activeWeekIndex)}
                                        className="px-3.5 py-1.5 bg-[#D44E3D] hover:bg-[#c34333] text-white font-mono text-xs font-bold rounded-md transition-all shrink-0 shadow-sm cursor-pointer"
                                      >
                                        Reorganizar Cronograma e Reagendar
                                      </button>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Botão para excluir este planejamento inteligente */}
            <div className="mt-8 bg-stone-50 border border-stone-200 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="text-xs font-bold font-mono text-stone-900 uppercase tracking-wider">Gerenciamento do Planejamento</h4>
                <p className="text-xs text-stone-500">
                  Deseja excluir este planejamento inteligente gerado para iniciar uma nova configuração?
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleDeleteSchedule}
                className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400 font-mono text-xs font-bold uppercase h-10 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0"
              >
                <Trash2 size={16} />
                Excluir Planejamento Inteligente
              </Button>
            </div>
          </motion.div>
        )}

        {/* VIEW 2: DAILY THEMES (TEMAS DIÁRIOS) */}
        {activeTab === 'all-topics' && schedule && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-[#1A1A1A] tracking-tight">
                  Temas Estudados Diariamente no Período
                </h2>
                <p className="text-xs text-[#8E8A82]">
                  Exibição de todos os tópicos programados por dia. Você pode alterar qualquer tema clicando no botão de substituição ou concluir direto por aqui.
                </p>
              </div>

              {/* Real-time synchronization notice */}
              <div className="bg-[#D44E3D]/5 border border-[#D44E3D]/10 p-3.5 rounded-xl flex gap-2.5 items-start">
                <RotateCw className="w-4 h-4 text-[#D44E3D] shrink-0 mt-0.5 animate-spin" style={{ animationDuration: '6s' }} />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-[#D44E3D] font-mono">SINCRONIZAÇÃO MEDREVISE <span className="font-sans font-normal text-stone-500">| Ativa em tempo real</span></p>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    Tanto MedInternato quanto MedRevise compartilham sua base de dados em nuvem. Ao marcar um tema como concluído aqui ou responder questões, as revisões de 24h, 7d, 30d e o agendamento SM-2 são criados automaticamente em ambos, sem duplicações!
                  </p>
                </div>
              </div>

              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {schedule.weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="border border-stone-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-stone-50 border-b border-stone-200 px-4 py-2.5 flex justify-between items-center">
                      <span className="text-xs font-bold text-stone-900 font-mono">SEMANA {week.weekNumber}</span>
                      <span className="text-[10px] text-stone-500 font-medium">Foco: {week.priorityTitle}</span>
                    </div>
                    <div className="p-4 space-y-3 bg-white">
                      {getOrderedDaysForWeek(schedule.studyDays, (schedule as any).startDate).map((dayName) => {
                        const topicsArr = week.days[dayName] || [];
                        return (
                          <div key={dayName} className="border-l-2 border-stone-200 pl-4 py-1 space-y-2">
                            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wide font-mono flex items-center gap-1.5">
                              <CalendarIcon className="w-3.5 h-3.5 text-[#D44E3D]" />
                              {getDayDisplayName(dayName, true)}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              {topicsArr.map((topic, tIdx) => {
                                const done = isTopicDone(topic);
                                const isRev = topic.type === 'revisao';
                                const dbTopic = getMatchedDbTopic(topic.title, topic.topicId, topic.type);

                                const isRescheduledWeek = !!topic.isRescheduled;

                                return (
                                  <div 
                                    key={tIdx} 
                                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-all gap-3 ${
                                      done 
                                        ? "bg-stone-50 border-stone-200/60 opacity-80" 
                                        : isRescheduledWeek
                                          ? "bg-amber-50/40 border-amber-300/80 ring-1 ring-amber-400/20 hover:border-amber-400"
                                          : isRev 
                                            ? "bg-amber-50/10 border-amber-200/50 hover:border-amber-300"
                                            : "bg-white border-[#E2E0D9] hover:border-[#D44E3D]"
                                    }`}
                                  >
                                    <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase border ${
                                          isRev
                                            ? "bg-amber-50 border-amber-200 text-amber-800"
                                            : "bg-emerald-50 border-emerald-200 text-emerald-800"
                                        }`}>
                                          {isRev ? "🔄 Revisão" : "📖 Estudo"}
                                        </span>
                                        {isRescheduledWeek && !done && (
                                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 border border-amber-300 text-amber-900 flex items-center gap-1">
                                            <RefreshCw className="w-2.5 h-2.5 text-amber-700" /> Recalculado
                                          </span>
                                        )}
                                        {topic.historicalIncidence && (
                                          <span className="text-[9px] font-mono text-stone-500">
                                            Incidência: {topic.historicalIncidence}%
                                          </span>
                                        )}
                                        {topic.importanceDegree && (
                                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                            topic.importanceDegree === 'extremo' ? 'bg-red-50 text-red-700' :
                                            topic.importanceDegree === 'alto' ? 'bg-orange-50 text-orange-700' :
                                            topic.importanceDegree === 'medio' ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-700'
                                          }`}>
                                            {topic.importanceDegree === 'extremo' ? '🚨 Crítico' :
                                             topic.importanceDegree === 'alto' ? '🔥 Alta' :
                                             topic.importanceDegree === 'medio' ? '📊 Média' : 'Secundário'}
                                          </span>
                                        )}
                                      </div>
                                      <p className={`text-xs font-bold truncate ${done ? 'line-through text-stone-400 font-normal' : 'text-[#1A1A1A]'}`}>
                                        {topic.title.replace('Revisão Ativa + Flashcards: ', '')}
                                      </p>
                                      <p className="text-[10px] text-stone-500">{topic.subjectName}</p>

                                      {/* Forgetting Curve & Accuracy minimalist indicators */}
                                      {dbTopic && (dbTopic.repetitions > 0 || dbTopic.lastReviewDate) && (
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                          {(() => {
                                            const retention = calculateEstimatedRetention(dbTopic);
                                            if (retention === null) return null;
                                            let dotColor = 'bg-emerald-500';
                                            let textColor = 'text-emerald-700 bg-emerald-50 border-emerald-100/50';
                                            if (retention < 50) {
                                              dotColor = 'bg-rose-500';
                                              textColor = 'text-rose-700 bg-rose-50 border-rose-100/50';
                                            } else if (retention < 80) {
                                              dotColor = 'bg-amber-500';
                                              textColor = 'text-amber-700 bg-amber-50 border-amber-100/50';
                                            }
                                            return (
                                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] ${textColor} font-medium`}>
                                                <span className={`w-1 h-1 rounded-full ${dotColor} animate-pulse`} />
                                                Retenção: {retention}%
                                              </span>
                                            );
                                          })()}

                                          {(() => {
                                            const acc = dbTopic.accuracyAfterStudy !== undefined
                                              ? dbTopic.accuracyAfterStudy * 100
                                              : dbTopic.accuracyInSimulados !== undefined
                                              ? dbTopic.accuracyInSimulados * 100
                                              : null;
                                            if (acc === null) return null;
                                            let textColor = 'text-stone-600 bg-stone-50 border-stone-200/60';
                                            if (acc >= 80) textColor = 'text-emerald-700 bg-emerald-50 border-emerald-100/50';
                                            else if (acc < 60) textColor = 'text-rose-700 bg-rose-50 border-rose-100/50';
                                            else textColor = 'text-amber-700 bg-amber-50 border-amber-100/50';
                                            return (
                                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] ${textColor} font-mono font-bold`}>
                                                🎯 {Math.round(acc)}% acertos
                                              </span>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center w-full sm:w-auto justify-start sm:justify-end">
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => handleContinueStudy(topic, 'topicDetail')}
                                        disabled={studyingTopicTitle === topic.title}
                                        className="text-[10px] h-7 bg-amber-50 text-amber-900 border-amber-300/80 hover:bg-amber-100 font-bold shrink-0 flex items-center gap-1"
                                        title="Ver Resumo Teórico"
                                      >
                                        {studyingTopicTitle === topic.title ? (
                                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                                        ) : (
                                          <BookOpen className="w-3 h-3 text-amber-700" />
                                        )}
                                        Resumo
                                      </Button>

                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => handleContinueStudy(topic, 'questions')}
                                        disabled={studyingTopicTitle === topic.title}
                                        className="text-[10px] h-7 bg-indigo-50 text-indigo-900 border-indigo-300/80 hover:bg-indigo-100 font-bold shrink-0 flex items-center gap-1"
                                        title="Fazer Questões"
                                      >
                                        <Zap className="w-3 h-3 text-indigo-600 fill-indigo-600/20" />
                                        Questões
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => {
                                          setSwapWeekIdx(weekIdx);
                                          setSwapDayName(dayName);
                                          setSwapTopicIdx(tIdx);
                                          setShowSwapModal(true);
                                        }}
                                        className="text-[10px] h-7 text-[#D44E3D] hover:bg-[#D44E3D]/5 font-mono font-bold shrink-0 border border-transparent hover:border-[#D44E3D]/10"
                                      >
                                        Alterar
                                      </Button>

                                      <button 
                                        onClick={() => handleToggleTopic(weekIdx, dayName, tIdx)}
                                        className={`p-1.5 rounded-lg border transition-all ${
                                          done 
                                            ? "bg-emerald-500 text-white border-emerald-600 shadow-sm" 
                                            : "bg-white border-[#E2E0D9] text-stone-300 hover:text-[#D44E3D] hover:border-[#D44E3D]"
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 3: IMPORT COLLEGE SCHEDULE (IMPORTAR FACULDADE) */}
        {activeTab === 'college-sync' && schedule && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#1A1A1A] tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500/10" />
                  Importar e Priorizar Grade da Faculdade
                </h2>
                <p className="text-xs text-[#8E8A82]">
                  Defina quais temas serão cobrados nas suas avaliações ou internato do semestre acadêmico e a data final da prova. O sistema reprogramará seu cronograma para estudar estes temas primeiro, garantindo que tudo seja visto a tempo sem perdas.
                </p>
              </div>

              {/* Form Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                
                {/* Left side: Date and Text area */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                      📅 Data Final da Prova da Faculdade
                    </label>
                    <input 
                      type="date"
                      value={collegeExamDate}
                      onChange={(e) => setCollegeExamDate(e.target.value)}
                      className="w-full text-xs font-semibold p-3 border border-stone-200 rounded-xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider block">
                      📝 Digite ou Cole Temas (Opcional)
                    </label>
                    <textarea 
                      rows={5}
                      value={collegeInputText}
                      onChange={(e) => setCollegeInputText(e.target.value)}
                      placeholder="Exemplo: apendicite, DHEG, asma pediátrica, vacinação..."
                      className="w-full text-xs p-3 border border-stone-200 rounded-xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white transition-all outline-none resize-none leading-relaxed"
                    />
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <Button
                        size="xs"
                        disabled={isAiMatching}
                        onClick={handleAiCollegeMatching}
                        className="bg-[#D44E3D]/5 hover:bg-[#D44E3D]/10 text-[#D44E3D] border border-[#D44E3D]/10 text-xs font-bold w-full flex items-center justify-center gap-1.5"
                      >
                        {isAiMatching ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D44E3D]" />
                            <span>Mapeando com IA...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#D44E3D]" />
                            <span>Mapeamento Semântico Inteligente com IA (20⚡)</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Sincronização box */}
                  <div className="p-4 rounded-xl border border-dashed border-stone-200 bg-stone-50/30 space-y-2">
                    <p className="text-xs font-bold text-stone-800">💡 Como funciona a reorganização?</p>
                    <ul className="text-[11px] text-stone-600 space-y-1 list-disc pl-4 leading-relaxed">
                      <li>Calculamos o número exato de semanas até a data da sua prova.</li>
                      <li>Os temas selecionados no formulário são priorizados para as primeiras semanas.</li>
                      <li>Todos os demais temas de residência que não foram selecionados são distribuídos nas semanas restantes para que sua preparação para a prova de residência não seja prejudicada.</li>
                    </ul>
                  </div>
                </div>

                {/* Right side: Checklist grid of Canonical Topics */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                        📌 Seleção Rápida por Rodízio de Internato:
                      </label>
                      <span className="text-[10px] font-bold font-mono text-[#D44E3D] bg-[#D44E3D]/5 px-2 py-0.5 rounded-full">
                        {selectedCollegeTopics.length} selecionados
                      </span>
                    </div>

                    {/* Internato Rotation Presets */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { name: 'Clínica Médica', emoji: '🩺', count: 14 },
                        { name: 'Cirurgia Geral', emoji: '🔪', count: 10 },
                        { name: 'Ginecologia e Obstetrícia', emoji: '🤰', count: 10 },
                        { name: 'Pediatria', emoji: '👶', count: 10 },
                        { name: 'Saúde Coletiva', emoji: '🏛️', count: 9 },
                      ].map((rot) => {
                        const areaList = GLOBAL_RESIDENCY_TOPICS[rot.name as keyof typeof GLOBAL_RESIDENCY_TOPICS] || [];
                        const areaTitles = areaList.map(item => item.title);
                        const isAllSelected = areaTitles.length > 0 && areaTitles.every(t => selectedCollegeTopics.includes(t));

                        return (
                          <button
                            key={rot.name}
                            type="button"
                            onClick={() => {
                              if (isAllSelected) {
                                setSelectedCollegeTopics(prev => prev.filter(t => !areaTitles.includes(t)));
                                setSelectedInternatoRotation('');
                              } else {
                                setSelectedCollegeTopics(prev => Array.from(new Set([...prev, ...areaTitles])));
                                setSelectedInternatoRotation(rot.name);
                              }
                            }}
                            className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 text-xs ${
                              isAllSelected
                                ? 'bg-[#D44E3D] text-white border-[#D44E3D] shadow-sm font-bold'
                                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                            }`}
                          >
                            <span className="truncate">{rot.emoji} {rot.name}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isAllSelected ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-600'}`}>
                              {rot.count}
                            </span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCollegeTopics([]);
                          setSelectedInternatoRotation('');
                          showToast("Seleção de temas limpa.", "info");
                        }}
                        className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-500 hover:text-stone-800 text-[11px] font-bold font-mono transition-all text-center"
                      >
                        Limpar Seleção
                      </button>
                    </div>

                    {/* Search bar for topics */}
                    <input
                      type="text"
                      placeholder="🔍 Filtrar temas da faculdade por nome..."
                      value={collegeSearchQuery}
                      onChange={(e) => setCollegeSearchQuery(e.target.value)}
                      className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#D44E3D]"
                    />
                  </div>

                  <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/20 max-h-[45vh] overflow-y-auto space-y-4">
                    {Object.entries(GLOBAL_RESIDENCY_TOPICS).map(([subject, list]) => {
                      const filteredList = list.filter(item => {
                        if (!collegeSearchQuery) return true;
                        return item.title.toLowerCase().includes(collegeSearchQuery.toLowerCase());
                      });

                      if (filteredList.length === 0) return null;

                      return (
                        <div key={subject} className="space-y-2">
                          <h4 className="text-xs font-bold text-[#1A1A1A] border-b border-stone-100 pb-1 flex justify-between items-center">
                            <span>{subject}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const allTitles = list.map(item => item.title);
                                const allSelected = allTitles.every(t => selectedCollegeTopics.includes(t));
                                if (allSelected) {
                                  setSelectedCollegeTopics(prev => prev.filter(t => !allTitles.includes(t)));
                                } else {
                                  setSelectedCollegeTopics(prev => Array.from(new Set([...prev, ...allTitles])));
                                }
                              }}
                              className="text-[10px] text-stone-500 hover:text-[#D44E3D] font-medium"
                            >
                              Marcar todos da área
                            </button>
                          </h4>
                          <div className="grid grid-cols-1 gap-1.5 pl-1">
                            {filteredList.map((item, itemIdx) => {
                              const isChecked = selectedCollegeTopics.includes(item.title);
                              return (
                                <label 
                                  key={`college-${itemIdx}-${item.title}`} 
                                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all border text-xs ${
                                    isChecked 
                                      ? "bg-[#D44E3D]/5 border-[#D44E3D]/25 font-bold text-stone-900" 
                                      : "bg-white hover:bg-stone-50 border-stone-100 text-stone-600"
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedCollegeTopics(prev => prev.filter(t => t !== item.title));
                                      } else {
                                        setSelectedCollegeTopics(prev => [...prev, item.title]);
                                      }
                                    }}
                                    className="mt-0.5 shrink-0 accent-[#D44E3D]"
                                  />
                                  <div className="space-y-0.5">
                                    <span>{item.title}</span>
                                    <span className="text-[9px] font-mono font-normal text-stone-400 block">Incidência regional: {item.incidence}%</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={handleSyncCollegeSchedule}
                    disabled={generating}
                    className="w-full bg-[#D44E3D] hover:bg-[#c34333] text-white font-mono font-bold uppercase text-xs py-5 rounded-xl shadow-md transition-all duration-300 transform active:scale-95"
                  >
                    {generating ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        Reorganizando Cronograma...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 text-amber-300 fill-amber-300/20" />
                        Sincronizar e Reorganizar Cronograma
                      </>
                    )}
                  </Button>
                </div>

              </div>
            </div>

            {/* CARD 2: PDF AI IMPORT */}
            {profile?.email === 'lucas1renck2melo@gmail.com' && (
              <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#1A1A1A] tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#D44E3D]" />
                  Importar Cronograma em PDF com Inteligência Artificial
                </h2>
                <p className="text-xs text-[#8E8A82]">
                  Já possui um cronograma em PDF da sua faculdade ou de algum cursinho (Medgrupo, Medcof, etc.)? Faça o upload dele aqui! Nossa IA vai analisar os temas e montar o cronograma estruturado diretamente no MedInternato, mantendo o controle das suas revisões de forma inteligente.
                </p>
              </div>

              <div className="border-2 border-dashed border-stone-200 hover:border-[#D44E3D] rounded-2xl p-8 bg-stone-50/20 text-center transition-all relative">
                {pdfImporting ? (
                  <div className="py-6 space-y-4 flex flex-col items-center justify-center max-w-md mx-auto">
                    <div className="relative w-12 h-12 flex items-center justify-center bg-[#D44E3D]/5 rounded-full">
                      <RotateCw className="w-6 h-6 text-[#D44E3D] animate-spin" />
                      <span className="absolute text-[9px] font-extrabold text-[#D44E3D]">{pdfProgressPercent}%</span>
                    </div>
                    <div className="w-full space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-stone-800">Processando seu Cronograma...</p>
                        <p className="text-xs font-semibold text-emerald-600 animate-pulse">{pdfProgress || 'Iniciando extração...'}</p>
                      </div>
                      
                      {/* Modern Progress Bar */}
                      <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden shadow-inner border border-stone-200">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-400 to-[#D44E3D] transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${pdfProgressPercent || 5}%` }}
                        />
                      </div>
                      
                      <p className="text-[11px] text-stone-500 leading-relaxed">
                        Nossa IA está lendo o PDF de forma assíncrona, evitando que a tela trave, e organizando os blocos semanais de medicina de forma extremamente fiel. Isso pode levar até um minuto.
                      </p>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block py-6 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#D44E3D]/5 flex items-center justify-center mx-auto text-[#D44E3D]">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-stone-800">Clique para selecionar ou arraste o arquivo PDF</p>
                      <p className="text-[10px] text-stone-500">Apenas arquivos PDF (máximo 15MB)</p>
                    </div>
                    <input 
                      type="file" 
                      accept=".pdf,application/pdf" 
                      onChange={handleImportPdfFile} 
                      className="hidden" 
                    />
                  </label>
                )}

                {pdfError && (
                  <div className="mt-4 p-3.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-center gap-2.5 max-w-xl mx-auto text-left">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{pdfError}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-[#D44E3D]/5 rounded-xl border border-[#D44E3D]/10 gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-[#D44E3D] flex items-center gap-1.5">
                    ⚡ Consumo: 25 Créditos de IA
                  </p>
                  <p className="text-[10px] text-stone-600">
                    A análise inteligente de arquivos PDF consome 25 créditos para decodificação, correspondência médica e estruturação semântica de alta precisão.
                  </p>
                </div>
                <div className="text-xs font-bold text-stone-700 bg-white px-3.5 py-1.5 rounded-lg border border-[#E2E0D9] shadow-xs self-start sm:self-auto shrink-0">
                  Seus créditos: {availableCredits} ⚡
                </div>
              </div>
            </div>
            )}

          </motion.div>
        )}

        {/* VIEW: CALENDAR SYNCHRONIZATION */}
        {activeTab === 'calendar-sync' && schedule && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#1A1A1A] tracking-tight flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-amber-600" />
                  Sincronizar Cronograma com o Calendário Mensal
                </h2>
                <p className="text-xs text-[#8E8A82]">
                  Agende todas as suas semanas de estudo diretamente no calendário mensal unificado do MedRevise. Suas matérias serão coloridas por área e suas revisões e simulados terão destaques visuais exclusivos.
                </p>
              </div>

              {isSyncingCalendar ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
                  <div className="space-y-1.5 text-center max-w-sm">
                    <p className="text-sm font-bold text-stone-800">Sincronizando com o Calendário...</p>
                    <div className="w-full bg-stone-100 rounded-full h-2 mt-2 overflow-hidden">
                      <div 
                        className="bg-amber-600 h-2 transition-all duration-300"
                        style={{ width: `${syncProgressWeek}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-stone-500 font-mono mt-1">{syncProgressWeek}% concluído</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  
                  {/* Left Side: Inputs */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                          📅 Data de Início do Plano de Estudos
                        </label>
                        {syncStartDate && (
                          <span className="text-[11px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md">
                            {(() => {
                              const d = new Date(syncStartDate + 'T00:00:00');
                              if (isNaN(d.getTime())) return '';
                              const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                              return days[d.getDay()];
                            })()}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSyncStartDate(getLocalYYYYMMDD())}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            syncStartDate === getLocalYYYYMMDD()
                              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          📅 Hoje
                        </button>
                        <button
                          type="button"
                          onClick={() => setSyncStartDate(getNextMondayLocal())}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            syncStartDate === getNextMondayLocal()
                              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          🗓️ Próxima Segunda
                        </button>
                      </div>

                      <input 
                        type="date"
                        value={syncStartDate}
                        onChange={(e) => setSyncStartDate(e.target.value)}
                        className="w-full text-xs font-semibold p-3 border border-stone-200 rounded-xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white transition-all outline-none"
                      />
                      <span className="text-[10px] text-stone-400 block font-sans">
                        O primeiro dia do seu plano começará neste dia da semana.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                          ⏰ Horário Diário
                        </label>
                        <input 
                          type="time"
                          value={syncStartTime}
                          onChange={(e) => setSyncStartTime(e.target.value)}
                          className="w-full text-xs font-semibold p-3 border border-stone-200 rounded-xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white transition-all outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                          🔔 Lembrete
                        </label>
                        <select
                          value={syncReminderTime}
                          onChange={(e) => setSyncReminderTime(e.target.value)}
                          className="w-full text-xs font-semibold p-3 border border-stone-200 rounded-xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white transition-all outline-none"
                        >
                          <option value="0">Sem lembrete</option>
                          <option value="15">15 minutos antes</option>
                          <option value="30">30 minutos antes</option>
                          <option value="60">1 hora antes</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                          ⏱️ Duração Teoria
                        </label>
                        <select
                          value={syncStudyDurationHours}
                          onChange={(e) => setSyncStudyDurationHours(Number(e.target.value))}
                          className="w-full text-xs font-semibold p-2.5 border border-stone-200 rounded-xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white transition-all outline-none"
                        >
                          <option value={1}>1 Hora</option>
                          <option value={1.5}>1.5 Horas</option>
                          <option value={2}>2 Horas (Recomendado)</option>
                          <option value={3}>3 Horas</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider">
                          🔄 Duração Revisão
                        </label>
                        <select
                          value={syncReviewDurationHours}
                          onChange={(e) => setSyncReviewDurationHours(Number(e.target.value))}
                          className="w-full text-xs font-semibold p-2.5 border border-stone-200 rounded-xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white transition-all outline-none"
                        >
                          <option value={0.5}>30 Minutos</option>
                          <option value={1}>1 Hora (Recomendado)</option>
                          <option value={1.5}>1.5 Horas</option>
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 p-3 bg-amber-50/40 border border-amber-200/50 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearPreviousSync}
                        onChange={(e) => setClearPreviousSync(e.target.checked)}
                        className="accent-amber-600 rounded"
                      />
                      <span className="text-xs font-bold text-stone-800">
                        Limpar agendamentos anteriores do cronograma ao re-sincronizar
                      </span>
                    </label>
                  </div>

                  {/* Right Side: Colors and Actions */}
                  <div className="space-y-4">
                    <div className="bg-stone-50/50 border border-stone-150 rounded-xl p-4 space-y-4">
                      <h4 className="text-xs font-bold text-stone-700 uppercase font-mono tracking-wider pb-1 border-b border-stone-100">
                        🎨 Personalização Visual dos Eventos
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-stone-600 block">
                            🔄 Cor das Revisões
                          </label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color"
                              value={syncReviewColor}
                              onChange={(e) => setSyncReviewColor(e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200"
                            />
                            <span className="text-xs font-mono text-stone-500 uppercase">{syncReviewColor}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-stone-600 block">
                            📝 Cor dos Simulados
                          </label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color"
                              value={syncExamColor}
                              onChange={(e) => setSyncExamColor(e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border border-stone-200"
                            />
                            <span className="text-xs font-mono text-stone-500 uppercase">{syncExamColor}</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary Box */}
                      <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-1 text-xs">
                        <p className="font-bold text-stone-800">📊 Resumo do Agendamento:</p>
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-stone-600 font-mono">
                          <span>• Semanas: {schedule.weeks.length}</span>
                          <span>• Simulados: {schedule.weeks.filter(w => w.mockExam).length}</span>
                          <span>• Estudo Diário: ~{syncStudyDurationHours}h/tema</span>
                          <span>• Notificações: {syncReminderTime === '0' ? 'Desativadas' : `${syncReminderTime}min`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        onClick={handleExportToCalendar}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold uppercase text-xs py-5 rounded-xl shadow-md transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2"
                      >
                        <CalendarIcon className="w-4 h-4 text-white" />
                        <span>Sincronizar no Calendário do App</span>
                      </Button>

                      <Button
                        onClick={handleDownloadICSFile}
                        variant="outline"
                        className="w-full bg-white hover:bg-stone-50 text-stone-800 border-stone-300 font-mono font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4 text-stone-600" />
                        <span>📥 Baixar Arquivo .ics (Google / Apple / Outlook)</span>
                      </Button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW 2: HISTORICAL INCIDENCE */}
        {activeTab === 'incidence' && schedule && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-bold text-[#1A1A1A] tracking-tight">
                  Estatísticas de Recorrência de Prova: {schedule.exam}
                </h2>
                <p className="text-xs text-[#8E8A82]">
                  Distribuição de pesos históricos das 5 grandes áreas da medicina para calibração do cronograma.
                </p>
              </div>

              {/* STATS PROGRESS BARS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedExam && Object.entries(selectedExam.stats).map(([subjName, info]: [string, any]) => {
                  const percent = Math.round(info.weight * 100);
                  return (
                    <div key={subjName} className="border border-[#E2E0D9] rounded-xl p-4 bg-[#FBFBFA] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#1A1A1A]">{subjName}</span>
                        <Badge className="bg-[#D44E3D]/5 text-[#D44E3D] border-[#D44E3D]/10 text-xs font-mono">
                          {percent}% da prova
                        </Badge>
                      </div>
                      <Progress value={percent} className="h-1.5 bg-stone-200" />
                      <p className="text-[11px] text-[#8E8A82] leading-relaxed pt-1">{info.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-stone-50 border border-[#E2E0D9] p-4 rounded-xl flex gap-3">
                <Lightbulb className="w-5 h-5 text-[#D44E3D] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-stone-900 font-display">Como isso afeta seus estudos?</p>
                  <p className="text-[11px] text-[#8E8A82] leading-relaxed">
                    Nossa inteligência geradora aloca as matérias em proporção matemática direta a esses percentuais. Disciplinas de maior peso recebem mais tópicos de estudos líquidos ao longo do seu planejamento.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}


        {/* VIEW: COMPLETED IMPORTED TOPICS */}
        {activeTab === 'completed-imported' && schedule && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-[#E2E0D9] rounded-2xl p-6 shadow-xs space-y-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stone-100 pb-5">
              <div>
                <h2 className="text-base font-bold text-[#1A1A1A] font-display flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Tópicos Concluídos deste Cronograma (MedRevise / MedInternato)
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Lista de todos os tópicos do cronograma atual que já foram estudados, revisados ou concluídos no sistema.
                </p>
              </div>
              <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-mono font-bold">
                {(() => {
                  let total = 0;
                  let done = 0;
                  schedule.weeks.forEach(w => {
                    Object.values(w.days).forEach((arr: any) => {
                      if (Array.isArray(arr)) {
                        arr.forEach((t: any) => {
                          total++;
                          if (isTopicDone(t)) done++;
                        });
                      }
                    });
                  });
                  return `${done} / ${total} Concluídos (${total > 0 ? Math.round((done/total)*100) : 0}%)`;
                })()}
              </div>
            </div>

            <div className="space-y-4">
              {schedule.weeks.map((week) => {
                const completedInWeek: { day: string; topic: any; tIdx: number }[] = [];
                Object.entries(week.days).forEach(([day, arr]: [string, any]) => {
                  if (Array.isArray(arr)) {
                    arr.forEach((t, tIdx) => {
                      if (isTopicDone(t)) {
                        completedInWeek.push({ day, topic: t, tIdx });
                      }
                    });
                  }
                });

                if (completedInWeek.length === 0) return null;

                return (
                  <div key={`completed-week-${week.weekNumber}`} className="border border-stone-200 rounded-xl p-4 bg-stone-50/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                      <span className="text-xs font-bold text-stone-800 font-display">
                        Semana {week.weekNumber}: {week.priorityTitle}
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        {completedInWeek.length} concluído(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {completedInWeek.map(({ day, topic, tIdx }, idx) => (
                        <div key={`comp-item-${idx}`} className="bg-white border border-stone-200 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-3xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
                              <span className="bg-stone-100 px-1.5 py-0.5 rounded font-bold text-stone-700">{day}</span>
                              <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">✓ Já Estudado no MedRevise</span>
                            </div>
                            <h4 className="text-xs font-bold text-[#1A1A1A]">{topic.title}</h4>
                            <p className="text-[11px] text-stone-500 font-medium">{topic.subjectName}</p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveTab('plan');
                              setActiveWeekIndex(week.weekNumber - 1);
                            }}
                            className="text-[11px] font-bold text-[#D44E3D] hover:underline shrink-0"
                          >
                            Ver no Plano →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {schedule.weeks.every(w => Object.values(w.days).every((arr: any) => !Array.isArray(arr) || arr.every((t: any) => !isTopicDone(t)))) && (
                <div className="text-center py-12 text-stone-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto opacity-30 text-stone-400" />
                  <p className="text-xs font-medium">Nenhum tópico deste cronograma foi marcado como concluído ainda.</p>
                  <p className="text-[11px] text-stone-400">Conclua tópicos no plano de estudo para visualizá-los aqui e sincronizá-los com o histórico.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'analysis' && schedule && analysisStats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* TARGET COVERAGE SELECTION BANNER */}
            <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-100 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-bold font-mono text-rose-600 uppercase tracking-wider block">Nível de Confiança e Cobertura</span>
                <h4 className="text-sm font-bold text-[#1A1A1A]">Ajustar Meta de Cobertura de Questões</h4>
                <p className="text-xs text-[#8E8A82] max-w-xl">
                  {targetCoverage === '85' 
                    ? "Foco Eficiência (85%): Otimizado pela Lei de Pareto. Cobre as maiores recorrências históricas para economizar o máximo de tempo." 
                    : "Segurança Total (95%): Expande a cobertura do edital para garantir confiança absoluta em qualquer banca de residência."}
                </p>
              </div>
              <div className="flex bg-white border border-[#E2E0D9] p-1 rounded-xl shadow-inner gap-1 shrink-0 w-full md:w-auto">
                <button
                  onClick={() => {
                    setTargetCoverage('85');
                    showToast("Definido para Foco Eficiência (85% de cobertura)", "info");
                  }}
                  type="button"
                  className={`flex-1 md:flex-initial text-xs font-bold px-3 py-2 rounded-lg transition-all ${
                    targetCoverage === '85' 
                      ? 'bg-stone-100 text-stone-900 border border-stone-200 shadow-sm' 
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  ⚡ Foco Eficiência (85%)
                </button>
                <button
                  onClick={() => {
                    setTargetCoverage('95');
                    showToast("Definido para Segurança Total (95% de cobertura)", "success");
                  }}
                  type="button"
                  className={`flex-1 md:flex-initial text-xs font-bold px-3 py-2 rounded-lg transition-all ${
                    targetCoverage === '95' 
                      ? 'bg-rose-600 text-white shadow-sm' 
                      : 'text-stone-500 hover:text-[#D44E3D]'
                  }`}
                >
                  🛡️ Segurança Total (95%)
                </button>
              </div>
            </div>

            {/* OVERVIEW SCORE / KEY STATISTICS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono font-bold text-rose-600 uppercase tracking-wider">Métrica de Cobertura Canônica</span>
                    <Badge className="bg-rose-50 text-rose-700 text-[9px] font-mono border border-rose-100">
                      80/20 Pareto
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-[#1A1A1A]">Conteúdos Contemplados</h3>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[#1A1A1A] font-display">{analysisStats.coveredCount}</span>
                  <span className="text-xs text-[#8E8A82]">de {analysisStats.totalCanonicalCount} temas canônicos matrizes (edital completo)</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-mono font-bold text-[#1A1A1A]">
                    <span>Proporção Coberta</span>
                    <span>{analysisStats.coveragePercentage}%</span>
                  </div>
                  <Progress value={analysisStats.coveragePercentage} className="h-2 bg-stone-100" />
                  <p className="text-[10px] text-stone-500 pt-1 leading-relaxed">
                    {targetCoverage === '85' 
                      ? `Foco nas ${analysisStats.coveredCount} matrizes canônicas cruciais que cobrem +90% das questões das bancas.` 
                      : `Representa a totalidade dos ${analysisStats.coveredCount} temas canônicos, incluindo sub-especialidades do edital.`}
                  </p>
                </div>
                <Button
                  onClick={() => setShowCanonicalModal(true)}
                  variant="outline"
                  size="xs"
                  className="w-full bg-rose-50/50 hover:bg-rose-100/50 text-[#D44E3D] border-[#D44E3D]/30 font-mono font-bold text-[11px] py-2 flex items-center justify-center gap-1.5 mt-2"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#D44E3D]" />
                  <span>🔍 Explorar os 53 Temas e +200 Subtemas Mapeados</span>
                </Button>
              </div>

              <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-amber-600 block uppercase tracking-wider">Volume de Repetições</span>
                  <h3 className="text-sm font-bold text-[#1A1A1A]">Sessões Programadas</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100/30">
                    <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" /> Estudo Teórico (📖)
                    </span>
                    <span className="text-sm font-black text-emerald-950 font-mono">
                      {analysisStats.topicDetails.reduce((acc, curr) => acc + curr.studies, 0)}x
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-amber-50/40 p-2.5 rounded-lg border border-amber-100/30">
                    <span className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                      <RotateCw className="w-4 h-4" /> Revisão Ativa (🔄)
                    </span>
                    <span className="text-sm font-black text-amber-950 font-mono">
                      {analysisStats.topicDetails.reduce((acc, curr) => acc + curr.reviews, 0)}x
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-stone-500 leading-relaxed">
                  Total de {analysisStats.topicDetails.reduce((acc, curr) => acc + curr.studies + curr.reviews, 0)} interações ativas planejadas para combater a curva de esquecimento do internato.
                </p>
              </div>

              <div className="bg-[#1A1A1A] text-white p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-rose-400 block uppercase tracking-wider">Metodologia Médica</span>
                  <h3 className="text-sm font-bold text-stone-200">Tipo de Planejamento</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-extrabold text-white font-display uppercase tracking-tight">
                    {schedule.modality === 'pdf_imported' ? 'Análise de PDF' : 
                     schedule.modality === 'dynamic' ? 'Foco Sinergia' : 'Rotação Clássica'}
                  </p>
                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    {schedule.modality === 'pdf_imported' ? 'Estrutura sequencial importada de arquivo PDF, combinada com inteligência artificial para fixação espaçada.' :
                     schedule.modality === 'dynamic' ? 'Sincronização entre matérias acadêmicas da faculdade (prioridade inicial) e peso estatístico regional da banca.' :
                     'Preparação extensiva linear baseada na incidência nacional. Carga teórica distribuída de acordo com a curva de aprendizado.'}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#D44E3D] font-mono font-bold uppercase bg-white/5 px-2.5 py-1.5 rounded-lg w-fit">
                  <Sparkles className="w-3.5 h-3.5 fill-[#D44E3D]/10" />
                  <span>Algoritmo MedInternato</span>
                </div>
              </div>

            </div>

            {/* WHY WAS IT MADE THIS WAY / POR QUE ESSA ORDEM? */}
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2">
                <Brain className="w-4.5 h-4.5 text-[#D44E3D]" />
                Justificativa Médica: Por que meu cronograma foi feito assim?
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2.5 leading-relaxed text-xs text-stone-600">
                  <p className="font-bold text-[#1A1A1A] text-xs uppercase tracking-wide font-mono text-[#D44E3D]">
                    1. Distribuição de Conteúdos e Pareto
                  </p>
                  <p>
                    O volume de assuntos médicos cobrados em concursos de Residência é virtualmente infinito. Estudar todas as notas de rodapé de forma igualitária é o caminho mais rápido para a exaustão cognitiva. 
                  </p>
                  <p>
                    {targetCoverage === '85' ? (
                      <>
                        Por isso, o seu cronograma alocou exatamente os <strong>{analysisStats.coveredCount} temas de maior recorrência histórica</strong>, garantindo que você cubra até 85% das questões das bancas estudando menos de 15% do volume total de livros de medicina.
                      </>
                    ) : (
                      <>
                        Para garantir <strong>confiança absoluta e segurança total (95% de cobertura)</strong>, o seu cronograma expandiu o escopo para contemplar todos os <strong>{analysisStats.coveredCount} temas canônicos completos do Banco Nacional</strong>. Isso blinda você contra qualquer surpresa, permitindo acertar até 95% das questões estudando cerca de 30% do volume total de livros de medicina (adicionando temas preventivos e sub-especialidades de média incidência).
                      </>
                    )}
                  </p>
                </div>

                <div className="space-y-2.5 leading-relaxed text-xs text-stone-600">
                  <p className="font-bold text-[#1A1A1A] text-xs uppercase tracking-wide font-mono text-[#D44E3D]">
                    2. Lógica da Ordem Cronológica de Estudos
                  </p>
                  <p>
                    {schedule.modality === 'pdf_imported' ? (
                      "A ordem cronológica respeita fielmente as diretrizes do PDF enviado, mas com uma camada extra de engenharia pedagógica: as revisões espaçadas de 24 horas, 7 dias e 30 dias foram distribuídas nos dias livres para evitar sobreposição de matérias densas e cansaço mental."
                    ) : schedule.modality === 'dynamic' ? (
                      `Como você solicitou sinergia acadêmica, as matérias da faculdade (${schedule.currentSemesterSubjects?.join(', ') || 'selecionadas'}) foram agendadas imediatamente no início do plano. Isso faz com que você estude um tema para a prova da faculdade e, na mesma semana, responda questões de residência desse assunto, criando uma taxa de memorização superior a 300%.`
                    ) : (
                      "Os temas foram ordenados de forma decrescente de relevância regional. Se Saúde Coletiva e Pediatria representam fatias grossas do seu edital, elas dominam o primeiro terço da sua jornada de estudos. Dessa forma, se a prova fosse amanhã, você já teria estudado os temas que concentram a imensa maioria dos pontos."
                    )}
                  </p>
                  <p>
                    Além disso, intercala-se Clínica Médica com Cirurgia Geral para que o cérebro se beneficie do <strong>efeito de intercalação</strong>, o qual potencializa o raciocínio clínico diferencial.
                  </p>
                </div>
              </div>
            </div>

            {/* HOW MANY TIMES WILL EACH TOPIC BE STUDIED / REVISED */}
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-[#1A1A1A]">Frequência de Estudos e Revisões por Tema</h3>
                  <p className="text-[11px] text-[#8E8A82]">
                    Consulte exatamente quantas vezes cada assunto canônico médico será estudado teoricamente e revisado por flashcards/questões neste plano.
                  </p>
                </div>
                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Buscar tema ou especialidade..."
                    value={analysisSearchText}
                    onChange={(e) => setAnalysisSearchText(e.target.value)}
                    className="text-xs bg-[#FBFBFA] border border-[#E2E0D9] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D44E3D] w-full"
                  />
                </div>
              </div>

              {/* TOPIC FREQUENCY TABLE */}
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <div className="bg-stone-50 border-b border-stone-200 px-4 py-3 grid grid-cols-12 gap-2 text-[10px] font-mono font-bold text-stone-700 uppercase">
                  <div className="col-span-6">Tema Médico Canônico</div>
                  <div className="col-span-2">Especialidade</div>
                  <div className="col-span-2 text-center">Teoria (📖)</div>
                  <div className="col-span-2 text-center">Revisões (🔄)</div>
                </div>

                <div className="divide-y divide-stone-100 max-h-[50vh] overflow-y-auto">
                  {analysisStats.topicDetails
                    .filter(t => {
                      if (!analysisSearchText) return true;
                      const text = analysisSearchText.toLowerCase();
                      return t.title.toLowerCase().includes(text) || t.subject.toLowerCase().includes(text);
                    })
                    .map((t, idx) => {
                      return (
                        <div key={idx} className="px-4 py-3.5 grid grid-cols-12 gap-2 text-xs items-center hover:bg-stone-50/50 transition-all">
                          <div className="col-span-6 space-y-1 pr-3">
                            <span className="font-bold text-stone-900 block">{t.title}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] text-stone-400 font-mono">Histórico de incidência: {t.incidence}%</span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                (t.incidence || 0) >= 18 
                                  ? "bg-amber-50 text-amber-700 border border-amber-100/50" 
                                  : "bg-rose-50 text-rose-700 border border-rose-100/50"
                              }`}>
                                {(t.incidence || 0) >= 18 ? "⚡ Foco Pareto (85%)" : "🛡️ Segurança Adicional (95%)"}
                              </span>
                            </div>
                          </div>
                          
                          <div className="col-span-2">
                            <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full ${
                              t.subject === 'Pediatria' ? 'bg-orange-50 text-orange-700 border border-orange-100/50' :
                              t.subject === 'Ginecologia e Obstetrícia' ? 'bg-pink-50 text-pink-700 border border-pink-100/50' :
                              t.subject === 'Cirurgia Geral' ? 'bg-purple-50 text-purple-700 border border-purple-100/50' :
                              t.subject === 'Clínica Médica' ? 'bg-blue-50 text-blue-700 border border-blue-100/50' :
                              'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
                            }`}>
                              {t.subject}
                            </span>
                          </div>

                          <div className="col-span-2 text-center">
                            <span className="font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded font-mono text-[11px]">
                              {t.studies}x
                            </span>
                          </div>

                          <div className="col-span-2 text-center">
                            <span className={`font-bold px-2.5 py-1 rounded font-mono text-[11px] ${
                              t.reviews > 2 ? 'bg-rose-50 text-rose-700 border border-rose-100/50' :
                              t.reviews > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100/50' :
                              'bg-stone-50 text-stone-400'
                            }`}>
                              {t.reviews}x
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  {analysisStats.topicDetails.filter(t => {
                    if (!analysisSearchText) return true;
                    const text = analysisSearchText.toLowerCase();
                    return t.title.toLowerCase().includes(text) || t.subject.toLowerCase().includes(text);
                  }).length === 0 && (
                    <div className="p-8 text-center text-xs text-stone-400 font-mono">
                      Nenhum tema correspondente encontrado para a busca.
                    </div>
                  )}
                </div>
              </div>

              {/* EXPLANATORY REVISION NOTE */}
              <div className="bg-amber-50/20 border border-amber-200/50 p-4 rounded-xl flex gap-3 text-xs text-amber-900 leading-relaxed">
                <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Como funciona a recorrência de revisões?</p>
                  <p>
                    Cada estudo teórico gera automaticamente agendamentos espaçados em <strong>24 horas</strong>, <strong>7 dias</strong> e <strong>30 dias</strong> de forma integrada ao MedRevise. Ao concluir uma revisão, a data do próximo ciclo se recalcula baseado no método SM-2 de repetição espaçada ativa. Por isso, ao longo das semanas, os temas canônicos reaparecem de forma cirúrgica na sua agenda diária!
                  </p>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* VIEW: METHODOLOGY */}
        {activeTab === 'methodology' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white border border-[#E2E0D9] p-6 rounded-2xl shadow-sm space-y-6">
              <div className="border-b border-stone-100 pb-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg">
                    <Lightbulb className="w-5 h-5 fill-amber-500/10 text-amber-600" />
                  </span>
                  <h2 className="text-base font-bold text-[#1A1A1A] tracking-tight font-display">
                    Como Funciona o Planejamento de Estudo do MedInternato?
                  </h2>
                </div>
                <p className="text-xs text-[#8E8A82]">
                  Nossa grade curricular foi projetada por especialistas utilizando os pilares científicos da neurociência da aprendizagem e ciência de dados.
                </p>
              </div>

              {/* Bento Grid methodology elements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="border border-stone-200/60 bg-gradient-to-br from-emerald-50/20 to-transparent p-5 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-bold text-xs">01</span>
                    <h3 className="text-xs font-black uppercase tracking-wider font-mono">Divisão e Pesos de Prova (Pareto 80/20)</h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Você não precisa estudar tudo de forma igual. Nossos algoritmos analisam o histórico estatístico de recorrência da sua banca-alvo. Se <strong>Pediatria</strong> representa 23% da prova de residência regional, então exatamente 23% do seu tempo de estudo total é alocado para Pediatria, concentrando sua energia onde o retorno em pontos é absoluto.
                  </p>
                </div>

                <div className="border border-stone-200/60 bg-gradient-to-br from-indigo-50/20 to-transparent p-5 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2 text-indigo-800">
                    <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center font-bold text-xs">02</span>
                    <h3 className="text-xs font-black uppercase tracking-wider font-mono">Estudo Diário Dobrado (Estudo vs Revisão)</h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Em cada dia de estudos, você terá duas tarefas bem definidas: <strong>Estudo Teórico</strong> (para absorver novos conceitos) e uma <strong>Revisão Ativa</strong> (baseada em tópicos anteriores já estudados). Isso garante que você continue avançando no conteúdo programático ao mesmo tempo em que consolida o conhecimento antigo.
                  </p>
                </div>

                <div className="border border-stone-200/60 bg-gradient-to-br from-purple-50/20 to-transparent p-5 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2 text-purple-800">
                    <span className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center font-bold text-xs">03</span>
                    <h3 className="text-xs font-black uppercase tracking-wider font-mono">Revisão Espaçada Ativa (Ebbinghaus)</h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Ao finalizar um tema, você deve marcar as revisões espaçadas de <strong>24 horas</strong>, <strong>7 dias</strong> e <strong>30 dias</strong>. A revisão ativa deve ser feita preferencialmente através da resolução de 10 a 15 questões rápidas ou leitura de flashcards (Active Recall), combatendo diretamente a Curva do Esquecimento.
                  </p>
                </div>

                <div className="border border-stone-200/60 bg-gradient-to-br from-amber-50/20 to-transparent p-5 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-800">
                    <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center font-bold text-xs">04</span>
                    <h3 className="text-xs font-black uppercase tracking-wider font-mono">Prioridade por Semestre Acadêmico</h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Ao inserir suas matérias da faculdade, o MedInternato reagenda esses temas para o início do seu cronograma. Dessa forma, você estuda os temas mais cobrados na residência que também coincidem com as matérias que você está vendo na faculdade <strong>agora</strong>, maximizando o desempenho em ambas as frentes.
                  </p>
                </div>

              </div>

              {/* Scientific study cycle card */}
              <div className="border border-amber-200/60 bg-amber-50/30 p-5 rounded-xl space-y-3">
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider font-mono">O Ciclo Otimizado de Alta Performance:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1 p-3 bg-white rounded-lg border border-amber-200/30">
                    <strong className="text-amber-900 block font-mono">1. Teoria Sintética (45 min)</strong>
                    <span className="text-stone-500 leading-normal block">Estudo focado e resumido do tema do dia, anotando apenas pontos de alta recorrência. Evite resumos extensos passivos.</span>
                  </div>
                  <div className="space-y-1 p-3 bg-white rounded-lg border border-amber-200/30">
                    <strong className="text-amber-900 block font-mono">2. Questões de Fixação (15 min)</strong>
                    <span className="text-stone-500 leading-normal block">Realize imediatamente 10 a 15 questões do tema recém-estudado para testar seus pontos fracos e treinar o raciocínio.</span>
                  </div>
                  <div className="space-y-1 p-3 bg-white rounded-lg border border-amber-200/30">
                    <strong className="text-amber-900 block font-mono">3. Revisão Espaçada (10 min)</strong>
                    <span className="text-stone-500 leading-normal block">Apenas 10 minutos de revisão focada em flashcards e erros anteriores nos marcos de 24h, 7d e 30d para sedimentar o tema.</span>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* VIEW 3: CONFIGURATION WIZARD FOR GENERATOR */}
        {(activeTab === 'config' || !schedule) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="border-[#E2E0D9] shadow-md overflow-hidden">
              <div className="bg-[#1A1A1A] p-6 text-white space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <h2 className="text-lg font-bold tracking-tight">Criar Cronograma Inteligente</h2>
                  </div>
                  {schedules.length > 0 && (
                    <button
                      onClick={() => setActiveTab('plan')}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold border border-white/20 transition-all cursor-pointer"
                    >
                      Voltar
                    </button>
                  )}
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Gere um planejamento de estudos focado na sua banca ou região de preferência. Insira as disponibilidades para criar seu calendário adaptativo.
                </p>
              </div>

              <CardContent className="p-6 space-y-6">
                
                {/* PROMINENT ASSISTANT WIZARD BANNER */}
                <div className="bg-gradient-to-r from-stone-900 via-[#1C1C1C] to-stone-900 border border-amber-500/30 p-4.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-white shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-300 font-mono uppercase tracking-wider">Assistente Passo a Passo de Planejamento</h4>
                      <p className="text-[11px] text-stone-300">
                        Crie seu cronograma guiado com suporte a ementas da faculdade, cálculo de matérias e contagem total de temas e revisões.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowPlannerWizard(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-extrabold text-xs px-4 py-2.5 rounded-xl shrink-0 shadow-xs cursor-pointer"
                  >
                    <span>🧙‍♂️ Iniciar Assistente Guiado</span>
                  </Button>
                </div>
                
                {/* PDF IMPORT OPTION BEFORE GENERATING */}
                {profile?.email === 'lucas1renck2melo@gmail.com' && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-tight">Já possui um cronograma em PDF?</h4>
                        <p className="text-[10px] text-stone-600">Importe seu PDF existente da faculdade ou cursinho para criar o plano instantaneamente antes de gerar um novo.</p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-dashed border-amber-300 rounded-xl p-3 bg-white/80 text-center relative hover:bg-white transition-all">
                    {pdfImporting ? (
                      <div className="py-2 space-y-2 text-left">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                          <span className="flex items-center gap-1.5 shrink-0">
                            <RotateCw className="w-3.5 h-3.5 animate-spin text-[#D44E3D]" />
                            <span>Processando PDF...</span>
                          </span>
                          <span className="font-mono text-[11px]">{pdfProgressPercent}%</span>
                        </div>
                        <p className="text-[10px] text-amber-700 font-semibold truncate">{pdfProgress || 'Lendo arquivo...'}</p>
                        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden shadow-inner border border-stone-200">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-400 to-[#D44E3D] transition-all duration-300 ease-out rounded-full"
                            style={{ width: `${pdfProgressPercent || 5}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-1 space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-stone-800">
                          <UploadCloud className="w-4 h-4 text-[#D44E3D]" />
                          <span>Clique para selecionar o PDF (máx 15MB)</span>
                        </div>
                        <p className="text-[9px] text-stone-500 font-mono">Segurança rigorosa: validação estrita de tipo PDF e sanitização</p>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleImportPdfFile}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  {pdfError && (
                    <p className="text-[10px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-200">{pdfError}</p>
                  )}
                </div>
                )}

                {/* 1. Target Exam Selection with Regional Focus */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2">
                    <label className="text-xs font-bold text-[#1A1A1A] font-mono uppercase block">1. QUAL SEU FOCO / BANCA ALVO?</label>
                    <span className="text-[10px] text-stone-500 font-medium">Filtrar por região para personalizar o peso</span>
                  </div>
                  
                  {/* Regional Pills Selection */}
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {[
                      { id: 'todos', label: '🌍 Todas' },
                      { id: 'centro-oeste', label: '🌵 Centro-Oeste' },
                      { id: 'paulistas', label: '🏙️ Paulistas (SP)' },
                      { id: 'sudeste', label: '☕ Sudeste' },
                      { id: 'sul', label: '🌲 Sul' },
                      { id: 'nordeste-norte', label: '☀️ Nordeste/Norte' },
                      { id: 'nacional', label: '🇧🇷 Nacional' }
                    ].map((reg) => (
                      <button
                        key={reg.id}
                        type="button"
                        onClick={() => {
                          setSelectedRegionFilter(reg.id);
                          // Auto select first exam in the filtered list if current is not in it
                          const filtered = MEDICAL_EXAMS_DB.filter((exam) => {
                            if (reg.id === 'todos') return true;
                            if (reg.id === 'centro-oeste') return exam.region === 'Centro-Oeste';
                            if (reg.id === 'paulistas') return ['usp-sp', 'unicamp', 'sus-sp', 'combo-paulistas'].includes(exam.id);
                            if (reg.id === 'sudeste') return exam.region === 'Sudeste' && !['usp-sp', 'unicamp', 'sus-sp', 'combo-paulistas'].includes(exam.id);
                            if (reg.id === 'sul') return exam.region === 'Sul';
                            if (reg.id === 'nordeste-norte') return exam.region === 'Nordeste' || exam.region === 'Norte';
                            if (reg.id === 'nacional') return exam.region === 'Nacional';
                            return true;
                          });
                          if (filtered.length > 0 && !filtered.some(e => e.id === selectedExamId)) {
                            setSelectedExamId(filtered[0].id);
                          }
                        }}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          selectedRegionFilter === reg.id
                            ? 'bg-[#D44E3D] text-white border-[#D44E3D] shadow-sm font-black'
                            : 'bg-white text-stone-600 border-[#E2E0D9] hover:bg-stone-50'
                        }`}
                      >
                        {reg.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1">
                    {MEDICAL_EXAMS_DB.filter((exam) => {
                      if (selectedRegionFilter === 'todos') return true;
                      if (selectedRegionFilter === 'centro-oeste') return exam.region === 'Centro-Oeste';
                      if (selectedRegionFilter === 'paulistas') return ['usp-sp', 'unicamp', 'sus-sp', 'combo-paulistas'].includes(exam.id);
                      if (selectedRegionFilter === 'sudeste') return exam.region === 'Sudeste' && !['usp-sp', 'unicamp', 'sus-sp', 'combo-paulistas'].includes(exam.id);
                      if (selectedRegionFilter === 'sul') return exam.region === 'Sul';
                      if (selectedRegionFilter === 'nordeste-norte') return exam.region === 'Nordeste' || exam.region === 'Norte';
                      if (selectedRegionFilter === 'nacional') return exam.region === 'Nacional';
                      return true;
                    }).map((exam) => (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => setSelectedExamId(exam.id)}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all flex justify-between items-start gap-3 ${
                          selectedExamId === exam.id 
                            ? "border-[#D44E3D] bg-[#D44E3D]/5 shadow-sm" 
                            : "border-[#E2E0D9] bg-white hover:bg-stone-50/50"
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <span className={`text-xs font-bold block ${exam.id.startsWith('combo-') ? 'text-[#D44E3D]' : 'text-[#1A1A1A]'}`}>{exam.name}</span>
                          <span className="text-[10px] text-stone-500 block leading-normal">{exam.description}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {exam.id.startsWith('combo-') && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-500 text-white font-mono text-[8px] uppercase font-black rounded shadow-sm animate-pulse">
                              🔥 COMBO
                            </span>
                          )}
                          <Badge className="bg-stone-100 hover:bg-stone-100 text-stone-600 text-[9px] font-mono whitespace-nowrap">
                            {['usp-sp', 'unicamp', 'sus-sp', 'combo-paulistas'].includes(exam.id) ? 'Paulista' : exam.region}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Modality Selection with exact credit disclosures */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#1A1A1A] font-mono block">2. PERÍODO DO PLANEJAMENTO</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    
                    <button
                      type="button"
                      onClick={() => setModality('6meses')}
                      className={`p-4 rounded-xl border text-left transition-all space-y-1.5 ${
                        modality === '6meses' 
                          ? "border-[#D44E3D] bg-[#D44E3D]/5 shadow-sm" 
                          : "border-[#E2E0D9] bg-white hover:bg-stone-50/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#1A1A1A]">Intensivo 6 meses</span>
                        <Badge className="bg-amber-100 text-amber-800 text-[9px] font-mono">24 Semanas</Badge>
                      </div>
                      <p className="text-[10px] text-[#8E8A82]">Preparação rápida de reta final. Foco extremo na alta recorrência.</p>
                      <p className="text-[10px] font-mono font-bold text-[#D44E3D] pt-1 border-t border-stone-100 mt-2">
                        Custo real: 5 créditos
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModality('1ano')}
                      className={`p-4 rounded-xl border text-left transition-all space-y-1.5 ${
                        modality === '1ano' 
                          ? "border-[#D44E3D] bg-[#D44E3D]/5 shadow-sm" 
                          : "border-[#E2E0D9] bg-white hover:bg-stone-50/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#1A1A1A]">Extensivo 1 ano</span>
                        <Badge className="bg-blue-100 text-blue-800 text-[9px] font-mono">48 Semanas</Badge>
                      </div>
                      <p className="text-[10px] text-[#8E8A82]">Curso completo padrão de residência médica. Excelente cobertura.</p>
                      <p className="text-[10px] font-mono font-bold text-[#D44E3D] pt-1 border-t border-stone-100 mt-2">
                        Custo real: 8 créditos
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModality('2anos')}
                      className={`p-4 rounded-xl border text-left transition-all space-y-1.5 ${
                        modality === '2anos' 
                          ? "border-[#D44E3D] bg-[#D44E3D]/5 shadow-sm" 
                          : "border-[#E2E0D9] bg-white hover:bg-stone-50/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#1A1A1A]">Longo Prazo 2 anos</span>
                        <Badge className="bg-purple-100 text-purple-800 text-[9px] font-mono">96 Semanas</Badge>
                      </div>
                      <p className="text-[10px] text-[#8E8A82]">Planejamento regular diluído, ideal para conciliar com internato puxado.</p>
                      <p className="text-[10px] font-mono font-bold text-[#D44E3D] pt-1 border-t border-stone-100 mt-2">
                        Custo real: 10 créditos
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModality('dynamic')}
                      className={`p-4 rounded-xl border text-left transition-all space-y-1.5 ${
                        modality === 'dynamic' 
                          ? "border-[#D44E3D] bg-[#D44E3D]/5 shadow-sm" 
                          : "border-[#E2E0D9] bg-white hover:bg-stone-50/50"
                      }`}
                    >
                      <div className="flex justify-between items-center text-nowrap gap-1">
                        <span className="text-xs font-bold text-[#1A1A1A]">Pela Data da Prova</span>
                        <Badge className="bg-red-100 text-red-800 text-[9px] font-mono">Adaptável</Badge>
                      </div>
                      <p className="text-[10px] text-[#8E8A82]">Você define o dia do exame. O plano calcula e reorganiza tudo.</p>
                      <p className="text-[10px] font-mono font-bold text-[#D44E3D] pt-1 border-t border-stone-100 mt-2">
                        Custo: {examDate ? getCostLabel('dynamic') : '5 a 10 cr'}
                      </p>
                    </button>

                  </div>

                  {modality === 'dynamic' && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5 mt-2"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-[#D44E3D]" />
                        <span className="text-xs font-bold text-[#1A1A1A] font-mono uppercase">Selecione a Data Estimada da sua Prova:</span>
                      </div>
                      <input
                        type="date"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full max-w-xs p-2 bg-white border border-stone-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-[#D44E3D] focus:outline-none"
                      />
                      {examDate && (
                        <p className="text-[11px] text-stone-600 font-medium">
                          ⚡ Seu cronograma terá <strong className="text-[#D44E3D]">{calculateWeeksToDate(examDate)} semanas</strong> até o dia da prova. Todas as 53 matérias e prioridades acadêmicas serão realocadas perfeitamente para cobrir todo o edital neste tempo!
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* 2.5. SEMESTRE LETIVO / INTERNATO ATIVO */}
                <div className="space-y-3 bg-[#FBFBFA] border border-stone-200/60 p-4 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1A1A1A] font-mono block">💡 PRIORIZAR MATÉRIAS DO SEMESTRE ACADÊMICO / INTERNATO (Opcional)</label>
                    <p className="text-[10px] text-[#8E8A82] leading-normal">
                      Selecione quais grandes áreas você está cursando na faculdade neste semestre. Nosso algoritmo inteligente adaptará o cronograma para priorizar esses temas na primeira metade do seu plano (garantindo notas excelentes nas suas provas acadêmicas), enquanto distribui as demais matérias de forma perfeita para garantir a sua preparação total para a prova de residência médica.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {['Clínica Médica', 'Cirurgia Geral', 'Ginecologia e Obstetrícia', 'Pediatria', 'Saúde Coletiva'].map(subject => {
                      const isSelected = currentSemesterSubjects.includes(subject);
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setCurrentSemesterSubjects(currentSemesterSubjects.filter(s => s !== subject));
                            } else {
                              setCurrentSemesterSubjects([...currentSemesterSubjects, subject]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all flex items-center gap-1 ${
                            isSelected 
                              ? "bg-stone-900 border-stone-900 text-white shadow-sm" 
                              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          {subject}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-stone-200/60 mt-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyCurrentSemester}
                        onChange={(e) => setOnlyCurrentSemester(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#D44E3D] cursor-pointer"
                      />
                      <span className="text-xs font-bold text-stone-900">
                        📌 Criar cronograma <strong>exclusivamente</strong> para as matérias deste semestre da faculdade (ignorar as demais matérias do edital)
                      </span>
                    </label>
                  </div>
                </div>

                {/* 3. Start Date Selection */}
                <div className="space-y-3 bg-[#FBFBFA] border border-stone-200/60 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-[#D44E3D]" />
                      <label className="text-xs font-bold text-[#1A1A1A] font-mono block uppercase">
                        3. DATA DE INÍCIO DO CRONOGRAMA
                      </label>
                    </div>
                    {syncStartDate && (
                      <span className="text-[11px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md">
                        {(() => {
                          const d = new Date(syncStartDate + 'T00:00:00');
                          if (isNaN(d.getTime())) return '';
                          const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                          return days[d.getDay()];
                        })()}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-[#8E8A82] leading-normal">
                    Selecione o dia em que você deseja começar a estudar. Seu cronograma iniciará no dia da semana dessa data.
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSyncStartDate(getLocalYYYYMMDD())}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        syncStartDate === getLocalYYYYMMDD()
                          ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      📅 Iniciar Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => setSyncStartDate(getNextMondayLocal())}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        syncStartDate === getNextMondayLocal()
                          ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      🗓️ Próxima Segunda
                    </button>
                  </div>

                  <input 
                    type="date"
                    value={syncStartDate}
                    onChange={(e) => setSyncStartDate(e.target.value)}
                    className="w-full max-w-xs p-2.5 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-[#D44E3D] focus:outline-none shadow-xs"
                  />
                  <p className="text-[10px] text-stone-500 font-sans italic">
                    💡 Dica: Ao escolher Próxima Segunda, seu cronograma terá semanas perfeitamente alinhadas de Segunda a Domingo.
                  </p>
                </div>

                {/* 4. Study Days Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#1A1A1A] font-mono block">4. QUAIS DIAS DA SEMANA VOCÊ DISPÕE PARA ESTUDO?</label>
                  <div className="flex flex-wrap gap-1.5">
                    {getWeekdays().map(day => {
                      const isSelected = studyDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayToggle(day)}
                          className={`w-12 h-10 rounded-lg text-xs font-bold font-mono transition-all border ${
                            isSelected 
                              ? "bg-[#D44E3D] text-white border-[#D44E3D]" 
                              : "bg-white text-stone-600 border-[#E2E0D9] hover:bg-stone-50"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Hours Per Day */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#1A1A1A] font-mono">5. HORAS DE ESTUDO DIÁRIO</label>
                    <span className="text-xs font-mono font-bold text-[#D44E3D]">{hoursPerDay} horas/dia</span>
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
                    <span>2h (Foco Rápido)</span>
                    <span>10h (Foco Intenso)</span>
                  </div>
                </div>

                {/* SUBMIT */}
                <div className="pt-4 border-t border-[#E2E0D9] space-y-4">
                  {availableCredits < getCost() && (
                    <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 flex gap-3 text-red-800">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold">Saldo de Créditos Insuficiente</p>
                        <p className="text-[10px] leading-relaxed text-red-700">
                          Sua geração exige <strong>{getCost()} créditos</strong>, mas seu saldo atual é de apenas <strong>{availableCredits} créditos</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleGenerateSchedule}
                    disabled={generating || availableCredits < getCost() || studyDays.length === 0}
                    className="w-full bg-[#D44E3D] hover:bg-[#D44E3D]/90 text-white font-bold h-11 rounded-xl shadow-sm transition-all"
                  >
                    {generating ? (
                      <div className="flex items-center justify-center gap-2">
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Calculando algoritmos e pesos de incidência...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                        <span>Gerar Planejamento de Prova ({getCostLabel(modality)})</span>
                      </div>
                    )}
                  </Button>
                </div>

              </CardContent>
            </Card>
          </motion.div>
        )}

      </AnimatePresence>

      {/* RESTRUCTURE DIALOG MODAL */}
      <AnimatePresence>
        {showRestructureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E2E0D9] rounded-2xl max-w-md w-full shadow-xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
            >
              <div className="bg-[#1A1A1A] p-4 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-[#D44E3D]" />
                  <h3 className="text-sm font-bold font-display">Recuperação e Reestruturação de Atrasos</h3>
                </div>
                <button 
                  onClick={() => setShowRestructureModal(false)}
                  className="text-stone-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                  title="Fechar modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <p className="text-xs text-[#8E8A82] leading-relaxed">
                  Não se preocupe em ficar para trás! O algoritmo médico irá reorganizar seus tópicos atrasados por **ordem de prioridade**, distribuindo-os uniformemente nos dias que você escolheu estudar.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider block mb-2">
                      Redistribuir em quantos dias de estudo?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[3, 5, 7, 10, 14, 21].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setRestructureDays(days)}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                            restructureDays === days
                              ? "bg-[#D44E3D] text-white border-[#D44E3D] shadow-sm"
                              : "bg-stone-50 text-[#1A1A1A] border-stone-200 hover:bg-stone-100/70"
                          }`}
                        >
                          {days} {days === 1 ? "dia" : "dias"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider block mb-1.5">
                      Quantidade Personalizada:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={restructureDays}
                        onChange={(e) => setRestructureDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 px-3 py-1.5 text-xs font-bold font-mono border border-[#E2E0D9] rounded-xl text-center bg-stone-50 focus:outline-none focus:ring-1 focus:ring-[#D44E3D]"
                      />
                      <span className="text-xs text-[#8E8A82]">dias de estudo selecionados</span>
                    </div>
                  </div>

                  {uncompletedBacklogList.length > 0 ? (
                    <div className="pt-2 space-y-3">
                      {/* Summary Banner */}
                      <div className="p-3.5 bg-gradient-to-r from-[#D44E3D]/10 via-[#D44E3D]/5 to-stone-50 border border-[#D44E3D]/25 rounded-2xl flex items-center justify-between gap-3 shadow-3xs">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#D44E3D]">
                            Total de Atrasos Identificados
                          </div>
                          <div className="text-lg font-black font-mono text-[#1A1A1A]">
                            {uncompletedBacklogList.length} {uncompletedBacklogList.length === 1 ? 'tópico' : 'tópicos'}
                          </div>
                          <div className="text-[11px] text-[#8E8A82] font-medium">
                            Serão redistribuídos em <strong className="text-[#1A1A1A]">{restructureDays} {restructureDays === 1 ? 'dia' : 'dias'}</strong> de estudo
                          </div>
                        </div>
                        <div className="text-right shrink-0 bg-white/80 backdrop-blur px-3 py-2 rounded-xl border border-[#D44E3D]/20 shadow-2xs">
                          <div className="text-[10px] text-stone-500 font-bold uppercase">Média Diária</div>
                          <div className="text-base font-black font-mono text-[#D44E3D]">
                            +{(uncompletedBacklogList.length / Math.max(1, restructureDays)).toFixed(1)} <span className="text-[10px] font-normal text-stone-500">/dia</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider block">
                            📊 Estimativa de Acréscimo por Dia
                          </label>
                          <span className="text-[10px] font-black bg-[#D44E3D]/10 text-[#D44E3D] px-2 py-0.5 rounded-full font-mono border border-[#D44E3D]/20">
                            {uncompletedBacklogList.length} {uncompletedBacklogList.length === 1 ? 'tópico' : 'tópicos'} no total
                          </span>
                        </div>
                        <div className="max-h-36 overflow-y-auto pr-1 space-y-1.5 border border-stone-200/40 p-2.5 rounded-xl bg-stone-50/50">
                          {getRestructurePreview().map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1.5 px-2.5 bg-white rounded-lg border border-stone-200/30 shadow-3xs text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-stone-400 font-bold">Dia {idx + 1}</span>
                                <span className="font-bold text-[#1A1A1A]">{item.dayName}</span>
                              </div>
                              <span className="font-black text-[#D44E3D] bg-[#D44E3D]/5 px-2.5 py-0.5 rounded-lg text-[11px] font-mono border border-[#D44E3D]/10">
                                +{item.count} {item.count === 1 ? 'tópico' : 'tópicos'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider block">
                          📋 Lista de Tópicos em Atraso Identificados ({uncompletedBacklogList.length})
                        </label>
                        <div className="max-h-36 overflow-y-auto pr-1 space-y-1.5 border border-stone-200/40 p-2.5 rounded-xl bg-stone-50/50">
                          {uncompletedBacklogList.map((topic, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1.5 px-2.5 bg-white rounded-lg border border-stone-200/30 shadow-3xs text-xs">
                              <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                                <span className="font-bold text-[#1A1A1A] truncate" title={topic.title}>
                                  {topic.title}
                                </span>
                                <span className="text-[10px] text-[#8E8A82] font-semibold">
                                  {topic.subjectName}
                                </span>
                              </div>
                              <span className="shrink-0 font-bold text-[#D44E3D] bg-[#D44E3D]/5 px-2 py-0.5 rounded-lg text-[10px] font-mono">
                                {topic.importanceDegree ? topic.importanceDegree.toUpperCase() : 'ESTUDO'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs my-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-bold text-emerald-900">0 tópicos de estudo em atraso!</div>
                        <div className="text-[11px] text-emerald-700 leading-normal">
                          Você está 100% em dia com seus tópicos principais de estudo até esta data.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-stone-50 border border-stone-200/50 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-[#D44E3D] flex items-center gap-1">
                      💡 Regra de Priorização Inteligente:
                    </span>
                    <p className="text-[10px] text-[#8E8A82] leading-relaxed">
                      O cronograma posicionará primeiro os tópicos com classificação de importância **Extremo** e **Alto** e com maiores índices históricos de incidência nas bancas de concurso, garantindo que você estude o mais relevante primeiro!
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-stone-50 border-t border-[#E2E0D9] flex justify-end gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setShowRestructureModal(false)}
                  className="border-[#E2E0D9] text-[#1A1A1A]"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleRestructureSubmit}
                  disabled={restructureSaving}
                  className="bg-[#D44E3D] hover:bg-[#D44E3D]/90 text-white font-bold"
                >
                  {restructureSaving ? 'Reorganizando...' : 'Confirmar Reestruturação'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION MODAL FOR RESET */}
      <AnimatePresence>
        {showConfirmReset && (
          <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E2E0D9] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl space-y-6"
            >
              <div className="bg-[#1A1A1A] p-6 text-white flex items-center gap-3">
                <div className="p-2 bg-red-500/20 text-red-400 rounded-lg shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display uppercase tracking-wide">Apagar Cronograma Ativo?</h3>
                  <p className="text-[10px] text-stone-400">Esta ação não pode ser desfeita.</p>
                </div>
              </div>

              <div className="px-6 space-y-2 text-xs text-stone-600 leading-relaxed">
                <p>
                  Você está prestes a <strong>deletar permanentemente</strong> seu cronograma de estudos ativo.
                </p>
                <p className="bg-red-50 text-red-800 p-3 rounded-lg border border-red-100/50 font-medium">
                  Todas as suas marcações de progresso diário, flashcards marcados e o histórico de pontuações de simulados serão perdidos definitivamente.
                </p>
                <p>Deseja continuar com o reset?</p>
              </div>

              <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowConfirmReset(false)}
                  className="border-[#E2E0D9] text-stone-700"
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm"
                  onClick={executeReset}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Sim, Deletar e Começar Novo
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOPIC SWAP MODAL */}
      <AnimatePresence>
        {showSwapModal && (
          <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E2E0D9] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="bg-[#1A1A1A] p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                    <Sparkles className="w-4 h-4 fill-amber-500/15" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-display uppercase tracking-wider">Substituir Tema do Cronograma</h3>
                    <p className="text-[10px] text-stone-400">Selecione o novo tema de residência canônico para esta aula.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSwapModal(false)}
                  className="text-stone-400 hover:text-white transition-all text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b border-stone-100 bg-stone-50/50">
                <input 
                  type="text"
                  placeholder="🔍 Buscar tema de residência (ex: trauma, asma, sus...)"
                  value={swapSearchText}
                  onChange={(e) => setSwapSearchText(e.target.value)}
                  className="w-full text-xs p-3 border border-stone-200 rounded-xl bg-white focus:ring-1 focus:ring-[#D44E3D] outline-none transition-all font-medium"
                />
              </div>

              {/* Topics Selection Grid */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {Object.entries(GLOBAL_RESIDENCY_TOPICS).map(([subject, list]) => {
                  const filtered = list.filter(t => t.title.toLowerCase().includes(swapSearchText.toLowerCase()));
                  if (filtered.length === 0) return null;
                  return (
                    <div key={subject} className="space-y-2">
                      <h4 className="text-[11px] font-bold text-stone-500 font-mono uppercase tracking-wider border-b border-stone-100 pb-1">
                        {subject}
                      </h4>
                      <div className="grid grid-cols-1 gap-1.5 pl-0.5">
                        {filtered.map((item, itemIdx) => (
                          <button
                            key={`swap-${itemIdx}-${item.title}`}
                            type="button"
                            onClick={() => handleSwapTopic(item.title)}
                            className="w-full text-left p-2.5 rounded-xl border border-stone-100 bg-white hover:bg-stone-50 hover:border-stone-200 transition-all flex justify-between items-center text-xs group"
                          >
                            <span className="font-bold text-stone-800 group-hover:text-[#D44E3D] transition-colors">{item.title}</span>
                            <span className="text-[10px] font-mono text-stone-400">Incidência: {item.incidence}%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowSwapModal(false)}
                  className="border-[#E2E0D9] text-stone-700 font-mono font-bold"
                >
                  Cancelar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CANONICAL 53 TOPICS & SUBTOPICS EXPLORER MODAL */}
      <AnimatePresence>
        {showCanonicalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-stone-200 shadow-2xl rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-stone-100 flex justify-between items-start sm:items-center gap-3 bg-stone-50/50">
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-extrabold text-stone-900 flex items-start sm:items-center gap-2 font-display leading-snug break-words">
                    <BookOpen className="w-5 h-5 text-[#D44E3D] shrink-0 mt-0.5 sm:mt-0" />
                    <span>Matriz Canônica de Residência (53 Temas & +200 Subtemas)</span>
                  </h3>
                  <p className="text-xs text-stone-500 leading-normal">
                    Mapeamento estatístico completo do edital unificado de residência médica com Pareto 80/20.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCanonicalModal(false)}
                  className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-all shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Filters */}
              <div className="p-4 bg-white border-b border-stone-100 space-y-3">
                <input
                  type="text"
                  placeholder="🔍 Pesquisar tema ou subtema (ex: DHEG, sepse, fratura, vacinação)..."
                  value={canonicalSearchQuery}
                  onChange={(e) => setCanonicalSearchQuery(e.target.value)}
                  className="w-full text-xs p-3 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D44E3D]"
                />

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {['Todas', 'Clínica Médica', 'Cirurgia Geral', 'Ginecologia e Obstetrícia', 'Pediatria', 'Saúde Coletiva'].map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setCanonicalFilterArea(area)}
                      className={`px-3 py-1.5 rounded-lg font-mono text-[11px] whitespace-nowrap transition-all font-bold ${
                        canonicalFilterArea === area
                          ? 'bg-[#D44E3D] text-white shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Grid */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {Object.entries(GLOBAL_RESIDENCY_TOPICS)
                  .filter(([subject]) => canonicalFilterArea === 'Todas' || canonicalFilterArea === subject)
                  .map(([subject, list]) => {
                    const filteredTopics = list.filter(t => {
                      if (!canonicalSearchQuery) return true;
                      const q = canonicalSearchQuery.toLowerCase();
                      const subtopics = CANONICAL_SUBTOPICS_MAP[t.title] || [];
                      return t.title.toLowerCase().includes(q) || subtopics.some(st => st.toLowerCase().includes(q));
                    });

                    if (filteredTopics.length === 0) return null;

                    return (
                      <div key={subject} className="space-y-3">
                        <div className="flex justify-between items-center border-b border-stone-200 pb-1">
                          <h4 className="text-xs font-bold text-stone-800 font-mono uppercase tracking-wider flex items-center gap-2">
                            <span>{subject}</span>
                            <span className="text-[10px] text-stone-400 font-normal">({filteredTopics.length} matrizes)</span>
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {filteredTopics.map((item, itemIdx) => {
                            const subtopics = CANONICAL_SUBTOPICS_MAP[item.title] || [];
                            
                            // Find if this topic is present in user's schedule
                            let weekFound: number | null = null;
                            if (schedule?.weeks) {
                              schedule.weeks.forEach((w, wIdx) => {
                                Object.values(w.days || {}).forEach((dTopics) => {
                                  (dTopics as any[]).forEach((tp) => {
                                    if (tp.title?.toLowerCase().trim() === item.title.toLowerCase().trim()) {
                                      weekFound = wIdx + 1;
                                    }
                                  });
                                });
                              });
                            }

                            return (
                              <div
                                key={`canonical-${itemIdx}-${item.title}`}
                                className="p-3.5 rounded-xl border border-stone-200 bg-white hover:border-[#D44E3D]/30 transition-all space-y-2.5 shadow-2xs"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <h5 className="text-xs font-extrabold text-stone-900">{item.title}</h5>
                                    <span className="text-[10px] font-mono text-stone-500 block">
                                      Incidência Histórica em Provas: <strong className="text-stone-800">{item.incidence}%</strong>
                                    </span>
                                  </div>

                                  <div>
                                    {weekFound ? (
                                      <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        ✓ Programado na Semana {weekFound}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                                        📚 Disponível no Acervo
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Subtopics */}
                                {subtopics.length > 0 && (
                                  <div className="space-y-1 pt-1 border-t border-stone-100">
                                    <span className="text-[10px] font-mono text-stone-400 uppercase font-bold block">
                                      Subtemas Cruciais do Edital Mapeados ({subtopics.length}):
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {subtopics.map((sub, stIdx) => (
                                        <span
                                          key={stIdx}
                                          className="text-[10px] font-mono bg-stone-50 text-stone-700 border border-stone-200 px-2 py-0.5 rounded-md"
                                        >
                                          • {sub}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-between items-center text-xs font-mono">
                <span className="text-stone-500">Total: 53 Temas Canônicos Matrizes + 212 Subtemas Especificados</span>
                <Button 
                  size="sm"
                  onClick={() => setShowCanonicalModal(false)}
                  className="bg-[#D44E3D] text-white hover:bg-[#c34333] font-mono font-bold"
                >
                  Fechar Matriz
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANUAL LINKING MODAL */}
      <AnimatePresence>
        {linkingTopic && (
          <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E2E0D9] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="bg-[#1A1A1A] p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-display uppercase tracking-wider">Vincular Tema ao MedRevise</h3>
                    <p className="text-[10px] text-stone-400">Associe esta aula do cronograma com um tópico registrado no MedRevise.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setLinkingTopic(null)}
                  className="text-stone-400 hover:text-white transition-all text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Selected topic information */}
              <div className="p-4 bg-stone-50 border-b border-stone-100 space-y-1">
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase bg-amber-50 border border-amber-200 text-amber-800">
                  AULA DO CRONOGRAMA
                </span>
                <h4 className="text-xs font-bold text-stone-800">{linkingTopic.title}</h4>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b border-stone-100 bg-stone-50/20">
                <input 
                  type="text"
                  placeholder="🔍 Buscar tópico no MedRevise..."
                  value={topicLinkSearch}
                  onChange={(e) => setTopicLinkSearch(e.target.value)}
                  className="w-full text-xs p-3 border border-stone-200 rounded-xl bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-medium"
                />
              </div>

              {/* Topics Selection list */}
              <div className="p-5 overflow-y-auto flex-1 space-y-2">
                {(() => {
                  const filteredTopics = topics.filter(t => {
                    const name = t.title || t.name || '';
                    return name.toLowerCase().includes(topicLinkSearch.toLowerCase());
                  });

                  if (filteredTopics.length === 0) {
                    return (
                      <p className="text-xs text-stone-400 italic py-8 text-center">Nenhum tópico do MedRevise encontrado com esse nome.</p>
                    );
                  }

                  return filteredTopics.map(t => {
                    const name = t.title || t.name || '';
                    const isLinked = linkingTopic.currentLinkedId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleLinkTopic(linkingTopic.weekIdx, linkingTopic.dayName, linkingTopic.topicIdx, t.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-center justify-between ${
                          isLinked 
                            ? "bg-indigo-50/60 border-indigo-200 text-indigo-900 font-bold" 
                            : "bg-white border-stone-200/80 hover:border-indigo-400 hover:bg-stone-50"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">{name}</p>
                          <p className="text-[10px] text-stone-500">{t.subjectName}</p>
                        </div>
                        {isLinked ? (
                          <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded border border-indigo-200/50">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-stone-400 opacity-80">
                            Vincular →
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Footer with remove link option */}
              {linkingTopic.currentLinkedId && (
                <div className="p-4 bg-stone-50 border-t border-stone-150 flex justify-end">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => handleLinkTopic(linkingTopic.weekIdx, linkingTopic.dayName, linkingTopic.topicIdx, null)}
                    className="text-xs text-rose-600 hover:bg-rose-50"
                  >
                    Remover Vínculo Atual
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MedRevise Export Confirmation Modal */}
      {syncConfirmModalOpen && pendingStudyArgs && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E0D9] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#D44E3D] shrink-0">
                <ArrowLeftRight className="w-5 h-5 text-[#D44E3D]" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#1A1A1A] font-display">
                  Exportar para o MedRevise?
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  Sincronização do Planejamento
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Deseja que este estudo crie automaticamente o semestre <strong>"CRONOGRAMA"</strong> e a matéria <strong>"{pendingStudyArgs.scheduleTopic?.subjectName || 'Geral'}"</strong> no seu MedRevise?
            </p>

            <div className="p-3 bg-[#FAF9F5] border border-stone-200/80 rounded-2xl text-[11px] text-stone-600 space-y-1">
              <p>• <strong>Sincronizar:</strong> Matéria e tópico são salvos no MedRevise para acompanhamento lá.</p>
              <p>• <strong>Manter no MedInternato:</strong> O planejamento fica 100% contido aqui. Você poderá criar matérias manualmente no MedRevise se quiser.</p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  if (rememberSyncChoice) updateSyncMode('sync');
                  setSyncConfirmModalOpen(false);
                  handleContinueStudy(pendingStudyArgs.scheduleTopic, pendingStudyArgs.targetView, 'sync');
                }}
                className="w-full bg-[#1A1A1A] hover:bg-black text-white font-bold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Sim, criar matéria no MedRevise</span>
              </button>

              <button
                onClick={() => {
                  if (rememberSyncChoice) updateSyncMode('internato_only');
                  setSyncConfirmModalOpen(false);
                  handleContinueStudy(pendingStudyArgs.scheduleTopic, pendingStudyArgs.targetView, 'internato_only');
                }}
                className="w-full bg-stone-100 hover:bg-stone-200 text-[#1A1A1A] font-bold text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-stone-200"
              >
                <span>Não, manter apenas no MedInternato</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
              <input
                type="checkbox"
                id="rememberSync"
                checked={rememberSyncChoice}
                onChange={(e) => setRememberSyncChoice(e.target.checked)}
                className="rounded border-stone-300 text-[#D44E3D] focus:ring-[#D44E3D] cursor-pointer"
              />
              <label htmlFor="rememberSync" className="text-[11px] font-medium text-stone-600 cursor-pointer select-none">
                Lembrar minha decisão para os próximos tópicos
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE PLANNER WIZARD MODAL */}
      <AnimatePresence>
        {showPlannerWizard && (
          <SchedulePlannerWizard
            onGenerateSchedule={handleWizardGenerateSchedule}
            onCancel={() => setShowPlannerWizard(false)}
            availableCredits={availableCredits}
            isGenerating={generating}
          />
        )}
      </AnimatePresence>

      {/* CUSTOM ANIMATED TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white border border-[#E2E0D9] shadow-2xl p-4 rounded-xl flex items-start gap-3"
          >
            {toast.type === 'success' ? (
              <span className="p-1 bg-emerald-500/10 text-emerald-600 rounded-lg shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            ) : toast.type === 'error' ? (
              <span className="p-1 bg-red-500/10 text-red-600 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </span>
            ) : (
              <span className="p-1 bg-blue-500/10 text-blue-600 rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5" />
              </span>
            )}
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#1A1A1A] font-mono uppercase tracking-wider">
                {toast.type === 'success' ? 'Sucesso' : toast.type === 'error' ? 'Erro' : 'Aviso'}
              </p>
              <p className="text-xs text-stone-600 leading-normal">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
