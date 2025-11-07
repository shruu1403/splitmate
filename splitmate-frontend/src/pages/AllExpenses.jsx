import  { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Info, Trash2 } from "lucide-react";
import BeatLoader from "react-spinners/BeatLoader";
import { getAllUserExpenses, getExpense, deleteExpense } from "../api/expenses";
import { getGroupSettlements } from "../api/settlements";
import AddExpenseModal from "../components/AddExpense";
import styles from "../styles/AllExpenses.module.css";
import { useSettlement } from "../context/SettlementContext";
import { toast } from "react-hot-toast";

export default function AllExpenses() {
  const { refreshTrigger, isExpenseSettled: isGroupExpenseSettled, loadGroupSettlements } = useSettlement();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [friendSettlements, setFriendSettlements] = useState({}); // Cache friend settlements by friendId
  const [groupSettlements, setGroupSettlements] = useState({}); // Cache group settlements by groupId

  // Decode user from token (similar to Groups page)
  const tokenUser = (() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return { _id: payload.userID, id: payload.userID, name: payload.name, email: payload.email };
    } catch {
      return null;
    }
  })();

  // Helper: Check if an expense is a settlement transaction
  const isSettlementExpense = (expense) => {
    return expense.type === 'settlement' || expense.isSettlement === true;
  };

  // Helper: Check if a GROUP expense is settled (matches Groups.jsx logic)
  const isGroupExpenseSettledLocal = (expense) => {
    if (!tokenUser || !expense) return false;
    
    const groupId = expense.groupId?._id || expense.groupId;
    const settlements = groupSettlements[groupId] || [];
    
    if (settlements.length === 0) return false;
    
    const expenseTimestamp = new Date(expense.createdAt || expense.date).getTime();
    
    // Determine who I owe in this expense (or who owes me)
    const paidById = typeof expense.paidBy === 'object' ? expense.paidBy._id : expense.paidBy;
    const iPaid = String(paidById) === String(tokenUser._id);
    
    // If I didn't pay, the person I owe is the payer
    const personIOwe = iPaid ? null : paidById;
    
    // If I paid, check if anyone who owes me has settled
    if (iPaid) {
      // For expenses I paid, check if there's a settlement where someone paid me
      return settlements.some(settlement => {
        const settlementTimestamp = new Date(settlement.createdAt || settlement.date).getTime();
        if (settlementTimestamp <= expenseTimestamp) return false; // Settlement must be after expense
        
        const settlementToUserId = settlement.splitAmong?.[0]?.user?._id || settlement.splitAmong?.[0]?.user;
        // Settlement where someone paid me (I received money)
        return String(settlementToUserId) === String(tokenUser._id);
      });
    } else {
      // For expenses where someone else paid, check if I've settled with THAT specific person
      return settlements.some(settlement => {
        const settlementTimestamp = new Date(settlement.createdAt || settlement.date).getTime();
        if (settlementTimestamp <= expenseTimestamp) return false; // Settlement must be after expense
        
        const settlementPaidById = settlement.paidBy?._id || settlement.paidBy;
        const settlementToUserId = settlement.splitAmong?.[0]?.user?._id || settlement.splitAmong?.[0]?.user;
        
        // I paid someone in a settlement, and that someone is the person I owe in this expense
        return String(settlementPaidById) === String(tokenUser._id) && 
               String(settlementToUserId) === String(personIOwe);
      });
    }
  };

  // Helper: Check if a FRIEND expense is settled (for direct friend expenses without groupId)
  const isFriendExpenseSettled = (expense) => {
    if (!tokenUser || !expense) return false;
    
    // Extract friend ID from expense participants
    const friendId = expense.splitAmong?.find(s => {
      const userId = typeof s.user === 'object' ? s.user._id : s.user;
      return userId !== tokenUser._id;
    });
    
    if (!friendId) return false;
    
    const actualFriendId = typeof friendId.user === 'object' ? friendId.user._id : friendId.user;
    const settlements = friendSettlements[actualFriendId] || [];
    
    if (settlements.length === 0) return false;
    
    // Check if any settlement happened AFTER this expense
    const expenseTimestamp = new Date(expense.createdAt || expense.date).getTime();
    return settlements.some(settlement => {
      const settlementTimestamp = new Date(settlement.createdAt || settlement.date).getTime();
      return settlementTimestamp > expenseTimestamp;
    });
  };

  // Check if an expense is settled (works for BOTH group and friend expenses)
  const isExpenseSettledUniversal = (expense) => {
    // If it has a groupId, use local group settlement logic (matches Groups.jsx)
    if (expense.groupId) {
      return isGroupExpenseSettledLocal(expense);
    }
    
    // Otherwise, it's a friend expense - use friend settlement logic
    return isFriendExpenseSettled(expense);
  };

  // Fetch all expenses for the user
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await getAllUserExpenses();
      console.log("All expenses response:", data);
      const allExpenses = data.expenses || [];
      
      // FILTER OUT settlement transactions - only show real expenses
      const fetchedExpenses = allExpenses.filter(exp => !isSettlementExpense(exp));
      console.log(`Filtered ${allExpenses.length} total to ${fetchedExpenses.length} real expenses (removed ${allExpenses.length - fetchedExpenses.length} settlements)`);
      
      setExpenses(fetchedExpenses);
      
      // Load settlements for all unique groups into local cache
      const uniqueGroupIds = [...new Set(fetchedExpenses.map(exp => exp.groupId?._id || exp.groupId).filter(Boolean))];
      console.log("Loading settlements for groups:", uniqueGroupIds);
      
      const groupSettlementsData = {};
      await Promise.all(
        uniqueGroupIds.map(async (groupId) => {
          try {
            const response = await getGroupSettlements(groupId);
            groupSettlementsData[groupId] = response.settlements || [];
          } catch (err) {
            console.error(`Failed to load settlements for group ${groupId}:`, err);
            groupSettlementsData[groupId] = [];
          }
        })
      );
      
      setGroupSettlements(groupSettlementsData);
      console.log("Group settlements loaded:", groupSettlementsData);
      
      // Load settlements for all unique friends (for direct friend expenses)
      const friendExpenses = fetchedExpenses.filter(exp => !exp.groupId);
      const uniqueFriendIds = new Set();
      
      friendExpenses.forEach(exp => {
        exp.splitAmong?.forEach(s => {
          const userId = typeof s.user === 'object' ? s.user._id : s.user;
          if (userId !== tokenUser._id) {
            uniqueFriendIds.add(userId);
          }
        });
      });
      
      console.log("Loading settlements for friends:", Array.from(uniqueFriendIds));
      
      // Load settlements for each friend
      const friendSettlementsData = {};
      await Promise.all(
        Array.from(uniqueFriendIds).map(async (friendId) => {
          try {
            // Use groupId=null to indicate direct friend settlement
            const response = await getGroupSettlements(null, [tokenUser._id, friendId]);
            friendSettlementsData[friendId] = response.settlements || [];
          } catch (err) {
            console.error(`Failed to load settlements for friend ${friendId}:`, err);
            friendSettlementsData[friendId] = [];
          }
        })
      );
      
      setFriendSettlements(friendSettlementsData);
      console.log("Friend settlements loaded:", friendSettlementsData);
      
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [refreshTrigger]); // Re-fetch when settlements occur

  // Resolve a user name by id from expense data
  const getUserNameById = (id, expense) => {
    if (!id || !expense) return null;
    // Direct object on paidBy
    if (typeof expense.paidBy === 'object' && (expense.paidBy?._id === id)) {
      return expense.paidBy?.name || null;
    }
    // Look into splitAmong for a matching object
    const match = expense.splitAmong?.find(s => {
      if (!s?.user) return false;
      return (typeof s.user === 'object' ? s.user._id : s.user) === id;
    });
    if (match && typeof match.user === 'object') return match.user.name || null;
    // Fallback to createdBy if matches
    if (typeof expense.createdBy === 'object' && expense.createdBy?._id === id) {
      return expense.createdBy?.name || null;
    }
    return null;
  };

  const getPayerDisplay = (expense) => {
    if (!expense) return { label: "", isMultiple: false };
    // Preferred: multiple payers array [{ user, amount }]
    const payers = Array.isArray(expense.payers) ? expense.payers.filter(p => p && p.user) : [];
    if (payers.length > 0) {
      const names = payers
        .map(p => (typeof p.user === 'object' ? p.user?.name : getUserNameById(p.user, expense)))
        .filter(Boolean);
      if (names.length === 1) return { label: names[0], isMultiple: false };
      if (names.length >= 2) return { label: `${names[0]} + ${payers.length - 1} more`, isMultiple: true };
      // If names couldn't be resolved, fall back to count (rare)
      return { label: `${payers.length} people`, isMultiple: true };
    }
    // Legacy single payer
    if (typeof expense.paidBy === 'object' && expense.paidBy?.name) return { label: expense.paidBy.name, isMultiple: false };
    const paidById = typeof expense.paidBy === 'object' ? expense.paidBy?._id : expense.paidBy;
    const name = getUserNameById(paidById, expense) || "";
    return { label: name, isMultiple: false };
  };

  // Paid-by label for the details modal with grammar: "A + 1 other" / "A + N others"
  const getPayersOverviewDisplay = (expense) => {
    if (!expense) return 'Someone';
    const payers = Array.isArray(expense.payers) ? expense.payers.filter(p => p && p.user) : [];
    if (payers.length > 0) {
      const names = payers
        .map(p => (typeof p.user === 'object' ? p.user?.name : getUserNameById(p.user, expense)))
        .filter(Boolean);
      if (names.length === 1) return names[0] || 'Someone';
      if (names.length === 2) return `${names[0]} + 1 other`;
      if (names.length > 2) return `${names[0]} + ${names.length - 1} others`;
    }
    // Legacy single payer
    return expense.paidBy?.name || 'Someone';
  };

  // Handle expense click to show details (triggered from the info button now)
  const handleExpenseClick = async (expenseId) => {
    try {
      const response = await getExpense(expenseId);
      setSelectedExpenseDetail(response.expense);
      setShowExpenseDetail(true);
    } catch (error) {
      console.error("Failed to fetch expense details:", error);
      // alert("Failed to load expense details");
      toast.error("Failed to load expense details");
    }
  };

  // Delete expense functionality
  const confirmDeleteExpense = (expenseId) => {
    setDeletingExpenseId(expenseId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    try {
      await deleteExpense(deletingExpenseId);
      fetchExpenses(); // Refresh the list
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Delete failed:", err);
      // alert("Failed to delete expense");
      toast.error("Failed to delete expense");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  // Calculate balance for each expense with multi-payer support
  const calculateBalance = (expense) => {
    if (!tokenUser || !expense.splitAmong) return null;

    // My share from the split
    const myShareEntry = expense.splitAmong.find((s) => {
      const userId = typeof s.user === 'object' ? s.user._id : s.user;
      return String(userId) === String(tokenUser._id);
    });
    if (!myShareEntry) return null;
    const myShare = Number(myShareEntry.amount || myShareEntry.share || 0);

    // How much I actually paid (multi-payer aware)
    let myPaid = 0;
    if (Array.isArray(expense.payers) && expense.payers.length) {
      myPaid = expense.payers.reduce((sum, p) => {
        const uid = typeof p.user === 'object' ? p.user?._id : p.user;
        return String(uid) === String(tokenUser._id) ? sum + Number(p.amount || 0) : sum;
      }, 0);
    } else {
      const paidById = typeof expense.paidBy === 'object' ? expense.paidBy._id : expense.paidBy;
      if (String(paidById) === String(tokenUser._id)) {
        myPaid = Number(expense.amount || 0);
      }
    }

    const net = Number(myPaid) - Number(myShare);
    if (net > 0) return { type: 'lent', amount: net, myShare, myPaid };
    if (net < 0) return { type: 'owe', amount: Math.abs(net), myShare, myPaid };
    return { type: 'even', amount: 0, myShare, myPaid };
  };

  const formatDate = (d) => {
    try {
      const date = new Date(d);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const handleAddExpense = () => {
    fetchExpenses(); // Refresh expenses after adding
  };

  if (loading) return (
    <div className={styles.loaderContainer}>
      <BeatLoader size={14} color="#05224dff" />
    </div>
  );

  return (
    <div className={styles.layout}>
      <main className={styles.mainContent}>
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h2>All Expenses</h2>
              <p>Your expenses across all groups and friends</p>
            </div>
            <div className={styles.actions}>
              <button
                onClick={() => setShowAddExpense(true)}
                className={styles.addExpenseBtn}
              >
                + Add expense
              </button>
            </div>
          </div>

          {/* Expenses List */}
          <div className={styles.expensesSection}>
          {expenses.length === 0 ? (
            <div className={styles.emptyExpenses}>
              <p>No expenses yet. Add one!</p>
            </div>
          ) : (
            <div className={styles.expenseList}>
              {expenses.map((expense) => {
                const balance = calculateBalance(expense);

                const [month, day] = formatDate(expense.date).split(" ");
                const { label: payerLabel, isMultiple } = getPayerDisplay(expense);
                const groupName = expense.groupId?.name;
                const groupId = expense.groupId?._id || expense.groupId;
                
                // Check if this expense has been settled (works for both group and friend expenses)
                const settled = isExpenseSettledUniversal(expense);
                
                // Debug logging
                console.log(`Expense "${expense.description}" (${expense._id}):`, {
                  hasGroup: !!expense.groupId,
                  groupId: expense.groupId?._id || expense.groupId,
                  expenseDate: expense.date,
                  settled
                });

                return (
                  <div 
                    key={expense._id} 
                    className={`${styles.expenseItem} ${settled ? styles.settledExpense : ''}`}
                    onClick={() => handleExpenseClick(expense._id)}
                  >
                    <div className={styles.expenseLeft}>
                      <div className={styles.dateBox}>
                        <span className={styles.month}>
                          {month?.toUpperCase()}
                        </span>
                        <span className={styles.day}>{day}</span>
                      </div>
                      <div className={styles.expenseDetails}>
                        <div className={styles.expenseTitle}>
                          {expense.description}
                          {groupName && (
                            <Link to={`/groups/${groupId}`} className={styles.groupName} onClick={(e) => e.stopPropagation()}>
                              {groupName}
                            </Link>
                          )}
                          {/* {settled && (
                            <span className={styles.settledBadge}>
                              ✓ Settled
                            </span>
                          )} */}
                        </div>
                        {/* Paid by line */}
                        <div className={styles.expenseSubtitle}>
                          {payerLabel ? (
                            <>
                              {isMultiple ? `${payerLabel} paid` : `${payerLabel} paid`}: ₹{expense.amount.toFixed(2)}
                            </>
                          ) : (
                            <>Paid: ₹{expense.amount.toFixed(2)}</>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={styles.expenseRight}>
                      {(() => {
                        const paidById = typeof expense.paidBy === "object"
                          ? expense.paidBy._id
                          : expense.paidBy;
                        const createdById = typeof expense.createdBy === "object"
                          ? expense.createdBy._id
                          : expense.createdBy;

                        const canDelete = (paidById === tokenUser?._id || createdById === tokenUser?._id) && !settled;
                        const canSettle = balance && balance.type === "owe" && balance.amount > 0 && paidById !== tokenUser?._id;

                        return (
                          <div className={styles.expenseActions}>
                            {/* Amount display (net relative to me if available, else total) */}
                            <div className={`${styles.balanceAmountRight} ${balance ? (balance.type === "lent" && balance.amount > 0 ? styles.positive : (balance.type === "owe" && balance.amount > 0 ? styles.negative : '')) : ''}`}>
                              {balance ? (
                                balance.type === "lent" && balance.amount > 0
                                  ? `+₹${balance.amount.toFixed(2)}`
                                  : balance.type === "owe" && balance.amount > 0
                                  ? `-₹${balance.amount.toFixed(2)}`
                                  : `₹0.00`
                              ) : (
                                `₹${expense.amount.toFixed(2)}`
                              )}
                            </div>
                            <div className={styles.iconRow}>
                              {/* Info button opens details */}
                              <button
                                className={styles.infoBtn}
                                title="Details"
                                onClick={(e) => { e.stopPropagation(); handleExpenseClick(expense._id); }}
                              >
                                <Info size={16} />
                              </button>
                              {canDelete && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    confirmDeleteExpense(expense._id);
                                  }}
                                  className={styles.deleteBtn}
                                  title="Delete expense"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </main>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <AddExpenseModal
          isOpen={showAddExpense}
          onClose={() => setShowAddExpense(false)}
          onExpenseAdded={handleAddExpense}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.overlay}>
          <div
            className={styles.confirmModal}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleDeleteExpense();
              }
            }}
            tabIndex={-1}
          >
            <p>Are you sure you want to delete this expense?</p>
            <div className={styles.confirmActions}>
              <button
                onClick={handleDeleteExpense}
                className={styles.btnDanger}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingExpenseId(null);
                }}
                className={styles.btnSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Detail Modal */}
      {showExpenseDetail && selectedExpenseDetail && (
        <div 
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExpenseDetail(false);
            }
          }}
        >
          <div className={styles.expenseDetailModal}>
            <div className={styles.modalHeader}>
              <h3>{selectedExpenseDetail.description}</h3>
              <button 
                onClick={() => setShowExpenseDetail(false)}
                className={styles.closeBtn}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.expenseOverview}>
                <div className={styles.totalAmount}>
                  Total: ₹{selectedExpenseDetail.amount?.toFixed(2)}
                </div>
                <div className={styles.paidBy}>
                  Paid by {getPayersOverviewDisplay(selectedExpenseDetail)} on{' '}
                  {new Date(selectedExpenseDetail.date).toLocaleDateString()}
                </div>
                <div className={styles.groupInfo}>
                  in {selectedExpenseDetail.groupId?.name || (selectedExpenseDetail.isDirectExpense ? "Direct Expense" : "Unknown Group")}
                </div>
              </div>

              <div className={styles.splitBreakdown}>
                <h4>Split Breakdown</h4>
                {selectedExpenseDetail.splitAmong?.map((split, index) => {
                  const userName = split.user?.name || 'Unknown';
                  const shareAmount = split.amount || split.share || 0;
                  const splitUserId = split.user?._id || split.user;
                  // Multi-payer aware payer check
                  const isPayer = Array.isArray(selectedExpenseDetail.payers) && selectedExpenseDetail.payers.length
                    ? selectedExpenseDetail.payers.some(p => (p.user?._id || p.user) === splitUserId)
                    : splitUserId === (selectedExpenseDetail.paidBy?._id || selectedExpenseDetail.paidBy);
                  const netAmount = isPayer ? 
                    (selectedExpenseDetail.amount - shareAmount) : 
                    -shareAmount;

                  return (
                    <div key={index} className={styles.splitItem}>
                      <div className={styles.splitUser}>
                        <span className={styles.userName}>{userName}</span>
                        {isPayer && <span className={styles.paidTag}>PAID</span>}
                      </div>
                      <div className={styles.splitAmounts}>
                        <div>Share: ₹{shareAmount.toFixed(2)}</div>
                        {isPayer && netAmount > 0 && (
                          <div className={styles.positive}>
                            Gets back: ₹{netAmount.toFixed(2)}
                          </div>
                        )}
                        {!isPayer && shareAmount > 0 && (
                          <div className={styles.negative}>
                            Owes: ₹{shareAmount.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedExpenseDetail.createdBy && (
                <div className={styles.expenseFooter}>
                  <small>
                    Added by {selectedExpenseDetail.createdBy.name} on{' '}
                    {new Date(selectedExpenseDetail.createdAt || selectedExpenseDetail.date).toLocaleDateString()}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
