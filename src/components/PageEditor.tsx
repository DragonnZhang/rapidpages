import { useEffect, useRef, useState } from "react";
import { compileTypescript, type ComponentFile } from "~/utils/compiler";
import { CursorArrowRaysIcon, ClockIcon } from "@heroicons/react/24/outline";
import { ActionHistoryPanel } from "./ActionHistoryPanel";
import { type ActionRecord } from "~/types/multimodal";

interface MyProps extends React.HTMLAttributes<HTMLDivElement> {
  code: ComponentFile[];
}

export const PageEditor = ({ code }: MyProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [dom, setDom] = useState<string | undefined>(undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isElementSelectMode, setIsElementSelectMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(
    null,
  );
  const [actionHistory, setActionHistory] = useState<ActionRecord[]>([]);
  const [showActionHistory, setShowActionHistory] = useState(false);

  // 添加操作记录
  const addActionRecord = (
    type: "click" | "rightclick" | "doubleclick",
    element: HTMLElement,
  ) => {
    const tagName = element.tagName.toLowerCase();
    const elementText = element.textContent?.trim().substring(0, 50) || "";
    const elementClass = element.className || "";
    const elementId = element.id || "";

    let description = `${
      type === "rightclick"
        ? "右键点击"
        : type === "doubleclick"
        ? "双击"
        : "点击"
    } <${tagName}>`;

    if (elementId) {
      description += ` (id: ${elementId})`;
    } else if (elementClass) {
      description += ` (class: ${elementClass.split(" ")[0]})`;
    }

    if (elementText) {
      description += ` - "${elementText}"`;
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
    };

    console.log("🚀 ~ addActionRecord ~ record:", record); // 添加调试日志
    setActionHistory((prev) => [record, ...prev].slice(0, 50)); // 保持最近50条记录
  };

  // 添加iframe事件监听器
  const addIframeEventListeners = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) {
      console.log("🚀 ~ iframe contentDocument not ready"); // 调试日志
      return null;
    }

    const iframeDoc = iframe.contentDocument;
    console.log("🚀 ~ Adding iframe event listeners"); // 调试日志

    // 点击事件
    const handleIframeClick = (e: MouseEvent) => {
      console.log("🚀 ~ iframe click detected", e.target); // 调试日志
      if (isElementSelectMode) return; // 选择模式下不记录

      const target = e.target as HTMLElement;
      if (
        target &&
        target !== iframeDoc.body &&
        target !== iframeDoc.documentElement
      ) {
        addActionRecord("click", target);
      }
    };

    // 右键点击事件
    const handleIframeContextMenu = (e: MouseEvent) => {
      console.log("🚀 ~ iframe contextmenu detected", e.target); // 调试日志
      if (isElementSelectMode) return; // 选择模式下不记录

      const target = e.target as HTMLElement;
      if (
        target &&
        target !== iframeDoc.body &&
        target !== iframeDoc.documentElement
      ) {
        addActionRecord("rightclick", target);
      }
    };

    // 双击事件
    const handleIframeDoubleClick = (e: MouseEvent) => {
      console.log("🚀 ~ iframe dblclick detected", e.target); // 调试日志
      if (isElementSelectMode) return; // 选择模式下不记录

      const target = e.target as HTMLElement;
      if (
        target &&
        target !== iframeDoc.body &&
        target !== iframeDoc.documentElement
      ) {
        addActionRecord("doubleclick", target);
      }
    };

    iframeDoc.addEventListener("click", handleIframeClick, true); // 使用捕获阶段
    iframeDoc.addEventListener("contextmenu", handleIframeContextMenu, true);
    iframeDoc.addEventListener("dblclick", handleIframeDoubleClick, true);

    return () => {
      console.log("🚀 ~ Removing iframe event listeners"); // 调试日志
      iframeDoc.removeEventListener("click", handleIframeClick, true);
      iframeDoc.removeEventListener(
        "contextmenu",
        handleIframeContextMenu,
        true,
      );
      iframeDoc.removeEventListener("dblclick", handleIframeDoubleClick, true);
    };
  };

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
            console.log(
              "🚀 ~ Successfully added iframe event listeners after",
              delay,
              "ms",
            );
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
  }, [dom, isElementSelectMode]); // 依赖dom和选择模式状态

  // 启用元素选择模式
  const enableElementSelection = () => {
    setIsElementSelectMode(true);

    const iframe = iframeRef.current;
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
          setHoveredElement(elementBelow);
        } else {
          currentHoveredElement = null;
          setHoveredElement(null);
        }
      }
    };

    // 鼠标离开覆盖层时移除高亮
    const handleMouseLeave = (e: MouseEvent) => {
      if (currentHoveredElement) {
        currentHoveredElement.classList.remove("element-selector-hover");
        currentHoveredElement = null;
        setHoveredElement(null);
      }
    };

    // 点击事件
    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (currentHoveredElement) {
        selectElement(currentHoveredElement);
      }

      disableElementSelection();
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
    (iframe as any).elementSelectorCleanup = cleanup;
  };

  // 禁用元素选择模式
  const disableElementSelection = () => {
    setIsElementSelectMode(false);
    setHoveredElement(null);

    const iframe = iframeRef.current;
    if (iframe && (iframe as any).elementSelectorCleanup) {
      (iframe as any).elementSelectorCleanup();
      (iframe as any).elementSelectorCleanup = null;
    }
  };

  // 选择元素
  const selectElement = (element: HTMLElement) => {
    const tagName = element.tagName.toLowerCase();

    // 简化元素名称，只显示标签类型
    const elementName = `<${tagName}>`;

    // 创建自定义事件，通知 RichTextInput 组件
    const event = new CustomEvent("elementDrop", {
      detail: {
        type: "element",
        name: elementName,
        content: element.outerHTML,
      },
    });
    window.dispatchEvent(event);
  };

  const handleScroll = (event: React.WheelEvent) => {
    if (!iframeRef.current) return;
    if (!iframeRef.current.contentWindow) return;
    iframeRef.current.contentWindow.scrollBy(0, event.deltaY);

    // scrollTop = iframeRef.current.scrollTop + event.deltaY;
  };

  return (
    <div className="absolute inset-0 flex justify-center">
      {/* 操作按钮组 */}
      <div className="absolute right-4 top-4 z-10 flex space-x-2">
        {/* 历史记录按钮 */}
        <button
          onClick={() => setShowActionHistory(!showActionHistory)}
          className={`
            inline-flex items-center rounded-md px-3 py-2 text-sm font-medium shadow-sm
            ${
              showActionHistory
                ? "bg-gray-600 text-white hover:bg-gray-700"
                : "bg-gray-500 text-white hover:bg-gray-600"
            }
          `}
          title={`${showActionHistory ? "隐藏" : "显示"}操作历史记录`}
        >
          <ClockIcon className="mr-1 h-4 w-4" />
          历史 ({actionHistory.length})
        </button>

        {/* 元素选择按钮 */}
        <button
          onClick={
            isElementSelectMode
              ? disableElementSelection
              : enableElementSelection
          }
          className={`
            inline-flex items-center rounded-md px-3 py-2 text-sm font-medium shadow-sm
            ${
              isElementSelectMode
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }
          `}
          title={isElementSelectMode ? "取消选择元素 (ESC)" : "选择页面元素"}
        >
          <CursorArrowRaysIcon className="mr-1 h-4 w-4" />
          {isElementSelectMode ? "取消选择" : "选择元素"}
        </button>
      </div>

      {/* 操作历史面板 */}
      {showActionHistory && (
        <ActionHistoryPanel
          actions={actionHistory}
          onClose={() => setShowActionHistory(false)}
          onClear={() => setActionHistory([])}
        />
      )}

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
