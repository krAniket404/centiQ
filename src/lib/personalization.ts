// src/lib/personalization.ts
import { ParsedTransaction } from './smsParser';

export interface UserLabel {
  txnFeatures: number[];
  isImpulsive: number; // 1 for Impulsive, 0 for Worth It
}

export class UserBehaviorModel {
  private weights: number[];
  private bias: number;
  private learningRate: number;
  public labelCount: number;

  constructor() {
    // 3 features: [HourNorm, IsWeekend, AmountZScore]
    this.weights = [0, 0, 0];
    this.bias = 0;
    this.learningRate = 0.1;
    this.labelCount = 0;
  }

  // Extract features from a transaction to feed into the ML model
  extractFeatures(txn: ParsedTransaction, userAvgAmount: number): number[] {
    const hour = txn.date.getHours();
    // Normalize hour to 0-1 range. Late night (10pm-6am) gets highest values.
    const hourNorm = (hour >= 22 || hour <= 6) ? 1.0 : (hour / 24);

    const isWeekend = (txn.date.getDay() === 0 || txn.date.getDay() === 6) ? 1.0 : 0.0;

    // Z-score: how much bigger is this purchase vs their normal spend?
    const amountZScore = userAvgAmount > 0 ? (txn.amount - userAvgAmount) / userAvgAmount : 0;

    return [hourNorm, isWeekend, amountZScore];
  }

  // Sigmoid function squashes any number into a 0 to 1 probability
  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  // Predict probability of impulsivity (0.0 to 1.0)
  predict(features: number[]): number {
    let z = this.bias;
    for (let i = 0; i < features.length; i++) {
      z += features[i] * this.weights[i];
    }
    return this.sigmoid(z);
  }

  // Train the model using Gradient Descent
  train(labels: UserLabel[]) {
    this.labelCount = labels.length;
    if (labels.length < 5) return; // Need at least 5 labels to start training safely

    for (let epoch = 0; epoch < 50; epoch++) { // 50 passes over the data
      labels.forEach(label => {
        const features = label.txnFeatures;
        const target = label.isImpulsive;
        const prediction = this.predict(features);
        const error = prediction - target;

        // Update weights and bias based on error
        for (let i = 0; i < this.weights.length; i++) {
          this.weights[i] -= this.learningRate * error * features[i];
        }
        this.bias -= this.learningRate * error;
      });
    }
  }

  // Export weights so we can save them to Supabase later
  getModel() {
    return { weights: this.weights, bias: this.bias, labelCount: this.labelCount };
  }
}
