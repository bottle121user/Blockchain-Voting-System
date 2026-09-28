'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  Fingerprint, 
  BarChart3, 
  Globe, 
  Lock, 
  CheckCircle2, 
  Activity,
  ArrowRight,
  ChevronRight,
  Zap,
  ShieldCheck,
  History
} from 'lucide-react';
import api from '../lib/api';

export default function LandingPage() {
  const router = useRouter();
  const [electionState, setElectionState] = useState(0); // 0: NotStarted, 1: InProgress, 2: Ended
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await api.get('/election/state');
        setElectionState(res.data.state);
      } catch (err) {
        console.error("Failed to fetch election state:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchState();
  }, []);

  const getStateDetails = () => {
    switch(electionState) {
      case 1:
        return { label: 'Election Live', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      case 2:
        return { label: 'Tallying Ended', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      default:
        return { label: 'Preparation Phase', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    }
  };

  const status = getStateDetails();

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 overflow-x-hidden w-full">
      {/* Immersive Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[120px] rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
      </div>

      <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center">
        {/* Status Badge */}
        <div className={`mb-8 inline-flex items-center gap-3 px-4 py-2 rounded-full border ${status.border} ${status.bg} backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-700`}>
          <div className={`w-2 h-2 rounded-full ${status.color.replace('text-', 'bg-')} animate-ping`}></div>
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-8 max-w-4xl mb-24">
          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Secure the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">Future</span> of Democracy
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 font-medium tracking-tight leading-relaxed max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
            A transparent voting infrastructure combining Ethereum smart contract immutability with cryptographic nullifiers and real-time event indexing.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 pt-4 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
             <button 
                onClick={() => router.push('/login')}
                className="px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-2xl shadow-blue-900/40 flex items-center gap-3 group transition-all hover:scale-105 active:scale-95"
             >
                Start Voting
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
             </button>
             <button 
                onClick={() => router.push('/results')}
                className="px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black rounded-2xl backdrop-blur-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
             >
                View Live Stats
                <BarChart3 className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-32">
          {/* Voter Card */}
          <div onClick={() => router.push('/login')} className="group p-8 rounded-[2.5rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl hover:border-blue-500/30 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Fingerprint className="w-32 h-32 text-blue-400" />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Fingerprint className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4">Voter Identity</h3>
              <p className="text-slate-400 font-medium leading-relaxed mb-6">Verify your citizenship via Aadhar secured protocol. Your vote remains encrypted and anonymous.</p>
              <div className="flex items-center text-blue-400 font-black text-sm gap-2">
                ENTER PORTAL <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Admin Card */}
          <div onClick={() => router.push('/admin/login')} className="group p-8 rounded-[2.5rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl hover:border-emerald-500/30 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Shield className="w-32 h-32 text-emerald-400" />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4">Admin Terminal</h3>
              <p className="text-slate-400 font-medium leading-relaxed mb-6">Manage candidates, register voters, and oversee the election lifecycle with administrative clearance.</p>
              <div className="flex items-center text-emerald-400 font-black text-sm gap-2">
                SYSTEM ACCESS <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Transparency Card */}
          <div onClick={() => router.push('/audit')} className="group p-8 rounded-[2.5rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl hover:border-indigo-500/30 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Globe className="w-32 h-32 text-indigo-400" />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Globe className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4">Public Audit Ledger</h3>
              <p className="text-slate-400 font-medium leading-relaxed mb-6">Inspect live on-chain event streams and verify individual ballot inclusion on the Ethereum virtual machine.</p>
              <div className="flex items-center text-indigo-400 font-black text-sm gap-2">
                OPEN PUBLIC AUDIT <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Trust/Tech Section */}
        <div className="w-full pt-16 border-t border-white/5">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-blue-400">
                    <Zap className="w-5 h-5 fill-blue-400/20" />
                    <span className="font-black text-sm uppercase tracking-widest">Efficiency</span>
                 </div>
                 <p className="text-slate-500 text-sm font-medium">Sub-second transaction finality on high-performance nodes.</p>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-5 h-5 fill-emerald-400/20" />
                    <span className="font-black text-sm uppercase tracking-widest">Integrity</span>
                 </div>
                 <p className="text-slate-500 text-sm font-medium">Cryptographic nullifiers strictly enforce single-vote rules on-chain.</p>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-indigo-400">
                    <History className="w-5 h-5 fill-indigo-400/20" />
                    <span className="font-black text-sm uppercase tracking-widest">Auditable</span>
                 </div>
                 <p className="text-slate-500 text-sm font-medium">Every vote is cast as a non-fungible event on the public ledger.</p>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-amber-400">
                    <Lock className="w-5 h-5 fill-amber-400/20" />
                    <span className="font-black text-sm uppercase tracking-widest">Immutable</span>
                 </div>
                 <p className="text-slate-500 text-sm font-medium">Distributed consensus prevents any central figure from altering results.</p>
              </div>
           </div>
        </div>

        {/* Footer info */}
        <div className="mt-32 text-center opacity-40">
            <p className="text-slate-500 text-xs font-black uppercase tracking-[0.5em]">2026 Blockchain Voting Initiative • Powered by Ethereum</p>
        </div>
      </main>
    </div>
  );
}
