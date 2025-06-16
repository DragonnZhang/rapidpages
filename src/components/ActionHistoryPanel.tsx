import { useState } from "react";
import { XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import { type ActionRecord } from "~/types/multimodal";

interface ActionHistoryPanelProps {
  actions: ActionRecord[];
  onClose: () => void;
  onClear: () => void;
}

export const ActionHistoryPanel: React.FC<ActionHistoryPanelProps> = ({
  actions,
  onClose,
  onClear,
}) => {
  const [draggedAction, setDraggedAction] = useState<ActionRecord | null>(null);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const handleDragStart = (e: React.DragEvent, action: ActionRecord) => {
    setDraggedAction(action);

    // 设置拖拽数据
    const dragData = {
      type: "action",
      name: action.description,
      content: action.description,
    };
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragEnd = () => {
    setDraggedAction(null);
  };

  const handleActionClick = (action: ActionRecord, e: React.MouseEvent) => {
    // 如果按住 Ctrl/Cmd 键，支持多选
    if (e.ctrlKey || e.metaKey) {
      setSelectedActions((prev) =>
        prev.includes(action.id)
          ? prev.filter((id) => id !== action.id)
          : [...prev, action.id],
      );
      return;
    }

    // 如果有选中的多个操作，创建操作序列
    if (selectedActions.length > 0) {
      const sequenceActions = actions.filter((a) =>
        selectedActions.includes(a.id),
      );
      const sequenceName = `操作序列 (${sequenceActions.length}项)`;

      const event = new CustomEvent("actionSequenceDrop", {
        detail: {
          type: "action-sequence",
          name: sequenceName,
          actions: sequenceActions.sort((a, b) => b.timestamp - a.timestamp), // 按时间排序
        },
      });
      window.dispatchEvent(event);

      setSelectedActions([]); // 清除选择
      return;
    }

    // 单个操作的原有逻辑
    const event = new CustomEvent("actionDrop", {
      detail: {
        type: "action",
        name: action.description,
        content: action.description,
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

  const getActionColor = (type: string) => {
    switch (type) {
      case "click":
        return "text-blue-600";
      case "rightclick":
        return "text-purple-600";
      case "doubleclick":
        return "text-green-600";
      case "input":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="absolute left-4 top-4 z-20 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-medium text-gray-900">Operation History</h3>
        <div className="flex space-x-1">
          <button
            onClick={onClear}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="清空历史记录"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="关闭"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 多选提示 */}
      {selectedActions.length > 0 && (
        <div className="border-b border-gray-200 bg-blue-50 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              已选择 {selectedActions.length} 项操作
            </span>
            <button
              onClick={() => setSelectedActions([])}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              取消选择
            </button>
          </div>
          <p className="mt-1 text-xs text-blue-600">
            点击任意操作创建序列，或继续选择更多操作
          </p>
        </div>
      )}

      {/* 内容 */}
      <div className="max-h-96 overflow-y-auto">
        {actions.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            暂无操作记录
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {actions.map((action) => (
              <div
                key={action.id}
                draggable
                onDragStart={(e) => handleDragStart(e, action)}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleActionClick(action, e)}
                className={`
                  group cursor-pointer px-4 py-3 transition-colors hover:bg-gray-50
                  ${draggedAction?.id === action.id ? "bg-blue-50" : ""}
                  ${
                    selectedActions.includes(action.id)
                      ? "border-l-4 border-blue-500 bg-blue-100"
                      : ""
                  }
                `}
                title="点击添加单个操作，Ctrl/Cmd+点击可多选创建序列"
              >
                <div className="flex items-start space-x-3">
                  <span className={`text-lg ${getActionColor(action.type)}`}>
                    {getActionIcon(action.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {action.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTime(action.timestamp)}
                    </p>
                    {action.inputValue && action.type === "input" && (
                      <p className="mt-1 truncate rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                        完整内容: {action.inputValue}
                      </p>
                    )}
                  </div>
                  <div className="opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-xs text-gray-400">可拖拽</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部说明 */}
      <div className="border-t border-gray-200 px-4 py-2">
        <p className="text-xs text-gray-500">
          点击添加单个操作，Ctrl/Cmd+点击可多选创建操作序列
        </p>
      </div>
    </div>
  );
};
