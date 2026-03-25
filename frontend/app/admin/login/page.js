'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import api from '../../../lib/api';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/admin-login', { password });
      localStorage.setItem('adminToken', res.data.token);
      router.push('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full animate-pulse delay-700"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-3xl bg-blue-600/10 border border-blue-500/20 mb-6 group transition-all duration-500 hover:scale-110">
            <Shield className="w-12 h-12 text-blue-500 group-hover:rotate-12 transition-transform" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">System Terminal</h1>
          <p className="text-slate-400 font-medium">Clearance Required for Election Access</p>
        </div>

        <div className="glass-panel p-10 rounded-[40px] shadow-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl">
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-4">
                <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                        type="password"
                        placeholder="Master Access Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black/40 border border-slate-800 rounded-3xl pl-14 pr-6 py-5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                        required
                    />
                </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-bold tracking-tight">{error}</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-3 active:scale-95 group"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (
                <>
                  Identify Admin 
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-10 border-t border-white/5 text-center">
             <button 
                onClick={() => router.push('/')}
                className="text-slate-500 hover:text-slate-300 text-xs font-black uppercase tracking-[0.2em] transition-colors"
             >
                Return to Public Portal
             </button>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-8 opacity-20 grayscale hover:opacity-50 transition-all duration-700">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-700 px-3 py-1 rounded">Blockchain Verified</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-700 px-3 py-1 rounded">Secure Ledger v2.0</div>
        </div>
      </div>
    </div>
  );
}
