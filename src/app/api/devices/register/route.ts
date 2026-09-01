import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { Device, ILoad } from '@/models/Device';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { chipId, name, firmwareVersion, localIp, availablePins } = body;

    if (!chipId) {
      return NextResponse.json({ success: false, error: 'chipId is required' }, { status: 400 });
    }

    let device = await Device.findOne({ chipId });

    if (!device) {
      // First-time registration: populate loads array with unassigned pins
      const initialLoads: ILoad[] = (availablePins || []).map((pin: number) => ({
        pin,
        type: 'UNASSIGNED',
        label: `GPIO ${pin}`,
        state: 0,
      }));

      device = await Device.create({
        chipId,
        name: name || `ESP32-${chipId.slice(-4)}`,
        firmwareVersion: firmwareVersion || '1.0.0',
        localIp: localIp || '',
        availablePins: availablePins || [],
        loads: initialLoads,
        lastSeen: new Date(),
        registeredAt: new Date(),
      });
    } else {
      // Upsert: update runtime fields while preserving user's configured load mappings
      device.lastSeen = new Date();
      if (localIp) device.localIp = localIp;
      if (firmwareVersion) device.firmwareVersion = firmwareVersion;
      if (name && !device.name) device.name = name;

      // Add any new pins that might have been detected
      if (availablePins && Array.isArray(availablePins)) {
        const existingPinSet = new Set(device.loads.map((l) => l.pin));
        availablePins.forEach((pin: number) => {
          if (!existingPinSet.has(pin)) {
            device!.loads.push({
              pin,
              type: 'UNASSIGNED',
              label: `GPIO ${pin}`,
              state: 0,
            });
          }
        });
        device.availablePins = availablePins;
      }

      await device.save();
    }

    return NextResponse.json({ success: true, device });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
