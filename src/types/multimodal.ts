export interface MediaItem {
  id: string;
  type: "image" | "audio" | "code" | "element" | "action" | "action-sequence";
  url: string; // 对于element类型，这里存储元素的HTML内容
  name: string;
  size?: number;
  actions?: ActionRecord[]; // 新增：用于存储操作序列
}

export interface RichTextContent {
  text: string;
  media: MediaItem[];
}

export interface ActionRecord {
  id: string;
  timestamp: number;
  type: "click" | "rightclick" | "doubleclick" | "input";
  elementTag: string;
  elementText: string;
  elementClass: string;
  elementId: string;
  description: string;
  inputValue?: string; // 新增：记录输入的内容
}
