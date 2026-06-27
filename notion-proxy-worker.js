/**
 * 溢恩堂教室預約 - Notion API Proxy
 * 部署至 Cloudflare Workers（免費方案即可）
 *
 * 功能：轉發前端請求至 Notion API，並加上正確的 CORS headers
 * 安全：Token 由前端 header X-Notion-Token 傳入，Worker 不儲存任何憑證
 */

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const ALLOWED_ORIGINS = [
  'https://TOGC_room_reserve.github.io',  // ← 改成你的 GitHub Pages 網址
  'http://localhost',
  'http://127.0.0.1',
  'null',  // for file:// local testing
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(isAllowed ? origin : ''),
      });
    }

    // Only allow GET / POST
    if (!['GET','POST'].includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    // e.g. /databases/:id/query  → https://api.notion.com/v1/databases/:id/query
    const notionPath = url.pathname; // proxy is mounted at root, path IS the Notion path
    const notionUrl  = `${NOTION_API}${notionPath}${url.search}`;

    const token = request.headers.get('X-Notion-Token') || '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing X-Notion-Token header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Build upstream request
    const body = ['POST','PATCH'].includes(request.method) ? await request.text() : undefined;
    const notionRes = await fetch(notionUrl, {
      method:  request.method,
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type':   'application/json',
      },
      body,
    });

    const data = await notionRes.text();
    return new Response(data, {
      status:  notionRes.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(isAllowed ? origin : ''),
      },
    });
  },
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Notion-Token',
    'Access-Control-Max-Age':       '86400',
  };
}
