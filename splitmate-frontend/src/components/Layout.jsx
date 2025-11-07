import React from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import styles from "../styles/layout.module.css";
import { Outlet } from "react-router-dom";

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  return (
    <div className={styles.layout}>
      <Navbar
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div className={styles.main}>
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <div className={styles.content}>
          <Outlet />   {/* ✅ where child routes will render */}
        </div>
      </div>
    </div>
  );
};

export default Layout;
