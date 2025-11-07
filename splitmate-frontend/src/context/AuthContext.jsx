import { createContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import { logoutUser } from "../api/auth";

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
        // Expiry guard: consider token invalid if expired
        if (decoded?.exp && decoded.exp * 1000 < Date.now()) {
          console.warn("JWT expired; clearing session");
          setUser(null);
          localStorage.removeItem("token");
        } else {
          console.log("Decoded token:", decoded);
          setUser({
            _id: decoded.userID,
            name: decoded.name,
            email: decoded.email,
          });
          localStorage.setItem("token", token);
        }
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

  // 🔑 Handle pending invite after login by redirecting to AcceptInvite route
  useEffect(() => {
    if (!loading && user?._id) {
      const pendingInvite = localStorage.getItem("pendingInvite");
      if (pendingInvite) {
        // Let AcceptInvite page handle acceptance and alerts exactly once
        window.location.replace(`/invite/accept?token=${encodeURIComponent(pendingInvite)}`);
      }
    }
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
