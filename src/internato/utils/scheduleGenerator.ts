// Mathematical schedule generator for residency plans
import { MEDICAL_EXAMS_DB, GLOBAL_RESIDENCY_TOPICS } from '../data/medicalExams';

export interface StudyPlanTopic {
  topicId?: string;
  title: string;
  subjectName: string;
  historicalIncidence: number;
  isPriority: boolean;
  isCompleted: boolean;
  review24h: boolean;
  review7d: boolean;
  review30d: boolean;
  type: 'estudo' | 'revisao';
  importanceDegree: 'baixo' | 'medio' | 'alto' | 'extremo';
}

export interface StudyPlanWeek {
  weekNumber: number;
  priorityTitle: string;
  days: {
    [dayName: string]: StudyPlanTopic[];
  };
  mockExam?: {
    title: string;
    questionsCount: number;
    isCompleted: boolean;
    score?: number;
    topicPerformance?: Record<string, { total: number; correct: number }>;
    analysis?: {
      status: 'excellent' | 'good' | 'deficit';
      deficitTopics: string[];
      recommendation: string;
      reviewsScheduled: boolean;
      topicAnalysis?: Record<string, {
        total: number;
        correct: number;
        errors: number;
        successRate: number;
        status: 'insuficiente' | 'regular' | 'excelente';
        reason: string;
      }>;
    };
  };
  monthlyMockExam?: {
    title: string;
    questionsCount: number;
    isCompleted: boolean;
    score?: number;
    topicPerformance?: Record<string, { total: number; correct: number }>;
    analysis?: {
      status: 'excellent' | 'good' | 'deficit';
      deficitTopics: string[];
      recommendation: string;
      reviewsScheduled: boolean;
      topicAnalysis?: Record<string, {
        total: number;
        correct: number;
        errors: number;
        successRate: number;
        status: 'insuficiente' | 'regular' | 'excelente';
        reason: string;
      }>;
    };
  };
  quarterlyMockExam?: {
    title: string;
    questionsCount: number;
    isCompleted: boolean;
    score?: number;
    topicPerformance?: Record<string, { total: number; correct: number }>;
    analysis?: {
      status: 'excellent' | 'good' | 'deficit';
      deficitTopics: string[];
      recommendation: string;
      reviewsScheduled: boolean;
      topicAnalysis?: Record<string, {
        total: number;
        correct: number;
        errors: number;
        successRate: number;
        status: 'insuficiente' | 'regular' | 'excelente';
        reason: string;
      }>;
    };
  };
  semiAnnualMockExam?: {
    title: string;
    questionsCount: number;
    isCompleted: boolean;
    score?: number;
    topicPerformance?: Record<string, { total: number; correct: number }>;
    analysis?: {
      status: 'excellent' | 'good' | 'deficit';
      deficitTopics: string[];
      recommendation: string;
      reviewsScheduled: boolean;
      topicAnalysis?: Record<string, {
        total: number;
        correct: number;
        errors: number;
        successRate: number;
        status: 'insuficiente' | 'regular' | 'excelente';
        reason: string;
      }>;
    };
  };
  annualMockExam?: {
    title: string;
    questionsCount: number;
    isCompleted: boolean;
    score?: number;
    topicPerformance?: Record<string, { total: number; correct: number }>;
    analysis?: {
      status: 'excellent' | 'good' | 'deficit';
      deficitTopics: string[];
      recommendation: string;
      reviewsScheduled: boolean;
      topicAnalysis?: Record<string, {
        total: number;
        correct: number;
        errors: number;
        successRate: number;
        status: 'insuficiente' | 'regular' | 'excelente';
        reason: string;
      }>;
    };
  };
}

