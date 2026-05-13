import path from "path";

export function safePath(userPath, projectRoot) {
  const cleanPath = userPath.replace(/^\.\//, "").trim();
  const isAbsolute = /^([a-zA-Z]:[\\/]|\/|\\\\)/.test(cleanPath);
  const joined = isAbsolute ? cleanPath : path.join(projectRoot, cleanPath);

  const normalized = path.normalize(joined).replace(/\\/g, "/").toLowerCase();
  const projectNorm = path.normalize(projectRoot).replace(/\\/g, "/").toLowerCase();

  if (normalized !== projectNorm && !normalized.startsWith(projectNorm + "/")) {
    throw new Error(`Path outside project is forbidden: ${normalized}`);
  }
  return path.normalize(joined).replace(/\\/g, "/");
}

export function parseToolCall(text) {
  if (!text) return null;

  const cleaned = text.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();

  // Format 1: <function=name><parameter=key>value</parameter>...</function>
  let match = cleaned.match(/<function=(\w+)>([\s\S]*?)<\/function>/i);
  if (match) {
    const funcName = match[1];
    const paramsText = match[2];
    const args = {};
    const pm = paramsText.matchAll(
      /<parameter=(\w+)>([\s\S]*?)<\/parameter>/gis,
    );
    for (const m of pm) {
      let value = m[2].trim();
      // Конвертация типов: boolean / number / string
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (value !== "" && !isNaN(value)) value = Number(value);
      args[m[1]] = value;
    }
    return {
      name: funcName,
      args,
      id: `parsed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` // ← временный ID
    };
  }

  // Format 2: {"name": "...", "arguments"/"args": {...}}
  match = cleaned.match(/\{[\s\S]*?"name"\s*:\s*"(\w+)"[\s\S]*?\}/i);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      return {
        name: obj.name,
        args: obj.arguments || obj.args || {},
      };
    } catch (e) {
      console.warn(`[parseToolCall] JSON parse error: ${e.message}`);
    }
  }

  // Format 3: <tool>{...}</tool>
  match = cleaned.match(/<tool>\s*([\s\S]*?)\s*<\/tool>/i);
  if (match) {
    try {
      const obj = JSON.parse(match[1]);
      return {
        name: obj.name,
        args: obj.args || obj.arguments || {},
      };
    } catch (e) {
      console.warn(`[parseToolCall] <tool> JSON error: ${e.message}`);
    }
  }

  return null;
}
