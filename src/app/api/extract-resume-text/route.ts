
// src/app/api/extract-resume-text/route.ts
import { NextResponse } from 'next/server';
// This API route is not actively used for client-side resume processing in the current reverted flow.
// It's kept as a placeholder or for potential future server-side utilities.

export async function POST(request: Request) {
  console.log("API_ROUTE_PROCESS_RESUME: Received request, but this route is not actively used for profile page uploads in the current simple flow.");
  
  return NextResponse.json({ 
    success: false, 
    message: 'This API route is not used for client-side resume text extraction. Processing happens directly in the browser.',
    rawText: null,
    experiences: [],
    projects: [],
  }, { status: 404 }); // Not Found, as it's not serving the intended client-side purpose
}
