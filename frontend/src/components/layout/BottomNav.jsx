import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Mobile Bottom Navigation Component
 * Sticky bottom nav with icons, active state animation
 * Auto-hides on desktop (768px+)
 * @param {Array} items - Navigation items [{label, icon, path}, ...]
 */
export default function BottomNav({ items = [] }) {
  return (
    <nav className="bottom-nav pb-safe">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `bottom-nav-item group ${isActive ? 'active' : ''}`
          }
        >
          {({ isActive }) => (
            <motion.div
              className="flex flex-col items-center justify-center gap-1"
              animate={isActive ? { scale: 1.1 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className={`text-xl transition-colors ${
                isActive ? 'text-green-600' : 'text-gray-600'
              }`}>
                {item.icon}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </motion.div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
