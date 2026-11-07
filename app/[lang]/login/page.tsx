import type { Metadata } from "next";
import { SiteHeader } from "@/app/components/site-header";
import { AuthScreen } from "./auth-screen";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connecte-toi ou crée ton compte NelumboType.",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <AuthScreen />
    </div>
  );
}
