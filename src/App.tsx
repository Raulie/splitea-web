import { lazy } from "solid-js";
import { Router, Route } from "@solidjs/router";
import { ItemsView } from "./views/ItemsView";
import { NotFound } from "./views/NotFound";
import { LANDING_SEGMENTS } from "./lib/landingPaths";

const loadLanding = () => import("./views/landing/Landing");
const Landing = lazy(loadLanding);

export const preloadLanding = (seg?: string) =>
  Landing.preload()
    .then(() => loadLanding())
    .then((m) => m.loadLandingCopy(seg));

/// Top-level routing.
///
/// Web is intentionally **read-only** — it exists so a
/// recipient of a share link can see their split without
/// installing anything. Everything else (profile management,
/// avatar upload, payment-username editing, contact directory
/// lookups) lives in the iOS app. Visitors landing on any
/// non-share path get the "download Splitea" CTA via NotFound.
///
///   - `/r/<shareID>` — the share-receipt landing page. Drives
///     the SPA-internal push to SavedReceiptView with the
///     OnsenUI-style iOS slide.
///   - `/r/<shareID>/c/<contactShortId>` — same view, but
///     scoped to a single recipient. The sender's per-contact
///     Request link uses this form; ItemsView resolves
///     `contactShortId` against `snapshot.contacts[].shortId`
///     to pick the visitor identity. The legacy
///     `?for=<contactUUID>` query form still works through the
///     bare route — keeps in-flight share links alive during
///     the rollout window.
///   - everything else → NotFound (App Store nudge).
function App() {
  return (
    <Router>
      <Route path="/" component={Landing} />
      <Route path="/:lang" matchFilters={{ lang: LANDING_SEGMENTS }} component={Landing} />
      <Route path="/r/:shareID" component={ItemsView} />
      <Route path="/r/:shareID/c/:contactShortId" component={ItemsView} />
      <Route path="*" component={NotFound} />
    </Router>
  );
}

export default App;
