import { type NextPage } from "next";
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { ApplicationLayout } from "~/components/AppLayout";
import { api } from "~/utils/api";
import { Button } from "~/components/Button";
import { Spinner } from "~/components/Spinner";
import { MultiAgentRunTimeline } from "~/components/MultiAgentRunTimeline";

const MultiAgentPage: NextPage = () => {
  const { data: sessionData } = useSession({ required: true });
  const [requirementText, setRequirementText] = useState("");
  const [currentTestRunId, setCurrentTestRunId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startRunMutation = api.multiAgent.startRun.useMutation({
    onSuccess: (data) => {
      setCurrentTestRunId(data.testRunId);
      setIsSubmitting(false);
    },
    onError: () => {
      setIsSubmitting(false);
    },
  });

  const { data: runStatus, isLoading: isLoadingStatus } =
    api.multiAgent.getRunStatus.useQuery(
      { testRunId: currentTestRunId! },
      {
        enabled: !!currentTestRunId,
        refetchInterval: currentTestRunId ? 1000 : false,
      },
    );

  const { data: report } = api.multiAgent.getReport.useQuery(
    { testRunId: currentTestRunId! },
    {
      enabled:
        !!currentTestRunId &&
        (runStatus?.status === "succeeded" || runStatus?.status === "failed"),
    },
  );

  const handleStartRun = async () => {
    if (!requirementText.trim()) return;
    setIsSubmitting(true);
    startRunMutation.mutate({ requirementText });
  };

  const handleReset = () => {
    setCurrentTestRunId(null);
    setRequirementText("");
    setIsSubmitting(false);
  };

  if (!sessionData) {
    return <div>Loading...</div>;
  }

  const isRunning = runStatus?.status === "running";
  const isCompleted =
    runStatus?.status === "succeeded" || runStatus?.status === "failed";

  return (
    <>
      <Head>
        <title>多智能体 UI 测试闭环 - Rapidpages</title>
        <meta
          name="description"
          content="从自然语言需求到自动化 UI 测试的多智能体闭环"
        />
      </Head>
      <ApplicationLayout>
        <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
          {/* Header */}
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
              多智能体 UI 测试闭环
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              从自然语言需求，经 AI 自动生成
              UI、设计测试、执行验证，最后生成报告。
            </p>
          </div>

          {/* Main Container */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left: Input Panel */}
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                需求描述
              </h2>

              <label
                htmlFor="requirement"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                请描述你需要的 UI 页面或功能
              </label>
              <textarea
                id="requirement"
                value={requirementText}
                onChange={(e) => setRequirementText(e.target.value)}
                className="mb-4 w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                rows={8}
                placeholder="示例：一个简单的待办事项管理页面，包含以下功能：
• 添加新任务
• 标记任务完成
• 删除任务
• 显示任务列表和统计信息"
                disabled={isSubmitting || !!currentTestRunId}
              />

              <div className="flex gap-3">
                <Button
                  onClick={handleStartRun}
                  disabled={
                    !requirementText.trim() ||
                    isSubmitting ||
                    !!currentTestRunId
                  }
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      启动中...
                    </>
                  ) : (
                    "生成并测试"
                  )}
                </Button>

                {currentTestRunId && (
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="flex-1"
                  >
                    重新开始
                  </Button>
                )}
              </div>

              {startRunMutation.error && (
                <div className="mt-4 rounded-md bg-red-50 p-3 dark:bg-red-900/20">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    错误: {startRunMutation.error.message}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Status Panel */}
            {currentTestRunId && runStatus && (
              <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                  执行进度
                </h2>

                {/* Status Badge */}
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    当前状态
                  </span>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                      isRunning
                        ? "animate-pulse bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        : isCompleted && runStatus.status === "succeeded"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {isRunning && <Spinner className="h-4 w-4" />}
                    {isRunning
                      ? "运行中"
                      : runStatus.status === "succeeded"
                      ? "✓ 完成"
                      : "✗ 失败"}
                  </span>
                </div>

                {/* Progress Info */}
                <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      迭代轮次
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {runStatus.currentIterationIndex + 1} /
                      {runStatus.maxIterations}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-2 bg-blue-600 transition-all duration-300"
                      style={{
                        width: `${
                          ((runStatus.currentIterationIndex + 1) /
                            runStatus.maxIterations) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Timeline */}
                {runStatus.timeline.length > 0 && (
                  <div className="mt-6 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      执行过程
                    </h3>
                    <MultiAgentRunTimeline
                      timeline={runStatus.timeline}
                      isRunning={isRunning}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Report Section */}
          {report && isCompleted && (
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <h2 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
                测试报告
              </h2>

              {/* Summary */}
              <div className="mb-6 rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  {report.summary}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    总用例
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                    {report.stats.totalCases}
                  </div>
                </div>
                <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                  <div className="text-xs text-green-600 dark:text-green-400">
                    通过
                  </div>
                  <div className="mt-1 text-2xl font-bold text-green-700 dark:text-green-200">
                    {report.stats.passed}
                  </div>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <div className="text-xs text-red-600 dark:text-red-400">
                    失败
                  </div>
                  <div className="mt-1 text-2xl font-bold text-red-700 dark:text-red-200">
                    {report.stats.failed}
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    核心流程覆盖
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                    {report.stats.coreFlowCoverage}%
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    成功率
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                    {report.stats.totalCases > 0
                      ? Math.round(
                          (report.stats.passed / report.stats.totalCases) * 100,
                        )
                      : 0}
                    %
                  </div>
                </div>
              </div>

              {/* Failures */}
              {report.failures.length > 0 && (
                <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
                  <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
                    失败用例
                  </h3>
                  <div className="space-y-2">
                    {report.failures.map((failure) => (
                      <div
                        key={failure.testCaseId}
                        className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
                      >
                        <p className="text-sm font-medium text-red-900 dark:text-red-200">
                          {failure.testCaseId}
                        </p>
                        {failure.lastFailureReason && (
                          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                            {failure.lastFailureReason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Iterations */}
              {report.iterations.length > 0 && (
                <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
                  <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
                    执行历史
                  </h3>
                  <div className="space-y-2">
                    {report.iterations.map((iteration) => (
                      <div
                        key={iteration.index}
                        className="flex items-center gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                          {iteration.index}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            第 {iteration.index} 轮
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {iteration.changesSummary}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ApplicationLayout>
    </>
  );
};

export default MultiAgentPage;
