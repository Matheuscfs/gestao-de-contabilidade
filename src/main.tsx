import { router } from "@/app/router";
import { Toaster } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import { inicializarOnboarding } from "@/store/onboarding";
import "@/styles/globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

async function iniciar() {
  try {
    await inicializarOnboarding();
  } catch (e) {
    tratarErro(e, {
      contexto: "inicializar configurações de onboarding",
      notificar: false,
    });
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

iniciar();
