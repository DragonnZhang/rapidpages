import { generateNewComponent } from "~/server/openai";
import type { UiVersion } from "./types";
import type { MediaItem } from "~/types/multimodal";
import { uiVersionsStore } from "./storage";

/**
 * T011: Generate initial UI version using generateNewComponent
 */
export async function generateInitialUi(
  requirementText: string,
  uiVersionId: string,
  media?: MediaItem[],
): Promise<UiVersion> {
  const files = await generateNewComponent(requirementText, media);

  const uiVersion: UiVersion = {
    id: uiVersionId,
    componentId: `comp_${Date.now()}`,
    versionIndex: 0,
    files,
    createdAt: new Date().toISOString(),
    createdBy: "generator",
  };

  uiVersionsStore.set(uiVersionId, uiVersion);
  return uiVersion;
}
