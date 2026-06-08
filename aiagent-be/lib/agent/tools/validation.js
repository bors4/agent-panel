export function validateToolArgs(name, args, schema) {
  if (!schema) return { valid: true };

  const errors = [];

  if (schema.required) {
    for (const field of schema.required) {
      if (args[field] === undefined || args[field] === null) {
        errors.push(`Missing required field: "${field}"`);
      }
    }
  }

  if (schema.properties) {
    for (const [key, value] of Object.entries(args)) {
      const prop = schema.properties[key];
      if (!prop) continue;
      if (value === undefined || value === null) continue;

      const type = prop.type;
      if (type) {
        const jsType = Array.isArray(value) ? "array" : typeof value;
        if (type === "array" && jsType !== "array") {
          errors.push(`Field "${key}" must be an array`);
        } else if (type === "object" && jsType !== "object") {
          errors.push(`Field "${key}" must be an object`);
        } else if (type === "number" && jsType !== "number") {
          errors.push(`Field "${key}" must be a number`);
        } else if (type === "string" && jsType !== "string") {
          errors.push(`Field "${key}" must be a string`);
        } else if (type === "boolean" && jsType !== "boolean") {
          errors.push(`Field "${key}" must be a boolean`);
        }
      }

      if (type === "string" && prop.maxLength && String(value).length > prop.maxLength) {
        errors.push(`Field "${key}" exceeds maximum length of ${prop.maxLength}`);
      }
      if (type === "number" || type === "integer") {
        if (prop.minimum !== undefined && value < prop.minimum) {
          errors.push(`Field "${key}" must be >= ${prop.minimum}`);
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          errors.push(`Field "${key}" must be <= ${prop.maximum}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? `Validation failed: ${errors.join("; ")}` : undefined,
  };
}
