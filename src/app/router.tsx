import { AppShell } from "@/app/app-shell";
import { AnaliseScreen } from "@/screens/analise/analise-screen";
import { CartoesCreditoScreen } from "@/screens/cartoes";
import { CategoriasScreen } from "@/screens/categorias/categorias-screen";
import { CustoDeVidaScreen } from "@/screens/custo-de-vida";
import { DividasScreen } from "@/screens/dividas";
import { ExtratoScreen } from "@/screens/extrato/extrato-screen";
import { IaScreen } from "@/screens/ia/ia-screen";
import { InvestimentosScreen } from "@/screens/investimentos/investimentos-screen";
import { LancamentosScreen } from "@/screens/lancamentos/lancamentos-screen";
import { MesScreen } from "@/screens/mes/mes-screen";
import { OnboardingBoasVindasScreen } from "@/screens/onboarding/onboarding-page-0";
import { OnboardingNomeScreen } from "@/screens/onboarding/onboarding-page-1";
import { OnboardingIAScreen } from "@/screens/onboarding/onboarding-page-2";
import { OnboardingBancoScreen } from "@/screens/onboarding/onboarding-page-3";
import { OnboardingMetaScreen } from "@/screens/onboarding/onboarding-page-4";
import { OnboardingTudoProntoScreen } from "@/screens/onboarding/onboarding-tudo-pronto";
import { PerfilScreen } from "@/screens/perfil";
import { ConfiguracoesScreen } from "@/screens/perfil/configuracoes";
import { ContasScreen } from "@/screens/perfil/contas";
import { IaIntegracaoScreen } from "@/screens/perfil/integracoes/ia-screen";
import { PluggyIntegracaoScreen } from "@/screens/perfil/integracoes/pluggy-screen";
import { PersonasScreen } from "@/screens/perfil/personas";
import { ReceitasScreen } from "@/screens/receitas/receitas-screen";
import { onboardingConcluido } from "@/store/onboarding";
import { createBrowserRouter, Navigate } from "react-router-dom";

function RootRedirect() {
  if (!onboardingConcluido()) {
    return <Navigate to="/onboarding/boas-vindas" replace />;
  }
  return <Navigate to="/mes" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <RootRedirect /> },
      { path: "mes", element: <MesScreen /> },
      { path: "lancamentos", element: <LancamentosScreen /> },
      { path: "receitas", element: <ReceitasScreen /> },
      { path: "custo-de-vida", element: <CustoDeVidaScreen /> },
      { path: "cartoes", element: <CartoesCreditoScreen /> },
      { path: "extrato", element: <ExtratoScreen /> },
      { path: "dividas", element: <DividasScreen /> },
      { path: "contas", element: <ContasScreen /> },
      { path: "categorias", element: <CategoriasScreen /> },
      { path: "personas", element: <PersonasScreen /> },
      { path: "analise", element: <AnaliseScreen /> },
      { path: "ia", element: <IaScreen /> },
      { path: "perfil", element: <PerfilScreen /> },
      { path: "investimentos", element: <InvestimentosScreen /> },
      { path: "configuracoes", element: <ConfiguracoesScreen /> },
      { path: "integracoes/ia", element: <IaIntegracaoScreen /> },
      { path: "integracoes/pluggy", element: <PluggyIntegracaoScreen /> },
    ],
  },
  {
    path: "/onboarding",
    children: [
      { path: "boas-vindas", element: <OnboardingBoasVindasScreen /> },
      { path: "nome", element: <OnboardingNomeScreen /> },
      { path: "ia", element: <OnboardingIAScreen /> },
      { path: "banco", element: <OnboardingBancoScreen /> },
      { path: "meta", element: <OnboardingMetaScreen /> },
      { path: "tudo-pronto", element: <OnboardingTudoProntoScreen /> },
    ],
  },
]);
