import { TESTING_URL } from "../Apilinks";


export const addExpense = async (payload) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${TESTING_URL}/expenses/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid server response");
    }
  }
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || `Request failed (${response.status})`);
  }
  return data;
};
export const getAllExpenses = async (groupId) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/expenses/group/${groupId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error("failed to fetch all expenses");
  }
  return res.json();
};

// Get all expenses for the logged-in user (from all groups and direct expenses)
export const getAllUserExpenses = async () => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/expenses/all-expenses`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error("failed to fetch user expenses");
  }
  return res.json();
};
export const getExpense = async (id) => {
  const token = localStorage.getItem("token");
  const exp = await fetch(`${TESTING_URL}/expenses/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!exp.ok) {
    throw new Error("Failed to fetch expense");
  }
  return exp.json();
};
export const deleteExpense = async (id) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/expenses/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if(!res.ok){
    throw new Error("Failed to delete expense")
  }
  return res.json()
};
