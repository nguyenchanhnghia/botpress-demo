import { NextRequest, NextResponse } from 'next/server';

function getUserKey(req: NextRequest): string | undefined {
    return req.cookies.get('x-user-key')?.value || req.headers.get('x-user-key') || process.env.BOTPRESS_USER_KEY;
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userKey = getUserKey(req);
    if (!userKey) {
        return NextResponse.json({ error: 'Missing x-user-key' }, { status: 401 });
    }
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
        }
        const res = await fetch(`${process.env.BOT_PRESS_CLOUD_API_URL}/v1/files/${id}`, {
            method: 'DELETE',
            headers: {
                'x-user-key': userKey,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.BOTPRESS_TOKEN}`,
                'x-bot-id': `${process.env.BOT_ID}`,
            },
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return NextResponse.json({ error: data.error || 'Failed to delete file' }, { status: res.status });
        }
        return NextResponse.json({});
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
