import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { GroupProvider } from "./context/GroupContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { SettlementProvider } from "./context/SettlementContext.jsx";
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {typeof window !== "undefined" ? (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <SettlementProvider>
            <GroupProvider>
              <App />
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 3500,
                  style: { background: "#1f2937", color: "#fff" },
                  success: { iconTheme: { primary: "#22c55e", secondary: "#1f2937" } },
                  error: { iconTheme: { primary: "#ef4444", secondary: "#1f2937" } },
                }}
              />
            </GroupProvider>
          </SettlementProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
     ) : null}
  </React.StrictMode>
);
