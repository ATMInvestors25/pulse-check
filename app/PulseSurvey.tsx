"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Heart, ChevronRight, ChevronLeft, Check, Lock, Download, Eye, EyeOff, Trash2, ArrowLeft, User, TrendingUp, TrendingDown, AlertTriangle, Users, Activity, Target, Sparkles, FileJson, FileSpreadsheet, Calendar, MessageSquare, Minus, RefreshCw, AlertCircle, X } from 'lucide-react';

// ====== SUPABASE CONFIG ======
const SUPABASE_URL = 'https://lsrpjxnmasdnuepwdher.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3F53NrwMUxshvlFaQ2yVvg_KJgBRY23';
const TABLE = 'atm_pulse_responses';

// ====== ADMIN PASSCODE ======
const ADMIN_PASSCODE = 'SHANKS2026';
// ============================

const RATING_QUESTIONS = [
  { id: 'happiness', dim: 'Engagement', text: 'How happy are you in your current role?', subtext: 'Think about your day-to-day experience.' },
  { id: 'vision_clarity', dim: 'Clarity', text: 'How clear are you on the company vision?', subtext: 'Do you understand where this is headed and why?' },
  { id: 'support', dim: 'Enablement', text: 'How supported do you feel in your role?', subtext: 'Resources, guidance, tools, backup — all of it.' },
  { id: 'valued', dim: 'Recognition', text: 'Do you feel valued and recognized for the work you do?', subtext: 'Your contributions being seen and appreciated.' },
  { id: 'future_confidence', dim: 'Conviction', text: 'How confident are you in where the future of the company is heading?', subtext: 'Your gut feeling about where we are going.' },
  { id: 'receptiveness', dim: 'Voice', text: 'How receptive do you feel management is to ideas you share?', subtext: 'When you bring something up, does it land?' }
];

const OPEN_QUESTIONS = [
  { id: 'improvement', text: 'What are areas you would like to see improvement or growth in?', placeholder: 'Company, team, role — anything on your mind...' },
  { id: 'professional_growth', text: 'Where do you see yourself growing professionally?', placeholder: 'Skills, responsibilities, areas of expertise you want to develop...' },
  { id: 'happiness_detail', text: 'Dig a little deeper — how happy are you in your current role, and why?', placeholder: 'What is working? What is not?' },
  { id: 'drives_you', text: 'What drives you?', placeholder: 'What motivates you at your core...' },
  { id: 'company_interest', text: 'What interests you most about this company?', placeholder: 'What drew you here and what keeps you engaged...' },
  { id: 'role_growth', text: 'Where could you see your role growing over time?', placeholder: 'How would you like to see your responsibilities or scope evolve...' }
];

const scaleToSegment = (val: number | null | undefined) => {
  if (val === null || val === undefined) return null;
  if (val >= 9) return 'promoter';
  if (val >= 7) return 'passive';
  return 'detractor';
};

