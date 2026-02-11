import { env } from '$env/dynamic/private';

interface FetchOptions {
  method?: string;
  body?: unknown;
}

export async function railsApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const response = await fetch(`${env.RAILS_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RAILS_API_KEY}`
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`Rails API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
