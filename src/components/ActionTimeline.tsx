import { useAtom } from "jotai";
import {
  actionHistoryAtom,
  selectedActionIdsAtom,
} from "~/store/actionHistoryStore";
import { type ActionRecord } from "~/types/multimodal";
import { api } from "~/utils/api";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef } from "react";

export const ActionTimeline = () => {
  const [actions, setActions] = useAtom(actionHistoryAtom);
  const [selectedActionIds, setSelectedActionIds] = useAtom(
    selectedActionIdsAtom,
  );
  const generateDescriptionMutation = api.ai.generateDescription.useMutation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      // Scroll to the far right to show the latest item
      scrollContainerRef.current.scrollLeft =
        scrollContainerRef.current.scrollWidth;
    }
  }, [actions]);

  const handleActionClick = async (
    action: ActionRecord,
    e: React.MouseEvent,
  ) => {
    // 如果按住 Ctrl/Cmd 键，支持多选
    if (e.ctrlKey || e.metaKey) {
      setSelectedActionIds((prev) =>
        prev.includes(action.id)
          ? prev.filter((id) => id !== action.id)
          : [...prev, action.id],
      );
      return;
    }

    // 如果有选中的多个操作，创建操作序列
    if (selectedActionIds.length > 0) {
      const sequenceActions = actions.filter((a) =>
        selectedActionIds.includes(a.id),
      );

      try {
        // 生成操作序列的描述
        const actionDescriptions = sequenceActions
          .sort((a, b) => a.timestamp - b.timestamp) // 按时间正序排列
          .map((action) => `${action.description}`)
          .join(" -> ");

        const result = await generateDescriptionMutation.mutateAsync({
          type: "action-sequence",
          content: actionDescriptions,
          context: `操作数量: ${sequenceActions.length}`,
        });

        const sequenceName = `${result.description}（${
          sequenceActions.length
        } ${sequenceActions.length > 1 ? "items" : "item"}）`;

        const event = new CustomEvent("actionSequenceDrop", {
          detail: {
            type: "action-sequence",
            name: sequenceName,
            actions: sequenceActions.sort((a, b) => b.timestamp - a.timestamp), // 按时间倒序用于显示
          },
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error("生成操作序列描述失败:", error);
        // 使用默认名称作为后备
        const sequenceName = `操作序列（${sequenceActions.length}${
          sequenceActions.length > 1 ? " items" : " item"
        }）`;
        const event = new CustomEvent("actionSequenceDrop", {
          detail: {
            type: "action-sequence",
            name: sequenceName,
            actions: sequenceActions.sort((a, b) => b.timestamp - a.timestamp),
          },
        });
        window.dispatchEvent(event);
      }

      setSelectedActionIds([]); // 清除选择
      return;
    }

    // 单个操作也创建为操作序列（包含一个操作）
    const event = new CustomEvent("actionSequenceDrop", {
      detail: {
        type: "action-sequence",
        name: action.description, // 使用操作描述作为名称
        actions: [action], // 包含单个操作的数组
      },
    });
    window.dispatchEvent(event);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "click":
        return "👆";
      case "rightclick":
        return "👉";
      case "doubleclick":
        return "👆👆";
      case "input":
        return "⌨️";
      default:
        return "📱";
    }
  };

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 mt-3 flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
      <div className="flex-shrink-0 text-sm font-medium text-gray-600">
        History:
      </div>
      <div
        ref={scrollContainerRef}
        className="relative min-w-0 flex-1 overflow-x-auto"
      >
        <div className="inline-block min-w-full">
          <div className="relative flex items-center py-12">
            {/* The timeline line */}
            <div className="absolute left-8 right-8 top-1/2 h-0.5 -translate-y-1/2 bg-gray-300"></div>

            {/* Action nodes */}
            <div className="relative flex items-center px-8">
              {actions
                .slice()
                .reverse()
                .map((action, index) => {
                  const isFirst = index === 0;
                  const isLast = index === actions.length - 1;

                  // Adjust label alignment for first and last items
                  let alignmentClass = "left-1/2 -translate-x-1/2"; // Default: center
                  if (actions.length === 1) {
                    alignmentClass = "left-0"; // Single item: align left
                  } else if (isFirst) {
                    alignmentClass = "left-0"; // First item of many: align left
                  } else if (isLast) {
                    alignmentClass = "right-0"; // Last item of many: align right
                  }

                  // Dynamically calculate margin based on description length
                  const baseMargin = 4; // Base margin in rem (1rem = 16px)
                  const charFactor = 0.4; // Additional margin per character in rem
                  const dynamicMargin =
                    baseMargin + action.description.length * charFactor;

                  return (
                    <div
                      key={action.id}
                      className="group relative flex flex-col items-center"
                      onClick={(e) => handleActionClick(action, e)}
                      title={action.description}
                      style={{
                        marginRight:
                          index < actions.length - 1
                            ? `${dynamicMargin}rem`
                            : 0,
                      }}
                    >
                      {/* Dot on the timeline */}
                      <div
                        className={`
                  z-10 h-4 w-4 cursor-pointer rounded-full border-2 transition-all
                  ${
                    selectedActionIds.includes(action.id)
                      ? "border-blue-500 bg-blue-200 ring-4 ring-blue-100"
                      : "border-gray-400 bg-white group-hover:bg-gray-200"
                  }
                `}
                      ></div>

                      {/* Action content - Staggered top and bottom */}
                      <div
                        className={`
                  absolute flex w-max max-w-xs cursor-pointer items-center gap-2 rounded-md border bg-white px-2 py-1 shadow-sm transition-colors
                  ${index % 2 === 0 ? "-top-10" : "top-7"}
                  ${alignmentClass}
                  ${
                    selectedActionIds.includes(action.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 group-hover:bg-gray-50"
                  }
                `}
                      >
                        <span className="text-base">
                          {getActionIcon(action.type)}
                        </span>
                        <span className="truncate text-sm text-gray-800">
                          {action.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0">
        <button
          onClick={() => {
            setActions([]);
            setSelectedActionIds([]);
          }}
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          title="Clear history"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
