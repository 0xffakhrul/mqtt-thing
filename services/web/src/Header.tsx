import { TENANT_ID } from './api.js';

export const Header = () => (
  <header className="header">
    <div className="header-left">
      <a href="/" className="wordmark">
        mqtt-thing
      </a>
      <nav className="nav">
        <a href="/" className="nav-link nav-link-active">
          Devices
        </a>
      </nav>
    </div>
    <div className="header-right">
      <span className="muted">
        tenant <strong className="ink">{TENANT_ID}</strong>
      </span>
    </div>
  </header>
);
