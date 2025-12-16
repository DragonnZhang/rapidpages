import type {
  UserRequirement,
  UiVersion,
  TestCase,
  TestCaseResult,
  IterationCycle,
  TestRunStatus,
} from "./types";
import { uiVersionsStore } from "./storage";
import { evaluateTestCases } from "./evaluator";
import { optimizeUiForFailures } from "./optimizer";
import { buildIterationCycle } from "./helpers";
import { updateTimeline } from "./helpers";

/**
 * T023-T024: Main iteration loop with 3-round limit
 */
export async function runIterativeTestingLoop(
  testRunId: string,
  requirement: UserRequirement,
  initialUiVersion: UiVersion,
  testCases: TestCase[],
  ctx: { db: any },
  baseRevisionId?: string,
): Promise<{
  iterations: IterationCycle[];
  finalStatus: TestRunStatus;
  latestRevisionId?: string;
}> {
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
  const testResults = await evaluateTestCases(
    testCases,
    currentUiVersion,
    testRunId,
  );
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

    try {
      const { files: optimizedFiles, summary: optimizationSummary } =
        await optimizeUiForFailures(
          failedResults,
          currentUiVersion,
          requirement,
        );

      // Save optimized UI to database
      const newRevision = await ctx.db.componentRevision.create({
        data: {
          componentId: currentUiVersion.componentId,
          code: JSON.stringify(optimizedFiles),
          prompt: `Multi-agent optimization (iteration ${iteration}): ${optimizationSummary}`,
        },
      });

      console.log(
        `[MultiAgent] Created new revision ${newRevision.id} for iteration ${iteration}`,
      );

      // Update component's code to latest revision
      await ctx.db.component.update({
        where: { id: currentUiVersion.componentId },
        data: { code: JSON.stringify(optimizedFiles) },
      });

      // Create new UI version
      const newUiVersionId = `ui_${testRunId}_${iteration}`;
      currentUiVersion = {
        id: newUiVersionId,
        componentId: currentUiVersion.componentId,
        versionIndex: iteration,
        files: optimizedFiles,
        revisionId: newRevision.id,
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
        testRunId,
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
        if (regressionResult) {
          return regressionResult;
        }
        return allTestResults.find((r) => r.testCaseId === tc.id)!;
      });

      // Update failed results for next iteration
      failedResults.length = 0;
      failedResults.push(
        ...allTestResults.filter((r) => r.status === "failed"),
      );
    } catch (error) {
      // If optimization fails due to infrastructure issues, stop the loop
      console.error(`❌ [MultiAgent] Iteration ${iteration} failed:`, error);
      updateTimeline(
        testRunId,
        "ui-optimization",
        "Optimizer",
        `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        true,
      );

      // Exit the loop early
      break;
    }
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
    latestRevisionId: currentUiVersion.revisionId,
  };
}
