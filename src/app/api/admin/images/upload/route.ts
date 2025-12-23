import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { uploadImage } from '@/lib/aws/s3';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);

  if (auth instanceof NextResponse) return auth; // unauthorized/err

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds maximum limit of 10MB' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const result = await uploadImage({
      file: buffer,
      fileName: file.name,
      contentType: file.type,
      folder: 'images', // Store in 'images' folder
    });

    return NextResponse.json({
      success: true,
      image: {
        key: result.key,
        url: result.url,
        contentType: result.contentType,
      },
    });
  } catch (err: any) {
    console.error('Error uploading image:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}

