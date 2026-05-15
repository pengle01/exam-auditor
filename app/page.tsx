'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, XCircle, Loader2, Upload, AlertTriangle, ChevronDown, ChevronUp, Code } from 'lucide-react';

interface AuditResult {
  id?: string;
  image?: string;
  maxPoints: { question: string; points: number }[];
  totalPoints: number;
  awardedPoints: { question: string; points: number }[];
  markerId: string;
  signaturePresent: boolean;
  writtenTotal: number | null;
  writtenGrade20: number | null;
  calculatedSum: number;
  markerIdMissing: boolean;
  writtenTotalAbsent: boolean;
  additionError: boolean;
  exceededPoints: boolean;
  exceededQuestions: { question: string; points: number }[];
  gradeConversion: number;
  conversionAbsent: boolean;
  conversionError: boolean;
  passed: boolean;
}

interface PendingAudit {
  id: string;
  status: 'processing' | 'error';
  error?: string;
}

interface LDAuditResult {
  id?: string;
  image?: string;
  maxPoints: { question: string; points: number }[];
  totalPoints: number;
  awardedPoints: { question: string; points: number }[];
  markerId: string;
  signaturePresent: boolean;
  writtenGrade20: number | null;
  q6Label: string;
  q7Label: string;
  q11Label: string;
  q6SignaturePresent: boolean;
  q7SignaturePresent: boolean;
  q11SignaturePresent: boolean;
  q11CrossedOut: boolean;
  ldCalculatedSum: number;
  ldGrade20: number;
  markerIdMissing: boolean;
  q6SignatureMissing: boolean;
  q7SignatureMissing: boolean;
  q11SignatureMissing: boolean;
  q11NotCrossedOut: boolean;
  conversionAbsent: boolean;
  conversionError: boolean;
  passed: boolean;
}

const fmt20 = (n: number) => {
  const s = n.toFixed(2);
  return n < 10 ? `0${s}` : s;
};

