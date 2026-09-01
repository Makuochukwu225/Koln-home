import { NextResponse } from 'next/server';
import { readdir, stat, unlink } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const FIRMWARE_DIR = path.join(process.cwd(), 'public', 'firmware');

export async function GET() {
  try {
    const files = await readdir(FIRMWARE_DIR);

    const firmwareFiles = await Promise.all(
      files
        .filter((file) => file.endsWith('.bin'))
        .map(async (filename) => {
          const filePath = path.join(FIRMWARE_DIR, filename);
          const fileStat = await stat(filePath);

          return {
            filename,
            size: fileStat.size,
            modifiedAt: fileStat.mtime.toISOString(),
            isDefault: filename === 'kolnhome_esp32.bin',
            url: `/firmware/${filename}`,
          };
        })
    );

    // Sort default first, then alphabetically
    firmwareFiles.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.filename.localeCompare(b.filename);
    });

    return NextResponse.json({ success: true, firmware: firmwareFiles });
  } catch (error: any) {
    console.error('Error listing firmware files:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list firmware files.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Filename parameter is required.' },
        { status: 400 }
      );
    }

    // Security check to prevent directory traversal
    const safeFilename = path.basename(filename);
    if (!safeFilename.endsWith('.bin')) {
      return NextResponse.json(
        { success: false, error: 'Invalid firmware filename.' },
        { status: 400 }
      );
    }

    const filePath = path.join(FIRMWARE_DIR, safeFilename);
    await unlink(filePath);

    return NextResponse.json({
      success: true,
      message: `Firmware file ${safeFilename} deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting firmware file:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete firmware file.' },
      { status: 500 }
    );
  }
}
