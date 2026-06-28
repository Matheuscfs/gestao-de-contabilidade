import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/app-shell";
import { MesScreen } from "@/screens/mes/mes-screen";
import { LancamentosScreen } from "@/screens/lancamentos/lancamentos-screen";
import { ReceitasScreen } from "@/screens/receitas/receitas-screen";
import { CartoesCreditoScreen } from "@/screens/cartoes/cartoes-credito-screen";
import { DividasScreen } from "@/screens/dividas/dividas-screen";
import { InvestimentosScreen } from "@/screens/investimentos/investimentos-screen";
import { ContasScreen } from "@/screens/contas/contas-screen";
import { ConfiguracoesScreen } from "@/screens/configuracoes/configuracoes-screen";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/mes" replace /> },
      { path: "mes", element: <MesScreen /> },
      { path: "lancamentos", element: <LancamentosScreen /> },
      { path: "receitas", element: <ReceitasScreen /> },
      { path: "cartoes", element: <CartoesCreditoScreen /> },
      { path: "dividas", element: <DividasScreen /> },
      { path: "investimentos", element: <InvestimentosScreen /> },
      { path: "contas", element: <ContasScreen /> },
      { path: "configuracoes", element: <ConfiguracoesScreen /> },
    ],
  },
]);