export function generatePlan(
  examId: string,
  modality: '6meses' | '1ano' | '2anos' | 'extensivo' | 'intensivo' | 'dynamic',
  studyDays: string[],
  hoursPerDay: number,
  currentSemesterSubjects?: string[],
  examDate?: string,
  startDate?: string,
  onlyCurrentSemester?: boolean
): StudyPlanWeek[] {
  const exam = MEDICAL_EXAMS_DB.find(e => e.id === examId) || MEDICAL_EXAMS_DB[0];

  // Reorder studyDays so that day 1 of week 1 starts on the day of week of startDate (e.g. Friday if startDate is Friday)
  const MAP_DAY_INDEX_TO_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let orderedStudyDays = [...studyDays];

  if (startDate) {
    const d = new Date(startDate + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      const startAbbr = MAP_DAY_INDEX_TO_ABBR[d.getDay()];
      const startIdx = MAP_DAY_INDEX_TO_ABBR.indexOf(startAbbr);
      const rotated = [
        ...MAP_DAY_INDEX_TO_ABBR.slice(startIdx),
        ...MAP_DAY_INDEX_TO_ABBR.slice(0, startIdx)
      ];
      const filtered = rotated.filter(day => studyDays.includes(day));
      if (filtered.length > 0) {
        orderedStudyDays = filtered;
      }
    }
  }
  
  // Determine the number of weeks based on modality or examDate
  let totalWeeks = 24; // Default for 6meses/intensivo
  if (modality === '1ano' || modality === 'extensivo') {
    totalWeeks = 48;
  } else if (modality === '2anos') {
    totalWeeks = 96;
  } else if (modality === 'intensivo') {
    totalWeeks = 24;
  }

  if (examDate) {
    const today = new Date();
    const targetDate = new Date(examDate);
    // Align with end of day
    targetDate.setHours(23, 59, 59, 999);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const calculatedWeeks = Math.floor(diffDays / 7);
    if (calculatedWeeks >= 2) {
      totalWeeks = Math.min(104, calculatedWeeks); // Limit to 2 years maximum
    }
  }

  // Determine priority degree based on incidence
  const getImportanceDegree = (incidence: number): 'baixo' | 'medio' | 'alto' | 'extremo' => {
    if (incidence >= 25) return 'extremo';
    if (incidence >= 22) return 'alto';
    if (incidence >= 18) return 'medio';
    return 'baixo';
  };

  // Extract all flat topics
  interface FlatTopic {
    title: string;
    subjectName: string;
    incidence: number;
  }

  const allFlatTopics: FlatTopic[] = [];
  Object.entries(GLOBAL_RESIDENCY_TOPICS).forEach(([subject, list]) => {
    list.forEach(t => {
      allFlatTopics.push({
        title: t.title,
        subjectName: subject,
        incidence: t.incidence
      });
    });
  });

  // Dynamic prioritization based on target exam
  const examStats = exam.stats || {};
  const examSuggested = exam.suggestedTopics || [];

  // Map flat topics to weighted topics with dynamic weights
  interface WeightedTopic extends FlatTopic {
    score: number;
    isSuggested: boolean;
    isPriorityExamTopic: boolean;
  }

  const weightedTopics: WeightedTopic[] = allFlatTopics.map(t => {
    // 1. Get regional subject weight. Default to 20% (0.20) since there are 5 areas
    const subjectWeight = examStats[t.subjectName]?.weight ?? 0.20;

    // 2. Check if topic is in the exam's suggested topics
    const suggested = examSuggested.find(st => (st?.title || '').toLowerCase().trim() === (t?.title || '').toLowerCase().trim());

    // Calculate dynamic priority score
    let baseInc = t.incidence;
    let isPriorityExamTopic = false;
    let isSuggested = false;

    if (suggested) {
      baseInc = suggested.incidence;
      isPriorityExamTopic = suggested.priority;
      isSuggested = true;
    }

    // High subject weight gives an active multiplier boost
    const weightMultiplier = subjectWeight / 0.20; // e.g. 0.25 / 0.20 = 1.25x weight
    let score = baseInc * weightMultiplier;

    // Additional modifiers to make plans distinct
    if (isPriorityExamTopic) {
      score += 15; // heavy boost
    }
    if (isSuggested) {
      score += 10; // normal boost
    }

    // Small random noise to prevent mathematically identical ordering in edge cases, keeping study plans unique
    const titleHash = t.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const noise = (titleHash % 10) / 10; // stable 0.0 to 0.9 noise per title
    score += noise;

    return {
      ...t,
      incidence: baseInc,
      score,
      isSuggested,
      isPriorityExamTopic
    };
  });

  // Partition topics into current semester priorities and non-priorities
  const prioritySubjectsList = currentSemesterSubjects || [];

  const priorityTopics = weightedTopics
    .filter(t => prioritySubjectsList.includes(t.subjectName))
    .sort((a, b) => b.score - a.score);

  const otherTopics = weightedTopics
    .filter(t => !prioritySubjectsList.includes(t.subjectName))
    .sort((a, b) => b.score - a.score);

  // Combine them: priority semester subjects first, then others, or exclusive if onlyCurrentSemester is true
  const masterTopicQueue = onlyCurrentSemester && prioritySubjectsList.length > 0
    ? priorityTopics
    : [...priorityTopics, ...otherTopics];

  const weeks: StudyPlanWeek[] = [];
  const scheduledTopicsLog: FlatTopic[] = [];

  const totalSlots = totalWeeks * studyDays.length;
  const slotsCount = Math.max(1, totalSlots);

  // Determine ideal workload topics per day based on study hours available (dense coverage: 1 topic every 1.5 - 2 hours is highly intensive!)
  const hoursBasedTopicsPerDay = 
    hoursPerDay <= 2 ? 1 : 
    hoursPerDay <= 4 ? 2 : 
    hoursPerDay <= 6 ? 3 : 
    hoursPerDay <= 8 ? 4 : 5;

  // Make sure we schedule enough topics per day to at least cover the entire curriculum over totalWeeks
  const minRequiredTopicsPerDay = Math.ceil(masterTopicQueue.length / slotsCount);
  const finalTopicsPerDay = Math.max(minRequiredTopicsPerDay, hoursBasedTopicsPerDay);

  let topicPointer = 0;
  const getNextTopicFromQueue = (): FlatTopic => {
    const idx = topicPointer % masterTopicQueue.length;
    const cycle = Math.floor(topicPointer / masterTopicQueue.length);
    const topic = masterTopicQueue[idx];
    topicPointer++;

    if (cycle === 0) {
      return topic;
    } else if (cycle === 1) {
      return {
        ...topic,
        title: `⚡ [QUESTÕES AVANÇADAS] ${topic.title}`
      };
    } else {
      return {
        ...topic,
        title: `🔄 [REVISÃO DE REFORÇO] ${topic.title}`
      };
    }
  };

  for (let w = 1; w <= totalWeeks; w++) {
    const daysMap: { [dayName: string]: StudyPlanTopic[] } = {};

    orderedStudyDays.forEach((day, dIdx) => {
      const dayTopics: StudyPlanTopic[] = [];

      // 1. STUDY SESSIONS: Schedule topics dynamically matching the available hours and regional relevance
      for (let i = 0; i < finalTopicsPerDay; i++) {
        const topicData = getNextTopicFromQueue();
        
        const studyTopic: StudyPlanTopic = {
          title: topicData.title,
          subjectName: topicData.subjectName,
          historicalIncidence: topicData.incidence,
          isPriority: topicData.incidence >= 23 || prioritySubjectsList.includes(topicData.subjectName),
          isCompleted: false,
          review24h: false,
          review7d: false,
          review30d: false,
          type: 'estudo',
          importanceDegree: getImportanceDegree(topicData.incidence)
        };
        
        dayTopics.push(studyTopic);
        scheduledTopicsLog.push(topicData);
      }

      // 2. REVISION SESSION: Get a previously scheduled topic for Active spaced repetition (Custom Ebbinghaus loop)
      let revisionTopicData: FlatTopic | null = null;
      if (scheduledTopicsLog.length > 0) {
        // Calculate lookback with some variation based on available days
        const lookbackIndex = Math.floor((w * 5 + dIdx * 23) % scheduledTopicsLog.length);
        revisionTopicData = scheduledTopicsLog[lookbackIndex];
      } else {
        revisionTopicData = masterTopicQueue[(w + dIdx) % masterTopicQueue.length];
      }

      const revisionTopic: StudyPlanTopic = {
        title: `Revisão Ativa + Flashcards: ${revisionTopicData.title.replace('⚡ [QUESTÕES AVANÇADAS] ', '').replace('🔄 [REVISÃO DE REFORÇO] ', '')}`,
        subjectName: revisionTopicData.subjectName,
        historicalIncidence: revisionTopicData.incidence,
        isPriority: revisionTopicData.incidence >= 23 || prioritySubjectsList.includes(revisionTopicData.subjectName),
        isCompleted: false,
        review24h: false,
        review7d: false,
        review30d: false,
        type: 'revisao',
        importanceDegree: getImportanceDegree(revisionTopicData.incidence)
      };

      dayTopics.push(revisionTopic);

      // Save to days map
      daysMap[day] = dayTopics;
    });

    // Setup mock exams
    // 1. WEEKLY MOCK EXAM: Programmed for every weekend containing topics studied in that week
    const weeklyTopicsList: string[] = [];
    Object.values(daysMap).forEach(dayTopics => {
      dayTopics.forEach(t => {
        if (t.type === 'estudo') {
          const clean = t.title
            .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
            .replace('🔄 [REVISÃO DE REFORÇO] ', '')
            .trim();
          if (clean && !weeklyTopicsList.includes(clean)) {
            weeklyTopicsList.push(clean);
          }
        }
      });
    });

    const mockExam = {
      title: `Simulado Semanal - Semana ${w} (${weeklyTopicsList.length} Matérias da Semana)`,
      questionsCount: Math.min(60, Math.max(15, weeklyTopicsList.length * 5)),
      isCompleted: false
    };

    // 2. MONTHLY CUMULATIVE MOCK EXAM: Programmed for the last week of every month (every 4th week or final week)
    let monthlyMockExam = undefined;
    const isLastWeekOfMonth = (w % 4 === 0) || (w === totalWeeks);
    if (isLastWeekOfMonth) {
      const monthNum = Math.ceil(w / 4);
      const cumulativeTopicsSet = new Set<string>();

      // Accumulate all study topics from week 0 to w-2 in existing weeks array
      weeks.forEach(prevWeek => {
        Object.values(prevWeek.days).forEach(dayTopics => {
          dayTopics.forEach(t => {
            if (t.type === 'estudo') {
              const clean = t.title
                .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
                .replace('🔄 [REVISÃO DE REFORÇO] ', '')
                .trim();
              if (clean) cumulativeTopicsSet.add(clean);
            }
          });
        });
      });

      // Accumulate study topics from current week w (daysMap)
      Object.values(daysMap).forEach(dayTopics => {
        dayTopics.forEach(t => {
          if (t.type === 'estudo') {
            const clean = t.title
              .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
              .replace('🔄 [REVISÃO DE REFORÇO] ', '')
              .trim();
            if (clean) cumulativeTopicsSet.add(clean);
          }
        });
      });

      const totalCumulativeList = Array.from(cumulativeTopicsSet);

      monthlyMockExam = {
        title: `Simulado Mensal Cumulativo - Mês ${monthNum} (${totalCumulativeList.length} Matérias Estudadas até Semana ${w})`,
        questionsCount: Math.min(100, Math.max(30, totalCumulativeList.length * 3)),
        isCompleted: false
      };
    }

    // Determine priority title (clean of any cycle tags)
    const firstDay = orderedStudyDays[0];
    const firstTopic = daysMap[firstDay]?.[0];
    const rawTitle = firstTopic ? firstTopic.title : 'Revisão Geral de Ciclos';
    const priorityTitle = rawTitle
      .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
      .replace('🔄 [REVISÃO DE REFORÇO] ', '');

    weeks.push({
      weekNumber: w,
      priorityTitle,
      days: daysMap,
      mockExam,
      monthlyMockExam
    });
  }

  return weeks;
}

