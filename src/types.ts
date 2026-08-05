export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  referralKey?: string;
  usedReferralKey?: string;
  referralRewardGranted?: boolean;
  premiumUntil?: string;
  referralNotifications?: any[];
  premiumPlan?: string;
  planType?: string;
  role?: string;
  isPremium?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  semesterId?: string;
}

export interface Semester {
  id: string;
  number: number;
  name: string;
}

export interface Topic {
  id: string;
  name: string;
  subjectId: string;
  lastReviewDate?: string;
  nextReviewDate?: string;
  interval: number;
  easinessFactor: number;
  repetitions: number;
  description?: string;
  createdAt: string;
  completed?: boolean; // Added for marking as done in calendar
  wasRescheduledOverdue?: boolean; // Label for rescheduled overdue reviews ('ex-atrasadas')
  noMoreReviews?: boolean; // Select topics that don't need to be reviewed anymore but keep stats
  accuracyAfterStudy?: number;
  accuracyInSimulados?: number;
  isInsufficient?: boolean;
  insufficiencySource?: 'pos_estudo' | 'simulado' | 'ambos';
  insufficiencyReason?: string;
}

export interface StudySession {
  id: string;
  topicId: string;
  subjectId: string;
  date: string;
  questionsCount: number;
  correctCount: number;
  studyTimeMinutes: number;
  description?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  googleEventId?: string;
  completed?: boolean; // Added for marking as done
  subjectId?: string;
  topicId?: string;
}

export interface CollegeClass {
  id: string;
  title: string;
  location?: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  color?: string;
}

export interface MockExam {
  id: string;
  title: string;
  date: string;
  totalQuestions: number;
  correctAnswers: number;
  timeSpentMinutes: number;
  tag: 'Simulado' | 'Prova Antiga';
  conditions: 'Simulado Real' | 'Estudo/Treino';
  errorsByReason: {
    lackOfContent: number;
    carelessness: number;
    timePressure: number;
    misinterpretation: number;
  };
  performanceBySubject?: {
    subjectName: string;
    total: number;
    correct: number;
  }[];
  performanceByTopic?: {
    topicId: string;
    topicTitle: string;
    total: number;
    correct: number;
  }[];
  deepAnalysis?: string;
  notes?: string;
}
