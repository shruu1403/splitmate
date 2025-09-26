const TESTING_URL = "http://localhost:8080/api";

// Send Invite (Friend or Group)
export const sendInvite = async ({ email, groupId }) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/invite/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email, groupId }),
  });

  if (!res.ok) throw new Error("Failed to send invite");
  return res.json();
};

// Generate Magic Link (Group only)
export const generateInviteLink = async (groupId) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/invite/generate-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ groupId }),
  });

  if (!res.ok) throw new Error("Failed to generate link");
  return res.json();
};

// Accept Invite
export const acceptInvite = async ({ token }) => {
  console.log("📡 acceptInvite() called with token:", token);  // <-- LOG HERE
const authToken = localStorage.getItem("token");
  try {
    const res = await fetch(`${TESTING_URL}/invite/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    console.log("📡 Backend raw response:", data);  // <-- LOG HERE

    if (!res.ok) throw new Error(data.msg || "Failed to accept invite");
    return data;
  } catch (err) {
    console.error("❌ Backend error:", err);
    throw err;
  }
};

