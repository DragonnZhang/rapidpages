export interface MediaItem {
  id: string;
  type: "image" | "audio";
  url: string;
  name: string;
  size?: number;
  duration?: number; // 对于音频文件
}

export interface RichTextContent {
  text: string;
  media: MediaItem[];
}

export interface RichTextSegment {
  type: "text" | "media";
  content: string; // 文本内容或媒体ID
  mediaItem?: MediaItem;
}
