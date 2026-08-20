/**
 * API response caching utilities.
 * Adds Cache-Control headers to GET responses for browser/CDN caching.
 */

export function withCache(response: Response, maxAge: number = 60): Response {
  response.headers.set('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
  return response;
}

export function withPrivateCache(response: Response, maxAge: number = 30): Response {
  response.headers.set('Cache-Control', `private, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
  return response;
}

// ETag helper — returns 304 if content hasn't changed
export function checkETag(request: Request, content: string): Response | null {
  const etag = `"${Buffer.from(content).toString('base64').slice(0, 16)}"`;
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }
  return null;
}
