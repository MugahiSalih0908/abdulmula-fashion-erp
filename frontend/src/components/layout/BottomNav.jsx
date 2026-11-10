import { NavLink } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';

export default function BottomNav({
  items = [],
  onMoreClick,
  isMoreActive = false,
  isMoreOpen = false,
}) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          end
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          aria-label={item.label}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className={`bottom-nav-item${isMoreActive ? ' active' : ''}`}
        onClick={onMoreClick}
        aria-label="More navigation"
        aria-haspopup="dialog"
        aria-expanded={isMoreOpen}
      >
        <MoreHorizontal size={20} strokeWidth={1.8} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}
