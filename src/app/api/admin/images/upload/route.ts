import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { uploadImage } from '@/lib/aws/s3';
import Users from '@/lib/aws/users';
import Files from '@/lib/aws/files';
import { ADMIN_ROLES } from '@/lib/constants/roles';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_FILE_SIZE } from '@/lib/constants/common';

async function checkAdminAccess(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth; // unauthorized/err

  const requesterEmail = (auth as any).email;
  if (!requesterEmail) {
    return NextResponse.json({ error: 'Forbidden - missing email' }, { status: 403 });
  }

  const requesterRecord = await Users.findByEmail(requesterEmail);
  const role = requesterRecord?.role;
  if (!requesterRecord || !ADMIN_ROLES.includes(role as any)) {
    return NextResponse.json({ error: 'Forbidden - admin or super-admin required' }, { status: 403 });
  }

  return { requesterEmail }; // Return email for use in upload
}

export async function POST(req: NextRequest) {
  const adminCheck = await checkAdminAccess(req);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { requesterEmail } = adminCheck;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type (images only)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_IMAGE_FILE_SIZE) {
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
      folder: 'botpress', // Store in 'botpress' folder
    });

    // Save file record to DynamoDB
    const fileRecord = await Files.create({
      key: result.key,
      url: result.url,
      contentType: result.contentType,
      fileName: file.name,
      fileSize: file.size,
      folder: 'botpress',
      uploadedBy: requesterEmail,
    });

    return NextResponse.json({
      success: true,
      image: {
        id: fileRecord.id,
        key: result.key,
        url: result.url,
        contentType: result.contentType,
        fileName: fileRecord.fileName,
        fileSize: fileRecord.fileSize,
        folder: fileRecord.folder,
        uploadedAt: fileRecord.uploadedAt,
        uploadedBy: fileRecord.uploadedBy,
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