const AuditCard = ({ res }: { res: AuditResult }) => {
  const [showJson, setShowJson] = useState(false);
  const [showImage, setShowImage] = useState(false);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-l-8 p-5 ${res.passed ? 'border-l-green-500' : 'border-l-red-500'} transition-all animate-in fade-in slide-in-from-bottom-2`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-bold text-lg text-slate-800">
            {res.markerIdMissing ? <span className="text-red-500 italic">Marker ID missing</span> : `Marker: ${res.markerId}`}
          </h4>
          <p className="text-sm text-slate-500">Grade: {fmt20(res.gradeConversion)}/20</p>
        </div>
        <div className="flex items-start gap-2">
          {res.image && (
            <button onClick={() => setShowImage(v => !v)} className="shrink-0">
              <img src={res.image} alt="Paper" className="w-9 h-12 object-cover rounded-lg border border-slate-200 shadow-sm" />
            </button>
          )}
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${res.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {res.passed ? 'Pass' : 'Fail'}
          </div>
        </div>
      </div>

      {showImage && res.image && (
        <img src={res.image} alt="Exam paper" className="w-full rounded-xl border border-slate-200 mb-4" />
      )}

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-slate-400 text-xs">Written /{res.totalPoints}</p>
          <p className={`text-xl font-bold ${res.writtenTotalAbsent ? 'text-amber-500' : res.additionError ? 'text-red-600 underline decoration-wavy' : 'text-slate-700'}`}>
            {res.writtenTotalAbsent ? '—' : res.writtenTotal}
          </p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-slate-400 text-xs">Calculated Sum</p>
          <p className="text-xl font-bold text-slate-700">{res.calculatedSum}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-slate-400 text-xs">Written /20</p>
          <p className={`text-xl font-bold ${res.conversionAbsent ? 'text-amber-500' : res.conversionError ? 'text-red-600 underline decoration-wavy' : 'text-slate-700'}`}>
            {res.conversionAbsent ? '—' : fmt20(res.writtenGrade20 as number)}
          </p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-slate-400 text-xs">Expected /20</p>
          <p className="text-xl font-bold text-slate-700">{fmt20(res.gradeConversion)}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {res.markerIdMissing && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> MISSING MARKER ID
          </div>
        )}
        {!res.signaturePresent && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> MISSING SIGNATURE
          </div>
        )}
        {res.writtenTotalAbsent && (
          <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold">
            <AlertTriangle size={14} /> TOTAL /100 ABSENT
          </div>
        )}
        {res.additionError && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> ADDITION ERROR
          </div>
        )}
        {res.exceededPoints && (
          <div className="text-red-600 text-xs font-semibold space-y-1">
            {res.exceededQuestions.map(q => {
              const max = res.maxPoints.find(m => m.question === q.question);
              return (
                <div key={q.question} className="flex items-center gap-2">
                  <XCircle size={14} className="shrink-0" />
                  Q{q.question}: awarded {q.points} &gt; max {max?.points ?? '?'}
                </div>
              );
            })}
          </div>
        )}
        {res.conversionAbsent && (
          <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold">
            <AlertTriangle size={14} /> GRADE /20 ABSENT
          </div>
        )}
        {res.conversionError && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> CONVERSION ERROR
          </div>
        )}
      </div>

      <button
        onClick={() => setShowJson(!showJson)}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 border-t border-slate-50 mt-2 transition-colors"
      >
        <Code size={14} />
        {showJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
        {showJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showJson && (
        <pre className="mt-4 p-3 bg-slate-900 text-green-400 text-[10px] rounded-lg overflow-x-auto font-mono">
          {JSON.stringify(res, null, 2)}
        </pre>
      )}
    </div>
  );
};

const LDAuditCard = ({ res }: { res: LDAuditResult }) => {
  const [showJson, setShowJson] = useState(false);
  const [showImage, setShowImage] = useState(false);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-l-8 p-5 ${res.passed ? 'border-l-green-500' : 'border-l-red-500'} transition-all animate-in fade-in slide-in-from-bottom-2`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-bold text-lg text-slate-800">
            {res.markerIdMissing ? <span className="text-red-500 italic">Marker ID missing</span> : `Marker: ${res.markerId}`}
          </h4>
          <p className="text-sm text-slate-500">LD Grade: {fmt20(res.ldGrade20)}/20</p>
        </div>
        <div className="flex items-start gap-2">
          {res.image && (
            <button onClick={() => setShowImage(v => !v)} className="shrink-0">
              <img src={res.image} alt="Paper" className="w-9 h-12 object-cover rounded-lg border border-slate-200 shadow-sm" />
            </button>
          )}
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${res.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {res.passed ? 'Pass' : 'Fail'}
          </div>
        </div>
      </div>

      {showImage && res.image && (
        <img src={res.image} alt="Exam paper" className="w-full rounded-xl border border-slate-200 mb-4" />
      )}

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-slate-400 text-xs">LD Adjusted Sum</p>
          <p className="text-xl font-bold text-slate-700">{res.ldCalculatedSum.toFixed(2)}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-slate-400 text-xs">Expected /20</p>
          <p className="text-xl font-bold text-slate-700">{fmt20(res.ldGrade20)}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg col-span-2">
          <p className="text-slate-400 text-xs">Written /20</p>
          <p className={`text-xl font-bold ${res.conversionAbsent ? 'text-amber-500' : res.conversionError ? 'text-red-600 underline decoration-wavy' : 'text-slate-700'}`}>
            {res.conversionAbsent ? '—' : fmt20(res.writtenGrade20 as number)}
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {res.markerIdMissing && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> MISSING MARKER ID
          </div>
        )}
        {!res.signaturePresent && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> MISSING SIGNATURE
          </div>
        )}
        {res.q6SignatureMissing && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> MISSING SIGNATURE ON {res.q6Label}
          </div>
        )}
        {res.q7SignatureMissing && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> MISSING SIGNATURE ON {res.q7Label}
          </div>
        )}
        {res.q11SignatureMissing && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> MISSING SIGNATURE ON {res.q11Label}
          </div>
        )}
        {res.q11NotCrossedOut && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> {res.q11Label} NOT CROSSED OUT
          </div>
        )}
        {res.conversionAbsent && (
          <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold">
            <AlertTriangle size={14} /> GRADE /20 ABSENT
          </div>
        )}
        {res.conversionError && (
          <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
            <XCircle size={14} /> CONVERSION ERROR
          </div>
        )}
      </div>

      <button
        onClick={() => setShowJson(!showJson)}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 border-t border-slate-50 mt-2 transition-colors"
      >
        <Code size={14} />
        {showJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
        {showJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showJson && (
        <pre className="mt-4 p-3 bg-slate-900 text-green-400 text-[10px] rounded-lg overflow-x-auto font-mono">
          {JSON.stringify(res, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default function ExamAuditor() {
  const [templateImage, setTemplateImage] = useState<string | null>(null);
  const [maxPoints, setMaxPoints] = useState<{ question: string; points: number }[] | null>(null);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [templateProcessing, setTemplateProcessing] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);
  const [pendingAudits, setPendingAudits] = useState<PendingAudit[]>([]);
  const [ldResults, setLdResults] = useState<LDAuditResult[]>([]);
  const [ldPendingAudits, setLdPendingAudits] = useState<PendingAudit[]>([]);
  const [phase, setPhase] = useState<'setup' | 'audit'>('setup');
  const [activeTab, setActiveTab] = useState<'standard' | 'ld'>('standard');

  const templateInputRef = useRef<HTMLInputElement>(null);
  const testInputRef = useRef<HTMLInputElement>(null);

  const [isSecure, setIsSecure] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecure(window.isSecureContext);
    }
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      const res = await fetch('/api/audit');
      if (res.ok) setConnectionStatus('ok');
      else setConnectionStatus('fail');
    } catch (e) {
      setConnectionStatus('fail');
      console.error(e);
    }
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
    });
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>, type: 'template' | 'test') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (type === 'template') {
      setTemplateProcessing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          const compressed = await compressImage(base64String);

          const response = await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateImage: compressed }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Template extraction failed');
          }

          const data = await response.json();
          setMaxPoints(data.maxPoints);
          setTotalPoints(data.totalPoints);
          setTemplateImage(compressed);
          setPhase('audit');
        } catch (err) {
          alert('Error processing template: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
          setTemplateProcessing(false);
        }
      };
      reader.readAsDataURL(files[0]);
    } else {
      files.forEach(file => {
        const auditId = crypto.randomUUID();
        const currentTab = activeTab;

        if (currentTab === 'ld') {
          setLdPendingAudits(prev => [{ id: auditId, status: 'processing' }, ...prev]);
        } else {
          setPendingAudits(prev => [{ id: auditId, status: 'processing' }, ...prev]);
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64String = reader.result as string;
            const compressed = await compressImage(base64String);
            if (currentTab === 'ld') {
              await performLDAudit(compressed, auditId);
            } else {
              await performAudit(compressed, auditId);
            }
          } catch {
            if (currentTab === 'ld') {
              setLdPendingAudits(prev => prev.map(p => p.id === auditId ? { ...p, status: 'error', error: 'Compression failed' } : p));
            } else {
              setPendingAudits(prev => prev.map(p => p.id === auditId ? { ...p, status: 'error', error: 'Compression failed' } : p));
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  const performAudit = async (testImage: string, auditId: string) => {
    if (!maxPoints || totalPoints == null) return;

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testImage, maxPoints, totalPoints }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Audit failed');
      }

      const data: AuditResult = await response.json();
      setResults((prev) => [{ ...data, id: auditId, image: testImage }, ...prev]);
      setPendingAudits(prev => prev.filter(p => p.id !== auditId));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Audit error:', error);
      setPendingAudits(prev => prev.map(p => p.id === auditId ? { ...p, status: 'error', error: message } : p));
    }
  };

  const performLDAudit = async (testImage: string, auditId: string) => {
    if (!maxPoints || totalPoints == null) return;

    try {
      const response = await fetch('/api/ld-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ldTestImage: testImage, maxPoints, totalPoints }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'LD Audit failed');
      }

      const data: LDAuditResult = await response.json();
      setLdResults(prev => [{ ...data, id: auditId, image: testImage }, ...prev]);
      setLdPendingAudits(prev => prev.filter(p => p.id !== auditId));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('LD Audit error:', error);
      setLdPendingAudits(prev => prev.map(p => p.id === auditId ? { ...p, status: 'error', error: message } : p));
    }
  };

  const resetTemplate = () => {
    setTemplateImage(null);
    setMaxPoints(null);
    setTotalPoints(null);
    setPhase('setup');
    setResults([]);
    setPendingAudits([]);
    setLdResults([]);
    setLdPendingAudits([]);
    setActiveTab('standard');
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-md mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Exam Auditor</h1>
          <p className="text-slate-500">Fast, mobile-first marker verification</p>
        </header>

        {!isSecure && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0" size={20} />
              <div className="text-xs text-amber-800">
                <p className="font-bold">Insecure Context Detected</p>
                <p>Camera capture requires <b>HTTPS</b> or <b>localhost</b>. Use a tunnel (e.g., ngrok) to enable camera access on your mobile device.</p>
              </div>
            </div>
            <button
              onClick={testConnection}
              className="w-full py-2 text-xs font-bold rounded-lg border border-amber-300 bg-white text-amber-700 active:bg-amber-100 flex items-center justify-center gap-2"
            >
              {connectionStatus === 'testing' ? <Loader2 className="animate-spin" size={14} /> : null}
              {connectionStatus === 'idle' && 'Test Connection to Server'}
              {connectionStatus === 'ok' && '✅ Connection OK'}
              {connectionStatus === 'fail' && '❌ Connection Failed'}
            </button>
          </div>
        )}

        {phase === 'setup' ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center space-y-6">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Upload size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Setup Phase</h2>
              <p className="text-slate-500 text-sm">Capture the blank template or reference key to set maximum points.</p>
            </div>
            <div className="relative">
              <button
                onClick={() => templateInputRef.current?.click()}
                disabled={templateProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {templateProcessing ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                {templateProcessing ? 'Processing...' : 'Capture Template'}
              </button>
              <input
                type="file"
                ref={templateInputRef}
                onChange={(e) => handleImageCapture(e, 'template')}
                accept="image/*"
                capture="environment"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={templateProcessing}
                title="Capture Template"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-4 flex items-center justify-between border border-slate-100">
              <div className="flex items-center gap-3">
                {templateImage ? (
                  <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden relative bg-slate-100">
                    <img src={templateImage} alt="Template" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                    <CheckCircle size={20} />
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-tight">Active Template</p>
                  <p className="text-sm font-bold text-blue-600 cursor-pointer hover:underline" onClick={resetTemplate}>Change Template</p>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => testInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all active:scale-90"
                >
                  <Camera size={24} />
                </button>
                <input
                  type="file"
                  ref={testInputRef}
                  onChange={(e) => handleImageCapture(e, 'test')}
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Capture Test"
                />
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('standard')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'standard' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setActiveTab('ld')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'ld' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
                }`}
              >
                Μαθ. Δυσκολίες
              </button>
            </div>

            {activeTab === 'standard' ? (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center justify-between">
                  Recent Audits
                  <span className="text-xs font-normal text-slate-400">{results.length} total</span>
                </h3>

                {pendingAudits.length > 0 && (
                  <div className="space-y-3">
                    {pendingAudits.map(pending => (
                      <div
                        key={pending.id}
                        className={`bg-white rounded-xl border p-4 flex items-center justify-between ${
                          pending.status === 'processing' ? 'border-blue-100 animate-pulse' : 'border-red-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {pending.status === 'processing'
                            ? <Loader2 className="animate-spin text-blue-500" size={20} />
                            : <XCircle className="text-red-500 shrink-0" size={20} />
                          }
                          <span className="text-sm font-medium text-slate-600">
                            {pending.status === 'processing' ? 'Auditing student paper...' : (pending.error ?? 'Error processing')}
                          </span>
                        </div>
                        {pending.status === 'error' && (
                          <button
                            onClick={() => setPendingAudits(prev => prev.filter(p => p.id !== pending.id))}
                            className="text-xs text-red-500 font-bold uppercase shrink-0 ml-2"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {results.length === 0 && pendingAudits.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400">No audits yet. Capture a test to begin!</p>
                  </div>
                )}

                <div className="space-y-4">
                  {results.map((res) => (
                    <AuditCard key={res.id} res={res} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center justify-between">
                  LD Audits
                  <span className="text-xs font-normal text-slate-400">{ldResults.length} total</span>
                </h3>

                {ldPendingAudits.length > 0 && (
                  <div className="space-y-3">
                    {ldPendingAudits.map(pending => (
                      <div
                        key={pending.id}
                        className={`bg-white rounded-xl border p-4 flex items-center justify-between ${
                          pending.status === 'processing' ? 'border-blue-100 animate-pulse' : 'border-red-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {pending.status === 'processing'
                            ? <Loader2 className="animate-spin text-blue-500" size={20} />
                            : <XCircle className="text-red-500 shrink-0" size={20} />
                          }
                          <span className="text-sm font-medium text-slate-600">
                            {pending.status === 'processing' ? 'Auditing LD paper...' : (pending.error ?? 'Error processing')}
                          </span>
                        </div>
                        {pending.status === 'error' && (
                          <button
                            onClick={() => setLdPendingAudits(prev => prev.filter(p => p.id !== pending.id))}
                            className="text-xs text-red-500 font-bold uppercase shrink-0 ml-2"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {ldResults.length === 0 && ldPendingAudits.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400">No LD audits yet. Capture a paper to begin!</p>
                  </div>
                )}

                <div className="space-y-4">
                  {ldResults.map((res) => (
                    <LDAuditCard key={res.id} res={res} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
