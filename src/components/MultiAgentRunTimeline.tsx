import { type FC } from "react";
import { Spinner } from "~/components/Spinner";
import type { TimelineEvent } from "~/server/api/routers/multiAgent";

interface MultiAgentRunTimelineProps {
  timeline: TimelineEvent[];
  isRunning?: boolean;
}

const AgentColorMap: Record<
  string,
  { bg: string; text: string; icon: string }
> = {
  "Requirement Parser": {
    bg: "bg-purple-100",
    text: "text-purple-700 dark:text-purple-300",
    icon: "📋",
  },
  "UI Generator": {
    bg: "bg-blue-100",
    text: "text-blue-700 dark:text-blue-300",
    icon: "🎨",
  },
  "Test Planner": {
    bg: "bg-green-100",
    text: "text-green-700 dark:text-green-300",
    icon: "🧪",
  },
  Evaluator: {
    bg: "bg-orange-100",
    text: "text-orange-700 dark:text-orange-300",
    icon: "⚖️",
  },
  Optimizer: {
    bg: "bg-indigo-100",
    text: "text-indigo-700 dark:text-indigo-300",
    icon: "🔧",
  },
  Reporter: {
    bg: "bg-red-100",
    text: "text-red-700 dark:text-red-300",
    icon: "📊",
  },
};

const PhaseNameMap: Record<string, string> = {
  "requirement-parsing": "需求解析",
  "ui-generation": "UI 生成",
  "testcase-generation": "测试设计",
  "test-execution": "测试执行",
  "result-analysis": "结果分析",
  "ui-optimization": "UI 优化",
  "report-generation": "报告生成",
};

export const MultiAgentRunTimeline: FC<MultiAgentRunTimelineProps> = ({
  timeline,
  isRunning = false,
}) => {
  if (timeline.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-6 text-center dark:bg-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          等待执行开始...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {timeline.map((event, index) => {
        const colorConfig =
          AgentColorMap[event.agent] || AgentColorMap["Evaluator"];
        const phaseName = PhaseNameMap[event.phase] || event.phase;
        const isComplete = !!event.finishedAt;
        const isCurrentlyRunning =
          isRunning && index === timeline.length - 1 && !isComplete;

        return (
          <div
            key={index}
            className={`transform transition-all duration-300 ${
              isCurrentlyRunning ? "scale-105" : ""
            }`}
          >
            {/* Timeline Node */}
            <div className="flex items-start gap-4">
              {/* Timeline Connector and Node */}
              <div className="relative flex flex-col items-center">
                {/* Node */}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg font-semibold ${
                    isComplete
                      ? colorConfig.bg +
                        " " +
                        colorConfig.text +
                        " border-current"
                      : isCurrentlyRunning
                      ? "animate-pulse " +
                        colorConfig.bg +
                        " " +
                        colorConfig.text +
                        " border-current"
                      : "border-gray-300 bg-gray-200 text-gray-600 dark:border-gray-500 dark:bg-gray-600 dark:text-gray-300"
                  }`}
                >
                  {isCurrentlyRunning ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    colorConfig.icon
                  )}
                </div>

                {/* Connector to next */}
                {index < timeline.length - 1 && (
                  <div
                    className={`mt-1 min-h-[2rem] w-1 flex-1 ${
                      isComplete
                        ? colorConfig.bg.replace("100", "300")
                        : "bg-gray-200 dark:bg-gray-600"
                    }`}
                  />
                )}
              </div>

              {/* Event Content */}
              <div className="flex-1 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {phaseName}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {event.agent}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isComplete && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        ✓ 完成
                      </span>
                    )}
                    {isCurrentlyRunning && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <Spinner className="mr-1 h-3 w-3" />
                        运行中
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {event.summary && (
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {event.summary}
                  </p>
                )}

                {/* Timestamps */}
                <div className="mt-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {event.startedAt && (
                    <span>
                      开始:{" "}
                      {new Date(event.startedAt).toLocaleTimeString("zh-CN")}
                    </span>
                  )}
                  {event.finishedAt && (
                    <span>
                      完成:{" "}
                      {new Date(event.finishedAt).toLocaleTimeString("zh-CN")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
