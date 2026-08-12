import type { NextConfig } from "next";

// 'unsafe-eval' só é liberado em desenvolvimento: o Next (Fast Refresh /
// Turbopack HMR) precisa de eval() pra recarregar módulo a módulo enquanto
// você edita. Em produção (Vercel) isso continua bloqueado, sem mudança
// nenhuma no que já estava em uso no ar.
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

// Identificador único de cada deploy (SHA do commit, quando a Vercel
// disponibiliza — sempre disponível durante o build, sem precisar habilitar
// nada no painel). Fica embutido no bundle e é usado para invalidar sessões
// de login antigas sempre que uma nova versão sobe ao ar (ver src/lib/auth.ts).
const DEPLOY_ID =
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "local";

const nextConfig: NextConfig = {
  env: {
    DEPLOY_ID,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
