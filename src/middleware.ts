import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "depot_session";
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/check-email", "/api/auth/set-password"];

// A verificação criptográfica completa do JWT (assinatura + expiração) é feita
// nos Server Components / API routes via getSession() (runtime Node.js), que é
// onde SESSION_SECRET está garantidamente disponível. Aqui no middleware (Edge)
// só checamos a presença do cookie, evitando depender de env vars no runtime Edge
// (que podem não ser propagadas da mesma forma que no runtime Node, causando um
// loop de redirecionamento quando os dois runtimes discordam sobre a validade da sessão).
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Além de _next/static, _next/image e favicon.ico, deixa passar direto
  // qualquer arquivo estático da pasta /public (imagens, ícones etc) — eles
  // não devem exigir sessão para carregar (ex: a logo na própria tela de login).
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
