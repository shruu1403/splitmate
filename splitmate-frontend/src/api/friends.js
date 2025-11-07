// const TESTING_URL = "http://localhost:8080/api";
const TESTING_URL = "https://splitmate-32de.onrender.com/api";


export const getAllFriends = async (search = "") => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${TESTING_URL}/friend?search=${search}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch friends");
  }

  return res.json(); // → [ { _id, name, email }, ... ]
};

// 🔹 Get single friend details (for main Friends page)
export const getFriendDetails = async (friendId) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${TESTING_URL}/friend/${friendId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch friend details");
  }

  return res.json(); 
  // → { friend: { _id, name, email, expenses: [], balance, groups:[] } }
};

// 🔹 Delete a friend
export const deleteFriend = async (friendId) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${TESTING_URL}/friend/${friendId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.msg || "Failed to delete friend");
  }
  return data;
};