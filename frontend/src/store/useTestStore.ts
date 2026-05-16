import { create } from 'zustand';
import type { Test, TestAttempt, QuestionState, TestAnalytics } from '../types';

interface TestState {
  currentAttempt: TestAttempt | null;
  activeTest: Test | null;
  analytics: Record<string, TestAnalytics>;
  startAttempt: (attempt: TestAttempt, test: Test) => void;
  updateQuestionState: (
    sectionId: string,
    questionId: string,
    state: QuestionState,
    answer?: string | string[] | number | null
  ) => void;
  updateTimeSpent: (sectionId: string, questionId: string, seconds: number) => void;
  navigateToQuestion: (sectionIndex: number, questionIndex: number) => void;
  advanceSection: () => void;
  completeAttempt: () => void;
  recordTabSwitch: () => void;
  saveAnalytics: (attemptId: string, analytics: TestAnalytics) => void;
  clearAttempt: () => void;
}

export const useTestStore = create<TestState>((set) => ({
  currentAttempt: null,
  activeTest: null,
  analytics: {},

  startAttempt: (attempt, test) =>
    set({ currentAttempt: attempt, activeTest: test }),

  updateQuestionState: (sectionId, questionId, state, answer) =>
    set((s) => {
      if (!s.currentAttempt) return s;
      const sections = { ...s.currentAttempt.sections };
      const section = { ...sections[sectionId] };
      section.questions = {
        ...section.questions,
        [questionId]: {
          ...section.questions[questionId],
          state,
          selectedAnswer: answer !== undefined ? answer : section.questions[questionId]?.selectedAnswer,
          answeredAt: state === 'answered' || state === 'answered_marked' ? new Date().toISOString() : undefined,
        },
      };
      sections[sectionId] = section;
      return { currentAttempt: { ...s.currentAttempt, sections } };
    }),

  updateTimeSpent: (sectionId, questionId, seconds) =>
    set((s) => {
      if (!s.currentAttempt) return s;
      const sections = { ...s.currentAttempt.sections };
      const section = { ...sections[sectionId] };
      const prevQ = section.questions[questionId] || { questionId, state: 'not_visited' as QuestionState, timeSpent: 0 };
      section.questions = {
        ...section.questions,
        [questionId]: { ...prevQ, timeSpent: prevQ.timeSpent + seconds },
      };
      sections[sectionId] = section;
      return { currentAttempt: { ...s.currentAttempt, sections } };
    }),

  navigateToQuestion: (sectionIndex, questionIndex) =>
    set((s) => {
      if (!s.currentAttempt) return s;
      return {
        currentAttempt: {
          ...s.currentAttempt,
          currentSectionIndex: sectionIndex,
          currentQuestionIndex: questionIndex,
        },
      };
    }),

  advanceSection: () =>
    set((s) => {
      if (!s.currentAttempt) return s;
      const next = s.currentAttempt.currentSectionIndex + 1;
      return {
        currentAttempt: {
          ...s.currentAttempt,
          currentSectionIndex: next,
          currentQuestionIndex: 0,
        },
      };
    }),

  completeAttempt: () =>
    set((s) => {
      if (!s.currentAttempt) return s;
      return {
        currentAttempt: {
          ...s.currentAttempt,
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
      };
    }),

  recordTabSwitch: () =>
    set((s) => {
      if (!s.currentAttempt) return s;
      return {
        currentAttempt: {
          ...s.currentAttempt,
          tabSwitchCount: s.currentAttempt.tabSwitchCount + 1,
        },
      };
    }),

  saveAnalytics: (attemptId, analytics) =>
    set((s) => ({ analytics: { ...s.analytics, [attemptId]: analytics } })),

  clearAttempt: () => set({ currentAttempt: null, activeTest: null }),
}));
