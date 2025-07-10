import { type ComponentFile } from "~/utils/compiler";
import { PageEditor } from "./PageEditor";

interface PagePanelProps {
  code: ComponentFile[];
  isElementSelectMode: boolean;
  showActionHistory: boolean;
  onElementSelectModeChange: (mode: boolean) => void;
  onActionHistoryToggle: (show: boolean) => void;
  onActionHistoryCountChange: (count: number) => void;
}

export const PagePanel = ({
  code,
  isElementSelectMode,
  showActionHistory,
  onElementSelectModeChange,
  onActionHistoryToggle,
  onActionHistoryCountChange,
}: PagePanelProps) => {
  return (
    <div className="relative h-full">
      <PageEditor
        code={code}
        isElementSelectMode={isElementSelectMode}
        showActionHistory={showActionHistory}
        onElementSelectModeChange={onElementSelectModeChange}
        onActionHistoryToggle={onActionHistoryToggle}
        onActionHistoryCountChange={onActionHistoryCountChange}
      />
    </div>
  );
};
