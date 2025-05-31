
// src/app/api/extract-resume-text/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log("API_ROUTE_PROCESS_RESUME: Received request.");
  // This route is not actively used for the primary resume upload flow from the profile page
  // in the current reverted client-side extraction model.
  // It's kept as a placeholder or for potential future server-side utilities
  // that might not involve AI structuring.
  
  return NextResponse.json({ 
    success: false, 
    message: 'This API route is not the primary handler for resume uploads from the profile page in the current client-side processing model. Raw text extraction and AI structuring (if any) are handled differently now.',
    rawText: null,
    // Ensure the structure matches what the profile page *might* expect if it accidentally called this old route,
    // to prevent hard crashes, even though it shouldn't be calling it for the main flow.
    experiences: [], 
    projects: [],
    name: null,
    email: null,
    phoneNumber: null,
    profileField: null,
    role: null,
    keySkills: [],
    educationHistory: [],
    accomplishments: null,

  }, { status: 404 }); // Not Found, as it's not serving an active purpose in this reverted flow.
}
