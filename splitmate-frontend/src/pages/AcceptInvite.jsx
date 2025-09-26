import React, { useEffect, useContext } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { acceptInvite } from "../api/invite";
import { AuthContext } from "../context/AuthContext";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useContext(AuthContext);

  useEffect(() => {
    console.log("🔄 useEffect triggered, loading:", loading, "user:", user);

    if (loading) return;

    const token = searchParams.get("token");
    console.log("🎯 Token from URL:", token); // <-- LOG HERE

    if (!token) {
      console.warn("⚠️ No token in URL, redirecting to dashboard");
      navigate("/dashboard");
      return;
    }

    if (!user?._id) {
      console.log("👤 No user logged in, saving pending invite:", token);
      localStorage.setItem("pendingInvite", token);
      navigate("/login");
      return;
    }

  // ✅ If user is logged in, accept immediately
    const handleAccept = async () => {
      try {
        await acceptInvite({ token });
        localStorage.removeItem("pendingInvite");
        alert("Invite accepted successfully!");
           if (res.groupId) {
      navigate(`/groups/${res.groupId}`);   // ✅ direct to that group
    } else {
      navigate("/friends");                 // ✅ show friend list
    }
  
      } catch (err) {
        console.error("❌ Error in accept:", err);
        localStorage.removeItem("pendingInvite");
        alert("Error accepting invite");
        navigate("/dashboard");
      }
    };

    handleAccept();
  }, [searchParams, user, navigate, loading]);

  return <p>Processing invite...</p>;
}
