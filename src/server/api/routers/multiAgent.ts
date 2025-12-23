import { z } from "zod";
import { observable } from "@trpc/server/observable";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Import and re-export all types
import type {
  TestRun,
  TestReport,
  TestCase,
  TestCaseStatus,
  TestCasePriority,
  TestCaseCategory,
  TestRunStatus,
  TimelineEvent,
  TimelinePhase,
  UserRequirement,
  UiVersion,
  TestCaseStep,
  TestStepStatus,
  TestStepResult,
  TestCaseResult,
  IterationCycle,
} from "./multiAgent/types";

import type { MediaItem } from "~/types/multimodal";

// Re-export types for external use
export type {
  TestRun,
  TestReport,
  TestCase,
  TestCaseStatus,
  TestCasePriority,
  TestCaseCategory,
  TestRunStatus,
  TimelineEvent,
  TimelinePhase,
  UserRequirement,
  UiVersion,
  TestCaseStep,
  TestStepStatus,
  TestStepResult,
  TestCaseResult,
  IterationCycle,
  MediaItem,
};

// Import storage
import {
  testRunsStore,
  testReportsStore,
  testCasesStore,
  testCaseStatusStore,
  testRunEmitter,
} from "./multiAgent/storage";

// Import agents
import { parseRequirement } from "./multiAgent/requirementParser";
import { generateInitialUi } from "./multiAgent/uiGenerator";
import { generateTestCases } from "./multiAgent/testCaseGenerator";

// Import orchestrator and helpers
import { runIterativeTestingLoop } from "./multiAgent/orchestrator";
import {
  generateTestReport,
  getRunStatusInternal,
  updateTimeline,
  emitTestRunUpdate,
} from "./multiAgent/helpers";

