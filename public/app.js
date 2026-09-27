/* ── Auth state ── */

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

/* ── UI visibility ── */

function showDashboard(company) {
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('auth-bar').classList.remove('hidden');
  document.getElementById('auth-bar-name').textContent = `Logged in as ${company.name}`;
  document.getElementById('dashboard').classList.remove('hidden');
}

function showAuthGate(message) {
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('auth-bar').classList.add('hidden');
  document.getElementById('auth-gate').classList.remove('hidden');
  if (message) {
    document.getElementById('login-error').textContent = message;
    // Make sure login form is visible when showing a message
    showAuthForm('login');
  }
}

function showAuthForm(mode) {
  const isLogin = mode === 'login';
  document.getElementById('form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('form-signup').classList.toggle('hidden',  isLogin);
  document.getElementById('tab-login').classList.toggle('active',  isLogin);
  document.getElementById('tab-signup').classList.toggle('active', !isLogin);
}

/* ── Helpers ── */

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.dataset.original = btn.dataset.original || btn.textContent;
  btn.textContent = loading ? 'Loading…' : btn.dataset.original;
}

function showError(container, message) {
  container.innerHTML = `<p class="error-msg">⚠ ${message}</p>`;
}

function renderTags(tags) {
  if (!tags || tags.length === 0) return '';
  return `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`;
}

function renderFixSteps(steps) {
  if (!steps || steps.length === 0) return '';
  return `
    <div>
      <div class="card-label">Fix Steps</div>
      <ol class="fix-steps">
        ${steps.map(s => `<li>${s}</li>`).join('')}
      </ol>
    </div>`;
}

function renderLessonCard(lesson, score) {
  const scoreHtml = score !== undefined
    ? `<span class="score-badge">score ${score}</span>`
    : '';
  return `
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span class="card-title">${lesson.title}</span>
        ${scoreHtml}
      </div>
      ${lesson.errorType ? `<p class="card-meta">${lesson.errorType}</p>` : ''}
      ${lesson.rootCause ? `<div><div class="card-label">Root Cause</div><p>${lesson.rootCause}</p></div>` : ''}
      ${renderFixSteps(lesson.fixSteps)}
      ${renderTags(lesson.tags)}
    </div>`;
}

/* ── API calls (all authenticated) ── */

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
    showAuthGate('Session expired, please log in again.');
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
    showAuthGate('Session expired, please log in again.');
    throw new Error('Unauthorised');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ── Auth: tab toggle ── */

document.getElementById('tab-login').addEventListener('click',  () => showAuthForm('login'));
document.getElementById('tab-signup').addEventListener('click', () => showAuthForm('signup'));

/* ── Auth: signup ── */

document.getElementById('form-signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn       = document.getElementById('signup-btn');
  const errorEl   = document.getElementById('signup-error');
  const name      = document.getElementById('auth-signup-name').value.trim();
  const email     = document.getElementById('auth-signup-email').value.trim();
  const password  = document.getElementById('auth-signup-password').value;

  if (!name || !email || !password) {
    errorEl.textContent = 'All fields are required.';
    return;
  }

  setLoading(btn, true);
  errorEl.textContent = '';

  try {
    const data = await apiPost('/api/auth/signup', { name, email, password }, true);
    saveSession(data.token, data.company);
    showDashboard(data.company);
    loadLibrary();
    loadAnalytics();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    setLoading(btn, false);
  }
});

/* ── Auth: login ── */

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn      = document.getElementById('login-btn');
  const errorEl  = document.getElementById('login-error');
  const email    = document.getElementById('auth-login-email').value.trim();
  const password = document.getElementById('auth-login-password').value;

  if (!email || !password) {
    errorEl.textContent = 'Email and password are required.';
    return;
  }

  setLoading(btn, true);
  errorEl.textContent = '';

  try {
    const data = await apiPost('/api/auth/login', { email, password }, true);
    saveSession(data.token, data.company);
    showDashboard(data.company);
    loadLibrary();
    loadAnalytics();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    setLoading(btn, false);
  }
});

/* ── Auth: logout ── */

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  location.reload();
});

/* ── Submit a Fix ── */

