import { useEffect, useState } from "react";
import { getOverallBalance } from "../api/dashboard";
import { useSocket } from "../context/SocketContext";
import AddExpenseModal from "../components/AddExpense";
import { useSettlement } from "../context/SettlementContext";
import styles from "../styles/dashboard.module.css";
import { Banknote, TrendingDown, TrendingUp } from "lucide-react";
import BeatLoader from "react-spinners/BeatLoader";

const Dashboard = () => {
  const { refreshTrigger } = useSettlement();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const { socket } = useSocket();

  const fetchBalance = async () => {
    try {
      const data = await getOverallBalance();
      console.log("Dashboard balance data:", data);
      setBalance(data);
    } catch (err) {
      setError(err.msg || "Failed to load balance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [refreshTrigger]); // Re-fetch when settlements occur

  // Socket.IO real-time balance updates
  useEffect(() => {
    if (socket) {
      const handleBalanceUpdate = () => {
        console.log("Balance update received, refreshing dashboard");
        fetchBalance();
      };

      socket.on('expense_added', handleBalanceUpdate);
      socket.on('expense_deleted', handleBalanceUpdate);
      socket.on('expense_updated', handleBalanceUpdate);
      socket.on('settlement_recorded', handleBalanceUpdate); // Add settlement listener

      return () => {
        socket.off('expense_added', handleBalanceUpdate);
        socket.off('expense_deleted', handleBalanceUpdate);
        socket.off('expense_updated', handleBalanceUpdate);
        socket.off('settlement_recorded', handleBalanceUpdate);
      };
    }
  }, [socket]);

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <BeatLoader size={14} color="#05224dff" />
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  // Show welcome only if there's truly no balance object (new user), not when balances are zero due to settlements
  if (!balance) {
    return (
      <div className={styles.center}>
        <h2>Welcome to SplitMate🎉</h2>
        <p>You don’t have any groups or expenses yet.</p>
        <p>Start by creating a group or adding an expense.</p>
      </div>
    );
  }

  // Ensure minus sign appears before the rupee symbol when negative, e.g. -₹2638.67
  const formatINRWithLeadingMinus = (amount) => {
    const absStr = Math.abs(amount).toFixed(2);
    return amount < 0 ? `-₹${absStr}` : `₹${absStr}`;
  };
  


  const getInitials = (name = "") => {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const second = parts.length > 1 ? parts[1][0] : "";
    return (first + second).toUpperCase();
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        {/* <h1 className={styles.greeting}>HELLO Shruti</h1>
        <h1 className={styles.greetings}>HELLO Shruti</h1>
        <h1 className={styles.greetingss}>HELLO Shruti</h1> */}

        <h1 className={styles.heading}>Dashboard</h1>
        <button 
          className={styles.addButton}
          onClick={() => setShowAddExpense(true)}
        >
          + Add Expense
        </button>
      </div>

      {/* Top summary row */}
      <div className={styles.summaryRow}>
        <div className={`${styles.summaryCard} ${styles.cardTotal}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}><Banknote size={18} /></span>
            <p>Total balance</p>
          </div>
          <span
            className={`${balance.overallBalance >= 0 ? styles.positive : styles.negative} ${styles.dominantValue}`}
          >
            {formatINRWithLeadingMinus(balance.overallBalance)}
          </span>
        </div>
        <div className={`${styles.summaryCard} ${styles.cardOwe}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}><TrendingDown size={18} /></span>
            <p>You owe</p>
          </div>
          <span className={styles.negative}>{`-₹${Math.abs(balance.youOwe).toFixed(2)}`}</span>
        </div>
        <div className={`${styles.summaryCard} ${styles.cardOwed}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}><TrendingUp size={18} /></span>
            <p>You are owed</p>
          </div>
          <span className={styles.positive}>
            ₹{balance.youAreOwed.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Simple overview sections */}
      <div className={styles.oweContainer}>
        {/* You Owe Section */}
        <div className={styles.oweSection}>
          <h3>YOU OWE</h3>
          {balance.breakdown.filter((b) => b.amount < -0.01).length === 0 ? (
            <p className={styles.noBalance}>You owe nothing!</p>
          ) : (
            balance.breakdown
              .filter((b) => b.amount < -0.01)
              .map((b) => (
                <div key={`${b.userId}-${b.type || 'group'}`} className={styles.personRow}>
                  <div className={styles.personInfo}>
                    <span className={styles.avatar}>{getInitials(b.name)}</span>

                    <span className={styles.personName}>
                      {b.name}
                      <small className={styles.typeLabel}>
                        {b.type === 'friend' ? ' (Friend)' : ' (Group)'}
                      </small>
                    </span>
                  </div>
                  <span className={`${styles.amountBadge} ${styles.amountNegative}`}>
                    -₹{Math.abs(b.amount).toFixed(2)}
                  </span>
                </div>
              ))
          )}
        </div>

        {/* You Are Owed Section */}
        <div className={styles.oweSection}>
          <h3>YOU ARE OWED</h3>
          {balance.breakdown.filter((b) => b.amount > 0.01).length === 0 ? (
            <p className={styles.noBalance}>You are not owed anything!</p>
          ) : (
            balance.breakdown
              .filter((b) => b.amount > 0.01)
              .map((b) => (
                <div key={`${b.userId}-${b.type || 'group'}`} className={styles.personRow}>
                  <div className={styles.personInfo}>
                    <span className={styles.avatar}>{getInitials(b.name)}</span>
                    <span className={styles.personName}>
                      {b.name}
                      <small className={styles.typeLabel}>
                        {b.type === 'friend' ? ' (Friend)' : ' (Group)'}
                      </small>
                    </span>
                  </div>
                  <span className={`${styles.amountBadge} ${styles.amountPositive}`}>
                    ₹{b.amount.toFixed(2)}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={(expense) => {
          console.log("Expense added from dashboard:", expense);
          fetchBalance(); // Refresh balance after adding expense
        }}
      />

    </div>
  );
};

export default Dashboard;
