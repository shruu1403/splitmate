import React from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import styles from "../styles/layout.module.css";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <div className={styles.layout}>
      <Navbar />
      <div className={styles.main}>
        <Sidebar />
        <div className={styles.content}>
          <Outlet />   {/* ✅ where child routes will render */}
        </div>
      </div>
    </div>
  );
};

export default Layout;
