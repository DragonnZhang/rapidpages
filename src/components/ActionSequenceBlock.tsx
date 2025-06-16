import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { type ActionRecord } from "~/types/multimodal";
import { cn } from "~/utils/utils";

interface ActionSequenceBlockProps {
  actions: ActionRecord[];
  onRemove: () => void;
}

export const ActionSequenceBlock: React.FC<ActionSequenceBlockProps> = ({
  actions,
  onRemove,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
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

  const mainAction = actions[0];
  const hasMultipleActions = actions.length > 1;

  return (
    <div className="inline-block rounded border border-indigo-200 bg-indigo-50 text-indigo-800">
      {/* 主标题栏 */}
      <div
        className={cn([
          "flex items-center gap-2 px-3 py-2 transition-colors",
          hasMultipleActions
            ? "cursor-pointer hover:bg-indigo-100"
            : "cursor-default",
        ])}
        onClick={(e) => {
          e.stopPropagation(); // 防止事件冒泡
          if (hasMultipleActions) {
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <ClockIcon className="h-4 w-4 text-indigo-600" />
        <span className="text-sm font-medium">
          操作序列 ({actions.length}项)
        </span>
        {hasMultipleActions &&
          (isExpanded ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-auto text-indigo-600 transition-colors hover:text-indigo-800"
        >
          ✕
        </button>
      </div>

      {/* 展开的操作列表 */}
      {isExpanded && hasMultipleActions && (
        <div className="bg-indigo-25 border-t border-indigo-200">
          <div className="max-h-32 overflow-y-auto">
            {actions.map((action, index) => (
              <div
                key={action.id}
                className="flex items-center gap-2 border-b border-indigo-100 px-4 py-2 text-xs last:border-b-0"
              >
                <span className="font-mono text-xs text-indigo-500">
                  {index + 1}.
                </span>
                <span>{getActionIcon(action.type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-indigo-700">
                    {action.description}
                  </div>
                  <div className="text-indigo-500">
                    {formatTime(action.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
