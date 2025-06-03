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

  const handleActionClick = (action: ActionRecord) => {
    // 创建自定义事件，直接添加到输入框
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
      default:
        return "📱";
    }
  };

  return (
    <div className="absolute left-4 top-4 z-20 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-medium text-gray-900">操作历史记录</h3>
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
                onClick={() => handleActionClick(action)}
                className={`
                  group cursor-pointer px-4 py-3 transition-colors hover:bg-gray-50
                  ${draggedAction?.id === action.id ? "bg-blue-50" : ""}
                `}
                title="点击或拖拽到输入框"
              >
                <div className="flex items-start space-x-3">
                  <span className="text-lg">{getActionIcon(action.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {action.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTime(action.timestamp)}
                    </p>
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
          点击或拖拽操作记录到输入框作为参考
        </p>
      </div>
    </div>
  );
};
