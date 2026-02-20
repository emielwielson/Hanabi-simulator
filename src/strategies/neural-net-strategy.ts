import * as tf from '@tensorflow/tfjs-node';
import { createSeededRNG } from '../engine/seeded-rng';
import type { GameConfig } from '../config';
import type { Action } from '../engine/actions';
import type { HanabiStrategy, Observation } from './types';
import { encodeObservation, ENCODER_OUTPUT_SIZE } from './neural-net/encoder';
import { loadModel, OUTPUT_ACTION_SIZE } from './neural-net/model';
import type { LayersModel } from '@tensorflow/tfjs-node';

const DEFAULT_MODEL_PATH = './models/hanabi';

/**
 * Strategy that uses a neural network to map observation to action.
 * Loads model from HANABI_MODEL_PATH or default ./models/hanabi (async, fire-and-forget in constructor).
 * Until load completes or if load fails, falls back to random legal action.
 */
export class NeuralNetStrategy implements HanabiStrategy {
  private config: GameConfig | null = null;
  private seatIndex = 0;
  private rng: (() => number) | null = null;
  private rngSeed: number;
  private modelPath: string;
  private model: LayersModel | null = null;

  constructor(rngSeed = 42, modelPath?: string) {
    this.rngSeed = rngSeed;
    this.modelPath = modelPath ?? process.env.HANABI_MODEL_PATH ?? DEFAULT_MODEL_PATH;
    loadModel(this.modelPath).then((m) => (this.model = m)).catch(() => (this.model = null));
  }

  initialize(config: GameConfig, seatIndex: number): void {
    this.config = config;
    this.seatIndex = seatIndex;
    this.rng = createSeededRNG(this.rngSeed + seatIndex);
  }

  onGameStart(_observation: Observation): void {
    // No-op
  }

  getAction(observation: Observation): Action {
    const legalActions = observation.legalActions;
    if (!legalActions || legalActions.length === 0) {
      if (observation.ownHandSize > 0 && observation.hintsRemaining < 8) {
        return { type: 'discard', cardIndex: 0 };
      }
      return { type: 'play', cardIndex: 0 };
    }

    // Synchronous getAction: run inference synchronously if model already loaded; otherwise fallback
    if (this.model === null) {
      return this.randomLegalAction(legalActions);
    }
    return this.inferAction(observation, legalActions);
  }

  private inferAction(observation: Observation, legalActions: Action[]): Action {
    const encoded = encodeObservation(observation);
    if (encoded.length !== ENCODER_OUTPUT_SIZE) {
      return this.randomLegalAction(legalActions);
    }
    try {
      const input = tf.tensor2d([encoded], [1, ENCODER_OUTPUT_SIZE]);
      const logitsTensor = this.model!.predict(input) as tf.Tensor;
      const numActions = Math.min(legalActions.length, OUTPUT_ACTION_SIZE);
      const logitsArr = new Float32Array(numActions);
      // Sync data copy - TF.js has dataSync() for synchronous read
      const fullData = logitsTensor.dataSync();
      for (let i = 0; i < numActions; i++) {
        logitsArr[i] = fullData[i];
      }
      input.dispose();
      logitsTensor.dispose();

      // Mask: only consider first numActions logits; argmax
      let bestIdx = 0;
      let bestVal = logitsArr[0];
      for (let i = 1; i < numActions; i++) {
        if (logitsArr[i] > bestVal) {
          bestVal = logitsArr[i];
          bestIdx = i;
        }
      }
      return { ...legalActions[bestIdx] };
    } catch {
      return this.randomLegalAction(legalActions);
    }
  }

  private randomLegalAction(legalActions: Action[]): Action {
    if (!this.rng) throw new Error('Strategy not initialized');
    const idx = Math.floor(this.rng() * legalActions.length);
    return { ...legalActions[idx] };
  }

  onActionResolved(_event: import('../engine/events').GameEvent): void {
    // No-op
  }

  onGameEnd(_result: import('../engine/events').FinalState): void {
    // No-op
  }

  clone(): HanabiStrategy {
    return new NeuralNetStrategy(this.rngSeed, this.modelPath);
  }
}
