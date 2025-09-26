import React, { useContext, useState } from "react";
import styles from "../styles/Navbar.module.css";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.logo}>SplitMate</div>

        <div className={styles.profile}>
          {user ? (
            <>
              <span className={styles.username}>{user?.name}</span>
              <button onClick={logout} className={styles.logoutBtn}>
                Logout
              </button>
            </>
          ) : (
            <span className={styles.username}>Guest</span>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
