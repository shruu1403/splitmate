// const TESTING_URL = "http://localhost:8080/api";
const TESTING_URL = "https://splitmate-32de.onrender.com/api";


// Send Invite (Friend or Group)
export const sendInvite = async ({ email, groupId, alsoAddToFriends }) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/invite/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email, groupId, alsoAddToFriends }),
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

  const data = await res.json();
  if (!res.ok) {
    console.error("❌ API Error:", data);
    throw new Error(data.msg || data.error || "Failed to generate link");
  }
  return data;
};

// Accept Invite
// Accepts an optional AbortSignal to cancel the request on navigation/unmount
export const acceptInvite = async ({ token, signal } = {}) => {
  console.log("📡 acceptInvite() called with token:", token);
  const authToken = localStorage.getItem("token");

  // If there's no auth token, do not even attempt a network call
  if (!authToken) {
    const err = new Error("Not authenticated");
    err.code = "NO_AUTH";
    throw err;
  }

  try {
    const res = await fetch(`${TESTING_URL}/invite/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
      signal,
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { msg: text || "Invalid response" };
    }
    console.log("📡 Backend raw response:", data);

    if (!res.ok) {
      const err = new Error(data.msg || "Failed to accept invite");
      err.response = data;
      throw err;
    }
    return data;
  } catch (err) {
    console.error("❌ Backend error:", err);
    throw err;
  }
};

