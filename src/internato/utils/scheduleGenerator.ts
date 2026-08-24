// Mathematical schedule generator for residency plans
import { MEDICAL_EXAMS_DB, GLOBAL_RESIDENCY_TOPICS } from '../data/medicalExams';

export interface StudyPlanTopic {
  topicId?: string;
  title: string;
  subjectName: string;
  historicalIncidence: number;
  isPriority: boolean;
  isCompleted: boolean;
  isPreCompleted?: boolean;
  completedAt?: string;
  isExplicitlyUncompleted?: boolean;
  review24h: boolean;
  review7d: boolean;
  review30d: boolean;
  type: 'estudo' | 'revisao';
  importanceDegree: 'baixo' | 'medio' | 'alto' | 'extremo';
  isRescheduled?: boolean;
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

  // Determine ideal workload topics per day based on study hours available (humane coverage: ~1.5 - 2h per new topic)
  const hoursBasedTopicsPerDay = 
    hoursPerDay <= 2 ? 1 : 
    hoursPerDay <= 4 ? 2 : 
    hoursPerDay <= 6 ? 2 : 
    hoursPerDay <= 8 ? 3 : 4;

  const maxTopicsCap = 
    hoursPerDay <= 2 ? 1 : 
    hoursPerDay <= 4 ? 2 : 
    hoursPerDay <= 6 ? 2 : 3;

  // Make sure we schedule enough topics per day to cover curriculum without exceeding humane daily limits
  const minRequiredTopicsPerDay = Math.ceil(masterTopicQueue.length / slotsCount);
  const finalTopicsPerDay = Math.min(maxTopicsCap, Math.max(1, Math.min(minRequiredTopicsPerDay, hoursBasedTopicsPerDay)));

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
        // Calculate lookback with variation, avoiding topics already studied today
        let lookbackOffset = 0;
        const dayCleanTitles = dayTopics.map(dt => dt.title.replace(/^⚡\s*\[[^\]]+\]\s*/, '').replace(/^🔄\s*\[[^\]]+\]\s*/, '').trim().toLowerCase());
        let candidate = scheduledTopicsLog[Math.floor(w * 5 + dIdx * 23) % scheduledTopicsLog.length];
        while (lookbackOffset < scheduledTopicsLog.length && dayCleanTitles.includes(candidate.title.trim().toLowerCase())) {
          lookbackOffset++;
          candidate = scheduledTopicsLog[(Math.floor(w * 5 + dIdx * 23) + lookbackOffset) % scheduledTopicsLog.length];
        }
        revisionTopicData = candidate;
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

export interface TopicDetailItem {
  cleanTitle: string;
  subjectName: string;
  initialStudy: { weekNumber: number; dayName: string; dayIndex: number } | null;
  revisions: Array<{ name: string; weekNumber: number; dayName: string; dayIndex: number }>;
  lastActivityDayIndex: number;
  daysUntilExam: number;
  estimatedRetention: number; // 0 to 100
  retentionStatus: 'excelente' | 'bom' | 'atencao';
  retentionNote: string;
  totalSessions: number;
  timeFormatted: string;
}

