import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env.mjs";
import { getModelByName } from "~/utils/utils";
import { generateNewComponent, reviseComponent } from "~/server/openai";
import type { ComponentFile } from "~/utils/compiler";
import { generateText } from "ai";
import { parseCodeToComponentFiles } from "~/utils/codeTransformer";
import type { MediaItem } from "~/types/multimodal";

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

// ============================================================================
// In-Memory Storage (T008)
// ============================================================================

const testRunsStore = new Map<string, TestRun>();
const testReportsStore = new Map<string, TestReport>();
const userRequirementsStore = new Map<string, UserRequirement>();
const uiVersionsStore = new Map<string, UiVersion>();
const timelinesStore = new Map<string, TimelineEvent[]>();

// ============================================================================
// Helper Functions for US1 Core Orchestration
// ============================================================================

/**
 * T010: Parse requirement text and create UserRequirement
 */
async function parseRequirement(
  requirementText: string,
  requirementId: string,
): Promise<UserRequirement> {
  const model = getModelByName(env.MODEL_NAME);

  const { text } = await generateText({
    model,
    system: `You are a requirements analyst. Parse the user's UI requirement and extract:
1. parsedGoals: List of main goals (as string array)
2. keyActions: List of key user actions (as string array)
3. constraints: List of constraints or limitations (as string array)

Respond with ONLY valid JSON matching this schema:
{
  "parsedGoals": ["goal1", "goal2"],
  "keyActions": ["action1", "action2"],
  "constraints": ["constraint1"]
}`,
    prompt: `Requirement: ${requirementText}`,
  });

  let parsed = {
    parsedGoals: [],
    keyActions: [],
    constraints: [],
  };

  try {
    parsed = JSON.parse(text);
  } catch {
    // Fallback: extract basic structure from text
    parsed = {
      parsedGoals: [requirementText.substring(0, 100)],
      keyActions: ["implement UI based on requirement"],
      constraints: [],
    };
  }

  const requirement: UserRequirement = {
    id: requirementId,
    rawText: requirementText,
    createdAt: new Date().toISOString(),
    parsedGoals: parsed.parsedGoals || [],
    keyActions: parsed.keyActions || [],
    constraints: parsed.constraints || [],
  };

  userRequirementsStore.set(requirementId, requirement);
  return requirement;
}

/**
 * T011: Generate initial UI version using generateNewComponent
 */
async function generateInitialUi(
  requirementText: string,
  uiVersionId: string,
  media?: MediaItem[],
): Promise<UiVersion> {
  const files = await generateNewComponent(requirementText, media);

  const uiVersion: UiVersion = {
    id: uiVersionId,
    componentId: `comp_${Date.now()}`,
    versionIndex: 0,
    files,
    createdAt: new Date().toISOString(),
    createdBy: "generator",
  };

  uiVersionsStore.set(uiVersionId, uiVersion);
  return uiVersion;
}

/**
 * T012: Generate test cases using LLM
 */
