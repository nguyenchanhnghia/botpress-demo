import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const BOTPRESS_API_URL = 'https://api.botpress.cloud/v1';
const BOTPRESS_TOKEN = process.env.BOTPRESS_TOKEN;
const USER_SECRET = process.env.BOTPRESS_USER_SECRET || 'demo_secret';

function getUserKey(clientId: string) {
    return crypto.createHmac('sha256', USER_SECRET).update(clientId).digest('hex');
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const conversationId = searchParams.get('conversationId');
        const clientId = searchParams.get('clientId');
        const lastMessageId = searchParams.get('lastMessageId');

        if (!conversationId || !clientId) {
            return NextResponse.json(
                { error: 'ConversationId and clientId are required' },
                { status: 400 }
            );
        }

        const userKey = getUserKey(clientId);

        // Get messages from conversation
        const messagesResponse = await fetch(`${BOTPRESS_API_URL}/conversations/${conversationId}/messages`, {
            headers: {
                'Authorization': `Bearer ${BOTPRESS_TOKEN}`,
                'x-user-key': userKey,
            },
        });

        if (!messagesResponse.ok) {
            throw new Error('Failed to fetch messages');
        }

        const messages = await messagesResponse.json();

        // Filter for new bot messages
        const botMessages = messages
            .filter((msg: { direction: string; type: string; id: string }) =>
                msg.direction === 'out' &&
                msg.type === 'text' &&
                (!lastMessageId || msg.id > lastMessageId)
            )
            .map((msg: { payload: { text: string }; id: string }) => ({
                text: msg.payload.text,
                sender: 'bot' as const,
                id: msg.id,
            }));

        return NextResponse.json({
            newMessages: botMessages,
            lastMessageId: botMessages.length > 0 ? botMessages[botMessages.length - 1].id : lastMessageId,
        });

    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({
            newMessages: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
} 