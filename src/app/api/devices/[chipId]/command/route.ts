import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { Device } from '@/models/Device';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ chipId: string }> }
) {
  try {
    await dbConnect();
    const { chipId } = await context.params;
    const { pin, action, value } = await req.json();

    if (pin === undefined || !action) {
      return NextResponse.json({ success: false, error: 'Missing pin or action' }, { status: 400 });
    }

    const device = await Device.findOne({ chipId });
    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 });
    }

    // 1. Update optimistic state in DB
    const load = device.loads.find((l) => l.pin === pin);
    if (load) {
      if (action === 'toggle') {
        load.state = load.state > 0.5 ? 0 : 1;
      } else if (action === 'set') {
        load.state = Number(value);
      }
    }

    // 2. Optional direct LAN proxy enhancement (with 1.5s timeout)
    let lanProxySucceeded = false;
    if (device.localIp) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const endpoint = action === 'toggle' 
          ? `http://${device.localIp}/toggle?pin=${pin}`
          : `http://${device.localIp}/set?pin=${pin}&value=${value}`;

        const res = await fetch(endpoint, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          lanProxySucceeded = true;
        }
      } catch {
        // LAN proxy failed (likely cloud or different subnet), proceed to queue fallback
      }
    }

    // 3. If LAN proxy was not successful, push command to queue for polling baseline
    if (!lanProxySucceeded) {
      device.pendingCommands.push({
        id: Math.random().toString(36).substring(2, 9),
        pin,
        action,
        value: Number(value || 0),
        createdAt: new Date(),
      });
    }

    await device.save();

    return NextResponse.json({
      success: true,
      relayedVia: lanProxySucceeded ? 'direct_lan' : 'poll_queue',
      device,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
