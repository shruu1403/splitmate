import { useEffect, useState, useContext } from "react";
import RiseLoader from "react-spinners/RiseLoader";
import styles from "../styles/friends.module.css";
import { getFriendDetails } from "../api/friends";
import { deleteExpense } from "../api/expenses";
import AddExpenseModal from "../components/AddExpense";
import SettleUpModal from "../components/SettleUpModal";
import { useParams, Link } from "react-router-dom";
import { Banknote, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useSettlement } from "../context/SettlementContext";
import { recordSettlement } from "../api/settlements";
import { toast } from "react-hot-toast";

export default function Friends() {
  const { id } = useParams(); // get friend ID from route
  const { user } = useContext(AuthContext); // get current user
  const { socket } = useSocket();
  const { handleSettlement, refreshTrigger } = useSettlement();
  const [friend, setFriend] = useState(null);
  const [expenses, setExpenses] = useState([]); // regular expenses only
  const [settlements, setSettlements] = useState([]); // settlement records
  // Note: Friends page shows only direct friend-to-friend balances (no group nets)
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [settlementData, setSettlementData] = useState(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Helper for rounding
  const roundToTwo = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

  // Helpers for multipayer support (similar to Groups page)
  const getPayers = (expense) => {
    if (!expense) return [];
    if (Array.isArray(expense.payers) && expense.payers.length > 0) {
      return expense.payers.map((p) => ({
        user: typeof p.user === 'object' ? p.user._id : p.user,
        amount: Number(p.amount || 0),
      }));
    }
    const uid = typeof expense.paidBy === 'object' ? expense.paidBy._id : expense.paidBy;
    return uid ? [{ user: uid, amount: Number(expense.amount || 0) }] : [];
  };

  const getUserPaidAmount = (expense, userId) => {
    const payers = getPayers(expense);
    const p = payers.find((pp) => String(pp.user) === String(userId));
    return p ? Number(p.amount || 0) : 0;
  };

  // Check if an expense is settled (has a settlement recorded after it)
  // Uses TIMESTAMP comparison (not just date) to handle same-day settlements
  const isExpenseSettled = (expense) => {
    if (settlements.length === 0) return false;

    const expenseTimestamp = new Date(expense.createdAt || expense.date).getTime();

    // Check if there's any settlement created after this expense (by timestamp)
    return settlements.some(settlement => {
      const settlementTimestamp = new Date(settlement.createdAt || settlement.date).getTime();
      return settlementTimestamp > expenseTimestamp;
    });
  };

  // Check if an expense is a settlement
  const isSettlementExpense = (expense) => {
    if (!expense) return false;
    if (expense.type && String(expense.type).toLowerCase() === "settlement") return true;
    if (expense.isSettlement || expense.settlement === true) return true;
    const desc = String(expense.description || "").toLowerCase();
    if (desc.includes("settlement")) return true;
    if (Number(expense.amount) === 0 && expense.meta?.isSettlement) return true;
    return false;
  };

  // Helper function to calculate expense details for display
  const getExpenseDetails = (expense) => {
    if (!user || !expense.splitAmong) return null;

    const userSplit = expense.splitAmong.find(split =>
      (split.user._id || split.user) === user._id
    );

    if (!userSplit) return null;

    const userShare = userSplit.share;
    const paidByUser = (expense.paidBy._id) === user._id;
    const paidByFriend = (expense.paidBy._id) === friend._id;

    return {
      userShare,
      paidByUser,
      paidByFriend,
      paidByName: expense.paidBy.name,
      userOwes: !paidByUser ? userShare : 0,
      friendOwes: paidByFriend ? 0 : (expense.amount - userShare)
    };
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
      // Refresh friend data after deletion
      await fetchFriend();
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Delete failed:", err);
      // alert("Failed to delete expense");
      toast.error("Failed to delete expense");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  //fetch friend details and expenses
  const fetchFriend = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getFriendDetails(id);
      const allExpenses = data.friend.expenses || [];

      console.log('📦 All expenses fetched:', allExpenses.length);

      // Separate settlement entries from normal expenses
      const settlementExpenses = allExpenses.filter(isSettlementExpense);
      // Only show DIRECT expenses here (no group expenses in friends list)
      const normalExpenses = allExpenses.filter((e) => !isSettlementExpense(e) && !e.isDeleted && (e.isDirectExpense === true || !e.groupId));
      // For settling direct expenses, consider only DIRECT settlements (ignore group-linked ones)
      const directSettlementExpenses = settlementExpenses.filter((s) => !s.groupId && (s.isDirectExpense === true || !s.type || String(s.type).toLowerCase() === 'direct'));

      // Smart settlement filtering: Keep only the most recent settlement if balance justifies it
      // Or keep settlements that still have corresponding unsettled expenses
      const validSettlements = [];

      if (directSettlementExpenses.length > 0 && normalExpenses.length > 0) {
        // Calculate what the balance would be without any settlements
        let balanceWithoutSettlements = 0;
        normalExpenses.forEach(exp => {
          const paidById = typeof exp.paidBy === 'object' ? exp.paidBy._id : exp.paidBy;
          const myShare = exp.splitAmong?.find(s => {
            const userId = typeof s.user === 'object' ? s.user._id : s.user;
            return String(userId) === String(user._id);
          });

          if (myShare) {
            if (String(paidById) === String(user._id)) {
              const friendShare = exp.splitAmong?.find(s => {
                const userId = typeof s.user === 'object' ? s.user._id : s.user;
                return String(userId) === String(id);
              });
              if (friendShare) balanceWithoutSettlements -= Number(friendShare.share || 0);
            } else {
              balanceWithoutSettlements += Number(myShare.share || 0);
            }
          }
        });

        // Sort settlements by date (most recent first)
        const sortedSettlements = [...directSettlementExpenses].sort((a, b) => {
          return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
        });

        // Keep settlements that make sense given the current expenses
        let runningBalance = balanceWithoutSettlements;
        for (const settlement of sortedSettlements) {
          const settlementAmount = Number(settlement.amount || 0);
          const settlementDate = new Date(settlement.createdAt || settlement.date);

          // Check if there are expenses before this settlement
          const expensesBeforeSettlement = normalExpenses.filter(exp => {
            return new Date(exp.createdAt || exp.date) < settlementDate;
          });

          // Only keep settlement if there are expenses before it
          if (expensesBeforeSettlement.length > 0) {
            validSettlements.push(settlement);
          }
        }
      }

      console.log('📊 Split result:', {
        allSettlements: settlementExpenses.length,
        validSettlements: validSettlements.length,
        normalExpenses: normalExpenses.length
      });

      setFriend(data.friend);
      setExpenses(normalExpenses);
      // Store only direct settlements for direct-expense settlement checks
      setSettlements(validSettlements);

      // No per-group pairwise nets on Friends page
    } catch (err) {
      console.error("Error fetching friend:", err);
      setFriend(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriend();
  }, [id, refreshTrigger]); // Add refreshTrigger to watch for settlements

  // Socket.IO real-time updates for direct expenses
  useEffect(() => {
    if (socket && user) {
      // Listen for expense updates that affect this user
      const handleExpenseUpdate = (data) => {
        console.log("Expense update received:", data);
        // Refresh friend data if this expense involves the current friend
        if (data.participants && data.participants.includes(id)) {
          fetchFriend();
        }
      };

      const handleExpenseDeleted = (data) => {
        console.log("Expense deletion received:", data);
        // Refresh friend data for any expense deletion
        fetchFriend();
      };

      socket.on('expense_added', handleExpenseUpdate);
      socket.on('expense_deleted', handleExpenseDeleted);
      socket.on('expense_updated', handleExpenseUpdate);

      return () => {
        socket.off('expense_added', handleExpenseUpdate);
        socket.off('expense_deleted', handleExpenseDeleted);
        socket.off('expense_updated', handleExpenseUpdate);
      };
    }
  }, [socket, user, id]);

  // No per-group calculations needed here; Friends page uses only direct friend-to-friend logic

  // Calculate balance between you and friend
  // SIMPLE LOGIC: Only count UNSETTLED expenses in balance
  // Settled expenses and settlements are just historical records
  const calculateFriendBalance = () => {
    if (!user || !friend) return 0;

    let balance = 0;

    // Only process regular expenses, ignore settlements
    expenses.forEach((expense) => {
      if (expense.isDeleted) return;

      // Skip settled expenses - they've already been paid off
      if (isExpenseSettled(expense)) return;

      const paidById = typeof expense.paidBy === "object" ? expense.paidBy._id : expense.paidBy;

      // Regular expense logic
      const myShare = expense.splitAmong?.find((s) => {
        const userId = typeof s.user === "object" ? s.user._id : s.user;
        return String(userId) === String(user._id);
      });

      if (!myShare) return;

      if (String(paidById) === String(user._id)) {
        // I paid => friend owes me (negative balance)
        const friendShare = expense.splitAmong?.find((s) => {
          const userId = typeof s.user === "object" ? s.user._id : s.user;
          return String(userId) === String(id);
        });
        if (friendShare) {
          balance -= Number(friendShare.share || friendShare.amount || 0);
        }
      } else {
        // Friend paid => I owe them (positive balance)
        balance += Number(myShare.share || myShare.amount || 0);
      }
    });

    console.log('=== CALCULATING BALANCE ===');
    console.log('Total expenses:', expenses.length);
    console.log('Unsettled expenses:', expenses.filter(e => !isExpenseSettled(e)).length);
    console.log('FINAL BALANCE:', balance);

    return roundToTwo(balance);
  };  // Handle settle up
  const handleSettleUp = () => {
    const balance = calculateFriendBalance();
    if (balance <= 0) {
      // alert("No balance to settle!");
      toast.info("No balance to settle!");
      return;
    }

    setSettlementData({
      fromUser: {
        _id: user._id,
        name: user.name,
      },
      toUser: {
        _id: friend._id,
        name: friend.name,
      },
      amount: balance,
      groupId: null, // No group for direct friend settlements
      participants: [user._id, friend._id], // Direct friend settlement
      type: "direct",
    });
    setShowSettleUp(true);
  };

  // Confirm settlement using context
  const handleConfirmSettlement = async () => {
    try {
      if (!settlementData) throw new Error("No settlement data to record");

      await handleSettlement({
        groupId: settlementData.groupId, // null for friends
        participants: settlementData.participants, // [user._id, friend._id]
        from: settlementData.fromUser?._id || settlementData.fromUser,
        to: settlementData.toUser?._id || settlementData.toUser,
        amount: settlementData.amount,
        method: settlementData.method || "cash",
      });

  setShowSettleUp(false);
  setSettlementData(null);
  toast.success("Settlement has been recorded.");
    } catch (error) {
      console.error("Settlement failed:", error);
      // alert(error.message || "Settlement failed");
      toast.error(error.message || "Settlement failed");
    }
  };

  if (loading) return (
    <div className={styles.loaderContainer}>
      <RiseLoader size={14} color="#425567" />
    </div>
  );
  if (!friend) return <div className={styles.empty}>Friend not found</div>;

  // Calculate current balance
  const currentBalance = calculateFriendBalance();
  const isFullySettled = Math.abs(currentBalance) < 0.01 && settlements.length > 0;

  // Calculate detailed balance breakdown (including settlements)
  const calculateDetailedBalance = () => {
    let totalOwe = 0;    // Gross amount I owe
    let totalOwed = 0;   // Gross amount I'm owed

    // Process expenses: calculate gross owe and owed amounts
    expenses.forEach(expense => {
      if (expense.isDeleted) return;

      const expenseDetails = getExpenseDetails(expense);
      if (expenseDetails) {
        if (expenseDetails.userOwes > 0) {
          totalOwe += expenseDetails.userOwes;
        }
        if (expenseDetails.friendOwes > 0) {
          totalOwed += expenseDetails.friendOwes;
        }
      }
    });

    // Process settlements: reduce the gross amounts
    settlements.forEach(st => {
      if (st.isDeleted) return;
      const amt = Number(st.amount || 0);
      const paidById = typeof st.paidBy === 'object' ? st.paidBy._id : st.paidBy;
      const toUserId = st.splitAmong?.[0] ? (typeof st.splitAmong[0].user === 'object' ? st.splitAmong[0].user._id : st.splitAmong[0].user) : null;

      if (String(paidById) === String(user._id)) {
        // I paid in settlement: reduces what I owe
        totalOwe = Math.max(0, roundToTwo(totalOwe - amt));
      } else if (String(toUserId) === String(user._id)) {
        // Someone paid me in settlement: reduces what I'm owed
        totalOwed = Math.max(0, roundToTwo(totalOwed - amt));
      }
    });

    const youOwe = roundToTwo(totalOwe);
    const youAreOwed = roundToTwo(totalOwed);
    const netBalance = roundToTwo(youAreOwed - youOwe);

    return { youOwe, youAreOwed, netBalance };
  };

  const detailedBalance = calculateDetailedBalance();

  return (
    <div className={styles.layout}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>{friend.name}</h2>
          <p>{friend.email}</p>
        </div>
        <div className={styles.actions}>
          <button
            onClick={() => setShowAddExpense(true)}
            className={styles.addExpense}
          >
            + Add expense
          </button>
        </div>
      </div>

      {/* Balance Summary (Direct only) */}
      <div className={styles.overallBalanceSummary}>
        <div className={styles.balanceSummaryCard}>
          <div className={styles.balanceSummaryItem}>
            <span className={styles.balanceLabel}>
              <span className={`${styles.balanceIcon} ${styles.balanceIconNet}`}>
                <Banknote size={16} />
              </span>
              Net balance</span>
            <span className={`${styles.balanceValue} ${detailedBalance.netBalance >= 0 ? styles.positive : styles.negative}`}>
              {detailedBalance.netBalance >= 0 ? '+' : ''}₹{detailedBalance.netBalance.toFixed(2)}
            </span>
          </div>
          <div className={styles.balanceSummaryItem}>
            <span className={styles.balanceLabel}>
              <span className={`${styles.balanceIcon} ${styles.balanceIconOwe}`}>
                <TrendingDown size={16} />
              </span>

              You owe</span>
            <span className={`${styles.balanceValue} ${styles.negative}`}>
              ₹{detailedBalance.youOwe.toFixed(2)}
            </span>
          </div>
          <div className={styles.balanceSummaryDivider}></div>
          <div className={styles.balanceSummaryItem}>
            <span className={styles.balanceLabel}>
              <span className={`${styles.balanceIcon} ${styles.balanceIconOwed}`}>
                <TrendingUp size={16} />
              </span>
              You are owed</span>
            <span className={`${styles.balanceValue} ${styles.positive}`}>
              ₹{detailedBalance.youAreOwed.toFixed(2)}
            </span>
          </div>

        </div>
      </div>

      {/* Pair-wise settle section (Direct friend-to-friend only) */}
      <div className={styles.settlementSection}>
        {(() => {
          const { youOwe, youAreOwed, netBalance } = detailedBalance;

          // All truly settled (after actual settlement recorded)
          if (youOwe === 0 && youAreOwed === 0) {
            return <div className={styles.allSettled}>All settled between you and {friend.name}!</div>;
          }

          // Offsetting balances case (net=0 but gross amounts exist)
          if (netBalance === 0 && (youOwe > 0 || youAreOwed > 0)) {
            return (
              <div className={styles.balanceItem}>
                <div className={styles.balanceInfo} style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                      <div className={styles.balanceName} style={{ color: '#f59e0b', fontSize: '14px' }}>
                        💡 Your debts and credits offset each other (₹{youOwe.toFixed(2)} ⇄ ₹{youAreOwed.toFixed(2)})
                      </div>
                      <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>
                        Record a settlement to mark these expenses as settled
                      </div>
                    </div>
                    <button
                      className={styles.settleButton}
                      onClick={async () => {
                        try {
                          // Record settlement for offsetting balances
                          if (youOwe > 0) {
                            await recordSettlement({
                              participants: [user._id, friend._id],
                              from: user._id,
                              to: friend._id,
                              amount: youOwe,
                              method: "cash"
                            });
                          }

                          toast.success("Settlement has been recorded.");

                          // Refresh data
                          const data = await getFriendDetails(id);
                          const allExpenses = data.expenses || [];
                          const regularExpenses = allExpenses.filter(e => !isSettlementExpense(e));
                          const settlementRecords = allExpenses.filter(e => isSettlementExpense(e));
                          setExpenses(regularExpenses);
                          setSettlements(settlementRecords);
                          setFriend(data.friend);
                        } catch (error) {
                          console.error("Failed to record settlement:", error);
                          // alert(error.message || "Failed to record settlement");
                          toast.error(error.message || "Failed to record settlement");
                        }
                      }}
                      style={{ marginLeft: '12px', whiteSpace: 'nowrap' }}
                    >
                      Record
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Normal case: show balance and settle button
          const absDirect = Math.abs(netBalance);
          const youOweFriend = netBalance < 0;
          let label, labelClass;
          if (youOweFriend) {
            label = `You owe ₹${absDirect.toFixed(2)} to ${friend.name}`;
            labelClass = styles.redd;
          } else {
            label = `${friend.name} owes you ₹${absDirect.toFixed(2)}`;
            labelClass = styles.greenn;
          }

          return (
            <div className={styles.balanceItem}>
              <div className={styles.balanceInfo}>
                <div className={`${styles.balanceName} ${labelClass}`}>{label}</div>
              </div>
              <button
                className={styles.settleButton}
                onClick={() => {
                  const amount = Math.round(Math.abs(netBalance) * 100) / 100;
                  setSettlementData({
                    fromUser: netBalance < 0 ? user : friend,
                    toUser: netBalance < 0 ? friend : user,
                    amount,
                    groupId: null,
                    participants: [user._id, friend._id],
                    type: 'direct',
                  });
                  setShowSettleUp(true);
                }}
                disabled={Math.abs(netBalance) < 0.01}
              >
                Settle Up
              </button>
            </div>
          );
        })()}
      </div>




      {/* Expenses list */}
      <div className={styles.expensesSection}>
        {expenses.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No expenses yet. Add one to get started!</p>
          </div>
        ) : (
          <div className={styles.expensesList}>
            {expenses.map((exp) => {
              const expenseDetails = getExpenseDetails(exp);
              const settled = isExpenseSettled(exp);

              // Format date as "Oct 29"
              const dateSource = exp.date || exp.createdAt;
              const dateStr = dateSource
                ? new Date(dateSource).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "";

              // Meta line: "XYZ paid: ₹X, You owe/are owed: ₹Y"
              const paidByIdForName = typeof exp.paidBy === "object" ? exp.paidBy._id : exp.paidBy;
              const payerName = String(paidByIdForName) === String(user?._id) ? "you" : (exp.paidBy?.name || "Someone");
              const paidPart = `${payerName} paid: ₹${Number(exp.amount || 0)}`;
              let owePart = "";
              if (expenseDetails) {
                if (expenseDetails.userOwes > 0) {
                  // owePart = `You owe: ₹${expenseDetails.userOwes}`;
                } else if (expenseDetails.friendOwes > 0) {
                  // owePart = `You are owed: ₹${expenseDetails.friendOwes}`;
                }
              }

              return (
                <div key={exp._id} className={`${styles.expenseItem} ${settled ? styles.settledExpense : ''}`}>
                  <div className={styles.expenseLeft}>
                    <div className={styles.datePill} aria-label={`Date ${dateStr}`}>
                      <span className={styles.dateText}>{dateStr}</span>
                    </div>
                    <div className={styles.expenseDescription}>
                      <div className={styles.descriptionRow}>
                        <span className={styles.expenseTitle}>{exp.description}</span>
                        {exp.groupId && (
                          <Link
                            to={`/groups/${exp.groupId._id || exp.groupId}`}
                            className={styles.groupLink}
                            onClick={(e) => e.stopPropagation()}
                            title={exp.groupId.name || "View group"}
                          >
                            {exp.groupId.name ? `in ${exp.groupId.name}` : "view group"}
                          </Link>
                        )}
                        {settled && <span className={styles.settledBadge}>✓ Settled</span>}
                      </div>
                      <div className={styles.expenseSubtitle}>
                        {paidPart}{owePart ? `. ${owePart}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className={styles.expenseRight}>
                    <div className={styles.expenseAmount}>
                      {expenseDetails && expenseDetails.userOwes > 0 ? (
                        <span className={styles.red}>-₹{expenseDetails.userOwes}</span>
                      ) : expenseDetails && expenseDetails.friendOwes > 0 ? (
                        <span className={styles.green}>+₹{expenseDetails.friendOwes}</span>
                      ) : (
                        <span>₹0</span>
                      )}
                    </div>
                    {(() => {
                      const paidById = typeof exp.paidBy === "object" ? exp.paidBy._id : exp.paidBy;
                      const createdById = typeof exp.createdBy === "object" ? exp.createdBy._id : exp.createdBy;
                      const canDelete = (paidById === user?._id || createdById === user?._id) && !settled;

                      return (
                        canDelete && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              confirmDeleteExpense(exp._id);
                            }}
                            className={styles.deleteBtn}
                            title="Delete expense"
                          >
                            <Trash2 size={16} />
                          </button>
                        )
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      {/* Add Expense Modal */}
      {showAddExpense && (
        <AddExpenseModal
          isOpen={showAddExpense}
          onClose={() => setShowAddExpense(false)}
          onExpenseAdded={async () => {
            // Refresh friend data after adding expense
            await fetchFriend();
          }}
          friendId={friend._id} // pass friend ID if needed
        />
      )}

      {/* Settle Up Modal */}
      {showSettleUp && settlementData && (
        <SettleUpModal
          isOpen={showSettleUp}
          onClose={() => {
            setShowSettleUp(false);
            setSettlementData(null);
          }}
          settlementData={settlementData}
          onConfirm={handleConfirmSettlement}
        />
      )}

    </div>
  );
}
