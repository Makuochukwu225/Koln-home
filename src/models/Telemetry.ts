import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITelemetry extends Document {
  deviceChipId: string;
  pin: number;
  value: number;
  timestamp: Date;
}

const TelemetrySchema = new Schema<ITelemetry>({
  deviceChipId: { type: String, required: true, index: true },
  pin: { type: Number, required: true },
  value: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
});

// Compound index for fast time-series queries
TelemetrySchema.index({ deviceChipId: 1, pin: 1, timestamp: -1 });

export const Telemetry: Model<ITelemetry> =
  mongoose.models.Telemetry || mongoose.model<ITelemetry>('Telemetry', TelemetrySchema);
