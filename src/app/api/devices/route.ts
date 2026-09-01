import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { Device } from '@/models/Device';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbConnect();
    const devices = await Device.find({}).sort({ lastSeen: -1 }).lean();
    return NextResponse.json({ success: true, devices });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
