/**
 * Policy-gradient training: play full games with the current model, use final score
 * as feedback. Loss = (25 - score); we minimize a differentiable surrogate
 * (25 - score) * sum_t(-log π(a_t | s_t)) and take gradient steps.
 * Run with: npx ts-node src/strategies/neural-net/train.ts (or npm run build && node dist/strategies/neural-net/train.js)
 * Open http://localhost:3333 for a live loss graph (Y = loss, X = game).
 */
import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { getLegalActionsFromObservation } from '../../engine/actions';
import type { GameConfig } from '../../config';
import { createDefaultConfig } from '../../config';
import { createInitialState } from '../../engine/game-state';
import { buildObservation } from '../../engine/observation';
import { executeAction, calculateScore } from '../../engine/game-engine';
import { encodeObservation, ENCODER_OUTPUT_SIZE } from './encoder';
import { createModel, OUTPUT_ACTION_SIZE } from './model';

const NUM_GAMES = 10000;
const INITIAL_LR = 3e-5;
const FINAL_LR = 3e-6;
const LR_UPDATE_EVERY = 100; // log + recreate optimizer interval
const MODEL_SAVE_PATH = path.resolve(process.cwd(), 'models/hanabi');
const DASHBOARD_PORT = 3333;

/** Per-game stats for the live dashboard (loss = 25 - score, learning rate). */
const trainingHistory: { game: number; loss: number; score: number; learningRate: number }[] = [];

/** One step: encoded observation, index of action taken among legal actions, and number of legal actions. */
interface TrajectoryStep {
  encoded: number[];
  actionIdx: number;
  numLegal: number;
}

/**
 * Run one game with the current model (sample actions from model output over legal actions).
 * Returns final score and trajectory for policy-gradient loss.
 */
function runOneGame(
  seed: number,
  config: GameConfig,
  model: tf.LayersModel
): { score: number; trajectory: TrajectoryStep[] } {
  const state = createInitialState(seed, config.hintTokens, config.lifeTokens);
  const trajectory: TrajectoryStep[] = [];

  while (!state.gameOver) {
    const obs = buildObservation(state, state.currentPlayer);
    const legalActions = getLegalActionsFromObservation(obs);
    if (legalActions.length === 0) break;

    const encoded = encodeObservation(obs);
    const numLegal = Math.min(legalActions.length, OUTPUT_ACTION_SIZE);

    const actionIdx = tf.tidy(() => {
      const input = tf.tensor2d([encoded], [1, ENCODER_OUTPUT_SIZE], 'float32');
      const out = model.predict(input) as tf.Tensor;
      const probsSlice = out.slice([0, 0], [1, numLegal]);
      const sumSlice = tf.sum(probsSlice);
      const probsLegal = tf.div(probsSlice, tf.maximum(sumSlice, 1e-8));
      const logProbs = tf.log(tf.add(probsLegal, 1e-8)) as tf.Tensor2D;
      const sampled = tf.multinomial(logProbs, 1);
      const idx = sampled.dataSync()[0];
      return Math.min(Math.max(0, idx), numLegal - 1);
    });

    trajectory.push({ encoded, actionIdx, numLegal });
    executeAction(state, legalActions[actionIdx]);
  }

  const score = calculateScore(state.playedStacks);
  return { score, trajectory };
}

/**
 * Policy-gradient loss: (25 - score) * sum_t(-log π(a_t | s_t)).
 * Computed inside a function so the optimizer can backprop through the model.
 */
function computeLoss(
  model: tf.LayersModel,
  score: number,
  trajectory: TrajectoryStep[]
): tf.Scalar {
  const reward = 25 - score;
  if (trajectory.length === 0) {
    return tf.scalar(0);
  }
  const terms = trajectory.map(({ encoded, actionIdx, numLegal }) => {
    const input = tf.tensor2d([encoded], [1, ENCODER_OUTPUT_SIZE], 'float32');
    const out = model.predict(input) as tf.Tensor;
    const probsSlice = out.slice([0, 0], [1, numLegal]);
    const sumSlice = tf.sum(probsSlice);
    const probsLegal = tf.div(probsSlice, tf.maximum(sumSlice, 1e-8));
    const logProb = tf.log(
      tf.add(tf.reshape(probsLegal, [numLegal]).gather(actionIdx), 1e-8)
    );
    return tf.neg(logProb);
  });
  const totalNegLogProb = tf.sum(tf.stack(terms));
  return tf.mul(tf.scalar(reward), totalNegLogProb) as tf.Scalar;
}

/** Yield to the event loop so the dashboard server can handle requests. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function main(): Promise<void> {
  const app = express();
  const dashboardDir = path.join(process.cwd(), 'src', 'strategies', 'neural-net');
  app.use(express.static(dashboardDir));
  app.get('/api/stats', (_req, res) => {
    res.json({ history: trainingHistory });
  });
  app.get('/', (_req, res) => {
    res.sendFile(path.join(dashboardDir, 'training-dashboard.html'));
  });
  const server = app.listen(DASHBOARD_PORT, () => {
    console.log(`Live training graph: http://localhost:${DASHBOARD_PORT}`);
  });

  const config: GameConfig = createDefaultConfig({ gameCount: NUM_GAMES });
  const model = createModel(ENCODER_OUTPUT_SIZE);
  const progressDenom = Math.max(NUM_GAMES - 1, 1);

  console.log(
    `Policy-gradient training: ${NUM_GAMES} games, loss = (25 - score), LR linear decay ${INITIAL_LR} → ${FINAL_LR}.`
  );

  const MOVING_WINDOW = 500;
  const lastScores: number[] = [];
  let totalScore = 0;
  for (let g = 0; g < NUM_GAMES; g++) {
    const learningRate =
      INITIAL_LR + (FINAL_LR - INITIAL_LR) * (g / progressDenom);
    const optimizer = tf.train.adam(learningRate);
    const seed = g;
    const { score, trajectory } = runOneGame(seed, config, model);
    totalScore += score;
    lastScores.push(score);
    if (lastScores.length > MOVING_WINDOW) lastScores.shift();
    const loss = 25 - score;
    trainingHistory.push({ game: g + 1, loss, score, learningRate });

    if (trajectory.length > 0) {
      optimizer.minimize(() => computeLoss(model, score, trajectory));
    }

    if ((g + 1) % LR_UPDATE_EVERY === 0) {
      const avg = totalScore / (g + 1);
      const movingAvg =
        lastScores.length > 0
          ? lastScores.reduce((a, b) => a + b, 0) / lastScores.length
          : 0;
      console.log(
        `Games ${g + 1}/${NUM_GAMES} | lr ${learningRate.toExponential(2)} | avg ${avg.toFixed(2)} | moving avg (${MOVING_WINDOW}) ${movingAvg.toFixed(2)} | last score ${score}`
      );
    }
    await yieldToEventLoop();
  }

  server.close();

  fs.mkdirSync(MODEL_SAVE_PATH, { recursive: true });
  await model.save(`file://${MODEL_SAVE_PATH}`);
  console.log(`Model saved to ${MODEL_SAVE_PATH}`);
  console.log(`Final average score: ${(totalScore / NUM_GAMES).toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
