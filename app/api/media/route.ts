import { bindings } from "@/db/storage";
import { identityEmail } from "@/lib/current-user";

export async function GET(request: Request) {
  if (!await identityEmail()) return new Response("Sign in required", { status: 401 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return new Response("Missing key", { status: 400 });
  const rangeRequested = request.headers.has("Range");
  const object = await bindings().MEDIA.get(key, rangeRequested ? { range: request.headers } : undefined);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  if (rangeRequested && object.range) {
    headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
    headers.set("Content-Length", String(object.range.length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}
