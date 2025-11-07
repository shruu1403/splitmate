import { useEffect, useState } from "react";
import RiseLoader from "react-spinners/RiseLoader";
import { Trash2, Info, Banknote, TrendingDown, TrendingUp } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "../styles/groups.module.css";
import sidebarStyles from "../styles/sidebar.module.css";
import { getSingleGroup, deleteGroup } from "../api/groups";
import { getAllExpenses, deleteExpense, getExpense } from "../api/expenses";
import AddExpenseModal from "../components/AddExpense";
import SettleUpModal from "../components/SettleUpModal";
import { generateInviteLink } from "../api/invite";
import { useSocket } from "../context/SocketContext";
import { useSettlement } from "../context/SettlementContext";
import { getExpenseLabel } from "../utils/expenseLabelStore";
import { getLabelByKey } from "../utils/labelCatalog";
import { recordSettlement } from "../api/settlements";
import { toast } from "react-hot-toast";

export default function Groups() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const { socket, joinGroupRoom, leaveGroupRoom } = useSocket();
  const { handleSettlement, refreshTrigger } = useSettlement();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expenses, setExpenses] = useState([]); // regular expenses only (no settlements)
  const [loading, setLoading] = useState(true);

  // UI state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [settlementData, setSettlementData] = useState(null);
  const [settlements, setSettlements] = useState([]); // extracted settlement records
  const [toastMessage, setToastMessage] = useState("");

  // decode user from token
  const currentUser = (() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return { _id: payload.userID, id: payload.userID, name: payload.name, email: payload.email };
    } catch {
      return null;
    }
  })();

  // small helpers
  const roundToTwo = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

  // Helper to normalize payers across legacy single paidBy or new payers[]
  const getPayers = (expense) => {
    if (!expense) return [];
    if (Array.isArray(expense.payers) && expense.payers.length > 0) {
      return expense.payers.map((p) => {
        const uid = typeof p.user === 'object' ? p.user._id : p.user;
        const name = typeof p.user === 'object' ? (p.user.name || p.user.email) : (selectedGroup?.members?.find(m => m._id === p.user)?.name || 'Someone');
        return { user: uid, amount: Number(p.amount || 0), name };
      });
    }
    const uid = typeof expense.paidBy === 'object' ? expense.paidBy._id : expense.paidBy;
    const name = typeof expense.paidBy === 'object' ? (expense.paidBy.name || expense.paidBy.email) : (selectedGroup?.members?.find(m => m._id === expense.paidBy)?.name || 'Someone');
    return uid ? [{ user: uid, amount: Number(expense.amount || 0), name }] : [];
  };

  const getUserPaidAmount = (expense, userId) => {
    const payers = getPayers(expense);
    const p = payers.find((pp) => String(pp.user) === String(userId));
    return p ? Number(p.amount || 0) : 0;
  };

  // Format payer label for UI: prefer "You" when current user is among payers
  const formatPayersLabel = (payersArr, user) => {
    if (!Array.isArray(payersArr) || payersArr.length === 0) return 'Someone';
    const youIdx = user ? payersArr.findIndex(p => String(p.user) === String(user._id)) : -1;
    if (payersArr.length === 1) {
      return youIdx === 0 ? 'You' : (payersArr[0]?.name || 'Someone');
    }
    if (youIdx !== -1) {
      const others = payersArr.length - 1;
      return others > 0 ? `You + ${others} more` : 'You';
    }
    return `${payersArr[0]?.name || 'Someone'} + ${payersArr.length - 1} more`;
  };

  // robust detection whether an expense entry is a settlement record
  const isSettlementExpense = (expense) => {
    if (!expense) return false;
    // explicit type flag
    if (expense.type && String(expense.type).toLowerCase() === "settlement") return true;
    // explicit boolean flag
    if (expense.isSettlement || expense.settlement === true || expense.settlementFlag === true) return true;
    // description that contains the word settlement (common case)
    const desc = String(expense.description || "").toLowerCase();
    if (desc.includes("settlement")) return true;
    // some backends store amount 0 and additional meta showing it's a settlement
    if (Number(expense.amount) === 0 && (expense.meta?.isSettlement || expense.settlementMeta)) return true;
    return false;
  };

  // try to extract a numeric amount from various fields (fallback when amount is 0 in DB)
  const parseAmountFromText = (text) => {
    if (!text) return null;
    const m = String(text).match(/₹?\s*([\d,]+(?:\.\d{1,2})?)/);
    if (!m) return null;
    return Number(m[1].replace(/,/g, ""));
  };

  // Build per-user nets for an expense and amount-aware settlement check
  const getExpenseParticipantNets = (expense) => {
    const payers = getPayers(expense);
    const paidByUserMap = {};
    payers.forEach(p => {
      const id = String(typeof p.user === 'object' ? p.user._id : p.user);
      paidByUserMap[id] = (paidByUserMap[id] || 0) + Number(p.amount || 0);
    });

    const participants = [];
    const nets = {};
    expense.splitAmong?.forEach((splitEntry) => {
      const userId = String(typeof splitEntry.user === 'object' ? splitEntry.user._id : splitEntry.user);
      const share = Number(splitEntry.share || splitEntry.amount || 0);
      const paid = Number(paidByUserMap[userId] || 0);
      const net = roundToTwo(paid - share);
      nets[userId] = net;
      if (Math.abs(net) >= 0.01) {
        participants.push({ userId, net, owes: net < 0 });
      }
    });
    return { participants, nets };
  };

  // Expense is settled only when each debtor has paid at least their deficit and each creditor has received their surplus
  const isExpenseSettled = (expense) => {
    if (!expense) return false;
    const { participants } = getExpenseParticipantNets(expense);
    if (participants.length === 0) return false;

    if (!settlements || settlements.length === 0) return false;
    const expenseTs = new Date(expense.createdAt || expense.date).getTime();

    const debtors = new Set(participants.filter(p => p.owes).map(p => p.userId));
    const creditors = new Set(participants.filter(p => !p.owes).map(p => p.userId));

    const paidAfter = {};     // debtor -> total paid to creditors after this expense
    const receivedAfter = {}; // creditor -> total received from debtors after this expense

    settlements.forEach(st => {
      if (st.isDeleted) return;
      const ts = new Date(st.createdAt || st.date).getTime();
      if (ts <= expenseTs) return;
      const fromId = String(typeof st.paidBy === 'object' ? st.paidBy._id : st.paidBy);
      const toId = st.splitAmong?.[0]
        ? String(typeof st.splitAmong[0].user === 'object' ? st.splitAmong[0].user._id : st.splitAmong[0].user)
        : null;
      const amt = Number(st.amount || 0);
      if (!amt) return;
      if (debtors.has(fromId) && toId && creditors.has(toId)) {
        paidAfter[fromId] = roundToTwo((paidAfter[fromId] || 0) + amt);
        receivedAfter[toId] = roundToTwo((receivedAfter[toId] || 0) + amt);
      }
    });

    return participants.every(p => {
      if (p.owes) {
        const required = Math.abs(p.net);
        return (paidAfter[p.userId] || 0) + 0.0001 >= required;
      }
      const required = p.net;
      return (receivedAfter[p.userId] || 0) + 0.0001 >= required;
    });
  };

  // fetch group + expenses and separate settlement records from regular expenses
  const fetchData = async () => {
    setLoading(true);
    try {
      const groupDetail = await getSingleGroup(groupId);
      const expenseData = await getAllExpenses(groupId);
      const allExpenses = expenseData.expenses || [];

      // separate settlement entries from normal expenses (exclude soft-deleted)
      const settlementExpenses = allExpenses.filter(e => isSettlementExpense(e) && !e.isDeleted);
      const normalExpenses = allExpenses.filter((e) => !isSettlementExpense(e) && !e.isDeleted);

      setSelectedGroup(groupDetail.group || groupDetail);
      setExpenses(normalExpenses);
      setSettlements(settlementExpenses);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, refreshTrigger]); // Add refreshTrigger to watch for global settlement updates

  // real-time updates
  useEffect(() => {
    if (socket && groupId) {
      joinGroupRoom(groupId);

      const handleNewExpense = (data) => fetchData();
      const handleExpenseDeleted = (data) => fetchData();
      const handleExpenseUpdated = (data) => fetchData();
      const handleSettlementRecorded = (data) => fetchData();

      socket.on("expense_added", handleNewExpense);
      socket.on("expense_deleted", handleExpenseDeleted);
      socket.on("expense_updated", handleExpenseUpdated);
      socket.on("settlement_recorded", handleSettlementRecorded);

      return () => {
        socket.off("expense_added", handleNewExpense);
        socket.off("expense_deleted", handleExpenseDeleted);
        socket.off("expense_updated", handleExpenseUpdated);
        socket.off("settlement_recorded", handleSettlementRecorded);
        leaveGroupRoom(groupId);
      };
    }
  }, [socket, groupId, joinGroupRoom, leaveGroupRoom]);

  const handleAddExpense = () => fetchData();

  const confirmDeleteExpense = (expenseId) => {
    // Check if expense is settled before allowing deletion
    const expense = expenses.find(e => e._id === expenseId);
    if (expense && isExpenseSettled(expense)) {
      // alert("Cannot delete a settled expense. This expense has already been settled up.");
      toast.info("Cannot delete a settled expense. This expense has already been settled up.");
      return;
    }
    setDeletingExpenseId(expenseId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    
    // Double-check if expense is settled
    const expense = expenses.find(e => e._id === deletingExpenseId);
    if (expense && isExpenseSettled(expense)) {
      toast.info("Cannot delete a settled expense. This expense has already been settled up.");
      // alert("Cannot delete a settled expense. This expense has already been settled up.");
      setShowDeleteConfirm(false);
      setDeletingExpenseId(null);
      return;
    }
    
    try {
      await deleteExpense(deletingExpenseId);
      await fetchData();
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete expense");
      // alert("Failed to delete expense");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const handleGenerateLink = async () => {
    try {
      const { link } = await generateInviteLink(groupId);
      try {
        await navigator.clipboard.writeText(link);
        setToastMessage("Copied to clipboard");
      } catch {
        // Fallback copy method
        const ta = document.createElement("textarea");
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setToastMessage("Copied to clipboard");
      }
    } catch (error) {
      console.error("Failed to generate link:", error);
      setToastMessage("Failed to generate link");
    } finally {
      setTimeout(() => setToastMessage("") , 1600);
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await deleteGroup(groupId);
      setShowDeleteGroupConfirm(false);
      navigate("/dashboard");
    } catch (err) {
      console.error("Error deleting group:", err);
      toast.error("Failed to delete group");
      // alert(err.message || "Failed to delete group");
    }
  };

  // Calculate who I owe money to in this group (returns only the positive balances - people you must pay)
  const getGroupBalancesToSettle = () => {
    if (!currentUser || !selectedGroup) return [];
    
    // Combine expenses and settlements for balance calculation
    const allTransactions = [...expenses, ...settlements];
    
    if (allTransactions.length === 0) return [];

    const balanceMap = {};

    // initialize
    selectedGroup.members?.forEach((member) => {
      if (String(member._id) !== String(currentUser._id)) {
        balanceMap[member._id] = { user: member, amount: 0 };
      }
    });

    // compute from all transactions (expenses + settlements)
    allTransactions.forEach((transaction) => {
      if (transaction.isDeleted) return;
      
      const isSettlement = isSettlementExpense(transaction);
      const payers = getPayers(transaction);
      const totalPaid = payers.reduce((s, p) => s + Number(p.amount || 0), 0) || Number(transaction.amount || 0);

      if (isSettlement) {
        // Settlement: paidBy (from) pays splitAmong[0].user (to)
        // If I paid someone in a settlement, it REDUCES what I owe them
        // If someone paid me in a settlement, it REDUCES what they owe me (so I owe them less)
        
        const toUserId = typeof transaction.splitAmong?.[0]?.user === "object" 
          ? transaction.splitAmong[0].user._id 
          : transaction.splitAmong?.[0]?.user;
        const settlementAmount = Number(transaction.amount || 0);
        
        const paidById = typeof transaction.paidBy === "object" ? transaction.paidBy._id : transaction.paidBy;
        if (String(paidById) === String(currentUser._id)) {
          // I paid someone in settlement => reduces what I owe them
          if (balanceMap[toUserId]) {
            balanceMap[toUserId].amount -= settlementAmount;
          }
        } else if (String(toUserId) === String(currentUser._id)) {
          // Someone paid me in settlement => reduces what they owe me (increases what I owe them - negative)
          if (balanceMap[paidById]) {
            balanceMap[paidById].amount += settlementAmount;
          }
        }
      } else {
        // Regular expense logic with multi-payer support
        const myShareEntry = transaction.splitAmong?.find((s) => {
          const userId = typeof s.user === 'object' ? s.user._id : s.user;
          return String(userId) === String(currentUser._id);
        });
        if (!myShareEntry) return;
        const myShare = Number(myShareEntry.share || myShareEntry.amount || 0);
        const myPaid = getUserPaidAmount(transaction, currentUser._id);

        if (myShare <= myPaid + 0.0001) {
          // I don't owe others in this expense (I may have lent, but this map tracks only amounts I owe to others)
          return;
        }

        const deficit = myShare - myPaid; // what I owe to payers

        // Build a map of each user's share for overpayment computation
        const shareMap = {};
        (transaction.splitAmong || []).forEach((s) => {
          const uid = typeof s.user === 'object' ? s.user._id : s.user;
          shareMap[String(uid)] = Number(s.share || s.amount || 0);
        });

        // Consider only other payers who overpaid (contribution > their share)
        const otherPayers = payers.filter(p => String(p.user) !== String(currentUser._id));
        const overpayers = otherPayers
          .map(p => ({
            user: p.user,
            overpay: roundToTwo(Number(p.amount || 0) - Number(shareMap[String(p.user)] || 0))
          }))
          .filter(p => p.overpay > 0);

        let totalOverpay = overpayers.reduce((s, p) => s + p.overpay, 0);

        if (totalOverpay <= 0) {
          // Fallback: distribute by contributions if no one overpaid (edge case)
          const otherTotal = otherPayers.reduce((s, p) => s + Number(p.amount || 0), 0) || totalPaid;
          otherPayers.forEach((p) => {
            const proportion = otherTotal > 0 ? (Number(p.amount || 0) / otherTotal) : 0;
            const oweToThisPayer = roundToTwo(deficit * proportion);
            if (balanceMap[p.user]) {
              balanceMap[p.user].amount += oweToThisPayer;
            }
          });
        } else {
          // Distribute deficit proportional to overpayment amounts; last one gets remainder to fix rounding
          let remaining = roundToTwo(deficit);
          overpayers.forEach((p, idx) => {
            let shareAmt = 0;
            if (idx === overpayers.length - 1) {
              shareAmt = remaining;
            } else {
              const proportion = p.overpay / totalOverpay;
              shareAmt = roundToTwo(deficit * proportion);
              remaining = roundToTwo(remaining - shareAmt);
            }
            if (balanceMap[p.user]) {
              balanceMap[p.user].amount += shareAmt;
            }
          });
        }
      }
    });

    const finalBalances = Object.values(balanceMap).filter((b) => roundToTwo(b.amount) > 0).map(b => ({ ...b, amount: roundToTwo(b.amount) }));

    // Only return positive balances (you owe these people)
    return finalBalances;
  };

  const handleSettleUp = (balance) => {
    
    setSettlementData({
      fromUser: {
        _id: currentUser._id,
        name: currentUser.name,
      },
      toUser: {
        _id: balance.user._id,
        name: balance.user.name,
      },
      amount: balance.amount,
      groupId: groupId,
      groupName: selectedGroup?.name,
      type: "group",
    });
    setShowSettleUp(true);
  };

  // For receivables: record when someone paid you
  const handleSettleReceive = (balance) => {
    setSettlementData({
      fromUser: {
        _id: balance.user._id,
        name: balance.user.name,
      },
      toUser: {
        _id: currentUser._id,
        name: currentUser.name,
      },
      amount: balance.amount,
      groupId: groupId,
      groupName: selectedGroup?.name,
      type: "group",
    });
    setShowSettleUp(true);
  };

  // Handle recording offsetting balances settlement (no modal)
  const handleRecordOffsetSettlement = async () => {
    try {
      // Get all individual balances that need settling
      const { youOwe, youAreOwed } = calculateOverallBalance();
      
      if (youOwe === 0 && youAreOwed === 0) {
        toast.info("No balances to settle!");
        // alert("No balances to settle!");
        return;
      }

      // Build net map to find all people involved
      const netMap = {};
      selectedGroup.members?.forEach(m => { netMap[String(m._id)] = 0; });

      const addToNet = (uid, delta) => {
        const key = String(uid);
        if (!(key in netMap)) netMap[key] = 0;
        netMap[key] = roundToTwo((netMap[key] || 0) + Number(delta || 0));
      };

      // Process expenses
      expenses.forEach(exp => {
        if (exp.isDeleted) return;
        const payers = getPayers(exp);
        const paidByUserMap = {};
        payers.forEach(p => { 
          const id = String(p.user); 
          paidByUserMap[id] = (paidByUserMap[id] || 0) + Number(p.amount || 0); 
        });
        (exp.splitAmong || []).forEach(s => {
          const uid = typeof s.user === 'object' ? s.user._id : s.user;
          const share = Number(s.amount || s.share || 0);
          const paid = Number(paidByUserMap[String(uid)] || 0);
          addToNet(uid, paid - share);
        });
      });

      // Process existing settlements
      settlements.forEach(st => {
        if (st.isDeleted) return;
        const amt = Number(st.amount || 0);
        const paidById = typeof st.paidBy === 'object' ? st.paidBy._id : st.paidBy;
        const toUserId = st.splitAmong?.[0] ? (typeof st.splitAmong[0].user === 'object' ? st.splitAmong[0].user._id : st.splitAmong[0].user) : null;
        if (paidById) addToNet(paidById, amt);
        if (toUserId) addToNet(toUserId, -amt);
      });

      const myId = String(currentUser._id);
      const myNet = roundToTwo(netMap[myId] || 0);

      // Create settlement records for each person I need to settle with
      const settlementPromises = [];
      
      // In offsetting scenario (myNet = 0), we still need to settle individual balances
      // So we look at gross amounts directly from youOwe and youAreOwed
      
      for (const [userId, net] of Object.entries(netMap)) {
        if (userId === myId) continue;
        if (net === 0) continue;

        // If they have positive net (they are owed) and I have things to pay
        if (net > 0 && youOwe > 0) {
          const settleAmount = Math.min(youOwe, Math.abs(net));
          if (settleAmount >= 0.01) {
            settlementPromises.push(
              recordSettlement({
                groupId: groupId,
                from: myId,
                to: userId,
                amount: settleAmount,
                method: "cash"
              })
            );
          }
        }
        // If they have negative net (they owe) and I have things to receive
        else if (net < 0 && youAreOwed > 0) {
          const settleAmount = Math.min(youAreOwed, Math.abs(net));
          if (settleAmount >= 0.01) {
            settlementPromises.push(
              recordSettlement({
                groupId: groupId,
                from: userId,
                to: myId,
                amount: settleAmount,
                method: "cash"
              })
            );
          }
        }
      }

      if (settlementPromises.length === 0) {
        toast.info("No settlements needed!");
        // alert("No settlements needed!");
        return;
      }

  // Record all settlements
  await Promise.all(settlementPromises);
      
  toast.success(`Settled up! ${settlementPromises.length} transaction(s) recorded.`);
      
      // Refresh data
      await fetchData();
      
    } catch (error) {
      console.error("Failed to record offset settlement:", error);
      toast.error("Failed to record settlement");
      // alert(error.message || "Failed to record settlement");
    }
  };

  // persist settlement through API using SettlementContext
  const handleConfirmSettlement = async () => {
    try {
      if (!settlementData) throw new Error("No settlement data to record");
      
      // Use SettlementContext's handleSettlement function
      await handleSettlement({
        groupId: settlementData.groupId,
        from: settlementData.fromUser?._id || settlementData.fromUser,
        to: settlementData.toUser?._id || settlementData.toUser,
        amount: settlementData.amount,
        method: settlementData.method || "cash",
      });
      
      // UI state updates
      setShowSettleUp(false);
      setSettlementData(null);
  toast.success("Settlement has been recorded.");
  // Immediately refresh to reflect the new settlement in UI
  await fetchData();
    } catch (error) {
      console.error("Settlement failed:", error);
      
      // Show more detailed error message
      let errorMsg = "Settlement failed: ";
      if (error.message) {
        errorMsg += error.message;
      } else if (error.msg) {
        errorMsg += error.msg;
      } else {
        errorMsg += "Unknown error";
      }
      toast.error(errorMsg);
      // alert(errorMsg);
      throw error;
    }
  };

  const calculateBalance = (expense) => {
    if (!currentUser || !expense.splitAmong) return null;

    const myShare = expense.splitAmong.find((s) => {
      const userId = typeof s.user === "object" ? s.user._id : s.user;
      return String(userId) === String(currentUser._id);
    });

    if (!myShare) return null;
    const shareAmount = Number(myShare.amount || myShare.share || 0);
    const myPaid = getUserPaidAmount(expense, currentUser._id);
    const net = roundToTwo(myPaid - shareAmount);
    if (net > 0) {
      return { type: 'lent', amount: net, myShare: shareAmount, totalPaid: myPaid };
    }
    if (net < 0) {
      return { type: 'owe', amount: Math.abs(net), myShare: shareAmount };
    }
    return { type: 'even', amount: 0, myShare: shareAmount };
  };

  const calculateDetailedBalance = (expense) => {
    if (!expense.splitAmong || !selectedGroup?.members) return {};

    const balances = {};
    const payers = getPayers(expense);

    expense.splitAmong.forEach(split => {
      const userId = typeof split.user === 'object' ? split.user._id : split.user;
      const userName = typeof split.user === 'object' ? split.user.name :
        selectedGroup.members.find(m => m._id === userId)?.name || 'Someone';
      const shareAmount = Number(split.amount || split.share || 0);
      const paidByUser = payers.find(p => String(p.user) === String(userId));
      const paidAmt = paidByUser ? Number(paidByUser.amount || 0) : 0;
      const net = roundToTwo(paidAmt - shareAmount);
      balances[userId] = {
        name: userName,
        paid: paidAmt,
        owes: net < 0 ? Math.abs(net) : 0,
        gets: net > 0 ? net : 0,
        share: shareAmount
      };
    });

    // Build a human label for payers
    const payerNames = payers.map(p => p.name).filter(Boolean);
    const paidByName = payerNames.length <= 1 ? (payerNames[0] || 'Someone') : `${payerNames[0]} + ${payerNames.length - 1} more`;
    return { balances, paidByName, totalAmount: expense.amount };
  };

  // Build a list of members who owe ME (receivables), with amounts
  const getGroupBalancesToReceive = () => {
    if (!currentUser || !selectedGroup) return [];
    // Compute net per user across expenses and settlements
    const netMap = {}; // userId -> net (paid - share), adjusted by settlements
    selectedGroup.members?.forEach(m => { netMap[String(m._id)] = 0; });

    const addToNet = (uid, delta) => {
      const key = String(uid);
      if (!(key in netMap)) netMap[key] = 0;
      netMap[key] = roundToTwo((netMap[key] || 0) + Number(delta || 0));
    };

    // Expenses
    expenses.forEach(exp => {
      if (exp.isDeleted) return;
      const isSettlement = isSettlementExpense(exp);
      if (isSettlement) return; // handle settlements below
      const payers = getPayers(exp);
      const paidByUserMap = {};
      payers.forEach(p => { paidByUserMap[String(p.user)] = (paidByUserMap[String(p.user)] || 0) + Number(p.amount || 0); });
      (exp.splitAmong || []).forEach(s => {
        const uid = typeof s.user === 'object' ? s.user._id : s.user;
        const share = Number(s.amount || s.share || 0);
        const paid = Number(paidByUserMap[String(uid)] || 0);
        addToNet(uid, paid - share);
      });
    });

    // Settlements: payer gives money to receiver
    settlements.forEach(st => {
      if (st.isDeleted) return;
      if (!isSettlementExpense(st)) return;
      const amt = Number(st.amount || 0);
      const paidById = typeof st.paidBy === 'object' ? st.paidBy._id : st.paidBy;
      const toUserId = st.splitAmong?.[0] ? (typeof st.splitAmong[0].user === 'object' ? st.splitAmong[0].user._id : st.splitAmong[0].user) : null;
      if (paidById) addToNet(paidById, amt);
      if (toUserId) addToNet(toUserId, -amt);
    });

    const myId = String(currentUser._id);
    const myCredit = Math.max(0, netMap[myId] || 0);
    if (myCredit <= 0) return [];

    // Debtors are users with negative net
    const debtors = selectedGroup.members
      .filter(m => String(m._id) !== myId)
      .map(m => ({ user: m, net: netMap[String(m._id)] || 0 }))
      .filter(entry => entry.net < 0)
      .map(entry => ({ user: entry.user, owe: Math.abs(entry.net) }));

    // Allocate my credit among debtors
    let remaining = myCredit;
    const results = [];
    for (const d of debtors) {
      if (remaining <= 0) break;
      const pay = roundToTwo(Math.min(remaining, d.owe));
      if (pay > 0) {
        results.push({ user: d.user, amount: pay });
        remaining = roundToTwo(remaining - pay);
      }
    }
    return results;
  };

  // Unified per-person net computed directly from transactions and settlements
  // Positive => they owe you; Negative => you owe them
  const getGroupNetByPerson = () => {
    if (!currentUser || !selectedGroup) return [];

    const myId = String(currentUser._id);
    const bilateralBalances = {}; // userId -> amount (positive = they owe me, negative = I owe them)

    // Process ALL expenses; settlements below will offset amounts
    expenses.forEach(exp => {
      if (exp.isDeleted) return;
      
      // Check if I'm involved in this expense
      const myShareEntry = exp.splitAmong?.find((s) => {
        const userId = typeof s.user === 'object' ? s.user._id : s.user;
        return String(userId) === myId;
      });
      
      if (!myShareEntry) return; // I'm not involved
      
      const myShare = Number(myShareEntry.share || myShareEntry.amount || 0);
      
      // Get who paid and how much
      const payers = getPayers(exp);
      const paidByUserMap = {};
      payers.forEach(p => { 
        const id = String(p.user); 
        paidByUserMap[id] = (paidByUserMap[id] || 0) + Number(p.amount || 0); 
      });
      
      const myPaid = Number(paidByUserMap[myId] || 0);
      const myNet = roundToTwo(myPaid - myShare); // positive if I overpaid, negative if I underpaid
      
      // For each OTHER person in this expense, calculate bilateral balance
      exp.splitAmong?.forEach((splitEntry) => {
        const userId = typeof splitEntry.user === 'object' ? splitEntry.user._id : splitEntry.user;
        const userIdStr = String(userId);
        
        if (userIdStr === myId) return; // Skip myself
        
        const theirShare = Number(splitEntry.share || splitEntry.amount || 0);
        const theirPaid = Number(paidByUserMap[userIdStr] || 0);
        const theirNet = roundToTwo(theirPaid - theirShare);
        
  if (!bilateralBalances[userIdStr]) bilateralBalances[userIdStr] = 0;
        
        // Bilateral logic:
        // If I paid more than my share AND they paid less than their share:
        //   They owe me a portion of what I overpaid (proportional to their deficit)
        // If they paid more than their share AND I paid less than my share:
        //   I owe them a portion of what they overpaid (proportional to my deficit)
        
        if (myNet > 0 && theirNet < 0) {
          // I overpaid, they underpaid
          // They owe me: min(my overpayment, their deficit)
          const theyOweMe = Math.min(Math.abs(theirNet), Math.abs(myNet));
          bilateralBalances[userIdStr] += roundToTwo(theyOweMe);
        } else if (myNet < 0 && theirNet > 0) {
          // I underpaid, they overpaid
          // I owe them: min(their overpayment, my deficit)
          const iOweThem = Math.min(Math.abs(myNet), Math.abs(theirNet));
          bilateralBalances[userIdStr] -= roundToTwo(iOweThem);
        }
      });
    });

    // Adjust for settlements: move pairwise balances toward zero
    settlements.forEach(st => {
      if (st.isDeleted) return;
      const amt = Number(st.amount || 0);
      if (amt <= 0) return;
      const fromId = String(typeof st.paidBy === 'object' ? st.paidBy._id : st.paidBy);
      const toId = st.splitAmong?.[0]
        ? String(typeof st.splitAmong[0].user === 'object' ? st.splitAmong[0].user._id : st.splitAmong[0].user)
        : null;

      if (fromId === myId && toId) {
        // I paid them -> I owe less (increase net toward positive by +amt)
        bilateralBalances[toId] = roundToTwo((bilateralBalances[toId] || 0) + amt);
      } else if (toId === myId && fromId) {
        // They paid me -> they owe less (reduce positive by -amt)
        bilateralBalances[fromId] = roundToTwo((bilateralBalances[fromId] || 0) - amt);
      }
    });

    // Build results array
    const members = selectedGroup.members || [];
    const results = [];
    
    members.forEach(member => {
      const userId = String(member._id);
      if (userId === myId) return; // Skip myself
      
      const bilateral = roundToTwo(bilateralBalances[userId] || 0);
      if (Math.abs(bilateral) < 0.01) return; // Skip if balanced
      
      results.push({ 
        user: member, 
        net: bilateral // positive = they owe me, negative = I owe them
      });
    });

    return results;
  };

  const handleExpenseClick = async (expenseId) => {
    try {
      const response = await getExpense(expenseId);
      setSelectedExpenseDetail(response.expense);
      setShowExpenseDetail(true);
    } catch (error) {
      console.error("Failed to fetch expense details:", error);
      toast.error("Failed to load expense details");
      // alert("Failed to load expense details");
    }
  };

  const formatDate = (d) => {
    try {
      const date = new Date(d);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  // Calculate overall balance summary for the current user in this group
  const calculateOverallBalance = () => {
    if (!currentUser || !selectedGroup) return { youOwe: 0, youAreOwed: 0, netBalance: 0 };
    const nets = getGroupNetByPerson();
    let youOwe = 0;
    let youAreOwed = 0;
    nets.forEach(entry => {
      if (entry.net > 0) youAreOwed = roundToTwo(youAreOwed + entry.net);
      else if (entry.net < 0) youOwe = roundToTwo(youOwe + Math.abs(entry.net));
    });
    const netBalance = roundToTwo(youAreOwed - youOwe);
    return { youOwe, youAreOwed, netBalance };
  };

  return (
    <div className={styles.layout}>
      {/* Main content */}
      <main className={`${styles.mainContent} ${loading ? styles.mainContentLoading : ''}`}>
        {loading ? (
          <div className={styles.loaderContainer}>
            <RiseLoader size={14} color="#425567" />
          </div>
        ) : !selectedGroup ? (
          <div className={styles.emptyState}>Group not found.</div>
        ) : (
          <>
            {/* Header */}
            <div className={styles.groupHeader}>
              <div className={styles.groupInfo}>
                <div className={styles.groupIcon}>
                  <img
                    src="/logo.png"
                    alt="Splitmate logo"
                    className={styles.groupLogo}
                  />
                </div>
                <div>
                  <h2>{selectedGroup.name}</h2>
                  <p>{selectedGroup.members?.length || 0} people</p>
                </div>
              </div>
              <div className={styles.actions}>
                <button onClick={handleGenerateLink} className={styles.generateBtn}>Generate Link</button>
                <button onClick={() => setShowAddExpense(true)} className={styles.addExpenseBtn}>+ Add expense</button>
                {String(selectedGroup.createdBy) === String(currentUser?._id) && (
                  <button onClick={() => setShowDeleteGroupConfirm(true)} className={styles.deleteGroupBtn} title="Delete group (you are the creator)">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            {toastMessage && (
              <div className={styles.toast} role="status" aria-live="polite">{toastMessage}</div>
            )}

            {/* Overall Balance Summary */}
            {(() => {
              const { youOwe, youAreOwed, netBalance } = calculateOverallBalance();
              return (
                <div className={styles.overallBalanceSummary}>
                  <div className={styles.balanceSummaryCard}>
                    {/* <div className={styles.balanceSummaryDivider}></div> */}
                    <div className={styles.balanceSummaryItem}>
                      <span className={styles.balanceLabel}>
                        <span className={`${styles.balanceIcon} ${styles.balanceIconNet}`}>
                          <Banknote size={16} />
                        </span>
                        Net balance
                      </span>
                      <span className={`${styles.balanceValue} ${netBalance >= 0 ? styles.positive : styles.negative}`}>
                        {`${netBalance >= 0 ? '+' : '-'} ₹${Math.abs(netBalance).toFixed(2)}`}
                      </span>
                    </div>
                    <div className={styles.balanceSummaryItem}>
                      <span className={styles.balanceLabel}>
                        <span className={`${styles.balanceIcon} ${styles.balanceIconOwe}`}>
                          <TrendingDown size={16} />
                        </span>
                        You owe
                      </span>
                      <span className={`${styles.balanceValue} ${styles.negative}`}>
                        ₹{youOwe.toFixed(2)}
                      </span>
                    </div>
                    {/* <div className={styles.balanceSummaryDivider}></div> */}
                    <div className={styles.balanceSummaryItem}>
                      <span className={styles.balanceLabel}>
                        <span className={`${styles.balanceIcon} ${styles.balanceIconOwed}`}>
                          <TrendingUp size={16} />
                        </span>
                        You are owed
                      </span>
                      <span className={`${styles.balanceValue} ${styles.positive}`}>
                        ₹{youAreOwed.toFixed(2)}
                      </span>
                    </div>
                    
                  </div>
                </div>
              );
            })()}

            {/* Smart net settle-up: show one net statement per person */}
            <div className={styles.settleCol}>
              {/* <h3 className={styles.settleTitle}>Settle up</h3> */}
              {(() => {
                const nets = getGroupNetByPerson();
                const { youOwe, youAreOwed, netBalance } = calculateOverallBalance();
                
                // Only show "squared up" if ALL amounts are 0 (actual settlement happened)
                if (nets.length === 0 && youOwe === 0 && youAreOwed === 0) {
                  return (
                    <div className={styles.settledState}>
                      <div className={styles.checkIcon}>✓</div>
                      <p>Everything is squared up</p>
                    </div>
                  );
                }
                
                // Show offsetting balances message if net=0 but gross amounts exist
                if (nets.length === 0 && netBalance === 0 && (youOwe > 0 || youAreOwed > 0)) {
                  return (
                    <div className={styles.balanceList}>
                      <div className={styles.balanceItem}>
                        <div className={styles.balanceInfo}>
                          <div className={styles.userInfo}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <div>
                                <div className={styles.amount} style={{ color: '#f59e0b', fontSize: '14px' }}>
                                  💡 Your debts and credits offset each other (₹{youOwe.toFixed(2)} ⇄ ₹{youAreOwed.toFixed(2)})
                                </div>
                                <div style={{ fontSize: '13px', color: '#9ca3af', margin: '5px' }}>
                                  Record a settlement to mark these expenses as settled
                                </div>
                              </div>
                              <button
                                className={styles.settleUpBtn}
                                onClick={handleRecordOffsetSettlement}
                                style={{ marginLeft: '12px', whiteSpace: 'nowrap' }}
                              >
                                Record
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className={styles.balanceList}>
                    {nets.map((entry) => {
                      const isReceive = entry.net > 0;
                      const amt = Math.abs(entry.net);
                      return (
                        <div key={`net-${entry.user._id}`} className={styles.balanceItem}>
                          <div className={styles.balanceInfo}>
                            <div className={styles.userInfo}>
                              <div className={`${styles.amount} ${isReceive ? styles.amountReceive : ''}`}>
                                {isReceive
                                  ? <>You are owed ₹{amt.toFixed(2)} <span className={styles.userName}>by {entry.user.name}</span></>
                                  : <>You owe ₹{amt.toFixed(2)} <span className={styles.userName}>to {entry.user.name}</span></>
                                }
                              </div>
                              <div>
                                <button
                                  className={styles.settleUpBtn}
                                  onClick={() => (isReceive
                                    ? handleSettleReceive({ user: entry.user, amount: amt })
                                    : handleSettleUp({ user: entry.user, amount: amt })
                                  )}
                                >
                                  Settle Up
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Expenses Section */}
            <div className={styles.expensesSection}>
              {/* Show ALL expenses with settled badges */}
              {(() => {
                if (expenses.length === 0) {
                  return <div className={styles.emptyExpenses}><p>No expenses yet. Add one!</p></div>;
                }
                
                const renderExpense = (exp) => {
                  const balance = calculateBalance(exp);
                  const payers = getPayers(exp);
                  const paidByName = formatPayersLabel(payers, currentUser);
                  const dateStr = formatDate(exp.date); // e.g., "Jan 24"
                  const settled = isExpenseSettled(exp);
                  // Resolve UI label (frontend-only). Default to 'misc' if none saved
                  const uiLabelKey = getExpenseLabel(exp._id) || 'misc';
                  const uiLabel = getLabelByKey(uiLabelKey);

                  return (
                    <div key={exp._id} className={`${styles.expenseItem} ${settled ? styles.settledExpense : ''}`} onClick={() => handleExpenseClick(exp._id)}>
                      <div className={styles.expenseLeft}>
                        <div className={styles.datePill} aria-label={`Date ${dateStr}`}>
                          <span className={styles.dateText}>{dateStr}</span>
                        </div>
                        <div className={styles.expenseDetails}>
                          <div className={styles.expenseTitle}>
                            {uiLabel && (
                              <span className={styles.expenseLabel} onClick={(e) => e.stopPropagation()}>
                                {uiLabel.img ? (
                                  <img
                                    src={uiLabel.img}
                                    alt={uiLabel.label}
                                    className={styles.labelIconImg}
                                    onError={(e) => {
                                      if (uiLabel.imgFallback && e.currentTarget.src !== window.location.origin + uiLabel.imgFallback) {
                                        e.currentTarget.src = uiLabel.imgFallback;
                                      } else {
                                        e.currentTarget.outerHTML = '<span class="'+styles.labelEmoji+'">📦</span>';
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className={styles.labelEmoji}>{uiLabel.icon}</span>
                                )}
                                {/* <span className={styles.labelText}>{uiLabel.label}</span> */}
                              </span>
                            )}
                            {exp.description}
                            {settled && (
                              <span className={styles.settledBadge}>
                                ✓ Settled
                              </span>
                            )}
                          </div>
                          <div className={styles.expenseSubtitle}>{paidByName} paid • ₹{Number(exp.amount || 0).toFixed(2)}</div>
                          {balance && (
                            <div className={styles.balanceBreakdown}>
                              {/* <small>Your share: ₹{(balance.myShare || 0).toFixed(2)}</small> */}
                              {balance.type === 'lent' && balance.amount > 0 && <small className={styles.positive}>You get back • ₹{balance.amount.toFixed(2)}</small>}
                              {balance.type === 'owe' && balance.amount > 0 && <small className={styles.negative}>You owe • ₹{balance.amount.toFixed(2)}</small>}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.expenseRight}>
                        {/* Row 1: top-right delete aligned with title */}
                        <div className={styles.rightTop}>
                          {(() => {
                            const payersList = getPayers(exp);
                            const paidById = (payersList[0]?.user) || (typeof exp.paidBy === "object" ? exp.paidBy._id : exp.paidBy);
                            const createdById = typeof exp.createdBy === "object" ? exp.createdBy._id : exp.createdBy;
                            const iAmPayer = payersList.some(p => String(p.user) === String(currentUser?._id));
                            const canDelete = (iAmPayer || String(paidById) === String(currentUser?._id) || String(createdById) === String(currentUser?._id)) && !settled;
                            return canDelete && (
                              <button 
                                onClick={(event) => { 
                                  event.stopPropagation(); 
                                  confirmDeleteExpense(exp._id); 
                                }} 
                                className={`${styles.deleteBtn}`} 
                                title={settled ? "Cannot delete settled expense" : "Delete expense"}
                              >
                                <Trash2 size={16} />
                              </button>
                            );
                          })()}
                        </div>

                        {/* Row 2: balance amount only (no duplicate phrasing) */}
                        <div className={styles.rightMiddle}>
                          {balance && (
                            <div className={`${styles.balanceAmount} ${balance.type === "lent" ? styles.positive : styles.negative}`}>
                              {balance.type === "lent" && balance.amount > 0 ? `+ ₹${balance.amount.toFixed(2)}` :
                                balance.type === "owe" && balance.amount > 0 ? `- ₹${balance.amount.toFixed(2)}` :
                                  `₹0.00`}
                            </div>
                          )}
                        </div>

                        {/* Row 3: details action aligned with the third line on the left */}
                        <div className={styles.rightBottom}>
                          <button
                            className={styles.iconBtn}
                            onClick={(event) => { event.stopPropagation(); handleExpenseClick(exp._id); }}
                            title="View details"
                          >
                            <Info size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                };
                
                return (
                  <div className={styles.expenseList}>
                    {/* Show ALL expenses with settled badges */}
                    {expenses.map(renderExpense)}
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {showAddExpense && selectedGroup && (
        <AddExpenseModal isOpen={showAddExpense} onClose={() => setShowAddExpense(false)} onExpenseAdded={handleAddExpense} initialGroupId={selectedGroup._id} />
      )}

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
              <button onClick={handleDeleteExpense} className={styles.btnDanger}>Yes, Delete</button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeletingExpenseId(null); }} className={styles.btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteGroupConfirm && (
        <div className={sidebarStyles.deleteModal}>
          <div
            className={sidebarStyles.deleteDialog}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleDeleteGroup();
              }
            }}
            tabIndex={-1}
          >
            <p>
              Are you sure you want to DELETE <strong>"{selectedGroup?.name}"</strong>?
            </p>
            <p className={sidebarStyles.warning}>⚠️ This will permanently delete the group.</p>
            <div className={sidebarStyles.deleteActions}>
              <button
                className={sidebarStyles.cancelBtn}
                onClick={() => setShowDeleteGroupConfirm(false)}
              >
                Cancel
              </button>
              <button
                className={sidebarStyles.confirmDeleteBtn}
                onClick={handleDeleteGroup}
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Detail Modal */}
      {showExpenseDetail && selectedExpenseDetail && (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setShowExpenseDetail(false); }}>
          <div className={styles.expenseDetailModal}>
            <div className={styles.modalHeader}>
              <h3>{selectedExpenseDetail.description}</h3>
              <button onClick={() => setShowExpenseDetail(false)} className={styles.closeBtn}>×</button>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.expenseOverview}>
                <div className={styles.totalAmount}>Total: ₹{Number(selectedExpenseDetail.amount || 0).toFixed(2)}</div>
                {(() => {
                  const payers = getPayers(selectedExpenseDetail);
                  const label = formatPayersLabel(payers, currentUser);
                  return (
                    <div className={styles.paidBy}>Paid by {label} on {new Date(selectedExpenseDetail.date).toLocaleDateString()}</div>
                  );
                })()}
              </div>

              <div className={styles.splitBreakdown}>
                <h4>Split Breakdown</h4>
                {selectedExpenseDetail.splitAmong?.map((split, index) => {
                  const userName = split.user?.name || 'Unknown';
                  const shareAmount = Number(split.amount || split.share || 0);
                  const paidAmt = getUserPaidAmount(selectedExpenseDetail, split.user?._id || split.user);
                  const netAmount = roundToTwo(paidAmt - shareAmount);

                  return (
                    <div key={index} className={styles.splitItem}>
                      <div className={styles.splitUser}>
                        <span className={styles.userName}>{userName}</span>
                        {paidAmt > 0 && <span className={styles.paidTag}>PAID</span>}
                      </div>
                      <div className={styles.splitAmounts}>
                        <div>Share: ₹{shareAmount.toFixed(2)}</div>
                        {netAmount > 0 && <div className={styles.positive}>Gets back: ₹{netAmount.toFixed(2)}</div>}
                        {netAmount < 0 && <div className={styles.negative}>Owes: ₹{Math.abs(netAmount).toFixed(2)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedExpenseDetail.createdBy && (
                <div className={styles.expenseFooter}>
                  <small>Added by {selectedExpenseDetail.createdBy.name} on {new Date(selectedExpenseDetail.createdAt || selectedExpenseDetail.date).toLocaleDateString()}</small>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      <SettleUpModal
        isOpen={showSettleUp}
        onClose={() => { setShowSettleUp(false); setSettlementData(null); }}
        onConfirm={handleConfirmSettlement}
        settlementData={settlementData}
      />
    </div>
  );
}
