import type {
  IterationCycle,
  TestCaseResult,
  TestRun,
  TestRunStatus,
  TimelineEvent,
  TimelinePhase,
  TestReport,
  TestCase,
  TestCaseStatus,
  TestCasePriority,
  TestCaseCategory,
} from "./types";
import {
  testRunsStore,
  testReportsStore,
  timelinesStore,
  testCasesStore,
  testCaseStatusStore,
  testRunEmitter,
} from "./storage";

/**
 * T014: Build IterationCycle and fill TestCaseResult
 */
export function buildIterationCycle(
  cycleIndex: number,
  uiVersionId: string,
  testCaseResults: TestCaseResult[],
): IterationCycle {
  return {
    index: cycleIndex,
    uiVersionId,
    testCaseResults,
  };
}

/**
 * T015: Generate TestReport from execution results
 */
export function generateTestReport(
  testRunId: string,
  iterations: IterationCycle[],
  testCases: TestCase[],
): TestReport {
  // Aggregate results from all iterations
  const allResults = iterations.flatMap((it) => it.testCaseResults);
  const passedResults = allResults.filter((r) => r.status === "passed");
  const failedResults = allResults.filter((r) => r.status === "failed");

  console.log("📊 [MultiAgent] Generating report with test cases:", {
    totalResults: allResults.length,
    totalTestCases: testCases.length,
    categories: {
      coreFlow: testCases.filter((tc) => tc.category === "core-flow").length,
      usability: testCases.filter((tc) => tc.category === "usability").length,
      edge: testCases.filter((tc) => tc.category === "edge").length,
    },
  });

  // Calculate coverage by category - match results with test case categories
  const coreFlowCases = allResults.filter((r) => {
    const testCase = testCases.find((tc) => tc.id === r.testCaseId);
    return testCase && testCase.category === "core-flow";
  });

  const usabilityCases = allResults.filter((r) => {
    const testCase = testCases.find((tc) => tc.id === r.testCaseId);
    return testCase && testCase.category === "usability";
  });

  const edgeCases = allResults.filter((r) => {
    const testCase = testCases.find((tc) => tc.id === r.testCaseId);
    return testCase && testCase.category === "edge";
  });

  console.log("📊 [MultiAgent] Coverage calculation:", {
    coreFlowCases: coreFlowCases.length,
    usabilityCases: usabilityCases.length,
    edgeCases: edgeCases.length,
  });

  const report: TestReport = {
    id: `report_${testRunId}`,
    testRunId,
    createdAt: new Date().toISOString(),
    summary: `Test execution completed: ${passedResults.length}/${allResults.length} cases passed`,
    stats: {
      totalCases: allResults.length,
      passed: passedResults.length,
      failed: failedResults.length,
      coreFlowCoverage:
        coreFlowCases.length > 0
          ? Math.round(
              ((coreFlowCases.filter((r) => r.status === "passed").length /
                coreFlowCases.length) *
                100) as number,
            )
          : 0,
      usabilityCoverage:
        usabilityCases.length > 0
          ? Math.round(
              ((usabilityCases.filter((r) => r.status === "passed").length /
                usabilityCases.length) *
                100) as number,
            )
          : 0,
      edgeCoverage:
        edgeCases.length > 0
          ? Math.round(
              ((edgeCases.filter((r) => r.status === "passed").length /
                edgeCases.length) *
                100) as number,
            )
          : 0,
    },
    failures: failedResults.map((r) => ({
      testCaseId: r.testCaseId,
      latestStatus: r.status,
      lastFailureReason: r.failureReason,
    })),
    iterations: iterations.map((it) => ({
      index: it.index,
      uiVersionId: it.uiVersionId,
      changesSummary:
        it.index === 0 ? "Initial UI generation" : "UI optimization",
    })),
  };

  return report;
}

/**
 * T016: Get run status with timeline
 */
export function getRunStatusInternal(testRunId: string): {
  status: TestRunStatus;
  currentIterationIndex: number;
  maxIterations: number;
  timeline: TimelineEvent[];
  componentId?: string;
} {
  const testRun = testRunsStore.get(testRunId);
  const timeline = timelinesStore.get(testRunId) || [];

  if (!testRun) {
    return {
      status: "failed",
      currentIterationIndex: 0,
      maxIterations: 3,
      timeline: [],
    };
  }

  return {
    status: testRun.status,
    currentIterationIndex: testRun.currentIterationIndex,
    maxIterations: testRun.maxIterations,
    timeline,
    componentId: testRun.componentId,
  };
}

/**
 * Helper: Update timeline
 */
export function updateTimeline(
  testRunId: string,
  phase: TimelinePhase,
  agent: string,
  summary?: string,
  finishedAt?: boolean,
) {
  const timeline = timelinesStore.get(testRunId) || [];
  const existingIdx = timeline.findIndex((e) => e.phase === phase);

  const event: TimelineEvent = {
    phase,
    agent,
    startedAt: new Date().toISOString(),
    summary,
    finishedAt: finishedAt ? new Date().toISOString() : undefined,
  };

  if (existingIdx >= 0) {
    timeline[existingIdx] = event;
  } else {
    timeline.push(event);
  }

  timelinesStore.set(testRunId, timeline);

  // Emit update event for subscriptions
  emitTestRunUpdate(testRunId);
}

/**
 * Helper: Emit update event for test run
 */
export function emitTestRunUpdate(testRunId: string) {
  const status = getRunStatusInternal(testRunId);
  const testCases = testCasesStore.get(testRunId) || [];
  const statusMap = testCaseStatusStore.get(testRunId) || new Map();

  const testCasesWithStatus = testCases.map((tc) => {
    const tcStatus = statusMap.get(tc.id) || {
      status: "pending" as TestCaseStatus,
      updatedAt: new Date().toISOString(),
    };
    return {
      id: tc.id,
      title: tc.title,
      description: tc.description,
      priority: tc.priority,
      category: tc.category,
      status: tcStatus.status,
      error: tcStatus.error,
      updatedAt: tcStatus.updatedAt,
    };
  });

  testRunEmitter.emit(`update:${testRunId}`, {
    status,
    testCases: testCasesWithStatus,
  });
}
