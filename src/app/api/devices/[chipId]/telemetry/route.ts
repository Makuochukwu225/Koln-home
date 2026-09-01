import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { Telemetry } from '@/models/Telemetry';
import { Device } from '@/models/Device';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ chipId: string }> }
) {
  try {
    await dbConnect();
    const { chipId } = await context.params;
    const { pin, value } = await req.json();

    if (pin === undefined || value === undefined) {
      return NextResponse.json({ success: false, error: 'Missing pin or value' }, { status: 400 });
    }

    const reading = await Telemetry.create({
      deviceChipId: chipId,
      pin: Number(pin),
      value: Number(value),
      timestamp: new Date(),
    });

    // Update state in Device document
    await Device.updateOne(
      { chipId, 'loads.pin': Number(pin) },
      {
        $set: {
          'loads.$.state': Number(value),
          lastSeen: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true, reading });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ chipId: string }> }
) {
  try {
    await dbConnect();
    const { chipId } = await context.params;
    const url = new URL(req.url);
    const pin = url.searchParams.get('pin');
    const since = url.searchParams.get('since');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const query: any = { deviceChipId: chipId };
    if (pin) query.pin = parseInt(pin, 10);
    if (since) query.timestamp = { $gte: new Date(since) };

    const telemetry = await Telemetry.find(query)
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, telemetry });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
