
export interface User {
    _id: string;
    username: string;
    passwordHash: string;
    role: string; // or string if not migrated
    email?: string;
    createdAt: Date;
    accessToken?: string;
} 