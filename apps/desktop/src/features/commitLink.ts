/**
 * Turns a git `origin` remote URL plus a commit SHA into a web link to that
 * commit. Recognizes the common hosts (GitHub, GitLab, Bitbucket); anything
 * else yields `null` so the UI never renders a broken link.
 */

interface RemoteRef {
  host: string;
  /** `owner/repo`, without a trailing `.git`. */
  path: string;
}

/** How each host spells the "view a commit" URL. */
const HOST_COMMIT_SEGMENT: Record<string, string> = {
  "github.com": "commit",
  "gitlab.com": "commit",
  "bitbucket.org": "commits",
};

/** Parses SCP-like, ssh:// and https:// remotes into host + `owner/repo`. */
function parseRemote(remoteUrl: string): RemoteRef | null {
  const url = remoteUrl.trim();
  if (!url) return null;

  // SCP-like syntax has no scheme: git@github.com:owner/repo.git
  const scp = /^[^/@]+@([^/:]+):(.+)$/.exec(url);
  if (scp && !url.includes("://")) {
    return normalize(scp[1], scp[2]);
  }

  // Scheme forms: https://[user@]host/owner/repo(.git), ssh://git@host/owner/repo
  const scheme = /^[a-z][a-z0-9+.-]*:\/\/(?:[^/@]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(url);
  if (scheme) {
    return normalize(scheme[1], scheme[2]);
  }

  return null;
}

function normalize(host: string, rawPath: string): RemoteRef | null {
  const path = rawPath.replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  if (!path.includes("/")) return null;
  return { host: host.toLowerCase(), path };
}

/**
 * Web URL for `sha` on the host of `remoteUrl`, or `null` when the remote is
 * missing/unrecognized or the SHA is absent. Always `https://`.
 */
export function commitUrl(remoteUrl: string | undefined, sha: string | undefined): string | null {
  if (!remoteUrl || !sha) return null;
  const ref = parseRemote(remoteUrl);
  if (!ref) return null;
  const segment = HOST_COMMIT_SEGMENT[ref.host];
  if (!segment) return null;
  return `https://${ref.host}/${ref.path}/${segment}/${sha}`;
}
