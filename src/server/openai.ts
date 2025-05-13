import OpenAI from "openai";
import { env } from "~/env.mjs";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: "https://use.52apikey.cn/v1",
});
const openaiModelName = "gpt-4o";

const extractFirstCodeBlock = (input: string) => {
  const pattern = /```(\w+)?\n([\s\S]+?)\n```/g;
  let matches;
  while ((matches = pattern.exec(input)) !== null) {
    const language = matches[1];
    const codeBlock = matches[2];
    if (language === undefined || language === "tsx" || language === "json") {
      return codeBlock as string;
    }
  }

  // console.log(input);
  throw new Error("No code block found in input");
};

export async function reviseComponent(prompt: string, code: string) {
  const completion = await openai.chat.completions.create({
    model: openaiModelName,
    messages: [
      {
        role: "system",
        content: [
          "You are an AI programming assistant.",
          "Follow the user's requirements carefully & to the letter.",
          "You're working on a react component using typescript and tailwind.",
          "Don't introduce any new components or files.",
          "First think step-by-step about the changes needed.",
          "Then provide a complete implementation of the component with the requested changes.",
          "Only reply with the full code of the component in a code block.",
          "The code should be a complete React component that can be used directly.",
          "Keep your answers short and impersonal.",
          "Never create a new component or file.",
          `Here is the current code to modify:\n\`\`\`tsx\n${code}\n\`\`\``,
        ].join("\n"),
      },
      {
        role: "user",
        content: `${prompt}`,
      },
    ],
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 4096,
    n: 1,
  });

  const choices = completion.choices;

  if (
    !choices ||
    choices.length === 0 ||
    !choices[0] ||
    !choices[0].message ||
    !choices[0].message.content
  ) {
    throw new Error("No choices returned from OpenAI");
  }

  const response = choices[0].message.content;
  console.log("🚀 ~ reviseComponent ~ response:", response);

  // 从回复中提取代码块
  let newCode;
  try {
    newCode = extractFirstCodeBlock(response);
  } catch (error) {
    // 如果没有代码块，使用整个回复
    newCode = response;
  }

  console.log("🚀 ~ reviseComponent ~ newCode:", newCode);

  return newCode;
}

export async function generateNewComponent(prompt: string) {
  const completion = await openai.chat.completions.create({
    model: openaiModelName,
    messages: [
      {
        role: "system",
        content: [
          "You are a helpful assistant.",
          "You're tasked with writing a react component using typescript and tailwind for a website.",
          "Only import React as a dependency.",
          "Only reply with code.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `- Component Name: Section`,
          `- Component Description: ${prompt}\n`,
          `- Do not use libraries or imports other than React.`,
          `- Do not have any dynamic data. Use placeholders as data. Do not use props.`,
        ].join("\n"),
      },
    ],
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 4096,
    n: 1,
  });

  const choices = completion.choices;

  if (!choices || choices.length === 0 || !choices[0] || !choices[0].message) {
    throw new Error("No choices returned from OpenAI");
  }

  let result = choices[0].message.content || "";
  console.log("🚀 ~ generateNewComponent ~ result:", result);
  result = extractFirstCodeBlock(result);

  // console.log(result);
  return result;
}
