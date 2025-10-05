import { type ComponentFile } from "~/utils/compiler";
import { PageEditor } from "./PageEditor";

interface PagePanelProps {
  code: ComponentFile[];
  selectionMode: "none" | "element" | "logic";
  onSelectionModeChange: (mode: "none" | "element" | "logic") => void;
  onElementSelection?: (
    detail: { elementName: string; elementContent: string },
    mode: "element" | "logic",
  ) => void;
}

export const PagePanel = ({
  code,
  selectionMode,
  onSelectionModeChange,
  onElementSelection,
}: PagePanelProps) => {
  return (
    <div className="relative h-full">
      <PageEditor
        code={code}
        selectionMode={selectionMode}
        onSelectionModeChange={onSelectionModeChange}
        onElementSelection={onElementSelection}
      />
    </div>
  );
};
