import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { getStrategies } from '../strategies/registry';
import { CONFIG_PRESETS } from '../config/presets';
import { runSimulation } from '../simulator/runner';
import { writeResults } from '../storage/results-writer';
import { tTest } from '../statistics/metrics';

const app = express();
app.use(express.json());

const publicDir = path.join(process.cwd(), 'src', 'ui', 'public');
app.use(express.static(publicDir));

const resultsDir = path.join(process.cwd(), 'results');

function safeTimestamp(timestamp: string): boolean {
  return /^[\w-]+$/.test(timestamp) && !timestamp.includes('..');
}

function safeFilename(filename: string): boolean {
  return /^[\w.-]+$/.test(filename) && !filename.includes('..');
}

app.get('/api/strategies', (_req, res) => {
  const strategies = getStrategies().map((s) => ({ name: s.name }));
  res.json(strategies);
});

app.get('/api/configs', (_req, res) => {
  const configs = CONFIG_PRESETS.map((p) => ({ id: p.id, label: p.label }));
  res.json(configs);
});

app.post('/api/run', (req, res) => {
  const { configId, strategyNames } = req.body || {};
  const preset = CONFIG_PRESETS.find((p) => p.id === configId);
  if (!preset) {
    res.status(400).json({ error: 'Invalid configId' });
    return;
  }

  try {
    const result = runSimulation(preset.config, strategyNames);
    const outputDir = writeResults(result, preset.config);
    const timestamp = path.basename(outputDir);
    res.json({ timestamp, outputDir });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/results', (_req, res) => {
  if (!fs.existsSync(resultsDir)) {
    res.json([]);
    return;
  }
  const dirs = fs.readdirSync(resultsDir);
  const timestamps = dirs.filter((d) => {
    const full = path.join(resultsDir, d);
    return fs.statSync(full).isDirectory();
  });
  res.json(timestamps.sort().reverse());
});

app.get('/api/results/:timestamp', (req, res) => {
  const { timestamp } = req.params;
  if (!safeTimestamp(timestamp)) {
    res.status(400).json({ error: 'Invalid timestamp' });
    return;
  }

  const dir = path.join(resultsDir, timestamp);
  if (!fs.existsSync(dir)) {
    res.status(404).json({ error: 'Results not found' });
    return;
  }

  try {
    const summary = JSON.parse(
      fs.readFileSync(path.join(dir, 'summary.json'), 'utf-8')
    );
    const rawScores = JSON.parse(
      fs.readFileSync(path.join(dir, 'raw_scores.json'), 'utf-8')
    );
    const stats = JSON.parse(
      fs.readFileSync(path.join(dir, 'stats.json'), 'utf-8')
    );
    res.json({ summary, rawScores, stats });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/results/:timestamp/compare', (req, res) => {
  const { timestamp } = req.params;
  const { a, b } = req.query;

  if (!safeTimestamp(timestamp) || typeof a !== 'string' || typeof b !== 'string') {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const dir = path.join(resultsDir, timestamp);
  if (!fs.existsSync(dir)) {
    res.status(404).json({ error: 'Results not found' });
    return;
  }

  try {
    const rawScores = JSON.parse(
      fs.readFileSync(path.join(dir, 'raw_scores.json'), 'utf-8')
    );
    const stats = JSON.parse(
      fs.readFileSync(path.join(dir, 'stats.json'), 'utf-8')
    );

    const scoresA = rawScores[a];
    const scoresB = rawScores[b];

    if (!scoresA || !scoresB) {
      res.status(400).json({ error: 'Strategy not found in results' });
      return;
    }

    const tt = tTest(scoresA, scoresB);
    const metricsA = stats[a];
    const metricsB = stats[b];

    let conclusion: string;
    if (tt.pValue >= 0.05) {
      conclusion = 'No significant difference';
    } else if (metricsA.avgScore > metricsB.avgScore) {
      conclusion = `${a} statistically better`;
    } else {
      conclusion = `${b} statistically better`;
    }

    res.json({
      pValue: tt.pValue,
      meanDiff: tt.meanDiff,
      conclusion,
      metricsA,
      metricsB,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/results/:timestamp/traces', (req, res) => {
  const { timestamp } = req.params;

  if (!safeTimestamp(timestamp)) {
    res.status(400).json({ error: 'Invalid timestamp' });
    return;
  }

  const tracesPath = path.join(resultsDir, timestamp, 'traces');
  if (!fs.existsSync(tracesPath) || !fs.statSync(tracesPath).isDirectory()) {
    res.json([]);
    return;
  }

  const files = fs.readdirSync(tracesPath).filter((f) => f.endsWith('.json'));
  res.json(files);
});

app.get('/api/results/:timestamp/traces/:filename', (req, res) => {
  const { timestamp, filename } = req.params;

  if (!safeTimestamp(timestamp) || !safeFilename(filename)) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const tracePath = path.join(resultsDir, timestamp, 'traces', filename);
  if (!fs.existsSync(tracePath) || !fs.statSync(tracePath).isFile()) {
    res.status(404).json({ error: 'Trace not found' });
    return;
  }

  res.download(tracePath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Hanabi Simulator UI at http://localhost:${PORT}`);
});
