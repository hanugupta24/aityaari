
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
// @ts-ignore
import pdf from 'pdf-parse'; // pdf-parse has CJS/ESM interop issues, using @ts-ignore for now.

const LOG_PREFIX = "API_ROUTE_DEBUG (v_FULL_PARSING_RESTORED):";

export async function POST(request: Request) {
  console.log(`${LOG_PREFIX} /api/extract-resume-text POST handler INVOKED.`);

  let file: File | null = null;
  let fileBuffer: Buffer | null = null;

  try {
    console.log(`${LOG_PREFIX} Attempting to parse formData...`);
    const formData = await request.formData();
    console.log(`${LOG_PREFIX} formData parsed successfully.`);

    const fileEntry = formData.get('file');

    if (!fileEntry) {
      console.error(`${LOG_PREFIX} 'file' entry not found in formData. Available keys: ${Array.from(formData.keys()).join(', ')}`);
      return NextResponse.json({ message: "'file' entry not found in formData." }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      console.error(`${LOG_PREFIX} 'file' entry is not a File instance. Type received: ${typeof fileEntry}`);
      return NextResponse.json({ message: "'file' entry is not a valid File." }, { status: 400 });
    }
    file = fileEntry;
    console.log(`${LOG_PREFIX} File identified: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes.`);

    if (file.size === 0) {
      console.error(`${LOG_PREFIX} File is empty: ${file.name}`);
      return NextResponse.json({ message: "Uploaded file is empty." }, { status: 400 });
    }

    console.log(`${LOG_PREFIX} Attempting to read file into ArrayBuffer...`);
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    console.log(`${LOG_PREFIX} File buffer created successfully. Buffer size: ${fileBuffer.length} bytes.`);

    let extractedText = "";

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      console.log(`${LOG_PREFIX} Processing PDF file: ${file.name}`);
      try {
        const data = await pdf(fileBuffer);
        extractedText = data.text?.trim() || "";
        console.log(`${LOG_PREFIX} PDF processing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
      } catch (pdfError: any) {
        console.error(`${LOG_PREFIX} Error parsing PDF file '${file.name}':`, pdfError.message, pdfError.stack);
        return NextResponse.json({ message: `Error parsing PDF: ${pdfError.message}` }, { status: 500 });
      }
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      console.log(`${LOG_PREFIX} Processing DOCX file: ${file.name}`);
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value?.trim() || "";
        console.log(`${LOG_PREFIX} DOCX processing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
      } catch (docxError: any) {
        console.error(`${LOG_PREFIX} Error parsing DOCX file '${file.name}':`, docxError.message, docxError.stack);
        return NextResponse.json({ message: `Error parsing DOCX: ${docxError.message}` }, { status: 500 });
      }
    } else if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      console.log(`${LOG_PREFIX} Processing TXT file: ${file.name}`);
      extractedText = fileBuffer.toString("utf-8").trim();
      console.log(`${LOG_PREFIX} TXT processing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
    } else if (file.type === "text/markdown" || file.name.toLowerCase().endsWith(".md")) {
      console.log(`${LOG_PREFIX} Processing MD file: ${file.name}`);
      extractedText = fileBuffer.toString("utf-8").trim();
      console.log(`${LOG_PREFIX} MD processing successful for: ${file.name}. Extracted text length: ${extractedText.length}`);
    }
     else {
      console.warn(`${LOG_PREFIX} Unsupported file type: ${file.type} for file ${file.name}`);
      return NextResponse.json(
        { message: `Unsupported file type: '${file.type || 'unknown'}'. Please upload a PDF, DOCX, TXT, or MD file.` },
        { status: 415 }
      );
    }

    if (!extractedText && file.size > 0) {
      console.warn(`${LOG_PREFIX} Text extraction resulted in empty string for non-empty file: ${file.name} (Type: ${file.type}). This might be an image-only document or a parsing issue with an empty result.`);
      // It's possible for some files (e.g., image-only PDFs) to have no extractable text.
      // We'll still return success but with empty text, client can decide how to handle.
    }

    console.log(`${LOG_PREFIX} Returning successfully extracted text for: ${file.name}. Length: ${extractedText.length}`);
    return NextResponse.json({ text: extractedText });

  } catch (error: any) {
    let errorDetails = "Unknown error occurred.";
    let errorStack = error?.stack || "No stack trace available.";

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
    console.error(`${LOG_PREFIX} CRITICAL UNHANDLED ERROR in POST handler: ${errorDetails}`, errorStack);
    console.error(`${LOG_PREFIX} File context: Name: ${file?.name || 'N/A'}, Type: ${file?.type || 'N/A'}, Size: ${file?.size || 'N/A'}`);
    console.error(`${LOG_PREFIX} Buffer context: Created: ${!!fileBuffer}, Size: ${fileBuffer?.length || 'N/A'}`);

    return NextResponse.json(
      { message: `Server error during file processing: ${errorDetails.substring(0,250)}` },
      { status: 500 }
    );
  } finally {
    console.log(`${LOG_PREFIX} Exiting /api/extract-resume-text POST handler.`);
  }
}
