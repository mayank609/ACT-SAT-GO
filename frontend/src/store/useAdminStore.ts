import { create } from 'zustand';
import { MOCK_TESTS } from '../data/mockData';
import type { Test, TestStatus } from '../types';

interface AdminState {
  tests: Test[];
  addTest: (test: Test) => void;
  deleteTest: (id: string) => void;
  assignStudents: (testId: string, studentIds: string[]) => void;
  updateTestStatus: (testId: string, status: TestStatus) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  tests: MOCK_TESTS,

  addTest: (test) =>
    set((s) => ({ tests: [test, ...s.tests] })),

  deleteTest: (id) =>
    set((s) => ({ tests: s.tests.filter((t) => t.id !== id) })),

  assignStudents: (testId, studentIds) =>
    set((s) => ({
      tests: s.tests.map((t) =>
        t.id === testId ? { ...t, assignedStudentIds: studentIds } : t
      ),
    })),

  updateTestStatus: (testId, status) =>
    set((s) => ({
      tests: s.tests.map((t) =>
        t.id === testId ? { ...t, status } : t
      ),
    })),
}));