import { parseCodeToComponentFiles } from "~/utils/codeTransformer";

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

      // Create initial TestRun immediately so frontend can query it
      const initialTestRun: TestRun = {
        id: testRunId,
        requirementId,
        initialUiVersionId,
        createdAt: new Date().toISOString(),
        status: "running",
        currentIterationIndex: 0,
        maxIterations: 3,
        testCases: [],
        iterations: [],
        componentId: input.componentId,
      };
      testRunsStore.set(testRunId, initialTestRun);
      console.log("✅ [MultiAgent] Initial test run stored:", testRunId);

      // Execute the actual testing asynchronously (don't await)
      (async () => {
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

          let uiVersion: ReturnType<typeof generateInitialUi> extends Promise<
            infer T
          >
            ? T
            : never;

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
              const codeJson = latestRevision?.code || component.code || "[]";
              const files = parseCodeToComponentFiles(codeJson);

              uiVersion = {
                id: initialUiVersionId,
                componentId: input.componentId,
                revisionId: latestRevision?.id,
                versionIndex: 0,
                files,
                createdAt: new Date().toISOString(),
                createdBy: "generator",
              };

              console.log(
                "✅ [MultiAgent] Loaded existing UI:",
                input.componentId,
              );
              updateTimeline(
                testRunId,
                "ui-generation",
                "UI Loader",
                `Loaded component ${input.componentId}`,
                true,
              );
            } catch (error) {
              console.error("❌ [MultiAgent] Failed to load component:", error);
              throw error;
            }
          } else {
            // Phase 2b: Generate new UI
            updateTimeline(
              testRunId,
              "ui-generation",
              "UI Generator",
              "Generating UI from requirement...",
            );
            console.log("🎨 [MultiAgent] Generating initial UI...");
            uiVersion = await generateInitialUi(
              input.requirementText,
              initialUiVersionId,
              input.media,
            );
            console.log("✅ [MultiAgent] UI generated:", {
              files: uiVersion.files.length,
              componentId: uiVersion.componentId,
            });
            updateTimeline(
              testRunId,
              "ui-generation",
              "UI Generator",
              `Generated ${uiVersion.files.length} files`,
              true,
            );

            // Save UI to database (US1)
            try {
              const newComponent = await ctx.db.component.create({
                data: {
                  prompt: requirement.parsedGoals[0] || "Multi-agent UI",
                  code: JSON.stringify(uiVersion.files),
                  visibility: "PRIVATE",
                  authorId: ctx.session?.user?.id,
                },
              });

              // Update uiVersion with real componentId
              uiVersion.componentId = newComponent.id;
              console.log("✅ [MultiAgent] Component saved:", newComponent.id);

              // Update the test run with componentId
              const testRun = testRunsStore.get(testRunId);
              if (testRun) {
                testRun.componentId = newComponent.id;
                testRunsStore.set(testRunId, testRun);
              }
            } catch (error) {
              console.error("❌ [MultiAgent] Failed to save component:", error);
            }
          }

          // Phase 3: Generate test cases
          updateTimeline(
            testRunId,
            "testcase-generation",
            "Test Case Generator",
            "Creating test cases...",
          );
          console.log("📝 [MultiAgent] Generating test cases...");
          const testCases = await generateTestCases(
            requirement,
            uiVersion,
            testRunId,
          );
          console.log("✅ [MultiAgent] Test cases generated:", {
            count: testCases.length,
            categories: testCases.reduce(
              (acc, tc) => {
                acc[tc.category] = (acc[tc.category] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            ),
          });
          updateTimeline(
            testRunId,
            "testcase-generation",
            "Test Case Generator",
            `Generated ${testCases.length} test cases`,
            true,
          );

          // Phase 4: Run iterative testing and optimization loop (US1 + US2)
          const { iterations, finalStatus, latestRevisionId } =
            await runIterativeTestingLoop(
              testRunId,
              requirement,
              uiVersion,
              testCases,
              ctx,
            );

          // Phase 5: Generate test report
          updateTimeline(
            testRunId,
            "report-generation",
            "Report Generator",
            "Creating test report...",
          );
          console.log("📊 [MultiAgent] Generating test report...");
          const report = generateTestReport(testRunId, iterations, testCases);
          testReportsStore.set(testRunId, report);
          console.log("✅ [MultiAgent] Report generated:", {
            passed: report.stats.passed,
            failed: report.stats.failed,
            total: report.stats.totalCases,
          });
          updateTimeline(
            testRunId,
            "report-generation",
            "Report Generator",
            `${report.stats.passed}/${report.stats.totalCases} passed`,
            true,
          );

          // Update final test run status
          const finalTestRun = testRunsStore.get(testRunId);
          if (finalTestRun) {
            finalTestRun.status = finalStatus;
            finalTestRun.currentIterationIndex = iterations.length - 1;
            finalTestRun.iterations = iterations;
            finalTestRun.testCases = testCases;
            testRunsStore.set(testRunId, finalTestRun);
            emitTestRunUpdate(testRunId);
          }

          console.log("✅ [MultiAgent] Test run completed:", {
            testRunId,
            status: finalStatus,
            iterations: iterations.length,
          });
        } catch (error) {
          console.error("❌ [MultiAgent] Test run failed:", error);

          // Update test run status to failed
          const testRun = testRunsStore.get(testRunId);
          if (testRun) {
            testRun.status = "failed";
            testRunsStore.set(testRunId, testRun);
            emitTestRunUpdate(testRunId);
          }

          // Log the error for debugging
          updateTimeline(
            testRunId,
            "report-generation",
            "System",
            `Error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            true,
          );
        }
      })();

      // Return immediately with testRunId
      return {
        testRunId,
        initialUiVersionId,
        requirementId,
        latestRevisionId: undefined,
      };
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
      return getRunStatusInternal(input.testRunId);
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

  /**
   * Get test cases with real-time execution status
   */
  getTestCases: publicProcedure
    .input(
      z.object({
        testRunId: z.string(),
      }),
    )
    .query(({ input }) => {
      const testCases = testCasesStore.get(input.testRunId) || [];
      const statusMap = testCaseStatusStore.get(input.testRunId) || new Map();

      const result = testCases.map((tc) => {
        const status = statusMap.get(tc.id) || {
          status: "pending" as TestCaseStatus,
          updatedAt: new Date().toISOString(),
        };
        return {
          id: tc.id,
          title: tc.title,
          description: tc.description,
          priority: tc.priority,
          category: tc.category,
          status: status.status,
          error: status.error,
          updatedAt: status.updatedAt,
        };
      });

      return result;
    }),

  /**
   * Subscribe to real-time test run updates (replaces polling)
   */
  onTestRunUpdate: publicProcedure
    .input(
      z.object({
        testRunId: z.string(),
      }),
    )
    .subscription(({ input }) => {
      return observable<{
        status: {
          status: TestRunStatus;
          currentIterationIndex: number;
          maxIterations: number;
          timeline: Array<{
            phase: string;
            agent: string;
            startedAt?: string;
            finishedAt?: string;
            summary?: string;
          }>;
          componentId?: string;
        };
        testCases: Array<{
          id: string;
          title: string;
          description: string;
          priority: TestCasePriority;
          category: TestCaseCategory;
          status: TestCaseStatus;
          error?: string;
          updatedAt: string;
        }>;
      }>((emit) => {
        const eventName = `update:${input.testRunId}`;

        // Send initial data immediately
        const initialStatus = getRunStatusInternal(input.testRunId);
        const initialTestCases = testCasesStore.get(input.testRunId) || [];
        const initialStatusMap =
          testCaseStatusStore.get(input.testRunId) || new Map();

        const initialTestCasesWithStatus = initialTestCases.map((tc) => {
          const tcStatus = initialStatusMap.get(tc.id) || {
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

        emit.next({
          status: initialStatus,
          testCases: initialTestCasesWithStatus,
        });

        // Listen for updates
        const onUpdate = (data: {
          status: typeof initialStatus;
          testCases: typeof initialTestCasesWithStatus;
        }) => {
          emit.next(data);
        };

        testRunEmitter.on(eventName, onUpdate);

        // Cleanup on unsubscribe
        return () => {
          testRunEmitter.off(eventName, onUpdate);
        };
      });
    }),
});
