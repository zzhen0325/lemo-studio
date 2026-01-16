export function getApiBase(): string {
    return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api';
}
