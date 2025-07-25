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
