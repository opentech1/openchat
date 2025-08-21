import { NextRequest } from "next/server";

// Proxy auth requests to the server
export async function GET(request: NextRequest) {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
  const url = new URL(request.url);
  const authPath = url.pathname; // Keep it as /api/auth
  
  const serverAuthUrl = `${serverUrl}${authPath}${url.search}`;
  
  // Filter out problematic headers
  const headers: Record<string, string> = {};
  const skipHeaders = ['host', 'content-length', 'transfer-encoding', 'accept-encoding', 'content-encoding'];
  
  request.headers.forEach((value, key) => {
    if (!skipHeaders.includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });
  
  const response = await fetch(serverAuthUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  // Get response text and create new response to avoid encoding issues
  const responseText = await response.text();
  
  return new Response(responseText, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}

export async function POST(request: NextRequest) {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
  const url = new URL(request.url);
  const authPath = url.pathname; // Keep it as /api/auth
  
  const serverAuthUrl = `${serverUrl}${authPath}${url.search}`;
  
  const body = await request.text();
  
  // Filter out problematic headers
  const headers: Record<string, string> = {};
  const skipHeaders = ['host', 'content-length', 'transfer-encoding', 'accept-encoding', 'content-encoding'];
  
  request.headers.forEach((value, key) => {
    if (!skipHeaders.includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });
  
  const response = await fetch(serverAuthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  });

  // Get response text and create new response to avoid encoding issues
  const responseText = await response.text();
  
  return new Response(responseText, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}