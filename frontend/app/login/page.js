'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, Lock, ChevronRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../lib/api';

export default function VoterLoginPage() {
  const [aadhar, setAadhar] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/verify', {
        aadhar_number: aadhar,
        otp: otp
      });
      if (res.data.token) {
        localStorage.setItem('voterToken', res.data.token);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden w-full">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full animate-pulse"></div>
        <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-emerald-600/10 blur-[150px] rounded-full animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-xl relative z-10 flex flex-col items-center">
        {/* Brand/Logo Section */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="inline-flex p-5 rounded-[2.5rem] bg-gradient-to-br from-blue-500/10 to-emerald-500/10 border border-white/5 mb-8 shadow-2xl relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
            <ShieldCheck className="w-16 h-16 text-emerald-400 relative z-10 group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h1 className="text-6xl font-black text-white tracking-tighter mb-4 drop-shadow-2xl">
            Voter<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Portal</span>
          </h1>
          <p className="text-slate-400 font-medium text-lg tracking-tight max-w-sm mx-auto leading-relaxed">
            Verify your identity and cast your secure, anonymous ballot.
          </p>
        </div>

        {/* Auth Card */}
        <div className="w-full glass-panel p-1 border border-white/10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-700">
          <div className="bg-[#0f172a]/80 backdrop-blur-3xl p-10 md:p-14 rounded-[2.75rem] space-y-10">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tight">Identity Verification</h2>
              <p className="text-slate-500 text-sm font-medium">Please enter your Digital ID and the verification token sent to you.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-8">
              <div className="space-y-6">
                <div className="relative group">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] absolute -top-2.5 left-6 bg-[#0f172a] px-2 z-20 group-focus-within:text-blue-400 transition-colors">Digital ID Number</label>
                  <Fingerprint className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input 
                    type="text" 
                    value={aadhar}
                    onChange={(e) => setAadhar(e.target.value)}
                    className="w-full bg-black/30 border border-slate-700/50 rounded-2xl pl-16 pr-8 py-5 text-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-slate-700"
                    placeholder="1234 5678 9012"
                    maxLength={12}
                    required
                  />
                </div>

                <div className="relative group">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] absolute -top-2.5 left-6 bg-[#0f172a] px-2 z-20 group-focus-within:text-emerald-400 transition-colors">Verification Token</label>
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input 
                    type="text" 
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-black/30 border border-slate-700/50 rounded-2xl pl-16 pr-8 py-5 text-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all placeholder:text-slate-700"
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl flex items-center gap-4 animate-in shake duration-500">
                  <AlertCircle className="w-6 h-6 flex-shrink-0" />
                  <p className="text-sm font-bold tracking-tight">{error}</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-6 rounded-3xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl shadow-blue-900/40 relative overflow-hidden group disabled:opacity-50"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    Access Ballot Portal
                    <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
               <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Election 2026 • Encrypted Session</p>
               <button 
                onClick={() => router.push('/admin/login')}
                className="flex items-center gap-2 text-blue-500/60 hover:text-blue-400 text-xs font-black uppercase tracking-widest transition-colors group"
               >
                 Go to Admin Portal
                 <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
