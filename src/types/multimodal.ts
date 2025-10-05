export interface MediaItem {
  id: string;
  type:
    | "image"
    | "audio"
    | "code"
    | "element"
    | "action"
    | "action-sequence"
    | "logic";
  url: string; // 对于element和logic类型，这里存储元素的HTML或逻辑内容
  name: string;
  size?: number;
  actions?: ActionRecord[]; // 新增：用于存储操作序列
  logicId?: string; // 用于引用交互逻辑实体
  logicContent?: string; // 交互逻辑的文本内容
  elementName?: string; // 绑定逻辑的元素名称
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
