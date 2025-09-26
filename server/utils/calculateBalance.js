const { expenseModel } = require("../models/expenseModel");

const calculateBalance = async (groupId) => {
  const balances = {};

  // Get all active expenses + settlements
  const expenses = await expenseModel.find({ groupId, isDeleted: false });

  expenses.forEach((exp) => {
    // Subtract each participant’s share
    exp.splitAmong.forEach((split) => {
      if (!balances[split.user]) balances[split.user] = 0;
      balances[split.user] -= split.share;
    });

    // Add total amount to payer
    if (!balances[exp.paidBy]) balances[exp.paidBy] = 0;
    balances[exp.paidBy] += exp.amount;
  });

  return balances;
};

module.exports = { calculateBalance };
