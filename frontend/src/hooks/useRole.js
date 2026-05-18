// src/hooks/useRole.js – role-based permission helpers

import useAuthStore from '../store/authStore';

export const useRole = () => {
  const user = useAuthStore(s => s.user);
  const role = user?.role || 'staff';

  return {
    role,
    isAdmin:   role === 'admin',
    isManager: role === 'admin' || role === 'manager',
    isStaff:   role === 'staff',

    // Fine-grained permission checks
    can: {
      viewProducts:    true,
      editProducts:    role !== 'staff',
      deleteProducts:  role !== 'staff',

      viewExpenses:    role !== 'staff',
      manageExpenses:  role !== 'staff',

      viewSuppliers:   role !== 'staff',
      manageSuppliers: role !== 'staff',

      viewPOs:         role !== 'staff',
      createPOs:       role !== 'staff',
      editDeletePOs:   role === 'admin',
      receivePOs:      role !== 'staff',

      viewCashbook:    role !== 'staff',
      closeCashbook:   role !== 'staff',
      approveCashbook: role === 'admin',

      viewReports:     role !== 'staff',

      manageStaff:     role === 'admin',
      viewAuditLogs:   role === 'admin',

      editAllSettings: role !== 'staff',
      ownSettingsOnly: true,       // always true — everyone can edit own profile
    }
  };
};
