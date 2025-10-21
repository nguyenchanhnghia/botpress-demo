
export interface Role {
    _id: string;
    name: string;
    description?: string;
    permissions?: string[];
    createdAt: Date;
} 