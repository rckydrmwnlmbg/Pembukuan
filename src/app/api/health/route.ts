/**
 * Endpoint pemeriksaan kesehatan aplikasi (SECURITY.md S-07: satu-satunya rute publik
 * yang dikecualikan dari pembungkus kitchenRoute/userRoute).
 */
export async function GET(): Promise<Response> {
  return Response.json({ status: 'ok' }, { status: 200 });
}