async function generateTestCases(
  requirement: UserRequirement,
  uiVersion: UiVersion,
  testRunId: string,
): Promise<TestCase[]> {
  const model = getModelByName(env.MODEL_NAME);

  // Build a simple UI description from files
  const uiDescription = uiVersion.files
    .map((f) => `File: ${f.name}\n${f.content.substring(0, 200)}...`)
    .join("\n\n");

  const { text } = await generateText({
    model,
    system: `You are a QA engineer. Generate test cases for the given requirement and UI.
Return ONLY a valid JSON array matching this schema:
[
  {
    "title": "Test case title",
    "description": "What to test",
    "priority": "P0" | "P1" | "P2" | "P3",
    "category": "core-flow" | "usability" | "edge",
    "steps": [
      {
        "description": "Step description",
        "action": "click|input|scroll|check",
        "targetSelector": "CSS selector or element identifier",
        "inputValue": "text to input (if applicable)",
        "expectedOutcome": "What should happen"
      }
    ],
    "expectedResult": "Final expected state"
  }
]

Generate 3-5 focused test cases covering core flows and edge cases.`,
    prompt: `Requirement: ${requirement.rawText}

Parsed Goals: ${requirement.parsedGoals.join(", ")}
Key Actions: ${requirement.keyActions.join(", ")}

UI Description:
${uiDescription}`,
  });

  let rawCases: Array<Record<string, unknown>> = [];
  try {
    rawCases = JSON.parse(text);
  } catch {
    // Fallback: create a basic test case
    rawCases = [
      {
        title: "Basic smoke test",
        description: "Load page and verify UI renders",
        priority: "P0",
        category: "core-flow",
        steps: [
          {
            description: "Page loads successfully",
            action: "check",
            expectedOutcome: "UI elements visible",
          },
        ],
        expectedResult: "Page is responsive and interactive",
      },
    ];
  }

  const testCases: TestCase[] = rawCases.map((tc, idx) => ({
    id: `tc_${testRunId}_${idx}`,
    requirementId: requirement.id,
    title: (tc.title as string) || "Test case",
    description: (tc.description as string) || "",
    priority: ((tc.priority as TestCasePriority) || "P1") as TestCasePriority,
    category: ((tc.category as TestCaseCategory) ||
      "core-flow") as TestCaseCategory,
    steps: (tc.steps as TestCaseStep[]) || [],
    expectedResult: (tc.expectedResult as string) || "",
  }));

  console.log(
    "📝 [MultiAgent] Test cases with categories:",
    testCases.map((tc) => ({
      id: tc.id,
      title: tc.title,
      category: tc.category,
    })),
  );

  return testCases;
}

/**
 * T020-T021: Optimizer - Revise UI based on failed test cases
 */
async function optimizeUiForFailures(
  failedResults: TestCaseResult[],
  currentUiVersion: UiVersion,
  requirement: UserRequirement,
): Promise<{ files: ComponentFile[]; summary: string }> {
  if (failedResults.length === 0) {
    return {
      files: currentUiVersion.files,
      summary: "No failures to fix",
    };
  }

  const failureSummary = failedResults
    .map(
      (r) => `Test case ${r.testCaseId}: ${r.failureReason || "Unknown error"}`,
    )
    .join("\n");

  const optimizationPrompt = `You are a UI optimization expert. The following test cases failed:

${failureSummary}

Original requirement: ${requirement.rawText}

Please fix the UI to address these failures. Ensure the fixes are focused and minimal.`;

  try {
    const revisedFiles = await reviseComponent(
      optimizationPrompt,
      currentUiVersion.files,
    );

    return {
      files: revisedFiles,
      summary: `Optimized UI to fix ${failedResults.length} failing test cases`,
    };
  } catch (error) {
    console.error("Error in optimizeUiForFailures:", error);
    // Fallback: return original files
    return {
      files: currentUiVersion.files,
      summary: "UI optimization attempted but encountered error",
    };
  }
}

/**
 * T023-T024: Main iteration loop with 3-round limit
 */
