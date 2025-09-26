import React, { useEffect, useState } from "react";
import { getRecentActivity, getDeletedExpenses, restoreExpense } from "../api/recentActivity";
import styles from "../styles/recentActivity.module.css";

const RecentActivity = () => {
  const [activities, setActivities] = useState([]);
  const [deletedExpenses, setDeletedExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const recent = await getRecentActivity();
        const deleted = await getDeletedExpenses();
        setActivities(recent || []);
        setDeletedExpenses(deleted?.deletedExpenses || []);
      } catch (error) {
        console.error("Failed to load recent activity:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRestore = async (id) => {
    try {
      await restoreExpense(id);
      setDeletedExpenses((prev) => prev.filter((exp) => exp._id !== id));

      // refresh activity list after restore
      const recent = await getRecentActivity();
      setActivities(recent || []);
    } catch (error) {
      console.error("Failed to restore expense:", error);
    }
  };

  const renderDescription = (act) => {
    switch (act.type) {
      case "expense_added":
        return `added "${act.expense?.description}" in "${act.group?.name}"`;
      case "expense_deleted":
        return `deleted "${act.expense?.description}" in "${act.group?.name}"`;
      case "expense_restored":
        return `restored "${act.expense?.description}" in "${act.group?.name}"`;
      case "settlement_done":
        return `recorded a settlement in "${act.group?.name}"`;
      case "group_created":
        return `created the group "${act.group?.name}"`;
      default:
        return "did something";
    }
  };

  const renderActivities = () =>
    activities.map((act) => (
      <div key={act._id} className={styles.activityItem}>
        <div className={styles.icon}>📝</div>
        <div className={styles.details}>
          <p>
            <strong>{act.user?.name || "Someone"}</strong> {renderDescription(act)}
          </p>
          {act.expense && <p className={styles.amount}>₹{act.expense.amount}</p>}
          <span className={styles.date}>
            {new Date(act.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    ));

  const renderDeletedExpenses = () =>
    deletedExpenses.map((exp) => (
      <div key={exp._id} className={styles.activityItem}>
        <div className={styles.icon}>❌</div>
        <div className={styles.details}>
          <p>
            You deleted <strong>"{exp.description}"</strong> in{" "}
            <strong>{exp.group?.name}</strong>.
          </p>
          <p className={styles.amount}>You owe ₹{exp.amount}</p>
          <span className={styles.date}>
            {new Date(exp.updatedAt).toLocaleDateString()}
          </span>
        </div>
        <button
          className={styles.restoreBtn}
          onClick={() => handleRestore(exp._id)}
        >
          Undelete expense
        </button>
      </div>
    ));

  return (
    <div className={styles.container}>
      <h2>Recent Activity</h2>
      {loading ? (
        <p>Loading recent activity...</p>
      ) : (
        <>
          {renderActivities()}
          {renderDeletedExpenses()}
        </>
      )}
    </div>
  );
};

export default RecentActivity;
