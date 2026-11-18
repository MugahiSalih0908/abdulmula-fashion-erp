export function filterStaff(staff, { search = '', role = 'all', status = 'all' } = {}) {
  const query = String(search || '').trim().toLowerCase();
  return (Array.isArray(staff) ? staff : []).filter(member => {
    const matchesQuery = !query || [member.name, member.email, member.role]
      .filter(Boolean).join(' ').toLowerCase().includes(query);
    const matchesRole = role === 'all' || member.role === role;
    const matchesStatus =
      status === 'all' ||
      (status === 'active' && Boolean(member.isActive)) ||
      (status === 'disabled' && !member.isActive) ||
      (status === 'pending' && !member.isVerified);
    return matchesQuery && matchesRole && matchesStatus;
  });
}

export function getStaffInitial(name) {
  return String(name || '').trim().charAt(0).toUpperCase() || 'U';
}

export function getStaffRoleTone(role) {
  if (role === 'admin') return 'danger';
  if (role === 'manager') return 'info';
  return 'primary';
}
