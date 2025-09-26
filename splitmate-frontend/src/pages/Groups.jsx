import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "../styles/groups.module.css";
import { getSingleGroup } from "../api/groups";
import { getAllExpenses, deleteExpense } from "../api/expenses";
import AddExpenseModal from "../components/AddExpense";
import { generateInviteLink } from "../api/invite";

export default function Groups() {
  const { id: groupId } = useParams();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  // decode user from token
  const currentUser = (() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return { _id: payload.userID, id:payload.userID,name: payload.name, email: payload.email };
    } catch {
      return null;
    }
  })();

  // Fetch groups + (if groupId present) details + expenses
  const fetchData = async () => {
    setLoading(true);
    try {
      const groupDetail = await getSingleGroup(groupId);
      const expenseData = await getAllExpenses(groupId);
      console.log("expenses api response:", expenseData);

      setSelectedGroup(groupDetail.group || groupDetail);
      setExpenses(expenseData.expenses || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) fetchData();
  }, [groupId]);

  const handleAddExpense = () => fetchData();

  const confirmDeleteExpense = (expenseId) => {
    setDeletingExpenseId(expenseId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    try {
      await deleteExpense(deletingExpenseId);
      fetchData();
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete expense");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const handleGenerateLink = async () => {
    try {
      const { link } = await generateInviteLink(groupId);
      setInviteLink(link);
    } catch {
      alert("Failed to generate link");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      alert("Link copied!");
    } catch {
      alert("Failed to copy link");
    }
  };

  const calculateBalance = (expense) => {
    if (!currentUser || !expense.splitAmong) return null;
    const myShare = expense.splitAmong.find((s) => s.user === currentUser._id);
    if (!myShare) return null;

    const iPaid = expense.paidBy === currentUser._id;
    if (iPaid) {
      return { type: "lent", amount: expense.amount - (myShare.share || 0) };
    } else {
      return { type: "owe", amount: myShare.share || 0 };
    }
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

  return (
    <div className={styles.layout}>
      {/* Main content */}
      <main className={styles.mainContent}>
        {loading ? (
          <div className={styles.loading}>Loading…</div>
        ) : !selectedGroup ? (
          <div className={styles.emptyState}>Group not found.</div>
        ) : (
          <>
            {/* Header */}
            <div className={styles.groupHeader}>
              <div className={styles.groupInfo}>
                <div className={styles.groupIcon}>🏠</div>
                <div>
                  <h2>{selectedGroup.name}</h2>
                  <p>{selectedGroup.members?.length || 0} people</p>
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className={styles.addExpenseBtn}
                >
                  Add expense
                </button>
                <button className={styles.settleBtn}>Settle up</button>
              </div>
            </div>

            {/* Invite Section */}
            <div className={styles.inviteSection}>
              <h4>Invite Members</h4>
              <button
                onClick={handleGenerateLink}
                className={styles.btnSecondary}
              >
                Generate Link
              </button>
              {inviteLink && (
                <div className={styles.linkBox}>
                  <input readOnly value={inviteLink} className={styles.input} />
                  <button onClick={handleCopy} className={styles.btn}>
                    Copy
                  </button>
                </div>
              )}
            </div>

            {/* Expenses */}
            <div className={styles.expensesSection}>
              {expenses.length > 0 ? (
                <div className={styles.expenseList}>
                  {expenses.map((e) => {
                    const balance = calculateBalance(e);
                    const paidByName =
                      typeof e.paidBy === "object"
                        ? e.paidBy.name
                        : selectedGroup.members?.find((m) => m._id === e.paidBy)
                            ?.name || "Someone";

                    const [month, day] = formatDate(e.date).split(" ");

                    return (
                      <div key={e._id} className={styles.expenseItem}>
                        <div className={styles.expenseLeft}>
                          <div className={styles.dateBox}>
                            <span className={styles.month}>
                              {month?.toUpperCase()}
                            </span>
                            <span className={styles.day}>{day}</span>
                          </div>
                          <div className={styles.expenseDetails}>
                            <div className={styles.expenseTitle}>
                              {e.description}
                            </div>
                            <div className={styles.expenseSubtitle}>
                              {e.paidBy === currentUser?._id
                                ? "you paid"
                                : `${paidByName} paid`}
                            </div>
                          </div>
                        </div>

                        <div className={styles.expenseRight}>
                          <div className={styles.amounts}>
                            <div className={styles.totalAmount}>
                              ₹{e.amount.toFixed(2)}
                            </div>
                            {balance && (
                              <div
                                className={`${styles.balanceAmount} ${
                                  balance.type === "lent"
                                    ? styles.positive
                                    : styles.negative
                                }`}
                              >
                                {balance.type === "lent"
                                  ? `you lent ₹${balance.amount.toFixed(2)}`
                                  : `you owe ₹${balance.amount.toFixed(2)}`}
                              </div>
                            )}
                          </div>
                          {(() => {
                            const paidById =
                              typeof e.paidBy === "object"
                                ? e.paidBy._id
                                : e.paidBy;
                            const createdById =
                              typeof e.createdBy === "object"
                                ? e.createdBy._id
                                : e.createdBy;

                            const canDelete =
                              paidById === currentUser?._id ||
                              createdById === currentUser?._id;

                            return (
                              canDelete && (
                                <button
                                  onClick={() => confirmDeleteExpense(e._id)}
                                  className={styles.deleteBtn}
                                  title="Delete expense"
                                >
                                  🗑️
                                </button>
                              )
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyExpenses}>
                  <p>No expenses yet. Add one!</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Modal */}
      {showAddExpense && selectedGroup && (
        <AddExpenseModal
          isOpen={showAddExpense}
          onClose={() => setShowAddExpense(false)}
          onExpenseAdded={handleAddExpense}
          initialGroupId={selectedGroup._id}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.overlay}>
          <div className={styles.confirmModal}>
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
    </div>
  );
}
