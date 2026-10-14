import { Link, NavLink } from 'react-router';
import { logOut } from '../api/api.js';
import { useAppDispatch, useAppSelector } from '../app/hooks.js';
import { selectSession } from '../features/auth/authSlice.js';
import { StreamBadge } from './StreamBadge.js';

export const Header = () => {
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);

  return (
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
          tenant <strong className="ink">{session?.tenantId}</strong>
        </span>
        <StreamBadge />
        <button className="link-button" type="button" onClick={() => logOut(dispatch)}>
          Log out
        </button>
      </div>
    </header>
  );
};
