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

export async function write(args, projectPath) {
  const filePath = safePath(args.filePath, projectPath);
  const existed = fs.existsSync(filePath);

  let bom = false;
  let ending = "\n";
  if (existed) {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const parsed = splitBom(raw);
    bom = parsed.bom;
    ending = detectLineEnding(parsed.text);
  }

  const content = existed
    ? joinBom(convertToLineEnding(args.content, ending), bom)
    : args.content;

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, content, "utf-8");

  return {
    success: true,
    data: { path: filePath, size: content.length, existed },
  };
}

export function toModelOutput(result) {
  if (!result.success) return `Write failed: ${result.error}`;
  const action = result.data.existed ? "Wrote" : "Created";
  const resource = path.relative(process.cwd(), result.data.path).replace(/\\/g, "/");
  return `${action} file successfully: ${resource} (${result.data.size} bytes)`;
}
