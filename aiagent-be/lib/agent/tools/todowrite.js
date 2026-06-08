export async function todowrite(args) {
  const { todos } = args;
  if (!Array.isArray(todos) || todos.length === 0) {
    return { success: false, error: "todos must be a non-empty array" };
  }
  for (let i = 0; i < todos.length; i++) {
    const t = todos[i];
    if (!t.content || typeof t.content !== "string") {
      return { success: false, error: `Todo at index ${i} must have a "content" string field` };
    }
    if (t.status && !["pending", "in_progress", "completed", "cancelled"].includes(t.status)) {
      return { success: false, error: `Todo at index ${i}: status must be one of: pending, in_progress, completed, cancelled` };
    }
  }
  return {
    success: true,
    data: { todos },
  };
}

export function toModelOutput(result) {
  if (!result.success) return `Todo write failed: ${result.error}`;
  return JSON.stringify(result.data.todos, null, 2);
}
