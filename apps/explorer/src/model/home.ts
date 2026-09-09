/**
 * The way back out, for a page that is the whole window.
 *
 * The Explorer's own model is a site of one page: a visitor arrives at it and the browser
 * is the only way anywhere else. Mounted inside a tenant it is not — a member reaches it
 * from a hub of links and expects to get back to that hub, and a full-page app with no
 * link out makes the Back button the only exit.
 *
 * Where that hub is does not need configuring, because the mount already says. The bundle
 * is built with `VITE_BASE` naming the path it is served under, and the router that serves
 * it refuses to work unless the two agree (`app/lawfare/api/explorer.py` in the tenant).
 * So the page's own base is a fact about where it sits, and the parent of that path is the
 * page it was linked from. `VITE_HOME_URL` overrides it for a mount that is shaped
 * differently.
 */

/**
 * The path one segment above `base`, or `''` when there is nothing above it.
 *
 * `'/ragtime/explorer/'` → `'/ragtime'`, which is the tenant's RAGtime window.
 * `'/explorer/'` → `'/'`. `'/'` → `''`: the app is the site, and there is no out.
 */
export function parentPath(base: string): string {
  const trimmed = (base || '/').replace(/\/+$/, '')
  if (!trimmed) return ''
  const cut = trimmed.slice(0, trimmed.lastIndexOf('/'))
  return cut || '/'
}
