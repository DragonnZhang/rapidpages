import { generateText } from "ai";
import { getModelByName } from "~/utils/utils";
import { env } from "~/env.mjs";
import type {
  UserRequirement,
  UiVersion,
  TestCase,
  TestCasePriority,
  TestCaseCategory,
  TestCaseStep,
  TestCaseStatus,
} from "./types";
import { testCasesStore, testCaseStatusStore } from "./storage";
import { emitTestRunUpdate } from "./helpers";

/**
 * T012: Generate test cases using LLM
 */
export async function generateTestCases(
  requirement: UserRequirement,
  uiVersion: UiVersion,
  testRunId: string,
): Promise<TestCase[]> {
  const model = getModelByName(env.MODEL_NAME);

  // Build a simple UI description from files
  const uiDescription = uiVersion.files
    .map((f) => `File: ${f.filename}\n${f.content.substring(0, 200)}...`)
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

  // Store test cases for this test run
  testCasesStore.set(testRunId, testCases);
  console.log(
    "💾 [MultiAgent] Stored test cases for run:",
    testRunId,
    "count:",
    testCases.length,
  );

  // Initialize status for each test case
  const statusMap = new Map<
    string,
    { status: TestCaseStatus; error?: string; updatedAt: string }
  >();
  testCases.forEach((tc) => {
    statusMap.set(tc.id, {
      status: "pending",
      updatedAt: new Date().toISOString(),
    });
  });
  testCaseStatusStore.set(testRunId, statusMap);

  // Emit initial update with test cases
  emitTestRunUpdate(testRunId);

  return testCases;
}
