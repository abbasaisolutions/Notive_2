import { API_URL } from '@/constants/config';

export const resolveApiRequestUrl = (path: string) =>
    path.startsWith('http')
        ? path
        : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

export async function readResponseJson<T = any>(response: Response): Promise<T | null> {
    try {
        return await response.json() as T;
    } catch {
        return null;
    }
}
