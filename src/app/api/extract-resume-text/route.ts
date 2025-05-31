
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
// @ts-ignore No official types for pdf-parse, or use a community one if available
import pdf from 'pdf-parse';

const LOG_PREFIX = "API_ROUTE_DEBUG (v_ISOLATE_PARSERS):";

export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} POST handler invoked.`);

  let file: File | null = null;
  let fileBuffer: Buffer | null = null;
  let formDataEntries: string[] = [];

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
    file = fileEntry;
    console.log(`${LOG_PREFIX} File identified: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes.`);

    if (file.size === 0) {
      console.error(`${LOG_PREFIX} File is empty: ${file.name}`);
      return NextResponse.json({ message: "Uploaded file is empty." }, { status: 400 });
    }

    try {
      console.log(`${LOG_PREFIX} Attempting to read file into ArrayBuffer for: ${file.name}`);
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      console.log(`${LOG_PREFIX} File buffer created successfully for: ${file.name}. Buffer size: ${fileBuffer.length} bytes.`);
    } catch (bufferError: any) {
      console.error(`${LOG_PREFIX} Error creating buffer from file ${file.name}:`, bufferError.message, bufferError.stack);
      return NextResponse.json({ message: `Error reading file into buffer: ${bufferError.message}` }, { status: 500 });
    }

    let extractedText = "";

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      console.log(`${LOG_PREFIX} Attempting to parse PDF file: ${file.name} (Buffer length: ${fileBuffer.length}) with pdf-parse.`);
      try {
        const data = await pdf(fileBuffer);
        extractedText = data.text.trim();
        console.log(`${LOG_PREFIX} PDF parsing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} Error parsing PDF file ${file.name} with pdf-parse:`, pdfError.message, pdfError.stack);
        return NextResponse.json({ message: `Error parsing PDF file: ${pdfError.message}` }, { status: 500 });
      }
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      console.log(`${LOG_PREFIX} Attempting to parse DOCX file: ${file.name} (Buffer length: ${fileBuffer.length}) with mammoth.`);
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value.trim();
        console.log(`${LOG_PREFIX} DOCX parsing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
      } catch (docxError: any) {
        console.error(`${LOG_PREFIX} Error parsing DOCX file ${file.name} with mammoth:`, docxError.message, docxError.stack);
        return NextResponse.json({ message: `Error parsing DOCX file: ${docxError.message}` }, { status: 500 });
      }
    } else if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      console.log(`${LOG_PREFIX} Processing TXT file: ${file.name}`);
      try {
        extractedText = fileBuffer.toString("utf-8").trim();
        console.log(`${LOG_PREFIX} TXT processing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
      } catch (txtError: any) {
        console.error(`${LOG_PREFIX} Error processing TXT file ${file.name}:`, txtError.message, txtError.stack);
        return NextResponse.json({ message: `Error processing TXT file: ${txtError.message}` }, { status: 500 });
      }
    } else if (file.type === "text/markdown" || file.name.toLowerCase().endsWith(".md")) {
      console.log(`${LOG_PREFIX} Processing MD file: ${file.name}`);
      try {
        extractedText = fileBuffer.toString("utf-8").trim();
        console.log(`${LOG_PREFIX} MD processing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
      } catch (mdError: any) {
        console.error(`${LOG_PREFIX} Error processing MD file ${file.name}:`, mdError.message, mdError.stack);
        return NextResponse.json({ message: `Error processing MD file: ${mdError.message}` }, { status: 500 });
      }
    }
     else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${file.type} for file ${file.name}`);
      return NextResponse.json(
        { message: `Unsupported file type: '${file.type || 'unknown'}'. Please upload a TXT, MD, PDF, or DOCX file.` },
        { status: 415 } // 415 Unsupported Media Type
      );
    }

    if (!extractedText && file.size > 0) {
      console.warn(`${LOG_PREFIX} Text extraction resulted in empty string for non-empty file: ${file.name} of type ${file.type}.`);
    }

    console.log(`${LOG_PREFIX} Returning successfully processed text for: ${file.name}. Length: ${extractedText.length}`);
    return NextResponse.json({ text: extractedText });

  } catch (error: any) {
    let errorDetails = "Unknown error occurred during API request processing.";
    let errorStack = error?.stack || "No stack trace available.";

    if (error instanceof Error) {
        errorDetails = error.message;
    } else if (typeof error === 'string') {
        errorDetails = error;
    }
    
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in POST handler: ${errorDetails}`, errorStack);
    console.error(`${LOG_PREFIX} File context if available: Name: ${file?.name || 'N/A'}, Type: ${file?.type || 'N/A'}, Size: ${file?.size || 'N/A'}`);
    console.error(`${LOG_PREFIX} Buffer context if available: Created: ${!!fileBuffer}, Buffer Size: ${fileBuffer?.length || 'N/A'}`);
    console.error(`${LOG_PREFIX} FormData keys found: ${formDataEntries.join(', ') || 'N/A (error before or during formData parsing)'}`);
    
    return NextResponse.json(
      { message: `Server error during file processing: ${errorDetails.substring(0,300)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler for file: ${file?.name || 'N/A'}.`);
  }
}
