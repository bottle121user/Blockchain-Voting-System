'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, LogOut, Check, Timer, Info, Trophy, ShieldCheck, ExternalLink, Loader2, Users, History } from 'lucide-react';
import api from '../../lib/api';

export default function DashboardPage() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [electionState, setElectionState] = useState(0); // 0: NotStarted, 1: Ongoing, 2: Ended
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('ballot'); // 'ballot', 'audit'
  const [auditLog, setAuditLog] = useState([]);
  const router = useRouter();

  const fetchData = async () => {
    try {
      const [candRes, stateRes, auditRes] = await Promise.all([
        api.get('/election/candidates'),
        api.get('/election/state'),
        api.get('/election/audit')
      ]);
      setCandidates(candRes.data);
      setElectionState(stateRes.data.state);
      setAuditLog(auditRes.data);
    } catch (err) {
      setError('Failed to load election data. The blockchain network might be down.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('voterToken')) {
      router.push('/');
      return;
    }
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [router]);

  const handleVote = async (candidateId) => {
    if (electionState !== 1) {
        setError('Voting is not currently allowed.');
        return;
    }
    if (!confirm('Are you sure you want to cast your vote? This action cannot be undone.')) return;
    
    setVoting(true);
    setError('');
    
    try {
      const res = await api.post('/election/vote', { candidateId });
      setSuccess(`Your vote was successfully recorded on the blockchain! Transaction hash: ${res.data.txHash}`);
      fetchData(); // Refresh vote counts and state
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cast vote.');
    } finally {
      setVoting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('voterToken');
    router.push('/');
  };

  const downloadReceipt = () => {
    const candidateName = success.includes('for') ? success.split('for ')[1].split('!')[0] : 'Selected Candidate';
    const txHash = success.split(': ')[1];
    const receiptContent = `
========================================
       BLOCKCHAIN VOTING SYSTEM
          DIGITAL BALLOT RECEIPT
========================================

TIMESTAMP: ${new Date().toLocaleString()}
STATUS: VERIFIED ON LEDGER
    
VOTE DETAILS:
-------------
Candidate: ${candidateName}
Status: Recorded Successfully

BLOCKCHAIN VERIFICATION:
------------------------
Transaction Hash: 
${txHash}

----------------------------------------
This receipt is a proof of your 
participation in the decentralized 
election process. Keep it for your 
records.
========================================
    `;
    const element = document.createElement("a");
    const file = new Blob([receiptContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `ballot_receipt_${txHash.substring(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading && candidates.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[500px] gap-6">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <ShieldCheck className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="text-white text-lg font-bold tracking-tight animate-pulse uppercase">Establishing Secure Ledger Link...</div>
    </div>
  );

  const stateMessages = [
    { title: "Preparation Phase", desc: "The election has not begun yet. Candidates are being finalized on the blockchain.", color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/20" },
    { title: "Polls Are Open", desc: "Voting is currently active. Select a candidate below to cast your immutable ballot.", color: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/20" },
    { title: "Election Concluded", desc: "The voting period has ended. Detailed results are now final and immutable.", color: "text-blue-400", bg: "bg-blue-500/5", border: "border-blue-500/20" }
  ];

  const currentStatus = stateMessages[electionState];
  const sortedCandidates = [...candidates].sort((a, b) => parseInt(b.voteCount) - parseInt(a.voteCount));
  const winner = electionState === 2 && sortedCandidates.length > 0 ? sortedCandidates[0] : null;

  return (
    <div className="w-full max-w-5xl flex flex-col gap-8 pb-20">
      {/* Polished Header */}
      <div className="flex justify-between items-center glass-panel p-8 rounded-3xl w-full shadow-2xl border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Voter Dashboard</h1>
          <p className="text-slate-400 font-medium">Session Secured via AES-256 Encryption</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-6 py-3 rounded-xl border border-white/10 transition-all font-bold active:scale-95 shadow-lg">
          <LogOut className="w-5 h-5" />
          Terminate Session
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-4 p-1.5 bg-black/20 rounded-2xl border border-white/5 w-fit animate-in fade-in duration-700 delay-200">
        <button 
          onClick={() => setActiveTab('ballot')}
          className={`px-8 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'ballot' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
        >
          {electionState === 2 ? 'Final Results' : 'Cast Ballot'}
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`px-8 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'audit' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Public Audit Trail
        </button>
      </div>

      {/* Winner Spotlight (Phase 2 Polishing) */}
      {winner && (
        <div className="glass-panel p-1 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-1000 border border-blue-500/20">
            <div className="bg-gradient-to-br from-blue-600/10 via-slate-900 to-emerald-600/10 p-10 rounded-[22px] flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-blue-500/10 opacity-50"></div>
                
                <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-6 rounded-3xl shadow-2xl shadow-amber-500/20 mb-6 relative z-10">
                    <Trophy className="w-16 h-16 text-white" />
                </div>
                
                <div className="relative z-10">
                    <span className="text-amber-400 text-xs font-black uppercase tracking-[0.3em] mb-2 block">The Result is In</span>
                    <h2 className="text-6xl font-black text-white drop-shadow-lg mb-4">{winner.name}</h2>
                    <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
                        has been officially elected by the citizens with a total of <span className="text-emerald-400 font-black">{winner.voteCount} votes</span> verified on the blockchain.
                    </p>
                </div>

                <div className="mt-10 flex gap-4 relative z-10">
                    <div className="bg-white/5 px-6 py-2 rounded-full border border-white/10 text-white font-bold text-sm">
                        TOTAL RECOVERY COMPLETION: 100%
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Status Banner */}
      {!winner && (
        <div className={`${currentStatus.bg} ${currentStatus.border} border p-6 rounded-3xl flex items-start gap-5 shadow-xl animate-in fade-in slide-in-from-top-4 duration-700`}>
            <div className={`p-4 rounded-2xl bg-black/40 backdrop-blur-sm ${currentStatus.color} border border-white/5`}>
                {electionState === 1 ? <Timer className="w-7 h-7 animate-pulse" /> : <Info className="w-7 h-7" />}
            </div>
            <div>
                <h3 className={`text-xl font-black ${currentStatus.color} tracking-tight`}>{currentStatus.title}</h3>
                <p className="text-slate-300 font-medium mt-1 leading-relaxed opacity-80">{currentStatus.desc}</p>
            </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-6 rounded-2xl flex items-center gap-4 animate-in slide-in-from-left-4 duration-500 shadow-lg shadow-red-500/10">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <p className="font-bold">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 p-8 rounded-3xl flex flex-col gap-4 animate-in slide-in-from-bottom-6 duration-700 shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-4">
                <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
                <h4 className="text-xl font-black tracking-tight uppercase">Ballot Successfully Cast</h4>
            </div>
            <button 
                onClick={downloadReceipt}
                className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg"
            >
                <History className="w-4 h-4" />
                Download Receipt
            </button>
          </div>
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 font-mono text-xs break-all leading-relaxed relative group">
            <span className="text-slate-500 block mb-2 font-black uppercase tracking-widest text-[10px]">Blockchain Transaction ID</span>
            {success.split(': ')[1]}
            <button className="absolute top-4 right-4 text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'ballot' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          {candidates.map((candidate, idx) => (
            <div key={candidate.id} className={`glass-panel rounded-3xl p-8 flex flex-col justify-between transition-all duration-500 shadow-xl border border-white/5 relative group overflow-hidden ${electionState === 1 ? 'hover:border-blue-500/50 hover:shadow-blue-500/10' : 'opacity-60 saturate-50 grayscale-[20%]'}`}>
              {electionState === 1 && (
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/5 blur-[80px] group-hover:bg-blue-500/10 transition-colors"></div>
              )}
              
              <div>
                  <div className="flex justify-between items-start mb-6">
                      <div className="bg-slate-800/80 px-3 py-1 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-white/5">
                          Pos 0{idx + 1}
                      </div>
                  </div>
                  <h2 className="text-3xl font-black text-white mb-2 group-hover:text-blue-400 transition-colors">{candidate.name}</h2>
                  <p className="text-slate-500 mb-8 font-mono text-[10px] tracking-widest bg-black/20 px-3 py-1 rounded-full border border-white/5 inline-block">ID: {candidate.id}</p>
              </div>
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Live Votes</span>
                  <span className="text-2xl font-black text-white">{candidate.voteCount}</span>
                </div>
                <button 
                  onClick={() => handleVote(candidate.id)}
                  disabled={voting || success !== '' || electionState !== 1}
                  className={`h-14 px-8 rounded-2xl font-black shadow-2xl transition-all flex items-center gap-3 active:scale-95 ${
                      electionState === 1 
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                  }`}
                >
                  {voting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5 stroke-[4px]"/> Cast Vote</>}
                </button>
              </div>
            </div>
          ))}
          {candidates.length === 0 && !error && (
            <div className="col-span-full text-center py-20 text-slate-600 glass-panel rounded-3xl border-dashed border-2 border-slate-800/50 flex flex-col items-center gap-4">
              <Users className="w-12 h-12 text-slate-800" />
              <p className="font-bold text-lg max-w-xs mx-auto">Ballot candidates are currently being finalized on the blockchain.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
            <div className="glass-panel p-8 rounded-3xl border border-white/5 border-b-blue-500/50">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-blue-500" />
                    Immutable Blockchain Audit
                </h3>
                <p className="text-slate-500 text-sm mt-1">This log displays every single vote recorded on the ledger. Each entry is cryptographically signed and timestamped.</p>
            </div>
            
            <div className="space-y-3">
                {auditLog.map((log, i) => (
                    <div key={i} className="bg-white/5 border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-500/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                                <History className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-200 font-bold text-sm">Verified Vote Recorded</span>
                                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-black uppercase">Block {log.blockNumber}</span>
                                    {log.timestamp && (
                                        <span className="text-[10px] text-emerald-500 font-black">{new Date(log.timestamp * 1000).toLocaleTimeString()}</span>
                                    )}
                                </div>
                                <p className="text-[10px] font-mono text-slate-500 break-all mt-1">{log.transactionHash}</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <div className="text-[10px] text-slate-600 font-black uppercase">Candidate Position</div>
                             <div className="text-white font-black">ID: {log.candidateId}</div>
                        </div>
                    </div>
                ))}
                {auditLog.length === 0 && (
                    <div className="text-center py-20 text-slate-600 glass-panel rounded-3xl border-dashed border-2 border-slate-800/50">
                        The blockchain is currently awaiting the first ballot.
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}
