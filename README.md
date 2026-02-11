
# ⚖️ EquiSplit: Smart Expense Solver with AI Mediation

EquiSplit is a high-performance group expense management application designed to handle complex splitting scenarios with a focus on fairness, transparency, and conflict resolution.

## 🚀 Core Features

### 🧠 Intelligent Fairness Engine
- **Weighted Splits:** Don't just split 50/50. Support for uneven usage (e.g., one person ate more, one person stayed fewer nights).
- **Fairness Index:** A real-time visualization comparing a user's total contributions vs. their total consumption.
- **Settlement Optimizer:** Uses a graph-based transaction minimization algorithm to clear all group debts in the fewest possible transfers.

### 🤖 Gemini AI Integration
- **AI Receipt Scanner:** Uses `gemini-3-flash-preview` to perform high-accuracy OCR on receipt photos, automatically extracting amounts, merchants, and categories.
- **AI Auditor:** An objective mediator that analyzes the group ledger to find outliers, suspicious spending patterns, or potential unfairness.
- **Dispute Mediation:** A dedicated chat interface where the group can ask the AI to resolve disagreements based on the transaction data.
- **Voice Summaries:** Text-to-Speech (TTS) generation for settlement reports using `gemini-2.5-flash-preview-tts`.

### 📊 Advanced Analytics
- **Category Distribution:** Dynamic pie charts showing where the group's money is going.
- **Contribution Flow:** Bar charts comparing "Paid Out" vs "Used" values per member.
- **Persistant Storage:** Automatically syncs group data to local storage for seamless usage across sessions.

## 🛠️ Tech Stack
- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS (Modern Glassmorphism UI)
- **Icons:** Lucide React
- **Charts:** Recharts (High-performance SVG charts)
- **AI Backend:** Google Gemini API (Multimodal, Chat, and TTS)

## 🛠️ Setup & Requirements
1. **API Key:** The application requires a valid `process.env.API_KEY` to access the Gemini features.
2. **Permissions:** Requires camera access for the receipt scanning functionality.
3. **Environment:** Designed for modern browsers with ES6 module support.

## 📂 Project Structure
- `/services/geminiService.ts`: All logic for AI interactions (Vision, Chat, TTS).
- `/utils/settlement.ts`: The graph algorithm for debt simplification.
- `/types.ts`: Shared TypeScript interfaces for consistent data handling.
- `App.tsx`: The central hub for state management and the modern multi-tab UI.

---
*Created with ❤️ by a World-Class Senior Frontend Engineer.*
