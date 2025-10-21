import { NextRequest, NextResponse } from 'next/server';


function getUserKey(req: NextRequest): string | undefined {
    return req.cookies.get('x-user-key')?.value || req.headers.get('x-user-key') || process.env.BOTPRESS_USER_KEY;
}

export async function GET(req: NextRequest) {
    const userKey = getUserKey(req);
    if (!userKey) {
        return NextResponse.json({ error: 'Missing x-user-key' }, { status: 401 });
    }
    try {
        console.log('process.env.BOT_PRESS_API_URL', process.env.BOT_PRESS_API_URL);
        const res = await fetch(`${process.env.BOT_PRESS_API_URL}/v1/files?tags.source=knowledge-base`, {
            method: 'GET',
            headers: {
                'x-user-key': userKey,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.BOTPRESS_TOKEN}`,
                'x-bot-id': `${process.env.BOT_ID}`,
            },
        });
        const data = await res.json();
        console.log('data', data);
        if (!res.ok) {
            return NextResponse.json({ error: data.error || 'Failed to fetch files' }, { status: res.status });
        }
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const userKey = getUserKey(req);
    if (!userKey) {
        return NextResponse.json({ error: 'Missing x-user-key' }, { status: 401 });
    }
    try {
        const body = await req.json();
        console.log('body', body);
        const res = await fetch(`${process.env.BOT_PRESS_API_URL}/v1/files/${body.id}`, {
            method: 'PUT',
            headers: {
                'x-user-key': userKey,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.BOTPRESS_TOKEN}`,
                'x-bot-id': `${process.env.BOT_ID}`,
            },
            body: JSON.stringify(body.data),
        });
        const data = await res.json();
        console.log('data', data);
        if (!res.ok) {
            return NextResponse.json({ error: data.error || 'Failed to update file' }, { status: res.status });
        }
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 