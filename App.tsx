
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, PieChart as PieChartIcon, MessageSquare, AlertCircle, 
  ArrowRight, Tag as TagIcon, Wallet, ShieldCheck, TrendingUp, CreditCard, 
  Camera, RotateCcw, CheckCircle2, X, Loader2, Scan, Volume2, Info
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie
} from 'recharts';
import { User, Expense, Tag, Split, ChatMessage } from './types';
import { calculateSettlements, getFairnessStats } from './utils/settlement';
import { analyzeExpenses, chatWithAuditor, scanReceipt, generateSettlementVoice } from './services/geminiService';

const INITIAL_USERS: User[] = [
  { id: '1', name: 'Alex', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex' },
  { id: '2', name: 'Jordan', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan' },
  { id: '3', name: 'Casey', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Casey' },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const App: React.FC = () => {
  const [users] = useState<User[]>(INITIAL_USERS);
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('equisplit_expenses');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeTab, setActiveTab] = useState<'expenses' | 'settlements' | 'analytics' | 'chat'>('expenses');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newPayer, setNewPayer] = useState(users[0].id);
  const [newTag, setNewTag] = useState<Tag>('shared');
  const [splitWeights, setSplitWeights] = useState<Record<string, string>>(
    Object.fromEntries(users.map(u => [u.id, '1']))
  );

  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'capturing' | 'analyzing'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [aiReport, setAiReport] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('equisplit_expenses', JSON.stringify(expenses));
  }, [expenses]);

  const settlements = useMemo(() => calculateSettlements(users, expenses), [users, expenses]);
  const fairness = useMemo(() => getFairnessStats(users, expenses), [users, expenses]);

  // Fix: Explicitly typing the reduce function and preventing division by zero errors
  const handleAddExpense = () => {
    const amount = parseFloat(newAmount);
    if (!newDesc || isNaN(amount)) return;
    
    // Fix: Cast 'w' to string to resolve 'unknown' type error in parseFloat
    const totalWeight = Object.values(splitWeights).reduce<number>((sum, w) => sum + (parseFloat(w as string) || 0), 0);
    const weightToUse = totalWeight || 1; // Fallback to avoid division by zero
    
    const splits: Split[] = users.map(u => {
      const weight = parseFloat(splitWeights[u.id] || '0');
      return { userId: u.id, weight, amount: (weight / weightToUse) * amount };
    });
    
    const expense: Expense = { 
      id: crypto.randomUUID(), 
      description: newDesc, 
      amount, 
      paidBy: newPayer, 
      tag: newTag, 
      date: new Date().toISOString(), 
      splits 
    };
    
    setExpenses(prev => [expense, ...prev]);
    resetForm();
  };

  const resetForm = () => {
    setNewDesc(''); setNewAmount(''); setNewPayer(users[0].id); setNewTag('shared');
    setSplitWeights(Object.fromEntries(users.map(u => [u.id, '1'])));
    setShowAddModal(false); setIsScanning(false);
  };

  const startCamera = async () => {
    setIsScanning(true); setScanStatus('capturing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch (err) { console.error(err); setIsScanning(false); }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanStatus('analyzing');
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
    const stream = videoRef.current.srcObject as MediaStream;
    stream.getTracks().forEach(track => track.stop());
    const result = await scanReceipt(base64Image);
    if (result) {
      if (result.description) setNewDesc(result.description);
      if (result.amount) setNewAmount(result.amount.toString());
      if (result.category) {
        const validTags: Tag[] = ['food', 'travel', 'shared', 'personal', 'housing', 'entertainment'];
        if (validTags.includes(result.category.toLowerCase() as Tag)) setNewTag(result.category.toLowerCase() as Tag);
      }
    }
    setScanStatus('idle'); setIsScanning(false);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), senderId: 'user', text: inputMessage, timestamp: new Date().toLocaleTimeString(), type: 'user' };
    setChatMessages(prev => [...prev, userMsg]);
    const geminiHistory = chatMessages.map(m => ({
      role: m.type === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));
    const textToSend = inputMessage;
    setInputMessage('');
    const aiResponse = await chatWithAuditor(geminiHistory, textToSend);
    const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), senderId: 'ai', text: aiResponse || '...', timestamp: new Date().toLocaleTimeString(), type: 'ai' };
    setChatMessages(prev => [...prev, aiMsg]);
  };

  const playSettlementVoice = async () => {
    if (settlements.length === 0) return;
    setIsVoiceLoading(true);
    const summary = settlements.map(s => {
      const from = users.find(u => u.id === s.from)?.name;
      const to = users.find(u => u.id === s.to)?.name;
      return `${from} owes ${to} $${s.amount.toFixed(2)}.`;
    }).join(' ');
    
    const audioData = await generateSettlementVoice(summary);
    if (audioData) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(audioData, audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    }
    setIsVoiceLoading(false);
  };

  // Internal decoding helper (matches @google/genai guidelines for PCM stream decoding)
  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  const clearAllData = () => {
    if (confirm("Clear all group history? This cannot be undone.")) {
      setExpenses([]);
      localStorage.removeItem('equisplit_expenses');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden">
      <nav className="w-full md:w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-500 p-2 rounded-xl"><Wallet size={24} /></div>
            <div><h1 className="text-xl font-bold">EquiSplit</h1><p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Fairness Engine</p></div>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-1 px-3">
          <NavButton active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<CreditCard size={18} />} label="Expenses" />
          <NavButton active={activeTab === 'settlements'} onClick={() => setActiveTab('settlements')} icon={<TrendingUp size={18} />} label="Settlements" />
          <NavButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<PieChartIcon size={18} />} label="Analytics" />
          <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={18} />} label="AI Auditor" />
        </div>
        <div className="p-4 mt-auto">
          <button onClick={clearAllData} className="w-full p-2 text-xs text-slate-500 hover:text-rose-400 flex items-center gap-2 justify-center transition-colors">
            <RotateCcw size={14} /> Reset Group
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 capitalize">{activeTab}</h2>
          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200" /></div>
        </header>

        <div className="p-6 md:p-8">
          {activeTab === 'expenses' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-end">
                <div><h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Ledger</h3><p className="text-slate-500">Track and verify group transactions</p></div>
                <button onClick={() => setShowAddModal(true)} className="bg-slate-900 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-xl font-semibold"><Plus size={20} /> New Expense</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {fairness.map(stat => (
                  <div key={stat.userId} className="glass-card p-5 rounded-3xl shadow-sm border border-slate-200 group hover:border-emerald-200 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <img src={users.find(u => u.id === stat.userId)?.avatar} className="w-10 h-10 rounded-full border-2 border-slate-100" />
                        <div><p className="font-bold text-slate-800">{users.find(u => u.id === stat.userId)?.name}</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fairness Score</p></div>
                      </div>
                      <div className={`text-lg font-black ${stat.fairnessScore > 60 ? 'text-emerald-500' : 'text-amber-500'}`}>{stat.fairnessScore.toFixed(0)}%</div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-4"><div className={`h-full transition-all duration-1000 ${stat.fairnessScore > 60 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${stat.fairnessScore}%` }} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100"><p className="text-[10px] text-slate-400 font-bold uppercase">Paid</p><p className="text-sm font-bold">${stat.contribution.toFixed(2)}</p></div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100"><p className="text-[10px] text-slate-400 font-bold uppercase">Used</p><p className="text-sm font-bold">${stat.consumption.toFixed(2)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {expenses.length === 0 ? <div className="p-20 text-center"><CreditCard className="mx-auto text-slate-200 mb-4" size={48} /><p className="text-slate-400 font-medium">No activity recorded yet</p></div> : 
                  expenses.map(exp => (
                    <div key={exp.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 flex items-center justify-center rounded-2xl ${getTagColor(exp.tag)} transition-transform group-hover:scale-105`}><TagIcon size={24} /></div>
                        <div><h4 className="font-bold text-slate-800">{exp.description}</h4><p className="text-xs text-slate-400 mt-0.5"><span className="font-semibold text-slate-500">{users.find(u => u.id === exp.paidBy)?.name}</span> paid • {new Date(exp.date).toLocaleDateString()}</p></div>
                      </div>
                      <div className="flex items-center gap-6"><div className="text-right"><p className="text-lg font-black text-slate-900">${exp.amount.toFixed(2)}</p><p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Verified</p></div><button onClick={() => setExpenses(prev => prev.filter(e => e.id !== exp.id))} className="text-slate-300 hover:text-rose-500 p-2 rounded-lg opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button></div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {activeTab === 'settlements' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center">
                <div><h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Final Settlement</h3><p className="text-slate-500">Optimized transactions to clear all debts</p></div>
                <button onClick={playSettlementVoice} disabled={isVoiceLoading || settlements.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all font-bold">
                  {isVoiceLoading ? <Loader2 className="animate-spin" size={20} /> : <Volume2 size={20} />} Listen to Summary
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {settlements.length === 0 ? <div className="bg-white p-12 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center text-center"><ShieldCheck className="text-emerald-500 mb-4" size={40} /><h4 className="text-xl font-bold">Clear Skies!</h4></div> : 
                    settlements.map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 flex items-center justify-between group">
                        <div className="text-center"><img src={users.find(u => u.id === s.from)?.avatar} className="w-14 h-14 rounded-2xl mx-auto mb-1" /><span className="text-xs font-bold">{users.find(u => u.id === s.from)?.name}</span></div>
                        <div className="flex-1 px-4 text-center"><div className="text-2xl font-black text-slate-900">${s.amount.toFixed(2)}</div><div className="h-px bg-slate-200 mt-2 relative"><ArrowRight className="absolute -right-2 -top-2 text-emerald-500" size={16} /></div></div>
                        <div className="text-center"><img src={users.find(u => u.id === s.to)?.avatar} className="w-14 h-14 rounded-2xl mx-auto mb-1" /><span className="text-xs font-bold">{users.find(u => u.id === s.to)?.name}</span></div>
                      </div>
                    ))
                  }
                </div>
                <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-2xl space-y-6">
                  <div className="flex items-center gap-3"><ShieldCheck className="text-emerald-400" /><h3 className="text-xl font-bold">Proactive AI Audit</h3></div>
                  {!aiReport ? <button onClick={async () => {setIsAiLoading(true); setAiReport(await analyzeExpenses(expenses, users)); setIsAiLoading(false);}} disabled={isAiLoading || expenses.length === 0} className="w-full bg-emerald-500 text-slate-900 py-4 rounded-2xl font-black uppercase hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2">{isAiLoading ? <Loader2 className="animate-spin" /> : 'Run Smart Audit'}</button> : 
                    <div className="space-y-4 animate-in fade-in"><div className="p-4 bg-white/5 rounded-2xl border border-white/10 italic text-sm text-slate-300">"{aiReport.fairnessReview}"</div>{aiReport.anomalies.map((a: string, i: number) => <div key={i} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-200 text-xs flex gap-2"><AlertCircle size={14} className="shrink-0" />{a}</div>)}<button onClick={() => setAiReport(null)} className="w-full text-xs text-slate-500 hover:text-white py-2">Reset Report</button></div>
                  }
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Spending IQ</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 h-[450px]">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Category Mix</h4>
                  <ResponsiveContainer width="100%" height="80%"><PieChart><Pie data={getCategoryData(expenses)} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">{getCategoryData(expenses).map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: '16px' }} /></PieChart></ResponsiveContainer>
                </div>
                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 h-[450px]">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Contribution Dynamics</h4>
                  <ResponsiveContainer width="100%" height="80%"><BarChart data={fairness}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="userId" tickFormatter={(id) => users.find(u => u.id === id)?.name || ''} axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: '#f8fafc' }} /><Bar dataKey="contribution" name="Paid Out" fill="#10b981" radius={[8, 8, 0, 0]} /><Bar dataKey="consumption" name="Used" fill="#3b82f6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto h-[calc(100vh-180px)] flex flex-col bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white"><MessageSquare size={24} /></div><div><h3 className="font-bold text-slate-900">AI Dispute Mediator</h3><p className="text-xs text-slate-400 font-medium">Active Audit Context Loaded</p></div></div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {chatMessages.length === 0 && <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40"><MessageSquare size={64} className="mb-4" /><p className="font-bold">Ask the AI Auditor about any discrepancy</p></div>}
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-5 rounded-3xl text-sm leading-relaxed ${msg.type === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'}`}>{msg.text}</div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Explain the sushi dinner split..." className="flex-1 bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-medium" />
                <button onClick={handleSendMessage} className="bg-slate-900 text-white w-14 h-14 rounded-2xl hover:bg-indigo-600 transition-all shadow-xl flex items-center justify-center"><ArrowRight size={24} /></button>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'expenses' && <button onClick={() => setShowAddModal(true)} className="md:hidden fixed bottom-8 right-8 bg-slate-900 text-white p-5 rounded-full shadow-2xl z-40 active:scale-95"><Plus size={28} /></button>}
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div><h3 className="text-2xl font-black text-slate-800">Log New Item</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manual Entry or Scan</p></div>
              <button onClick={resetForm} className="p-3 text-slate-300 hover:text-rose-500 rounded-2xl transition-all"><X size={28} /></button>
            </div>
            <div className="p-8 overflow-y-auto space-y-10">
              {isScanning ? (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-[32px] overflow-hidden border-4 border-emerald-500/20">
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 m-8 rounded-2xl flex items-center justify-center"><Scan className="text-emerald-500/40 animate-pulse" size={100} /></div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                      <button onClick={captureAndScan} disabled={scanStatus === 'analyzing'} className="bg-emerald-500 text-white w-16 h-16 rounded-full border-4 border-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all disabled:opacity-50">
                        {scanStatus === 'analyzing' ? <Loader2 className="animate-spin" /> : <Camera />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row gap-6">
                    <button onClick={startCamera} className="flex-1 p-8 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex flex-col items-center gap-3"><Camera className="text-emerald-500" size={32} /><span className="font-bold">Scan Receipt</span></button>
                    <div className="flex-[2] space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">What for?</label><input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Lunch" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-500/10" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Total Bill ($)</label><input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black focus:outline-none focus:ring-4 focus:ring-emerald-500/10" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Paid By</label><select value={newPayer} onChange={e => setNewPayer(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-500/10">{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Category</label><select value={newTag} onChange={e => setNewTag(e.target.value as Tag)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-500/10"><option value="shared">Shared</option><option value="food">Food</option><option value="travel">Travel</option><option value="housing">Housing</option><option value="personal">Personal</option><option value="entertainment">Entertainment</option></select></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Weight Split Ratio</label>
                    <div className="grid grid-cols-3 gap-3">
                      {users.map(u => (
                        <div key={u.id} className="bg-white p-3 rounded-2xl border border-slate-200 text-center"><img src={u.avatar} className="w-8 h-8 rounded-full mx-auto mb-2" /><div className="flex items-center justify-center gap-2"><button onClick={() => setSplitWeights(p => ({...p, [u.id]: Math.max(0, parseFloat(p[u.id]) - 1).toString()}))} className="w-6 h-6 rounded bg-slate-100">-</button><span className="text-xs font-bold">{splitWeights[u.id]}</span><button onClick={() => setSplitWeights(p => ({...p, [u.id]: (parseFloat(p[u.id]) + 1).toString()}))} className="w-6 h-6 rounded bg-slate-100">+</button></div></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {!isScanning && <div className="p-8 border-t border-slate-50 flex gap-4 bg-slate-50/30"><button onClick={resetForm} className="flex-1 px-8 py-4 text-slate-500 font-black uppercase text-xs hover:bg-slate-100 rounded-2xl transition-all">Discard</button><button onClick={handleAddExpense} className="flex-[2] px-8 py-4 bg-slate-900 text-white font-black uppercase text-xs rounded-2xl hover:bg-emerald-600 transition-all shadow-xl">Verify & Log</button></div>}
          </div>
        </div>
      )}
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group ${active ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><span className={`${active ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-900'}`}>{icon}</span><span className="font-bold text-sm">{label}</span></button>
);

const getTagColor = (tag: Tag) => {
  switch (tag) {
    case 'food': return 'bg-orange-100 text-orange-600';
    case 'travel': return 'bg-blue-100 text-blue-600';
    case 'housing': return 'bg-indigo-100 text-indigo-600';
    case 'personal': return 'bg-rose-100 text-rose-600';
    case 'shared': return 'bg-emerald-100 text-emerald-600';
    case 'entertainment': return 'bg-purple-100 text-purple-600';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const getCategoryData = (expenses: Expense[]) => {
  const data: Record<string, number> = {};
  expenses.forEach(e => data[e.tag] = (data[e.tag] || 0) + e.amount);
  const entries = Object.entries(data).map(([name, value]) => ({ name, value }));
  return entries.length > 0 ? entries : [{ name: 'Empty', value: 0 }];
};

export default App;
