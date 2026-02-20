/**
 * Actor-Critic training on the first 2 moves (1 per player).
 * Reward = score after 2 moves − misfire_penalty×first_player_misfires + hint_bonus if first action is a hint.
 * Advantage = reward − V(s) per step (critic baseline). Loss = policy + 0.5×value − 0.1×entropy.
 * Run with: npx ts-node src/strategies/neural-net/train.ts (or npm run build && node dist/strategies/neural-net/train.js)
 * Open http://localhost:3333 for a live loss graph (Y = loss, X = game).
 */
import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { getLegalActionsFromObservationNoDiscard } from '../../engine/actions';
import type { GameConfig } from '../../config';
import { createDefaultConfig } from '../../config';
import { createInitialState } from '../../engine/game-state';
import { buildObservation } from '../../engine/observation';
import { executeAction, calculateScore } from '../../engine/game-engine';
import { encodeObservation, ENCODER_OUTPUT_SIZE } from './encoder';
import { createModel, OUTPUT_ACTION_SIZE } from './model';

const NUM_GAMES = 500000;
const BATCH_SIZE = 500;
const MOVES_PER_GAME = 2;
const MISFIRE_PENALTY = 1;
/** Small reward when the first action is a hint (reward shaping for hint-then-play). */
const HINT_REWARD = 1;
/** Entropy bonus: loss -= ENTROPY_COEF * sum_t H(π_t). */
const ENTROPY_COEF = 0.1;
/** Value loss coefficient: loss += VALUE_LOSS_COEF * MSE(reward, V(s)). */
const VALUE_LOSS_COEF = 0.5;
const LEARNING_RATE = 1e-4; // no decay
const LR_UPDATE_EVERY = 2000; // log + recreate optimizer interval
const MODEL_SAVE_PATH = path.resolve(process.cwd(), 'models/hanabi');
const DASHBOARD_PORT = 3333;

/** Per-game stats for the live dashboard. avgReward = cumulative average (matches log "avg reward"). */
const trainingHistory: {
  game: number;
  loss: number;
  lossMovingAvg: number;
  reward: number;
  rewardMovingAvg: number;
  avgReward: number;
  score: number;
  misfireCount: number;
  learningRate: number;
}[] = [];

/** One step: encoded observation, index of action taken among legal actions, and number of legal actions. */
interface TrajectoryStep {
  encoded: number[];
  actionIdx: number;
  numLegal: number;
}

/**
 * Run the first MOVES_PER_GAME moves with the current model.
 * Returns reward (score after N moves − MISFIRE_PENALTY × first-player misfires only), trajectory, scoreAfterN, misfireCount.
 */
function runOneGame(
  seed: number,
  config: GameConfig,
  model: tf.LayersModel
): { reward: number; trajectory: TrajectoryStep[]; scoreAfter6: number; misfireCount: number } {
  const state = createInitialState(seed, config.hintTokens, config.lifeTokens);
  const trajectory: TrajectoryStep[] = [];
  let misfireCount = 0;
  let firstActionWasHint = false;

  while (!state.gameOver && trajectory.length < MOVES_PER_GAME) {
    const obs = buildObservation(state, state.currentPlayer);
    const legalActions = getLegalActionsFromObservationNoDiscard(obs);
    if (legalActions.length === 0) break;

    const encoded = encodeObservation(obs);
    const numLegal = Math.min(legalActions.length, OUTPUT_ACTION_SIZE);

    const actionIdx = tf.tidy(() => {
      const input = tf.tensor2d([encoded], [1, ENCODER_OUTPUT_SIZE], 'float32');
      const [policyOut] = model.predict(input) as [tf.Tensor, tf.Tensor];
      const probsSlice = policyOut.slice([0, 0], [1, numLegal]);
      const sumSlice = tf.sum(probsSlice);
      const probsLegal = tf.div(probsSlice, tf.maximum(sumSlice, 1e-8));
      const logProbs = tf.log(tf.add(probsLegal, 1e-8)) as tf.Tensor2D;
      const sampled = tf.multinomial(logProbs, 1);
      const idx = sampled.dataSync()[0];
      return Math.min(Math.max(0, idx), numLegal - 1);
    });

    trajectory.push({ encoded, actionIdx, numLegal });
    const event = executeAction(state, legalActions[actionIdx]);
    if (trajectory.length === 1) firstActionWasHint = event.type === 'hint';
    if (
      event.type === 'play' &&
      !event.success &&
      trajectory.length === 1
    )
      misfireCount++;
  }

  const scoreAfter6 = calculateScore(state.playedStacks);
  const reward =
    scoreAfter6 -
    MISFIRE_PENALTY * misfireCount +
    (firstActionWasHint ? HINT_REWARD : 0);
  return { reward, trajectory, scoreAfter6, misfireCount };
}

/**
 * Actor-Critic loss: advantage_t = reward − V(s_t); policy_loss + VALUE_LOSS_COEF*value_loss − ENTROPY_COEF*entropy.
 * All tensors created inside so gradients flow through shared backbone.
 */