const SEGMENT_META: Record<string, any> = {
  promoter: { label: 'Promoter', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  passive: { label: 'Passive', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  detractor: { label: 'Detractor', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' }
};

const DRAFT_KEY = 'atm-survey-draft-v3';

const sb = {
  async insert(row: any) {
    const res = await fetch(\`\${SUPABASE_URL}/rest/v1/\${TABLE}\`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': \`Bearer \${SUPABASE_KEY}\`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(\`Insert failed (\${res.status}): \${text}\`);
    }
    return res.json();
  },
  async selectAll() {
    const res = await fetch(\`\${SUPABASE_URL}/rest/v1/\${TABLE}?select=*&order=submitted_at.desc\`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': \`Bearer \${SUPABASE_KEY}\` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(\`Select failed (\${res.status}): \${text}\`);
    }
    return res.json();
  },
  async delete(id: string) {
    const res = await fetch(\`\${SUPABASE_URL}/rest/v1/\${TABLE}?id=eq.\${id}\`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': \`Bearer \${SUPABASE_KEY}\` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(\`Delete failed (\${res.status}): \${text}\`);
    }
    return true;
  }
};

const mean = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
const variance = (arr: number[]) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return mean(arr.map(v => (v - m) ** 2));
};
const stdev = (arr: number[]) => Math.sqrt(variance(arr));
const computeNPS = (vals: number[]) => {
  const valid = vals.filter(v => v !== null && v !== undefined);
  if (!valid.length) return null;
  const promoters = valid.filter(v => v >= 9).length;
  const detractors = valid.filter(v => v <= 6).length;
  return Math.round(((promoters - detractors) / valid.length) * 100);
};

const adaptRow = (r: any) => ({
  id: r.id,
  firstName: r.first_name,
  nameKey: r.name_key,
  startedAt: r.started_at,
  submittedAt: r.submitted_at,
  durationSec: r.duration_sec,
  responses: r.responses || {},
  ratingComments: r.rating_comments || {}
});

function Toast({ kind, message, onClose }: any) {
  useEffect(() => {
    if (kind === 'success') {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [kind, onClose]);
  const colors = kind === 'error'
    ? 'bg-rose-50 border-rose-300 text-rose-800'
    : 'bg-emerald-50 border-emerald-300 text-emerald-800';
  const Icon = kind === 'error' ? AlertCircle : Check;
  return (
    <div className={\`fixed top-4 right-4 z-50 \${colors} border rounded-xl shadow-lg p-4 max-w-md flex items-start gap-3\`}>
      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <p className="text-sm flex-1 leading-snug">{message}</p>
      <button onClick={onClose} className="flex-shrink-0 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-lg font-serif text-stone-800 mb-2">{title}</h3>
        <p className="text-stone-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-medium">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function PulseSurvey() {
  const [mode, setMode] = useState('welcome');
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [ratingComments, setRatingComments] = useState<Record<string, string>>({});
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [allResponses, setAllResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [adminView, setAdminView] = useState('dashboard');
  const [selectedResponse, setSelectedResponse] = useState<any>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showPass, setShowPass] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.responses) setResponses(parsed.responses);
        if (parsed.ratingComments) setRatingComments(parsed.ratingComments);
        if (parsed.firstName) setFirstName(parsed.firstName);
        if (parsed.startedAt) setStartedAt(parsed.startedAt);
      }
    } catch (e) {}
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ firstName, responses, ratingComments, startedAt }));
    } catch (e) {}
  }, [firstName, responses, ratingComments, startedAt, draftLoaded]);

  function canProceed() {
    if (step === 0 || step === 7 || step === 14) return true;
    if (step >= 1 && step <= 6) return responses[RATING_QUESTIONS[step - 1].id] !== undefined && responses[RATING_QUESTIONS[step - 1].id] !== null;
    return true;
  }

  useEffect(() => {
    if (mode !== 'survey') return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
      if (step >= 1 && step <= 6) {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          updateResponse(RATING_QUESTIONS[step - 1].id, parseInt(e.key));
        } else if (e.key === ')' || (e.shiftKey && e.key === '0')) {
          e.preventDefault();
          updateResponse(RATING_QUESTIONS[step - 1].id, 10);
        }
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (canProceed()) {
          e.preventDefault();
          if (step < 14) setStep(s => s + 1);
        }
      }
      if (e.key === 'ArrowLeft' && step > 0) {
        e.preventDefault();
        setStep(s => Math.max(0, s - 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, step, responses]);

  const updateResponse = (id: string, value: any) => setResponses(prev => ({ ...prev, [id]: value }));
  const updateRatingComment = (id: string, value: string) => setRatingComments(prev => ({ ...prev, [id]: value }));

  const startSurvey = () => setMode('name');

  const proceedFromName = () => {
    if (firstName.trim().length === 0) return;
    if (!startedAt) setStartedAt(new Date().toISOString());
    setMode('survey');
    setStep(0);
  };

  const submitSurvey = async () => {
    setSubmitting(true);
    const completedAt = new Date().toISOString();
    const durationSec = startedAt ? Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000) : null;
    const row = {
      first_name: firstName.trim(),
      name_key: firstName.trim().toLowerCase(),
      started_at: startedAt,
      submitted_at: completedAt,
      duration_sec: durationSec,
      responses,
      rating_comments: ratingComments
    };
    try {
      await sb.insert(row);
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      setMode('complete');
    } catch (e: any) {
      console.error(e);
      setToast({ kind: 'error', message: \`Submission failed: \${e.message}. Please try again or screenshot your answers.\` });
    } finally {
      setSubmitting(false);
    }
  };

  const openAdminLogin = () => {
    setAdminPass('');
    setAdminError('');
    setMode('admin-login');
  };

  const tryAdminLogin = async () => {
    if (adminPass !== ADMIN_PASSCODE) {
      setAdminError('Incorrect passcode.');
      return;
    }
    setAdminError('');
    setMode('admin');
    setAdminView('dashboard');
    await loadResponses();
  };

  const loadResponses = async () => {
    setLoadingResponses(true);
    try {
      const rows = await sb.selectAll();
      setAllResponses(rows.map(adaptRow));
    } catch (e: any) {
      console.error(e);
      setToast({ kind: 'error', message: \`Could not load responses: \${e.message}\` });
      setAllResponses([]);
    } finally {
      setLoadingResponses(false);
    }
  };

  const exportCSV = () => {
    if (!allResponses.length) return;
    const headers = ['Name', 'Submitted At', 'Duration (sec)',
      ...RATING_QUESTIONS.map(q => \`\${q.dim}: Rating\`),
      ...RATING_QUESTIONS.map(q => \`\${q.dim}: Why\`),
      ...OPEN_QUESTIONS.map(q => q.text)];
    const rows = allResponses.map(r => {
      const row: any[] = [r.firstName || '', new Date(r.submittedAt).toLocaleString(), r.durationSec ?? ''];
      RATING_QUESTIONS.forEach(q => row.push(r.responses?.[q.id] ?? ''));
      RATING_QUESTIONS.forEach(q => row.push((r.ratingComments?.[q.id] || '').replace(/"/g, '""')));
      OPEN_QUESTIONS.forEach(q => row.push((r.responses?.[q.id] || '').replace(/"/g, '""')));
      return row.map(c => \`"\${c}"\`).join(',');
    });
    const csv = [headers.map(h => \`"\${h}"\`).join(','), ...rows].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`atm-pulse-\${new Date().toISOString().split('T')[0]}.csv\`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!allResponses.length) return;
    const blob = new Blob([JSON.stringify(allResponses, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`atm-pulse-\${new Date().toISOString().split('T')[0]}.json\`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requestDelete = (id: string) => {
    setConfirmDialog({
      title: 'Delete response?',
      message: 'This permanently removes the submission from the database. Cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await sb.delete(id);
          setAllResponses(prev => prev.filter(r => r.id !== id));
          if (selectedResponse?.id === id) { setSelectedResponse(null); setAdminView('list'); }
          setToast({ kind: 'success', message: 'Response deleted.' });
        } catch (e: any) {
          setToast({ kind: 'error', message: \`Delete failed: \${e.message}\` });
        }
      }
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const analytics = useMemo(() => {
    if (!allResponses.length) return null;
    const dimStats = RATING_QUESTIONS.map(q => {
      const vals = allResponses.map(r => r.responses?.[q.id]).filter((v: any) => typeof v === 'number');
      return {
        ...q,
        mean: vals.length ? mean(vals) : null,
        stdev: vals.length ? stdev(vals) : 0,
        nps: computeNPS(vals),
        n: vals.length,
        values: vals
      };
    });
    const overallVals = allResponses.flatMap(r => RATING_QUESTIONS.map(q => r.responses?.[q.id]).filter((v: any) => typeof v === 'number'));
    const overallMean = overallVals.length ? mean(overallVals) : null;
    const overallNPS = computeNPS(overallVals);
    const scoredDims = dimStats.filter(d => d.mean !== null);
    const constraint = scoredDims.length ? scoredDims.reduce((lo: any, d: any) => d.mean < lo.mean ? d : lo) : null;
    const strongest = scoredDims.length ? scoredDims.reduce((hi: any, d: any) => d.mean > hi.mean ? d : hi) : null;
    const highestVariance = scoredDims.length ? scoredDims.reduce((hv: any, d: any) => d.stdev > hv.stdev ? d : hv) : null;
    const byPerson: Record<string, any[]> = {};
    allResponses.forEach(r => {
      const key = r.nameKey || r.firstName?.toLowerCase() || 'anon';
      if (!byPerson[key]) byPerson[key] = [];
      byPerson[key].push(r);
    });
    Object.keys(byPerson).forEach(k => {
      byPerson[k].sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    });
    const uniquePeople = Object.keys(byPerson).length;
    const trending = Object.entries(byPerson)
      .filter(([_, subs]) => subs.length > 1)
      .map(([key, subs]) => {
        const first = subs[0];
        const latest = subs[subs.length - 1];
        const firstMean = mean(RATING_QUESTIONS.map(q => first.responses?.[q.id]).filter((v: any) => typeof v === 'number'));
        const latestMean = mean(RATING_QUESTIONS.map(q => latest.responses?.[q.id]).filter((v: any) => typeof v === 'number'));
        return { key, name: latest.firstName, delta: latestMean - firstMean, first: firstMean, latest: latestMean, n: subs.length };
      });
    const detractorFlags: any[] = [];
    Object.values(byPerson).forEach(subs => {
      const latest = subs[subs.length - 1];
      RATING_QUESTIONS.forEach(q => {
        const val = latest.responses?.[q.id];
        if (typeof val === 'number' && val <= 6) {
          detractorFlags.push({
            name: latest.firstName,
            dim: q.dim,
            question: q.text,
            value: val,
            comment: latest.ratingComments?.[q.id] || null,
            responseId: latest.id
          });
        }
      });
    });
    return { dimStats, overallMean, overallNPS, constraint, strongest, highestVariance, byPerson, uniquePeople, trending, detractorFlags, totalSubmissions: allResponses.length };
  }, [allResponses]);

  if (mode === 'welcome') {
    const hasDraft = Object.keys(responses).length > 0 || firstName.length > 0;
    return (
      <>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50 to-orange-50 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-3xl shadow-xl p-10 md:p-14">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Heart className="w-8 h-8 text-white" fill="white" />
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif text-stone-800 text-center mb-4 leading-tight">
                A quick team check-in
              </h1>
              <p className="text-lg text-stone-600 text-center leading-relaxed mb-6">
                Short, honest pulse survey about how things are going for you. Your answers go straight to Ashton — no filter.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
                <p className="text-stone-700 leading-relaxed">
                  <strong>6 ratings</strong> (with optional &quot;why&quot; after each) and <strong>6 short reflections</strong>. About 10 minutes. Be as honest as you want — that is the whole point.
                </p>
              </div>
              <button onClick={startSurvey} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-lg">
                {hasDraft ? 'Continue where you left off' : 'Begin'}
                <ChevronRight className="w-5 h-5" />
              </button>
              {hasDraft && (
                <button onClick={() => { setResponses({}); setRatingComments({}); setFirstName(''); setStartedAt(null); }} className="w-full mt-3 text-stone-500 hover:text-stone-700 text-sm py-2">
                  Start over instead
                </button>
              )}
            </div>
            <div className="text-center mt-6">
              <button onClick={openAdminLogin} className="text-stone-400 hover:text-stone-600 text-sm inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> Admin
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (mode === 'name') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50 to-orange-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          <div className="bg-white rounded-3xl shadow-xl p-10 md:p-14">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
                <User className="w-7 h-7 text-amber-700" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif text-stone-800 text-center mb-4 leading-tight">
              First, who is this?
            </h2>
            <p className="text-stone-600 text-center mb-8 leading-relaxed">
              Just your first name so Ashton can track your pulse over time.
            </p>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && proceedFromName()} placeholder="Your first name" className="w-full px-5 py-4 text-lg border border-stone-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-stone-700 mb-6" autoFocus />
            <button onClick={proceedFromName} disabled={firstName.trim().length === 0} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-lg">
              Continue <ChevronRight className="w-5 h-5" />
            </button>
            <button onClick={() => setMode('welcome')} className="w-full mt-3 text-stone-500 hover:text-stone-700 text-sm py-2">Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'admin-login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-amber-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-stone-800 rounded-2xl flex items-center justify-center">
              <Lock className="w-7 h-7 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-serif text-stone-800 text-center mb-2">Admin Access</h2>
          <p className="text-stone-500 text-center mb-6 text-sm">Enter the passcode to view responses.</p>
          <div className="relative mb-4">
            <input type={showPass ? 'text' : 'password'} value={adminPass} onChange={(e) => setAdminPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tryAdminLogin()} className="w-full px-4 py-3 pr-12 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="Passcode" autoFocus />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {adminError && <p className="text-red-600 text-sm mb-4 text-center">{adminError}</p>}
          <button onClick={tryAdminLogin} className="w-full bg-stone-800 hover:bg-stone-900 text-white font-medium py-3 px-6 rounded-xl transition-all">Unlock</button>
          <button onClick={() => setMode('welcome')} className="w-full mt-3 text-stone-500 hover:text-stone-700 text-sm py-2">Back</button>
        </div>
      </div>
    );
  }

  if (mode === 'admin') {
    return (
      <>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <ConfirmDialog open={!!confirmDialog} title={confirmDialog?.title} message={confirmDialog?.message} onConfirm={confirmDialog?.onConfirm} onCancel={() => setConfirmDialog(null)} />
        <AdminShell analytics={analytics} allResponses={allResponses} loading={loadingResponses} adminView={adminView} setAdminView={setAdminView} selectedResponse={selectedResponse} setSelectedResponse={setSelectedResponse} selectedPerson={selectedPerson} setSelectedPerson={setSelectedPerson} compareIds={compareIds} toggleCompare={toggleCompare} exportCSV={exportCSV} exportJSON={exportJSON} deleteResponse={requestDelete} setMode={setMode} refresh={loadResponses} />
      </>
    );
  }

  if (mode === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50 to-orange-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl p-10 md:p-14 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
          </div>
          <h1 className="text-4xl font-serif text-stone-800 mb-4">Thank you, {firstName}</h1>
          <p className="text-lg text-stone-600 leading-relaxed mb-2">Your responses have been sent to Ashton.</p>
          <p className="text-stone-500 leading-relaxed">Seriously — thank you for being honest. This matters.</p>
        </div>
      </div>
    );
  }

  // SURVEY
  const totalSteps = 14;
  const progress = ((step) / totalSteps) * 100;

  const renderStep = () => {
    if (step === 0) {
      return (
        <div className="text-center py-8">
          <div className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-6">Part 1 of 2</div>
          <h2 className="text-3xl md:text-4xl font-serif text-stone-800 mb-4">A few quick ratings, {firstName}</h2>
          <p className="text-lg text-stone-600 leading-relaxed max-w-lg mx-auto mb-4">Rate each one on a 0–10 scale. Trust your gut — first instinct is the most honest.</p>
          <p className="text-sm text-stone-400">Tip: press number keys to rate fast.</p>
        </div>
      );
    }
    if (step >= 1 && step <= 6) {
      const q = RATING_QUESTIONS[step - 1];
      const val = responses[q.id];
      const comment = ratingComments[q.id] || '';
      const segment = scaleToSegment(val);
      return (
        <div className="py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-stone-500">Question {step} of 6</p>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{q.dim}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-serif text-stone-800 mb-3 leading-tight">{q.text}</h2>
          <p className="text-stone-500 mb-8">{q.subtext}</p>
          <div className="grid grid-cols-11 gap-1.5 mb-3">
            {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
              const isSelected = val === n;
              const seg = scaleToSegment(n);
              const segColor = seg === 'promoter' ? 'from-emerald-400 to-emerald-600' : seg === 'passive' ? 'from-amber-400 to-amber-600' : 'from-rose-400 to-rose-600';
              return (
                <button key={n} onClick={() => updateResponse(q.id, n)} className={\`aspect-square rounded-xl flex items-center justify-center text-base md:text-lg font-medium transition-all \${isSelected ? \`bg-gradient-to-br \${segColor} text-white shadow-lg scale-110\` : 'bg-stone-100 hover:bg-stone-200 text-stone-700'}\`}>{n}</button>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-stone-400 px-1 mb-6">
            <span>Not at all</span><span>Absolutely</span>
          </div>
          {val !== undefined && val !== null && segment && (
            <div className={\`rounded-2xl border p-4 mb-4 transition-all \${SEGMENT_META[segment].bg} \${SEGMENT_META[segment].border}\`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={\`w-2 h-2 rounded-full \${SEGMENT_META[segment].dot}\`}></div>
                <span className={\`text-sm font-semibold \${SEGMENT_META[segment].color}\`}>{SEGMENT_META[segment].label}</span>
              </div>
              <label className="block text-sm text-stone-600 mb-2">What&apos;s the story behind that number? <span className="text-stone-400">(optional, but this is where the gold is)</span></label>
              <textarea value={comment} onChange={(e) => updateRatingComment(q.id, e.target.value)} placeholder="A sentence or two about why..." rows={3} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-stone-700 text-sm resize-none" />
            </div>
          )}
        </div>
      );
    }
    if (step === 7) {
      return (
        <div className="text-center py-8">
          <div className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-6">Part 2 of 2</div>
          <h2 className="text-3xl md:text-4xl font-serif text-stone-800 mb-4">Now the real stuff</h2>
          <p className="text-lg text-stone-600 leading-relaxed max-w-lg mx-auto">Six short reflections. Write as much or as little as you want — even a sentence is helpful.</p>
        </div>
      );
    }
    if (step >= 8 && step <= 13) {
      const q = OPEN_QUESTIONS[step - 8];
      return (
        <div className="py-6">
          <p className="text-sm text-stone-500 mb-2">Reflection {step - 7} of 6</p>
          <h2 className="text-2xl md:text-3xl font-serif text-stone-800 mb-6 leading-tight">{q.text}</h2>
          <textarea value={responses[q.id] || ''} onChange={(e) => updateResponse(q.id, e.target.value)} placeholder={q.placeholder} rows={7} className="w-full px-5 py-4 border border-stone-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-stone-700 leading-relaxed" autoFocus />
        </div>
      );
    }
    if (step === 14) {
      return (
        <div className="py-6">
          <h2 className="text-3xl md:text-4xl font-serif text-stone-800 mb-3 text-center">One last look</h2>
          <p className="text-stone-600 text-center mb-8">Review below. Go back to change anything.</p>
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Ratings</h3>
            <div className="bg-stone-50 rounded-2xl p-5 space-y-3">
              {RATING_QUESTIONS.map(q => {
                const val = responses[q.id];
                const seg = scaleToSegment(val);
                return (
                  <div key={q.id} className="py-1.5">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-stone-700 text-sm flex-1"><span className="text-stone-400">{q.dim} · </span>{q.text}</span>
                      {val !== undefined && val !== null && seg ? (
                        <span className={\`font-medium flex-shrink-0 px-2 py-0.5 rounded-full text-xs \${SEGMENT_META[seg].bg} \${SEGMENT_META[seg].color}\`}>{val}/10</span>
                      ) : <em className="text-stone-400 text-sm">skipped</em>}
                    </div>
                    {ratingComments[q.id] && (<p className="text-xs text-stone-500 mt-1 pl-3 border-l-2 border-stone-200 italic">{ratingComments[q.id]}</p>)}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Reflections</h3>
            <div className="space-y-3">
              {OPEN_QUESTIONS.map(q => (
                <div key={q.id} className="bg-stone-50 rounded-2xl p-5">
                  <p className="text-stone-700 font-medium mb-2 text-sm">{q.text}</p>
                  <p className="text-stone-600 whitespace-pre-wrap text-sm">{responses[q.id] || <em className="text-stone-400">No answer</em>}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50 to-orange-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-500" style={{ width: \`\${progress}%\` }} />
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 min-h-[480px] flex flex-col">
            <div className="flex-1">{renderStep()}</div>
            <div className="flex justify-between items-center pt-8 mt-6 border-t border-stone-100">
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="text-stone-500 hover:text-stone-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-medium">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              {step < totalSteps ? (
                <button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  {step === 0 || step === 7 ? 'Begin' : 'Next'} <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={submitSurvey} disabled={submitting} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 text-white font-medium py-3 px-8 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  {submitting ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Submitting...</>) : (<><Check className="w-4 h-4" /> Submit</>)}
                </button>
              )}
            </div>
          </div>
          <p className="text-center text-stone-400 text-xs mt-6">Auto-saved locally. Arrow keys to navigate. Number keys to rate.</p>
        </div>
      </div>
    </>
  );
}

function AdminShell({ analytics, allResponses, loading, adminView, setAdminView, selectedResponse, setSelectedResponse, selectedPerson, setSelectedPerson, compareIds, toggleCompare, exportCSV, exportJSON, deleteResponse, setMode, refresh }: any) {
  const TabBtn = ({ id, children, icon: Icon }: any) => (
    <button onClick={() => setAdminView(id)} className={\`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 \${adminView === id ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-200'}\`}>
      {Icon && <Icon className="w-4 h-4" />}{children}
    </button>
  );
  return (
    <div className="min-h-screen bg-stone-100">
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-serif text-stone-800">Pulse Intelligence</h1>
            <p className="text-stone-500 text-xs">{allResponses.length} submissions · {analytics?.uniquePeople || 0} {analytics?.uniquePeople === 1 ? 'person' : 'people'}</p>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={refresh} disabled={loading} className="bg-white border border-stone-300 hover:bg-stone-50 disabled:opacity-40 text-stone-700 px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium">
              <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} /> Refresh
            </button>
            <button onClick={exportCSV} disabled={!allResponses.length} className="bg-white border border-stone-300 hover:bg-stone-50 disabled:opacity-40 text-stone-700 px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium">
              <FileSpreadsheet className="w-4 h-4" /> CSV
            </button>
            <button onClick={exportJSON} disabled={!allResponses.length} className="bg-white border border-stone-300 hover:bg-stone-50 disabled:opacity-40 text-stone-700 px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium">
              <FileJson className="w-4 h-4" /> JSON
            </button>
            <button onClick={() => setMode('welcome')} className="bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium">Exit</button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-3 flex gap-1">
          <TabBtn id="dashboard" icon={Activity}>Dashboard</TabBtn>
          <TabBtn id="list" icon={Users}>Responses</TabBtn>
          <TabBtn id="people" icon={User}>People</TabBtn>
          {compareIds.length === 2 && <TabBtn id="compare">Compare ({compareIds.length})</TabBtn>}
        </div>
      </div>
      <div className="max-w-6xl mx-auto p-6">
        {loading && allResponses.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center">
            <RefreshCw className="w-8 h-8 text-stone-400 animate-spin mx-auto mb-4" />
            <p className="text-stone-500">Loading responses from database...</p>
          </div>
        ) : (<>
          {adminView === 'dashboard' && <Dashboard analytics={analytics} allResponses={allResponses} onSelectPerson={(key: string) => { setSelectedPerson(key); setAdminView('person'); }} />}
          {adminView === 'list' && <ResponseList responses={allResponses} onSelect={(r: any) => { setSelectedResponse(r); setAdminView('detail'); }} compareIds={compareIds} toggleCompare={toggleCompare} />}
          {adminView === 'people' && <PeopleView analytics={analytics} onSelectPerson={(key: string) => { setSelectedPerson(key); setAdminView('person'); }} />}
          {adminView === 'detail' && selectedResponse && <ResponseDetail response={selectedResponse} onBack={() => setAdminView('list')} onDelete={deleteResponse} />}
          {adminView === 'person' && selectedPerson && analytics && <PersonView personKey={selectedPerson} submissions={analytics.byPerson[selectedPerson]} onBack={() => setAdminView('people')} onSelectResponse={(r: any) => { setSelectedResponse(r); setAdminView('detail'); }} />}
          {adminView === 'compare' && compareIds.length === 2 && <CompareView responses={allResponses.filter((r: any) => compareIds.includes(r.id))} onBack={() => setAdminView('list')} />}
        </>)}
      </div>
    </div>
  );
}

function Dashboard({ analytics, allResponses, onSelectPerson }: any) {
  if (!analytics || !allResponses.length) {
    return (
      <div className="bg-white rounded-2xl p-16 text-center">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4"><Heart className="w-8 h-8 text-stone-400" /></div>
        <p className="text-stone-500">No responses yet. Share the link with your team.</p>
      </div>
    );
  }
  const { dimStats, overallMean, overallNPS, constraint, strongest, highestVariance, trending, detractorFlags, uniquePeople, totalSubmissions } = analytics;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Team Pulse" value={overallMean !== null ? overallMean.toFixed(1) : '—'} suffix="/ 10" tone={overallMean >= 7 ? 'good' : overallMean >= 5 ? 'neutral' : 'bad'} subtext={\`Avg across \${uniquePeople} \${uniquePeople === 1 ? 'person' : 'people'}\`} />
        <MetricCard label="eNPS" value={overallNPS !== null ? (overallNPS > 0 ? \`+\${overallNPS}\` : \`\${overallNPS}\`) : '—'} tone={overallNPS >= 30 ? 'good' : overallNPS >= 0 ? 'neutral' : 'bad'} subtext={overallNPS >= 30 ? 'Strong' : overallNPS >= 0 ? 'Mixed' : 'At risk'} />
        <MetricCard label="Submissions" value={totalSubmissions} tone="neutral" subtext={trending.length > 0 ? \`\${trending.length} with trend data\` : 'First wave'} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {constraint && <InsightCard icon={Target} color="rose" title="The Constraint" subtitle={constraint.dim} detail={constraint.text} metric={\`\${constraint.mean.toFixed(1)}/10\`} footnote="Lowest-scoring dimension. Fix this first." />}
        {highestVariance && highestVariance.stdev > 1 && <InsightCard icon={AlertTriangle} color="amber" title="Most Divided" subtitle={highestVariance.dim} detail={highestVariance.text} metric={\`σ \${highestVariance.stdev.toFixed(1)}\`} footnote="Highest disagreement. Worth a conversation." />}
        {strongest && <InsightCard icon={Sparkles} color="emerald" title="The Strength" subtitle={strongest.dim} detail={strongest.text} metric={\`\${strongest.mean.toFixed(1)}/10\`} footnote="Your highest score. Protect it." />}
      </div>
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-serif text-xl text-stone-800 mb-1">Dimension Breakdown</h3>
        <p className="text-sm text-stone-500 mb-5">Team average on each, with distribution.</p>
        <div className="space-y-4">{dimStats.map((d: any) => <DimensionRow key={d.id} dim={d} />)}</div>
      </div>
      {detractorFlags.length > 0 && (
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="font-serif text-xl text-stone-800">Signals Worth Reading</h3>
          </div>
          <p className="text-sm text-stone-500 mb-5">Detractor-level ratings (≤6) from latest submissions. The <em>why</em> behind the number.</p>
          <div className="space-y-3">
            {detractorFlags.slice(0, 8).map((f: any, i: number) => (
              <div key={i} className="border border-rose-200 bg-rose-50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-medium text-stone-800">{f.name} · <span className="text-stone-500">{f.dim}</span></p>
                    <p className="text-sm text-stone-600 mt-0.5">{f.question}</p>
                  </div>
                  <span className="text-2xl font-serif text-rose-600 flex-shrink-0">{f.value}/10</span>
                </div>
                {f.comment ? (<p className="text-sm text-stone-700 mt-2 pl-3 border-l-2 border-rose-300 italic">&quot;{f.comment}&quot;</p>) : (<p className="text-xs text-stone-400 italic mt-2">No context provided.</p>)}
              </div>
            ))}
          </div>
        </div>
      )}
      {trending.length > 0 && (
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-stone-600" />
            <h3 className="font-serif text-xl text-stone-800">Trajectories</h3>
          </div>
          <p className="text-sm text-stone-500 mb-5">People with more than one submission. Their story over time.</p>
          <div className="space-y-2">
            {trending.map((t: any) => {
              const arrow = t.delta > 0.3 ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : t.delta < -0.3 ? <TrendingDown className="w-4 h-4 text-rose-600" /> : <Minus className="w-4 h-4 text-stone-400" />;
              return (
                <button key={t.key} onClick={() => onSelectPerson(t.key)} className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-stone-50 border border-stone-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-medium">{t.name.charAt(0).toUpperCase()}</div>
                    <div className="text-left">
                      <p className="font-medium text-stone-800">{t.name}</p>
                      <p className="text-xs text-stone-500">{t.n} submissions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-stone-500">{t.first.toFixed(1)} → {t.latest.toFixed(1)}</p>
                      <p className={\`text-sm font-medium \${t.delta > 0 ? 'text-emerald-600' : t.delta < 0 ? 'text-rose-600' : 'text-stone-500'}\`}>{t.delta > 0 ? '+' : ''}{t.delta.toFixed(1)}</p>
                    </div>
                    {arrow}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, suffix, tone, subtext }: any) {
  const toneClass = tone === 'good' ? 'from-emerald-500 to-emerald-700' : tone === 'bad' ? 'from-rose-500 to-rose-700' : 'from-stone-600 to-stone-800';
  return (
    <div className="bg-white rounded-2xl p-6">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={\`text-4xl font-serif bg-gradient-to-br \${toneClass} bg-clip-text text-transparent\`}>
        {value}{suffix && <span className="text-xl text-stone-400">{suffix}</span>}
      </p>
      <p className="text-sm text-stone-500 mt-1">{subtext}</p>
    </div>
  );
}

function InsightCard({ icon: Icon, color, title, subtitle, detail, metric, footnote }: any) {
  const colors: any = {
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', metric: 'text-rose-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', metric: 'text-amber-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', metric: 'text-emerald-700' }
  };
  const c = colors[color];
  return (
    <div className={\`\${c.bg} \${c.border} border rounded-2xl p-5\`}>
      <div className="flex items-start justify-between mb-3">
        <div className={\`\${c.iconBg} w-10 h-10 rounded-xl flex items-center justify-center\`}>
          <Icon className={\`w-5 h-5 \${c.iconColor}\`} />
        </div>
        <span className={\`text-xl font-serif \${c.metric}\`}>{metric}</span>
      </div>
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{title}</p>
      <p className="text-lg font-medium text-stone-800 mt-1">{subtitle}</p>
      <p className="text-sm text-stone-600 mt-1 leading-snug">{detail}</p>
      <p className="text-xs text-stone-500 mt-3 italic">{footnote}</p>
    </div>
  );
}

function DimensionRow({ dim }: any) {
  const widthPct = dim.mean !== null ? (dim.mean / 10) * 100 : 0;
  const barColor = dim.mean >= 7 ? 'from-emerald-400 to-emerald-600' : dim.mean >= 5 ? 'from-amber-400 to-amber-600' : 'from-rose-400 to-rose-600';
  const promoters = dim.values.filter((v: number) => v >= 9).length;
  const passives = dim.values.filter((v: number) => v >= 7 && v <= 8).length;
  const detractors = dim.values.filter((v: number) => v <= 6).length;
  const total = dim.values.length;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <div>
          <span className="font-medium text-stone-800">{dim.dim}</span>
          <span className="text-stone-500 text-sm ml-2">{dim.text}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {dim.stdev > 1.5 && <span className="text-xs text-amber-600 font-medium">σ {dim.stdev.toFixed(1)}</span>}
          <span className="text-stone-500 text-xs">n={dim.n}</span>
          <span className="text-xl font-serif text-stone-800">{dim.mean !== null ? dim.mean.toFixed(1) : '—'}</span>
        </div>
      </div>
      <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden mb-1.5">
        <div className={\`h-full bg-gradient-to-r \${barColor} rounded-full transition-all\`} style={{ width: \`\${widthPct}%\` }} />
      </div>
      {total > 0 && (
        <div className="flex gap-0.5 h-1.5">
          {detractors > 0 && <div className="bg-rose-400 rounded-full" style={{ width: \`\${(detractors/total)*100}%\` }} />}
          {passives > 0 && <div className="bg-amber-400 rounded-full" style={{ width: \`\${(passives/total)*100}%\` }} />}
          {promoters > 0 && <div className="bg-emerald-400 rounded-full" style={{ width: \`\${(promoters/total)*100}%\` }} />}
        </div>
      )}
    </div>
  );
}

function ResponseList({ responses, onSelect, compareIds, toggleCompare }: any) {
  if (!responses.length) return <div className="bg-white rounded-2xl p-16 text-center text-stone-500">No responses yet.</div>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500 mb-2">Tap checkbox to select up to 2 for side-by-side compare.</p>
      {responses.map((r: any) => {
        const vals = RATING_QUESTIONS.map(q => r.responses?.[q.id]).filter((v: any) => typeof v === 'number');
        const avg = vals.length ? mean(vals) : null;
        const isSelected = compareIds.includes(r.id);
        const toneColor = avg !== null ? (avg >= 7 ? 'text-emerald-600' : avg >= 5 ? 'text-amber-600' : 'text-rose-600') : 'text-stone-400';
        return (
          <div key={r.id} className={\`bg-white border rounded-2xl p-4 flex items-center gap-4 transition-all \${isSelected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-stone-200'}\`}>
            <input type="checkbox" checked={isSelected} onChange={() => toggleCompare(r.id)} className="w-4 h-4 accent-amber-500 cursor-pointer" />
            <button onClick={() => onSelect(r)} className="flex-1 flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-medium">{(r.firstName || '?').charAt(0).toUpperCase()}</div>
                <div>
                  <p className="font-medium text-stone-800">{r.firstName || 'Anonymous'}</p>
                  <p className="text-xs text-stone-500">{new Date(r.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(r.submittedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}{r.durationSec && \` · \${Math.round(r.durationSec / 60)}m\`}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-stone-500 uppercase tracking-wide">Avg</p>
                  <p className={\`text-xl font-serif \${toneColor}\`}>{avg !== null ? avg.toFixed(1) : '—'}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-400" />
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PeopleView({ analytics, onSelectPerson }: any) {
  if (!analytics || analytics.uniquePeople === 0) return <div className="bg-white rounded-2xl p-16 text-center text-stone-500">No people yet.</div>;
  const people = Object.entries(analytics.byPerson).map(([key, subs]: any) => {
    const latest = subs[subs.length - 1];
    const latestVals = RATING_QUESTIONS.map(q => latest.responses?.[q.id]).filter((v: any) => typeof v === 'number');
    return { key, name: latest.firstName, count: subs.length, latest: latestVals.length ? mean(latestVals) : null, latestDate: latest.submittedAt };
  }).sort((a: any, b: any) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
  return (
    <div className="space-y-3">
      {people.map((p: any) => {
        const toneColor = p.latest !== null ? (p.latest >= 7 ? 'text-emerald-600' : p.latest >= 5 ? 'text-amber-600' : 'text-rose-600') : 'text-stone-400';
        return (
          <button key={p.key} onClick={() => onSelectPerson(p.key)} className="w-full bg-white hover:bg-stone-50 border border-stone-200 rounded-2xl p-5 text-left flex items-center justify-between transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-medium text-lg">{p.name.charAt(0).toUpperCase()}</div>
              <div>
                <p className="font-medium text-stone-800 text-lg">{p.name}</p>
                <p className="text-sm text-stone-500">{p.count} submission{p.count !== 1 ? 's' : ''} · last: {new Date(p.latestDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-stone-500 uppercase tracking-wide">Latest</p>
                <p className={\`text-2xl font-serif \${toneColor}\`}>{p.latest !== null ? p.latest.toFixed(1) : '—'}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-400" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PersonView({ personKey, submissions, onBack, onSelectResponse }: any) {
  if (!submissions || submissions.length === 0) return null;
  const name = submissions[submissions.length - 1].firstName;
  const trajectories = RATING_QUESTIONS.map(q => ({ ...q, points: submissions.map((s: any) => ({ date: s.submittedAt, value: s.responses?.[q.id], id: s.id })) }));
  return (
    <div>
      <button onClick={onBack} className="mb-6 text-stone-600 hover:text-stone-900 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to people</button>
      <div className="bg-white rounded-2xl p-8 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-serif text-2xl">{name.charAt(0).toUpperCase()}</div>
          <div>
            <h2 className="text-3xl font-serif text-stone-800">{name}</h2>
            <p className="text-stone-500">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {submissions.length > 1 ? (
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Trajectory by Dimension</h3>
            <div className="space-y-3">{trajectories.map((t: any) => <Trajectory key={t.id} dim={t} />)}</div>
          </div>
        ) : (<p className="text-stone-500 italic">Only one submission yet. Come back after their next check-in to see the trajectory.</p>)}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Submissions</h3>
        <div className="space-y-2">
          {submissions.slice().reverse().map((s: any) => {
            const vals = RATING_QUESTIONS.map(q => s.responses?.[q.id]).filter((v: any) => typeof v === 'number');
            const avg = vals.length ? mean(vals) : null;
            return (
              <button key={s.id} onClick={() => onSelectResponse(s)} className="w-full bg-white hover:bg-stone-50 border border-stone-200 rounded-xl p-4 text-left flex items-center justify-between transition-all">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-stone-400" />
                  <div>
                    <p className="font-medium text-stone-800 text-sm">{new Date(s.submittedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-xs text-stone-500">{new Date(s.submittedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-serif text-stone-800">{avg !== null ? avg.toFixed(1) : '—'}</span>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Trajectory({ dim }: any) {
  const validPoints = dim.points.filter((p: any) => typeof p.value === 'number');
  if (validPoints.length < 2) {
    return (<div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg"><span className="text-sm text-stone-600">{dim.dim}</span><span className="text-sm text-stone-400 italic">Not enough data</span></div>);
  }
  const first = validPoints[0].value;
  const last = validPoints[validPoints.length - 1].value;
  const delta = last - first;
  return (
    <div className="p-3 border border-stone-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-stone-700">{dim.dim}</span>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-stone-500">{first} → {last}</span>
          <span className={\`font-medium \${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-stone-500'}\`}>{delta > 0 ? '+' : ''}{delta}</span>
        </div>
      </div>
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-px bg-stone-200" />
        {validPoints.map((p: any, i: number) => {
          const leftPct = validPoints.length > 1 ? (i / (validPoints.length - 1)) * 100 : 50;
          const topPct = 100 - (p.value / 10) * 100;
          const color = p.value >= 7 ? 'bg-emerald-500' : p.value >= 5 ? 'bg-amber-500' : 'bg-rose-500';
          return <div key={p.id} className={\`absolute w-2.5 h-2.5 \${color} rounded-full border-2 border-white shadow\`} style={{ left: \`\${leftPct}%\`, top: \`\${topPct}%\`, transform: 'translate(-50%, -50%)' }} title={\`\${new Date(p.date).toLocaleDateString()}: \${p.value}\`} />;
        })}
      </div>
    </div>
  );
}

function ResponseDetail({ response, onBack, onDelete }: any) {
  return (
    <div>
      <button onClick={onBack} className="mb-6 text-stone-600 hover:text-stone-900 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
      <div className="bg-white rounded-2xl p-8">
        <div className="flex justify-between items-start mb-6 pb-6 border-b border-stone-200">
          <div>
            <h2 className="text-3xl font-serif text-stone-800">{response.firstName || 'Anonymous'}</h2>
            <p className="text-stone-500 text-sm mt-1">{new Date(response.submittedAt).toLocaleString()}{response.durationSec && \` · Completed in \${Math.round(response.durationSec / 60)}m \${response.durationSec % 60}s\`}</p>
          </div>
          <button onClick={() => onDelete(response.id)} className="text-red-500 hover:text-red-700 p-2" title="Delete"><Trash2 className="w-5 h-5" /></button>
        </div>
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Ratings</h3>
          <div className="space-y-4">
            {RATING_QUESTIONS.map(q => {
              const val = response.responses?.[q.id];
              const comment = response.ratingComments?.[q.id];
              const seg = scaleToSegment(val);
              return (
                <div key={q.id} className="border border-stone-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{q.dim}</span>
                      <p className="text-stone-700 mt-1.5">{q.text}</p>
                    </div>
                    {val !== undefined && val !== null && seg && (
                      <div className={\`px-3 py-1 rounded-full text-sm font-semibold flex-shrink-0 \${SEGMENT_META[seg].bg} \${SEGMENT_META[seg].color}\`}>{val}/10</div>
                    )}
                  </div>
                  {comment && (
                    <div className="mt-3 pl-3 border-l-2 border-stone-300">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-stone-600 italic whitespace-pre-wrap">{comment}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Reflections</h3>
          <div className="space-y-5">
            {OPEN_QUESTIONS.map(q => (
              <div key={q.id}>
                <p className="text-stone-700 font-medium mb-2">{q.text}</p>
                <p className="text-stone-600 whitespace-pre-wrap bg-stone-50 rounded-lg p-4 border border-stone-200">{response.responses?.[q.id] || <em className="text-stone-400">No answer</em>}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareView({ responses, onBack }: any) {
  if (responses.length !== 2) return null;
  const [a, b] = responses;
  return (
    <div>
      <button onClick={onBack} className="mb-6 text-stone-600 hover:text-stone-900 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
      <div className="bg-white rounded-2xl p-8">
        <h2 className="text-2xl font-serif text-stone-800 mb-6">Side-by-side</h2>
        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-stone-200">
          <PersonCol response={a} />
          <PersonCol response={b} />
        </div>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Ratings</h3>
        <div className="space-y-3 mb-8">
          {RATING_QUESTIONS.map(q => {
            const va = a.responses?.[q.id];
            const vb = b.responses?.[q.id];
            const diff = (typeof va === 'number' && typeof vb === 'number') ? va - vb : null;
            return (
              <div key={q.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-2">
                <span className="text-sm text-stone-700"><span className="text-stone-400">{q.dim} · </span>{q.text}</span>
                <span className="text-base font-medium text-stone-800 w-12 text-right">{va ?? '—'}</span>
                <span className="text-base font-medium text-stone-800 w-12 text-right">{vb ?? '—'}</span>
                <span className={\`text-sm font-medium w-12 text-right \${diff !== null && diff > 0 ? 'text-emerald-600' : diff !== null && diff < 0 ? 'text-rose-600' : 'text-stone-400'}\`}>{diff === null ? '—' : diff > 0 ? \`+\${diff}\` : diff}</span>
              </div>
            );
          })}
        </div>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Reflections</h3>
        <div className="space-y-5">
          {OPEN_QUESTIONS.map(q => (
            <div key={q.id}>
              <p className="text-stone-700 font-medium mb-2">{q.text}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-lg p-3 text-sm text-stone-600 whitespace-pre-wrap">{a.responses?.[q.id] || <em className="text-stone-400">No answer</em>}</div>
                <div className="bg-stone-50 rounded-lg p-3 text-sm text-stone-600 whitespace-pre-wrap">{b.responses?.[q.id] || <em className="text-stone-400">No answer</em>}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonCol({ response }: any) {
  const vals = RATING_QUESTIONS.map(q => response.responses?.[q.id]).filter((v: any) => typeof v === 'number');
  const avg = vals.length ? mean(vals) : null;
  return (
    <div>
      <p className="text-xs text-stone-500 uppercase tracking-wide">Respondent</p>
      <p className="font-serif text-xl text-stone-800">{response.firstName}</p>
      <p className="text-xs text-stone-500">{new Date(response.submittedAt).toLocaleDateString()}</p>
      <p className="text-2xl font-serif text-amber-600 mt-2">{avg !== null ? avg.toFixed(1) : '—'}<span className="text-sm text-stone-400">/10</span></p>
    </div>
  );
}
