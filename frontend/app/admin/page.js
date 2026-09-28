'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Shield, Users, Plus, Play, Square, UserPlus, Loader2, Trophy, History, Search, CheckCircle, XCircle, LogOut, AlertTriangle, RotateCcw, Award } from 'lucide-react';
import api from '../../lib/api';

export default function AdminDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [electionState, setElectionState] = useState(0); // 0: NotStarted, 1: Ongoing, 2: Ended
  const [onChainState, setOnChainState] = useState(0); // 0: CREATED, 1: REGISTRATION, 2: OPEN, 3: CLOSED, 4: FINALIZED, 5: ANNULLED
  const [electionId, setElectionId] = useState(1);
  const [electionName, setElectionName] = useState('');
  const [annulmentReason, setAnnulmentReason] = useState(null);
  const [parentElectionId, setParentElectionId] = useState(0);
  const [newCandidate, setNewCandidate] = useState('');
  const [newVoter, setNewVoter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const router = useRouter();
  
  // New State for Polishing & Nominations
  const [voters, setVoters] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [nominations, setNominations] = useState([]);
  const [nominationFilter, setNominationFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('results'); // 'results', 'voters', 'nominations', 'audit'
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      const [candRes, stateRes, votersRes, auditRes] = await Promise.all([
        api.get('/election/candidates'),
        api.get('/election/state'),
        api.get('/election/voters'),
        api.get('/election/audit')
      ]);
      setCandidates(candRes.data);
      setElectionState(stateRes.data.state);
      setOnChainState(stateRes.data.onChainState ?? 0);
      const curId = stateRes.data.electionId ?? 1;
      setElectionId(curId);
      setElectionName(stateRes.data.name ?? '');
      setAnnulmentReason(stateRes.data.annulmentReason ?? null);
      setParentElectionId(stateRes.data.parentElectionId ?? 0);
      setVoters(votersRes.data);
      setAuditLog(auditRes.data);

      try {
        const nomRes = await api.get(`/elections/${curId}/nominations`);
        setNominations(nomRes.data || []);
      } catch (_) {}
    } catch (err) {
      console.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('adminToken')) {
      router.push('/admin/login');
      return;
    }
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    router.push('/admin/login');
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!newCandidate) return;
    setActionLoading('candidate');
    try {
      await api.post('/election/candidates', { name: newCandidate });
      setNewCandidate('');
      showMessage("Candidate added successfully!", "success");
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to add candidate", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegisterVoter = async (e) => {
    e.preventDefault();
    if (!newVoter) return;
    setActionLoading('voter');
    try {
      await api.post('/election/voters', { aadhar_number: newVoter });
      setNewVoter('');
      showMessage("Voter registered successfully!", "success");
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to register voter", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleElectionAction = async (action) => {
    if (!confirm(`Are you sure you want to ${action} the election?`)) return;
    setActionLoading(action);
    try {
      await api.post(`/election/${action}`);
      showMessage(`Election ${action}ed successfully!`, "success");
      fetchData();
    } catch (err) {
      showMessage(`Failed to ${action} election`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAnnulElection = async () => {
    const reason = prompt("EMERGENCY AUDIT PROTOCOL:\nPlease enter the reason for annulling this election (e.g. 'Voter credentials leaked in precinct B'):");
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) alert("Annulment reason must be at least 5 characters.");
      return;
    }
    setActionLoading('annul');
    try {
      await api.post(`/elections/${electionId}/annul`, { reason: reason.trim() });
      showMessage("Emergency Annulment successfully executed on Ethereum ledger!", "success");
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.details || err.response?.data?.error || "Failed to annul election", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReElect = async () => {
    const reason = prompt("RE-ELECTION PROTOCOL:\nPlease enter the re-election justification (e.g. 'Fresh credential distribution and nullifier rotation completed'):");
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) alert("Re-election justification must be at least 5 characters.");
      return;
    }
    setActionLoading('re-elect');
    try {
      const res = await api.post(`/elections/${electionId}/re-elect`, { reason: reason.trim() });
      showMessage(`Linked Re-Election Session #${res.data.newElectionId} spawned successfully on blockchain!`, "success");
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.details || err.response?.data?.error || "Failed to deploy re-election", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveNomination = async (nominationId, candidateName) => {
    if (!confirm(`Are you sure you want to approve ${candidateName} and permanently write their candidacy to the Ethereum blockchain?`)) return;
    setActionLoading(`approve-${nominationId}`);
    try {
      const res = await api.post(`/elections/${electionId}/nominations/${nominationId}/approve`);
      showMessage(`Candidate ${candidateName} approved and minted to blockchain! (Tx: ${res.data.txHash.substring(0, 16)}...)`, "success");
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.details || err.response?.data?.error || "Failed to approve nomination on blockchain", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectNomination = async (nominationId, candidateName) => {
    const reason = prompt(`DISQUALIFICATION / REJECTION:\nPlease enter the reason for rejecting ${candidateName}'s nomination:`);
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) alert("Rejection reason must be at least 5 characters.");
      return;
    }
    setActionLoading(`reject-${nominationId}`);
    try {
      await api.post(`/elections/${electionId}/nominations/${nominationId}/reject`, { reason: reason.trim() });
      showMessage(`Nomination for ${candidateName} rejected.`, "success");
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to reject nomination", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const totalVotes = candidates.reduce((acc, curr) => acc + parseInt(curr.voteCount), 0);
  const stateLabels = ["Not Started", "Ongoing", "Ended"];
  const stateColors = ["text-amber-400", "text-emerald-400", "text-red-400"];

  // Determine winner
  const sortedCandidates = [...candidates].sort((a, b) => parseInt(b.voteCount) - parseInt(a.voteCount));
  const winner = electionState === 2 && onChainState !== 5 && sortedCandidates.length > 0 ? sortedCandidates[0] : null;

  const filteredVoters = voters.filter(v => v.hashed_aadhar.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full max-w-7xl flex flex-col gap-8 pb-20 px-4 md:px-0">
      {/* Header with Glassmorphism */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 glass-panel p-8 rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>
        
        <div className="flex items-center gap-6 relative z-10">
            <div className={`p-4 rounded-2xl bg-opacity-10 backdrop-blur-md border border-white/10 ${onChainState === 5 ? 'bg-rose-500 text-rose-400 shadow-rose-500/20 shadow-lg' : electionState === 1 ? 'bg-emerald-500 text-emerald-400 shadow-emerald-500/20 shadow-lg' : 'bg-blue-500 text-blue-400 shadow-blue-500/20 shadow-lg'}`}>
                <Shield className="w-10 h-10" />
            </div>
            <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black tracking-tight text-white">{electionName || `Election #${electionId}`}</h1>
                  {parentElectionId > 0 && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      Re-Election of #{parentElectionId}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 flex items-center gap-2 mt-1">
                    System Phase: {onChainState === 5 ? (
                      <span className="font-bold px-3 py-0.5 rounded-full text-xs border border-rose-500/50 bg-rose-500/10 text-rose-400">ANNULLED & FROZEN</span>
                    ) : (
                      <span className={`font-bold px-3 py-0.5 rounded-full text-xs border border-current ${stateColors[electionState]}`}>{stateLabels[electionState]}</span>
                    )}
                    <span className="text-xs text-slate-500 font-mono">• Session #{electionId}</span>
                </p>
            </div>
        </div>
        
        <div className="flex gap-3 relative z-10 items-center flex-wrap">
            <button 
                onClick={handleAdminLogout}
                className="p-3.5 rounded-2xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all border border-white/10"
                title="Logout Admin"
            >
                <LogOut className="w-5 h-5" />
            </button>

            {onChainState !== 5 && onChainState < 4 && (
                <button 
                    onClick={handleAnnulElection}
                    disabled={actionLoading === 'annul'}
                    className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-5 py-3 rounded-2xl font-bold text-xs transition-all active:scale-95"
                    title="Emergency Invalidation & Forensic Lock"
                >
                    {actionLoading === 'annul' ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    Emergency Annul
                </button>
            )}

            {onChainState === 5 && (
                <button 
                    onClick={handleReElect}
                    disabled={actionLoading === 're-elect'}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-6 py-3 rounded-2xl font-black text-xs transition-all shadow-xl shadow-indigo-900/30 active:scale-95"
                >
                    {actionLoading === 're-elect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Deploy Linked Re-Election
                </button>
            )}

            {electionState === 0 && onChainState !== 5 && (
                <button 
                    onClick={() => handleElectionAction('start')}
                    disabled={actionLoading === 'start' || candidates.length < 2}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white px-8 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/30 active:scale-95"
                >
                    {actionLoading === 'start' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                    Launch Election
                </button>
            )}
            {electionState === 1 && onChainState !== 5 && (
                <button 
                    onClick={() => handleElectionAction('end')}
                    disabled={actionLoading === 'end'}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-50 text-white px-8 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-red-900/30 active:scale-95"
                >
                    {actionLoading === 'end' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
                    Close Polls
                </button>
            )}
            {electionState === 2 && onChainState !== 5 && (
                <div className="bg-slate-800/80 backdrop-blur-md text-slate-400 px-8 py-3.5 rounded-2xl font-black border border-slate-700/50 shadow-inner">
                    Election Completed
                </div>
            )}
            {onChainState === 5 && (
                <div className="bg-rose-950/60 backdrop-blur-md text-rose-400 px-5 py-3 rounded-2xl font-black border border-rose-800/50 shadow-inner flex items-center gap-2 text-xs">
                    <XCircle className="w-4 h-4" /> Annulled & Frozen
                </div>
            )}
        </div>
      </div>

      {/* Forensic Incident Banner for Annulled Election */}
      {onChainState === 5 && (
        <div className="glass-panel p-6 rounded-3xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-red-950/20 to-rose-950/40 shadow-2xl space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-rose-400">Forensic Audit Incident Lock</span>
                <h3 className="text-xl md:text-2xl font-black text-white">Election #{electionId} Was Annulled</h3>
                <p className="text-sm text-slate-300 mt-1">
                  Documented Justification: <strong className="text-rose-300 font-medium italic">"{annulmentReason || 'Security Invalidation'}"</strong>
                </p>
              </div>
            </div>
            <button
              onClick={handleReElect}
              disabled={actionLoading === 're-elect'}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-xl shadow-indigo-900/30 active:scale-95 transition-all whitespace-nowrap"
            >
              {actionLoading === 're-elect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Deploy Linked Re-Election
            </button>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Audit Trail Preserved: All cast nullifiers and block logs remain immutably archived on the Ethereum ledger for historical audit. The re-election protocol will clone candidate rosters while issuing fresh single-vote invariants.
          </p>
        </div>
      )}

      {message.text && (
        <div className={`p-5 rounded-2xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/10' : 'bg-red-500/10 border-red-500/50 text-red-400 shadow-lg shadow-red-500/10'} animate-in fade-in slide-in-from-top-4 duration-500`}>
            {message.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Winner Spotlight (Phase 2 Polishing) */}
      {winner && (
        <div className="glass-panel p-1 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-1000 border border-emerald-500/30">
            <div className="bg-gradient-to-r from-emerald-600/20 via-blue-600/20 to-emerald-600/20 p-8 rounded-[22px] flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-emerald-500/10 opacity-50"></div>
                
                <div className="flex items-center gap-8 relative z-10">
                    <div className="p-6 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl shadow-xl shadow-amber-500/30">
                        <Trophy className="w-16 h-16 text-white" />
                    </div>
                    <div>
                        <span className="text-amber-400 text-sm font-black uppercase tracking-[0.2em]">Official Winner</span>
                        <h2 className="text-5xl font-black text-white mt-1 drop-shadow-md">{winner.name}</h2>
                        <div className="flex items-center gap-4 mt-4">
                            <div className="bg-emerald-500/20 px-4 py-1.5 rounded-full border border-emerald-500/30 text-emerald-400 font-bold">
                                {winner.voteCount} Votes
                            </div>
                            <div className="bg-blue-500/20 px-4 py-1.5 rounded-full border border-blue-500/30 text-blue-400 font-bold">
                                {totalVotes === 0 ? 0 : Math.round((winner.voteCount / totalVotes) * 100)}% Majority
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col items-center md:items-end relative z-10">
                    <p className="text-slate-400 text-xs font-mono mb-2 uppercase italic">Verified Ledger Event</p>
                    <div className="bg-black/40 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/5 font-mono text-emerald-400/80 text-sm break-all max-w-[300px] text-right">
                        {auditLog.length > 0 ? `${auditLog[0].transactionHash?.substring(0, 16)}...` : 'On-Chain Validated'}
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-4">
            <button 
                onClick={() => setActiveTab('results')}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl font-bold transition-all border ${activeTab === 'results' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:border-slate-700'}`}
            >
                <BarChart3 className="w-6 h-6" />
                Live Results
            </button>
            <button 
                onClick={() => setActiveTab('voters')}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl font-bold transition-all border ${activeTab === 'voters' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:border-slate-700'}`}
            >
                <Users className="w-6 h-6" />
                Voter Directory
            </button>
            <button 
                onClick={() => setActiveTab('nominations')}
                className={`w-full flex items-center justify-between p-5 rounded-2xl font-bold transition-all border ${activeTab === 'nominations' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:border-slate-700'}`}
            >
                <div className="flex items-center gap-4">
                  <Award className="w-6 h-6" />
                  Nominations
                </div>
                {nominations.filter(n => n.status === 'PENDING').length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black">
                    {nominations.filter(n => n.status === 'PENDING').length}
                  </span>
                )}
            </button>
            <button 
                onClick={() => setActiveTab('audit')}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl font-bold transition-all border ${activeTab === 'audit' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:border-slate-700'}`}
            >
                <History className="w-6 h-6" />
                Audit Trail
            </button>

            {/* Quick Management Section */}
            <div className="mt-8 pt-8 border-t border-slate-800 hidden lg:block">
                <div className="glass-panel p-5 rounded-2xl border border-slate-800/50">
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Express Actions</h3>
                    <div className="space-y-3">
                        <button 
                             onClick={() => {
                                 const name = prompt("Quick add candidate name:");
                                 if (name) api.post('/election/candidates', { name }).then(() => fetchData());
                             }}
                             disabled={electionState !== 0}
                             className="w-full flex items-center gap-3 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-30 disabled:grayscale"
                        >
                            <Plus className="w-4 h-4" /> Add Candidate
                        </button>
                        <button 
                             onClick={() => {
                                const id = prompt("Quick whitelist Aadhar:");
                                if (id) api.post('/election/voters', { aadhar_number: id }).then(() => fetchData());
                            }}
                             className="w-full flex items-center gap-3 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            <UserPlus className="w-4 h-4" /> Authorize Voter
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-8">
            {activeTab === 'results' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="glass-panel p-8 rounded-3xl shadow-xl border border-white/5">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h2 className="text-2xl font-black text-white">Consolidated Results</h2>
                                <p className="text-slate-400 text-sm">Real-time vote tallies from the decentralized ledger.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Total Turnout</p>
                                    <p className="text-2xl font-black text-white">{totalVotes}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-8">
                            {loading && candidates.length === 0 ? (
                            <div className="flex flex-col items-center py-20 gap-4">
                                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                <p className="text-slate-500 font-medium italic">Fetching ballot data...</p>
                            </div>
                            ) : (
                            candidates.map((cand, idx) => (
                                <div key={cand.id} className="w-full group">
                                    <div className="flex justify-between items-end text-sm mb-4">
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-slate-600 font-black text-xl">0{idx + 1}</span>
                                            <span className="font-black text-slate-100 text-2xl group-hover:text-blue-400 transition-colors">{cand.name}</span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-emerald-400 font-black text-3xl">{cand.voteCount}</span>
                                            <span className="text-slate-500 text-xs font-black uppercase tracking-widest">Votes</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-800/40 rounded-2xl h-6 overflow-hidden border border-white/5 relative shadow-inner">
                                        <div 
                                            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-400 h-full rounded-2xl transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) relative z-10" 
                                            style={{ width: `${totalVotes === 0 ? 0 : (parseInt(cand.voteCount) / (totalVotes || 1)) * 100}%` }}
                                        >
                                            <div className="absolute top-0 right-0 w-8 h-full bg-white/20 blur-md"></div>
                                        </div>
                                        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-end px-4 text-[10px] font-black text-slate-600 z-0">
                                            {totalVotes === 0 ? 0 : Math.round((parseInt(cand.voteCount) / totalVotes) * 100)}% SHARE
                                        </div>
                                    </div>
                                </div>
                            ))
                            )}
                            {candidates.length === 0 && !loading && (
                            <div className="text-center py-20 border-2 border-dashed border-slate-800/50 rounded-3xl bg-slate-900/20">
                                <Plus className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                <p className="text-slate-500 font-bold">No candidates have been registered for this session.</p>
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'voters' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="glass-panel p-8 rounded-3xl shadow-xl border border-white/5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                            <div>
                                <h2 className="text-2xl font-black text-white">Voter Registry</h2>
                                <p className="text-slate-400 text-sm">List of all whitelisted and authorized Aadhar hashes.</p>
                            </div>
                            <div className="relative">
                                <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input 
                                    type="text"
                                    placeholder="Search Hash..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-slate-900/80 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white w-full md:w-64"
                                />
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/30">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-slate-500 text-xs font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-6 py-5">Hashed Identifier</th>
                                        <th className="px-6 py-5">Participation</th>
                                        <th className="px-6 py-5">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredVoters.map((v, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-5 font-mono text-xs text-slate-400 group-hover:text-blue-400">
                                                {v.hashed_aadhar}
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${v.has_voted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                                                    {v.has_voted ? 'Voted' : 'Eligible'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <div className={`w-2 h-2 rounded-full ${v.has_voted ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`}></div>
                                                    {v.has_voted ? 'Verification Success' : 'Awaiting Vote'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredVoters.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-20 text-center text-slate-500 font-bold italic">
                                                No voters found in registry.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'nominations' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
                    <div className="glass-panel p-8 rounded-3xl shadow-xl border border-white/5 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-white">Candidate Nominations Review</h2>
                                <p className="text-slate-400 text-sm">Review statutory eligibility, verify seconders, and mint approved candidates to the blockchain.</p>
                            </div>
                            <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 w-fit">
                                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setNominationFilter(filter)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                            nominationFilter === filter
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {filter} {filter === 'PENDING' && nominations.filter(n => n.status === 'PENDING').length > 0 && `(${nominations.filter(n => n.status === 'PENDING').length})`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {nominations
                                .filter(n => nominationFilter === 'ALL' || n.status === nominationFilter)
                                .map((nom) => (
                                    <div 
                                        key={nom.id}
                                        className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-blue-500/30 transition-all space-y-4"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-black text-white">{nom.full_name}</h3>
                                                    <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                        nom.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                        nom.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                                        'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                                    }`}>
                                                        {nom.status}
                                                    </span>
                                                    {nom.candidate_index !== null && nom.candidate_index !== undefined && (
                                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                                                            Candidate #{nom.candidate_index}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400">
                                                    Party: <strong className="text-indigo-400">{nom.party_affiliation}</strong> • Age: <strong>{nom.age}</strong> • Filed: {new Date(nom.created_at).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {nom.status === 'PENDING' && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleApproveNomination(nom.id, nom.full_name)}
                                                        disabled={actionLoading === `approve-${nom.id}`}
                                                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-emerald-950/30 active:scale-95 transition-all flex items-center gap-2"
                                                    >
                                                        {actionLoading === `approve-${nom.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                        Approve & Mint
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectNomination(nom.id, nom.full_name)}
                                                        disabled={actionLoading === `reject-${nom.id}`}
                                                        className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs transition-all active:scale-95"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300 leading-relaxed font-sans">
                                            <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Manifesto Platform Vision</span>
                                            "{nom.manifesto}"
                                        </div>

                                        {nom.rejection_reason && (
                                            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/30 text-xs text-rose-300 font-mono">
                                                Rejection Reason: {nom.rejection_reason}
                                            </div>
                                        )}

                                        {nom.blockchain_tx_hash && (
                                            <div className="text-[10px] text-slate-500 font-mono truncate">
                                                Blockchain Tx: <span className="text-emerald-400">{nom.blockchain_tx_hash}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                            {nominations.filter(n => nominationFilter === 'ALL' || n.status === nominationFilter).length === 0 && (
                                <div className="text-center py-16 text-slate-500 italic text-xs">
                                    No candidate nominations found for this election session.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="glass-panel p-8 rounded-3xl shadow-xl border border-white/5">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h2 className="text-2xl font-black text-white">Blockchain Audit Trail</h2>
                                <p className="text-slate-400 text-sm">Immutable history of every encrypted vote cast on the ledger.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {auditLog.map((log, i) => (
                                <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-500/30 transition-all group">
                                    <div className="flex items-center gap-6">
                                        <div className="bg-blue-500/10 p-3 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                                            <Shield className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-300 font-bold">Vote cast for Candidate {log.candidateId}</span>
                                                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-black">BLOCK #{log.blockNumber}</span>
                                                {log.timestamp && (
                                                    <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">
                                                        {new Date(log.timestamp * 1000).toLocaleTimeString()}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 font-mono mt-1 group-hover:text-blue-400/80 transition-colors">
                                                {log.transactionHash}
                                            </p>
                                        </div>
                                    </div>
                                    <button className="text-xs font-black text-blue-400 bg-blue-500/10 px-4 py-2 rounded-xl hover:bg-blue-500 hover:text-white transition-all">
                                        VERIFY ON LEDGER
                                    </button>
                                </div>
                            ))}
                            {auditLog.length === 0 && (
                                <div className="text-center py-20 bg-slate-900/20 border-2 border-dashed border-slate-800/50 rounded-3xl">
                                    <History className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                    <p className="text-slate-500 font-bold italic">The decentralized ledger is currently empty.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