document.getElementById('submit-btn').addEventListener('click', async () => {
  const btn = document.getElementById('submit-btn');
  const stackTrace = document.getElementById('submit-stack').value.trim();
  const description = document.getElementById('submit-desc').value.trim();
  const result = document.getElementById('submit-result');

  if (!stackTrace || !description) {
    showError(result, 'Both fields are required.');
    return;
  }

  setLoading(btn, true);
  result.innerHTML = '';

  try {
    const lesson = await apiPost('/api/lessons/submit', { stackTrace, description });
    result.innerHTML = renderLessonCard(lesson);
    loadLibrary();
  } catch (err) {
    if (err.message !== 'Unauthorised') showError(result, err.message);
  } finally {
    setLoading(btn, false);
  }
});

/* ── Find a Match ── */

document.getElementById('match-btn').addEventListener('click', async () => {
  const btn = document.getElementById('match-btn');
  const stackTrace = document.getElementById('match-stack').value.trim();
  const description = document.getElementById('match-desc').value.trim();
  const result = document.getElementById('match-result');

  if (!stackTrace || !description) {
    showError(result, 'Both fields are required.');
    return;
  }

  setLoading(btn, true);
  result.innerHTML = '';

  try {
    const data = await apiPost('/api/lessons/match', { stackTrace, description });

    if (!data.matches || data.matches.length === 0) {
      result.innerHTML = `<p class="empty-msg">${data.message || 'No similar past lessons found.'}</p>`;
      return;
    }

    result.innerHTML = data.matches
      .map(({ lesson, score }) => renderLessonCard(lesson, score))
      .join('');
  } catch (err) {
    if (err.message !== 'Unauthorised') showError(result, err.message);
  } finally {
    setLoading(btn, false);
  }
});

/* ── Lesson Library ── */

async function loadLibrary() {
  const container = document.getElementById('library-list');

  try {
    const data = await apiGet('/api/lessons');
    const lessons = data.lessons;

    if (!lessons || lessons.length === 0) {
      container.innerHTML = `<span class="empty-msg">No lessons saved yet.</span>`;
      return;
    }

    container.innerHTML = lessons
      .map(lesson => `
        <div class="library-item">
          <span class="library-item-title">${lesson.title}</span>
          <div class="library-item-right">
            ${renderTags(lesson.tags)}
            <span class="times-matched">matched ${lesson.timesMatched}×</span>
          </div>
        </div>`)
      .join('');
  } catch (err) {
    if (err.message !== 'Unauthorised') {
      container.innerHTML = `<p class="error-msg">⚠ Failed to load library: ${err.message}</p>`;
    }
  }
}

/* ── Analytics ── */

let chartErrorTypes        = null;
let chartLanguages         = null;
let chartByDay             = null;
let chartBySource          = null;
let chartResolutionTrend   = null;
let chartErrorTypesOverTime = null;

const CHART_DEFAULTS = { color: '#8b90a8', borderColor: '#2e3248' };

const PALETTE = [
  '#6c8ef5','#4ade80','#f87171','#facc15','#a78bfa',
  '#34d399','#fb923c','#60a5fa','#e879f9','#2dd4bf',
];

function buildChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8b90a8', font: { size: 11 } } } },
    ...extra,
  };
}

