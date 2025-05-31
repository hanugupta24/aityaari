
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// This API route was intended for calling an external Python service.
// In the reverted client-side extraction model, it's not used by the profile page's primary resume upload.

export async function POST(request: NextRequest) {
  console.log("API_ROUTE_PROCESS_RESUME_EXTERNAL: Received request, but this route is not used in the current client-side resume processing model from the profile page.");

  return NextResponse.json({
    success: false,
    message: 'This API route (for external Python service integration) is not used by the profile page in the current client-side resume processing configuration.',
    data: null, // Keep data null as it's not processing
  }, { status: 404 }); // Not Found or Not Implemented in this context
}