export function generateCollegeCustomPlan(
  rawTopicsList: string[],
  studyDays: string[],
  hoursPerDay: number,
  startDate?: string,
  weeksDuration: number = 12,
  revisionStrategy: 'spaced' | 'weekly' | 'exam' = 'spaced',
  examDate?: string
): {
  weeks: StudyPlanWeek[];
  totalTopicsCount: number;
  totalRevisionsCount: number;
  totalSessionsCount: number;
  retentionStats: {
    averageRetention: number;
    highRetentionCount: number;
    mediumRetentionCount: number;
    lowRetentionCount: number;
  };
  smartSuggestion: string | null;
  topicDetails: TopicDetailItem[];
} {
  const cleanTopics = rawTopicsList
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (cleanTopics.length === 0) {
    return {
      weeks: [],
      totalTopicsCount: 0,
      totalRevisionsCount: 0,
      totalSessionsCount: 0,
      retentionStats: {
        averageRetention: 0,
        highRetentionCount: 0,
        mediumRetentionCount: 0,
        lowRetentionCount: 0
      },
      smartSuggestion: null,
      topicDetails: []
    };
  }

  const MAP_DAY_INDEX_TO_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let orderedStudyDays = [...studyDays];
  if (orderedStudyDays.length === 0) {
    orderedStudyDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  }

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

  // Calculate total study days available
  const totalStudyDays = Math.max(1, weeksDuration * orderedStudyDays.length);

  // GUARANTEE 100% COVERAGE: Determine daily new topic quota needed to cover ALL cleanTopics
  const minRequiredNewTopicsPerDay = Math.ceil(cleanTopics.length / totalStudyDays);
  
  const baseNewTopicsPerDay =
    hoursPerDay <= 2 ? 1 :
    hoursPerDay <= 4 ? 2 :
    hoursPerDay <= 6 ? 2 : 3;

  // Ensure we schedule at least minRequiredNewTopicsPerDay so 100% of topics are covered
  const maxNewTopicsPerDay = Math.max(minRequiredNewTopicsPerDay, baseNewTopicsPerDay);

  // Total daily sessions capacity (new topics + revisions)
  const maxTotalSessionsPerDay = Math.max(maxNewTopicsPerDay + 1,
    hoursPerDay <= 2 ? 2 :
    hoursPerDay <= 3 ? 3 :
    hoursPerDay <= 5 ? 4 : 5
  );

  const unstudiedTopics = [...cleanTopics];

  interface PendingRevision {
    topicTitle: string;
    revisionName: string;
    dueDayIndex: number;
  }
  const dueRevisions: PendingRevision[] = [];

  let totalRevisionsScheduled = 0;
  let totalStudySessionsScheduled = 0;

  const weeks: StudyPlanWeek[] = [];
  let currentStudyDayIndex = 0;

  // Track per-topic history for Ebbinghaus Forgetting Curve calculation
  const topicHistoryMap = new Map<string, {
    rawTitle: string;
    cleanTitle: string;
    subjectName: string;
    initialStudy: { weekNumber: number; dayName: string; dayIndex: number } | null;
    revisions: Array<{ name: string; weekNumber: number; dayName: string; dayIndex: number }>;
  }>();

  cleanTopics.forEach(rawTitle => {
    let clean = rawTitle.replace(/^\[[^\]]+\]\s*/, '').trim();
    let subject = 'Geral';
    const matchSubj = /^\[([^\]]+)\]/.exec(rawTitle);
    if (matchSubj) {
      subject = matchSubj[1];
    }
    // Key by exact rawTitle so every distinct topic gets its own entry
    const key = rawTitle.trim().toLowerCase();
    if (!topicHistoryMap.has(key)) {
      topicHistoryMap.set(key, {
        rawTitle,
        cleanTitle: clean || rawTitle,
        subjectName: subject,
        initialStudy: null,
        revisions: []
      });
    }
  });

  const getCleanTitleKey = (title: string) => {
    return title
      .replace(/^🔄\s*\[[^\]]+\]\s*/, '')
      .replace(/^⚡\s*\[[^\]]+\]\s*/, '')
      .trim()
      .toLowerCase();
  };

  for (let w = 1; w <= weeksDuration; w++) {
    const daysMap: { [dayName: string]: StudyPlanTopic[] } = {};
    let weekTitle = '';

    orderedStudyDays.forEach(dayName => {
      currentStudyDayIndex++;
      const dayTopics: StudyPlanTopic[] = [];

      const isTopicAlreadyScheduledToday = (targetTopicTitle: string) => {
        const targetKey = getCleanTitleKey(targetTopicTitle);
        return dayTopics.some(t => getCleanTitleKey(t.title) === targetKey);
      };

      // 1. Revisions due today or prior (Strict Scientific Ebbinghaus Filter)
      const maxRevisionsToday = hoursPerDay <= 3 ? 1 : 2;
      let revisionsAddedToday = 0;

      // Sort due revisions so overdue revisions (dueDayIndex smallest) and R1 before R2/R3 get priority
      dueRevisions.sort((a, b) => {
        if (a.dueDayIndex !== b.dueDayIndex) return a.dueDayIndex - b.dueDayIndex;
        return a.revisionName.localeCompare(b.revisionName);
      });

      for (let r = 0; r < dueRevisions.length && revisionsAddedToday < maxRevisionsToday; ) {
        const candidate = dueRevisions[r];
        // STRICT SCIENTIFIC RULE: Only schedule revisions if they are DUE today or overdue
        if (candidate.dueDayIndex <= currentStudyDayIndex) {
          // Do not schedule duplicate revisions for the same topic on the same day
          if (isTopicAlreadyScheduledToday(candidate.topicTitle)) {
            r++;
            continue;
          }

          const rev = dueRevisions.splice(r, 1)[0];
          dayTopics.push({
            title: `🔄 [${rev.revisionName}] ${rev.topicTitle}`,
            subjectName: 'Conteúdo da Faculdade',
            historicalIncidence: 100,
            isPriority: true,
            isCompleted: false,
            review24h: false,
            review7d: false,
            review30d: false,
            type: 'revisao',
            importanceDegree: 'alto'
          });
          revisionsAddedToday++;
          totalRevisionsScheduled++;

          // Record in topic history using rawTitle key
          const key = rev.topicTitle.trim().toLowerCase();
          const record = topicHistoryMap.get(key);
          if (record) {
            record.revisions.push({
              name: rev.revisionName,
              weekNumber: w,
              dayName,
              dayIndex: currentStudyDayIndex
            });
          }

          // SCIENTIFIC EBBINGHAUS CASCADING:
          // Queue next level revision ONLY AFTER current level revision is actually completed!
          const daysRemainingInPlan = totalStudyDays - currentStudyDayIndex;
          if (rev.revisionName === 'REVISÃO R1') {
            // R2: Scheduled 6 study days AFTER R1 is performed (~7-10 calendar days)
            if (daysRemainingInPlan >= 8 && currentStudyDayIndex + 6 <= totalStudyDays) {
              dueRevisions.push({
                topicTitle: rev.topicTitle,
                revisionName: 'REVISÃO R2',
                dueDayIndex: currentStudyDayIndex + 6
              });
            }
          } else if (rev.revisionName === 'REVISÃO R2') {
            // R3: Scheduled 15 study days AFTER R2 is performed (~30 calendar days)
            if (revisionStrategy !== 'weekly' && daysRemainingInPlan >= 18 && currentStudyDayIndex + 15 <= totalStudyDays) {
              dueRevisions.push({
                topicTitle: rev.topicTitle,
                revisionName: 'REVISÃO R3',
                dueDayIndex: currentStudyDayIndex + 15
              });
            }
          }
        } else {
          r++;
        }
      }

      // 2. Schedule New Topics for today
      const slotsRemaining = Math.max(0, maxTotalSessionsPerDay - dayTopics.length);
      const newTopicsToScheduleToday = Math.min(slotsRemaining, maxNewTopicsPerDay);

      for (let k = 0; k < newTopicsToScheduleToday && unstudiedTopics.length > 0; k++) {
        const rawTopicTitle = unstudiedTopics.shift()!;
        if (!weekTitle) {
          weekTitle = rawTopicTitle;
        }

        dayTopics.push({
          title: rawTopicTitle,
          subjectName: 'Conteúdo da Faculdade',
          historicalIncidence: 100,
          isPriority: true,
          isCompleted: false,
          review24h: false,
          review7d: false,
          review30d: false,
          type: 'estudo',
          importanceDegree: 'extremo'
        });
        totalStudySessionsScheduled++;

        const key = rawTopicTitle.trim().toLowerCase();
        const record = topicHistoryMap.get(key);
        if (record && !record.initialStudy) {
          record.initialStudy = {
            weekNumber: w,
            dayName,
            dayIndex: currentStudyDayIndex
          };
        }

        // Schedule R1 (Revisão 24-48h): Exactly 2 study days after initial study
        if (currentStudyDayIndex + 2 <= totalStudyDays) {
          dueRevisions.push({
            topicTitle: rawTopicTitle,
            revisionName: 'REVISÃO R1',
            dueDayIndex: currentStudyDayIndex + 2
          });
        }
      }

      // 3. Fill remaining slots with due revisions OR Final Exam Question Drill (never premature revisions)
      while (dayTopics.length < maxTotalSessionsPerDay) {
        // Find a due revision (dueDayIndex <= currentStudyDayIndex) not yet in today's list
        const matchIdx = dueRevisions.findIndex(rev => 
          rev.dueDayIndex <= currentStudyDayIndex && !isTopicAlreadyScheduledToday(rev.topicTitle)
        );

        if (matchIdx !== -1) {
          const rev = dueRevisions.splice(matchIdx, 1)[0];
          dayTopics.push({
            title: `🔄 [${rev.revisionName}] ${rev.topicTitle}`,
            subjectName: 'Conteúdo da Faculdade',
            historicalIncidence: 100,
            isPriority: true,
            isCompleted: false,
            review24h: false,
            review7d: false,
            review30d: false,
            type: 'revisao',
            importanceDegree: 'medio'
          });
          totalRevisionsScheduled++;

          const key = rev.topicTitle.trim().toLowerCase();
          const record = topicHistoryMap.get(key);
          if (record) {
            record.revisions.push({
              name: rev.revisionName,
              weekNumber: w,
              dayName,
              dayIndex: currentStudyDayIndex
            });
          }

          // Cascade R2 / R3 if applicable
          const daysRemainingInPlan = totalStudyDays - currentStudyDayIndex;
          if (rev.revisionName === 'REVISÃO R1' && daysRemainingInPlan >= 8 && currentStudyDayIndex + 6 <= totalStudyDays) {
            dueRevisions.push({
              topicTitle: rev.topicTitle,
              revisionName: 'REVISÃO R2',
              dueDayIndex: currentStudyDayIndex + 6
            });
          } else if (rev.revisionName === 'REVISÃO R2' && revisionStrategy !== 'weekly' && daysRemainingInPlan >= 18 && currentStudyDayIndex + 15 <= totalStudyDays) {
            dueRevisions.push({
              topicTitle: rev.topicTitle,
              revisionName: 'REVISÃO R3',
              dueDayIndex: currentStudyDayIndex + 15
            });
          }
        } else if (unstudiedTopics.length === 0) {
          // If no new topics remain AND no revisions are due today, add a targeted Final Exam Question Drill
          // Pick a topic studied furthest in the past that isn't on today's list
          const candidateRecords = Array.from(topicHistoryMap.values())
            .filter(r => r.initialStudy !== null && !isTopicAlreadyScheduledToday(r.cleanTitle))
            .sort((a, b) => {
              const aLast = a.revisions.length > 0 ? Math.max(...a.revisions.map(rev => rev.dayIndex)) : a.initialStudy!.dayIndex;
              const bLast = b.revisions.length > 0 ? Math.max(...b.revisions.map(rev => rev.dayIndex)) : b.initialStudy!.dayIndex;
              return aLast - bLast;
            });

          if (candidateRecords.length > 0) {
            const chosen = candidateRecords[0];
            dayTopics.push({
              title: `⚡ [SIMULADO DE RETA FINAL] ${chosen.cleanTitle}`,
              subjectName: chosen.subjectName || 'Conteúdo da Faculdade',
              historicalIncidence: 100,
              isPriority: true,
              isCompleted: false,
              review24h: false,
              review7d: false,
              review30d: false,
              type: 'revisao',
              importanceDegree: 'alto'
            });
            totalRevisionsScheduled++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      daysMap[dayName] = dayTopics;
    });

    weeks.push({
      weekNumber: w,
      priorityTitle: weekTitle || `Módulo Acadêmico Semana ${w}`,
      days: daysMap
    });
  }

  // Overflow guarantee: Ensure 100% of unstudied topics are scheduled into the plan
  if (unstudiedTopics.length > 0) {
    let lastWeek = weeks[weeks.length - 1];
    if (!lastWeek) {
      lastWeek = { weekNumber: 1, priorityTitle: 'Semana 1', days: {} };
      weeks.push(lastWeek);
    }

    let dayIdx = 0;
    while (unstudiedTopics.length > 0) {
      const dayName = orderedStudyDays[dayIdx % orderedStudyDays.length];
      const rawTopicTitle = unstudiedTopics.shift()!;

      if (!lastWeek.days[dayName]) {
        lastWeek.days[dayName] = [];
      }

      lastWeek.days[dayName].push({
        title: rawTopicTitle,
        subjectName: 'Conteúdo da Faculdade',
        historicalIncidence: 100,
        isPriority: true,
        isCompleted: false,
        review24h: false,
        review7d: false,
        review30d: false,
        type: 'estudo',
        importanceDegree: 'extremo'
      });
      totalStudySessionsScheduled++;

      const key = rawTopicTitle.trim().toLowerCase();
      const record = topicHistoryMap.get(key);
      if (record && !record.initialStudy) {
        record.initialStudy = {
          weekNumber: weeks.length,
          dayName,
          dayIndex: totalStudyDays
        };
      }
      dayIdx++;
    }
  }

  // Calculate Ebbinghaus Forgetting Curve & Retention Metrics per topic
  let totalRetentionSum = 0;
  let highRetentionCount = 0;
  let mediumRetentionCount = 0;
  let lowRetentionCount = 0;

  const topicDetails: TopicDetailItem[] = Array.from(topicHistoryMap.values()).map(record => {
    const initialDayIdx = record.initialStudy ? record.initialStudy.dayIndex : 1;
    let lastActivityDayIdx = initialDayIdx;

    if (record.revisions.length > 0) {
      lastActivityDayIdx = Math.max(...record.revisions.map(r => r.dayIndex));
    }

    // Days elapsed from last review/study to end of schedule / exam date
    const daysUntilExam = Math.max(0, totalStudyDays - lastActivityDayIdx);

    // Ebbinghaus memory stability strength S (in study days)
    const revCount = record.revisions.length;
    let stabilityDays = 12; // Initial study only
    if (revCount === 1) stabilityDays = 32;
    else if (revCount === 2) stabilityDays = 85;
    else if (revCount >= 3) stabilityDays = 200;

    // Retention formula R = e^(-t / S)
    let retention = Math.round(Math.exp(-daysUntilExam / stabilityDays) * 100);
    
    // If studied within the last 5 study days before exam, retention is naturally very high (92% - 98%)
    if (daysUntilExam <= 5) {
      retention = Math.max(92, retention);
    }

    retention = Math.min(98, Math.max(62, retention));

    totalRetentionSum += retention;

    let retentionStatus: 'excelente' | 'bom' | 'atencao' = 'excelente';
    let retentionNote = '';

    if (retention >= 85) {
      highRetentionCount++;
      retentionStatus = 'excelente';
      if (daysUntilExam <= 8) {
        retentionNote = `Estudado na reta final (Semana ${record.initialStudy?.weekNumber || 1}) → Retenção de ${retention}% na véspera sem necessidade de revisões extras.`;
      } else {
        retentionNote = `Com ${revCount} revisão(ões) espaçada(s) → Retenção mantida em ${retention}% para a prova.`;
      }
    } else if (retention >= 72) {
      mediumRetentionCount++;
      retentionStatus = 'bom';
      retentionNote = `Retenção de ${retention}%. Conteúdo consolidado, recomenda-se passar rápido em flashcards antes do exame.`;
    } else {
      lowRetentionCount++;
      retentionStatus = 'atencao';
      retentionNote = `Retenção de ${retention}%. Estudado no início do plano com poucas revisões. Faça uma passagem de questões em vésperas.`;
    }

    const totalSessions = (record.initialStudy ? 1 : 0) + record.revisions.length;
    const initialMins = record.initialStudy ? 60 : 0;
    const revMins = record.revisions.length * 30;
    const totalMins = initialMins + revMins;
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const timeFormatted = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;

    return {
      cleanTitle: record.cleanTitle,
      subjectName: record.subjectName,
      initialStudy: record.initialStudy,
      revisions: record.revisions,
      lastActivityDayIndex: lastActivityDayIdx,
      daysUntilExam,
      estimatedRetention: retention,
      retentionStatus,
      retentionNote,
      totalSessions,
      timeFormatted
    };
  });

  const averageRetention = cleanTopics.length > 0 ? Math.round(totalRetentionSum / cleanTopics.length) : 100;

  // Generate Logical Smart Suggestion
  let smartSuggestion: string | null = null;

  if (minRequiredNewTopicsPerDay > 2.5) {
    const recommendedWeeks = Math.ceil(cleanTopics.length / (orderedStudyDays.length * 1.8));
    smartSuggestion = `💡 **Sugestão de Carga:** Você possui ${cleanTopics.length} tópicos para ${weeksDuration} semanas (${minRequiredNewTopicsPerDay} temas/dia). Para não sobrecarregar sua rotina e elevar a retenção de ${averageRetention}% para mais de 92%, recomendamos estender para ${recommendedWeeks} semanas ou estudar 1 dia a mais por semana.`;
  } else if (examDate) {
    const examFormatted = new Date(examDate + 'T00:00:00').toLocaleDateString('pt-BR');
    smartSuggestion = `🎯 **Otimização por Curva do Esquecimento:** O plano sincronizou ${cleanTopics.length} tópicos (100% cobertos) até o dia da prova (${examFormatted}). Os assuntos das últimas semanas entram em reta final com retenção natural de 90%+ na véspera, enquanto os primeiros foram blindados por revisões espaçadas R1/R2. Retenção média: ${averageRetention}%.`;
  } else if (averageRetention >= 85) {
    smartSuggestion = `✨ **Plano Ideal e Sustentável:** 100% dos ${cleanTopics.length} tópicos serão estudados com retenção média estimada de ${averageRetention}% na data final! A rotina terá ~${minRequiredNewTopicsPerDay} temas/dia, garantindo aprendizado sólido.`;
  } else {
    smartSuggestion = `💡 **Dica de Desempenho:** 100% da ementa (${cleanTopics.length} temas) será estudada. Para subir a retenção média de ${averageRetention}% para mais de 90%, você pode adicionar +30 min/dia ou estender 2 semanas a mais no cronograma.`;
  }

  return {
    weeks,
    totalTopicsCount: cleanTopics.length,
    totalRevisionsCount: totalRevisionsScheduled,
    totalSessionsCount: totalStudySessionsScheduled + totalRevisionsScheduled,
    retentionStats: {
      averageRetention,
      highRetentionCount,
      mediumRetentionCount,
      lowRetentionCount
    },
    smartSuggestion,
    topicDetails
  };
}

export function extendScheduleWithScientificRevisions(
  existingWeeks: StudyPlanWeek[],
  additionalWeeksCount: number = 4,
  studyDays: string[] = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
  hoursPerDay: number = 4
): StudyPlanWeek[] {
  if (!existingWeeks || existingWeeks.length === 0) return existingWeeks;

  let orderedDays = studyDays && studyDays.length > 0 ? studyDays : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

  let dayCounter = 0;
  const topicMap = new Map<string, {
    cleanTitle: string;
    subjectName: string;
    initialStudyDayIndex: number | null;
    r1DayIndex: number | null;
    r2DayIndex: number | null;
    r3DayIndex: number | null;
  }>();

  existingWeeks.forEach(week => {
    Object.keys(week.days || {}).forEach(dayName => {
      dayCounter++;
      const currentDayIdx = dayCounter;
      const dayTopics = week.days[dayName] || [];

      dayTopics.forEach(t => {
        const titleClean = t.title
          .replace(/^🔄\s*\[[^\]]+\]\s*/, '')
          .replace(/^⚡\s*\[[^\]]+\]\s*/, '')
          .trim();
        const key = titleClean.toLowerCase();

        if (!topicMap.has(key)) {
          topicMap.set(key, {
            cleanTitle: titleClean,
            subjectName: t.subjectName || 'Geral',
            initialStudyDayIndex: null,
            r1DayIndex: null,
            r2DayIndex: null,
            r3DayIndex: null
          });
        }

        const rec = topicMap.get(key)!;
        if (t.title.includes('REVISÃO R1')) {
          rec.r1DayIndex = currentDayIdx;
        } else if (t.title.includes('REVISÃO R2')) {
          rec.r2DayIndex = currentDayIdx;
        } else if (t.title.includes('REVISÃO R3')) {
          rec.r3DayIndex = currentDayIdx;
        } else if (t.type === 'estudo' || (!t.title.startsWith('🔄') && !t.title.startsWith('⚡'))) {
          if (rec.initialStudyDayIndex === null) {
            rec.initialStudyDayIndex = currentDayIdx;
          }
        }
      });
    });
  });

  const totalExistingStudyDays = dayCounter;
  if (totalExistingStudyDays === 0) return existingWeeks;

  interface PendingRev {
    topicTitle: string;
    subjectName: string;
    revisionName: string;
    dueDayIndex: number;
  }
  const pendingRevisions: PendingRev[] = [];

  topicMap.forEach(rec => {
    const initIdx = rec.initialStudyDayIndex || 1;
    const r1Idx = rec.r1DayIndex || (initIdx + 2);
    if (!rec.r1DayIndex && r1Idx > totalExistingStudyDays) {
      pendingRevisions.push({
        topicTitle: rec.cleanTitle,
        subjectName: rec.subjectName,
        revisionName: 'REVISÃO R1',
        dueDayIndex: r1Idx
      });
    }

    const r2Idx = rec.r2DayIndex || (r1Idx + 6);
    if (!rec.r2DayIndex && r2Idx > totalExistingStudyDays) {
      pendingRevisions.push({
        topicTitle: rec.cleanTitle,
        subjectName: rec.subjectName,
        revisionName: 'REVISÃO R2',
        dueDayIndex: r2Idx
      });
    }

    const r3Idx = rec.r3DayIndex || (r2Idx + 15);
    if (!rec.r3DayIndex && r3Idx > totalExistingStudyDays) {
      pendingRevisions.push({
        topicTitle: rec.cleanTitle,
        subjectName: rec.subjectName,
        revisionName: 'REVISÃO R3',
        dueDayIndex: r3Idx
      });
    }
  });

  pendingRevisions.sort((a, b) => a.dueDayIndex - b.dueDayIndex);

  const maxDailySessions = hoursPerDay <= 3 ? 2 : 3;
  const newWeeks: StudyPlanWeek[] = [];
  const startWeekNum = existingWeeks.length + 1;
  let currentDayIdx = totalExistingStudyDays;

  for (let w = 0; w < additionalWeeksCount; w++) {
    const weekNum = startWeekNum + w;
    const daysMap: { [dayName: string]: StudyPlanTopic[] } = {};

    orderedDays.forEach(dayName => {
      currentDayIdx++;
      const dayTopics: StudyPlanTopic[] = [];

      const isTopicAlreadyInDay = (title: string) => {
        const k = title.toLowerCase();
        return dayTopics.some(dt => dt.title.toLowerCase().includes(k));
      };

      for (let i = 0; i < pendingRevisions.length && dayTopics.length < maxDailySessions; ) {
        const cand = pendingRevisions[i];
        if (cand.dueDayIndex <= currentDayIdx) {
          if (isTopicAlreadyInDay(cand.topicTitle)) {
            i++;
            continue;
          }

          const rev = pendingRevisions.splice(i, 1)[0];
          dayTopics.push({
            title: `🔄 [${rev.revisionName}] ${rev.topicTitle}`,
            subjectName: rev.subjectName,
            historicalIncidence: 100,
            isPriority: true,
            isCompleted: false,
            review24h: false,
            review7d: false,
            review30d: false,
            type: 'revisao',
            importanceDegree: 'medio'
          });
        } else {
          i++;
        }
      }

      const allTopics = Array.from(topicMap.values());
      let topicIdx = (currentDayIdx * 7) % Math.max(1, allTopics.length);

      while (dayTopics.length < maxDailySessions && allTopics.length > 0) {
        let attempts = 0;
        let selected: typeof allTopics[0] | null = null;

        while (attempts < allTopics.length) {
          const cand = allTopics[(topicIdx + attempts) % allTopics.length];
          if (!isTopicAlreadyInDay(cand.cleanTitle)) {
            selected = cand;
            break;
          }
          attempts++;
        }

        if (selected) {
          dayTopics.push({
            title: `⚡ [MANUTENÇÃO EBBINGHAUS] ${selected.cleanTitle}`,
            subjectName: selected.subjectName,
            historicalIncidence: 100,
            isPriority: true,
            isCompleted: false,
            review24h: false,
            review7d: false,
            review30d: false,
            type: 'revisao',
            importanceDegree: 'medio'
          });
          topicIdx += 3;
        } else {
          break;
        }
      }

      daysMap[dayName] = dayTopics;
    });

    newWeeks.push({
      weekNumber: weekNum,
      priorityTitle: `Revisões Espaçadas de Longo Prazo (Ebbinghaus) - Semana ${weekNum}`,
      days: daysMap
    });
  }

  return [...existingWeeks, ...newWeeks];
}