async function loadAnalytics() {
  const refreshBtn = document.getElementById('analytics-refresh-btn');
  const errorEl    = document.getElementById('analytics-error');
  errorEl.innerHTML = '';
  setLoading(refreshBtn, true);

  let stats;
  try {
    stats = await apiGet('/api/occurrences/stats');
  } catch (err) {
    if (err.message !== 'Unauthorised') {
      errorEl.innerHTML = `<p class="error-msg">⚠ Failed to load analytics: ${err.message}</p>`;
    }
    setLoading(refreshBtn, false);
    return;
  }

  const total = stats.totalOccurrences || 0;
  const rate  = total > 0 ? ((stats.resolvedCount / total) * 100).toFixed(1) + '%' : '—';
  const avgRes = stats.avgResolutionTimeHours != null
    ? `${stats.avgResolutionTimeHours} hrs` : '—';

  document.getElementById('stat-total').textContent          = total;
  document.getElementById('stat-resolved').textContent       = stats.resolvedCount   || 0;
  document.getElementById('stat-unresolved').textContent     = stats.unresolvedCount || 0;
  document.getElementById('stat-rate').textContent           = rate;
  document.getElementById('stat-avg-resolution').textContent = avgRes;

  const etLabels = (stats.byErrorType || []).map(d => d.errorType);
  const etCounts = (stats.byErrorType || []).map(d => d.count);

  if (chartErrorTypes) chartErrorTypes.destroy();
  chartErrorTypes = new Chart(document.getElementById('chart-error-types'), {
    type: 'bar',
    data: {
      labels: etLabels,
      datasets: [{ label: 'Occurrences', data: etCounts, backgroundColor: PALETTE[0], borderRadius: 4 }],
    },
    options: buildChartOptions({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b90a8' }, grid: { color: '#2e3248' } },
        y: { ticks: { color: '#8b90a8' }, grid: { color: '#2e3248' } },
      },
    }),
  });

  const langLabels = (stats.byLanguage || []).map(d => d.language);
  const langCounts = (stats.byLanguage || []).map(d => d.count);

  if (chartLanguages) chartLanguages.destroy();
  chartLanguages = new Chart(document.getElementById('chart-languages'), {
    type: 'doughnut',
    data: {
      labels: langLabels,
      datasets: [{ data: langCounts, backgroundColor: PALETTE, borderColor: '#1a1d27', borderWidth: 2 }],
    },
    options: buildChartOptions(),
  });

  const dayLabels = (stats.byDay || []).map(d => d.date);
  const dayCounts = (stats.byDay || []).map(d => d.count);

  if (chartByDay) chartByDay.destroy();
  chartByDay = new Chart(document.getElementById('chart-by-day'), {
    type: 'line',
    data: {
      labels: dayLabels,
      datasets: [{
        label: 'Errors', data: dayCounts,
        borderColor: PALETTE[0], backgroundColor: 'rgba(108,142,245,0.15)',
        fill: true, tension: 0.3, pointRadius: 3,
      }],
    },
    options: buildChartOptions({
      scales: {
        x: { ticks: { color: '#8b90a8' }, grid: { color: '#2e3248' } },
        y: { ticks: { color: '#8b90a8', stepSize: 1 }, grid: { color: '#2e3248' }, beginAtZero: true },
      },
    }),
  });

  // ── Errors by Source (doughnut) ──
  const srcLabels = (stats.bySource || []).map(d => d.source || 'unknown');
  const srcCounts = (stats.bySource || []).map(d => d.count);

  if (chartBySource) chartBySource.destroy();
  chartBySource = new Chart(document.getElementById('chart-by-source'), {
    type: 'doughnut',
    data: {
      labels: srcLabels,
      datasets: [{ data: srcCounts, backgroundColor: PALETTE, borderColor: '#1a1d27', borderWidth: 2 }],
    },
    options: buildChartOptions(),
  });

  // ── Resolved vs Unresolved trend (stacked bar) ──
  const trendDates      = (stats.resolutionTrend || []).map(d => d.date);
  const trendResolved   = (stats.resolutionTrend || []).map(d => d.resolved);
  const trendUnresolved = (stats.resolutionTrend || []).map(d => d.unresolved);

  if (chartResolutionTrend) chartResolutionTrend.destroy();
  chartResolutionTrend = new Chart(document.getElementById('chart-resolution-trend'), {
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
        x: { stacked: true, ticks: { color: '#8b90a8' }, grid: { color: '#2e3248' } },
        y: { stacked: true, ticks: { color: '#8b90a8', stepSize: 1 }, grid: { color: '#2e3248' }, beginAtZero: true },
      },
    }),
  });

  // ── Top 5 Error Types Over Time (multi-line) ──
  // Collect the union of all dates across all error types
  const allDatesSet = new Set();
  (stats.errorTypeOverTime || []).forEach(et =>
    et.dailyCounts.forEach(d => allDatesSet.add(d.date))
  );
  const allDates = Array.from(allDatesSet).sort();

  if (chartErrorTypesOverTime) chartErrorTypesOverTime.destroy();
  chartErrorTypesOverTime = new Chart(document.getElementById('chart-error-types-over-time'), {
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
        x: { ticks: { color: '#8b90a8' }, grid: { color: '#2e3248' } },
        y: { ticks: { color: '#8b90a8', stepSize: 1 }, grid: { color: '#2e3248' }, beginAtZero: true },
      },
    }),
  });

  // ── Top Unresolved table ──
  const unresolvedEl  = document.getElementById('analytics-unresolved');
  const topUnresolved = stats.topUnresolved || [];

  if (topUnresolved.length === 0) {
    unresolvedEl.innerHTML = '<p class="empty-msg">No unresolved errors recorded yet.</p>';
  } else {
    unresolvedEl.innerHTML = `
      <table class="unresolved-table">
        <thead><tr><th>Error Type</th><th>Count</th></tr></thead>
        <tbody>
          ${topUnresolved.map(d => `<tr><td>${d.errorType}</td><td>${d.count}</td></tr>`).join('')}
        </tbody>
      </table>`;
  }

  setLoading(refreshBtn, false);
}

