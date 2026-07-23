import { NavLink, Outlet } from 'react-router-dom';

const links = [
  ['/', 'Feed', '☷'],
  ['/calendar', 'Calendar', '▦'],
  ['/moments/new', 'Create', '+'],
  ['/memories', 'Memories', '♡'],
  ['/profile', 'Profile', '○'],
] as const;

export function AppShell() {
  return (
    <div className="app-shell">
      <Outlet />
      <nav className="bottom-nav" aria-label="Main navigation">
        {links.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === '/'} aria-label={label} className={({ isActive }) => isActive ? 'active' : ''}>
            <span className={label === 'Create' ? 'create-icon' : ''}>{icon}</span>
            {label !== 'Create' && <small>{label}</small>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
