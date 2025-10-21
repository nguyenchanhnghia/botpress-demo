import React, { useState } from 'react';
import { authenticateUser } from '@/lib/auth';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useRouter } from 'next/navigation';
import { useUser } from './UserContext';

export function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const { setUser } = useUser();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const result = await authenticateUser(username, password);
            if (result) {
                setUser(result.user);
                router.push('/admin-cms');
            } else {
                setError('Invalid username or password');
            }
        } catch (err: any) {
            setError(err?.message || 'An error occurred during login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700">Username</label>
                <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    disabled={isLoading}
                    placeholder="Enter your username"
                />
            </div>
            <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">Password</label>
                <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="Enter your password"
                />
            </div>
            {error && <div className="p-2 text-sm text-red-700 bg-red-100/80 rounded-xl border border-red-200/50">{error}</div>}
            <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
        </form>
    );
} 