document.getElementById('analytics-refresh-btn').addEventListener('click', loadAnalytics);

/* ── CSV Export ── */

document.getElementById('analytics-export-btn').addEventListener('click', async () => {
  const btn = document.getElementById('analytics-export-btn');
  setLoading(btn, true);

  let occurrences;
  try {
    const data = await apiGet('/api/occurrences');
    occurrences = data.occurrences || [];
  } catch (err) {
    if (err.message !== 'Unauthorised') {
      document.getElementById('analytics-error').innerHTML =
        `<p class="error-msg">⚠ Export failed: ${err.message}</p>`;
    }
    setLoading(btn, false);
    return;
  }

  if (occurrences.length === 0) {
    document.getElementById('analytics-error').innerHTML =
      '<p class="empty-msg">No occurrences to export.</p>';
    setLoading(btn, false);
    return;
  }

  const FIELDS = ['_id', 'rawMessage', 'errorType', 'source', 'language', 'filePath',
                  'resolved', 'tags', 'createdAt', 'updatedAt'];

  function csvEscape(val) {
    if (val == null) return '';
    const s = Array.isArray(val) ? val.join(';') : String(val);
    // Wrap in quotes if it contains comma, quote, or newline
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  const header = FIELDS.join(',');
  const rows   = occurrences.map(o =>
    FIELDS.map(f => csvEscape(o[f])).join(',')
  );
  const csv = [header, ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `occurrences-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  setLoading(btn, false);
});

/* ── Voice Input ── */

function setupVoiceInput(buttonId, textareaId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn      = document.getElementById(buttonId);
  const textarea = document.getElementById(textareaId);
  const errorEl  = document.getElementById(buttonId + '-error');

  if (!SpeechRecognition) {
    if (btn) btn.style.display = 'none';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous     = false;
  recognition.interimResults = true;
  recognition.lang           = 'en-US';

  let interimStart = textarea.value.length;
  let isListening  = false;

  function setListening(active) {
    isListening = active;
    btn.classList.toggle('listening', active);
    btn.textContent = active ? '🔴' : '🎤';
    btn.disabled = active;
  }

  function showMicError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    setTimeout(() => { errorEl.textContent = ''; }, 4000);
  }

  btn.addEventListener('click', () => {
    if (isListening) return;
    errorEl.textContent = '';
    interimStart = textarea.value.length;
    setListening(true);
    recognition.start();
  });

  recognition.addEventListener('result', (event) => {
    const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
    const base   = textarea.value.slice(0, interimStart);
    const prefix = base.length > 0 && !base.endsWith(' ') ? ' ' : '';
    textarea.value = base + prefix + transcript;
  });

  recognition.addEventListener('end',   () => { setListening(false); btn.disabled = false; });
  recognition.addEventListener('error', (event) => {
    setListening(false);
    btn.disabled = false;
    const MSG = { 'no-speech': 'No speech detected.', 'not-allowed': 'Microphone access denied.', 'network': 'Network error.' };
    showMicError(MSG[event.error] || `Recognition error: ${event.error}`);
  });
}

setupVoiceInput('mic-submit-stack', 'submit-stack');
setupVoiceInput('mic-submit-desc',  'submit-desc');
setupVoiceInput('mic-match-stack',  'match-stack');
setupVoiceInput('mic-match-desc',   'match-desc');

/* ── Bootstrap: check for saved session ── */

(function init() {
  const token   = getToken();
  const company = getCompany();

  if (token && company) {
    showDashboard(company);
    loadLibrary();
    loadAnalytics();
  } else {
    showAuthGate();
  }
})();
