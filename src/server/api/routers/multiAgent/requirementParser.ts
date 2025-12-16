import { generateText } from "ai";
import { getModelByName } from "~/utils/utils";
import { env } from "~/env.mjs";
import type { UserRequirement } from "./types";
import { userRequirementsStore } from "./storage";

/**
 * T010: Parse requirement text and create UserRequirement
 */
export async function parseRequirement(
  requirementText: string,
  requirementId: string,
): Promise<UserRequirement> {
  const model = getModelByName(env.MODEL_NAME);

  const { text } = await generateText({
    model,
    system: `You are a requirements analyst. Parse the user's UI requirement and extract:
1. parsedGoals: List of main goals (as string array)
2. keyActions: List of key user actions (as string array)
3. constraints: List of constraints or limitations (as string array)

Respond with ONLY valid JSON matching this schema:
{
  "parsedGoals": ["goal1", "goal2"],
  "keyActions": ["action1", "action2"],
  "constraints": ["constraint1"]
}`,
    prompt: `Requirement: ${requirementText}`,
  });

  let parsed: {
    parsedGoals: string[];
    keyActions: string[];
    constraints: string[];
  } = {
    parsedGoals: [],
    keyActions: [],
    constraints: [],
  };

  try {
    parsed = JSON.parse(text);
  } catch {
    // Fallback: extract basic structure from text
    parsed = {
      parsedGoals: [requirementText.substring(0, 100)],
      keyActions: ["implement UI based on requirement"],
      constraints: [],
    };
  }

  const requirement: UserRequirement = {
    id: requirementId,
    rawText: requirementText,
    createdAt: new Date().toISOString(),
    parsedGoals: parsed.parsedGoals || [],
    keyActions: parsed.keyActions || [],
    constraints: parsed.constraints || [],
  };

  userRequirementsStore.set(requirementId, requirement);
  return requirement;
}
