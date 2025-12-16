import { executeMcpTest } from "../mcp";
import type {
  TestCase,
  UiVersion,
  TestCaseResult,
  TestStepResult,
} from "./types";
import { testCaseStatusStore } from "./storage";
import { emitTestRunUpdate } from "./helpers";

/**
 * T013: Evaluator - Execute test cases against UI using MCP server
 */
export async function evaluateTestCases(
  testCases: TestCase[],
  uiVersion: UiVersion,
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];

  // Get MCP server URL from environment
  const mcpServerUrl =
    process.env.MCP_SERVER_URL || "http://localhost:8000/mcp";

  console.log(
    "🧪 [MultiAgent] Evaluating",
    testCases.length,
    "test cases using MCP server:",
    mcpServerUrl,
  );

  for (const tc of testCases) {
    console.log(`📝 [MultiAgent] Executing test case: ${tc.title}`);

    // Update status to running
    const testRunId = tc.requirementId; // Use requirementId as testRunId for now
    const statusMap = testCaseStatusStore.get(testRunId);
    if (statusMap) {
      statusMap.set(tc.id, {
        status: "running",
        updatedAt: new Date().toISOString(),
      });
      emitTestRunUpdate(testRunId); // Notify subscribers
    }

    try {
      // Build test description and steps
      const testDescription = `Test: ${tc.title}\n${tc.description}\nExpected Result: ${tc.expectedResult}`;
      const testSteps = tc.steps.map((step) => {
        const parts = [`${step.action}: ${step.description}`];
        if (step.targetSelector) {
          parts.push(`Target: ${step.targetSelector}`);
        }
        if (step.inputValue) {
          parts.push(`Input: ${step.inputValue}`);
        }
        if (step.expectedOutcome) {
          parts.push(`Expected: ${step.expectedOutcome}`);
        }
        return parts.join(" | ");
      });

      // Execute test using MCP
      const testResult = await executeMcpTest({
        testDescription,
        testSteps,
        mcpServerUrl,
        maxIterations: 15,
      });

      console.log(
        `📊 [MultiAgent] Test case "${tc.title}" result:`,
        testResult,
      );

      // Map MCP result to TestCaseResult
      const stepResults: TestStepResult[] = tc.steps.map((step, idx) => ({
        stepId: step.id,
        status: testResult.success
          ? "passed"
          : idx === tc.steps.length - 1
          ? "failed"
          : "passed",
        message: testResult.success
          ? "Step executed successfully"
          : testResult.error || "Step execution failed",
      }));

      const finalStatus = testResult.success ? "passed" : "failed";
      results.push({
        testCaseId: tc.id,
        status: finalStatus,
        stepResults,
        failureReason: testResult.success
          ? undefined
          : testResult.error || "Test execution failed",
        relatedUiVersionId: uiVersion.id,
      });

      // Update final status
      if (statusMap) {
        statusMap.set(tc.id, {
          status: finalStatus,
          error: testResult.success ? undefined : testResult.error,
          updatedAt: new Date().toISOString(),
        });
        emitTestRunUpdate(testRunId); // Notify subscribers
      }
    } catch (error) {
      console.error(
        `❌ [MultiAgent] Error executing test case "${tc.title}":`,
        error,
      );

      // Mark as failed if there's an execution error
      const stepResults: TestStepResult[] = tc.steps.map((step) => ({
        stepId: step.id,
        status: "failed",
        message:
          error instanceof Error ? error.message : "Test execution error",
      }));

      results.push({
        testCaseId: tc.id,
        status: "failed",
        stepResults,
        failureReason:
          error instanceof Error ? error.message : "Test execution error",
        relatedUiVersionId: uiVersion.id,
      });

      // Update final status
      if (statusMap) {
        statusMap.set(tc.id, {
          status: "failed",
          error:
            error instanceof Error ? error.message : "Test execution error",
          updatedAt: new Date().toISOString(),
        });
        emitTestRunUpdate(testRunId); // Notify subscribers
      }
    }
  }

  return results;
}
