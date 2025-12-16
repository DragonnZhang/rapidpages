import { atom } from "jotai";
import { type ActionRecord } from "~/types/multimodal";

export const actionHistoryAtom = atom<ActionRecord[]>([]);
export const selectedActionIdsAtom = atom<string[]>([]);
export const actionHistoryVisibleAtom = atom<boolean>(true);