export function calculateCoverage(weeks: StudyPlanWeek[], examIdOrName: string): number {
  if (!weeks || weeks.length === 0) return 0;
  
  // Find exam by ID or name
  const exam = MEDICAL_EXAMS_DB.find(e => e.id === examIdOrName || e.name === examIdOrName) || MEDICAL_EXAMS_DB[0];
  const examSubjects = Object.keys(exam.stats || {});
  
  const uniqueTopicTitles = new Set<string>();
  weeks.forEach(w => {
    Object.values(w.days).forEach(arr => {
      arr.forEach(t => {
        if (t.type === 'estudo') {
          const cleanTitle = (t?.title || '')
            .replace('⚡ [QUESTÕES AVANÇADAS] ', '')
            .replace('🔄 [REVISÃO DE REFORÇO] ', '')
            .toLowerCase()
            .trim();
          uniqueTopicTitles.add(cleanTitle);
        }
      });
    });
  });

  const relevantGlobalTopics: { title: string; incidence: number }[] = [];
  Object.entries(GLOBAL_RESIDENCY_TOPICS).forEach(([subject, list]) => {
    if (examSubjects.length === 0 || examSubjects.includes(subject)) {
      list.forEach(t => {
        relevantGlobalTopics.push({
          title: t.title,
          incidence: t.incidence
        });
      });
    }
  });

  let coveredSum = 0;
  let totalSum = 0;

  relevantGlobalTopics.forEach(t => {
    const isCovered = uniqueTopicTitles.has((t?.title || '').toLowerCase().trim());
    const incidence = t.incidence;
    if (isCovered) {
      coveredSum += incidence;
    }
    totalSum += incidence;
  });

  return totalSum > 0 ? Math.min(100, Math.round((coveredSum / totalSum) * 100)) : 100;
}
