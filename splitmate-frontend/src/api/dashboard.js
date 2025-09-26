const TESTING_URL = "http://localhost:8080/api";

export const getOverallBalance = async () => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${TESTING_URL}/balance/overall/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`, 
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch overall balance");
  }

  return res.json();
};
