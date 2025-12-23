import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getPresignedUrl, getPresignedUrls } from '@/lib/aws/s3';

/**
 * GET /api/admin/images/presigned-url?key=image-key
 * or POST with body: { key: string } or { keys: string[] }
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);

  if (auth instanceof NextResponse) return auth; // unauthorized/err

  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600', 10);

    if (!key) {
      return NextResponse.json({ error: 'Key parameter is required' }, { status: 400 });
    }

    const url = await getPresignedUrl(key, expiresIn);

    return NextResponse.json({
      success: true,
      url,
      key,
      expiresIn,
    });
  } catch (err: any) {
    console.error('Error generating presigned URL:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);

  if (auth instanceof NextResponse) return auth; // unauthorized/err

  try {
    const body = await req.json();
    const { key, keys, expiresIn = 3600 } = body;

    if (keys && Array.isArray(keys)) {
      // Multiple keys
      const urls = await getPresignedUrls(keys, expiresIn);
      return NextResponse.json({
        success: true,
        urls,
        expiresIn,
      });
    } else if (key) {
      // Single key
      const url = await getPresignedUrl(key, expiresIn);
      return NextResponse.json({
        success: true,
        url,
        key,
        expiresIn,
      });
    } else {
      return NextResponse.json(
        { error: 'Either "key" or "keys" parameter is required' },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error('Error generating presigned URL:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}

