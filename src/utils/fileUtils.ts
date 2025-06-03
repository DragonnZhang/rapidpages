/**
 * 将文件转换为Base64字符串
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * 检查文件类型是否为图片
 */
export const isImageFile = (file: File): boolean => {
  return file.type.startsWith("image/");
};

/**
 * 检查文件类型是否为音频
 */
export const isAudioFile = (file: File): boolean => {
  return file.type.startsWith("audio/");
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * 生成基于时间戳的文件名
 */
export const generateTimestampFilename = (extension: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `file-${timestamp}.${extension}`;
};

/**
 * 从剪贴板数据中提取图片文件
 */
export const extractImagesFromClipboard = (
  clipboardData: DataTransfer,
): File[] => {
  const items = Array.from(clipboardData.items);
  const imageFiles: File[] = [];

  items.forEach((item) => {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        // 为截图生成有意义的文件名
        const extension = file.type.split("/")[1] || "png";
        const filename = generateTimestampFilename(extension);

        // 创建重命名的文件
        const renamedFile = new File([file], filename, { type: file.type });
        imageFiles.push(renamedFile);
      }
    }
  });

  return imageFiles;
};
