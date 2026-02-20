import { TESTING_URL } from "../Apilinks";


export const createGroups = async (groupdetails) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/groups/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(groupdetails),
  });
  if (!res.ok) {
    throw new Error("Failed to create groups");
  }
  return res.json();
};

export const getAllGroups = async () => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/groups/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch groups");
  }
  const data = await res.json();
  // Always return a consistent shape
  return { groups: data.groups || [] };
};

export const getSingleGroup = async (id) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/groups/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch groups");
  }
  return res.json();
};

export const deleteGroup = async (groupId) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/groups/${groupId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.msg || "Failed to delete group");
  }
  return res.json();
};
