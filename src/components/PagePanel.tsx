import { type ComponentFile } from "~/utils/compiler";
import { PageEditor } from "./PageEditor";

interface PagePanelProps {
  code: ComponentFile[];
  isElementSelectMode: boolean;
  onElementSelectModeChange: (mode: boolean) => void;
}

export const PagePanel = ({
  code,
  isElementSelectMode,
  onElementSelectModeChange,
}: PagePanelProps) => {
  return (
    <div className="relative h-full">
      <PageEditor
        code={code}
        isElementSelectMode={isElementSelectMode}
        onElementSelectModeChange={onElementSelectModeChange}
      />
    </div>
  );
};
