import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { Device } from '@/models/Device';
import { Telemetry } from '@/models/Telemetry';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ chipId: string }> }
) {
  try {
    await dbConnect();
    const { chipId } = await context.params;
    const device = await Device.findOne({ chipId }).lean();
    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, device });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ chipId: string }> }
) {
  try {
    await dbConnect();
    const { chipId } = await context.params;
    await Device.deleteOne({ chipId });
    await Telemetry.deleteMany({ deviceChipId: chipId });
    return NextResponse.json({ success: true, message: `Device ${chipId} removed` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
