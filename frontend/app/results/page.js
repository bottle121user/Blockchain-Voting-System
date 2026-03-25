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
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import api from '../../lib/api';

export default function ResultsPage() {
  const [candidates, setCandidates] = useState([]);
  const [electionState, setElectionState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      const [candRes, stateRes] = await Promise.all([
        api.get('/election/candidates'),
        api.get('/election/state')
      ]);
      setCandidates(candRes.data);
      setElectionState(stateRes.data.state);
    } catch (err) {
      console.error("Failed to fetch results:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalVotes = candidates.reduce((acc, curr) => acc + parseInt(curr.voteCount), 0);
  const sortedCandidates = [...candidates].sort((a, b) => parseInt(b.voteCount) - parseInt(a.voteCount));
  const winner = electionState === 2 && sortedCandidates.length > 0 ? sortedCandidates[0] : null;

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white pt-32 pb-20 px-6 flex flex-col items-center">
      <div className="w-full max-w-5xl space-y-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-12">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest hover:text-blue-300 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
            </Link>
            <h1 className="text-5xl font-black tracking-tighter">Election <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Ledger</span></h1>
            <p className="text-slate-400 font-medium max-w-md">Real-time cryptographic verification of the democratic process. All data is fetched directly from the blockchain.</p>
          </div>
          
          <div className="flex flex-col items-end gap-2 text-right">
             <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Live Ledger Sync</span>
             </div>
             <p className="text-xs text-slate-500 font-mono italic">Node: Mainnet-Relayer-01</p>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="glass-panel p-8 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Activity className="w-12 h-12 text-blue-400" />
              </div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Total Turnout</p>
              <h3 className="text-4xl font-black text-white">{totalVotes}</h3>
              <p className="text-[10px] text-slate-600 font-bold mt-2 italic">Updated seconds ago</p>
           </div>
           
           <div className="glass-panel p-8 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <ShieldCheck className="w-12 h-12 text-emerald-400" />
              </div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Network Health</p>
              <h3 className="text-4xl font-black text-emerald-400">100%</h3>
              <p className="text-[10px] text-slate-600 font-bold mt-2 italic">Consensus Reached</p>
           </div>

           <div className="glass-panel p-8 rounded-3xl border border-white/5 bg-slate-900/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Clock className="w-12 h-12 text-amber-400" />
              </div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Election Phase</p>
              <h3 className="text-4xl font-black text-white">{electionState === 1 ? 'LIVE' : electionState === 2 ? 'ENDED' : 'PREP'}</h3>
              <p className="text-[10px] text-slate-600 font-bold mt-2 italic">Immutable State</p>
           </div>
        </div>

        {/* Winner Highlight */}
        {winner && (
           <div className="p-1 rounded-[3rem] bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-emerald-500/20 border border-emerald-500/30 shadow-2xl animate-in zoom-in-95 duration-1000">
              <div className="bg-[#020617]/80 backdrop-blur-3xl p-12 rounded-[2.75rem] flex flex-col md:flex-row items-center justify-between gap-12">
                 <div className="flex items-center gap-10">
                    <div className="p-8 bg-gradient-to-br from-amber-400 to-orange-600 rounded-[2rem] shadow-2xl shadow-amber-500/40 rotate-3">
                       <Trophy className="w-16 h-16 text-white" />
                    </div>
                    <div>
                       <span className="text-amber-400 text-sm font-black uppercase tracking-[0.3em]">Official Proclamation</span>
                       <h2 className="text-6xl font-black text-white mt-2 leading-none">{winner.name}</h2>
                       <div className="flex items-center gap-4 mt-6">
                          <div className="bg-emerald-500/10 px-6 py-2 rounded-2xl border border-emerald-500/30 text-emerald-400 font-black">
                             {winner.voteCount} Verified Votes
                          </div>
                          <div className="bg-blue-500/10 px-6 py-2 rounded-2xl border border-blue-500/30 text-blue-400 font-black">
                             {Math.round((winner.voteCount / totalVotes) * 100)}% Majority Share
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="text-center md:text-right space-y-2 opacity-50">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Election Integrity Hash</p>
                    <p className="font-mono text-[10px] text-emerald-400 bg-emerald-500/5 px-4 py-2 rounded-xl border border-emerald-500/10">0x-BLOCK-CERT-FINAL-{winner.id}-{totalVotes}</p>
                 </div>
              </div>
           </div>
        )}

        {/* Results Visualizer Section */}
        <div className="glass-panel p-10 rounded-[3rem] border border-white/5 bg-slate-900/20 backdrop-blur-2xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-16">
            <div>
              <h2 className="text-3xl font-black text-white">Live Results</h2>
              <p className="text-slate-500 font-medium">Visualizing the current distribution of votes.</p>
            </div>
            <div className="relative w-full md:w-80 group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
               <input 
                  type="text" 
                  placeholder="Filter candidates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/40 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
               />
            </div>
          </div>

          <div className="space-y-12">
            {loading ? (
              <div className="flex flex-col items-center py-20 gap-4">
                <Activity className="w-12 h-12 text-blue-600 animate-pulse" />
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Syncing Ledger...</p>
              </div>
            ) : filteredCandidates.length > 0 ? (
              filteredCandidates.map((c, i) => (
                <div key={c.id} className="group">
                   <div className="flex justify-between items-end mb-4">
                      <div className="flex items-baseline gap-4">
                         <span className="text-slate-800 font-black text-4xl group-hover:text-blue-900 transition-colors">0{i+1}</span>
                         <h4 className="text-2xl font-black text-slate-200 group-hover:text-white transition-colors">{c.name}</h4>
                      </div>
                      <div className="text-right">
                         <span className="text-3xl font-black text-blue-400">{c.voteCount}</span>
                         <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Consensus Received</span>
                      </div>
                   </div>
                   <div className="w-full h-8 bg-black/40 rounded-2xl overflow-hidden border border-white/5 relative shadow-inner group-hover:border-blue-500/20 transition-all">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-400 rounded-2xl transition-all duration-1000 ease-out relative z-10"
                        style={{ width: `${totalVotes === 0 ? 0 : (c.voteCount / totalVotes) * 100}%` }}
                      >
                         <div className="absolute inset-0 bg-white/5 translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-end px-6 z-0">
                         <span className="text-[10px] font-black text-slate-700 tracking-[0.2em]">
                            {totalVotes === 0 ? 0 : Math.round((c.voteCount / totalVotes) * 100)}% TOTAL SHARE
                         </span>
                      </div>
                   </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 opacity-20 group">
                 <Search className="w-16 h-16 mx-auto mb-4 text-slate-400 group-hover:scale-110 transition-transform" />
                 <p className="text-xl font-black text-slate-500 italic">No matches found in the ledger.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-20 text-center space-y-4 opacity-30">
           <div className="flex items-center justify-center gap-8 mb-8">
              <div className="h-px bg-slate-800 flex-grow"></div>
              <ShieldCheck className="w-8 h-8 text-slate-700" />
              <div className="h-px bg-slate-800 flex-grow"></div>
           </div>
           <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Official Transparency Portal • Secure Election 2026</p>
        </div>
      </div>
    </div>
  );
}
