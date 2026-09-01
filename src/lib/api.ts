import { getBackendUrl } from './socket';

export async function apiFetch(endpoint: string, options?: RequestInit): Promise<any> {
  const baseUrl = getBackendUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  return res.json();
}
