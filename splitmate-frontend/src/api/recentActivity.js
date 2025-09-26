const TESTING_URL="http://localhost:8080/api"

export const getRecentActivity=async()=>{
    const token=localStorage.getItem("token")
    const res= await fetch(`${TESTING_URL}/activity/recent-activity`,{
        method:"GET",
        headers:{
            "Content-Type":"application/json",
            Authorization: `Bearer ${token}`
        }
    })
if(!res.ok){
    throw new Error("Failed to fetch recent activity")
}
return res.json()
}

// fetch deleted expenses
export const getDeletedExpenses = async () => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/expenses/recent/deleted`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch deleted expenses");
  return res.json();
};

// restore expense
export const restoreExpense = async (id) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${TESTING_URL}/expenses/restore/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to restore expense");
  return res.json();
};
