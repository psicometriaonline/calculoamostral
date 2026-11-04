import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  retryAfter?: number;
  
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
    // Prevent Vite runtime error overlay from showing for expected API errors
    // @ts-ignore
    this.expected = true;
  }
}

function throwIfResNotOk(res: Response): Promise<void> {
  if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname.startsWith('/calculadora')) {
    // Sessão do site expirou: volta para a página principal para entrar de novo
    window.location.replace('/?sessao=expirada');
  }
  if (!res.ok) {
    return res.text().then(text => {
      text = text || res.statusText;
      
      let errorMessage: string;
      let retryAfter: number | undefined;
      
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) {
          errorMessage = errorData.error;
        } else {
          errorMessage = `${res.status}: ${text}`;
        }
        if (errorData.retryAfter) {
          retryAfter = errorData.retryAfter;
        }
      } catch {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('upstream') || 
            lowerText.includes('timeout') ||
            lowerText.includes('gateway') ||
            lowerText.includes('502') ||
            lowerText.includes('504')) {
          errorMessage = 'O servidor demorou muito para responder. Por favor, tente novamente em alguns instantes.';
        } else {
          errorMessage = `${res.status}: ${text.substring(0, 200)}`;
        }
      }
      
      return Promise.reject(new ApiError(errorMessage, res.status, retryAfter));
    });
  }
  return Promise.resolve();
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
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
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Handle response JSON parsing safely
    const text = await res.text();
    if (!text) return null;
    
    try {
      return JSON.parse(text);
    } catch {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('upstream') || 
          lowerText.includes('timeout') ||
          lowerText.includes('gateway')) {
        throw new Error('O servidor demorou muito para responder. Por favor, tente novamente em alguns instantes.');
      }
      throw new Error(`Resposta inválida do servidor: ${text.substring(0, 100)}`);
    }
  };

export async function downloadMaterial(objectPath: string, filename: string): Promise<{ success: boolean; error?: string }> {
  if (!objectPath.startsWith('/objects/')) {
    const link = document.createElement('a');
    link.href = objectPath;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { success: true };
  }

  try {
    // Use the proxy download endpoint to force download with correct headers
    // This prevents the browser from opening files (like .R, .txt) instead of downloading them
    const relativePath = objectPath.replace('/objects/', '');
    const downloadUrl = `/api/materials/download/${relativePath}?filename=${encodeURIComponent(filename)}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { success: true };
  } catch (error) {
    console.error('Download error:', error);
    const errorMessage = error instanceof ApiError 
      ? error.message 
      : 'Erro ao preparar o download. Tente novamente.';
    return { success: false, error: errorMessage };
  }
}

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
