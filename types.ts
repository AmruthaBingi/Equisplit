
export type Tag = 'food' | 'travel' | 'shared' | 'personal' | 'housing' | 'entertainment';

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Split {
  userId: string;
  amount: number;
  weight: number; // For weighted splits (e.g., multiplier or percentage)
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string; // User ID
  tag: Tag;
  date: string;
  splits: Split[];
  receiptUrl?: string;
}

export interface Settlement {
  from: string; // User ID
  to: string; // User ID
  amount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  type: 'user' | 'system' | 'ai';
}

export interface FairnessStats {
  userId: string;
  contribution: number;
  consumption: number;
  fairnessScore: number; // 0 to 100
}
