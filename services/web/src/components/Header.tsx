import { Link, NavLink } from 'react-router';
import { TENANT_ID } from '../api/api.js';
import { StreamBadge } from './StreamBadge.js';

export const Header = () => (
  <header className="header">
    <div className="header-left">
      <Link to="/" className="wordmark">
        mqtt-thing
      </Link>
      <nav className="nav">
        <NavLink
          to="/"
          end={false}
          className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
        >
          Devices
        </NavLink>
      </nav>
    </div>
    <div className="header-right">
      <span className="muted tenant">
        tenant <strong className="ink">{TENANT_ID}</strong>
      </span>
      <StreamBadge />
    </div>
  </header>
);
