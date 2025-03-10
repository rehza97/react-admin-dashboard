import { useState, useEffect } from "react";
import { authService } from "../services/api";
import { useAuth } from "../context/AuthContext";

/**
 * Custom hook for managing DOT permissions
 * @returns {Object} DOT permissions state and utility functions
 */
export const useDOTPermissions = () => {
  const { currentUser } = useAuth();
  const [availableDots, setAvailableDots] = useState([]);
  const [userDots, setUserDots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canManageDOTs, setCanManageDOTs] = useState(false);

  useEffect(() => {
    const fetchDOTData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch available DOTs
        const dotsResponse = await authService.getAvailableDOTs();
        setAvailableDots(dotsResponse);

        // Check if user can manage DOTs (admin or superuser)
        if (currentUser) {
          setCanManageDOTs(currentUser.is_staff || currentUser.is_superuser);

          // Get user's authorized DOTs
          if (currentUser.authorized_dots) {
            setUserDots(currentUser.authorized_dots);
          }
        }
      } catch (err) {
        console.error("Error fetching DOT permissions:", err);
        setError("Failed to fetch DOT permissions");
      } finally {
        setLoading(false);
      }
    };

    fetchDOTData();
  }, [currentUser]);

  /**
   * Check if user has permission for a specific DOT
   * @param {string} dotCode - DOT code to check
   * @returns {boolean} Whether user has permission
   */
  const hasDOTPermission = (dotCode) => {
    // Admins have access to all DOTs
    if (canManageDOTs) return true;

    // Check if user has access to the specific DOT
    return userDots.includes(dotCode);
  };

  /**
   * Filter a list of DOTs based on user permissions
   * @param {Array} dots - List of DOT objects
   * @returns {Array} Filtered list of DOTs
   */
  const filterDOTsByPermission = (dots) => {
    if (canManageDOTs) return dots;

    return dots.filter((dot) => userDots.includes(dot.code));
  };

  return {
    availableDots,
    userDots,
    loading,
    error,
    canManageDOTs,
    hasDOTPermission,
    filterDOTsByPermission,
  };
};

export default useDOTPermissions;
