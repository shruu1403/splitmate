const { expenseModel } = require("../models/expenseModel");

const calculateBalance = async (groupId) => {
  const balances = {};

  // Get all active expenses (non-deleted)
  const allExpenses = await expenseModel.find({ groupId, isDeleted: false });

  // Separate settlements from regular expenses
  const settlements = allExpenses.filter(exp =>
    exp.type === 'settlement' ||
    exp.isSettlement === true ||
    (exp.description && exp.description.toLowerCase().includes('settlement'))
  );

  const regularExpenses = allExpenses.filter(exp =>
    exp.type !== 'settlement' &&
    !exp.isSettlement &&
    !(exp.description && exp.description.toLowerCase().includes('settlement'))
  );

  // Helper: Check if an expense is settled (has a settlement after it)
  const isExpenseSettled = (expense) => {
    if (settlements.length === 0) return false;

    const expenseTimestamp = new Date(expense.createdAt || expense.date).getTime();

    // Check if there's any settlement created after this expense
    return settlements.some(settlement => {
      const settlementTimestamp = new Date(settlement.createdAt || settlement.date).getTime();
      return settlementTimestamp > expenseTimestamp;
    });
  };

  // Process only UNSETTLED regular expenses
  regularExpenses.forEach((exp) => {
    // Skip settled expenses - they've been paid off
    if (isExpenseSettled(exp)) return;
    // Subtract each participant’s share
    (exp.splitAmong || []).forEach((split) => {
      const uid = (split.user && split.user._id) ? split.user._id.toString() : split.user?.toString();
      if (!uid) return;
      if (!balances[uid]) balances[uid] = 0;
      balances[uid] -= Number(split.share || split.amount || 0);
    });

    // Add amounts to payer(s)
    if (Array.isArray(exp.payers) && exp.payers.length > 0) {
      exp.payers.forEach((p) => {
        const uid = (p.user && p.user._id) ? p.user._id.toString() : p.user?.toString();
        if (!uid) return;
        if (!balances[uid]) balances[uid] = 0;
        balances[uid] += Number(p.amount || 0);
      });
    } else if (exp.paidBy) {
      const uid = (exp.paidBy && exp.paidBy._id) ? exp.paidBy._id.toString() : exp.paidBy.toString();
      if (!balances[uid]) balances[uid] = 0;
      balances[uid] += Number(exp.amount || 0);
    }
  });

  // Round all balances to 2 decimal places
  Object.keys(balances).forEach(uid => {
    balances[uid] = Math.round(balances[uid] * 100) / 100;
  });

  return balances;
};

module.exports = { calculateBalance };
