import { env } from '$env/dynamic/private';

interface FetchOptions {
  method?: string;
  body?: unknown;
}

export async function railsApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const separator = path.includes('?') ? '&' : '?';
  const url = `${env.RAILS_API_URL}${path}${separator}access_token=${env.RAILS_API_ACCESS_TOKEN}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`Rails API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
