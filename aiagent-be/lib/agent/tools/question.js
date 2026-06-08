export async function question(args) {
  const { questions } = args;
  if (!Array.isArray(questions) || questions.length === 0) {
    return { success: false, error: "At least one question is required" };
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.question || typeof q.question !== "string") {
      return { success: false, error: `Question at index ${i} must have a "question" string field` };
    }
    if (q.options && (!Array.isArray(q.options) || q.options.length === 0)) {
      return { success: false, error: `Question at index ${i}: options must be a non-empty array` };
    }
    if (q.options) {
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].label || !q.options[j].description) {
          return { success: false, error: `Question at index ${i}, option ${j}: each option must have "label" and "description"` };
        }
      }
    }
  }
  return {
    success: true,
    requiresApproval: true,
    data: { questions },
  };
}

export function toModelOutput(result) {
  if (!result.success) return `Question failed: ${result.error}`;
  return `User has answered the questions. You can continue with the user's answers in mind.`;
}
