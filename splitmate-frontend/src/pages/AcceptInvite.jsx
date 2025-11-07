import { useEffect, useContext, useRef } from "react";
import ClipLoader from "react-spinners/ClipLoader";
import { useSearchParams, useNavigate } from "react-router-dom";
import { acceptInvite } from "../api/invite";
import { toast } from "react-hot-toast";
import { AuthContext } from "../context/AuthContext";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useContext(AuthContext);

  const hasRun = useRef(false);
  const abortRef = useRef(null);

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
      if (hasRun.current) return;
      hasRun.current = true;
      try {
        // Create a controller so navigation/unmount cancels the request cleanly
        abortRef.current = new AbortController();
        const res = await acceptInvite({ token, signal: abortRef.current.signal });
        localStorage.removeItem("pendingInvite");
        if (res && (res.groupId || res.msg)) {
          // Pretty success toaster
          toast.success(
            res.groupId
              ? "Invite accepted! You’ve joined the group."
              : "Invite accepted! You’re now connected.",
            { id: "invite-accepted" }
          );
          if (res.groupId) {
            navigate(`/groups/${res.groupId}`);
          } else {
            // No specific friend route exists at "/friends"; redirect to dashboard
            navigate("/dashboard");
          }
        } else {
          throw new Error("Unexpected response");
        }
      } catch (err) {
        console.error("❌ Error in accept:", err);
        localStorage.removeItem("pendingInvite");
        // Ignore benign cases (navigation abort, unauthenticated first hit, or browser "Failed to fetch")
        const msg = (err?.message || "").toLowerCase();
        const isBenignAbort = err?.name === "AbortError" ||
                              err?.code === "NO_AUTH" ||
                              err?.code === "ABORTED_OR_NETWORK" ||
                              err?.name === "TypeError" && msg.includes("failed to fetch") ||
                              msg.includes("networkerror") ||
                              msg.includes("load failed");
        if (isBenignAbort) {
          return;
        }
        alert(err?.message || "Error accepting invite");
        navigate("/dashboard");
      }
    };

    handleAccept();
    // Cleanup to ensure single run in StrictMode
    return () => {
      hasRun.current = hasRun.current;
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
    };
  }, [searchParams, user, navigate, loading]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
      <ClipLoader size={24} color="#062c65ff" />
    </div>
  );
}
