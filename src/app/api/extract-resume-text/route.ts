
import { NextResponse } from 'next/server';

const LOG_PREFIX = "API_ROUTE_DEBUG (V_FORMDATA_TEST_ONLY):";

export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} /api/extract-resume-text POST handler INVOKED.`);
  try {
    console.log(`${LOG_PREFIX} Attempting to parse formData...`);
    const formData = await request.formData(); // The only operation we are testing
    console.log(`${LOG_PREFIX} formData parsed successfully. Keys found: ${Array.from(formData.keys()).join(', ')}`);
    
    // If we reach here, formData parsing worked.
    return NextResponse.json({
      message: "FormData parsing was successful. No file content processing was attempted in this diagnostic version.",
      status: "success_formdata_parsed"
    });

  } catch (error: any) {
    let errorDetails = "Unknown error occurred during formData parsing.";
    let errorStack = error && error.stack ? error.stack : "No stack trace available.";

    if (error instanceof Error) {
        errorDetails = error.message;
    } else if (typeof error === 'string') {
        errorDetails = error;
    } else {
        try {
            errorDetails = JSON.stringify(error);
        } catch (stringifyError: any) {
            errorDetails = `Could not stringify error object: ${stringifyError.message}`;
        }
    }
    console.error(`${LOG_PREFIX} CRITICAL ERROR during formData parsing: ${errorDetails}`, errorStack);
    
    return NextResponse.json(
      {
        message: `Server error during formData parsing. Please check server logs. Details: ${errorDetails.substring(0, 250)}`,
        status: "failure_formdata_parsing",
        error_details_snippet: errorDetails.substring(0, 250) 
      },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler.`);
  }
}
