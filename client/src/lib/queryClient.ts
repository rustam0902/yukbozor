import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Try to parse JSON error response and extract error message
    try {
      const json = JSON.parse(text);
      if (json.error) {
        // Throw only the clean error message, no status code prefix
        throw new Error(json.error);
      }
    } catch (e) {
      // If we already threw our clean error, re-throw it
      if (e instanceof Error && e.message && !e.message.startsWith('Unexpected') && !e.message.startsWith('JSON')) {
        throw e;
      }
      // JSON parsing failed - throw raw text
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

// Get current language from localStorage (must match key in language-context.tsx)
function getCurrentLanguage(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('yukbor_language') || 'ru';
  }
  return 'ru';
}

// Get representative mode customer ID from localStorage
export function getRepresentativeCustomerId(): string | null {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('yukbozor_representative_mode');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.active && parsed.customerId) {
          return String(parsed.customerId);
        }
      }
    } catch (e) {
      console.error('Failed to parse representative mode:', e);
    }
  }
  return null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const language = getCurrentLanguage();
  const headers: Record<string, string> = {
    'Accept-Language': language,
  };
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Add representative mode header if active
  const representativeCustomerId = getRepresentativeCustomerId();
  if (representativeCustomerId) {
    headers['X-Representative-Customer-Id'] = representativeCustomerId;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    
    // Add representative mode header if active for GET requests too
    const representativeCustomerId = getRepresentativeCustomerId();
    if (representativeCustomerId) {
      headers['X-Representative-Customer-Id'] = representativeCustomerId;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
