import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Handle different types of webhook events
        switch (body.type) {
            case 'message':
                console.log('Message event:', body.payload);
                break;
            case 'conversation_started':
                console.log('Conversation started:', body.payload);
                break;
            case 'conversation_ended':
                console.log('Conversation ended:', body.payload);
                break;
            default:
                console.log('Unknown event type:', body.type);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ message: 'Botpress webhook endpoint is active' });
} 