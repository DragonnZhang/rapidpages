export interface MediaItem {
  id: string;
  type: "image" | "audio" | "code";
  url: string;
  name: string;
  size?: number;
  duration?: number; // 对于音频文件
}

export interface RichTextContent {
  text: string;
  media: MediaItem[];
}
