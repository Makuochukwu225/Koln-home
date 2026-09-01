import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { Device } from '@/models/Device';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ chipId: string; pin: string }> }
) {
  try {
    await dbConnect();
    const { chipId, pin } = await context.params;
    const pinNumber = parseInt(pin, 10);
    const body = await req.json();
    const { type, label } = body;

    const device = await Device.findOne({ chipId });
    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 });
    }

    const loadIndex = device.loads.findIndex((l) => l.pin === pinNumber);
    if (loadIndex === -1) {
      device.loads.push({
        pin: pinNumber,
        type: type || 'UNASSIGNED',
        label: label || `GPIO ${pinNumber}`,
        state: 0,
      });
    } else {
      if (type !== undefined) device.loads[loadIndex].type = type;
      if (label !== undefined) device.loads[loadIndex].label = label;
    }

    await device.save();
    return NextResponse.json({ success: true, device });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
