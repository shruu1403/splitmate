import React, { useEffect, useState } from "react";
import styles from "../styles/friends.module.css";
import { getFriendDetails } from "../api/friends";
import AddExpenseModal from "../components/AddExpense";
import { useParams } from "react-router-dom";

export default function Friends() {
  const { id } = useParams(); // get friend ID from route
  const [friend, setFriend] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettled, setShowSettled] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);



  //fetch friend details and expenses
  useEffect(() => {
    const fetchFriend = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await getFriendDetails(id);
        setFriend(data.friend); // { name, email, expenses: [], balance }
        setExpenses(data.friend.expenses);
      } catch (err) {
        console.error("Error fetching friend:", err);
        setFriend(null);
      } finally {
        setLoading(false);
      }
    };
    fetchFriend();
  }, [id]);
 
  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!friend) return <div className={styles.empty}>Friend not found</div>;

  const activeExpenses = friend.expenses?.filter((e) => !e.settled) || [];
  const settledExpenses = friend.expenses?.filter((e) => e.settled) || [];

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
            Add an expense
          </button>
          <button className={styles.settleBtn}>Settle up</button>
        </div>
      </div>
      {/* Balance summary */}
      <div className={styles.balanceSummary}>
        {friend.balance === 0 ? (
          <span>All settled up</span>
        ) : friend.balance > 0 ? (
          <span className={styles.green}>You get back ₹{friend.balance}</span>
        ) : (
          <span className={styles.red}>
            You owe {friend.name} ₹{Math.abs(friend.balance)}
          </span>
        )}
      </div>
      {/* After balance summary */}
      <div className={styles.groupsSection}>
        {friend.groups?.length > 0 && (
          <>
            <h4>Groups with {friend.name}</h4>
            <ul>
              {friend.groups.map((g) => (
                <li key={g._id}>
                  <a href={`/groups/${g._id}`} className={styles.groupLink}>
                    {g.name}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {/* Expenses list */}
      <div className={styles.expensesSection}>
        {activeExpenses.length === 0 ? (
          <div className={styles.settledState}>
            <p>All expenses before this date have been settled up.</p>
            {settledExpenses.length > 0 && (
              <button
                className={styles.link}
                onClick={() => setShowSettled(!showSettled)}
              >
                {showSettled
                  ? "Hide settled expenses"
                  : "Show settled expenses"}
              </button>
            )}
          </div>
        ) : (
          activeExpenses.map((exp) => (
            <div key={exp._id} className={styles.expenseItem}>
              <div className={styles.expenseLeft}>
                <span className={styles.date}>{exp.date?.slice(5, 10)}</span>
                <span>{exp.description}</span>
              </div>
              <div className={styles.expenseRight}>
                <span>₹{exp.amount}</span>
                <small>Paid by {exp.paidBy?.name}</small>
              </div>
            </div>
          ))
        )}

        {showSettled && settledExpenses.length > 0 && (
          <div className={styles.settledExpenses}>
            <h4>Settled Expenses</h4>
            {settledExpenses.map((sExp) => (
              <div key={sExp._id} className={styles.expenseItem}>
                {sExp.description} - ₹{sExp.amount}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Add Expense Modal */}
      {showAddExpense && (
        <AddExpenseModal
          isOpen={showAddExpense}
          onClose={() => setShowAddExpense(false)}
          onExpenseAdded={() => {}}
          friendId={friend._id} // pass friend ID if needed
        />
      )}
    </div>
  );
}
