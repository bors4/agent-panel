import fs from "fs";
import path from "path";

const FILE_LIMIT = 10;

export async function skill(args, projectPath) {
  const name = args.name;
  if (!name || typeof name !== "string") {
    return { success: false, error: "Skill name is required" };
  }

  const agentsDir = path.join(projectPath, ".agents", "skills", name);
  const skillFile = path.join(agentsDir, "SKILL.md");

  try {
    await fs.promises.access(skillFile);
  } catch {
    return { success: false, error: `Skill not found: "${name}". Check the skill name and ensure .agents/skills/${name}/SKILL.md exists.` };
  }

  const content = await fs.promises.readFile(skillFile, "utf-8");
  const directory = agentsDir;

  let files = [];
  try {
    function walkDir(dir, prefix) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = prefix ? prefix + "/" + entry.name : entry.name;
        if (entry.isDirectory()) {
          walkDir(path.join(dir, entry.name), rel);
        } else if (entry.isFile() && entry.name !== "SKILL.md") {
          files.push(rel);
        }
      }
    }
    walkDir(directory, "");
    files = files.sort().slice(0, FILE_LIMIT);
  } catch {
    /* no extra files */
  }

  return {
    success: true,
    data: { name, content, directory, files },
  };
}

export function toModelOutput(result) {
  if (!result.success) return `Skill load failed: ${result.error}`;
  const fileUrl = "file:///" + result.data.directory.replace(/\\/g, "/");
  const lines = [
    `<skill_content name="${result.data.name}">`,
    `# Skill: ${result.data.name}`,
    "",
    result.data.content.trim(),
    "",
    `Base directory for this skill: ${fileUrl}`,
    "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
    "",
    "<skill_files>",
    ...result.data.files.map((f) => `<file>${f}</file>`),
    "</skill_files>",
    "</skill_content>",
  ];
  return lines.join("\n");
}
