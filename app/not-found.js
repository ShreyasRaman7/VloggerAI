export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', background: '#08090d', color: '#f3f4f6', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ maxWidth: 760, border: '1px solid #2f3850', borderRadius: 16, padding: 20, background: '#121521' }}>
        <h1 style={{ marginTop: 0 }}>404: Route not found</h1>
        <p>
          If you see this on Vercel for the root domain, your production deployment is likely still pinned to an old commit/branch.
        </p>
        <ol>
          <li>Open Vercel Project → <b>Settings → Git</b>.</li>
          <li>Set Production Branch to <b>main</b> (or your intended branch).</li>
          <li>Trigger a redeploy from the latest commit.</li>
        </ol>
        <p>
          Quick check: open <code>/api/health</code>. If that returns JSON, the app is deployed correctly and only the route URL is wrong.
        </p>
      </section>
    </main>
  );
}
