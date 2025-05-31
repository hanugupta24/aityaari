
import { NextResponse } from 'next/server';

// Intentionally not importing pdf-parse or mammoth for this diagnostic step

const LOG_PREFIX = "API_ROUTE_DIAGNOSTIC_V4:";

export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} /api/extract-resume-text POST handler INVOKED.`);

  try {
    console.log(`${LOG_PREFIX} Attempting to parse formData...`);
    let formData;
    try {
      formData = await request.formData();
      console.log(`${LOG_PREFIX} formData parsed successfully. Keys:`, Array.from(formData.keys()).join(', '));
    } catch (formDataError: any) {
      console.error(`${LOG_PREFIX} CRITICAL ERROR parsing formData:`, formDataError.message, formDataError.stack);
      // If formData parsing itself fails, we must return a response here.
      return NextResponse.json({ message: `Error processing request data: ${formDataError.message}. Ensure the request is multipart/form-data.` }, { status: 400 });
    }

    const fileEntry = formData.get('file');

    if (!fileEntry) {
      console.warn(`${LOG_PREFIX} No file found in formData. This is after successful formData parsing.`);
      return NextResponse.json({ message: 'No file uploaded under the "file" key.' }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
        console.warn(`${LOG_PREFIX} Uploaded entry is not a File instance. Type: ${typeof fileEntry}`);
        return NextResponse.json({ message: 'Invalid file upload. Expected a File object.' }, { status: 400 });
    }
    
    // For this diagnostic version, we are not processing the file content.
    // We are just confirming we can get this far.
    console.log(`${LOG_PREFIX} Successfully received file entry: ${fileEntry.name}, Type: ${fileEntry.type}, Size: ${fileEntry.size} bytes`);
    console.log(`${LOG_PREFIX} DIAGNOSTIC: Skipping actual file content processing.`);
    
    console.log(`${LOG_PREFIX} Returning a simple success JSON for diagnostic purposes.`);
    return NextResponse.json({ 
      message: "DIAGNOSTIC_V4: API reached, formData parsed, file entry identified. No content processing performed.",
      fileName: fileEntry.name,
      fileType: fileEntry.type,
      fileSize: fileEntry.size
    });

  } catch (error: any) {
    // This is the outermost catch block for any other unexpected errors.
    let errorDetails = "Unknown error occurred in API route.";
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
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in API route (outermost catch): ${errorDetails}`, errorStack);
    return NextResponse.json(
      { message: `DIAGNOSTIC_V4: Server error. Details: ${errorDetails.substring(0, 250)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler.`);
  }
}
