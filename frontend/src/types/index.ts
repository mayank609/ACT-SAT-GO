export type Role = 'super_admin' | 'admin' | 'tutor' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  assignedTutorId?: string;
  assignedStudentIds?: string[];
}

export type QuestionType = 'mcq_single' | 'mcq_multi' | 'numeric' | 'passage';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: Option[];
  correctAnswer: string | string[] | number;
  subject?: string;
  referenceId?: string;
  topic: string;
  subTopic?: string;
  difficulty: Difficulty;
  explanation?: string;
  marks: number;
  marksNegative: number;
  parentQuestionId?: string;      // For linked questions under a passage
  parentQuestionText?: string;    // Passage text carried by flattened sub-questions
  linkedQuestions?: Question[];   // For passage questions containing multiple questions
}

export interface Section {
  id: string;
  name: string;
  timeLimit: number; // minutes
  questions: Question[];
}

export type TestStatus = 'draft' | 'published' | 'archived';

export interface Test {
  id: string;
  title: string;
  description?: string;
  category?: string;
  subCategory?: string;
  sections: Section[];
  status: TestStatus;
  createdBy: string;
  createdAt: string;
  assignedStudentIds?: string[];
  allowBackNavigation: boolean;
  showResults: boolean;
}

export type AttemptStatus = 'not_started' | 'in_progress' | 'completed' | 'abandoned';
export type QuestionState = 'not_visited' | 'answered' | 'marked_review' | 'answered_marked' | 'not_answered';

export interface QuestionAttempt {
  questionId: string;
  selectedAnswer?: string | string[] | number | null;
  state: QuestionState;
  timeSpent: number; // seconds
  visitedAt?: string;
  answeredAt?: string;
}

export interface SectionAttempt {
  sectionId: string;
  startedAt?: string;
  completedAt?: string;
  timeUsed: number; // seconds
  questions: Record<string, QuestionAttempt>;
}

export interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  status: AttemptStatus;
  startedAt?: string;
  completedAt?: string;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  sections: Record<string, SectionAttempt>;
  tabSwitchCount: number;
  isFullScreen: boolean;
  score?: number;
  percentile?: number;
}

export interface TopicPerformance {
  topic: string;
  subTopic?: string;
  correct: number;
  total: number;
  accuracy: number;
  avgTimeSpent: number;
}

export interface SectionAnalytics {
  sectionId: string;
  sectionName: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  accuracy: number;
  timeAllocated: number;
  timeUsed: number;
  topicBreakdown: TopicPerformance[];
}

export interface TestAnalytics {
  attemptId: string;
  testId: string;
  studentId: string;
  totalScore: number;
  maxScore: number;
  percentile: number;
  sections: SectionAnalytics[];
  overallAccuracy: number;
  totalTimeUsed: number;
  totalTimeAllocated: number;
}

export interface Student extends User {
  role: 'student';
  tutorId?: string;
  grade?: string;
  targetScore?: number;
  testsAttempted?: number;
  avgScore?: number;
  lastActive?: string;
}

export interface Tutor extends User {
  role: 'tutor';
  studentCount?: number;
  specialization?: string[];
}

export interface PerformanceTrend {
  date: string;
  score: number;
  testTitle: string;
  attemptId: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles: Role[];
}
