import * as tf from '@tensorflow/tfjs-node';
import type { Action } from '../engine/actions';
import { getLegalActionsFromObservation } from '../engine/actions';
import type { HanabiStrategy, Observation } from './types';
import { getDeterministicRandom } from './observation-rng';
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
  private model: LayersModel | null = null;
  private readonly rngSeed: number;
  private readonly modelPath: string;

  constructor(rngSeed = 42, modelPath?: string) {
    this.rngSeed = rngSeed;
    this.modelPath = modelPath ?? process.env.HANABI_MODEL_PATH ?? DEFAULT_MODEL_PATH;
    loadModel(this.modelPath).then((m) => (this.model = m)).catch(() => (this.model = null));
  }

  getAction(observation: Observation): Action {
    const legalActions = getLegalActionsFromObservation(observation);
    if (legalActions.length === 0) {
      if (observation.ownHandSize > 0 && observation.hintsRemaining < 8) {
        return { type: 'discard', cardIndex: 0 };
      }
      return { type: 'play', cardIndex: 0 };
    }

    if (this.model === null) {
      return this.randomLegalAction(legalActions, observation);
    }
    return this.inferAction(observation, legalActions);
  }

  private inferAction(observation: Observation, legalActions: Action[]): Action {
    const encoded = encodeObservation(observation);
    if (encoded.length !== ENCODER_OUTPUT_SIZE) {
      return this.randomLegalAction(legalActions, observation);
    }
    try {
      const input = tf.tensor2d([encoded], [1, ENCODER_OUTPUT_SIZE]);
      const logitsTensor = this.model!.predict(input) as tf.Tensor;
      const numActions = Math.min(legalActions.length, OUTPUT_ACTION_SIZE);
      const logitsArr = new Float32Array(numActions);
      const fullData = logitsTensor.dataSync();
      for (let i = 0; i < numActions; i++) {
        logitsArr[i] = fullData[i];
      }
      input.dispose();
      logitsTensor.dispose();

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
      return this.randomLegalAction(legalActions, observation);
    }
  }

  private randomLegalAction(legalActions: Action[], observation: Observation): Action {
    const r = getDeterministicRandom(observation, this.rngSeed);
    const idx = Math.floor(r * legalActions.length);
    return { ...legalActions[idx] };
  }
}
