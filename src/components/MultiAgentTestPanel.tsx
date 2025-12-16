import { useState, useEffect } from "react";
import { api } from "~/utils/api";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { MultiAgentRunTimeline } from "./MultiAgentRunTimeline";
import { TestCasesPanel } from "./TestCasesPanel";
import type { TestReport } from "~/server/api/routers/multiAgent";
import { useRouter } from "next/router";

interface MultiAgentTestPanelProps {
  componentId: string;
  componentName?: string;
  autoStart?: boolean;
}

export const MultiAgentTestPanel = ({
  componentId,
  componentName,
  autoStart = false,
}: MultiAgentTestPanelProps) => {
  const [testRunId, setTestRunId] = useState<string | null>(null);
  const [testReport, setTestReport] = useState<TestReport | null>(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [isTestPanelVisible, setIsTestPanelVisible] = useState(false);
  const router = useRouter();

  const startRunMutation = api.multiAgent.startRun.useMutation();

  const { data: runStatus } = api.multiAgent.getRunStatus.useQuery(
    { testRunId: testRunId! },
    {
      enabled: !!testRunId,
      refetchInterval: (data) => {
        if (!data) return false;
        return data.status === "running" ? 1000 : false;
      },
    },
  );

  const { data: reportData, error: reportError } =
    api.multiAgent.getReport.useQuery(
      { testRunId: testRunId! },
      {
        enabled:
          !!testRunId &&
          runStatus?.status !== "running" &&
          runStatus?.status !== undefined,
        retry: 3,
        retryDelay: 1000,
      },
    );

  const { data: testCases } = api.multiAgent.getTestCases.useQuery(
    { testRunId: testRunId! },
    {
      enabled: !!testRunId,
      refetchInterval: (data) => {
        if (!data) return false;
        // Refetch while there are pending or running tests
        const hasActiveTests = data.some(
          (tc) => tc.status === "pending" || tc.status === "running",
        );
        return hasActiveTests ? 1000 : false;
      },
    },
  );

  useEffect(() => {
    if (testCases) {
      console.log(
        "📋 [Frontend] Test cases loaded:",
        testCases.length,
        testCases,
      );
    }
  }, [testCases]);

  useEffect(() => {
    console.log(
      "🎯 [Frontend] Current testRunId:",
      testRunId,
      "- Panel visible:",
      !!testRunId,
    );
  }, [testRunId]);

  useEffect(() => {
    if (reportData) {
      console.log("✅ [Frontend] Report received:", reportData.id);
      setTestReport(reportData);

      // Check if a new revision was created during testing
      if (testRunId) {
        const newRevisionId = localStorage.getItem(
          `test_${testRunId}_newRevision`,
        );
        if (newRevisionId) {
          console.log(
            "🔄 [Frontend] UI was optimized, reloading page to show new revision...",
          );
          localStorage.removeItem(`test_${testRunId}_newRevision`);
          // Reload the page to show the updated UI
          setTimeout(() => {
            router.reload();
          }, 2000); // Give user time to see the report
        }
      }
    }
  }, [reportData, testRunId, router]);

  useEffect(() => {
    if (reportError) {
      console.error("❌ [Frontend] Error fetching report:", reportError);
    }
  }, [reportError]);

  // Auto-start test when autoStart is true (only once)
  useEffect(() => {
    if (autoStart && !hasAutoStarted && componentId) {
      setHasAutoStarted(true);
      // Remove autoTest query param from URL
      router.replace(`/c/${componentId}`, undefined, { shallow: true });
      // Start test
      handleStartTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, hasAutoStarted, componentId]);

  const handleStartTest = async () => {
    if (!componentId) return;

    console.log(
      "🚀 [Frontend] Starting multi-agent test for component:",
      componentId,
    );

    // Show panel immediately
    setIsTestPanelVisible(true);
    setTestReport(null);

    try {
      const result = await startRunMutation.mutateAsync({
        requirementText: `Test existing component: ${
          componentName || componentId
        }`,
        componentId,
        isRegressionTest: true,
      });

      console.log("✅ [Frontend] Test run started:", result.testRunId);

      // Store latestRevisionId if UI was optimized
      if (result.latestRevisionId) {
        console.log(
          "🔄 [Frontend] New revision created:",
          result.latestRevisionId,
        );
        // We'll refresh the page when test is complete and has a new revision
        localStorage.setItem(
          `test_${result.testRunId}_newRevision`,
          result.latestRevisionId,
        );
      }

      setTestRunId(result.testRunId);
      console.log("📄 [Frontend] testRunId set to:", result.testRunId);
    } catch (error) {
      console.error("❌ [Frontend] Failed to start test:", error);
      console.error(
        "Error details:",
        error instanceof Error ? error.message : error,
      );
      // Hide panel on error
      setIsTestPanelVisible(false);
    }
  };

  const handleReset = () => {
    setTestRunId(null);
    setTestReport(null);
    setIsTestPanelVisible(false);
  };

  return (
    <div className="mb-3">
      {/* Toggle Button */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleStartTest}
          disabled={
            startRunMutation.isLoading || runStatus?.status === "running"
          }
          className="flex items-center gap-2"
        >
          {startRunMutation.isLoading || runStatus?.status === "running" ? (
            <>
              <Spinner className="h-4 w-4" />
              <span>测试进行中...</span>
            </>
          ) : (
            <span>🧪 启动多智能体测试</span>
          )}
        </Button>

        {isTestPanelVisible && runStatus?.status !== "running" && (
          <Button onClick={handleReset} variant="secondary" className="text-sm">
            重置
          </Button>
        )}
      </div>

      {/* Collapsible Test Panel */}
      {isTestPanelVisible && (
        <div className="mt-4 max-h-[600px] overflow-y-auto rounded-lg border-2 border-blue-500 bg-blue-50 p-4 shadow-lg">
          <div className="mb-4 flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-semibold text-blue-600">
              ⚡ 测试执行详情 ⚡
            </h3>
            <div className="flex items-center gap-2">
              {!testRunId && startRunMutation.isLoading && (
                <span className="flex items-center gap-1 text-sm text-blue-600">
                  <Spinner className="h-4 w-4" />
                  正在启动测试...
                </span>
              )}
              {runStatus?.status === "running" && (
                <span className="flex items-center gap-1 text-sm text-blue-600">
                  <Spinner className="h-4 w-4" />
                  进行中...
                </span>
              )}
              {runStatus?.status === "succeeded" && (
                <span className="text-sm font-medium text-green-600">
                  ✓ 测试完成
                </span>
              )}
              {runStatus?.status === "failed" && (
                <span className="text-sm font-medium text-red-600">
                  ✗ 测试失败
                </span>
              )}
              {runStatus?.status === "stopped" && (
                <span className="text-sm font-medium text-orange-600">
                  ⚠ 达到迭代上限
                </span>
              )}
            </div>
          </div>

          {/* Test Cases Status */}
          <div className="mb-6">
            <h4 className="mb-3 text-sm font-semibold text-gray-700">
              测试用例执行状态
            </h4>
            {!testRunId ? (
              <div className="rounded-lg bg-blue-50 p-6 text-center dark:bg-blue-900/20">
                <Spinner className="mx-auto h-6 w-6 text-blue-600" />
                <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                  正在启动测试并生成测试用例...
                </p>
              </div>
            ) : !testCases ? (
              <div className="rounded-lg bg-gray-50 p-6 text-center dark:bg-gray-700">
                <Spinner className="mx-auto h-6 w-6" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  正在加载测试用例...
                </p>
              </div>
            ) : testCases.length > 0 ? (
              <TestCasesPanel
                testCases={testCases}
                isRunning={runStatus?.status === "running"}
              />
            ) : (
              <div className="rounded-lg bg-gray-50 p-6 text-center dark:bg-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  暂无测试用例
                </p>
              </div>
            )}
          </div>

          {/* Timeline */}
          {runStatus?.timeline && runStatus.timeline.length > 0 && (
            <div className="mb-6">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">
                执行时间线
              </h4>
              <MultiAgentRunTimeline timeline={runStatus.timeline} />
            </div>
          )}

          {/* Test Report */}
          {testReport && (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">
                  测试报告
                </h4>
                <p className="text-sm text-gray-600">{testReport.summary}</p>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="text-2xl font-bold text-blue-700">
                    {testReport.stats.totalCases}
                  </div>
                  <div className="text-xs text-blue-600">总测试用例</div>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="text-2xl font-bold text-green-700">
                    {testReport.stats.passed}
                  </div>
                  <div className="text-xs text-green-600">通过</div>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <div className="text-2xl font-bold text-red-700">
                    {testReport.stats.failed}
                  </div>
                  <div className="text-xs text-red-600">失败</div>
                </div>
              </div>

              {/* Coverage Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="mb-1 text-lg font-semibold text-gray-700">
                    {testReport.stats.coreFlowCoverage}%
                  </div>
                  <div className="text-xs text-gray-500">核心流程覆盖</div>
                </div>
                <div className="text-center">
                  <div className="mb-1 text-lg font-semibold text-gray-700">
                    {testReport.stats.usabilityCoverage}%
                  </div>
                  <div className="text-xs text-gray-500">可用性覆盖</div>
                </div>
                <div className="text-center">
                  <div className="mb-1 text-lg font-semibold text-gray-700">
                    {testReport.stats.edgeCoverage}%
                  </div>
                  <div className="text-xs text-gray-500">边界情况覆盖</div>
                </div>
              </div>

              {/* Failures */}
              {testReport.failures.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">
                    失败的测试用例
                  </h4>
                  <div className="space-y-2">
                    {testReport.failures.map((failure, idx) => (
                      <div
                        key={idx}
                        className="rounded border-l-4 border-red-400 bg-red-50 p-3"
                      >
                        <div className="text-sm font-medium text-red-800">
                          测试用例: {failure.testCaseId}
                        </div>
                        {failure.lastFailureReason && (
                          <div className="mt-1 text-xs text-red-600">
                            {failure.lastFailureReason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Iterations */}
              {testReport.iterations.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">
                    迭代历史
                  </h4>
                  <div className="space-y-2">
                    {testReport.iterations.map((iteration, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                      >
                        <div className="mb-1 text-sm font-medium text-gray-700">
                          迭代 {iteration.index}
                        </div>
                        <div className="text-xs text-gray-600">
                          {iteration.changesSummary}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          UI Version: {iteration.uiVersionId}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
