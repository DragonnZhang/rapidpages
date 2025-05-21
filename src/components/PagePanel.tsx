import { PageEditor } from "~/components/PageEditor";
import { type ComponentFile } from "~/utils/compiler";

export const PagePanel = ({ code }: { code: ComponentFile[] }) => {
  return (
    <>
      <div className="relative flex h-full w-full rounded-b-lg border border-t-0 border-gray-300 bg-gray-200">
        <PageEditor code={code} />
      </div>
    </>
  );
};
