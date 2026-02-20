import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import { ENCODER_OUTPUT_SIZE } from './encoder';

/** Max legal actions (5 play + 5 discard + 4*10 hints). */
export const OUTPUT_ACTION_SIZE = 50;

/**
 * Build a small MLP: input (inputDim) -> dense 128 relu -> dense 64 relu -> dense 50.
 * Input shape must match ENCODER_OUTPUT_SIZE.
 */
export function createModel(inputDim: number): tf.LayersModel {
  if (inputDim !== ENCODER_OUTPUT_SIZE) {
    throw new Error(
      `Model inputDim ${inputDim} must match ENCODER_OUTPUT_SIZE ${ENCODER_OUTPUT_SIZE}`
    );
  }
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      inputShape: [inputDim],
      units: 128,
      activation: 'relu',
    })
  );
  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'relu',
    })
  );
  model.add(
    tf.layers.dense({
      units: OUTPUT_ACTION_SIZE,
      activation: 'softmax',
    })
  );
  return model;
}

/**
 * Load a saved model from the given path (directory containing model.json, or full path to model.json).
 * Path can be absolute or relative.
 */
export async function loadModel(modelPath: string): Promise<tf.LayersModel> {
  const normalized = modelPath.endsWith('.json') ? modelPath : `${modelPath.replace(/\/$/, '')}/model.json`;
  const url = normalized.startsWith('file://') ? normalized : `file://${path.resolve(normalized)}`;
  return tf.loadLayersModel(url);
}
