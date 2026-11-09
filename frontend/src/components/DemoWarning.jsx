/** Disclose the browser-local demonstration's real trust and data limitations. */
export function DemoWarning() {
  return (
    <aside aria-label="Demo limitations" className="rounded-control border border-border px-5 py-4 text-sm leading-relaxed text-foreground-muted">
      <p>
        <strong className="font-semibold text-foreground">Demo only.</strong> Passwords are stored in plaintext in localStorage.
        {' '}The fixed Admin login is <strong className="font-semibold">admin/admin</strong>.
        {' '}Client-side guards are not security. Do not use real credentials or sensitive information.
        {' '}Accounts and stories stay in this browser; clearing browser data removes them. No cloud sync or backup is provided.
      </p>
    </aside>
  );
}
