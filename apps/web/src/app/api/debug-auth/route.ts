import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ 
    message: "Debug route is working", 
    timestamp: Date.now(),
    env: process.env.NODE_ENV
  });
}
