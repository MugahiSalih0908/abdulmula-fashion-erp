import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function ProtectedRoute({ children, roles = [] }) {

  const token = useAuthStore((state) => state.accessToken);
  const user  = useAuthStore((state) => state.user);

  // Not logged in
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Role protection
  if (
    roles.length > 0 &&
    user &&
    !roles.includes(user.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}