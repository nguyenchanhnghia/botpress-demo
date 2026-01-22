import { v4 as uuidv4 } from 'uuid';
import { getItem, putItem, queryItems, deleteItem } from './dynamo';

/**
 * Users service - small CRUD helpers for user records in DynamoDB.
 *
 * Assumptions (configurable via env):
 * - USERS_TABLE: DynamoDB table name that stores user records (default: 'Users')
 * - USERS_EMAIL_INDEX: (optional) GSI name where 'email' is the partition key to allow fast lookup by email
 *
 * Item shape assumed:
 * {
 *   id: string,          // PK
 *   email?: string,
 *   displayName?: string,
 *   ...other attributes
 * }
 */

const USERS_TABLE = process.env.USERS_TABLE || 'vz-users-botpress';
const USERS_EMAIL_INDEX = process.env.USERS_EMAIL_INDEX || process.env.USERS_EMAIL_GSI || 'gsi_email';
// Primary key attribute name in the DynamoDB table. Some tables use 'id', others 'user_id' etc.
const USERS_TABLE_PK = process.env.USERS_TABLE_PK || process.env.USERS_TABLE_PK_NAME || 'user_id';

export type UserRecord = {
    id: string;
    email?: string;
    displayName?: string;
    role?: string;
    [key: string]: any;
};

const Users = {
    /**
     * Find user by email. Requires a GSI on `email` named by USERS_EMAIL_INDEX.
     * Falls back to a scan if no index is available (less efficient).
     */
    async findByEmail(email: string): Promise<UserRecord | null> {
        if (!email) return null;

        try {
            // Try query using GSI
            const params = {
                TableName: USERS_TABLE,
                IndexName: USERS_EMAIL_INDEX,
                KeyConditionExpression: '#email = :email',
                ExpressionAttributeNames: { '#email': 'email' },
                ExpressionAttributeValues: { ':email': email },
                Limit: 1,
            } as any;

            const items = await queryItems<UserRecord>(params);
            console.log('items', items);
            if (!items?.[0]) return null;
            return await Users.findById(items[0].user_id);

        } catch (err) {
            // If query fails (no index) or permission/credential error, do not perform a full table scan here.
            const msg = (err as Error).message || String(err);
            console.warn('Users.findByEmail: query failed; returning null (no scan). Error:', msg);
            // Caller should fallback to Botpress/default behavior when DB lookup is not available.
            return null;
        }

        return null;
    },

    async findById(id: string): Promise<UserRecord | null> {
        if (!id) return null;
        const key: Record<string, any> = {};
        key[USERS_TABLE_PK] = id;
        const item = await getItem<UserRecord>(USERS_TABLE, key);
        return item;
    },

    async create(user: Partial<UserRecord> & { email?: string }): Promise<UserRecord> {
        // Ensure we write the table's primary key attribute (USERS_TABLE_PK)
        const id = (user as any).id || (user as any)[USERS_TABLE_PK] || uuidv4();
        const record: UserRecord = { ...(user as any) } as UserRecord;
        // Set both common 'id' and the table PK to be safe for different schemas
        record.id = id;
        (record as any)[USERS_TABLE_PK] = id;
        await putItem(USERS_TABLE, record);
        return record;
    },

    /**
     * Update user by replacing attributes (put). If you want partial update, call findById, merge and create.
     */
    async update(id: string, updates: Partial<UserRecord>): Promise<UserRecord> {
        if (!id) throw new Error('id required');
        const existing = await Users.findById(id);
        if (!existing) throw new Error('User not found');
        const merged = { ...existing, ...updates } as UserRecord;
        await putItem(USERS_TABLE, merged);
        return merged;
    },

    /**
     * List users by scanning the table. Use sparingly on very large tables.
     */
    async list(limit?: number): Promise<UserRecord[]> {
        const params: any = { TableName: USERS_TABLE };
        if (typeof limit === 'number') params.Limit = limit;
        const items = await import('./dynamo').then(m => m.scanTable<UserRecord>(params));
        return items || [];
    },

    async delete(id: string): Promise<void> {
        if (!id) throw new Error('id required');
        const key: Record<string, any> = {};
        key[USERS_TABLE_PK] = id;
        await deleteItem(USERS_TABLE, key);
    }
};

export default Users;
