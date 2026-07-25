"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { ElectronProtocolHandler } from "@/components/electron/ElectronProtocolHandler";
import { useTheme } from "@/hooks/useTheme";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster richColors position="bottom-right" theme={theme} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ElectronProtocolHandler />
      {children}
      <ThemedToaster />
    </QueryClientProvider>
  );
}
