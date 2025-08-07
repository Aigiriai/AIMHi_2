import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`🌐 API REQUEST: ${method} ${url}`, data ? { data } : '');
  
  // Temporarily use Node.js backend until Python server is properly configured
  const backendUrl = url;
  
  const requestBody = data ? JSON.stringify(data) : undefined;
  if (requestBody) {
    console.log(`🌐 API REQUEST: Body:`, requestBody);
  }
  
  try {
    const res = await fetch(backendUrl, {
      method,
      headers: {
        ...getAuthHeaders(),
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      body: requestBody,
      credentials: "include",
    });

    console.log(`🌐 API RESPONSE: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ API ERROR: ${res.status}`, errorText);
      await throwIfResNotOk(res);
    }
    
    console.log(`✅ API SUCCESS: ${method} ${url}`);
    return res;
  } catch (error) {
    console.error(`❌ API REQUEST FAILED: ${method} ${url}`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Temporarily use Node.js backend until Python server is properly configured
    const url = queryKey[0] as string;
    const backendUrl = url;
    
    const res = await fetch(backendUrl, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export import { QueryClient } from '@tanstack/react-query';

// Create query client with 4-hour authentication caching strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4-hour authentication cache - reduces auth calls to ~6 per day
      staleTime: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
      gcTime: 8 * 60 * 60 * 1000,    // Keep in cache for 8 hours
      
      // Disable aggressive auto-refresh behaviors
      refetchOnWindowFocus: false,    // Don't refetch when user returns to tab
      refetchOnMount: false,          // Don't refetch when component mounts
      refetchOnReconnect: false,      // Don't refetch when network reconnects
      refetchInterval: false,         // No automatic polling
      
      // Retry strategy for network resilience
      retry: (failureCount, error: any) => {
        // Don't retry on auth failures (401/403) - these are real auth issues
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        // Retry network errors up to 2 times
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      // Mutations should still retry network errors
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
