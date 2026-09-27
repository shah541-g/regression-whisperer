/* ─────────────────────────────────────────────────────────
   Regression Whisperer — React app (CDN / Babel Standalone)
   No import/export — all globals from CDN scripts.
   ───────────────────────────────────────────────────────── */

/* ── Auth storage keys ── */
const TOKEN_KEY   = 'rev_token';
const COMPANY_KEY = 'rev_company';

function getToken()   { return localStorage.getItem(TOKEN_KEY); }
function getCompany() {
  try { return JSON.parse(localStorage.getItem(COMPANY_KEY)); } catch { return null; }
}
function saveSession(token, company) {
  localStorage.setItem(TOKEN_KEY,   token);
  localStorage.setItem(COMPANY_KEY, JSON.stringify(company));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(COMPANY_KEY);
}

/* ── Module-level 401 callback — set by App on mount ── */
let handleUnauthorised = () => {};

/* ── API helpers ── */
async function apiPost(endpoint, body, isPublic = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (!isPublic) headers['Authorization'] = `Bearer ${getToken()}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401 && !isPublic) {
    clearSession();
    handleUnauthorised('Session expired, please log in again.');
    throw new Error('Unauthorised');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiGet(endpoint) {
  const res = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });

  if (res.status === 401) {
    clearSession();
    handleUnauthorised('Session expired, please log in again.');
    throw new Error('Unauthorised');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ── Chart helpers ── */
const PALETTE = [
  '#8b5cf6','#06b6d4','#10b981','#f59e0b','#f43f5e',
  '#a78bfa','#22d3ee','#34d399','#fbbf24','#fb7185',
];

function buildChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#6b7280', font: { size: 11 } } } },
    ...extra,
  };
}

/* ── Shared renderers ── */
function renderTags(tags) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="tags">
      {tags.map((t, i) => <span key={i} className="tag">{t}</span>)}
    </div>
  );
}

function renderFixSteps(steps) {
  if (!steps || steps.length === 0) return null;
  return (
    <div>
      <div className="card-label">Fix Steps</div>
      <ol className="fix-steps">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

function LessonCard({ lesson, score }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span className="card-title">{lesson.title}</span>
        {score !== undefined && <span className="score-badge">score {score}</span>}
      </div>
      {lesson.errorType && <p className="card-meta">{lesson.errorType}</p>}
      {lesson.rootCause && (
        <div>
          <div className="card-label">Root Cause</div>
          <p>{lesson.rootCause}</p>
        </div>
      )}
      {renderFixSteps(lesson.fixSteps)}
      {renderTags(lesson.tags)}
    </div>
  );
}

/* ── useVoiceInput hook ── */
// onTranscript(base, prefix, transcript) — parent uses this to update its own state.
// The hook never touches the DOM directly; all text lives in parent state.
function useVoiceInput(getCurrentValue, onTranscript) {
  const [isListening, setIsListening] = React.useState(false);
  const [errorMsg,    setErrorMsg]    = React.useState('');
  const interimStartRef = React.useRef(0);

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Speech recognition not supported in this browser.');
      return;
    }

    setErrorMsg('');
    // Capture how many chars exist right now — interim results rebuild from here
    interimStartRef.current = getCurrentValue().length;

    const recognition = new SpeechRecognition();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';

    recognition.addEventListener('result', (event) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
      // Tell the parent exactly what text to set — don't read DOM at all
      onTranscript(interimStartRef.current, transcript);
    });

    recognition.addEventListener('end', () => setIsListening(false));

    recognition.addEventListener('error', (event) => {
      setIsListening(false);
      const MSG = {
        'no-speech':   'No speech detected.',
        'not-allowed': 'Microphone access denied.',
        'network':     'Network error.',
      };
      setErrorMsg(MSG[event.error] || `Recognition error: ${event.error}`);
      setTimeout(() => setErrorMsg(''), 4000);
    });

    setIsListening(true);
    recognition.start();
  }

  return { isListening, errorMsg, startListening };
}

/* ── AnimatedBackground (Three.js particle field) ── */
/* ── AuthScene — lit solid geometry for the login panel ── */
const AuthScene = ({ panelRef }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const panel  = panelRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !panel || !window.THREE) return;

    const W = panel.clientWidth  || 600;
    const H = panel.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.z = 7;

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const light1 = new THREE.PointLight(0x8b5cf6, 2.5, 20);
    light1.position.set(-4, 4, 6);
    scene.add(light1);

    const light2 = new THREE.PointLight(0x06b6d4, 2.0, 20);
    light2.position.set(5, -3, 5);
    scene.add(light2);

    // ── Group that receives parallax ──
    const group = new THREE.Group();
    scene.add(group);

    // ── Solid globe ──
    const sphereGeo = new THREE.SphereGeometry(1.5, 64, 64);
    const sphereMat = new THREE.MeshStandardMaterial({
      color:     0x8b5cf6,
      roughness: 0.35,
      metalness: 0.55,
    });
    const globe = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(globe);

    // ── Wireframe overlay (lat/lon lines) — slightly larger sphere ──
    const wireGeo = new THREE.SphereGeometry(1.53, 18, 12);
    const wireMat = new THREE.MeshBasicMaterial({
      color:       0x06b6d4,
      wireframe:   true,
      transparent: true,
      opacity:     0.18,
    });
    const wireOverlay = new THREE.Mesh(wireGeo, wireMat);
    group.add(wireOverlay);

    // ── Mouse parallax ──
    const mouse  = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    function onMouseMove(e) {
      const rect = panel.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left)  / rect.width  - 0.5) * 2;
      mouse.y = ((e.clientY - rect.top)   / rect.height - 0.5) * 2;
    }
    window.addEventListener('mousemove', onMouseMove);

    let animId;
    let t = 0;
    function animate() {
      animId = requestAnimationFrame(animate);
      t += 0.008;

      // Slow globe rotation
      globe.rotation.y       += 0.004;
      wireOverlay.rotation.y -= 0.002;  // counter-rotate for parallax feel

      // Gentle bob
      group.position.y = Math.sin(t) * 0.14;

      // Parallax
      target.x += (mouse.x - target.x) * 0.04;
      target.y += (mouse.y - target.y) * 0.04;
      group.rotation.y = target.x * 0.18;
      group.rotation.x = -target.y * 0.12;

      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      const nW = panel.clientWidth  || 600;
      const nH = panel.clientHeight || window.innerHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      sphereGeo.dispose();
      sphereMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
};

/* ── DashboardOrb — small rotating accent shape in the dashboard header ── */
const DashboardOrb = () => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !window.THREE) return;

    const SIZE = 120;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(SIZE, SIZE);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
    camera.position.z = 3.2;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pl = new THREE.PointLight(0x8b5cf6, 3, 10);
    pl.position.set(2, 3, 4);
    scene.add(pl);
    const pl2 = new THREE.PointLight(0x06b6d4, 2, 10);
    pl2.position.set(-2, -1, 3);
    scene.add(pl2);

    const geo  = new THREE.IcosahedronGeometry(1, 1);
    const mesh = new THREE.Mesh(geo,
      new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.18, metalness: 0.65 })
    );
    scene.add(mesh);

    let animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      mesh.rotation.y += 0.012;
      mesh.rotation.x += 0.005;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      geo.dispose();
      mesh.material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={120}
      style={{ width: '42px', height: '42px', flexShrink: 0 }}
    />
  );
};

/* ── AuthGate ── */
const AuthGate = ({ onSuccess, sessionMsg }) => {
  const [tab,      setTab]      = React.useState('login');
  const [loading,  setLoading]  = React.useState(false);

  // Login state
  const [loginEmail,    setLoginEmail]    = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [loginError,    setLoginError]    = React.useState(sessionMsg || '');

  // Signup state
  const [signupName,     setSignupName]     = React.useState('');
  const [signupEmail,    setSignupEmail]    = React.useState('');
  const [signupPassword, setSignupPassword] = React.useState('');
  const [signupError,    setSignupError]    = React.useState('');

  // Sync sessionMsg into loginError when it changes
  React.useEffect(() => {
    if (sessionMsg) {
      setTab('login');
      setLoginError(sessionMsg);
    }
  }, [sessionMsg]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!loginEmail || !loginPassword) { setLoginError('Email and password are required.'); return; }
    setLoading(true);
    setLoginError('');
    try {
      const data = await apiPost('/api/auth/login', { email: loginEmail, password: loginPassword }, true);
      saveSession(data.token, data.company);
      onSuccess(data.company);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!signupName || !signupEmail || !signupPassword) { setSignupError('All fields are required.'); return; }
    setLoading(true);
    setSignupError('');
    try {
      const data = await apiPost('/api/auth/signup', { name: signupName, email: signupEmail, password: signupPassword }, true);
      saveSession(data.token, data.company);
      onSuccess(data.company);
    } catch (err) {
      setSignupError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const panelRef = React.useRef(null);

  return (
    <div id="auth-gate">
      {/* LEFT: 3D scene panel */}
      <div className="auth-scene-panel" ref={panelRef}>
        <AuthScene panelRef={panelRef} />
        <div className="auth-scene-overlay">
          <h2 className="auth-scene-title">Regression Whisperer</h2>
          <p className="auth-scene-sub">Capture, distill, and retrieve debug lessons</p>
        </div>
      </div>

      {/* RIGHT: form panel */}
      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={`auth-tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => setTab('login')}
            >Login</button>
            <button
              className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
              onClick={() => setTab('signup')}
            >Sign Up</button>
          </div>

          {tab === 'login' && (
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="auth-field">
                <label>Email</label>
                <input id="login-email" type="email" placeholder="you@company.com" autoComplete="email"
                  value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input id="login-password" type="password" placeholder="••••••••" autoComplete="current-password"
                  value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
              </div>
              <button id="login-submit" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Login'}</button>
              <p className="auth-error">{loginError}</p>
            </form>
          )}

          {tab === 'signup' && (
            <form className="auth-form" onSubmit={handleSignup}>
              <div className="auth-field">
                <label>Company Name</label>
                <input type="text" placeholder="Acme Corp" autoComplete="organization"
                  value={signupName} onChange={e => setSignupName(e.target.value)} />
              </div>
              <div className="auth-field">
                <label>Email</label>
                <input type="email" placeholder="you@company.com" autoComplete="email"
                  value={signupEmail} onChange={e => setSignupEmail(e.target.value)} />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input type="password" placeholder="••••••••" autoComplete="new-password"
                  value={signupPassword} onChange={e => setSignupPassword(e.target.value)} />
              </div>
              <button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Create Account'}</button>
              <p className="auth-error">{signupError}</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── VoiceTextarea ── (textarea + mic button as a unit) ── */
const VoiceTextarea = ({ id, label, rows, placeholder, value, onChange, onVoiceTranscript }) => {
  // getCurrentValue returns the live state value so the hook captures it at click time
  const getCurrentValue = React.useCallback(() => value, [value]);

  const handleTranscript = React.useCallback((interimStart, transcript) => {
    // Rebuild the full string: everything before interimStart + new transcript
    const base   = value.slice(0, interimStart);
    const prefix = base.length > 0 && !base.endsWith(' ') ? ' ' : '';
    onVoiceTranscript(base + prefix + transcript);
  }, [value, onVoiceTranscript]);

  const { isListening, errorMsg, startListening } = useVoiceInput(getCurrentValue, handleTranscript);

  return (
    <div className="textarea-wrap">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ paddingRight: '44px' }}
      />
      <button
        type="button"
        className={`mic-btn${isListening ? ' listening' : ''}`}
        title="Dictate"
        aria-label="Dictate"
        disabled={isListening}
        onClick={startListening}
      >
        {isListening ? '🔴' : '🎤'}
      </button>
      <span className="mic-error">{errorMsg}</span>
    </div>
  );
};

