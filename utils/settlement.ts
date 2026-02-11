
import { Expense, User, Settlement } from '../types';

/**
 * Simplifies group debts by calculating net balances and matching debtors with creditors.
 */
export const calculateSettlements = (users: User[], expenses: Expense[]): Settlement[] => {
  const balances: Record<string, number> = {};
  users.forEach(u => balances[u.id] = 0);

  expenses.forEach(expense => {
    // Add amount paid by the payer
    balances[expense.paidBy] += expense.amount;
    
    // Subtract share of each participant
    expense.splits.forEach(split => {
      balances[split.userId] -= split.amount;
    });
  });

  const debtors = users
    .filter(u => balances[u.id] < -0.01)
    .map(u => ({ id: u.id, amount: Math.abs(balances[u.id]) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = users
    .filter(u => balances[u.id] > 0.01)
    .map(u => ({ id: u.id, amount: balances[u.id] }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0.01) {
      settlements.push({
        from: debtor.id,
        to: creditor.id,
        amount: Number(amount.toFixed(2))
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return settlements;
};

export const getFairnessStats = (users: User[], expenses: Expense[]) => {
  const stats: Record<string, { contribution: number; consumption: number }> = {};
  users.forEach(u => stats[u.id] = { contribution: 0, consumption: 0 });

  expenses.forEach(e => {
    stats[e.paidBy].contribution += e.amount;
    e.splits.forEach(s => {
      stats[s.userId].consumption += s.amount;
    });
  });

  return Object.entries(stats).map(([userId, data]) => {
    // Fairness is essentially (contribution / total_spent) vs (consumption / total_spent)
    // A score of 100 means they are contributing exactly what they consume.
    // > 100 means they are funding the group. < 100 means they are borrowing.
    const ratio = data.consumption > 0 ? (data.contribution / data.consumption) : 1;
    let score = Math.min(100, Math.max(0, ratio * 50)); // Simple normalized score
    
    return {
      userId,
      contribution: data.contribution,
      consumption: data.consumption,
      fairnessScore: score
    };
  });
};
