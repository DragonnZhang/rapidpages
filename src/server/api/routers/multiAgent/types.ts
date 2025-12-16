import type { ComponentFile } from "~/utils/compiler";

// ============================================================================
// Data Types (from data-model.md)
// ============================================================================

export interface UserRequirement {
  id: string;
  rawText: string;
  createdAt: string;
  parsedGoals: string[];
  keyActions: string[];
  constraints: string[];
}

export interface UiVersion {
  id: string;
  componentId: string;
  revisionId?: string;
  versionIndex: number;
  files: ComponentFile[];
  createdAt: string;
  createdBy: "generator" | "optimizer";
  sourceFailureTestCaseId?: string;
}

export interface TestCaseStep {
  id: string;
  description: string;
  action: string;
  targetSelector?: string;
  inputValue?: string;
  expectedOutcome?: string;
}

export type TestCasePriority = "P0" | "P1" | "P2" | "P3";
export type TestCaseCategory = "core-flow" | "usability" | "edge";

export interface TestCase {
  id: string;
  requirementId: string;
  title: string;
  description: string;
  priority: TestCasePriority;
  category: TestCaseCategory;
  steps: TestCaseStep[];
  expectedResult: string;
}

export type TestStepStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";

export interface TestStepResult {
  stepId: string;
  status: TestStepStatus;
  message?: string;
}

export type TestCaseStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "blocked";

export interface TestCaseResult {
  testCaseId: string;
  status: TestCaseStatus;
  stepResults: TestStepResult[];
  failureReason?: string;
  relatedUiVersionId: string;
}

export interface IterationCycle {
  index: number;
  uiVersionId: string;
  testCaseResults: TestCaseResult[];
  triggeredByTestCaseId?: string;
  notes?: string;
}

export type TestRunStatus = "running" | "succeeded" | "failed" | "stopped";

export interface TestRun {
  id: string;
  requirementId: string;
  initialUiVersionId: string;
  createdAt: string;
  status: TestRunStatus;
  currentIterationIndex: number;
  maxIterations: number;
  testCases: TestCase[];
  iterations: IterationCycle[];
  componentId?: string;
}

export interface TestReport {
  id: string;
  testRunId: string;
  createdAt: string;
  summary: string;
  stats: {
    totalCases: number;
    passed: number;
    failed: number;
    coreFlowCoverage: number;
    usabilityCoverage: number;
    edgeCoverage: number;
  };
  failures: Array<{
    testCaseId: string;
    latestStatus: TestCaseStatus;
    lastFailureReason?: string;
  }>;
  iterations: Array<{
    index: number;
    uiVersionId: string;
    changesSummary: string;
  }>;
}

export type TimelinePhase =
  | "requirement-parsing"
  | "ui-generation"
  | "testcase-generation"
  | "test-execution"
  | "result-analysis"
  | "ui-optimization"
  | "report-generation";

export interface TimelineEvent {
  phase: TimelinePhase;
  agent: string;
  startedAt?: string;
  finishedAt?: string;
  summary?: string;
}

// Re-export MediaItem from global types
export type { MediaItem } from "~/types/multimodal";
