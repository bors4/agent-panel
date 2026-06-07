/**
 * Тесты для composable useChatToggles.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useChatToggles } from "@/composables/useChatToggles";

const AGENT_KEY = "agent-chat-mode";
const REASONING_KEY = "agent-show-reasoning";

beforeEach(() => {
  localStorage.clear();
});

describe("useChatToggles", () => {
  it("defaults both toggles to true when localStorage is empty", () => {
    const { agentMode, showReasoning } = useChatToggles();
    expect(agentMode.value).toBe(true);
    expect(showReasoning.value).toBe(true);
  });

  it("respects agentMode=false from localStorage", () => {
    localStorage.setItem(AGENT_KEY, "false");
    const { agentMode } = useChatToggles();
    expect(agentMode.value).toBe(false);
  });

  it("respects showReasoning=false from localStorage", () => {
    localStorage.setItem(REASONING_KEY, "false");
    const { showReasoning } = useChatToggles();
    expect(showReasoning.value).toBe(false);
  });

  it("toggleAgentMode flips value and persists to localStorage", () => {
    const { agentMode, toggleAgentMode } = useChatToggles();
    expect(agentMode.value).toBe(true);
    toggleAgentMode();
    expect(agentMode.value).toBe(false);
    expect(localStorage.getItem(AGENT_KEY)).toBe("false");
    toggleAgentMode();
    expect(agentMode.value).toBe(true);
    expect(localStorage.getItem(AGENT_KEY)).toBe("true");
  });

  it("toggleReasoning flips value and persists to localStorage", () => {
    const { showReasoning, toggleReasoning } = useChatToggles();
    expect(showReasoning.value).toBe(true);
    toggleReasoning();
    expect(showReasoning.value).toBe(false);
    expect(localStorage.getItem(REASONING_KEY)).toBe("false");
    toggleReasoning();
    expect(showReasoning.value).toBe(true);
    expect(localStorage.getItem(REASONING_KEY)).toBe("true");
  });

  it("agentMode state is independent across composable instances", () => {
    const a = useChatToggles();
    a.toggleAgentMode();
    const b = useChatToggles();
    // b reads from localStorage on creation
    expect(b.agentMode.value).toBe(false);
  });
});
