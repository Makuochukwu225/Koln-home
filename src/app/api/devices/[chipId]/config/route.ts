import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { Device } from '@/models/Device';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ chipId: string }> }
) {
  try {
    await dbConnect();
    const { chipId } = await context.params;
    const device = await Device.findOne({ chipId });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Refresh lastSeen timestamp upon every poll
    device.lastSeen = new Date();

    // Extract pending commands and flush queue
    const pendingCommands = [...device.pendingCommands];
    device.pendingCommands = [];
    await device.save();

    return NextResponse.json({
      loads: device.loads,
      pendingCommands,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
