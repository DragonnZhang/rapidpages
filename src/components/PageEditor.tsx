import { useCallback, useEffect, useRef, useState } from "react";
import { compileTypescript, type ComponentFile } from "~/utils/compiler";
import { type ActionRecord } from "~/types/multimodal";
import { api } from "~/utils/api";
import { useAtom } from "jotai";
import { actionHistoryAtom } from "~/store/actionHistoryStore";
import { type ElementSelectionDetail } from "~/store/interactiveLogicStore";

type SelectableIframe = HTMLIFrameElement & {
  elementSelectorCleanup?: () => void;
};

interface MyProps extends React.HTMLAttributes<HTMLDivElement> {
  code: ComponentFile[];
  selectionMode: "none" | "element" | "logic";
  onSelectionModeChange: (mode: "none" | "element" | "logic") => void;
  onElementSelection?: (
    detail: ElementSelectionDetail,
    mode: "element" | "logic",
  ) => void;
}

export const PageEditor = ({
  code,
  selectionMode,
  onSelectionModeChange,
  onElementSelection,
}: MyProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [dom, setDom] = useState<string | undefined>(undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [, setActionHistory] = useAtom(actionHistoryAtom);
  const currentInputActionRef = useRef<ActionRecord | null>(null);
  const generateDescriptionMutation = api.ai.generateDescription.useMutation();

  // 添加操作记录
  const addActionRecord = useCallback(
    (
      type: "click" | "rightclick" | "doubleclick" | "input",
      element: HTMLElement,
      inputValue?: string,
    ) => {
      const tagName = element.tagName.toLowerCase();
      const elementText = element.textContent?.trim().substring(0, 50) || "";
      const elementClass = element.className || "";
      const elementId = element.id || "";

      let description = "";

      if (type === "input") {
        description = `Input <${tagName}>`;
        if (elementId) {
          description += ` (id: ${elementId})`;
        }
        if (inputValue) {
          description += ` - "${
            inputValue.length > 30
              ? inputValue.substring(0, 30) + "..."
              : inputValue
          }"`;
        }
      } else {
        description = `${
          type === "rightclick"
            ? "Right-click"
            : type === "doubleclick"
            ? "Double-click"
            : "Click"
        } <${tagName}>`;

        if (elementText) {
          description += ` - "${elementText}"`;
        }
      }

      const record: ActionRecord = {
        id: Math.random().toString(36).substring(2, 15),
        timestamp: Date.now(),
        type,
        elementTag: tagName,
        elementText,
        elementClass,
        elementId,
        description,
        inputValue,
      };

      setActionHistory((prev) => [record, ...prev].slice(0, 50));

      return record; // 返回创建的记录
    },
    [setActionHistory],
  );

  // 处理输入操作（使用 useRef 管理状态）
  const handleInputAction = useCallback(
    (element: HTMLElement, value: string) => {
      const tagName = element.tagName.toLowerCase();
      const elementId = element.id || "";
      const elementClass = element.className || "";

      // 检查是否是同一个输入框的连续输入
      const isSameElement =
        currentInputActionRef.current &&
        currentInputActionRef.current.elementTag === tagName &&
        currentInputActionRef.current.elementId === elementId &&
        currentInputActionRef.current.elementClass === elementClass;

      if (isSameElement && currentInputActionRef.current) {
        // 更新现有记录的描述和输入值
        let description = `Input <${tagName}>`;
        if (elementId) {
          description += ` (id: ${elementId})`;
        }
        if (value) {
          description += ` - "${
            value.length > 30 ? value.substring(0, 30) + "..." : value
          }"`;
        }

        const updatedAction: ActionRecord = {
          ...currentInputActionRef.current,
          timestamp: Date.now(),
          inputValue: value,
          description,
        };

        // 更新 ref 和状态
        currentInputActionRef.current = updatedAction;

        // 更新历史记录中的对应项（保持在原位置）
        setActionHistory((prev) =>
          prev.map((action) =>
            action.id === updatedAction.id ? updatedAction : action,
          ),
        );
      } else {
        // 只有在不是连续输入的情况下才创建新记录
        let description = `Input <${tagName}>`;
        if (elementId) {
          description += ` (id: ${elementId})`;
        }
        if (value) {
          description += ` - "${
            value.length > 30 ? value.substring(0, 30) + "..." : value
          }"`;
        }

        const newRecord: ActionRecord = {
          id: Math.random().toString(36).substring(2, 15),
          timestamp: Date.now(),
          type: "input",
          elementTag: tagName,
          elementText: element.textContent?.trim().substring(0, 50) || "",
          elementClass,
          elementId,
          description,
          inputValue: value,
        };
        // 先设置 ref，再添加到历史记录
        currentInputActionRef.current = newRecord;
        setActionHistory((prev) => [newRecord, ...prev].slice(0, 50));
      }
    },
    [setActionHistory],
  );

  // 添加iframe事件监听器
  const addIframeEventListeners = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) {
      return null;
    }

    const iframeDoc = iframe.contentDocument;

    // 点击事件
    const handleIframeClick = (e: MouseEvent) => {
      if (selectionMode !== "none") return;

      const target = e.target as HTMLElement;
      if (
        target &&
        target !== iframeDoc.body &&
        target !== iframeDoc.documentElement
      ) {
        addActionRecord("click", target);
        // 点击时清除当前输入操作引用
        currentInputActionRef.current = null;
      }
    };

    // 右键点击事件
    const handleIframeContextMenu = (e: MouseEvent) => {
      if (selectionMode !== "none") return;

      const target = e.target as HTMLElement;
      if (
        target &&
        target !== iframeDoc.body &&
        target !== iframeDoc.documentElement
      ) {
        addActionRecord("rightclick", target);
        // 右键点击时清除当前输入操作引用
        currentInputActionRef.current = null;
      }
    };

    // 双击事件
    const handleIframeDoubleClick = (e: MouseEvent) => {
      if (selectionMode !== "none") return;

      const target = e.target as HTMLElement;
      if (
        target &&
        target !== iframeDoc.body &&
        target !== iframeDoc.documentElement
      ) {
        addActionRecord("doubleclick", target);
        // 双击时清除当前输入操作引用
        currentInputActionRef.current = null;
      }
    };

    // 统一的输入事件监听器
    const handleIframeInput = (e: Event) => {
      if (selectionMode !== "none") return;

      const target = e.target as HTMLElement;

      // 处理普通输入框和文本区域
      if (
        target.tagName.toLowerCase() === "input" ||
        target.tagName.toLowerCase() === "textarea"
      ) {
        const inputTarget = target as HTMLInputElement | HTMLTextAreaElement;
        handleInputAction(inputTarget, inputTarget.value);
      }
      // 处理内容可编辑元素
      else if (target.isContentEditable) {
        handleInputAction(target, target.textContent || "");
      }
    };

    iframeDoc.addEventListener("click", handleIframeClick, true);
    iframeDoc.addEventListener("contextmenu", handleIframeContextMenu, true);
    iframeDoc.addEventListener("dblclick", handleIframeDoubleClick, true);
    iframeDoc.addEventListener("input", handleIframeInput, true);

    return () => {
      iframeDoc.removeEventListener("click", handleIframeClick, true);
      iframeDoc.removeEventListener(
        "contextmenu",
        handleIframeContextMenu,
        true,
      );
      iframeDoc.removeEventListener("dblclick", handleIframeDoubleClick, true);
      iframeDoc.removeEventListener("input", handleIframeInput, true);
    };
  }, [addActionRecord, handleInputAction, selectionMode]);

  useEffect(() => {
    // Compile and render the page
    const compileCode = async () => {
      const compiledCode = await compileTypescript(code);
      setDom(compiledCode);
    };

    // We resize the canvas to fit the screen. This is not ideal, but it works for now.
    const handleResize = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const { contentWindow } = iframeRef.current;
      if (contentWindow) {
        const { documentElement } = contentWindow.document;
        const width = documentElement.clientWidth;
        const height = documentElement.clientHeight;
        setDimensions({ width, height });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Compile the code
    compileCode();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [code]);

  // 单独的useEffect来处理iframe事件监听器
  useEffect(() => {
    if (!dom) return; // 确保DOM已编译完成

    let cleanup: (() => void) | null = null;

    // 使用多次尝试来确保iframe完全加载
    const attempts = [500, 1000, 2000, 3000]; // 多个时间点尝试
    const timeouts: NodeJS.Timeout[] = [];

    attempts.forEach((delay) => {
      const timeout = setTimeout(() => {
        if (!cleanup) {
          // 只在还没有成功添加监听器时尝试
          cleanup = addIframeEventListeners();
          if (cleanup) {
            return;
          }
        }
      }, delay);
      timeouts.push(timeout);
    });

    return () => {
      // 清理所有定时器
      timeouts.forEach(clearTimeout);
      // 清理事件监听器
      if (cleanup) {
        cleanup();
      }
    };
  }, [addIframeEventListeners, dom]);

  // 选择元素
  const selectElement = useCallback(
    async (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase();
      const enableAI = process.env.NEXT_PUBLIC_ENABLE_AI_DESCRIPTION === "true";

      let elementName: string;

      if (enableAI) {
        try {
          // 调用AI生成元素描述
          const result = await generateDescriptionMutation.mutateAsync({
            type: "element",
            content: element.outerHTML,
            context: `标签类型: ${tagName}, 文本内容: ${
              element.textContent?.trim() || "无"
            }`,
          });

          elementName = result.description;
        } catch (error) {
          // 使用默认名称作为后备
          elementName = `<${tagName}>`;
        }
      } else {
        // 不使用AI，直接生成描述
        const elementText = element.textContent?.trim().substring(0, 30) || "";
        const elementId = element.id || "";
        const elementClass = element.className || "";

        elementName = `<${tagName}>`;
        if (elementId) {
          elementName += ` (id: ${elementId})`;
        } else if (elementClass) {
          elementName += ` (class: ${elementClass.split(" ")[0]})`;
        }
        if (elementText) {
          elementName += ` - "${elementText}"`;
        }
      }

      const detail: ElementSelectionDetail = {
        elementName,
        elementContent: element.outerHTML,
      };

      if (selectionMode === "logic") {
        onElementSelection?.(detail, "logic");
      } else {
        const event = new CustomEvent("elementDrop", {
          detail: {
            type: "element",
            name: detail.elementName,
            content: detail.elementContent,
          },
        });
        window.dispatchEvent(event);
        onElementSelection?.(detail, "element");
      }

      onSelectionModeChange("none");
    },
    [
      generateDescriptionMutation,
      onElementSelection,
      onSelectionModeChange,
      selectionMode,
    ],
  );

  // 启用元素选择模式
  const enableElementSelection = useCallback(() => {
    const iframe = iframeRef.current as SelectableIframe | null;
    if (!iframe?.contentDocument) return;

    const iframeDoc = iframe.contentDocument;

    // 添加选择样式
    const style = iframeDoc.createElement("style");
    style.textContent = `
      .element-selector-hover {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 1px !important;
        cursor: crosshair !important;
      }
      .element-selector-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 9999 !important;
        cursor: crosshair !important;
      }
    `;
    iframeDoc.head.appendChild(style);

    // 创建透明覆盖层
    const overlay = iframeDoc.createElement("div");
    overlay.className = "element-selector-overlay";
    iframeDoc.body.appendChild(overlay);

    let currentHoveredElement: HTMLElement | null = null;

    // 鼠标移动事件
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 临时隐藏覆盖层以获取真实元素
      overlay.style.display = "none";
      const elementBelow = iframeDoc.elementFromPoint(
        e.clientX,
        e.clientY,
      ) as HTMLElement;
      overlay.style.display = "block";

      if (elementBelow && elementBelow !== currentHoveredElement) {
        // 移除之前的高亮
        if (currentHoveredElement) {
          currentHoveredElement.classList.remove("element-selector-hover");
        }

        // 添加新的高亮（但不包括body和html）
        if (
          elementBelow !== iframeDoc.body &&
          elementBelow !== iframeDoc.documentElement
        ) {
          elementBelow.classList.add("element-selector-hover");
          currentHoveredElement = elementBelow;
        } else {
          currentHoveredElement = null;
        }
      }
    };

    // 鼠标离开覆盖层时移除高亮
    const handleMouseLeave = () => {
      if (currentHoveredElement) {
        currentHoveredElement.classList.remove("element-selector-hover");
        currentHoveredElement = null;
      }
    };

    // 点击事件
    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (currentHoveredElement) {
        void selectElement(currentHoveredElement);
      }
    };

    overlay.addEventListener("mousemove", handleMouseMove);
    overlay.addEventListener("mouseleave", handleMouseLeave);
    overlay.addEventListener("click", handleClick);

    // 清理函数
    const cleanup = () => {
      if (currentHoveredElement) {
        currentHoveredElement.classList.remove("element-selector-hover");
      }
      overlay.remove();
      style.remove();
    };

    // 保存清理函数到iframe上，方便后续调用
    iframe.elementSelectorCleanup = cleanup;
  }, [selectElement]);

  // 禁用元素选择模式
  const disableElementSelection = () => {
    const iframe = iframeRef.current as SelectableIframe | null;
    if (iframe?.elementSelectorCleanup) {
      iframe.elementSelectorCleanup();
      iframe.elementSelectorCleanup = undefined;
    }
  };

  const handleScroll = (event: React.WheelEvent) => {
    if (!iframeRef.current) return;
    if (!iframeRef.current.contentWindow) return;
    iframeRef.current.contentWindow.scrollBy(0, event.deltaY);

    // scrollTop = iframeRef.current.scrollTop + event.deltaY;
  };

  // 当外部状态变化时，同步内部逻辑
  useEffect(() => {
    if (selectionMode !== "none") {
      enableElementSelection();
    } else {
      disableElementSelection();
    }
  }, [enableElementSelection, selectionMode]);

  return (
    <div className="absolute inset-0 flex justify-center">
      <div
        className="absolute inset-0 overflow-hidden rounded-b-lg"
        onWheel={handleScroll}
      >
        <iframe
          width="100%"
          height="100%"
          tabIndex={-1}
          title="The editor's rendered HTML document"
          srcDoc={dom}
          ref={iframeRef}
          className="mx-auto my-0 block w-full min-w-[769] overflow-hidden border-0"
        />
        <div className="pointer-events-none absolute inset-y-0 flex max-w-full">
          <svg
            id="SVGOverlay"
            className="overflow-visible"
            width={dimensions.width}
            height={dimensions.height}
            ref={svgRef}
          >
            <rect id="SVGSelection"></rect>
            <rect id="SVGHover"></rect>
          </svg>
        </div>
      </div>
    </div>
  );
};
