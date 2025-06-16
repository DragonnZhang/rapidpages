import { useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { type MediaItem } from "~/types/multimodal";

interface ImagePreviewModalProps {
  imageItem: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  imageItem,
  isOpen,
  onClose,
}) => {
  // 按ESC键关闭预览
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // 防止背景滚动
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imageItem || imageItem.type !== "image") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-75"
        onClick={onClose}
      />

      {/* 预览容器 */}
      <div className="relative z-10 max-h-[90vh] max-w-[90vw] rounded-lg bg-white p-2 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute -right-2 -top-2 z-20 rounded-full bg-white p-1 shadow-lg hover:bg-gray-100"
        >
          <XMarkIcon className="h-5 w-5 text-gray-600" />
        </button>

        {/* 图片 */}
        <img
          src={imageItem.url}
          alt={imageItem.name}
          className="max-h-[85vh] max-w-full rounded object-contain"
        />

        {/* 图片信息 */}
        <div className="mt-2 px-2 py-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {imageItem.name}
          </p>
          <p className="text-xs text-gray-500">
            {(imageItem.size / 1024).toFixed(1)} KB
          </p>
        </div>
      </div>
    </div>
  );
};
