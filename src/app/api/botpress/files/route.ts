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
        const { searchParams } = new URL(req.url);
        const nextToken = searchParams.get('nextToken');

        const url = new URL(`${process.env.BOT_PRESS_CLOUD_API_URL}/v1/files`);
        url.searchParams.set('tags[source]', 'knowledge-base');
        if (nextToken) url.searchParams.set('nextToken', nextToken);

        console.log(url.toString());
        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'x-user-key': userKey,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.BOTPRESS_TOKEN}`,
                'x-bot-id': `${process.env.BOT_ID}`,
            },
        });
        const data = await res.json();
        console.log('===RESPONSE===', res.status, data);
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
        // Upsert mode: create/replace file and return uploadUrl
        if (body?.mode === 'upsert' && body?.payload) {
            const res = await fetch(`${process.env.BOT_PRESS_CLOUD_API_URL}/v1/files`, {
                method: 'PUT',
                headers: {
                    'x-user-key': userKey,
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.BOTPRESS_TOKEN}`,
                    'x-bot-id': `${process.env.BOT_ID}`,
                },
                body: JSON.stringify(body.payload),
            });
            const data = await res.json();
            if (!res.ok) {
                return NextResponse.json({ error: data.error || 'Failed to upsert file' }, { status: res.status });
            }
            return NextResponse.json(data);
        } else {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }


    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 