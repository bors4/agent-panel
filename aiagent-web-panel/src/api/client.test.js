/**
 * Тесты для API клиента.
 */

import { describe, it, expect } from "vitest";
import { isConnectionActive, resetConnection } from "@/api/client";

describe("api/client connection state", () => {
  it("starts with connected state", () => {
    expect(isConnectionActive()).toBe(true);
  });

  it("resets connection state", () => {
    resetConnection();
    expect(isConnectionActive()).toBe(true);
  });
});
