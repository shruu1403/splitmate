import { TESTING_URL } from "../Apilinks";


export const registerUser = async (userData) => {
  const res = await fetch(`${TESTING_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  return res.json();
};
export const loginUser = async (userData) => {
  const res = await fetch(`${TESTING_URL}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  return res.json();
};

export const logoutUser = async () => {
  if (typeof window === "undefined") return { msg: "No token found" };

  const token = window.localStorage.getItem("token");
  if (!token) return { msg: "No token found" };

  try {
    const res = await fetch(`${TESTING_URL}/users/logout`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to logout");
    }

    return res.json();
  } catch (error) {
    return { msg: error.message };
  }
};

