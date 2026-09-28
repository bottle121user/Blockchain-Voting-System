'use client';

import { useState, useEffect } from 'react';
import { 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Users, 
  ShieldCheck, 
  ArrowLeft, 
  Loader2, 
  Sparkles,
  HelpCircle,
  Search,
  Scale
} from 'lucide-react';
import Link from 'next/link';
import api from '../../lib/api';

export default function CandidateNominationPage() {
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [loadingElections, setLoadingElections] = useState(true);

  // Form State
  const [fullName, setFullName] = useState('');
  const [party, setParty] = useState('INDEPENDENT');
  const [age, setAge] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [manifesto, setManifesto] = useState('');
  const [seconder1, setSeconder1] = useState('');
  const [seconder2, setSeconder2] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  // Submission Feedback
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Status Lookup Tool
  const [statusIdInput, setStatusIdInput] = useState('');
  const [statusResult, setStatusResult] = useState(null);
  const [searchingStatus, setSearchingStatus] = useState(false);

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    try {
      const res = await api.get('/elections');
      const activeList = (res.data || []).filter(el => el.state === 'CREATED' || el.state === 'REGISTRATION');
      setElections(activeList);
      if (activeList.length > 0) {
        setSelectedElectionId(activeList[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load elections:', err);
    } finally {
      setLoadingElections(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmissionSuccess(null);

    if (!selectedElectionId) {
      setErrorMessage('Please select an active election session.');
      return;
    }
    if (!declarationAccepted) {
      setErrorMessage('You must accept the Code of Conduct and Statutory Declaration.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/elections/${selectedElectionId}/nominate`, {
        full_name: fullName.trim(),
        party_affiliation: party.trim() || 'INDEPENDENT',
        manifesto: manifesto.trim(),
        age: Number(age),
        aadhar_number: nationalId.trim(),
        seconder1_id: seconder1.trim(),
        seconder2_id: seconder2.trim(),
        code_of_conduct_accepted: declarationAccepted
      });

      setSubmissionSuccess({
        fullName,
        electionId: selectedElectionId,
        status: 'PENDING',
        message: res.data.message
      });

      // Reset form
      setFullName('');
      setAge('');
      setNationalId('');
      setManifesto('');
      setSeconder1('');
      setSeconder2('');
      setDeclarationAccepted(false);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.response?.data?.details || 'Failed to submit candidate nomination.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookupStatus = async (e) => {
    e.preventDefault();
    if (!statusIdInput.trim() || !selectedElectionId) return;

    setSearchingStatus(true);
    setStatusResult(null);
    try {
      const res = await api.get(`/elections/${selectedElectionId}/nominations`);
      const list = res.data || [];
      // Note: Backend stores voter_identifier_hash, so we can filter by matching national ID or query all
      const match = list.find(item => item.full_name.toLowerCase().includes(statusIdInput.trim().toLowerCase()));
      setStatusResult(match || { notFound: true });
    } catch (err) {
      console.error('Status lookup error:', err);
    } finally {
      setSearchingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white pt-28 pb-24 px-6 flex flex-col items-center w-full">
      <div className="w-full max-w-4xl space-y-10">

        {/* Navigation Breadcrumb */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest hover:text-blue-300 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Return to Portal
            </Link>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
              Candidate <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">Nomination Portal</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base font-medium max-w-2xl leading-relaxed">
              Official application portal for prospective election candidates. Every application undergoes strict automated statutory validation and election commissioner vetting before being minted to the Ethereum blockchain.
            </p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold">
            <Scale className="w-4 h-4" /> Statutory Vetting Active
          </div>
        </div>

        {/* Statutory Eligibility Checklist Banner */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 bg-slate-900/60 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Mandatory Eligibility Criteria</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300 font-medium">
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/30 border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Age Requirement:</strong> Minimum 18 years of age at nomination date.</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/30 border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Voter Registration:</strong> Must be registered and whitelisted in this election.</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/30 border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Two Seconders:</strong> Must be endorsed by 2 distinct registered voters.</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/30 border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Code of Conduct:</strong> Clean disciplinary declaration & anti-fraud compliance.</span>
            </div>
          </div>
        </div>

        {/* Success Modal / Banner */}
        {submissionSuccess && (
          <div className="glass-panel p-8 rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 shadow-2xl animate-in zoom-in-95 duration-300 space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Nomination Filed Successfully</span>
                <h3 className="text-2xl font-black text-white">{submissionSuccess.fullName}</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Status: <strong className="text-amber-400">PENDING COMMISSIONER REVIEW</strong> • Election Session #{submissionSuccess.electionId}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Your candidacy dossier is pending review by the election commission. Once approved, your candidate record will be permanently minted to the blockchain ledger with zero possibility of removal.
            </p>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-3 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Nomination Form */}
        <form onSubmit={handleSubmit} className="glass-panel p-8 md:p-10 rounded-[2.5rem] border border-white/10 bg-slate-900/40 shadow-2xl space-y-8">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-xl font-black text-white">Candidacy Declaration Form</h2>
            <p className="text-xs text-slate-400 mt-1">Please provide accurate statutory credentials. Discrepancies lead to immediate disqualification.</p>
          </div>

          {/* Section 1: Election Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Select Election Session *</label>
            {loadingElections ? (
              <div className="p-3 text-xs text-slate-500 italic">Scanning active election sessions...</div>
            ) : elections.length > 0 ? (
              <select
                value={selectedElectionId}
                onChange={(e) => setSelectedElectionId(e.target.value)}
                className="w-full p-4 rounded-2xl bg-black/50 border border-white/10 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors"
                required
              >
                {elections.map((el) => (
                  <option key={el.id} value={el.id} className="bg-slate-900 text-white">
                    Election #{el.id}: {el.name} ({el.state})
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                No active election sessions are currently accepting nominations (requires CREATED or REGISTRATION phase).
              </div>
            )}
          </div>

          {/* Section 2: Candidate Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Full Legal Name *</label>
              <input
                type="text"
                placeholder="e.g. Dr. Jane Connor"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-4 rounded-2xl bg-black/50 border border-white/10 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Party / Slogan Affiliation *</label>
              <input
                type="text"
                placeholder="e.g. Civic Progress Union / Independent"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                className="w-full p-4 rounded-2xl bg-black/50 border border-white/10 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Candidate National ID (12 Digits) *</label>
              <input
                type="text"
                placeholder="e.g. 123456789012"
                maxLength={12}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="w-full p-4 rounded-2xl bg-black/50 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
              <p className="text-[10px] text-slate-500">Must be an authorized, registered voter for this election.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Candidate Age *</label>
              <input
                type="number"
                min={18}
                max={120}
                placeholder="e.g. 28"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full p-4 rounded-2xl bg-black/50 border border-white/10 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
              <p className="text-[10px] text-slate-500">Minimum statutory threshold: 18 years.</p>
            </div>
          </div>

          {/* Section 3: Manifesto */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Campaign Manifesto & Platform Vision *</label>
            <textarea
              rows={4}
              placeholder="Outline your primary electoral platform, proposed policies, and commitments to the electorate (minimum 20 characters)..."
              value={manifesto}
              onChange={(e) => setManifesto(e.target.value)}
              className="w-full p-4 rounded-2xl bg-black/50 border border-white/10 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
            <p className="text-[10px] text-slate-500">Characters: {manifesto.length} / 20 minimum</p>
          </div>

          {/* Section 4: Seconders / Endorsements */}
          <div className="p-6 rounded-3xl bg-black/30 border border-white/5 space-y-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <Users className="w-4 h-4" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Registered Voter Seconders (2 Required)</h4>
            </div>
            <p className="text-xs text-slate-400">Two distinct registered citizens must endorse your nomination. Seconders cannot be the candidate themselves.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Seconder #1 National ID *</label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="12-digit ID"
                  value={seconder1}
                  onChange={(e) => setSeconder1(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-black/60 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Seconder #2 National ID *</label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="12-digit ID"
                  value={seconder2}
                  onChange={(e) => setSeconder2(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-black/60 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 5: Code of Conduct Declaration */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
            <input
              type="checkbox"
              id="declaration"
              checked={declarationAccepted}
              onChange={(e) => setDeclarationAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              required
            />
            <label htmlFor="declaration" className="text-xs text-slate-300 leading-relaxed cursor-pointer select-none">
              I solemnly affirm that I satisfy all statutory criteria, have never been disqualified from public office, and pledge to adhere to the transparent, decentralized electoral code of conduct.
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || elections.length === 0}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-blue-900/30 active:scale-95 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Verifying Credentials & Filing...
              </>
            ) : (
              <>
                <Award className="w-5 h-5" /> Submit Official Candidacy Nomination
              </>
            )}
          </button>
        </form>

        {/* Application Status Lookup Widget */}
        <div className="glass-panel p-8 rounded-3xl border border-white/10 bg-slate-900/30 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Check Your Nomination Status</h3>
          </div>
          <form onSubmit={handleLookupStatus} className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="Enter your candidate name to check review status"
              value={statusIdInput}
              onChange={(e) => setStatusIdInput(e.target.value)}
              className="flex-1 p-3.5 rounded-2xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={searchingStatus || !statusIdInput}
              className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-colors shrink-0"
            >
              {searchingStatus ? 'Searching...' : 'Check Status'}
            </button>
          </form>

          {statusResult && (
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 text-xs animate-in fade-in duration-200">
              {statusResult.notFound ? (
                <span className="text-slate-400 italic">No nomination matching that name was found for Election #{selectedElectionId}.</span>
              ) : (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-white">{statusResult.full_name}</h4>
                    <p className="text-slate-400 text-[11px]">Party: {statusResult.party_affiliation} • Age: {statusResult.age}</p>
                    {statusResult.rejection_reason && (
                      <p className="text-rose-400 text-[11px] mt-1 font-mono">Disqualification: {statusResult.rejection_reason}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    statusResult.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    statusResult.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {statusResult.status}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Audit Notice */}
        <div className="pt-4 border-t border-white/5 text-center text-xs text-slate-600 font-mono">
          ChainVote Statutory Candidate Vetting Protocol • Smart Contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3
        </div>

      </div>
    </div>
  );
}
