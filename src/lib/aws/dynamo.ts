import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

// Lightweight wrapper for DynamoDB Document client with common reusable helpers.
// Reads configuration from env vars:
// - AWS_REGION (required)
// - DYNAMODB_ENDPOINT (optional, for local testing e.g. http://localhost:8000)

const region = process.env.AWS_REGION || "ap-southeast-1";
const endpoint = process.env.DYNAMODB_ENDPOINT || undefined;

let docClient: DynamoDBDocumentClient | null = null;

function getDocClient() {
    if (docClient) return docClient;
    console.log('region', region);
    console.log('endpoint', endpoint);
    const client = new DynamoDBClient({
        region,
        ...(endpoint ? { endpoint } : {})
    });

    docClient = DynamoDBDocumentClient.from(client, {
        marshallOptions: {
            // remove undefined values and do not convert empty strings
            removeUndefinedValues: true,
            convertEmptyValues: false,
        },
        unmarshallOptions: {
            wrapNumbers: false,
        }
    });

    return docClient;
}

// Common helper: get item by primary key
export async function getItem<T = any>(tableName: string, key: Record<string, any>): Promise<T | null> {
    const client = getDocClient();
    const cmd = new GetCommand({ TableName: tableName, Key: key });
    const res = await client.send(cmd);
    return (res.Item as T) ?? null;
}

// Common helper: put item (overwrite)
export async function putItem<T extends Record<string, any> = any>(tableName: string, item: T): Promise<void> {
    const client = getDocClient();
    const cmd = new PutCommand({ TableName: tableName, Item: item as Record<string, any> });
    await client.send(cmd);
}

// Common helper: query items by key condition (expects KeyConditionExpression style params)
export async function queryItems<T = any>(params: {
    TableName: string;
    IndexName?: string;
    KeyConditionExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, any>;
    Limit?: number;
    ScanIndexForward?: boolean;
}): Promise<T[]> {
    const client = getDocClient();
    const cmd = new QueryCommand(params as any);
    const res = await client.send(cmd);
    return (res.Items as T[]) || [];
}

// Convenience: scan (use sparingly)
export async function scanTable<T = any>(params: { TableName: string; Limit?: number }): Promise<T[]> {
    const client = getDocClient();
    const cmd = new ScanCommand(params as any);
    const res = await client.send(cmd);
    return (res.Items as T[]) || [];
}

// Common helper: delete item by primary key
export async function deleteItem(tableName: string, key: Record<string, any>): Promise<void> {
    const client = getDocClient();
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    const cmd = new DeleteCommand({ TableName: tableName, Key: key });
    await client.send(cmd as any);
}

export function initDynamoForTests(opts: { region?: string; endpoint?: string }) {
    // override during runtime (useful for local dev)
    if (opts.region) process.env.AWS_REGION = opts.region;
    if (opts.endpoint) process.env.DYNAMODB_ENDPOINT = opts.endpoint;
    // reset client so next call rebuilds with new config
    docClient = null;
}

const dynamo = {
    getItem,
    putItem,
    queryItems,
    scanTable,
    initDynamoForTests,
};

export default dynamo;
