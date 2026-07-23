import { NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from './ui/Icon';

const links = [
  ['/', 'Feed', 'feed'],
  ['/calendar', 'Calendar', 'calendar'],
  ['/moments/new', 'Create', 'plus'],
  ['/memories', 'Memories', 'heart'],
  ['/profile', 'Profile', 'user'],
] as const;

export function AppShell() {
  return (
    <div className="app-shell">
      <Outlet />
      <nav className="bottom-nav" aria-label="Main navigation">
        {links.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === '/'} aria-label={label} className={({ isActive }) => isActive ? 'active' : ''}>
            {({ isActive }) => label === 'Create'
              ? <span className="create-icon"><Icon name={icon as IconName} size={20} strokeWidth={2.5} /></span>
              : isActive
                ? <span className="nav-pill"><Icon name={icon as IconName} size={22} /><small>{label}</small></span>
                : <Icon name={icon as IconName} size={26} />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
