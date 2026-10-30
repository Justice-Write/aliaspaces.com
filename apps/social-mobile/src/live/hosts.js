(() => {
  "use strict";

  const LIVE_HOSTS = Object.freeze([
    "mypersonas.online",
    "www.mypersonas.online",
    "aliaspaces.com",
    "www.aliaspaces.com",
  ]);
  const AUTH_HOSTS = Object.freeze([
    "nwsqyuucwzihruszocge.supabase.co",
    "accounts.google.com",
    "accounts.youtube.com",
    "appleid.apple.com",
  ]);
  const ASSET_HOSTS = Object.freeze([
    "cdn.jsdelivr.net",
    "cdnjs.cloudflare.com",
    "challenges.cloudflare.com",
    "www.youtube.com",
    "player.twitch.tv",
    "player.kick.com",
    "w.soundcloud.com",
    "appassets.androidplatform.net",
  ]);

  function hostOf(value) {
    if (typeof value !== "string" || value !== value.trim() || value.includes("\\")) return "";
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") ? url.hostname.toLowerCase() : "";
    } catch { return ""; }
  }

  function isAllowedHost(value) {
    const host = hostOf(value);
    if (!host) return false;
    if (LIVE_HOSTS.includes(host) || AUTH_HOSTS.includes(host) || ASSET_HOSTS.includes(host)) return true;
    return false;
  }

  function isLiveProductHost(value) {
    return LIVE_HOSTS.includes(hostOf(value));
  }

  const api = { LIVE_HOSTS, AUTH_HOSTS, ASSET_HOSTS, hostOf, isAllowedHost, isLiveProductHost };

  const root = typeof globalThis !== "undefined" ? globalThis : undefined;
  if (root) root.AliaSpacesLiveHosts = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
