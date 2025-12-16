import { reviseComponent } from "~/server/openai";
import type { ComponentFile } from "~/utils/compiler";
import type { TestCaseResult, UiVersion, UserRequirement } from "./types";

/**
 * T020-T021: Optimizer - Revise UI based on failed test cases
 */
export async function optimizeUiForFailures(
  failedResults: TestCaseResult[],
  currentUiVersion: UiVersion,
  requirement: UserRequirement,
): Promise<{ files: ComponentFile[]; summary: string; shouldSkip: boolean }> {
  if (failedResults.length === 0) {
    return {
      files: currentUiVersion.files,
      summary: "No failures to fix",
      shouldSkip: true,
    };
  }

  // Check if all failures are due to "fetch failed" - infrastructure issue, not UI code issue
  const allFetchFailed = failedResults.every(
    (r) =>
      r.failureReason?.toLowerCase().includes("fetch failed") ||
      r.failureReason === "fetch failed",
  );

  if (allFetchFailed) {
    console.log(
      "⚠️ [MultiAgent] All failures are due to 'fetch failed' - skipping UI revision",
    );
    throw new Error(
      "All test failures are due to infrastructure issues (fetch failed). Cannot optimize UI code.",
    );
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
      shouldSkip: false,
    };
  } catch (error) {
    console.error("Error in optimizeUiForFailures:", error);
    throw error; // Re-throw the error instead of returning original files
  }
}
