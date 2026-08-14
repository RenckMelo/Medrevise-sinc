export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  semesterId: string;
}

export interface Semester {
  id: string;
  number: number;
  name: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  references: string[];
  lastUpdated: string;
  semesterId?: string;
  content_standard?: string;
  content_deep?: string;
  content_elite?: string;
  content_master?: string;
  content_monograph?: string;
  content_custom_analyzed?: string;
  content_resumo_expansao?: string;
  custom_analysis?: {
    cost: number;
    justification: string;
    chapters: string[];
    clinicalHighlights: string[];
    analyzedAt: string;
  };
  importedPdfData?: string;
  importedPdfName?: string;
  highlights?: { id: string; text: string; color: string; occurrence?: number }[];
  clippings?: { id: string; text: string; category: string; createdAt: string; occurrence?: number }[];
  illustrations?: { id: string; phrase: string; url: string; sourceType: 'generated' | 'uploaded' | 'link'; createdAt: string }[];
  interval?: number;
  easinessFactor?: number;
  repetitions?: number;
  nextReviewDate?: string;
  lastReviewDate?: string;
  completed?: boolean;
  wasRescheduledOverdue?: boolean;
  accuracyAfterStudy?: number;
  accuracyInSimulados?: number;
  isInsufficient?: boolean;
  insufficiencySource?: 'pos_estudo' | 'simulado' | 'ambos';
  insufficiencyReason?: string;
}

export interface Question {
  id: string;
  topicId?: string;
  subjectId?: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  source: string;
  regionalIncidenceStats?: Record<string, number>;
  heatLevel?: 'baixo' | 'medio' | 'alto' | 'extremo';
  frequentMistakesExplanation?: string;
  gabaritoConflict?: {
    hasConflict: boolean;
    description: string;
  };
}

export interface Flashcard {
  id: string;
  topicId?: string;
  subjectId?: string;
  front: string;
  back: string;
  concept?: string;
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  nextReviewDate?: string;
  lastReviewDate?: string;
  subtopicTag?: string;
}

export interface QuestionAttempt {
  questionId: string;
  selectedOptionIndex?: number;
  selectedOption?: string;
  correctOption?: string;
  isCorrect: boolean;
  timestamp: string;
  timeSpentSeconds: number;
  subjectId?: string;
  content?: string;
  options?: Record<string, string>;
  explanation?: string;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  subjectIds: string[];
  topicIds: string[];
  questions: QuestionAttempt[];
  score: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  timestamp: string;
  type: 'individual' | 'simulado';
}

export interface StudySession {
  id: string;
  subjectId: string | 'multidisciplinary';
  startTime: string;
  durationSeconds: number;
}

export interface UserProgress {
  userId: string;
  completedTopicIds: string[];
  answeredQuestionIds: string[]; // unique IDs for tracking completion status
  correctQuestionIds: string[]; // unique IDs
  flaggedQuestionIds?: string[]; // bookmarked/flagged question IDs
  attempts?: Record<string, QuestionAttempt>; // Last attempt per question
  quizHistory?: QuizAttempt[]; // Recent history (might be better in separate collection)
  totalStudyTimeSeconds?: number;
  studySessions?: StudySession[];
  flashcardReviews: Record<string, {
    nextReview: string;
    interval: number;
    easeFactor: number;
    repetitions?: number;
    lastRating?: string;
    lastReviewed?: string;
  }>;
  aiUsage?: {
    date: string;
    count: number;
  };
  role?: 'admin' | 'user';
  stats?: {
    quizCorrectAnswers?: number;
    quizTotalAnswers?: number;
    topicsCompleted?: number;
    totalXP?: number;
    [key: string]: any;
  };
  topicAnnotations?: Record<string, {
    highlights?: { id: string; text: string; color: string; note?: string; occurrence?: number }[];
    clippings?: { id: string; text: string; category: string; createdAt: string; occurrence?: number }[];
    [key: string]: any;
  }>;
}

export type ViewState = 'home' | 'subject' | 'topic' | 'questions' | 'flashcards' | 'admin' | 'search' | 'simulado' | 'review-question' | 'cronograma';
