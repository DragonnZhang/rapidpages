import { Tab } from "@headlessui/react";
import { Fragment, useState } from "react";
import { Logo } from "~/components/Logo";
import { TabBackground } from "~/components/TabBackground";
import { useComponentProvider } from "~/context/ComponentProvider";
import { PlusIcon } from "@heroicons/react/24/solid";
import { ReactLogo } from "~/components/ReactLogo";
import { PagePanel } from "~/components/PagePanel";
import { CodePanel } from "~/components/CodePanel";
import {
  ArrowUpTrayIcon,
  DocumentDuplicateIcon,
  CursorArrowRaysIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import toast from "react-hot-toast";
import { env } from "~/env.mjs";
import router from "next/router";
import { api } from "~/utils/api";
import { type ComponentFile } from "~/utils/compiler";
import { ActionTimeline } from "./ActionTimeline";

export const EditorTabs = ({
  code,
  revisionId,
}: {
  code: ComponentFile[];
  revisionId: string;
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isElementSelectMode, setIsElementSelectMode] = useState(false);
  const { tabs } = useComponentProvider();

  // If a tab is active find the active tab index
  const activeTab = tabs.find((tab) => tab.active);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeTabIndex = activeTab ? tabs.indexOf(activeTab) + 1 : 0;

  const forkRevision = api.component.forkRevision.useMutation();

  const handleElementSelectToggle = () => {
    setIsElementSelectMode(!isElementSelectMode);
  };

  return (
    <Tab.Group selectedIndex={selectedIndex}>
      <div className="flex flex-col">
        {/* 操作时间轴 */}
        <ActionTimeline />

        <div className="flex">
          <Tab.List className="ml-1 mt-3 flex h-8">
            <Tab key={0} as={Fragment}>
              {({ selected }) => (
                <button
                  className="relative z-10 mr-[-16px] flex h-8 w-32 focus:outline-none"
                  onClick={() => setSelectedIndex(0)}
                >
                  {selected && (
                    <div className="absolute left-0 top-0 h-[33px] w-full">
                      <TabBackground />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 top-0 flex justify-center gap-1 px-2 py-1">
                    <div className="flex items-center justify-center">
                      <Logo className="h-4 w-4" />
                    </div>
                    <div className="flex items-center text-sm">Canvas</div>
                  </div>
                </button>
              )}
            </Tab>

            <Tab key={1} as={Fragment}>
              {({ selected }) => (
                <div
                  className="relative z-10 mr-[-16px] flex h-8 w-32 focus:outline-none"
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.stopPropagation();
                      // removeTab(tab.sectionId);
                    }
                  }}
                  onClick={() => setSelectedIndex(1)}
                >
                  {selected && (
                    <div className="absolute left-0 top-0 h-[33px] w-full">
                      <TabBackground />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 top-0 flex cursor-pointer justify-center gap-1 px-4 pb-1 pt-1">
                    <div className="flex w-4 items-center justify-center">
                      <ReactLogo className="h-5 w-5" />
                    </div>
                    <div className="flex items-center">
                      <span className="block truncate text-sm">Code</span>
                    </div>
                  </div>
                </div>
              )}
            </Tab>
          </Tab.List>
          <div className="ml-auto flex items-center gap-2">
            {/* Canvas 模式下显示的操作按钮 */}
            {selectedIndex === 0 && (
              <>
                {/* 元素选择按钮 */}
                <button
                  onClick={handleElementSelectToggle}
                  className={`
                  inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium shadow-sm
                  ${
                    isElementSelectMode
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }
                `}
                  title={
                    isElementSelectMode ? "取消选择元素 (ESC)" : "选择页面元素"
                  }
                >
                  <CursorArrowRaysIcon className="mr-2 h-4 w-4" />
                  {isElementSelectMode ? "Cancel" : "Select"}
                </button>
              </>
            )}

            <Link
              href="/new"
              type="button"
              className="inline-flex flex-1 justify-center rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <PlusIcon className="-ml-0.5 mr-1 h-5 w-5" aria-hidden="true" />
              <span>New</span>
            </Link>

            <button
              className="inline-flex flex-1 items-center rounded-md bg-indigo-600 px-2.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  const result = await forkRevision.mutateAsync({
                    revisionId,
                  });

                  if (result.status === "error") {
                    throw new Error("Failed to fork revision");
                  }
                  await router.push(`/r/${result.data.revisionId}`);
                  return;
                } catch (e) {
                  if (e instanceof Error && e.message === "UNAUTHORIZED") {
                    router.push(`/login?redirect=/r/${revisionId}`);
                    return;
                  }
                  toast.error("Failed to fork revision");
                  return;
                }
              }}
            >
              <DocumentDuplicateIcon
                className="mr-2 h-4 w-4"
                aria-hidden="true"
              />
              <span>Fork</span>
            </button>

            <button
              className="inline-flex flex-1 items-center rounded-md bg-indigo-600 px-2.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              onClick={(e) => {
                e.preventDefault();
                navigator.clipboard
                  .writeText(`${env.NEXT_PUBLIC_URL}/r/${revisionId}`)
                  .then(
                    () => {
                      toast.success("Copied url to clipboard");
                    },
                    () => {
                      toast.error("Failed to copy to clipboard");
                    },
                  );
              }}
            >
              <ArrowUpTrayIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      <div className="h-1 w-full rounded-t-lg border border-b-0 border-gray-300 bg-gray-200" />
      <Tab.Panels className="h-full pb-3">
        <Tab.Panel key={0} className="flex h-full flex-col">
          <PagePanel
            code={code}
            isElementSelectMode={isElementSelectMode}
            onElementSelectModeChange={setIsElementSelectMode}
          />
        </Tab.Panel>
        <Tab.Panel key={1} className="flex h-full max-h-full flex-col">
          <CodePanel code={code} />
        </Tab.Panel>
      </Tab.Panels>
    </Tab.Group>
  );
};
