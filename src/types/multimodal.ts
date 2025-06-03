export interface MediaItem {
  id: string;
  type: "image" | "audio" | "code" | "element";
  url: string; // 对于element类型，这里存储元素的HTML内容
  name: string;
  size?: number;
}

export interface RichTextContent {
  text: string;
  media: MediaItem[];
}
