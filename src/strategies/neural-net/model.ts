import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import { ENCODER_OUTPUT_SIZE } from './encoder';

/** Max legal actions (5 play + 5 discard + 4*10 hints). Training/inference may pass only play+hint (no discard), so effective max is 45. */
export const OUTPUT_ACTION_SIZE = 50;

/**
 * Build Actor-Critic: shared backbone, policy head (actor) and value head (critic).
 * Input shape must match ENCODER_OUTPUT_SIZE. Shared backbone: Dense(128, relu).
 * predict(x) returns [policyTensor (batch, 50), valueTensor (batch, 1)].
 */
export function createModel(inputDim: number): tf.LayersModel {
  if (inputDim !== ENCODER_OUTPUT_SIZE) {
    throw new Error(
      `Model inputDim ${inputDim} must match ENCODER_OUTPUT_SIZE ${ENCODER_OUTPUT_SIZE}`
    );
  }
  const input = tf.input({ shape: [inputDim] });
  const backbone = tf.layers
    .dense({ units: 128, activation: 'relu' })
    .apply(input) as tf.SymbolicTensor;
  const policyOut = tf.layers
    .dense({ units: OUTPUT_ACTION_SIZE, activation: 'softmax' })
    .apply(backbone) as tf.SymbolicTensor;
  const valueOut = tf.layers.dense({ units: 1 }).apply(backbone) as tf.SymbolicTensor;
  return tf.model({ inputs: input, outputs: [policyOut, valueOut] });
}

/**
 * Load a saved model from the given path (directory containing model.json, or full path to model.json).
 * Path can be absolute or relative. Loaded model has two outputs: [policy, value].
 */
export async function loadModel(modelPath: string): Promise<tf.LayersModel> {
  const normalized = modelPath.endsWith('.json') ? modelPath : `${modelPath.replace(/\/$/, '')}/model.json`;
  const url = normalized.startsWith('file://') ? normalized : `file://${path.resolve(normalized)}`;
  return tf.loadLayersModel(url);
}