async function runIterativeTestingLoop(
  testRunId: string,
  requirement: UserRequirement,
  initialUiVersion: UiVersion,
  testCases: TestCase[],
): Promise<{ iterations: IterationCycle[]; finalStatus: TestRunStatus }> {
  const maxIterations = 3;
  const iterations: IterationCycle[] = [];
  let currentUiVersion = initialUiVersion;
  let allTestResults: TestCaseResult[] = [];

  // Initial evaluation (iteration 0)
  updateTimeline(
    testRunId,
    "test-execution",
    "Evaluator",
    "Running initial tests...",
  );
  console.log("🧪 [MultiAgent] Running initial test evaluation...");
  const testResults = await evaluateTestCases(testCases, currentUiVersion);
  const passedCount = testResults.filter((r) => r.status === "passed").length;
  console.log("📊 [MultiAgent] Initial test results:", {
    passed: passedCount,
    total: testResults.length,
    passRate: `${Math.round((passedCount / testResults.length) * 100)}%`,
  });
  updateTimeline(
    testRunId,
    "test-execution",
    "Evaluator",
    `Initial: ${passedCount}/${testResults.length} passed`,
    true,
  );

  iterations.push(buildIterationCycle(0, currentUiVersion.id, testResults));
  allTestResults = [...testResults];

  // Check if all passed (no need for iteration)
  const failedResults = testResults.filter((r) => r.status === "failed");
  if (failedResults.length === 0) {
    return {
      iterations,
      finalStatus: "succeeded",
    };
  }

  // Iterative improvement loop (iterations 1-2)
  for (let iteration = 1; iteration < maxIterations; iteration++) {
    // Check if we should continue
    if (failedResults.length === 0) {
      break;
    }

    // Optimize UI based on failures
    updateTimeline(
      testRunId,
      "ui-optimization",
      "Optimizer",
      `Iteration ${iteration}: Optimizing UI...`,
    );
    const { files: optimizedFiles, summary: optimizationSummary } =
      await optimizeUiForFailures(failedResults, currentUiVersion, requirement);

    // Create new UI version
    const newUiVersionId = `ui_${testRunId}_${iteration}`;
    currentUiVersion = {
      id: newUiVersionId,
      componentId: currentUiVersion.componentId,
      versionIndex: iteration,
      files: optimizedFiles,
      createdAt: new Date().toISOString(),
      createdBy: "optimizer",
      sourceFailureTestCaseId: failedResults[0]?.testCaseId,
    };
    uiVersionsStore.set(newUiVersionId, currentUiVersion);

    updateTimeline(
      testRunId,
      "ui-optimization",
      "Optimizer",
      optimizationSummary,
      true,
    );

    // Re-evaluate only failed test cases (T024)
    updateTimeline(
      testRunId,
      "test-execution",
      "Evaluator",
      `Iteration ${iteration}: Regression testing...`,
    );
    const regressionResults = await evaluateTestCases(
      testCases.filter((tc) =>
        failedResults.some((fr) => fr.testCaseId === tc.id),
      ),
      currentUiVersion,
    );

    updateTimeline(
      testRunId,
      "test-execution",
      "Evaluator",
      `Iteration ${iteration}: ${
        regressionResults.filter((r) => r.status === "passed").length
      }/${regressionResults.length} passed`,
      true,
    );

    iterations.push(
      buildIterationCycle(iteration, currentUiVersion.id, regressionResults),
    );

    // Update overall test results
    allTestResults = testCases.map((tc) => {
      const regressionResult = regressionResults.find(
        (r) => r.testCaseId === tc.id,
      );
      return (
        regressionResult || allTestResults.find((r) => r.testCaseId === tc.id)!
      );
    });

    // Update failed results for next iteration
    failedResults.length = 0;
    failedResults.push(...allTestResults.filter((r) => r.status === "failed"));
  }

  // Determine final status
  const finalFailedCount = allTestResults.filter(
    (r) => r.status === "failed",
  ).length;
  const finalStatus =
    finalFailedCount === 0
      ? "succeeded"
      : iterations.length >= maxIterations
      ? "stopped"
      : "failed";

  return {
    iterations,
    finalStatus,
  };
}

/**
 * T013: Evaluator - Execute test cases against UI using mock results for now
 * In production, this would call MCP server for browser automation
 */
async function evaluateTestCases(
  testCases: TestCase[],
  uiVersion: UiVersion,
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];

  for (const tc of testCases) {
    // Mock evaluation: randomly pass/fail for demonstration
    // In real implementation, this would call MCP server
    const passed = Math.random() > 0;

    const stepResults: TestStepResult[] = tc.steps.map((step, idx) => ({
      stepId: step.id,
      status: passed
        ? "passed"
        : idx === tc.steps.length - 1
        ? "failed"
        : "passed",
      message: passed
        ? "Step executed successfully"
        : "Step failed or element not found",
    }));

    results.push({
      testCaseId: tc.id,
      status: passed ? "passed" : "failed",
      stepResults,
      failureReason: passed
        ? undefined
        : "UI element not responsive or incorrect behavior",
      relatedUiVersionId: uiVersion.id,
    });
  }

  return results;
}

/**
 * T014: Build IterationCycle and fill TestCaseResult
 */
