import { createContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import { logoutUser } from "../api/auth";
import { acceptInvite } from "../api/invite";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Decode token whenever it changes
  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        console.log("Decoded token:", jwtDecode(token));

        setUser({
          _id: decoded.userID,
          name: decoded.name,
          email: decoded.email,
        });
        localStorage.setItem("token", token);
      } catch (err) {
        console.error("Invalid token:", err);
        setUser(null);
        localStorage.removeItem("token");
      }
    } else {
      setUser(null);
      localStorage.removeItem("token");
    }
    setLoading(false);
  }, [token]);

  // 🔑 NEW: Check for pending invite after login
  // 🔑 Handle pending invite after login
  useEffect(() => {
    const handlePendingInvite = async () => {
      if (!loading && user?._id) {
        const pendingInvite = localStorage.getItem("pendingInvite");
        if (pendingInvite) {
          try {
            console.log(
              "🔄 Resuming pending invite acceptance:",
              pendingInvite
            );
            await acceptInvite({ token: pendingInvite });
            alert("Invite accepted successfully!");
            localStorage.removeItem("pendingInvite");
            if (res.groupId) {
              window.location.href = `/groups/${res.groupId}`;
            } else {
              window.location.href = "/friends";
            }
          } catch (err) {
            console.error("❌ Error resuming invite:", err);
            localStorage.removeItem("pendingInvite");
            alert("Error accepting invite");
            window.location.href = "/dashboard";
          }
        }
      }
    };

    handlePendingInvite();
  }, [user, loading]);

  const login = (newToken) => {
    setLoading(true);
    setToken(newToken);
  };

  const logout = async () => {
    try {
      await logoutUser(); // optional: call backend logout
    } catch (err) {
      console.error("Logout API failed:", err);
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
