import mongoose, { Schema, Document, Model } from 'mongoose';

export type LoadType = 'PWM_LED' | 'RELAY' | 'SENSOR_DHT22' | 'SENSOR_ANALOG' | 'UNASSIGNED';

export interface ILoad {
  pin: number;
  type: LoadType;
  label: string;
  state: number;
}

export interface IPendingCommand {
  id: string;
  pin: number;
  action: 'set' | 'toggle';
  value?: number;
  createdAt: Date;
}

export interface IDevice extends Document {
  chipId: string;
  name: string;
  firmwareVersion: string;
  lastSeen: Date;
  localIp: string;
  registeredAt: Date;
  availablePins: number[];
  loads: ILoad[];
  pendingCommands: IPendingCommand[];
}

const LoadSchema = new Schema<ILoad>({
  pin: { type: Number, required: true },
  type: {
    type: String,
    enum: ['PWM_LED', 'RELAY', 'SENSOR_DHT22', 'SENSOR_ANALOG', 'UNASSIGNED'],
    default: 'UNASSIGNED',
  },
  label: { type: String, default: '' },
  state: { type: Number, default: 0 },
});

const PendingCommandSchema = new Schema<IPendingCommand>({
  id: { type: String, required: true },
  pin: { type: Number, required: true },
  action: { type: String, enum: ['set', 'toggle'], required: true },
  value: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const DeviceSchema = new Schema<IDevice>(
  {
    chipId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    firmwareVersion: { type: String, required: true },
    lastSeen: { type: Date, default: Date.now },
    localIp: { type: String, default: '' },
    registeredAt: { type: Date, default: Date.now },
    availablePins: { type: [Number], default: [] },
    loads: { type: [LoadSchema], default: [] },
    pendingCommands: { type: [PendingCommandSchema], default: [] },
  },
  { timestamps: true }
);

export const Device: Model<IDevice> =
  mongoose.models.Device || mongoose.model<IDevice>('Device', DeviceSchema);
