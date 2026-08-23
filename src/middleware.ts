import { withAuth } from "next-auth/middleware";

/**
 * Protegge l'intera dashboard (e le relative API) dietro login. Il frontend
 * pubblico "Finanza Agevolata Match" (Fase 3) vivrà fuori da questi path e
 * resterà accessibile senza autenticazione.
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/misure/:path*",
    "/prospect/:path*",
    "/fonti/:path*",
    "/api/misure/:path*",
    "/api/prospect/:path*",
    "/api/fonti/:path*",
  ],
};
