import { checkDatabaseHealth, hasDatabaseConfig } from "@/lib/db";
import packageInfo from "@/package.json";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!hasDatabaseConfig())
    return Response.json(
      { status: "unavailable", version: packageInfo.version },
      { status: 503, headers },
    );
  try {
    await checkDatabaseHealth();
    return Response.json(
      { status: "ok", version: packageInfo.version },
      { headers },
    );
  } catch {
    return Response.json(
      { status: "unavailable", version: packageInfo.version },
      { status: 503, headers },
    );
  }
}
