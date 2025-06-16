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
  title?: string; // 新增：用于显示AI生成的标题
}

export const ActionSequenceBlock: React.FC<ActionSequenceBlockProps> = ({
  actions,
  onRemove,
  title,
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
      {/* 主标题栏 - 减小高度 */}
      <div
        className={cn([
          "flex items-center gap-2 px-2 py-1 transition-colors",
          hasMultipleActions
            ? "cursor-pointer hover:bg-indigo-100"
            : "cursor-default", // 单个操作不可展开
        ])}
        onClick={(e) => {
          e.stopPropagation();
          if (hasMultipleActions) {
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <ClockIcon className="h-3 w-3 text-indigo-600" />
        <span className="text-xs font-medium">
          {title || `操作序列 (${actions.length}项)`}
        </span>
        {hasMultipleActions &&
          (isExpanded ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronRightIcon className="h-3 w-3" />
          ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-auto text-xs text-indigo-600 transition-colors hover:text-indigo-800"
        >
          ✕
        </button>
      </div>

      {/* 展开的操作列表 */}
      {isExpanded && hasMultipleActions && (
        <div className="bg-indigo-25 border-t border-indigo-200">
          <div className="max-h-24 overflow-y-auto">
            {actions.map((action, index) => (
              <div
                key={action.id}
                className="flex items-center gap-1 border-b border-indigo-100 px-2 py-1 text-xs last:border-b-0"
              >
                <span className="w-4 font-mono text-xs text-indigo-500">
                  {index + 1}.
                </span>
                <span className="text-xs">{getActionIcon(action.type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-indigo-700">
                    {action.description}
                  </div>
                  <div className="text-xs text-indigo-500">
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