/* ── Language options (shared by SubmitForm and ReportIssue) ── */
const LANGUAGE_OPTIONS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'PHP', 'Go', 'Ruby', 'Other',
];

function LanguageSelect({ value, onChange }) {
  return (
    <div className="field-group">
      <label htmlFor="lang-select">Language</label>
      <select id="lang-select" className="lang-select" value={value} onChange={onChange}>
        {LANGUAGE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
    </div>
  );
}

function parseBulkLessonsCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

/* ── SubmitForm ── */
const SubmitForm = ({ onLessonSubmitted }) => {
  const [stackTrace,   setStackTrace]   = React.useState('');
  const [description,  setDescription]  = React.useState('');
  const [language,     setLanguage]     = React.useState('JavaScript');
  const [loading,      setLoading]      = React.useState(false);
  const [result,       setResult]       = React.useState(null);
  const [errorMsg,     setErrorMsg]     = React.useState('');
  const [bulkRows,     setBulkRows]     = React.useState([]);
  const [bulkSkipped,  setBulkSkipped]  = React.useState(0);
  const [bulkPreviewReady, setBulkPreviewReady] = React.useState(false);
  const [bulkError,    setBulkError]    = React.useState('');
  const [bulkStatus,   setBulkStatus]   = React.useState(null);
  const [bulkSubmitting, setBulkSubmitting] = React.useState(false);

  async function handleSubmit() {
    if (!stackTrace.trim() || !description.trim()) {
      setErrorMsg('Both fields are required.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setResult(null);
    try {
      const lesson = await apiPost('/api/lessons/submit', { stackTrace, description, language });
      setResult(lesson);
      if (onLessonSubmitted) onLessonSubmitted();
    } catch (err) {
      if (err.message !== 'Unauthorised') setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkFileChange(event) {
    const file = event.target.files && event.target.files[0];
    setBulkError('');
    setBulkStatus(null);
    setBulkRows([]);
    setBulkSkipped(0);
    setBulkPreviewReady(false);
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseBulkLessonsCsv(text);
      if (rows.length < 2) {
        setBulkError('The CSV must include a header row and at least one data row.');
        return;
      }

      const headers = rows[0].map(header => header.trim().replace(/^\uFEFF/, ''));
      const stackTraceIndex = headers.indexOf('stackTrace');
      const descriptionIndex = headers.indexOf('description');
      const languageIndex = headers.indexOf('language');
      if (stackTraceIndex === -1 || descriptionIndex === -1 || languageIndex === -1) {
        setBulkError('CSV headers must be: stackTrace,description,language');
        return;
      }

      let skipped = 0;
      const validRows = [];
      rows.slice(1).forEach(row => {
        const lesson = {
          stackTrace: (row[stackTraceIndex] || '').trim(),
          description: (row[descriptionIndex] || '').trim(),
          language: (row[languageIndex] || 'Other').trim() || 'Other',
        };
        if (!lesson.stackTrace || !lesson.description) {
          skipped += 1;
          return;
        }
        validRows.push(lesson);
      });

      setBulkRows(validRows);
      setBulkSkipped(skipped);
      setBulkPreviewReady(true);
    } catch (err) {
      setBulkError(`Could not read CSV: ${err.message}`);
    }
  }

  function downloadBulkTemplate() {
    const fields = ['stackTrace', 'description', 'language'];
    const examples = [
      [
        "TypeError: Cannot read properties of undefined (reading 'name')",
        'Forgot to check if the object existed before accessing its property',
        'JavaScript',
      ],
      [
        'ValueError: invalid literal for int()',
        'Tried to parse a non-numeric string as an integer without validation',
        'Python',
      ],
    ];
    function csvEscape(value) {
      const text = String(value == null ? '' : value);
      return `"${text.replace(/"/g, '""')}"`;
    }

    const csv = [
      fields.join(','),
      ...examples.map(row => row.map(csvEscape).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lesson-upload-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function cancelBulkUpload() {
    setBulkRows([]);
    setBulkSkipped(0);
    setBulkPreviewReady(false);
  }

  async function confirmBulkUpload() {
    if (bulkRows.length === 0 || bulkSubmitting) return;
    setBulkSubmitting(true);
    setBulkStatus({ current: 0, total: bulkRows.length, succeeded: 0, failed: 0, done: false });

    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < bulkRows.length; i += 1) {
      try {
        await apiPost('/api/lessons/submit', bulkRows[i]);
        succeeded += 1;
      } catch (err) {
        failed += 1;
      }
      setBulkStatus({
        current: i + 1,
        total: bulkRows.length,
        succeeded,
        failed,
        done: i + 1 === bulkRows.length,
      });
      if (i < bulkRows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (onLessonSubmitted) onLessonSubmitted();
    setBulkSubmitting(false);
  }

  return (
    <section id="section-submit">
      <h2>Submit a Fix</h2>
      <div className="form-card">
        <VoiceTextarea
          id="submit-stacktrace"
          label="Stack Trace"
          rows={7}
          placeholder="Paste the full stack trace here…"
          value={stackTrace}
          onChange={e => setStackTrace(e.target.value)}
          onVoiceTranscript={setStackTrace}
        />
        <VoiceTextarea
          id="submit-description"
          label="What happened & how you fixed it"
          rows={4}
          placeholder="Describe the root cause and the steps you took to fix it…"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onVoiceTranscript={setDescription}
        />
        <LanguageSelect value={language} onChange={e => setLanguage(e.target.value)} />
        <button id="submit-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Loading…' : 'Distill & Save'}
        </button>
      </div>
      <div className="bulk-upload">
        <label htmlFor="bulk-upload-input">Or bulk upload a CSV</label>
        <div className="bulk-upload-controls">
          <input id="bulk-upload-input" type="file" accept=".csv" onChange={handleBulkFileChange} disabled={bulkSubmitting} />
          <button type="button" className="bulk-template-button" onClick={downloadBulkTemplate}>
            Download CSV Template
          </button>
        </div>
        <p className="bulk-upload-hint">Expected columns: stackTrace, description, language</p>
        {bulkError && <p className="error-msg">⚠ {bulkError}</p>}
        {bulkPreviewReady && !bulkStatus && (
          <div className="bulk-preview">
            <p>Found {bulkRows.length} valid rows, {bulkSkipped} skipped due to missing fields. Submit all {bulkRows.length}?</p>
            <div className="bulk-actions">
              <button type="button" onClick={confirmBulkUpload} disabled={bulkRows.length === 0}>Confirm</button>
              <button type="button" className="bulk-cancel" onClick={cancelBulkUpload}>Cancel</button>
            </div>
          </div>
        )}
        {bulkStatus && (
          <div className="bulk-progress">
            {!bulkStatus.done && <p>Submitting {bulkStatus.current + 1} of {bulkStatus.total}...</p>}
            <div className="bulk-progress-track">
              <div className="bulk-progress-bar" style={{ width: `${(bulkStatus.current / bulkStatus.total) * 100}%` }} />
            </div>
            <p className="bulk-progress-count">
              {bulkStatus.done
                ? <>{'Done — '}<span className="bulk-success-count">{bulkStatus.succeeded} succeeded</span>{', '}<span className="bulk-failure-count">{bulkStatus.failed} failed</span></>
                : <><span className="bulk-success-count">{bulkStatus.succeeded} succeeded</span>{', '}<span className="bulk-failure-count">{bulkStatus.failed} failed</span></>}
            </p>
          </div>
        )}
      </div>
      <div className="result-area">
        {errorMsg && <p className="error-msg">⚠ {errorMsg}</p>}
        {result && <LessonCard lesson={result} />}
      </div>
    </section>
  );
};

/* ── MatchForm ── */
const MatchForm = () => {
  const [stackTrace,  setStackTrace]  = React.useState('');
  const [description, setDescription] = React.useState('');
  const [loading,     setLoading]     = React.useState(false);
  const [matches,     setMatches]     = React.useState(null);
  const [emptyMsg,    setEmptyMsg]    = React.useState('');
  const [errorMsg,    setErrorMsg]    = React.useState('');

  async function handleMatch() {
    if (!stackTrace.trim() || !description.trim()) {
      setErrorMsg('Both fields are required.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setMatches(null);
    setEmptyMsg('');
    try {
      const data = await apiPost('/api/lessons/match', { stackTrace, description });
      if (!data.matches || data.matches.length === 0) {
        setEmptyMsg(data.message || 'No similar past lessons found.');
      } else {
        setMatches(data.matches);
      }
    } catch (err) {
      if (err.message !== 'Unauthorised') setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="section-match">
      <h2>Find a Match</h2>
      <div className="form-card">
        <VoiceTextarea
          id="match-stacktrace"
          label="Stack Trace"
          rows={7}
          placeholder="Paste the stack trace you need help with…"
          value={stackTrace}
          onChange={e => setStackTrace(e.target.value)}
          onVoiceTranscript={setStackTrace}
        />
        <VoiceTextarea
          id="match-description"
          label="Brief description of the error"
          rows={4}
          placeholder="Describe what's going wrong (you don't need a fix yet)…"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onVoiceTranscript={setDescription}
        />
        <button id="match-btn" onClick={handleMatch} disabled={loading}>
          {loading ? 'Loading…' : 'Find Similar Lessons'}
        </button>
      </div>
      <div className="result-area">
        {errorMsg && <p className="error-msg">⚠ {errorMsg}</p>}
        {emptyMsg && <p className="empty-msg">{emptyMsg}</p>}
        {matches && matches.map(({ lesson, score }, i) => (
          <LessonCard key={i} lesson={lesson} score={score} />
        ))}
      </div>
    </section>
  );
};

/* ── Lesson detail modal ── */
const LessonModal = ({ lesson, onClose }) => {
  React.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!lesson) return null;

  return (
    <div className="modal-backdrop" onClick={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="modal-card">
        <button className="modal-close" onClick={onClose} aria-label="Close lesson details">×</button>
        <h2>{lesson.title}</h2>
        {lesson.errorType && <p className="card-meta">{lesson.errorType}</p>}
        {lesson.rootCause && (
          <div>
            <div className="card-label">Root Cause</div>
            <p>{lesson.rootCause}</p>
          </div>
        )}
        {lesson.fixSteps && lesson.fixSteps.length > 0 && (
          <div>
            <div className="card-label">Fix Steps</div>
            <ol className="fix-steps">
              {lesson.fixSteps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </div>
        )}
        {renderTags(lesson.tags)}
        {lesson.createdAt && (
          <p className="card-meta">Created {new Date(lesson.createdAt).toLocaleDateString()}</p>
        )}
        <p className="card-meta">Matched {lesson.timesMatched}×</p>
      </div>
    </div>
  );
};

/* ── LessonLibrary ── */
const LessonLibrary = ({ refreshKey, onLessonsLoaded }) => {
  const [lessons,  setLessons]  = React.useState(null);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [query,    setQuery]    = React.useState('');
  const [selectedLesson, setSelectedLesson] = React.useState(null);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await apiGet('/api/lessons');
        const list = data.lessons || [];
        setLessons(list);
        if (onLessonsLoaded) onLessonsLoaded(list);
      } catch (err) {
        if (err.message !== 'Unauthorised') setErrorMsg(`Failed to load library: ${err.message}`);
      }
    }
    load();
  }, [refreshKey]);

  const filtered = React.useMemo(() => {
    if (!lessons) return null;
    const q = query.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter(l =>
      l.title.toLowerCase().includes(q) ||
      (l.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [lessons, query]);

  return (
    <section id="section-library">
      <h2>Lesson Library</h2>
      <input
        className="library-search"
        type="text"
        placeholder="Search lessons by title or tag…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="library-list">
        {errorMsg && <p className="error-msg">⚠ {errorMsg}</p>}
        {!errorMsg && filtered === null && <span className="empty-msg">Loading lessons…</span>}
        {!errorMsg && filtered && lessons.length === 0 && <span className="empty-msg">No lessons saved yet.</span>}
        {!errorMsg && filtered && lessons.length > 0 && filtered.length === 0 && (
          <span className="empty-msg">No lessons match your search.</span>
        )}
        {filtered && filtered.map((lesson, i) => (
          <div key={i} className="library-item" onClick={() => setSelectedLesson(lesson)} style={{ cursor: 'pointer' }}>
            <span className="library-item-title">{lesson.title}</span>
            <div className="library-item-right">
              {renderTags(lesson.tags)}
              <span className="times-matched">matched {lesson.timesMatched}×</span>
            </div>
          </div>
        ))}
      </div>
      <LessonModal lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
    </section>
  );
};

/* ── Analytics ── */
const Analytics = ({ lessons }) => {
  const [stats,       setStats]       = React.useState(null);
  const [loading,     setLoading]     = React.useState(false);
  const [errorMsg,    setErrorMsg]    = React.useState('');
  const [exportMsg,   setExportMsg]   = React.useState('');
  const [exportLoading, setExportLoading] = React.useState(false);

  // Chart canvas refs
  const refErrorTypes         = React.useRef(null);
  const refLanguages          = React.useRef(null);
  const refByDay              = React.useRef(null);
  const refBySource           = React.useRef(null);
  const refResolutionTrend    = React.useRef(null);
  const refErrorTypesOverTime = React.useRef(null);
  const refTopTags            = React.useRef(null);
  const refKbGrowth           = React.useRef(null);

  // Chart instance refs
  const chartErrorTypes         = React.useRef(null);
  const chartLanguages          = React.useRef(null);
  const chartByDay              = React.useRef(null);
  const chartBySource           = React.useRef(null);
  const chartResolutionTrend    = React.useRef(null);
  const chartErrorTypesOverTime = React.useRef(null);
  const chartTopTags            = React.useRef(null);
  const chartKbGrowth           = React.useRef(null);

  async function load() {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await apiGet('/api/occurrences/stats');
      setStats(data);
    } catch (err) {
      if (err.message !== 'Unauthorised') setErrorMsg(`Failed to load analytics: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, []);

  // ── Chart: Top Error Types ──
  React.useEffect(() => {
    if (!stats || !refErrorTypes.current) return;
    if (chartErrorTypes.current) chartErrorTypes.current.destroy();
    const etLabels = (stats.byErrorType || []).map(d => d.errorType);
    const etCounts = (stats.byErrorType || []).map(d => d.count);
    chartErrorTypes.current = new Chart(refErrorTypes.current, {
      type: 'bar',
      data: {
        labels: etLabels,
        datasets: [{ label: 'Occurrences', data: etCounts, backgroundColor: PALETTE[0], borderRadius: 4 }],
      },
      options: buildChartOptions({
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        },
      }),
    });
    return () => { if (chartErrorTypes.current) chartErrorTypes.current.destroy(); };
  }, [stats]);

  // ── Chart: Errors by Language ──
  React.useEffect(() => {
    if (!stats || !refLanguages.current) return;
    if (chartLanguages.current) chartLanguages.current.destroy();
    const langLabels = (stats.byLanguage || []).map(d => d.language);
    const langCounts = (stats.byLanguage || []).map(d => d.count);
    chartLanguages.current = new Chart(refLanguages.current, {
      type: 'doughnut',
      data: {
        labels: langLabels,
        datasets: [{ data: langCounts, backgroundColor: PALETTE, borderColor: '#131623', borderWidth: 2 }],
      },
      options: buildChartOptions(),
    });
    return () => { if (chartLanguages.current) chartLanguages.current.destroy(); };
  }, [stats]);

  // ── Chart: Errors Over Last 14 Days ──
  React.useEffect(() => {
    if (!stats || !refByDay.current) return;
    if (chartByDay.current) chartByDay.current.destroy();
    const dayLabels = (stats.byDay || []).map(d => d.date);
    const dayCounts = (stats.byDay || []).map(d => d.count);
    chartByDay.current = new Chart(refByDay.current, {
      type: 'line',
      data: {
        labels: dayLabels,
        datasets: [{
          label: 'Errors', data: dayCounts,
          borderColor: PALETTE[0], backgroundColor: 'rgba(99,102,241,0.15)',
          fill: true, tension: 0.3, pointRadius: 3,
        }],
      },
      options: buildChartOptions({
        scales: {
          x: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#a1a1aa', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' }, beginAtZero: true },
        },
      }),
    });
    return () => { if (chartByDay.current) chartByDay.current.destroy(); };
  }, [stats]);

  // ── Chart: Errors by Source ──
  React.useEffect(() => {
    if (!stats || !refBySource.current) return;
    if (chartBySource.current) chartBySource.current.destroy();
    const srcLabels = (stats.bySource || []).map(d => d.source || 'unknown');
    const srcCounts = (stats.bySource || []).map(d => d.count);
    chartBySource.current = new Chart(refBySource.current, {
      type: 'doughnut',
      data: {
        labels: srcLabels,
        datasets: [{ data: srcCounts, backgroundColor: PALETTE, borderColor: '#131623', borderWidth: 2 }],
      },
      options: buildChartOptions(),
    });
    return () => { if (chartBySource.current) chartBySource.current.destroy(); };
  }, [stats]);

  // ── Chart: Resolution Trend (stacked bar) ──
  React.useEffect(() => {
    if (!stats || !refResolutionTrend.current) return;
    if (chartResolutionTrend.current) chartResolutionTrend.current.destroy();
    const trendDates      = (stats.resolutionTrend || []).map(d => d.date);
    const trendResolved   = (stats.resolutionTrend || []).map(d => d.resolved);
    const trendUnresolved = (stats.resolutionTrend || []).map(d => d.unresolved);
    chartResolutionTrend.current = new Chart(refResolutionTrend.current, {
      type: 'bar',
      data: {
        labels: trendDates,
        datasets: [
          { label: 'Resolved',   data: trendResolved,   backgroundColor: '#4ade80', borderRadius: 3 },
          { label: 'Unresolved', data: trendUnresolved, backgroundColor: '#f87171', borderRadius: 3 },
        ],
      },
      options: buildChartOptions({
        scales: {
          x: { stacked: true, ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { stacked: true, ticks: { color: '#a1a1aa', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' }, beginAtZero: true },
        },
      }),
    });
    return () => { if (chartResolutionTrend.current) chartResolutionTrend.current.destroy(); };
  }, [stats]);

  // ── Chart: Most Common Tags (client-computed from lessons prop) ──
  React.useEffect(() => {
    if (!lessons || !refTopTags.current) return;
    if (chartTopTags.current) chartTopTags.current.destroy();

    // Flatten all tags and count frequency
    const freq = {};
    lessons.forEach(l => (l.tags || []).forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const tagLabels = sorted.map(([t]) => t);
    const tagCounts = sorted.map(([, c]) => c);

    chartTopTags.current = new Chart(refTopTags.current, {
      type: 'bar',
      data: {
        labels: tagLabels,
        datasets: [{
          label: 'Lessons',
          data: tagCounts,
          backgroundColor: PALETTE.slice(0, tagLabels.length),
          borderRadius: 4,
        }],
      },
      options: buildChartOptions({
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#a1a1aa', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' }, beginAtZero: true },
          y: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        },
      }),
    });
    return () => { if (chartTopTags.current) chartTopTags.current.destroy(); };
  }, [lessons]);

  // ── Chart: Knowledge Base Growth (client-computed cumulative line) ──
  React.useEffect(() => {
    if (!lessons || !refKbGrowth.current) return;
    if (chartKbGrowth.current) chartKbGrowth.current.destroy();

    // Group by YYYY-MM-DD, then build running total
    const dayMap = {};
    lessons.forEach(l => {
      const d = new Date(l.createdAt).toISOString().slice(0, 10);
      dayMap[d] = (dayMap[d] || 0) + 1;
    });
    const days = Object.keys(dayMap).sort();
    let running = 0;
    const cumulative = days.map(d => { running += dayMap[d]; return running; });

    chartKbGrowth.current = new Chart(refKbGrowth.current, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Total Lessons',
          data: cumulative,
          borderColor: PALETTE[1],
          backgroundColor: 'rgba(6,182,212,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        }],
      },
      options: buildChartOptions({
        scales: {
          x: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#a1a1aa', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' }, beginAtZero: true },
        },
      }),
    });
    return () => { if (chartKbGrowth.current) chartKbGrowth.current.destroy(); };
  }, [lessons]);

  // ── Chart: Top 5 Error Types Over Time (multi-line) ──
  React.useEffect(() => {
    if (!stats || !refErrorTypesOverTime.current) return;
    if (chartErrorTypesOverTime.current) chartErrorTypesOverTime.current.destroy();
    const allDatesSet = new Set();
    (stats.errorTypeOverTime || []).forEach(et =>
      et.dailyCounts.forEach(d => allDatesSet.add(d.date))
    );
    const allDates = Array.from(allDatesSet).sort();
    chartErrorTypesOverTime.current = new Chart(refErrorTypesOverTime.current, {
      type: 'line',
      data: {
        labels: allDates,
        datasets: (stats.errorTypeOverTime || []).map((et, i) => {
          const countsByDate = Object.fromEntries(et.dailyCounts.map(d => [d.date, d.count]));
          return {
            label: et.errorType,
            data: allDates.map(d => countsByDate[d] ?? 0),
            borderColor: PALETTE[i % PALETTE.length],
            backgroundColor: 'transparent',
            tension: 0.3,
            pointRadius: 3,
          };
        }),
      },
      options: buildChartOptions({
        scales: {
          x: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { color: '#a1a1aa', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' }, beginAtZero: true },
        },
      }),
    });
    return () => { if (chartErrorTypesOverTime.current) chartErrorTypesOverTime.current.destroy(); };
  }, [stats]);

  /* ── CSV Export ── */
  async function handleExport() {
    setExportLoading(true);
    setExportMsg('');
    let occurrences;
    try {
      const data = await apiGet('/api/occurrences');
      occurrences = data.occurrences || [];
    } catch (err) {
      if (err.message !== 'Unauthorised') setExportMsg(`Export failed: ${err.message}`);
      setExportLoading(false);
      return;
    }
    if (occurrences.length === 0) {
      setExportMsg('No occurrences to export.');
      setExportLoading(false);
      return;
    }

    const FIELDS = ['_id', 'rawMessage', 'errorType', 'source', 'language', 'filePath',
                    'resolved', 'tags', 'createdAt', 'updatedAt'];

    function csvEscape(val) {
      if (val == null) return '';
      const s = Array.isArray(val) ? val.join(';') : String(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    const header = FIELDS.join(',');
    const rows   = occurrences.map(o => FIELDS.map(f => csvEscape(o[f])).join(','));
    const csv    = [header, ...rows].join('\n');
    const blob   = new Blob([csv], { type: 'text/csv' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = `occurrences-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  }

  /* ── Computed stats ── */
  const total   = stats ? (stats.totalOccurrences || 0) : '—';
  const resolved   = stats ? (stats.resolvedCount   || 0) : '—';
  const unresolved = stats ? (stats.unresolvedCount || 0) : '—';
  const rate    = stats && stats.totalOccurrences > 0
    ? ((stats.resolvedCount / stats.totalOccurrences) * 100).toFixed(1) + '%'
    : (stats ? '—' : '—');
  const avgRes  = stats && stats.avgResolutionTimeHours != null
    ? `${stats.avgResolutionTimeHours} hrs` : (stats ? '—' : '—');
  const topUnresolved = stats ? (stats.topUnresolved || []) : [];

  return (
    <section id="section-analytics">
      <h2>Analytics</h2>

      <div className="stat-cards">
        <div className="stat-card"><span className="stat-value">{total}</span><span className="stat-label">Total Errors</span></div>
        <div className="stat-card"><span className="stat-value">{resolved}</span><span className="stat-label">Resolved</span></div>
        <div className="stat-card"><span className="stat-value">{unresolved}</span><span className="stat-label">Unresolved</span></div>
        <div className="stat-card"><span className="stat-value">{rate}</span><span className="stat-label">Resolution Rate</span></div>
        <div className="stat-card"><span className="stat-value">{avgRes}</span><span className="stat-label">Avg Resolution Time</span></div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Top Error Types</div>
          <div className="chart-wrap"><canvas ref={refErrorTypes}></canvas></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Errors by Language</div>
          <div className="chart-wrap"><canvas ref={refLanguages}></canvas></div>
        </div>
        <div className="chart-card chart-card--wide">
          <div className="chart-title">Errors Over Last 14 Days</div>
          <div className="chart-wrap"><canvas ref={refByDay}></canvas></div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Errors by Source</div>
          <div className="chart-wrap"><canvas ref={refBySource}></canvas></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Resolved vs Unresolved (14 days)</div>
          <div className="chart-wrap"><canvas ref={refResolutionTrend}></canvas></div>
        </div>
        <div className="chart-card chart-card--wide">
          <div className="chart-title">Top 5 Error Types Over Time</div>
          <div className="chart-wrap"><canvas ref={refErrorTypesOverTime}></canvas></div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Most Common Tags</div>
          <div className="chart-wrap"><canvas ref={refTopTags}></canvas></div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Knowledge Base Growth</div>
          <div className="chart-wrap"><canvas ref={refKbGrowth}></canvas></div>
        </div>
      </div>

      <div className="card">
        <div className="card-label">Top Unresolved Issues</div>
        {topUnresolved.length === 0
          ? <p className="empty-msg">No unresolved errors recorded yet.</p>
          : (
            <table className="unresolved-table">
              <thead><tr><th>Error Type</th><th>Count</th></tr></thead>
              <tbody>
                {topUnresolved.map((d, i) => (
                  <tr key={i}><td>{d.errorType}</td><td>{d.count}</td></tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        <button onClick={handleExport} disabled={exportLoading}>{exportLoading ? 'Loading…' : 'Export as CSV'}</button>
      </div>

      {errorMsg  && <p className="error-msg">⚠ {errorMsg}</p>}
      {exportMsg && <p className="error-msg">⚠ {exportMsg}</p>}
    </section>
  );
};

/* ── Sidebar nav icon SVGs ── */
const IconOverview  = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".85"/>
    <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".85"/>
    <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".85"/>
    <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".85"/>
  </svg>
);
const IconSubmit = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconMatch = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconLibrary = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 3h4v10H2zM6 3h4v10H6zM10 3h4v10h-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
);

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview',       Icon: IconOverview  },
  { key: 'submit',   label: 'Submit a Fix',   Icon: IconSubmit    },
  { key: 'match',    label: 'Find a Match',   Icon: IconMatch     },
  { key: 'library',  label: 'Lesson Library', Icon: IconLibrary   },
];

/* ── Dashboard ── */
const Dashboard = ({ company, onLogout }) => {
  const [activeNav,   setActiveNav]   = React.useState('overview');
  const [drawerOpen,  setDrawerOpen]  = React.useState(false);
  const [libraryKey,  setLibraryKey]  = React.useState(0);
  // lessons fetched once on mount; refreshed when a new lesson is submitted
  const [lessons,     setLessons]     = React.useState([]);

  // Eager-load lessons so Overview charts are populated on first render
  React.useEffect(() => {
    apiGet('/api/lessons')
      .then(data => setLessons(data.lessons || []))
      .catch(() => {});
  }, [libraryKey]);

  function handleLessonSubmitted() {
    setLibraryKey(k => k + 1);
  }

  function navigate(key) {
    setActiveNav(key);
    setDrawerOpen(false);
  }

  const sidebar = (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <DashboardOrb />
        <span className="sidebar-brand">Regression Whisperer</span>
      </div>

      <ul className="sidebar-nav">
        {NAV_ITEMS.map(({ key, label, Icon }) => (
          <li key={key}>
            <button
              className={`sidebar-nav-item${activeNav === key ? ' active' : ''}`}
              onClick={() => navigate(key)}
            >
              <Icon />
              {label}
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <span className="sidebar-company">{company.name}</span>
        <button className="sidebar-logout" onClick={onLogout}>Logout</button>
      </div>
    </nav>
  );

  return (
    <div id="app-shell">
      {/* ── Mobile top bar ── */}
      <div id="mobile-bar">
        <button
          className="hamburger"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(o => !o)}
        >
          <span/><span/><span/>
        </button>
        <span className="mobile-brand">Regression Whisperer</span>
      </div>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop persistent / mobile slide-out) ── */}
      <div className={`sidebar-wrap${drawerOpen ? ' open' : ''}`}>
        {sidebar}
      </div>

      {/* ── Main content ── */}
      <main id="dashboard">
        {activeNav === 'overview' && <Analytics lessons={lessons} />}
        {activeNav === 'submit'   && <SubmitForm onLessonSubmitted={handleLessonSubmitted} />}
        {activeNav === 'match'    && <MatchForm />}
        {activeNav === 'library'  && (
          <LessonLibrary refreshKey={libraryKey} onLessonsLoaded={setLessons} />
        )}
      </main>
    </div>
  );
};

/* ── App (root) ── */
const App = () => {
  const [company,    setCompany]    = React.useState(getCompany);
  const [sessionMsg, setSessionMsg] = React.useState('');

  // Wire the module-level 401 handler to this component's state setter
  React.useEffect(() => {
    handleUnauthorised = (msg) => {
      setCompany(null);
      setSessionMsg(msg || '');
    };
    return () => { handleUnauthorised = () => {}; };
  }, []);

  function handleAuthSuccess(c) {
    setCompany(c);
    setSessionMsg('');
  }

  function handleLogout() {
    clearSession();
    setCompany(null);
    setSessionMsg('');
  }

  if (!company) {
    return <AuthGate onSuccess={handleAuthSuccess} sessionMsg={sessionMsg} />;
  }

  return <Dashboard company={company} onLogout={handleLogout} />;
};

/* ── Mount ── */
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
