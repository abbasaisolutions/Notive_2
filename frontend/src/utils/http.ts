export async function getErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const data = await response.json();
        if (typeof data?.message === 'string' && data.message.trim()) {
            return data.message;
        }
    } catch {
        // ignore parse errors and use fallback
    }
    return fallback;
}
