import React, { useContext, useState } from "react";
import styles from "../styles/navbar.module.css";
// import { LogOut } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { Menu, X } from "lucide-react";

const Navbar = ({ isSidebarOpen = false, onToggleSidebar }) => {
  const { user, logout } = useContext(AuthContext);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Close on Escape key
  React.useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowLogoutConfirm(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close user menu on outside click
  const profileRef = React.useRef(null);
  React.useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.leftGroup}>
          {/* Mobile: Sidebar toggle in navbar */}
          <button
            className={styles.navToggle}
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className={styles.brand}>
          <img
            src="/logo.png"
            alt="SplitMate logo"
            className={styles.logoImg}
            onError={(e) => {
              if (!e.currentTarget.dataset.fallback) {
                e.currentTarget.src = "/logo.svg.png";
                e.currentTarget.dataset.fallback = "1";
              }
            }}
          />
          <span className={styles.logoText}>SplitMate</span>
          </div>
        </div>

        <div className={styles.profile} ref={profileRef}>
          {user ? (
            <>
              <button
                type="button"
                className={styles.username}
                onClick={() => setShowUserMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
              >
                {user?.name}
              </button>
              <div className={`${styles.userMenu} ${showUserMenu ? styles.open : ""}`} role="menu">
                <button
                  type="button"
                  className={styles.userMenuItem}
                  role="menuitem"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                >
                  Logout
                </button>
              </div>
              <button onClick={() => setShowLogoutConfirm(true)} className={styles.logoutBtn}>
                {/* <LogOut size={16} /> */}
                <span>Logout</span>
              </button>
            </>
          ) : (
            <span className={styles.username}>Guest</span>
          )}
        </div>
      </nav>

      {showLogoutConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowLogoutConfirm(false)}>
          <div
            className={styles.modalDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setShowLogoutConfirm(false);
                logout();
              }
            }}
            tabIndex={-1}
          >
            {/* <h3 id="logout-title" className={styles.modalTitle}>Logout</h3> */}
            <p className={styles.modalText}>Are you sure you want to logout?</p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className={styles.confirmBtn}
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
