import { describe, expect, it } from "vitest";
import { commitUrl } from "../src/features/commitLink";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("commitUrl", () => {
  it("builds a GitHub link from an SCP-like remote", () => {
    expect(commitUrl("git@github.com:acme/widgets.git", SHA)).toBe(
      `https://github.com/acme/widgets/commit/${SHA}`,
    );
  });

  it("builds a GitHub link from an https remote without .git", () => {
    expect(commitUrl("https://github.com/acme/widgets", SHA)).toBe(
      `https://github.com/acme/widgets/commit/${SHA}`,
    );
  });

  it("strips a trailing .git and userinfo from https remotes", () => {
    expect(commitUrl("https://user@github.com/acme/widgets.git", SHA)).toBe(
      `https://github.com/acme/widgets/commit/${SHA}`,
    );
  });

  it("handles ssh:// remotes", () => {
    expect(commitUrl("ssh://git@github.com/acme/widgets.git", SHA)).toBe(
      `https://github.com/acme/widgets/commit/${SHA}`,
    );
  });

  it("keeps nested groups (GitLab subgroups)", () => {
    expect(commitUrl("git@gitlab.com:group/sub/proj.git", SHA)).toBe(
      `https://gitlab.com/group/sub/proj/commit/${SHA}`,
    );
  });

  it("uses /commits/ for Bitbucket", () => {
    expect(commitUrl("https://bitbucket.org/acme/widgets.git", SHA)).toBe(
      `https://bitbucket.org/acme/widgets/commits/${SHA}`,
    );
  });

  it("is case-insensitive on the host", () => {
    expect(commitUrl("git@GitHub.com:acme/widgets.git", SHA)).toBe(
      `https://github.com/acme/widgets/commit/${SHA}`,
    );
  });

  it("returns null for unknown hosts", () => {
    expect(commitUrl("git@example.com:acme/widgets.git", SHA)).toBeNull();
    expect(commitUrl("https://git.internal.corp/acme/widgets.git", SHA)).toBeNull();
  });

  it("returns null for missing remote or sha", () => {
    expect(commitUrl(undefined, SHA)).toBeNull();
    expect(commitUrl("git@github.com:acme/widgets.git", undefined)).toBeNull();
    expect(commitUrl("", SHA)).toBeNull();
  });

  it("returns null when the path is not owner/repo shaped", () => {
    expect(commitUrl("https://github.com/justowner", SHA)).toBeNull();
  });
});
