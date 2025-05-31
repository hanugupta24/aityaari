
import { NextResponse } from 'next/server';

const LOG_PREFIX = "API_ROUTE_DEBUG (V_ULTRA_MINIMAL_FORM_CHECK):";

export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} POST handler invoked.`);

  let formDataEntries: string[] = [];
  let identifiedFile: File | null = null;

  try {
    console.log(`${LOG_PREFIX} Attempting to parse formData...`);
    const formData = await request.formData();
    formData.forEach((value, key) => {
      formDataEntries.push(key);
    });
    console.log(`${LOG_PREFIX} formData parsed successfully. Keys found: ${formDataEntries.join(', ')}`);

    const fileEntry = formData.get('file');

    if (!fileEntry) {
      console.error(`${LOG_PREFIX} 'file' entry not found in formData.`);
      return NextResponse.json({ message: "'file' entry not found in formData. Ensure the client is sending the file under the 'file' key." }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      console.error(`${LOG_PREFIX} 'file' entry is not a File instance. Type received: ${typeof fileEntry}`);
      return NextResponse.json({ message: "'file' entry is not a valid File object." }, { status: 400 });
    }
    
    identifiedFile = fileEntry;
    console.log(`${LOG_PREFIX} File entry identified: ${identifiedFile.name}, Type: ${identifiedFile.type}, Size: ${identifiedFile.size} bytes.`);
    console.log(`${LOG_PREFIX} NOT attempting file.arrayBuffer() or any content parsing in this version.`);

    // If we reach here, formData parsing and file identification were successful.
    // Return a diagnostic message. The client will error because 'text' is missing, but it shouldn't be an HTML 500.
    return NextResponse.json({ 
      message: "DIAGNOSTIC: File entry identified in formData. No content processing or buffer reading attempted in this version.",
      fileName: identifiedFile.name,
      fileType: identifiedFile.type,
      fileSize: identifiedFile.size,
      status: "success_file_identified_no_processing"
    });

  } catch (error: any) {
    let errorDetails = "Unknown error occurred during API request processing.";
    let errorStack = error?.stack || "No stack trace available.";

    if (error instanceof Error) {
        errorDetails = error.message;
    } else if (typeof error === 'string') {
        errorDetails = error;
    }
    
    console.error(`${LOG_PREFIX} CRITICAL ERROR in POST handler: ${errorDetails}`, errorStack);
    console.error(`${LOG_PREFIX} FormData keys found (if any): ${formDataEntries.join(', ') || 'N/A (error likely before or during formData parsing)'}`);
    console.error(`${LOG_PREFIX} Identified file (if any before crash): Name: ${identifiedFile?.name || 'N/A'}, Type: ${identifiedFile?.type || 'N/A'}, Size: ${identifiedFile?.size || 'N/A'}`);
    
    // This JSON error might not be sent if the crash is too severe (resulting in HTML 500 from server)
    return NextResponse.json(
      { message: `Server error during minimal form check: ${errorDetails.substring(0,300)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler for file: ${identifiedFile?.name || 'N/A'}.`);
  }
}
