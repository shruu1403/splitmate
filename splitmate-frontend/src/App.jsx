import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import RecentActivity from "./pages/RecentActivity";
import AllExpenses from "./pages/AllExpenses";
import Groups from "./pages/Groups";
import Friends from "./pages/Friends";
import AcceptInvite from "./pages/AcceptInvite";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/register" />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/recent" element={<RecentActivity />} />
        <Route path="/expenses" element={<AllExpenses />} />
        {/* <Route path="/groups" element={<Groups />} /> */}
        <Route path="/groups/:id" element={<Groups />} />
        <Route path="/friends/:id" element={<Friends />} />
      </Route>
      <Route path="/invite/accept" element={<AcceptInvite />}  />
    </Routes>
  );
}

export default App;
