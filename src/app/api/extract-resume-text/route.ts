
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log("API_ROUTE_DIAGNOSTIC_ULTRA_SIMPLE: /api/extract-resume-text POST handler INVOKED.");
  try {
    // No file processing, no formData parsing. Just a simple response.
    console.log("API_ROUTE_DIAGNOSTIC_ULTRA_SIMPLE: Attempting to return simple JSON response.");
    return NextResponse.json({
      message: "API route is callable. No file processing attempted in this version.",
      status: "success_diagnostic_ultra_simple"
    });
  } catch (error: any) {
    // This catch block should ideally not be hit in this ultra-simple version
    // unless NextResponse.json() itself fails, which is highly unlikely.
    let errorMessage = "An unexpected server error occurred even in the ultra-simple diagnostic version.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    console.error(`API_ROUTE_DIAGNOSTIC_ULTRA_SIMPLE: CRITICAL ERROR: ${errorMessage}`);
    // Fallback, though ideally the above return works.
    return new Response(JSON.stringify({
        message: `Critical server error: ${errorMessage.substring(0, 200)}. Check server logs. (ultra_simple_diagnostic)`,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    console.log("API_ROUTE_DIAGNOSTIC_ULTRA_SIMPLE: Exiting /api/extract-resume-text POST handler.");
  }
}
