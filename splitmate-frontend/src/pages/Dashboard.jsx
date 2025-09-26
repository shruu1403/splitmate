import React, { useEffect, useState } from "react";
import { getOverallBalance } from "../api/dashboard";
import styles from "../styles/dashboard.module.css"; // create a module css file

const Dashboard = () => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const data = await getOverallBalance();
        setBalance(data);
      } catch (err) {
        setError(err.msg || "Failed to load balance");
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, []);

  if (loading) {
    return <div className={styles.center}>Loading your dashboard...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  // For new user with no groups
  if (!balance || balance.breakdown.length === 0) {
    return (
      <div className={styles.center}>
        <h2>Welcome to SplitMate🎉</h2>
        <p>You don’t have any groups or expenses yet.</p>
        <p>Start by creating a group or adding an expense.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Dashboard</h1>

      {/* Top summary row */}
      <div className={styles.summaryRow}>
        <div>
          <p>Total balance</p>
          <span
            className={
              balance.overallBalance >= 0 ? styles.positive : styles.negative
            }
          >
            ₹{balance.overallBalance.toFixed(2)}
          </span>
        </div>
        <div>
          <p>You owe</p>
          <span className={styles.negative}>₹{balance.youOwe.toFixed(2)}</span>
        </div>
        <div>
          <p>You are owed</p>
          <span className={styles.positive}>
            ₹{balance.youAreOwed.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Owe vs Owed lists */}
      <div className={styles.oweContainer}>
        {/* You Owe */}
        <div className={styles.oweSection}>
          <h3>You Owe</h3>
          {balance.breakdown.filter((b) => b.amount < 0).length === 0 ? (
            <p>You owe nothing 🎉</p>
          ) : (
            balance.breakdown
              .filter((b) => b.amount < 0)
              .map((b) => (
                <div key={b.userId} className={styles.personRow}>
                  <span>{b.name}</span>
                  <span className={styles.negative}>
                    You owe ₹{Math.abs(b.amount)}
                  </span>
                </div>
              ))
          )}
        </div>

        {/* You Are Owed */}
        <div className={styles.oweSection}>
          <h3>You Are Owed</h3>
          {balance.breakdown.filter((b) => b.amount > 0).length === 0 ? (
            <p>You are not owed anything</p>
          ) : (
            balance.breakdown
              .filter((b) => b.amount > 0)
              .map((b) => (
                <div key={b.userId} className={styles.personRow}>
                  <span>{b.name}</span>
                  <span className={styles.positive}>Owes you ₹{b.amount}</span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