function computeLoss(
  model: tf.LayersModel,
  reward: number,
  trajectory: TrajectoryStep[]
): tf.Scalar {
  if (trajectory.length === 0) {
    return tf.scalar(0);
  }
  const rewardTensor = tf.scalar(reward, 'float32');
  const policyTerms: tf.Tensor[] = [];
  const valueTerms: tf.Tensor[] = [];
  const entropyTerms: tf.Tensor[] = [];

  for (const { encoded, actionIdx, numLegal } of trajectory) {
    const input = tf.tensor2d([encoded], [1, ENCODER_OUTPUT_SIZE], 'float32');
    const [policyOut, valueOut] = model.predict(input) as [tf.Tensor, tf.Tensor];
    const probsSlice = policyOut.slice([0, 0], [1, numLegal]);
    const sumSlice = tf.sum(probsSlice);
    const probsLegal = tf.div(probsSlice, tf.maximum(sumSlice, 1e-8));
    const logProb = tf.log(
      tf.add(tf.reshape(probsLegal, [numLegal]).gather(actionIdx), 1e-8)
    );
    const negLogProb = tf.neg(logProb);
    const entropy = tf.neg(
      tf.sum(tf.mul(probsLegal, tf.log(tf.add(probsLegal, 1e-8))))
    );
    const advantageT = tf.squeeze(tf.sub(rewardTensor, valueOut));
    policyTerms.push(tf.mul(advantageT, negLogProb));
    valueTerms.push(tf.square(tf.sub(rewardTensor, valueOut)));
    entropyTerms.push(entropy);
  }

  const totalPolicyLoss = tf.sum(tf.stack(policyTerms));
  const totalValueLoss = tf.sum(tf.stack(valueTerms));
  const totalEntropy = tf.sum(tf.stack(entropyTerms));
  return tf.add(
    tf.add(totalPolicyLoss, tf.mul(tf.scalar(VALUE_LOSS_COEF), totalValueLoss)),
    tf.neg(tf.mul(tf.scalar(ENTROPY_COEF), totalEntropy))
  ) as tf.Scalar;
}

/** Mean loss over a batch of games. Same formula as computeLoss, summed over games then divided by batch size. */
function computeBatchLoss(
  model: tf.LayersModel,
  batchData: { reward: number; trajectory: TrajectoryStep[] }[]
): tf.Scalar {
  if (batchData.length === 0) {
    return tf.scalar(0);
  }
  const lossTerms: tf.Tensor[] = [];
  for (const { reward, trajectory } of batchData) {
    const L = computeLoss(model, reward, trajectory);
    lossTerms.push(L);
  }
  const total = tf.sum(tf.stack(lossTerms));
  return tf.div(total, tf.scalar(batchData.length, 'float32')) as tf.Scalar;
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

  console.log(
    `Actor-Critic training: ${NUM_GAMES} games, first ${MOVES_PER_GAME} moves, reward = score_after_2 − ${MISFIRE_PENALTY}×misfires, LR ${LEARNING_RATE} (no decay).`
  );

  const MOVING_WINDOW = 500;
  const lastRewards: number[] = [];
  const lastLosses: number[] = [];
  let totalReward = 0;

  for (let batchStart = 0; batchStart < NUM_GAMES; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, NUM_GAMES);
    const batchData: {
      reward: number;
      trajectory: TrajectoryStep[];
      scoreAfter6: number;
      misfireCount: number;
    }[] = [];

    for (let g = batchStart; g < batchEnd; g++) {
      const result = runOneGame(g, config, model);
      totalReward += result.reward;
      batchData.push({
        reward: result.reward,
        trajectory: result.trajectory,
        scoreAfter6: result.scoreAfter6,
        misfireCount: result.misfireCount,
      });
    }

    const optimizer = tf.train.adam(LEARNING_RATE);
    let batchLoss = 0;
    const hasAnyTrajectory = batchData.some((d) => d.trajectory.length > 0);
    if (hasAnyTrajectory) {
      optimizer.minimize(() => {
        const L = computeBatchLoss(model, batchData);
        batchLoss = L.dataSync()[0];
        return L;
      });
    }

    const batchAvgReward =
      batchData.length > 0
        ? batchData.reduce((s, d) => s + d.reward, 0) / batchData.length
        : 0;
    lastRewards.push(batchAvgReward);
    if (lastRewards.length > MOVING_WINDOW) lastRewards.shift();
    lastLosses.push(batchLoss);
    if (lastLosses.length > MOVING_WINDOW) lastLosses.shift();

    const rewardMovingAvg =
      lastRewards.length > 0
        ? lastRewards.reduce((a, b) => a + b, 0) / lastRewards.length
        : batchAvgReward;
    const lossMovingAvg =
      lastLosses.length > 0
        ? lastLosses.reduce((a, b) => a + b, 0) / lastLosses.length
        : batchLoss;
    const avgReward = totalReward / batchEnd;
    const lastGame = batchData[batchData.length - 1];
    const lastScore = lastGame
      ? runOneGame(batchEnd - 1, config, model).scoreAfter6
      : 0;
    trainingHistory.push({
      game: batchEnd,
      loss: batchLoss,
      lossMovingAvg,
      reward: batchAvgReward,
      rewardMovingAvg,
      avgReward,
      score: lastScore,
      misfireCount: 0,
      learningRate: LEARNING_RATE,
    });

    if (batchEnd % LR_UPDATE_EVERY === 0 || batchEnd === NUM_GAMES) {
      const movingAvg =
        lastRewards.length > 0
          ? lastRewards.reduce((a, b) => a + b, 0) / lastRewards.length
          : 0;
      console.log(
        `Games ${batchEnd}/${NUM_GAMES} | lr ${LEARNING_RATE.toExponential(2)} | avg reward ${avgReward.toFixed(2)} | moving avg (${MOVING_WINDOW}) ${movingAvg.toFixed(2)} | batch avg reward ${batchAvgReward.toFixed(2)} batch loss ${batchLoss.toFixed(4)}`
      );
    }
    await yieldToEventLoop();
  }

  server.close();

  fs.mkdirSync(MODEL_SAVE_PATH, { recursive: true });
  await model.save(`file://${MODEL_SAVE_PATH}`);
  console.log(`Model saved to ${MODEL_SAVE_PATH}`);
  console.log(
    `Final average reward: ${(totalReward / NUM_GAMES).toFixed(2)}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
