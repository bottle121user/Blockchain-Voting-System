import './globals.css'
import Link from 'next/link'
import { ShieldAlert, Fingerprint, LayoutDashboard, BarChart3, Home } from 'lucide-react'

export const metadata = {
  title: 'ChainVote | Blockchain Voting System',
  description: 'Secure, transparent, and immutable voting platform powered by blockchain technology.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased flex flex-col">
        {/* Navigation Bar */}
        <nav className="w-full h-20 border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl flex items-center px-6 md:px-12 justify-between fixed top-0 z-[100]">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-black tracking-tighter text-white">
              Chain<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Vote</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2">
              <Home className="w-4 h-4" /> Home
            </Link>
            <Link href="/login" className="text-sm font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2">
              <Fingerprint className="w-4 h-4" /> Voter
            </Link>
            <Link href="/admin/login" className="text-sm font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" /> Admin
            </Link>
            <Link href="/results" className="text-sm font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Results
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest animate-pulse">
              Network Live
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-grow w-full pt-20 flex flex-col items-center overflow-x-hidden">
            {children}
        </main>

      </body>
    </html>
  )
}

