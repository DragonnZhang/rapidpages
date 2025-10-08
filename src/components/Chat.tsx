import { useState } from "react";
import { api } from "~/utils/api";
import { useRouter } from "next/router";
import { toast } from "react-hot-toast";
import { RichTextInput } from "./RichTextInput";
import { type RichTextContent } from "~/types/multimodal";

export const Chat = ({ revisionId }: { revisionId: string }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const reviseComponent = api.component.makeRevision.useMutation();
  const router = useRouter();

  // 处理富文本内容提交
  const handleSubmit = async (content: RichTextContent) => {
    setLoading(true);

    try {
      console.log("🚀 ~ handleSubmit content:", content);

      const newRevisionId = await reviseComponent.mutateAsync({
        revisionId,
        prompt: content.text,
        media: content.media || [], // 确保media不为undefined
      });

      console.log("🚀 ~ handleSubmit result:", newRevisionId);

      if (newRevisionId === null || newRevisionId.status === "error") {
        toast.error("Something went wrong while updating the component.");
        setLoading(false);
        return;
      }

      router.push(`/r/${newRevisionId.data.revisionId}`);
    } catch (error) {
      console.error("🚀 ~ handleSubmit error:", error);
      toast.error("Something went wrong while updating the component.");
      setLoading(false);
    }
  };

  return (
    <div className="mb-3">
      <RichTextInput
        onSubmit={handleSubmit}
        disabled={loading}
        placeholder="Describe the changes you need—feel free to attach images or code snippets as references."
        rows={2}
      />
    </div>
  );
};
