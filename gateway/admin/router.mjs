// gateway/admin/router.mjs — Admin router for UI views and API endpoints

import { parseSessionCookie, validateSession } from '../auth.mjs';
import { renderAdminPage } from './views.mjs';
import { renderLoginPage } from './login-view.mjs';
import { handleAdminApi } from './api.mjs';

export async function handleAdminRouting(req, res, pathname) {
  // Extract and validate session token from cookie
  const cookie = req.headers.cookie || '';
  const token = parseSessionCookie(cookie);
  const session = validateSession(token);

  // If request is for Admin API (/admin/api/*)
  if (pathname.startsWith('/admin/api')) {
    return handleAdminApi(req, res, pathname, session);
  }

  // Dedicated login page route
  if (pathname === '/admin/login') {
    const url = new URL(req.url, 'http://localhost');
    const error = url.searchParams.get('error');
    const html = renderLoginPage(error);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end(html);
  }

  // Admin Web UI: redirect to /admin/login if not authenticated
  if (pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/')) {
    if (!session) {
      res.writeHead(302, { 'Location': '/admin/login' });
      return res.end();
    }
    const html = renderAdminPage(session);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end(html);
  }

  return false;
}