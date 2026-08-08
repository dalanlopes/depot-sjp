import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "depot_session";
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

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
    pathname.startsWith("/favicon")
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
