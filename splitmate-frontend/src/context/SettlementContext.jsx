import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { recordSettlement, getGroupSettlements } from "../api/settlements";
import { useSocket } from "./SocketContext";

const SettlementContext = createContext();

export const useSettlement = () => {
  const context = useContext(SettlementContext);
  if (!context) {
    throw new Error("useSettlement must be used within a SettlementProvider");
  }
  return context;
};

export const SettlementProvider = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [recentSettlements, setRecentSettlements] = useState([]);
  const [groupSettlementsCache, setGroupSettlementsCache] = useState({}); // Cache settlements by groupId
  const { socket } = useSocket();

  // Trigger a refresh across all components
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    console.log("🔄 Settlement refresh triggered globally");
  }, []);

  // Load settlements for a specific group
  const loadGroupSettlements = useCallback(async (groupId) => {
    if (!groupId) return [];
    
    try {
      console.log(`📥 Loading settlements for group: ${groupId}`);
      const response = await getGroupSettlements(groupId);
      const settlements = response.settlements || [];
      
      // Cache the settlements
      setGroupSettlementsCache(prev => ({
        ...prev,
        [groupId]: settlements
      }));
      
      console.log(`✅ Loaded ${settlements.length} settlements for group ${groupId}`);
      return settlements;
    } catch (error) {
      console.error(`❌ Failed to load settlements for group ${groupId}:`, error);
      return [];
    }
  }, []);

  // Record a settlement (can be called from anywhere)
  const handleSettlement = useCallback(async (settlementPayload) => {
    try {
      if (!settlementPayload) {
        throw new Error("No settlement data provided");
      }

      // Format settlement data for API
      const apiPayload = {
        groupId: settlementPayload.groupId || null, // null for direct friend settlements
        participants: settlementPayload.participants, // for direct friend settlements
        from: settlementPayload.from || settlementPayload.fromUser?._id || settlementPayload.fromUser,
        to: settlementPayload.to || settlementPayload.toUser?._id || settlementPayload.toUser,
        amount: settlementPayload.amount,
        method: settlementPayload.method || "cash",
        type: "settlement",
      };

      console.log("💰 Recording settlement:", apiPayload);

      // Call API to record settlement
      const result = await recordSettlement(apiPayload);
      console.log("✅ Settlement recorded successfully:", result);

      // Add to recent settlements for quick access
      setRecentSettlements(prev => [{
        ...result,
        timestamp: new Date(),
      }, ...prev.slice(0, 9)]); // Keep last 10

      // Trigger refresh across all components
      triggerRefresh();

      return { success: true, data: result };
    } catch (error) {
      console.error("❌ Settlement failed:", error);
      
      let errorMsg = "Settlement failed: ";
      if (error.message) {
        errorMsg += error.message;
      } else if (error.msg) {
        errorMsg += error.msg;
      } else {
        errorMsg += "Unknown error";
      }

      return { success: false, error: errorMsg };
    }
  }, [triggerRefresh]);

  // Listen for real-time settlement updates via Socket.io
 useEffect(() => {
  if (typeof window === "undefined") return; // ✅ Prevent SSR issues
  if (!socket) return;

  const handleSettlementRecorded = (data) => {
    console.log("🔔 Real-time settlement received:", data);

    setRecentSettlements(prev => [{
      ...data,
      timestamp: new Date(),
    }, ...prev.slice(0, 9)]);

    triggerRefresh();
  };

  socket.on("settlement_recorded", handleSettlementRecorded);

  return () => {
    socket.off("settlement_recorded", handleSettlementRecorded);
  };
}, [socket, triggerRefresh]);

  /**
   * Check if a specific expense has been settled
   * This checks if there's a settlement that occurred after this expense
   * indicating that the debts from this expense have been settled
   * @param {string} expenseId - The expense ID to check
   * @param {string} groupId - The group ID
   * @param {Date} expenseDate - The date of the expense
   * @returns {boolean} True if expense is settled, false otherwise
   */
  const isExpenseSettled = useCallback((expenseId, groupId = null, expenseDate = null) => {
    if (!groupId || !expenseDate) return false;

    // Get settlements from cache
    let relevantSettlements = groupSettlementsCache[groupId] || [];
    
    // If no cached settlements, check recent settlements
    if (relevantSettlements.length === 0 && Array.isArray(recentSettlements)) {
      relevantSettlements = recentSettlements.filter(s => {
        const settlementGroupId = s.groupId?._id || s.groupId;
        return settlementGroupId === groupId;
      });
    }

    console.log(`🔍 Checking expense ${expenseId} in group ${groupId}:`, {
      cachedSettlements: groupSettlementsCache[groupId]?.length || 0,
      recentSettlements: recentSettlements.length,
      relevantSettlements: relevantSettlements.length,
      expenseDate
    });

    if (relevantSettlements.length === 0) {
      console.log(`❌ No settlements found for group ${groupId}`);
      return false;
    }

    // Check if any settlement happened AFTER this expense
    // This means the expense was included in a settlement
    const expenseDateObj = new Date(expenseDate);
    
    // Find the latest settlement that happened after this expense
    const settlementsAfterExpense = relevantSettlements.filter(s => {
      const settlementDate = new Date(s.date || s.createdAt || s.timestamp);
      return settlementDate > expenseDateObj;
    });

    if (settlementsAfterExpense.length > 0) {
      console.log(`✅ Found ${settlementsAfterExpense.length} settlement(s) after this expense`);
      return true;
    }

    console.log(`❌ No settlements found after expense date`);
    return false;
  }, [recentSettlements, groupSettlementsCache]);

  /**
   * Get settlement summary for a user in a group
   * @param {string} userId - User ID
   * @param {string} groupId - Group ID
   * @param {Array} expenses - All expenses
   * @param {Array} settlements - All settlements
   * @returns {Object} Settlement summary
   */
  const getSettlementSummary = useCallback((userId, groupId, expenses, settlements) => {
    if (!userId || !groupId) return null;

    // Filter expenses and settlements for this group
    const groupExpenses = expenses.filter(e => e.groupId === groupId);
    const groupSettlements = settlements.filter(s => s.groupId === groupId);

    // Calculate balance including settlements
    let balance = 0;
    
    // Add up expense obligations
    groupExpenses.forEach(expense => {
      const userSplit = expense.splitAmong?.find(s => 
        (s.user._id || s.user) === userId
      );
      
      if (userSplit) {
        const paidById = expense.paidBy._id || expense.paidBy;
        if (paidById === userId) {
          // User paid, others owe them
          balance += expense.amount - (userSplit.share || userSplit.amount || 0);
        } else {
          // Someone else paid, user owes them
          balance -= (userSplit.share || userSplit.amount || 0);
        }
      }
    });

    // Subtract settlements made
    groupSettlements.forEach(settlement => {
      const fromId = settlement.paidBy._id || settlement.paidBy;
      const toId = settlement.splitAmong?.[0]?.user._id || settlement.splitAmong?.[0]?.user;
      
      if (fromId === userId) {
        // User paid in settlement, reduces their debt
        balance += Number(settlement.amount || 0);
      } else if (toId === userId) {
        // Someone paid user in settlement
        balance -= Number(settlement.amount || 0);
      }
    });

    return {
      balance: Math.round(balance * 100) / 100,
      totalSettled: groupSettlements.reduce((sum, s) => {
        const fromId = s.paidBy._id || s.paidBy;
        if (fromId === userId) return sum + Number(s.amount || 0);
        return sum;
      }, 0),
      settlementCount: groupSettlements.length,
      lastSettlement: groupSettlements.length > 0 ? 
        groupSettlements.sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null,
    };
  }, []);

  const value = {
    // State
    refreshTrigger, // Components watch this to trigger re-fetches
    recentSettlements, // Last 10 settlements for quick display
    groupSettlementsCache, // Cached settlements by group
    
    // Actions
    handleSettlement, // Record a new settlement
    triggerRefresh, // Manually trigger refresh
    loadGroupSettlements, // Load settlements for a group
    
    // Utilities
    isExpenseSettled, // Check if expense is settled
    getSettlementSummary, // Get summary for user in group
  };

  return (
    <SettlementContext.Provider value={value}>
      {children}
    </SettlementContext.Provider>
  );
};

export default SettlementContext;
