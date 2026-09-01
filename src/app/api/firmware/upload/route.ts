import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const saveAsDefault = formData.get('saveAsDefault') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No firmware file uploaded.' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.bin') && !file.name.endsWith('.elf')) {
      return NextResponse.json(
        { success: false, error: 'Only .bin binary files can be uploaded.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Path to public/firmware directory
    const firmwareDir = path.join(process.cwd(), 'public', 'firmware');

    // Target filename: if saveAsDefault is true, overwrite kolnhome_esp32.bin
    const targetFilename = saveAsDefault ? 'kolnhome_esp32.bin' : file.name;
    const filePath = path.join(firmwareDir, targetFilename);

    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      message: `Firmware uploaded successfully to public/firmware/${targetFilename}`,
      url: `/firmware/${targetFilename}`,
      filename: targetFilename,
      size: file.size,
    });
  } catch (error: any) {
    console.error('Error saving uploaded firmware:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save firmware file.' },
      { status: 500 }
    );
  }
}
