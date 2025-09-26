import React, { useEffect, useState } from "react";
import { getAllExpenses, getExpense, deleteExpense } from "../api/expenses";
import AddExpenseModal from "../components/AddExpense";
import styles from "../styles/AllExpenses.module.css";
import { useGroups } from "../context/GroupContext";

export default function AllExpenses({ groupId }) {
  const { groups = [] } = useGroups() || {};
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch all expenses
  const loadExpenses = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getAllExpenses(groupId);
      setExpenses(Array.isArray(data?.expenses) ? data.expenses : []);
    } catch (err) {
      setError(err.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  // Get single expense
  const handleExpenseClick = async (id) => {
    try {
      const data = await getExpense(id);
      if (data?.expense) {
        setSelectedExpense(data.expense);
      } else {
        setSelectedExpense(null);
      }
    } catch {
      alert("Failed to fetch expense details");
    }
  };

  // Delete expense
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e?._id !== id));
      setSelectedExpense(null);
    } catch (err) {
      alert(err.message || "Failed to delete expense");
    }
  };

  // After adding new expense
  const handleExpenseAdded = (newExpense) => {
    if (newExpense && newExpense._id) {
      setExpenses((prev) => [newExpense, ...prev]);
    }
  };

  useEffect(() => {
    if (groupId) loadExpenses();
  }, [groupId]);

  if (loading) return <div>Loading expenses...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  const group = groups.find((g) => g?._id === groupId);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>All expenses</h2>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          Add an expense
        </button>
      </div>

      {/* Expenses list */}
      <div className={styles.list}>
        {!expenses || expenses.length === 0 ? (
          <div>No expenses yet</div>
        ) : (
          expenses.map((exp) => (
            <div
              key={exp?._id || Math.random()}
              className={styles.expenseItem}
              onClick={() => exp?._id && handleExpenseClick(exp._id)}
            >
              <div className={styles.expenseMain}>
                <span className={styles.expenseDesc}>
                  {exp?.description || "No description"}
                </span>
                <span className={styles.expenseAmt}>
                  ₹{typeof exp?.amount === "number" ? exp.amount.toFixed(2) : "0.00"}
                </span>
              </div>
              <div className={styles.expenseMeta}>
                Paid by {exp?.paidBy?.name || "Unknown"} on{" "}
                {exp?.date ? new Date(exp.date).toLocaleDateString() : "Unknown date"}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Expense details */}
      {selectedExpense && (
        <div className={styles.details}>
          <h3>Expense Details</h3>
          <p>
            <b>Description:</b> {selectedExpense?.description || "N/A"}
          </p>
          <p>
            <b>Amount:</b>{" "}
            ₹
            {typeof selectedExpense?.amount === "number"
              ? selectedExpense.amount.toFixed(2)
              : "0.00"}
          </p>
          <p>
            <b>Paid by:</b> {selectedExpense?.paidBy?.name || "Unknown"}
          </p>
          <p>
            <b>Date:</b>{" "}
            {selectedExpense?.date
              ? new Date(selectedExpense.date).toLocaleDateString()
              : "Unknown"}
          </p>

          <h4>Split Among:</h4>
          <ul>
            {Array.isArray(selectedExpense?.splitAmong) &&
              selectedExpense.splitAmong.map((u) => (
                <li key={u?._id || u?.name}>{u?.name || "Unknown"}</li>
              ))}
          </ul>

          <button
            className={styles.deleteBtn}
            onClick={() =>
              selectedExpense?._id && handleDelete(selectedExpense._id)
            }
          >
            Delete
          </button>
        </div>
      )}

      {/* Add expense modal */}
      {showModal && (
        <AddExpenseModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onExpenseAdded={handleExpenseAdded}
        />
      )}
    </div>
  );
}
