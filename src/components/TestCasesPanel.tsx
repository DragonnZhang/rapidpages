import { type FC } from "react";
import { Spinner } from "~/components/Spinner";
import type {
  TestCaseStatus,
  TestCasePriority,
  TestCaseCategory,
} from "~/server/api/routers/multiAgent";

interface TestCaseWithStatus {
  id: string;
  title: string;
  description: string;
  priority: TestCasePriority;
  category: TestCaseCategory;
  status: TestCaseStatus;
  error?: string;
  updatedAt: string;
}

interface TestCasesPanelProps {
  testCases: TestCaseWithStatus[];
  isRunning?: boolean;
}

const StatusIcon: Record<
  TestCaseStatus,
  { icon: string; color: string; bg: string }
> = {
  pending: { icon: "⏳", color: "text-gray-600", bg: "bg-gray-100" },
  running: { icon: "🔄", color: "text-blue-600", bg: "bg-blue-100" },
  passed: { icon: "✓", color: "text-green-600", bg: "bg-green-100" },
  failed: { icon: "✗", color: "text-red-600", bg: "bg-red-100" },
  blocked: { icon: "⚠", color: "text-orange-600", bg: "bg-orange-100" },
};

const PriorityBadge: Record<
  TestCasePriority,
  { label: string; color: string }
> = {
  P0: { label: "P0", color: "bg-red-500 text-white" },
  P1: { label: "P1", color: "bg-orange-500 text-white" },
  P2: { label: "P2", color: "bg-yellow-500 text-white" },
  P3: { label: "P3", color: "bg-blue-500 text-white" },
};

const CategoryLabel: Record<TestCaseCategory, string> = {
  "core-flow": "核心流程",
  usability: "可用性",
  edge: "边界情况",
};

export const TestCasesPanel: FC<TestCasesPanelProps> = ({
  testCases,
  isRunning = false,
}) => {
  if (testCases.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-6 text-center dark:bg-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">暂无测试用例</p>
      </div>
    );
  }

  const stats = {
    total: testCases.length,
    passed: testCases.filter((tc) => tc.status === "passed").length,
    failed: testCases.filter((tc) => tc.status === "failed").length,
    running: testCases.filter((tc) => tc.status === "running").length,
    pending: testCases.filter((tc) => tc.status === "pending").length,
  };

  return (
    <div className="space-y-4">
      {/* Statistics Bar */}
      <div className="grid grid-cols-5 gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
            {stats.total}
          </div>
          <div className="text-xs text-gray-500">总计</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">{stats.passed}</div>
          <div className="text-xs text-gray-500">通过</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">{stats.failed}</div>
          <div className="text-xs text-gray-500">失败</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{stats.running}</div>
          <div className="text-xs text-gray-500">执行中</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-600">{stats.pending}</div>
          <div className="text-xs text-gray-500">待执行</div>
        </div>
      </div>

      {/* Test Cases List */}
      <div className="space-y-2">
        {testCases.map((tc) => {
          const statusConfig = StatusIcon[tc.status];
          const priorityConfig = PriorityBadge[tc.priority];
          const isCurrentlyRunning = isRunning && tc.status === "running";

          return (
            <div
              key={tc.id}
              className={`transform rounded-lg border p-3 transition-all duration-300 ${
                isCurrentlyRunning
                  ? "scale-105 border-blue-400 bg-blue-50"
                  : "border-gray-200 bg-white"
              } dark:bg-gray-800`}
            >
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-lg ${
                    statusConfig.bg
                  } ${isCurrentlyRunning ? "animate-pulse" : ""}`}
                >
                  {isCurrentlyRunning ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <span className={statusConfig.color}>
                      {statusConfig.icon}
                    </span>
                  )}
                </div>

                {/* Test Case Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {tc.title}
                      </h4>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                        {tc.description}
                      </p>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${priorityConfig.color}`}
                      >
                        {priorityConfig.label}
                      </span>
                      <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                        {CategoryLabel[tc.category]}
                      </span>
                    </div>
                  </div>

                  {/* Error Message */}
                  {tc.error && (
                    <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                      <span className="font-semibold">错误: </span>
                      {tc.error}
                    </div>
                  )}

                  {/* Status Text */}
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span className={statusConfig.color}>
                      {tc.status === "pending" && "等待执行"}
                      {tc.status === "running" && "执行中..."}
                      {tc.status === "passed" && "测试通过"}
                      {tc.status === "failed" && "测试失败"}
                      {tc.status === "blocked" && "已阻塞"}
                    </span>
                    <span>•</span>
                    <span>{new Date(tc.updatedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
