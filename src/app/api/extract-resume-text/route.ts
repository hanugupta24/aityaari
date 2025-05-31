
// src/app/api/extract-resume-text/route.ts
import { NextResponse } from 'next/server';

/**
 * @fileOverview This API route is DEPRECATED for primary resume text extraction.
 * Resume text extraction is now handled client-side in `src/app/(app)/profile/page.tsx`.
 * This route might be repurposed in the future for server-side AI-driven structured 
 * data extraction if explicitly triggered by the user, but it is not used for the 
 * on-upload text extraction anymore.
 */

export async function POST(request: Request) {
  console.warn("API_ROUTE_DEPRECATED: /api/extract-resume-text POST handler invoked. This route is deprecated for primary text extraction. Client-side extraction should be used.");
  
  return NextResponse.json(
    { 
      success: false, 
      message: "This API route for resume text extraction is deprecated. Client-side processing is now used. This endpoint might be used for other AI structuring tasks in the future if triggered explicitly.",
      rawText: null,
      extractedSections: null,
      structuredExtractionError: "Endpoint deprecated for this functionality."
    },
    { status: 410 } // 410 Gone
  );
}
