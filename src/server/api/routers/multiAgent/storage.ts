import { EventEmitter } from "events";
import type {
  TestRun,
  TestReport,
  UserRequirement,
  UiVersion,
  TimelineEvent,
  TestCase,
  TestCaseStatus,
} from "./types";

// ============================================================================
// In-Memory Storage (T008)
// ============================================================================

export const testRunsStore = new Map<string, TestRun>();
export const testReportsStore = new Map<string, TestReport>();
export const userRequirementsStore = new Map<string, UserRequirement>();
export const uiVersionsStore = new Map<string, UiVersion>();
export const timelinesStore = new Map<string, TimelineEvent[]>();

// Store test cases and their execution status per test run
export const testCasesStore = new Map<string, TestCase[]>();
export const testCaseStatusStore = new Map<
  string,
  Map<string, { status: TestCaseStatus; error?: string; updatedAt: string }>
>();

// Event emitter for real-time updates
export const testRunEmitter = new EventEmitter();
testRunEmitter.setMaxListeners(100); // Support multiple concurrent test runs
