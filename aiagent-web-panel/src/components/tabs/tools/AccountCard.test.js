/**
 * Тесты для components/tabs/tools/AccountCard.vue.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import AccountCard from "@/components/tabs/tools/AccountCard.vue";

const baseAcct = {
  username: "alice",
  role: "user",
  permissions: { read: true, write: true },
  include_paths: ["E:\\projects"],
};

const allToolNames = ["read", "write", "execute"];

describe("AccountCard", () => {
  beforeEach(() => {
    window.confirm = vi.fn(() => true);
  });

  it("renders username, role, and checkboxes for all tools", () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 0, isExpanded: false, allToolNames },
    });
    expect(wrapper.find('input[type="text"]').element.value).toBe("alice");
    expect(wrapper.find("select").element.value).toBe("user");
    expect(wrapper.findAll(".perm-check")).toHaveLength(3);
  });

  it("does not show details when collapsed", () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 0, isExpanded: false, allToolNames },
    });
    expect(wrapper.find(".account-details").attributes("style")).toContain("display: none");
  });

  it("shows details when expanded", () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 0, isExpanded: true, allToolNames },
    });
    const style = wrapper.find(".account-details").attributes("style") || "";
    expect(style).not.toContain("display: none");
    expect(wrapper.find(".path-row input").element.value).toBe("E:\\projects");
  });

  it("emits toggle-settings on header click", async () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 5, isExpanded: false, allToolNames },
    });
    await wrapper.find(".account-header").trigger("click");
    expect(wrapper.emitted("toggle-settings")).toEqual([[5]]);
  });

  it("emits remove with index on delete button click", async () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 3, isExpanded: false, allToolNames },
    });
    await wrapper.find(".btn-danger").trigger("click");
    expect(wrapper.emitted("remove")).toEqual([[3]]);
  });

  it("emits username-input on username typing", async () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 0, isExpanded: false, allToolNames },
    });
    const input = wrapper.findAll('input[type="text"]')[0];
    await input.setValue("bob");
    expect(wrapper.emitted("username-input")).toEqual([[0, "bob"]]);
  });

  it("emits role-change on select change", async () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 0, isExpanded: false, allToolNames },
    });
    await wrapper.find("select").setValue("system");
    expect(wrapper.emitted("role-change")).toEqual([[0, "system"]]);
  });

  it("emits toggle-tool on permission checkbox change", async () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 0, isExpanded: true, allToolNames },
    });
    const readCheckbox = wrapper.findAll('.perm-check input[type="checkbox"]')[0];
    await readCheckbox.setValue(false);
    expect(wrapper.emitted("toggle-tool")).toEqual([[0, "read", false]]);
  });

  it("emits add-path on + Add path click", async () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 0, isExpanded: true, allToolNames },
    });
    await wrapper.find(".btn-link").trigger("click");
    expect(wrapper.emitted("add-path")).toEqual([[0]]);
  });

  it("emits remove-path on path row delete", async () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 0, isExpanded: true, allToolNames },
    });
    await wrapper.find(".btn-icon").trigger("click");
    expect(wrapper.emitted("remove-path")).toEqual([[0, 0]]);
  });

  it("emits path-input on path row edit", async () => {
    const wrapper = mount(AccountCard, {
      props: { acct: baseAcct, idx: 0, isExpanded: true, allToolNames },
    });
    const pathInput = wrapper.findAll(".path-row input")[0];
    await pathInput.setValue("D:\\code");
    expect(wrapper.emitted("path-input")).toEqual([[0, 0, "D:\\code"]]);
  });
});
