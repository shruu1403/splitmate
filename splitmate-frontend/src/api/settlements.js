import { TESTING_URL } from "../Apilinks";


export const recordSettlement = async (settlementData) => {
  const token = localStorage.getItem("token");

  console.log("recordSettlement called with:", settlementData);

  const res = await fetch(`${TESTING_URL}/settlement/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      groupId: settlementData.groupId,
      participants: settlementData.participants, // Add participants for direct friend settlements
      from: settlementData.from,
      to: settlementData.to,
      amount: settlementData.amount,
      method: settlementData.method || "cash",
      externalProvider: settlementData.externalProvider || null,
      transactionId: settlementData.transactionId || null
    }),
  });

  const data = await res.json();
  console.log("Settlement API response:", { status: res.status, data });

  if (!res.ok) {
    throw new Error(data.msg || data.error || "Failed to record settlement");
  }

  return data;
};


// Get all settlements for a group OR between two friends
export const getGroupSettlements = async (groupId, participants = null) => {
  const token = localStorage.getItem("token");
  
  // If participants array is provided, fetch friend settlements
  if (!groupId && participants && participants.length === 2) {
    const res = await fetch(`${TESTING_URL}/settlement/friends?user1=${participants[0]}&user2=${participants[1]}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to fetch friend settlements");
    }
    
    return res.json();
  }
  
  // Otherwise, fetch group settlements
  const res = await fetch(`${TESTING_URL}/settlement/group/${groupId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch group settlements");
  }
  
  return res.json();
};

// Get settlements involving a user
export const getUserSettlements = async (userId) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/settlement/user/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch user settlements");
  }
  
  return res.json();
};

// Update settlement status
export const updateSettlementStatus = async (settlementId, statusData) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/settlement/${settlementId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(statusData),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.msg || "Failed to update settlement");
  }
  
  return res.json();
};