import fs from "fs";
import path from "path";
import { safePath } from "../../utils.js";

const normalizeLineEndings = (text) => text.replaceAll("\r\n", "\n");
const detectLineEnding = (text) => (text.includes("\r\n") ? "\r\n" : "\n");
const convertToLineEnding = (text, ending) =>
  ending === "\n" ? normalizeLineEndings(text) : normalizeLineEndings(text).replaceAll("\n", "\r\n");

const splitBom = (text) =>
  text.startsWith("\uFEFF") ? { bom: true, text: text.slice(1) } : { bom: false, text };
const joinBom = (text, bom) => (bom ? `\uFEFF${text}` : text);

function countOccurrences(content, search) {
  if (search === "") return content.length + 1;
  let count = 0;
  let offset = 0;
  while ((offset = content.indexOf(search, offset)) !== -1) {
    count++;
    offset += search.length;
  }
  return count;
}

function previewLines(value, prefix) {
  const lines = normalizeLineEndings(value).split("\n");
  const shown = lines.slice(0, 6).map((line) => `${prefix}${line.length > 240 ? line.slice(0, 240) + "..." : line}`);
  if (lines.length > shown.length) shown.push(`${prefix}...`);
  return shown;
}

export async function edit(args, projectPath) {
  if (args.oldString === args.newString) {
    return { success: false, error: "No changes to apply: oldString and newString are identical." };
  }
  if (!args.oldString) {
    return { success: false, error: "oldString must not be empty. Use write to create or overwrite a file." };
  }

  const filePath = safePath(args.filePath, projectPath);
  try {
    await fs.promises.access(filePath);
  } catch {
    return { success: false, error: `File not found: ${path.relative(projectPath, filePath)}` };
  }

  const raw = await fs.promises.readFile(filePath, "utf-8");
  const { bom, text: existingText } = splitBom(raw);
  const ending = detectLineEnding(existingText);
  const oldString = convertToLineEnding(args.oldString, ending);
  const newString = convertToLineEnding(args.newString, ending);

  const replacements = countOccurrences(existingText, oldString);
  if (replacements === 0) {
    return {
      success: false,
      error: "Could not find oldString in the file. It must match exactly, including whitespace and indentation.",
    };
  }
  if (replacements > 1 && !args.replaceAll) {
    return {
      success: false,
      error: "Found multiple exact matches for oldString. Provide more surrounding context or set replaceAll to true.",
    };
  }

  const replaced = args.replaceAll
    ? existingText.replaceAll(oldString, newString)
    : existingText.replace(oldString, newString);

  const next = splitBom(replaced);
  await fs.promises.writeFile(filePath, joinBom(next.text, bom || next.bom), "utf-8");

  return {
    success: true,
    data: { resource: path.relative(projectPath, filePath).replace(/\\/g, "/"), replacements },
    oldString: args.oldString,
    newString: args.newString,
  };
}

export function toModelOutput(result) {
  if (!result.success) return `Edit failed: ${result.error}`;
  const lines = [`Edited file successfully: ${result.data.resource}`, `Replacements: ${result.data.replacements}`, "```diff", ...previewLines(result.oldString, "-"), ...previewLines(result.newString, "+"), "```"];
  return lines.join("\n");
}