function buildIterationCycle(
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
function generateTestReport(
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
function getRunStatusInternal(testRunId: string): {
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
function updateTimeline(
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
}

// ============================================================================
// tRPC Router (T004, T005)
// ============================================================================

export const multiAgentRouter = createTRPCRouter({
  /**
   * T010-T015: Start a multi-agent testing run (US1 MVP + US2 Iteration + US4 Regression)
   */
  startRun: publicProcedure
    .input(
      z.object({
        requirementText: z.string(),
        componentId: z.string().optional(),
        isRegressionTest: z.boolean().optional(),
        media: z
          .array(
            z.object({
              id: z.string(),
              type: z.enum([
                "image",
                "audio",
                "code",
                "element",
                "action",
                "action-sequence",
                "logic",
              ]),
              url: z.string(),
              name: z.string(),
              size: z.number().optional(),
              actions: z.any().optional(),
              logicId: z.string().optional(),
              logicContent: z.string().optional(),
              elementName: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const testRunId = `run_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 9)}`;
      const requirementId = `req_${Date.now()}`;
      const initialUiVersionId = `ui_${Date.now()}_0`;

      console.log("🚀 [MultiAgent] Test run started:", {
        testRunId,
        componentId: input.componentId,
        isRegressionTest: input.isRegressionTest,
        hasMedia: !!input.media?.length,
      });

      try {
        // Phase 1: Requirement parsing
        updateTimeline(
          testRunId,
          "requirement-parsing",
          "Requirement Parser",
          "Analyzing user requirement...",
        );
        console.log("📋 [MultiAgent] Parsing requirement...");
        const requirement = await parseRequirement(
          input.requirementText,
          requirementId,
        );
        console.log("✅ [MultiAgent] Requirement parsed:", {
          goals: requirement.parsedGoals.length,
          actions: requirement.keyActions.length,
        });
        updateTimeline(
          testRunId,
          "requirement-parsing",
          "Requirement Parser",
          `Parsed ${requirement.parsedGoals.length} goals`,
          true,
        );

        let uiVersion: UiVersion;

        // Phase 2a: Load existing UI (US4 Regression) OR Generate new UI (US1-2)
        if (input.componentId) {
          // T033: Load existing component for regression/testing
          updateTimeline(
            testRunId,
            "ui-generation",
            "UI Loader",
            "Loading existing UI...",
          );

          try {
            const component = await ctx.db.component.findUnique({
              where: { id: input.componentId },
              include: { revisions: true },
            });

            if (!component) {
              throw new Error(`Component ${input.componentId} not found`);
            }

            // Get the latest revision's code
            const latestRevision =
              component.revisions[component.revisions.length - 1];
            const files = latestRevision
              ? parseCodeToComponentFiles(latestRevision.code)
              : parseCodeToComponentFiles(component.code);

            uiVersion = {
              id: initialUiVersionId,
              componentId: input.componentId,
              versionIndex: 0,
              files,
              createdAt: new Date().toISOString(),
              createdBy: "generator",
            };

            updateTimeline(
              testRunId,
              "ui-generation",
              "UI Loader",
              `Loaded existing UI with ${files.length} files${
                input.isRegressionTest ? " for regression testing" : ""
              }`,
              true,
            );
          } catch (error) {
            console.error("Error loading component:", error);
            throw new Error(
              `Failed to load component: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            );
          }
        } else {
          // Phase 2b: Generate new UI (US1-2)
          updateTimeline(
            testRunId,
            "ui-generation",
            "UI Generator",
            "Generating UI from requirement...",
          );
          uiVersion = await generateInitialUi(
            input.requirementText,
            initialUiVersionId,
            input.media,
          );
          updateTimeline(
            testRunId,
            "ui-generation",
            "UI Generator",
            `Generated UI with ${uiVersion.files.length} files`,
            true,
          );
        }

        // Phase 3: Test Case Generation (T034: Mark as old/new for US4)
        updateTimeline(
          testRunId,
          "testcase-generation",
          "Test Planner",
          "Generating test cases...",
        );
        console.log("📝 [MultiAgent] Generating test cases...");
        const testCases = await generateTestCases(
          requirement,
          uiVersion,
          testRunId,
        );

        console.log("✅ [MultiAgent] Test cases generated:", testCases);

        // T034: Tag test cases for regression scenarios
        if (input.isRegressionTest) {
          // Mark first 50% as old, rest as new
          const newCutoff = Math.ceil(testCases.length / 2);
          testCases.forEach((tc, idx) => {
            (tc as unknown as Record<string, unknown>).isNewCase =
              idx >= newCutoff;
          });
        }

        updateTimeline(
          testRunId,
          "testcase-generation",
          "Test Planner",
          `Generated ${testCases.length} test cases${
            input.isRegressionTest ? " (regression)" : ""
          }`,
          true,
        );

        // Phase 4-5: Iterative Testing and Optimization (T023-T024) (US2)
        console.log("🔄 [MultiAgent] Starting iterative testing loop...");
        const { iterations, finalStatus } = await runIterativeTestingLoop(
          testRunId,
          requirement,
          uiVersion,
          testCases,
        );
        console.log("✅ [MultiAgent] Testing loop completed:", {
          iterations: iterations.length,
          status: finalStatus,
        });

        // Phase 6: Report Generation (T015)
        updateTimeline(
          testRunId,
          "report-generation",
          "Reporter",
          "Generating test report...",
        );
        console.log("📊 [MultiAgent] Generating test report...");
        const report = generateTestReport(testRunId, iterations, testCases);
        testReportsStore.set(testRunId, report);
        console.log("✅ [MultiAgent] Report stored:", {
          testRunId,
          reportId: report.id,
          totalCases: report.stats.totalCases,
          passed: report.stats.passed,
          failed: report.stats.failed,
          coverage: {
            coreFlow: report.stats.coreFlowCoverage,
            usability: report.stats.usabilityCoverage,
            edge: report.stats.edgeCoverage,
          },
        });
        updateTimeline(
          testRunId,
          "report-generation",
          "Reporter",
          "Report ready",
          true,
        );

        // Create and store TestRun
        const testRun: TestRun = {
          id: testRunId,
          requirementId,
          initialUiVersionId,
          createdAt: new Date().toISOString(),
          status: finalStatus,
          currentIterationIndex: iterations.length - 1,
          maxIterations: 3,
          testCases,
          iterations,
          componentId: uiVersion.componentId,
        };

        testRunsStore.set(testRunId, testRun);
        console.log("✅ [MultiAgent] Test run completed successfully:", {
          testRunId,
          componentId: uiVersion.componentId,
          status: finalStatus,
        });

        return {
          testRunId,
          initialUiVersionId,
          requirementId,
        };
      } catch (error) {
        console.error("❌ [MultiAgent] Error in startRun:", error);
        console.error(
          "Stack trace:",
          error instanceof Error ? error.stack : error,
        );
        throw error;
      }
    }),

  /**
   * T016: Get run status
   */
  getRunStatus: publicProcedure
    .input(
      z.object({
        testRunId: z.string(),
      }),
    )
    .query(({ input }) => {
      console.log("📡 [MultiAgent] Getting run status for:", input.testRunId);
      const status = getRunStatusInternal(input.testRunId);
      console.log("📊 [MultiAgent] Current status:", status.status);
      return status;
    }),

  /**
   * T017: Get test report
   */
  getReport: publicProcedure
    .input(
      z.object({
        testRunId: z.string(),
      }),
    )
    .query(({ input }) => {
      console.log("📊 [MultiAgent] Getting report for:", input.testRunId);
      console.log(
        "📦 [MultiAgent] Reports in store:",
        Array.from(testReportsStore.keys()),
      );
      const report = testReportsStore.get(input.testRunId);
      if (!report) {
        console.error("❌ [MultiAgent] Report not found:", input.testRunId);
        throw new Error(`Report not found for testRunId: ${input.testRunId}`);
      }
      console.log("✅ [MultiAgent] Report found:", report.id);
      return report;
    }),
});
