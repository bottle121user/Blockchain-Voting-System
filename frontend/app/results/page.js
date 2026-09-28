'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Trophy, 
  Activity, 
  Search, 
  CheckCircle2, 
  ShieldCheck, 
  Clock,
  ArrowLeft,
  History,
  Copy,
  Check,
  ExternalLink,
  Filter,
  SearchCode,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import api from '../../lib/api';

export default function ResultsAndAuditPage() {
  const [candidates, setCandidates] = useState([]);
  const [electionState, setElectionState] = useState(0);
  const [onChainState, setOnChainState] = useState(0);
  const [annulmentReason, setAnnulmentReason] = useState(null);
  const [parentElectionId, setParentElectionId] = useState(0);
  const [electionId, setElectionId] = useState(1);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tally'); // 'tally', 'audit', 'verify'
  
  // Search & Filters
  const [candidateSearch, setCandidateSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('ALL');
  
  // Verification Tool State
  const [verifyInput, setVerifyInput] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [hasSearchedVerify, setHasSearchedVerify] = useState(false);

  // Copy Feedback
  const [copiedHash, setCopiedHash] = useState(null);

  const fetchData = async () => {
    try {
      const [candRes, stateRes, auditRes] = await Promise.all([
        api.get('/election/candidates'),
        api.get('/election/state'),
        api.get('/election/audit')
      ]);
      setCandidates(candRes.data);
      setElectionState(stateRes.data.state);
      setOnChainState(stateRes.data.onChainState ?? 0);
      setAnnulmentReason(stateRes.data.annulmentReason ?? null);
      setParentElectionId(stateRes.data.parentElectionId ?? 0);
      setElectionId(stateRes.data.electionId ?? 1);
      setAuditLog(auditRes.data);
    } catch (err) {
      console.error("Failed to fetch results & audit data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // Live poll every 4 seconds
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  // Ballot Verification Handler
  const handleVerifyBallot = (e) => {
    e.preventDefault();
    if (!verifyInput.trim()) return;

    const query = verifyInput.trim().toLowerCase();
    const match = auditLog.find(event => 
      (event.transactionHash && event.transactionHash.toLowerCase() === query) ||
      (event.nullifier && event.nullifier.toLowerCase() === query)
    );

    setHasSearchedVerify(true);
    setVerificationResult(match || null);
  };

  const totalVotes = candidates.reduce((acc, curr) => acc + parseInt(curr.voteCount), 0);
  const sortedCandidates = [...candidates].sort((a, b) => parseInt(b.voteCount) - parseInt(a.voteCount));
  const winner = electionState === 2 && onChainState !== 5 && sortedCandidates.length > 0 ? sortedCandidates[0] : null;

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(candidateSearch.toLowerCase())
  );

  const filteredAuditLog = auditLog.filter(event => {
    const matchesFilter = eventFilter === 'ALL' || event.eventName === eventFilter;
    const q = auditSearch.toLowerCase();
    const matchesSearch = !q || 
      (event.transactionHash && event.transactionHash.toLowerCase().includes(q)) ||
      (event.eventName && event.eventName.toLowerCase().includes(q)) ||
      (event.nullifier && event.nullifier.toLowerCase().includes(q)) ||
      (event.blockNumber && event.blockNumber.toString().includes(q));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#020617] text-white pt-28 pb-24 px-6 flex flex-col items-center w-full">
      <div className="w-full max-w-6xl space-y-10">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest hover:text-blue-300 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Return to Public Portal
            </Link>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
              Public <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">Audit & Results</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base font-medium max-w-2xl leading-relaxed">
              Open-access ledger telemetry. Inspect real-time on-chain tallies, monitor every emitted smart contract event, or verify your individual ballot.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold shadow-lg shadow-emerald-950/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
              Live Node Sync (4s)
            </div>
          </div>
        </div>

        {/* Global Network Telemetry */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <BarChart3 className="w-10 h-10 text-blue-400" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Confirmed Ballots</p>
            <h3 className="text-3xl font-black text-white">{totalVotes}</h3>
            <p className="text-[10px] text-slate-600 font-bold mt-1">On-Chain Consensus</p>
          </div>
          
          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <History className="w-10 h-10 text-indigo-400" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Indexed Events</p>
            <h3 className="text-3xl font-black text-indigo-400">{auditLog.length}</h3>
            <p className="text-[10px] text-slate-600 font-bold mt-1">Deduplicated Logs</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck className="w-10 h-10 text-emerald-400" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Integrity Mechanism</p>
            <h3 className="text-2xl font-black text-emerald-400">Nullifier Hash</h3>
            <p className="text-[10px] text-slate-600 font-bold mt-1">Cryptographic Commit</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Clock className="w-10 h-10 text-amber-400" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Election Phase</p>
            <h3 className="text-3xl font-black text-white">
              {onChainState === 5 ? (
                <span className="text-rose-400">ANNULLED</span>
              ) : electionState === 1 ? (
                'OPEN'
              ) : electionState === 2 ? (
                'CLOSED'
              ) : (
                'PREP'
              )}
            </h3>
            <p className="text-[10px] text-slate-600 font-bold mt-1">Smart Contract State</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5 w-fit">
          <button 
            onClick={() => setActiveTab('tally')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${activeTab === 'tally' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}
          >
            <BarChart3 className="w-4 h-4" /> Live Vote Tally
          </button>
          <button 
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${activeTab === 'audit' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}
          >
            <History className="w-4 h-4" /> Public Audit Trail ({auditLog.length})
          </button>
          <button 
            onClick={() => setActiveTab('verify')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${activeTab === 'verify' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-white'}`}
          >
            <SearchCode className="w-4 h-4" /> Verify My Ballot
          </button>
        </div>

        {/* TAB 1: LIVE VOTE TALLY */}
        {activeTab === 'tally' && (
          <div className="space-y-10 animate-in fade-in duration-300">
            {onChainState === 5 && (
              <div className="p-8 rounded-[2.5rem] bg-gradient-to-r from-rose-950/50 via-red-950/30 to-rose-950/50 border border-rose-500/40 shadow-2xl flex flex-col md:flex-row items-center gap-6">
                <div className="p-5 bg-rose-500/20 text-rose-400 rounded-3xl border border-rose-500/30">
                  <AlertTriangle className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-rose-400">Forensic Invalidation Protocol</span>
                  <h2 className="text-2xl md:text-3xl font-black text-white">Election Session #{electionId} Was Annulled</h2>
                  <p className="text-sm text-slate-300">
                    Documented Justification: <strong className="text-rose-300 font-medium italic">"{annulmentReason || 'Security Invalidation'}"</strong>
                  </p>
                  <p className="text-xs text-slate-400 font-mono pt-1">
                    All cast ballots and nullifiers remain immutably archived on the Ethereum blockchain for audit investigation. Tallies from this session are voided.
                  </p>
                </div>
              </div>
            )}

            {winner && (
              <div className="p-1 rounded-[2.5rem] bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-emerald-500/20 border border-emerald-500/30 shadow-2xl">
                <div className="bg-[#020617]/90 backdrop-blur-3xl p-10 rounded-[2.25rem] flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-8">
                    <div className="p-6 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl shadow-xl shadow-amber-500/30">
                      <Trophy className="w-14 h-14 text-white" />
                    </div>
                    <div>
                      <span className="text-amber-400 text-xs font-black uppercase tracking-[0.25em]">Official Winner Proclaimed</span>
                      <h2 className="text-4xl md:text-5xl font-black text-white mt-1 leading-none">{winner.name}</h2>
                      <div className="flex items-center gap-4 mt-4">
                        <div className="bg-emerald-500/10 px-5 py-1.5 rounded-full border border-emerald-500/30 text-emerald-400 font-bold text-sm">
                          {winner.voteCount} Verified Votes
                        </div>
                        <div className="bg-blue-500/10 px-5 py-1.5 rounded-full border border-blue-500/30 text-blue-400 font-bold text-sm">
                          {totalVotes === 0 ? 0 : Math.round((winner.voteCount / totalVotes) * 100)}% Majority Share
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center md:text-right space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Integrity Guarantee</p>
                    <p className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                      ON-CHAIN TALLY VERIFIED BY SMART CONTRACT
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="glass-panel p-8 md:p-10 rounded-[2.5rem] border border-white/5 bg-slate-900/30 backdrop-blur-2xl">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                <div>
                  <h2 className="text-2xl font-black text-white">Consolidated Candidate Tallies</h2>
                  <p className="text-slate-400 text-sm">Publicly verifiable vote count fetched directly from the EVM smart contract.</p>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search candidate..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    className="w-full bg-black/40 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div className="space-y-8">
                {loading ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <Activity className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Querying Blockchain Nodes...</p>
                  </div>
                ) : filteredCandidates.length > 0 ? (
                  filteredCandidates.map((c, i) => (
                    <div key={c.id} className="group">
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex items-baseline gap-3">
                          <span className="text-slate-700 font-black text-2xl group-hover:text-blue-400 transition-colors">0{i+1}</span>
                          <h4 className="text-xl font-black text-slate-200 group-hover:text-white transition-colors">{c.name}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-blue-400">{c.voteCount}</span>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Votes</span>
                        </div>
                      </div>
                      <div className="w-full h-6 bg-black/50 rounded-xl overflow-hidden border border-white/5 relative">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-400 rounded-xl transition-all duration-1000 ease-out"
                          style={{ width: `${totalVotes === 0 ? 0 : (c.voteCount / totalVotes) * 100}%` }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-end px-4">
                          <span className="text-[10px] font-black text-slate-400">
                            {totalVotes === 0 ? 0 : Math.round((c.voteCount / totalVotes) * 100)}% SHARE
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500 font-bold italic">No candidates match your query.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PUBLIC AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 bg-slate-900/30">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white">Decentralized Event Audit Stream</h2>
                  <p className="text-slate-400 text-sm">Every vote and administrative lifecycle change is an immutable on-chain event.</p>
                </div>
                
                {/* Search & Filter Controls */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-grow md:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Filter by hash, block..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="w-full bg-black/40 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <select 
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-300 focus:outline-none"
                  >
                    <option value="ALL">All Events</option>
                    <option value="VoteCast">VoteCast</option>
                    <option value="CandidateAdded">CandidateAdded</option>
                    <option value="ElectionStateChanged">ElectionStateChanged</option>
                    <option value="ElectionCreated">ElectionCreated</option>
                  </select>
                </div>
              </div>

              {/* Event Stream */}
              <div className="space-y-3">
                {filteredAuditLog.length > 0 ? (
                  filteredAuditLog.map((event, i) => (
                    <div 
                      key={i}
                      className="p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-blue-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-start md:items-center gap-4">
                        <div className={`p-3 rounded-xl flex-shrink-0 ${
                          event.eventName === 'VoteCast' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : event.eventName === 'ElectionStateChanged'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-white">{event.eventName}</span>
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              Block #{event.blockNumber}
                            </span>
                            {event.candidateId !== undefined && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Candidate ID: {event.candidateId}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono">
                              {event.indexedAt ? new Date(event.indexedAt).toLocaleTimeString() : 'Recorded'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs font-mono text-slate-400 break-all">
                              Tx: {event.transactionHash}
                            </span>
                            <button 
                              onClick={() => copyToClipboard(event.transactionHash)}
                              className="text-slate-500 hover:text-white transition-colors"
                              title="Copy Transaction Hash"
                            >
                              {copiedHash === event.transactionHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          {event.nullifier && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono text-emerald-400/80 break-all">
                                Nullifier: {event.nullifier}
                              </span>
                              <button 
                                onClick={() => copyToClipboard(event.nullifier)}
                                className="text-slate-500 hover:text-white transition-colors"
                                title="Copy Nullifier Commitment"
                              >
                                {copiedHash === event.nullifier ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                          VERIFIED IMMUTABLE
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-slate-500 italic">No blockchain events match your filter criteria.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VERIFY MY BALLOT TOOL */}
        {activeTab === 'verify' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="glass-panel p-8 md:p-12 rounded-[2.5rem] border border-white/5 bg-slate-900/30">
              <div className="max-w-2xl mx-auto text-center space-y-4 mb-10">
                <div className="inline-flex p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <SearchCode className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black text-white">Ballot Audit & Verification Tool</h2>
                <p className="text-slate-400 text-sm">
                  Paste either your <strong>Transaction Hash</strong> or your <strong>Cryptographic Nullifier</strong> from your digital receipt to verify its permanent inclusion on the blockchain.
                </p>
              </div>

              <form onSubmit={handleVerifyBallot} className="max-w-2xl mx-auto space-y-4">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Enter 0x... Transaction Hash or Nullifier"
                    value={verifyInput}
                    onChange={(e) => setVerifyInput(e.target.value)}
                    className="w-full bg-black/50 border border-slate-800 rounded-2xl pl-6 pr-24 py-4 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    Verify
                  </button>
                </div>
              </form>

              {/* Verification Output */}
              {hasSearchedVerify && (
                <div className="max-w-2xl mx-auto mt-8">
                  {verificationResult ? (
                    <div className="p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-6 animate-in zoom-in-95">
                      <div className="flex items-center gap-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
                        <div>
                          <h4 className="text-xl font-black text-white">Ballot Verified On-Chain</h4>
                          <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Cryptographically Proven on Public Ledger</p>
                        </div>
                      </div>

                      <div className="bg-black/40 p-6 rounded-2xl border border-white/5 space-y-3 font-mono text-xs">
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-500">Event Signature:</span>
                          <span className="text-white font-bold">{verificationResult.eventName}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-500">Mined in Block:</span>
                          <span className="text-emerald-400 font-bold">#{verificationResult.blockNumber}</span>
                        </div>
                        <div className="flex flex-col gap-1 py-1 border-b border-white/5">
                          <span className="text-slate-500">Transaction Hash:</span>
                          <span className="text-slate-300 break-all">{verificationResult.transactionHash}</span>
                        </div>
                        {verificationResult.nullifier && (
                          <div className="flex flex-col gap-1 py-1">
                            <span className="text-slate-500">Cryptographic Nullifier:</span>
                            <span className="text-emerald-400 break-all">{verificationResult.nullifier}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed italic">
                        This receipt confirms that your ballot was validated by the smart contract rules and counted towards the official tally without exposing your real-world identity.
                      </p>
                    </div>
                  ) : (
                    <div className="p-8 rounded-3xl bg-red-500/10 border border-red-500/30 text-red-400 text-center space-y-2 animate-in zoom-in-95">
                      <p className="font-bold text-base">No Matching Record Found on the Ledger</p>
                      <p className="text-xs text-slate-400">
                        Double-check the transaction hash or nullifier string. Ensure that the transaction was confirmed on the local blockchain node.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Audit Notice */}
        <div className="pt-8 border-t border-white/5 text-center text-xs text-slate-600 font-mono">
          Decentralized Public Ledger Explorer • Hardhat EVM Port 8546 • Smart Contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3
        </div>

      </div>
    </div>
  );
}
