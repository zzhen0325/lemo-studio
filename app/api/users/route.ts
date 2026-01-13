import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), 'public', 'outputs', 'users.json');

// Helper to ensure directory exists
async function ensureDir() {
    const dir = path.dirname(USERS_FILE);
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

// Helper to read users
async function readUsers() {
    try {
        await fs.access(USERS_FILE);
        const content = await fs.readFile(USERS_FILE, 'utf-8');
        return JSON.parse(content);
    } catch {
        // Return default mock users if file doesn't exist
        return [
            { id: 'user-1', name: 'User 1', avatar: '/avatars/1.png', password: 'password' },
            { id: 'user-2', name: 'User 2', avatar: '/avatars/2.png', password: 'password' },
            { id: 'user-3', name: 'User 3', avatar: '/avatars/3.png', password: 'password' },
        ];
    }
}

// Helper to save users
async function saveUsers(users: any[]) {
    await ensureDir();
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('id');
        const users = await readUsers();

        if (userId) {
            const user = users.find((u: any) => u.id === userId);
            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            // Don't return password
            const { password, ...safeUser } = user;
            return NextResponse.json({ user: safeUser });
        }

        // Return all users (safe version)
        const safeUsers = users.map(({ password, ...u }: any) => u);
        return NextResponse.json({ users: safeUsers });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;
        const users = await readUsers();

        if (action === 'register') {
            const { username, password } = body;
            if (!username || !password) {
                return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
            }
            
            if (users.find((u: any) => u.name === username)) {
                return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
            }

            const newUser = {
                id: `user-${Date.now()}`,
                name: username,
                password, // In real app, hash this!
                avatar: `/avatars/${Math.floor(Math.random() * 5) + 1}.png`,
                createdAt: new Date().toISOString()
            };

            users.push(newUser);
            await saveUsers(users);

            const { password: _, ...safeUser } = newUser;
            return NextResponse.json({ user: safeUser });
        }

        if (action === 'login') {
            const { username, password } = body;
            const user = users.find((u: any) => u.name === username && u.password === password);
            
            if (!user) {
                return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
            }

            const { password: _, ...safeUser } = user;
            return NextResponse.json({ user: safeUser });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, avatar, password } = body;
        
        if (!id) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const users = await readUsers();
        const index = users.findIndex((u: any) => u.id === id);
        
        if (index === -1) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const updatedUser = { ...users[index] };
        if (name) updatedUser.name = name;
        if (avatar) updatedUser.avatar = avatar;
        if (password) updatedUser.password = password;

        users[index] = updatedUser;
        await saveUsers(users);

        const { password: _, ...safeUser } = updatedUser;
        return NextResponse.json({ user: safeUser });
    } catch (error) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
