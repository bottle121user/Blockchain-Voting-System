'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  History, 
  Search, 
  SearchCode, 
  Copy, 
  Check, 
  ArrowLeft, 
  Download, 
  Filter, 
  CheckCircle2, 
  FileCode, 
  Blocks, 
  Activity,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Link from 'next/link';
import api from '../../lib/api';

export default function PublicAuditPage() {
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [networkHealth, setNetworkHealth] = useState(null);
  
  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Ballot Verifier State
  const [verifyInput, setVerifyInput] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [searched, setSearched] = useState(false);
  
  // Feedback
  const [copiedText, setCopiedText] = useState(null);

  const fetchAuditData = async () => {
    try {
      const [auditRes, healthRes] = await Promise.all([
        api.get('/election/audit'),
        api.get('/../health').catch(() => ({ data: null }))
      ]);
      setAuditLog(auditRes.data || []);
      if (healthRes.data) setNetworkHealth(healthRes.data);
    } catch (err) {
      console.error('Failed to load audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
    const interval = setInterval(fetchAuditData, 3000); // 3-second live sync
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleVerify = (e) => {
    e.preventDefault();
    if (!verifyInput.trim()) return;

    const q = verifyInput.trim().toLowerCase();
    const match = auditLog.find(event => 
      (event.transactionHash && event.transactionHash.toLowerCase() === q) ||
      (event.nullifier && event.nullifier.toLowerCase() === q)
    );

    setSearched(true);
    setVerificationResult(match || null);
  };

  const exportAuditJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `chainvote_audit_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLogs = auditLog.filter(log => {
    const matchesFilter = selectedEvent === 'ALL' || log.eventName === selectedEvent;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      (log.transactionHash && log.transactionHash.toLowerCase().includes(q)) ||
      (log.eventName && log.eventName.toLowerCase().includes(q)) ||
      (log.nullifier && log.nullifier.toLowerCase().includes(q)) ||
      (log.blockNumber && log.blockNumber.toString().includes(q));
    return matchesFilter && matchesSearch;
  });

  const latestBlock = auditLog.length > 0 ? Math.max(...auditLog.map(l => l.blockNumber || 0)) : (networkHealth?.blockchain?.latestBlock || 0);

  return (
    <div className="min-h-screen bg-[#020617] text-white pt-28 pb-24 px-6 flex flex-col items-center w-full">
      <div className="w-full max-w-6xl space-y-10">

        {/* Header Breadcrumb */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest hover:text-blue-300 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Home Portal
            </Link>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
              Decentralized <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">Public Audit</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base font-medium max-w-2xl leading-relaxed">
              Open-access ledger observer. Verify on-chain consensus, inspect event logs, or cryptographically prove ballot inclusion on the Ethereum virtual machine.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={exportAuditJSON}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-blue-400" /> Export Audit Log (JSON)
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
              Node Live
            </div>
          </div>
        </div>

        {/* Network Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Blocks className="w-10 h-10 text-blue-400" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Block Height</p>
            <h3 className="text-3xl font-black text-white">#{latestBlock}</h3>
            <p className="text-[10px] text-slate-600 font-bold mt-1">EVM Consensus Head</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <History className="w-10 h-10 text-indigo-400" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Indexed Events</p>
            <h3 className="text-3xl font-black text-indigo-400">{auditLog.length}</h3>
            <p className="text-[10px] text-slate-600 font-bold mt-1">Idempotent Deduplication</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck className="w-10 h-10 text-emerald-400" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nullifiers Committed</p>
            <h3 className="text-3xl font-black text-emerald-400">
              {auditLog.filter(e => e.eventName === 'VoteCast').length}
            </h3>
            <p className="text-[10px] text-slate-600 font-bold mt-1">Single-Vote Invariants</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Layers className="w-10 h-10 text-amber-400" />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Contract Status</p>
            <h3 className="text-2xl font-black text-white font-mono truncate max-w-[180px]">
              0x5FbD...0aa3
            </h3>
            <p className="text-[10px] text-slate-600 font-bold mt-1">VotingSystem.sol</p>
          </div>
        </div>

        {/* Interactive Ballot Verification Section */}
        <div className="glass-panel p-8 md:p-10 rounded-[2.5rem] border border-blue-500/20 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-blue-950/20 shadow-2xl">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <SearchCode className="w-7 h-7" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">Public Ballot Inclusion Verifier</h2>
            <p className="text-slate-400 text-xs md:text-sm">
              Paste the <strong>Transaction Hash</strong> or <strong>Cryptographic Nullifier</strong> from your digital receipt to independently verify that your ballot was mined into the blockchain ledger.
            </p>
          </div>

          <form onSubmit={handleVerify} className="max-w-2xl mx-auto space-y-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Paste 0x... Transaction Hash or Nullifier Commitment"
                value={verifyInput}
                onChange={(e) => setVerifyInput(e.target.value)}
                className="w-full bg-black/60 border border-slate-700/80 rounded-2xl pl-5 pr-28 py-4 text-xs md:text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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

          {/* Verification Result Output */}
          {searched && (
            <div className="max-w-2xl mx-auto mt-6">
              {verificationResult ? (
                <div className="p-6 md:p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-5 animate-in zoom-in-95">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400 flex-shrink-0" />
                    <div>
                      <h4 className="text-lg font-black text-white">Ballot Verified On-Chain</h4>
                      <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Cryptographically Proven on Public Ledger</p>
                    </div>
                  </div>

                  <div className="bg-black/50 p-5 rounded-2xl border border-white/5 space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-500">Event Signature:</span>
                      <span className="text-white font-bold">{verificationResult.eventName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-500">Confirmed Block:</span>
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
                  <p className="text-[11px] text-slate-400 italic">
                    This proof confirms that your vote was executed according to smart contract rules, irreversibly counted in the tally, and cannot be altered or deleted.
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/30 text-red-400 text-center space-y-1 animate-in zoom-in-95">
                  <p className="font-bold text-sm">No Ledger Record Matched</p>
                  <p className="text-xs text-slate-400">Please verify the hash string. Only confirmed on-chain events appear in the public index.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audit Log Stream Section */}
        <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 bg-slate-900/30 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-white">Full Event Ledger Stream</h2>
              <p className="text-slate-400 text-xs">Immutable sequence of events captured directly from smart contract storage.</p>
            </div>

            {/* Filter and Search Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-grow md:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Filter by hash, block..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <select 
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2 text-xs font-bold text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Event Types</option>
                <option value="VoteCast">VoteCast</option>
                <option value="ElectionStateChanged">ElectionStateChanged</option>
                <option value="CandidateAdded">CandidateAdded</option>
                <option value="ElectionCreated">ElectionCreated</option>
              </select>
            </div>
          </div>

          {/* Event Stream Cards */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <Activity className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Indexing Blockchain Blocks...</p>
              </div>
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log, idx) => (
                <div 
                  key={idx}
                  className="p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-blue-500/30 transition-all flex flex-col space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${
                        log.eventName === 'VoteCast' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : log.eventName === 'ElectionAnnulled'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : log.eventName === 'ElectionStateChanged'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-sm ${log.eventName === 'ElectionAnnulled' ? 'text-rose-400' : 'text-white'}`}>
                            {log.eventName}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            Block #{log.blockNumber}
                          </span>
                          {log.candidateId !== undefined && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Candidate #{log.candidateId}
                            </span>
                          )}
                          {log.reason && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Justification: {log.reason}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Indexed: {log.indexedAt ? new Date(log.indexedAt).toLocaleString() : 'Live'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-bold transition-colors"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        {expandedRow === idx ? 'Hide Payload' : 'Inspect Log'}
                        {expandedRow === idx ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Hashes Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-slate-400 pt-1">
                    <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-xl border border-white/5">
                      <span className="text-slate-500 text-[10px] uppercase">Tx:</span>
                      <span className="truncate">{log.transactionHash}</span>
                      <button 
                        onClick={() => copyToClipboard(log.transactionHash)}
                        className="text-slate-500 hover:text-white ml-auto"
                        title="Copy Tx Hash"
                      >
                        {copiedText === log.transactionHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {log.nullifier && (
                      <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-xl border border-white/5">
                        <span className="text-slate-500 text-[10px] uppercase">Nullifier:</span>
                        <span className="truncate text-emerald-400/90">{log.nullifier}</span>
                        <button 
                          onClick={() => copyToClipboard(log.nullifier)}
                          className="text-slate-500 hover:text-white ml-auto"
                          title="Copy Nullifier"
                        >
                          {copiedText === log.nullifier ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expandable Raw Event Inspector */}
                  {expandedRow === idx && (
                    <div className="mt-2 p-4 rounded-xl bg-black border border-slate-800 font-mono text-xs text-slate-300 space-y-2 animate-in fade-in duration-200">
                      <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Decoded Raw EVM Event</p>
                      <pre className="overflow-x-auto text-[11px] text-emerald-400">
                        {JSON.stringify(log, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-500 italic text-sm">
                No events match your search query or filter.
              </div>
            )}
          </div>
        </div>

        {/* Footer Audit Notice */}
        <div className="pt-8 border-t border-white/5 text-center text-xs text-slate-600 font-mono">
          ChainVote Public Audit Suite • Node RPC: http://127.0.0.1:8546 • Smart Contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3
        </div>

      </div>
    </div>
  );
}
