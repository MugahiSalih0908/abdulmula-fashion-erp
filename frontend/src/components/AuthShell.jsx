import './authShell.css';

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  wide = false,
  status
}) {
  return (
    <div className="auth-shell">
      <div className="auth-shell-glow auth-shell-glow-one" aria-hidden="true" />
      <div className="auth-shell-glow auth-shell-glow-two" aria-hidden="true" />
      <div className="auth-shell-inner">
        <header className="auth-brand">
          <div className="auth-brand-mark" aria-hidden="true">AF</div>
          <div className="auth-brand-copy">
            <span>Abdulmula Fashion</span>
            <small>ENTERPRISE WORKSPACE</small>
          </div>
          <span className="auth-brand-secure">SECURE ACCESS</span>
        </header>

        <main className={'auth-panel' + (wide ? ' auth-panel-wide' : '')}>
          <div className="auth-panel-heading">
            {eyebrow && <p className="auth-eyebrow">{eyebrow}</p>}
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {status && <div className="auth-status" role="status" aria-live="polite">{status}</div>}
          {children}
          {footer && <footer className="auth-panel-footer">{footer}</footer>}
        </main>

        <footer className="auth-shell-footer">
          <span>Abdulmula Fashion ERP</span>
          <span>·</span>
          <span>Konyo-Konyo Market, Juba</span>
        </footer>
      </div>
    </div>
  );
}
