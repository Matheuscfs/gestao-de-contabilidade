import { AppShell } from "@/app/app-shell";
import { AnaliseScreen } from "@/screens/analise/analise-screen";
import { CartoesCreditoScreen } from "@/screens/cartoes/cartoes-credito-screen";
import { CategoriasScreen } from "@/screens/categorias/categorias-screen";
import { CustoDeVidaScreen } from "@/screens/custo-de-vida/custo-de-vida-screen";
import { DividasScreen } from "@/screens/dividas/dividas-screen";
import { IaScreen } from "@/screens/ia/ia-screen";
import { InvestimentosScreen } from "@/screens/investimentos/investimentos-screen";
import { LancamentosScreen } from "@/screens/lancamentos/lancamentos-screen";
import { MesScreen } from "@/screens/mes/mes-screen";
import { PerfilScreen } from "@/screens/perfil";
import { ConfiguracoesScreen } from "@/screens/perfil/configuracoes";
import { ContasScreen } from "@/screens/perfil/contas";
import { PersonasScreen } from "@/screens/perfil/personas";
import { ReceitasScreen } from "@/screens/receitas/receitas-screen";
import { createBrowserRouter, Navigate } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/mes" replace /> },
      { path: "mes", element: <MesScreen /> },
      { path: "lancamentos", element: <LancamentosScreen /> },
      { path: "receitas", element: <ReceitasScreen /> },
      { path: "custo-de-vida", element: <CustoDeVidaScreen /> },
      { path: "cartoes", element: <CartoesCreditoScreen /> },
      { path: "dividas", element: <DividasScreen /> },
      { path: "contas", element: <ContasScreen /> },
      { path: "categorias", element: <CategoriasScreen /> },
      { path: "personas", element: <PersonasScreen /> },
      { path: "analise", element: <AnaliseScreen /> },
      { path: "ia", element: <IaScreen /> },
      { path: "perfil", element: <PerfilScreen /> },
      { path: "investimentos", element: <InvestimentosScreen /> },
      { path: "configuracoes", element: <ConfiguracoesScreen /> },
    ],
  },
]);
