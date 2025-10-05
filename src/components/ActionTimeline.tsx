import { useAtom } from "jotai";
import {
  actionHistoryAtom,
  selectedActionIdsAtom,
} from "~/store/actionHistoryStore";
import { type ActionRecord } from "~/types/multimodal";
import { api } from "~/utils/api";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  interactiveLogicAtom,
  interactiveLogicModalAtom,
  type InteractiveLogicEntity,
} from "~/store/interactiveLogicStore";
import { useSetAtom } from "jotai";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export const ActionTimeline = () => {
  const [actions, setActions] = useAtom(actionHistoryAtom);
  const [selectedActionIds, setSelectedActionIds] = useAtom(
    selectedActionIdsAtom,
  );
  const generateDescriptionMutation = api.ai.generateDescription.useMutation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [logicEntities] = useAtom(interactiveLogicAtom);
  const setLogicModalState = useSetAtom(interactiveLogicModalAtom);
  const [activeTab, setActiveTab] = useState<"history" | "logic">("history");

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

      const enableAI = process.env.NEXT_PUBLIC_ENABLE_AI_DESCRIPTION === "true";
      let sequenceName: string;

      if (enableAI) {
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

          sequenceName = `${result.description}（${sequenceActions.length} ${
            sequenceActions.length > 1 ? "items" : "item"
          }）`;
        } catch (error) {
          console.error("生成操作序列描述失败:", error);
          // 使用默认名称作为后备
          sequenceName = `操作序列（${sequenceActions.length}${
            sequenceActions.length > 1 ? " items" : " item"
          }）`;
        }
      } else {
        // 不使用AI，直接生成描述
        sequenceName = `操作序列（${sequenceActions.length}${
          sequenceActions.length > 1 ? " items" : " item"
        }）`;
      }

      const event = new CustomEvent("actionSequenceDrop", {
        detail: {
          type: "action-sequence",
          name: sequenceName,
          actions: sequenceActions.sort((a, b) => b.timestamp - a.timestamp), // 按时间倒序用于显示
        },
      });
      window.dispatchEvent(event);

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

  const hasHistory = actions.length > 0;
  const hasLogic = logicEntities.length > 0;

  const sortedLogicEntities = useMemo(
    () => logicEntities.slice().sort((a, b) => b.updatedAt - a.updatedAt),
    [logicEntities],
  );

  if (!hasHistory && !hasLogic) {
    return null;
  }

  const tabConfigs: Array<{
    key: "history" | "logic";
    label: string;
    count: number;
  }> = [
    { key: "history", label: "操作历史", count: actions.length },
    { key: "logic", label: "交互逻辑", count: logicEntities.length },
  ];

  const handleLogicInsert = (entity: InteractiveLogicEntity) => {
    window.dispatchEvent(
      new CustomEvent("logicEntityDrop", {
        detail: {
          id: entity.id,
          name: entity.name,
          logic: entity.logic,
          elementName: entity.elementName,
        },
      }),
    );
  };

  const handleLogicEdit = (entity: InteractiveLogicEntity) => {
    setLogicModalState({
      isOpen: true,
      mode: "edit",
      entityId: entity.id,
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tabConfigs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1 inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[10px] ${
                    isActive ? "bg-white/20" : "bg-gray-200"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
        {activeTab === "history" && (
          <button
            onClick={() => {
              setActions([]);
              setSelectedActionIds([]);
            }}
            className="rounded p-1 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            title="清空历史"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4">
        {activeTab === "history" ? (
          hasHistory ? (
            <div
              ref={scrollContainerRef}
              className="relative min-w-0 flex-1 overflow-x-auto"
            >
              <div className="inline-block min-w-full">
                <div className="relative flex items-center py-12">
                  <div className="absolute left-8 right-8 top-1/2 h-0.5 -translate-y-1/2 bg-gray-300"></div>

                  <div className="relative flex items-center px-8">
                    {actions
                      .slice()
                      .reverse()
                      .map((action, index) => {
                        const isFirst = index === 0;
                        const isLast = index === actions.length - 1;

                        let alignmentClass = "left-1/2 -translate-x-1/2";
                        if (actions.length === 1) {
                          alignmentClass = "left-0";
                        } else if (isFirst) {
                          alignmentClass = "left-0";
                        } else if (isLast) {
                          alignmentClass = "right-0";
                        }

                        const baseMargin = 4;
                        const charFactor = 0.4;
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
                            <div
                              className={`z-10 h-4 w-4 cursor-pointer rounded-full border-2 transition-all ${
                                selectedActionIds.includes(action.id)
                                  ? "border-blue-500 bg-blue-200 ring-4 ring-blue-100"
                                  : "border-gray-400 bg-white group-hover:bg-gray-200"
                              }`}
                            ></div>

                            <div
                              className={`absolute flex w-max max-w-xs cursor-pointer items-center gap-2 rounded-md border bg-white px-2 py-1 shadow-sm transition-colors ${
                                index % 2 === 0 ? "-top-10" : "top-7"
                              } ${alignmentClass} ${
                                selectedActionIds.includes(action.id)
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-300 group-hover:bg-gray-50"
                              }`}
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
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-gray-400">
              暂无操作历史
            </div>
          )
        ) : hasLogic ? (
          <div className="space-y-3">
            {sortedLogicEntities.map((entity) => (
              <div
                key={entity.id}
                className="group flex flex-col rounded-lg border border-transparent bg-white p-3 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {entity.name}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      目标元素：{entity.elementName}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      className="rounded border border-emerald-500 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
                      onClick={() => handleLogicInsert(entity)}
                    >
                      引用
                    </button>
                    <button
                      type="button"
                      className="rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-100"
                      onClick={() => handleLogicEdit(entity)}
                      title="编辑交互逻辑"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 line-clamp-3 text-xs leading-5 text-gray-600">
                  {entity.logic}
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-wide text-gray-400">
                  {formatDistanceToNow(new Date(entity.updatedAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center text-sm text-gray-400">
            暂无交互逻辑
          </div>
        )}
      </div>
    </div>
  );
};
