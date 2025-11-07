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
    // Stop this code from ever running during Vercel SSR
    if (typeof window === "undefined") return;

    console.log("🔄 useEffect triggered, loading:", loading, "user:", user);

    if (loading) return;

    const token = searchParams.get("token");
    console.log("🎯 Token from URL:", token);

    if (!token) {
      navigate("/dashboard");
      return;
    }

    if (!user?._id) {
      window.localStorage.setItem("pendingInvite", token);
      navigate("/login");
      return;
    }

    const handleAccept = async () => {
      if (hasRun.current) return;
      hasRun.current = true;

      try {
        abortRef.current = new AbortController();
        const res = await acceptInvite({ token, signal: abortRef.current.signal });

        window.localStorage.removeItem("pendingInvite");

        if (res && (res.groupId || res.msg)) {
          toast.success(
            res.groupId
              ? "Invite accepted! You’ve joined the group."
              : "Invite accepted! You’re now connected."
          );

          if (res.groupId) {
            navigate(`/groups/${res.groupId}`);
          } else {
            navigate("/dashboard");
          }
        } else {
          throw new Error("Unexpected response");
        }

      } catch (err) {
        window.localStorage.removeItem("pendingInvite");

        const msg = (err?.message || "").toLowerCase();
        const benign =
          err?.name === "AbortError" ||
          msg.includes("failed to fetch") ||
          msg.includes("network") ||
          msg.includes("load failed");

        if (!benign) {
          // Use toast instead of alert, which is not SSR-safe
          toast.error(err?.message || "Error accepting invite");
        }

        navigate("/dashboard");
      }
    };

    handleAccept();

    return () => {
      hasRun.current = hasRun.current;
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch { }
      }
    };
  }, [searchParams, user, navigate, loading]);


  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
      <ClipLoader size={24} color="#062c65ff" />
    </div>
  );
}
