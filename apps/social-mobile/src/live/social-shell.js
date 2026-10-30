(() => {
  "use strict";
  const LIVE_ORIGIN = "https://mypersonas.online";
  const ownerLanding = () => `${LIVE_ORIGIN}/#/owner`;
  // Website hosts the existing owner app. Social remains a distinct client.
  function apply(doc = typeof document !== "undefined" ? document : null) {
    if (!doc) return { hidden: 0, redirected: false, mode: "live-owner-website" };
    if (!doc.getElementById("aliaspacesLiveBanner") && doc.body) {
      const banner = doc.createElement("details"); banner.id = "aliaspacesLiveBanner";
      const summary = doc.createElement("summary"); summary.textContent = "About your shared account";
      const text = doc.createElement("p");
      text.textContent = "Website opens your existing MyPersonas owner command center. Its sign-in, persona switching, drafts, approvals and other owner tools stay on the website. Social and Local are separate app modes. Google sign-in may require Chrome, which has its own session.";
      banner.append(summary, text);
      banner.style.cssText = "margin:0;padding:10px 14px;background:#efe9ff;color:#3b2c73;font:600 13px/1.4 system-ui;border-bottom:1px solid #d7c8ff";
      doc.body.insertBefore(banner, doc.body.firstChild);
    }
    return { hidden: 0, redirected: false, mode: "live-owner-website" };
  }
  const api = { LIVE_ORIGIN, ownerLanding, apply, watch: apply };
  if (typeof globalThis !== "undefined") globalThis.AliaSpacesLiveShell = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
