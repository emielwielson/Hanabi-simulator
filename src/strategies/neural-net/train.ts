/**
 * Imitation learning: run games with an expert strategy, record (observation, action index), train model, save.
 * Run with: npx ts-node src/strategies/neural-net/train.ts (or npm run build && node dist/strategies/neural-net/train.js)
 */
import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs';
import type { Action } from '../../engine/actions';
import type { GameConfig } from '../../config';
import type { HanabiStrategy, Observation } from '../types';
import { HintPartnerStrategy } from '../hint-partner-strategy';
import { runSingleGame } from '../../simulator/runner';
import { createDefaultConfig } from '../../config';
import { encodeObservation, ENCODER_OUTPUT_SIZE } from './encoder';
import { createModel, OUTPUT_ACTION_SIZE } from './model';

const NUM_GAMES = 500;
const BATCH_SIZE = 32;
const EPOCHS = 10;
const MODEL_SAVE_PATH = path.resolve(process.cwd(), 'models/hanabi');

function actionEquals(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'play' && b.type === 'play') return a.cardIndex === b.cardIndex;
  if (a.type === 'discard' && b.type === 'discard') return a.cardIndex === b.cardIndex;
  if (a.type === 'hint' && b.type === 'hint') {
    return (
      a.targetPlayer === b.targetPlayer &&
      a.hintType === b.hintType &&
      a.hintValue === b.hintValue
    );
  }
  return false;
}

/** Wraps an expert strategy and records (encoded obs, legal action index) for each getAction. */
class RecordingStrategy implements HanabiStrategy {
  constructor(
    private expert: HanabiStrategy,
    private xs: number[][],
    private ys: number[]
  ) {}

  initialize(config: GameConfig, seatIndex: number): void {
    this.expert.initialize(config, seatIndex);
  }
  onGameStart(obs: Observation): void {
    this.expert.onGameStart(obs);
  }
  getAction(obs: Observation): Action {
    const legalActions = obs.legalActions ?? [];
    const action = this.expert.getAction(obs);
    const idx = legalActions.findIndex((la) => actionEquals(la, action));
    if (idx >= 0) {
      this.xs.push(encodeObservation(obs));
      this.ys.push(idx);
    }
    return action;
  }
  onActionResolved(ev: import('../../engine/events').GameEvent): void {
    this.expert.onActionResolved(ev);
  }
  onGameEnd(result: import('../../engine/events').FinalState): void {
    this.expert.onGameEnd(result);
  }
  clone(): HanabiStrategy {
    return new RecordingStrategy(this.expert.clone(), this.xs, this.ys);
  }
}

async function main(): Promise<void> {
  const config: GameConfig = createDefaultConfig({
    gameCount: NUM_GAMES,
    playerCount: 2,
  });
  const seeds = Array.from({ length: NUM_GAMES }, (_, i) => i);
  const xs: number[][] = [];
  const ys: number[] = [];

  const expert = new HintPartnerStrategy(42);
  const recording = new RecordingStrategy(expert, xs, ys);

  console.log(`Running ${NUM_GAMES} games with expert (HintPartner) to collect trajectories...`);
  for (const seed of seeds) {
    const clones = Array.from({ length: config.playerCount }, () => recording.clone());
    clones.forEach((c, i) => c.initialize(config, i));
    runSingleGame(seed, config, clones, { collectTrace: false, decisionTimes: [] });
  }
  console.log(`Collected ${xs.length} (observation, action_index) pairs.`);

  if (xs.length < BATCH_SIZE) {
    console.error('Not enough data. Run more games.');
    process.exit(1);
  }

  const model = createModel(ENCODER_OUTPUT_SIZE);
  model.compile({
    optimizer: tf.train.adam(1e-3),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  const xTensor = tf.tensor2d(xs, [xs.length, ENCODER_OUTPUT_SIZE], 'float32');
  const yOneHot = ys.map((idx) => {
    const row = new Array(OUTPUT_ACTION_SIZE).fill(0);
    if (idx >= 0 && idx < OUTPUT_ACTION_SIZE) row[idx] = 1;
    return row;
  });
  const yTensor = tf.tensor2d(yOneHot, [ys.length, OUTPUT_ACTION_SIZE], 'float32');

  await model.fit(xTensor, yTensor, {
    batchSize: BATCH_SIZE,
    epochs: EPOCHS,
    shuffle: true,
    validationSplit: 0.1,
  });

  xTensor.dispose();
  yTensor.dispose();

  fs.mkdirSync(MODEL_SAVE_PATH, { recursive: true });
  await model.save(`file://${MODEL_SAVE_PATH}`);
  console.log(`Model saved to ${MODEL_SAVE_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
