
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(request: Request) {
  console.log("API_ROUTE_DEBUG: Entered /api/extract-resume-text POST handler (v2).");
  try {
    console.log("API_ROUTE_DEBUG: Attempting to parse formData (v2).");
    const formData = await request.formData();
    console.log("API_ROUTE_DEBUG: formData parsed successfully (v2).");

    const fileEntry = formData.get('file');

    if (!fileEntry) {
      console.warn('API_ROUTE_DEBUG: No file entry found in formData (v2).');
      return NextResponse.json({ message: 'No file uploaded.' }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      console.warn('API_ROUTE_DEBUG: formData entry "file" is not a File object (v2). Type:', typeof fileEntry);
      return NextResponse.json({ message: 'Uploaded item is not a valid file.' }, { status: 400 });
    }
    
    const file = fileEntry as File; // Now we know it's a File

    console.log(`API_ROUTE_DEBUG: File received: ${file.name}, type: ${file.type}, size: ${file.size} bytes (v2).`);

    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE_BYTES) {
      console.warn(`API_ROUTE_DEBUG: File too large: ${file.name}, size: ${file.size} bytes. Limit is ${MAX_SIZE_BYTES / (1024 * 1024)}MB (v2).`);
      return NextResponse.json({ message: `File is too large. Maximum size is ${MAX_SIZE_BYTES / (1024 * 1024)}MB.` }, { status: 413 });
    }

    // Inner try-catch for file content processing
    try {
      console.log(`API_ROUTE_DEBUG: Attempting to read file buffer for ${file.name} (v2).`);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      console.log(`API_ROUTE_DEBUG: File buffer read successfully for ${file.name}. Buffer length: ${fileBuffer.length} (v2).`);
      let textContent = '';

      if (file.type === 'application/pdf') {
        console.log(`API_ROUTE_DEBUG: Parsing PDF: ${file.name} (v2).`);
        const data = await pdf(fileBuffer);
        textContent = data.text ? data.text.trim() : ""; // Ensure data.text exists
        if (!textContent) {
            console.warn(`API_ROUTE_DEBUG: PDF parsed but no text content found for ${file.name}. The PDF might be image-based or empty (v2).`);
        }
        console.log(`API_ROUTE_DEBUG: PDF parsing successful for ${file.name}. Text length: ${textContent.length} (v2).`);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
        console.log(`API_ROUTE_DEBUG: Processing DOCX: ${file.name} (v2).`);
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        textContent = result.value ? result.value.trim() : ""; // Ensure result.value exists
        if (!textContent && result.messages && result.messages.length > 0) {
            const docxMessages = result.messages.map((m: any) => (m && m.message) || 'Unknown mammoth message').join('; ');
            console.warn(`API_ROUTE_DEBUG: DOCX processed with messages for ${file.name}:`, docxMessages, "(v2)");
        }
        console.log(`API_ROUTE_DEBUG: DOCX processing successful for ${file.name}. Text length: ${textContent.length} (v2).`);
      } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
         console.log(`API_ROUTE_DEBUG: Processing plain text: ${file.name} (v2).`);
         textContent = fileBuffer.toString('utf8').trim();
         console.log(`API_ROUTE_DEBUG: Plain text processing successful for ${file.name}. Text length: ${textContent.length} (v2).`);
      }
       else {
        console.warn(`API_ROUTE_DEBUG: Unsupported file type received: ${file.type} for file ${file.name} (v2).`);
        return NextResponse.json({ message: `Unsupported file type: ${file.type}. Please upload PDF, DOCX, TXT, or MD files.` }, { status: 400 });
      }

      console.log(`API_ROUTE_DEBUG: Successfully extracted text from ${file.name}. Returning success response (v2).`);
      return NextResponse.json({ text: textContent });

    } catch (parsingError: any) {
      console.error(`API_ROUTE_DEBUG: Error during specific file parsing for ${file.name} (v2):`, parsingError);
      const message = parsingError.message || 'Unknown parsing error.';
      let details = 'No additional details available.';
      if (parsingError.stack) {
          details = String(parsingError.stack);
      } else if (typeof parsingError === 'object' && parsingError !== null) {
          try {
              details = JSON.stringify(parsingError);
          } catch (e) {
              details = String(parsingError);
          }
      } else if (parsingError !== undefined && parsingError !== null) {
          details = String(parsingError);
      }
      return NextResponse.json({ message: `Error parsing file content: ${message}`, details: details.substring(0, 500) }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API_ROUTE_DEBUG: CRITICAL UNHANDLED ERROR in /api/extract-resume-text (v2):', error);
    let simpleErrorMessage = "An unexpected critical server error occurred during file processing (v2).";
    if (error instanceof Error && error.message) {
      simpleErrorMessage = error.message;
    } else if (typeof error === 'string') {
      simpleErrorMessage = error;
    } else {
        try {
            simpleErrorMessage = JSON.stringify(error);
        } catch (e) {
            // Fallback if stringifying the error itself fails
            simpleErrorMessage = "An unidentifiable critical error occurred.";
        }
    }
    return NextResponse.json(
      {
        message: "A critical server error occurred. Please check server logs for details. (v2)",
        errorDetails: simpleErrorMessage.substring(0,500)
      },
      { status: 500 }
    );
  } finally {
    console.log("API_ROUTE_DEBUG: Exiting /api/extract-resume-text POST handler (v2).");
  }
}
