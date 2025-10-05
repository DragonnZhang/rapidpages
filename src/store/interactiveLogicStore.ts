import { atom } from "jotai";

export interface InteractiveLogicEntity {
  id: string;
  name: string;
  logic: string;
  elementName: string;
  elementContent: string;
  createdAt: number;
  updatedAt: number;
}

export interface ElementSelectionDetail {
  elementName: string;
  elementContent: string;
}

export interface InteractiveLogicModalState {
  isOpen: boolean;
  mode: "create" | "edit";
  elementDetail?: ElementSelectionDetail;
  entityId?: string;
}

export const interactiveLogicAtom = atom<InteractiveLogicEntity[]>([]);

export const interactiveLogicModalAtom = atom<InteractiveLogicModalState>({
  isOpen: false,
  mode: "create",
});
