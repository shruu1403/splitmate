import { TESTING_URL } from "../Apilinks";


export const getOverallBalance = async () => {
  const token = localStorage.getItem("token");

  // Decode current user from token
  const payload = JSON.parse(atob(token.split(".")[1]));
  const currentUserId = payload.userID;

  // Get group balances (backend already handles group settlements correctly)
  const groupBalanceRes = await fetch(`${TESTING_URL}/balance/overall/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!groupBalanceRes.ok) {
    throw new Error("Failed to fetch group balance");
  }

  const groupBalance = await groupBalanceRes.json();

  // Get friends list
  const friendsRes = await fetch(`${TESTING_URL}/friend`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!friendsRes.ok) {
    throw new Error("Failed to fetch friends");
  }

  const friends = await friendsRes.json();

  // Calculate friend balances with settlement awareness
  let friendsOverall = 0;
  let friendsYouOwe = 0;
  let friendsYouAreOwed = 0;
  const friendsBreakdown = [];

  for (const friend of friends) {
    // Fetch friend details (expenses)
    const friendDetailRes = await fetch(`${TESTING_URL}/friend/${friend._id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (friendDetailRes.ok) {
      const friendDetail = await friendDetailRes.json();
      const allExpenses = friendDetail.friend.expenses || [];

      // Separate settlements from regular expenses
      const settlements = allExpenses.filter(exp =>
        exp.type === 'settlement' ||
        exp.description?.toLowerCase().includes('settlement')
      );

      const regularExpenses = allExpenses.filter(exp =>
        exp.type !== 'settlement' &&
        !exp.description?.toLowerCase().includes('settlement') &&
        !exp.isDeleted
      );

      // Helper: Check if expense is settled
      const isExpenseSettled = (expense) => {
        if (settlements.length === 0) return false;

        const expenseTimestamp = new Date(expense.createdAt || expense.date).getTime();

        // Check if there's any settlement after this expense
        return settlements.some(settlement => {
          const settlementTimestamp = new Date(settlement.createdAt || settlement.date).getTime();
          return settlementTimestamp > expenseTimestamp;
        });
      };

      // Calculate balance from UNSETTLED expenses only
      let balance = 0;

      regularExpenses.forEach((expense) => {
        // Skip settled expenses
        if (isExpenseSettled(expense)) return;

        const paidById = typeof expense.paidBy === "object" ? expense.paidBy._id : expense.paidBy;

        const myShare = expense.splitAmong?.find((s) => {
          const userId = typeof s.user === "object" ? s.user._id : s.user;
          return String(userId) === String(currentUserId);
        });

        if (!myShare) return;

        if (String(paidById) === String(currentUserId)) {
          // I paid => friend owes me (POSITIVE balance - they owe me)
          const friendShare = expense.splitAmong?.find((s) => {
            const userId = typeof s.user === "object" ? s.user._id : s.user;
            return String(userId) === String(friend._id);
          });
          if (friendShare) {
            balance += Number(friendShare.share || friendShare.amount || 0);
          }
        } else {
          // Friend paid => I owe them (NEGATIVE balance - I owe them)
          balance -= Number(myShare.share || myShare.amount || 0);
        }
      });

      // Round to 2 decimals
      balance = Math.round(balance * 100) / 100;

      if (Math.abs(balance) > 0.01) {
        friendsOverall += balance;

        if (balance < 0) {
          friendsYouOwe += Math.abs(balance);
        } else {
          friendsYouAreOwed += balance;
        }

        friendsBreakdown.push({
          userId: friend._id,
          name: friend.name,
          amount: balance,
          type: 'friend'
        });
      }
    }
  }

  // Safe defaults for group totals/breakdown
  const groupOverall = typeof groupBalance.overallBalance === 'number' ? groupBalance.overallBalance : 0;
  const groupYouOwe = typeof groupBalance.youOwe === 'number' ? groupBalance.youOwe : 0;
  const groupYouAreOwed = typeof groupBalance.youAreOwed === 'number' ? groupBalance.youAreOwed : 0;
  const groupBreakdown = Array.isArray(groupBalance.breakdown) ? groupBalance.breakdown : [];

  // Helper to fix negative zero for nicer UI
  const fixNegZero = (n) => (Object.is(n, -0) ? 0 : n);

  // Combine group and friend balances
  let overallBalance = groupOverall + friendsOverall;
  let youOwe = groupYouOwe + friendsYouOwe;
  let youAreOwed = groupYouAreOwed + friendsYouAreOwed;

  // Round to 2 decimals
  overallBalance = Math.round(overallBalance * 100) / 100;
  youOwe = Math.round(youOwe * 100) / 100;
  youAreOwed = Math.round(youAreOwed * 100) / 100;

  // Apply -0 cleanup
  overallBalance = fixNegZero(overallBalance);
  youOwe = fixNegZero(youOwe);
  youAreOwed = fixNegZero(youAreOwed);

  overallBalance = parseFloat(overallBalance.toFixed(2));
  youOwe = parseFloat(youOwe.toFixed(2));
  youAreOwed = parseFloat(youAreOwed.toFixed(2));

  return {
    overallBalance,
    youOwe,
    youAreOwed,
    breakdown: [
      // Convert group data to match expected format
      ...groupBreakdown
        .filter(item => Math.abs(item.myBalance) > 0.01) // Changed from 0.05 to 0.01
        .map(item => ({
          userId: item.groupId,
          name: item.groupName,
          amount: parseFloat((Math.round(item.myBalance * 100) / 100).toFixed(2)), // Ensure exact 2 decimals
          type: 'group'
        })),
      ...friendsBreakdown.map(item => ({
        ...item,
        amount: parseFloat((Math.round(item.amount * 100) / 100).toFixed(2)) // Ensure exact 2 decimals
      }))
    ]
  };
};
