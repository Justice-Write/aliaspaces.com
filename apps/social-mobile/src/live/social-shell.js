(() => {
  "use strict";
  const LIVE_ORIGIN = "https://aliaspaces.com";
  const socialLanding = () => `${LIVE_ORIGIN}/`;
  const ownerLanding = () => "https://mypersonas.online/#/owner";
  // The website owns cross-domain routing. Never hide or rewrite its controls.
  function apply(doc = typeof document !== "undefined" ? document : null) {
    if (!doc) return { hidden: 0, redirected: false, mode: "live-social-website" };
    if (!doc.getElementById("aliaspacesLiveBanner") && doc.body) {
      const banner = doc.createElement("details"); banner.id = "aliaspacesLiveBanner";
      const summary = doc.createElement("summary"); summary.textContent = "About your shared account";
      const text = doc.createElement("p");
      text.textContent = "Website opens AliaSpaces, the social site. MyPersonas is your automation platform and owner command center. The sites share an account, but each domain and Chrome has its own sign-in session. Local records stay on this device.";
      const management = doc.createElement("a");
      management.href = ownerLanding(); management.textContent = "Open MyPersonas automation platform";
      banner.append(summary, text, management);
      banner.style.cssText = "margin:0;padding:10px 14px;background:#efe9ff;color:#3b2c73;font:600 13px/1.4 system-ui;border-bottom:1px solid #d7c8ff";
      doc.body.insertBefore(banner, doc.body.firstChild);
    }
    return { hidden: 0, redirected: false, mode: "live-social-website" };
  }
  const api = { LIVE_ORIGIN, socialLanding, ownerLanding, apply, watch: apply };
  if (typeof globalThis !== "undefined") globalThis.AliaSpacesLiveShell = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
