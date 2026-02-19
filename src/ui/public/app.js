let chart = null;

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

async function loadStrategies() {
  const list = await api('/api/strategies');
  const sel = document.getElementById('strategies');
  sel.innerHTML = '';
  list.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    opt.selected = true;
    sel.appendChild(opt);
  });
}

async function loadConfigs() {
  const list = await api('/api/configs');
  const sel = document.getElementById('configs');
  sel.innerHTML = '';
  list.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
}

async function runSimulation() {
  const strategiesSel = document.getElementById('strategies');
  const configSel = document.getElementById('configs');
  const runBtn = document.getElementById('run');
  const errEl = document.getElementById('runError');

  const strategyNames = Array.from(strategiesSel.selectedOptions).map((o) => o.value);
  const configId = configSel.value;

  errEl.textContent = '';
  runBtn.disabled = true;

  try {
    const { timestamp } = await api('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configId,
        strategyNames: strategyNames.length > 0 ? strategyNames : undefined,
      }),
    });
    await loadResultList();
    await showResults(timestamp);
  } catch (e) {
    errEl.textContent = e.message;
  } finally {
    runBtn.disabled = false;
  }
}

async function showResults(timestamp) {
  const data = await api(`/api/results/${timestamp}`);
  const { summary, rawScores, stats } = data;

  document.getElementById('results').classList.add('visible');

  document.getElementById('resultMeta').textContent = `Run ${summary.timestamp} — ${summary.gameCount} games`;

  const tbody = document.querySelector('#resultsTable tbody');
  tbody.innerHTML = '';
  const timing = summary.strategyTiming || {};
  for (const name of summary.strategyNames) {
    const s = stats[name];
    const t = timing[name] || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${name}</td>
      <td>${s.avgScore.toFixed(2)}</td>
      <td>${s.stdDev.toFixed(2)}</td>
      <td>${(s.perfectRate * 100).toFixed(1)}%</td>
      <td>${summary.gameCount}</td>
      <td>${Math.round(t.totalMs || 0)}</td>
    `;
    tbody.appendChild(tr);
  }

  renderChart(summary.strategyNames, stats);
  setupComparison(timestamp, summary.strategyNames);
  await renderTraces(timestamp, summary);
}

function renderChart(strategyNames, stats) {
  const canvas = document.getElementById('histogramChart');
  const ctx = canvas.getContext('2d');

  if (chart) chart.destroy();

  const labels = Array.from({ length: 26 }, (_, i) => i);
  const colors = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

  const datasets = strategyNames.map((name, i) => ({
    label: name,
    data: stats[name].scoreHistogram,
    backgroundColor: colors[i % colors.length] + '80',
    borderColor: colors[i % colors.length],
    borderWidth: 1,
  }));

  chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Score' } },
        y: { beginAtZero: true, title: { display: true, text: 'Count' } },
      },
      plugins: {
        legend: { position: 'top' },
      },
    },
  });
}

function setupComparison(timestamp, strategyNames) {
  const selA = document.getElementById('compareA');
  const selB = document.getElementById('compareB');
  const resultEl = document.getElementById('comparisonResult');

  selA.innerHTML = selB.innerHTML = '<option value="">—</option>';
  strategyNames.forEach((n) => {
    selA.appendChild(new Option(n, n));
    selB.appendChild(new Option(n, n));
  });

  async function update() {
    const a = selA.value;
    const b = selB.value;
    if (!a || !b || a === b) {
      resultEl.textContent = '';
      return;
    }
    try {
      const data = await api(`/api/results/${timestamp}/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
      resultEl.innerHTML = `
        <p><strong>p-value:</strong> ${data.pValue.toFixed(3)}</p>
        <p><strong>Conclusion:</strong> ${data.conclusion}</p>
      `;
    } catch {
      resultEl.textContent = 'Error loading comparison';
    }
  }

  selA.onchange = selB.onchange = update;
  resultEl.textContent = '';
}

