import "@/styles/tokens.css";
import "@/styles/theme-light.css";
import "@/styles/theme-dark.css";
import "./globals.scss";
import { ReactNode } from "react";
import HeaderAuth from "./_parts/header-auth";
import AuthListener from "./_parts/auth-listener";
import ClientProviders from "./_providers/client-providers";

export const metadata = {
  title: "Calorie Counter",
  description: "Track calories with chat and charts",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <AuthListener />
        <ClientProviders>
          <header className="appHeader">
            <div className="brand">Calorie Counter</div>
            <nav className="routeTabs">
              <a href="/dashboard">Dashboard</a>
              <a href="/chat">Chat</a>
              <a href="/test">Test</a>
              <a href="/login">Login</a>
            </nav>
            <HeaderAuth />
          </header>
          <main className="container">{children}</main>
        </ClientProviders>
      </body>
    </html>
  );
}
