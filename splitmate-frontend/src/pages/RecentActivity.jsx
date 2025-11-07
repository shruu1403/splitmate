import { useEffect, useState, useContext } from "react";
import { ReceiptText, Trash2, RotateCcw, Users2, HandCoins } from "lucide-react";
import BeatLoader from "react-spinners/BeatLoader";
import { getRecentActivity, getDeletedExpenses, restoreExpense } from "../api/recentActivity";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import styles from "../styles/recentActivity.module.css";

const RecentActivity = () => {
  const { user: currentUser } = useContext(AuthContext);
  const { socket } = useSocket();
  const [activities, setActivities] = useState([]);
  const [deletedExpenses, setDeletedExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  console.log("🔍 RecentActivity component rendered, socket:", socket ? "connected" : "not connected");

 useEffect(() => {
  if (typeof window === "undefined") return;   // ✅ important for SSR

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

  // Socket.IO real-time updates for activity
  useEffect(() => {
    if (typeof window === "undefined") return;  // ✅ SSR safe
    if (!socket) return;
    console.log("🔍 Socket useEffect triggered, socket:", socket ? "exists" : "null");

    const handleActivityUpdate = async () => {
      console.log("🔄 Activity update received, refreshing...");
      
      try {
        console.log("📡 Fetching activity data...");
        const recent = await getRecentActivity();
        const deleted = await getDeletedExpenses();
        setActivities(recent || []);
        setDeletedExpenses(deleted?.deletedExpenses || []);
        console.log("✅ Activity data updated");
      } catch (error) {
        console.error("❌ Failed to refresh activity:", error);
      }
    };

    console.log("🔌 Setting up socket listeners for activity updates");
    
    socket.on('expense_added', handleActivityUpdate);
    socket.on('expense_deleted', handleActivityUpdate);
    socket.on('expense_updated', handleActivityUpdate);
    socket.on('group_created', handleActivityUpdate);
    socket.on('group_deleted', handleActivityUpdate);
    socket.on('activity_updated', handleActivityUpdate);

    return () => {
      console.log("🔌 Cleaning up socket listeners");
      socket.off('expense_added', handleActivityUpdate);
      socket.off('expense_deleted', handleActivityUpdate);
      socket.off('expense_updated', handleActivityUpdate);
      socket.off('group_created', handleActivityUpdate);
      socket.off('group_deleted', handleActivityUpdate);
      socket.off('activity_updated', handleActivityUpdate);
    };
  }, [socket]); // Back to socket dependency but with simplified handler

  const [toast, setToast] = useState("");

  const handleRestore = async (id) => {
    try {
      await restoreExpense(id);
      setDeletedExpenses((prev) => prev.filter((exp) => exp._id !== id));

      // refresh activity list after restore
      const recent = await getRecentActivity();
      setActivities(recent || []);

      // feedback toast
      setToast("Expense restored");
      setTimeout(() => setToast(""), 1600);
    } catch (error) {
      console.error("Failed to restore expense:", error);
    }
  };

  const renderDescription = (act) => {
    // Check if this is the current user
    const isCurrentUser = String(act.user?._id) === String(currentUser?._id);
    const userName = isCurrentUser ? "You" : act.user?.name || "Someone";
    
    // Helper: find the counterparty for direct (friend) expenses
    const otherPartyName = (() => {
      const exp = act.expense;
      if (!exp) return null;
      // If there is no group, try to infer the other person from participants or paidBy/createdBy
      if (!act.group?.name) {
        const participants = exp.participants || [];
        // Prefer the participant who is not current user
        const other = participants.find(p => String(p?._id || p) !== String(currentUser?._id));
        if (other && other.name) return other.name;
        // Fallback to paidBy/createdBy if different from current user
        if (exp.paidBy && String(exp.paidBy?._id || exp.paidBy) !== String(currentUser?._id)) {
          return exp.paidBy.name || null;
        }
        if (exp.createdBy && String(exp.createdBy?._id || exp.createdBy) !== String(currentUser?._id)) {
          return exp.createdBy.name || null;
        }
      }
      return null;
    })();

    // Helper: find the counterparty for settlements (friend settlements)
    const settlementOtherParty = (() => {
      const settlement = act.settlement;
      if (!settlement) return null;
      // If there is no group, look at settlement participants
      if (!act.group?.name) {
        // Settlements are stored as expenses with paidBy (from) and splitAmong[0].user (to)
        // Check participants first
        if (settlement.participants && settlement.participants.length > 0) {
          const other = settlement.participants.find(p => String(p?._id || p) !== String(currentUser?._id));
          if (other && other.name) return other.name;
        }
        // Fallback: Check paidBy (the one who paid)
        if (settlement.paidBy && String(settlement.paidBy?._id || settlement.paidBy) !== String(currentUser?._id)) {
          return settlement.paidBy.name || null;
        }
        // Fallback: Check splitAmong (the one who received)
        if (settlement.splitAmong && settlement.splitAmong.length > 0) {
          const receiver = settlement.splitAmong[0].user;
          if (receiver && String(receiver?._id || receiver) !== String(currentUser?._id)) {
            return receiver.name || null;
          }
        }
      }
      return null;
    })();
    
    switch (act.type) {
      case "expense_added": {
        const desc = act.expense?.description;
        if (act.group?.name) {
          return (
            <>
              added <strong>"{desc}"</strong> in <strong>"{act.group.name}"</strong>
            </>
          );
        }
        return (
          <>
            added <strong>"{desc}"</strong>
            {otherPartyName ? (
              <>
                {" "}with <strong>{otherPartyName}</strong>
              </>
            ) : null}
          </>
        );
      }
      case "expense_deleted": {
        const desc = act.expense?.description;
        return (
          <>
            deleted <strong>"{desc}"</strong>
            {act.group?.name ? (
              <>
                {" "}in <strong>"{act.group.name}"</strong>
              </>
            ) : null}
          </>
        );
      }
      case "expense_restored": {
        const desc = act.expense?.description;
        return (
          <>
            restored <strong>"{desc}"</strong>
            {act.group?.name ? (
              <>
                {" "}in <strong>"{act.group.name}"</strong>
              </>
            ) : null}
          </>
        );
      }
      case "settlement_done":
        return (
          <>
            recorded a settlement
            {act.group?.name ? (
              <>
                {" "}in <strong>"{act.group.name}"</strong>
              </>
            ) : settlementOtherParty ? (
              <>
                {" "}with <strong>{settlementOtherParty}</strong>
              </>
            ) : null}
          </>
        );
      case "group_created":
        if (act.group?.name) {
          return (
            <>
              created the group <strong>"{act.group.name}"</strong>
            </>
          );
        }
        return act.description || <>created a group</>;
      case "group_deleted":
        return act.description || <>deleted a group</>;
      default:
        return act.description || <>did something</>;
    }
  };

  const iconForType = (type) => {
    switch (type) {
      case 'expense_added':
      case 'expense_updated':
        return { Icon: ReceiptText, cls: styles.iconExpense };
      case 'expense_deleted':
      case 'deleted_expense':
        return { Icon: Trash2, cls: styles.iconDelete };
      case 'expense_restored':
        return { Icon: RotateCcw, cls: styles.iconRestore };
      case 'settlement_done':
        return { Icon: HandCoins, cls: styles.iconSettlement };
      case 'group_created':
      case 'group_deleted':
        return { Icon: Users2, cls: styles.iconGroup };
      default:
        return { Icon: ReceiptText, cls: styles.iconGeneric };
    }
  };

  const renderActivities = () => {
    // Build a Set of deleted expense IDs
    const deletedIds = new Set(deletedExpenses.map(exp => exp._id));

    // Filter out 'expense_deleted' activities for expenses that are in deletedExpenses
    const filteredActivities = activities.filter(act => {
      if (act.type === 'expense_deleted' && act.expense && deletedIds.has(act.expense._id)) {
        return false;
      }
      return true;
    });

    // Combine filtered activities and deleted expenses, then sort by date
    const allItems = [
      ...filteredActivities.map(act => ({ ...act, type: act.type, itemType: 'activity' })),
      ...deletedExpenses.map(exp => ({
        ...exp,
        type: 'deleted_expense',
        itemType: 'deleted',
        createdAt: exp.updatedAt || exp.createdAt
      }))
    ];

    // Sort by date (newest first)
    const sortedItems = allItems.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    return sortedItems.map((item) => {
      const { Icon, cls } = iconForType(item.type);
      const dateStr = new Date(item.updatedAt || item.createdAt).toLocaleDateString();

      if (item.itemType === 'deleted') {
        return (
          <div key={item._id} className={styles.activityItem}>
            <div className={`${styles.iconCircle} ${cls}`}>
              <Icon size={18} />
            </div>
            <div className={styles.content}>
              <div className={styles.row}>
                <p className={styles.title}>
                  <strong>You</strong> deleted <strong>"{item.description}"</strong>
                  {item.groupId?.name && (<>
                    {" "}in <strong>{item.groupId.name}</strong>
                  </>)}
                  .
                </p>
                <div className={styles.right}>
                  <button
                    className={styles.restoreBtn}
                    onClick={() => handleRestore(item._id)}
                  >
                    Restore
                  </button>
                </div>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.date}>{dateStr}</span>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div key={item._id} className={styles.activityItem}>
          <div className={`${styles.iconCircle} ${cls}`}>
            <Icon size={18} />
          </div>
          <div className={styles.content}>
            <div className={styles.row}>
              <p className={styles.title}>
                <strong>{item.user?._id === currentUser?._id ? "You" : (item.user?.name || "Someone")}</strong>{" "}
                {renderDescription(item)}
              </p>
              <div className={styles.right}>
                {item.expense && (
                  <span className={styles.amount}>₹{item.expense.amount}</span>
                )}
                {item.type === 'settlement_done' && item.settlement?.amount && (
                  <span className={styles.amount}>₹{item.settlement.amount}</span>
                )}
              </div>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      );
    });
  };

  // renderDeletedExpenses function removed - now integrated with activities

  if (loading) return (
    <div className={styles.loaderContainer}>
      <BeatLoader size={14} color="#05224dff" />
    </div>
  );

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Recent Activity</h2>
      <>{renderActivities()}</>
      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">{toast}</div>
      )}
    </div>
  );
};

export default RecentActivity;