async function renderTraces(timestamp, summary) {
  const section = document.getElementById('tracesSection');
  if (summary.config?.loggingMode !== 'debug') {
    section.style.display = 'none';
    return;
  }

  try {
    const files = await api(`/api/results/${timestamp}/traces`);
    if (files.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    section.innerHTML =
      '<h3>Debug Traces</h3><ul>' +
      files
        .map(
          (f) =>
            `<li><a href="/api/results/${timestamp}/traces/${encodeURIComponent(f)}" download>${f}</a> ` +
            `<button data-timestamp="${timestamp}" data-filename="${f}">View replay</button></li>`
        )
        .join('') +
      '</ul>';
    section.querySelectorAll('button[data-timestamp]').forEach((btn) => {
      btn.onclick = () => openReplay(btn.dataset.timestamp, btn.dataset.filename);
    });
  } catch {
    section.style.display = 'none';
  }
}

let replayState = null;

async function openReplay(timestamp, filename) {
  try {
    const [trace, resultData] = await Promise.all([
      api(`/api/results/${timestamp}/traces/${encodeURIComponent(filename)}?json=1`),
      api(`/api/results/${timestamp}`),
    ]);
    const config = resultData.summary.config || { playerCount: 2, hintTokens: 8, lifeTokens: 3 };
    const steps = buildReplaySteps(trace, config);
    replayState = { trace, steps, timestamp, filename };
    document.getElementById('replayTitle').textContent = `Replay: ${filename}`;
    showReplayStep(0);
    document.getElementById('replayOverlay').classList.add('visible');
  } catch (e) {
    alert('Failed to load replay: ' + e.message);
  }
}

let currentReplayStep = 0;

function showReplayStep(stepIndex) {
  if (!replayState) return;
  const { steps, trace } = replayState;
  currentReplayStep = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const state = steps[currentReplayStep];

  document.getElementById('replayFirst').disabled = currentReplayStep === 0;
  document.getElementById('replayPrev').disabled = currentReplayStep === 0;
  document.getElementById('replayNext').disabled = currentReplayStep === steps.length - 1;
  document.getElementById('replayLast').disabled = currentReplayStep === steps.length - 1;
  document.getElementById('replayStepLabel').textContent = `Step ${currentReplayStep} of ${steps.length - 1}`;

  let html = renderStacks(state.playedStacks);
  for (let p = 0; p < state.hands.length; p++) {
    const currentClass = p === state.currentPlayer ? ' hand-row current-player' : ' hand-row';
    html += `<div class="${currentClass.trim()}"><strong class="hand-label">Player ${p}</strong> <div class="hand-cards">`;
    state.hands[p].forEach((c, i) => {
      html += renderCard(c, state.hintKnowledge, i, false);
    });
    html += '</div></div>';
  }
  html += `<div class="replay-meta"><strong>Discard:</strong> ${state.discardPile.map((c) => COLOR_NAMES[c.color] + c.value).join(', ') || '—'} &nbsp;|&nbsp; `;
  html += `<strong>Tokens:</strong> Hints: ${state.hintTokens}, Lives: ${state.lifeTokens} &nbsp;|&nbsp; `;
  html += `<strong>Deck:</strong> ${state.deck.length} cards</div>`;
  if (currentReplayStep > 0 && trace.events[currentReplayStep - 1]) {
    html += `<div class="last-move">Last move: ${formatEvent(trace.events[currentReplayStep - 1])}</div>`;
  } else if (currentReplayStep === 0) {
    html += '<div class="last-move">Initial deal</div>';
  }

  document.getElementById('replayState').innerHTML = html;
}

function setupReplayControls() {
  document.getElementById('replayClose').onclick = () => {
    document.getElementById('replayOverlay').classList.remove('visible');
    replayState = null;
  };
  document.getElementById('replayFirst').onclick = () => showReplayStep(0);
  document.getElementById('replayPrev').onclick = () => showReplayStep(currentReplayStep - 1);
  document.getElementById('replayNext').onclick = () => showReplayStep(currentReplayStep + 1);
  document.getElementById('replayLast').onclick = () => showReplayStep(replayState?.steps.length - 1 ?? 0);
  document.getElementById('replayOverlay').onclick = (e) => {
    if (e.target.id === 'replayOverlay') {
      document.getElementById('replayOverlay').classList.remove('visible');
    }
  };
}

async function loadResultList() {
  const list = await api('/api/results');
  const sel = document.getElementById('loadResult');
  sel.innerHTML = '<option value="">—</option>';
  list.forEach((ts) => {
    sel.appendChild(new Option(ts, ts));
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setupReplayControls();
  await loadStrategies();
  await loadConfigs();
  await loadResultList();
  document.getElementById('run').onclick = runSimulation;
  document.getElementById('loadResult').onchange = async () => {
    const ts = document.getElementById('loadResult').value;
    if (ts) await showResults(ts);
  };
});
