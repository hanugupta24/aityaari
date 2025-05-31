
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { Readable } from 'stream';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let textContent = '';

    console.log(`API: Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);

    if (file.type === 'application/pdf') {
      try {
        const data = await pdf(fileBuffer);
        textContent = data.text.trim();
        if (!textContent) {
            console.warn(`API: PDF parsed but no text content found for ${file.name}. The PDF might be image-based or empty.`);
            // It's not necessarily an error if a PDF has no text, could be an image PDF.
            // Client can decide how to handle empty textContent.
        }
      } catch (pdfError: any) {
        console.error(`API: Error parsing PDF ${file.name}:`, pdfError);
        return NextResponse.json({ message: `Error parsing PDF: ${pdfError.message || 'Unknown PDF parsing error.'}` }, { status: 500 });
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        textContent = result.value.trim();
        if (!textContent && result.messages && result.messages.length > 0) {
            console.warn(`API: DOCX processed with messages for ${file.name}:`, result.messages);
            // Potentially return messages if needed, but for now, empty text is the result.
        }
      } catch (docxError: any) {
        console.error(`API: Error processing DOCX ${file.name}:`, docxError);
        return NextResponse.json({ message: `Error processing DOCX: ${docxError.message || 'Unknown DOCX processing error.'}` }, { status: 500 });
      }
    } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
       textContent = fileBuffer.toString('utf8').trim();
    }
     else {
      console.warn(`API: Unsupported file type received: ${file.type} for file ${file.name}`);
      return NextResponse.json({ message: `Unsupported file type: ${file.type}. Please upload PDF, DOCX, TXT, or MD files.` }, { status: 400 });
    }

    console.log(`API: Successfully extracted text from ${file.name}. Length: ${textContent.length}`);
    return NextResponse.json({ text: textContent });

  } catch (error: any) {
    console.error('API: General error in /api/extract-resume-text:', error);
    let friendlyMessage = 'Error processing file.';
    if (error.message && error.message.includes('Invalid PDF')) {
         friendlyMessage = 'Invalid or corrupted PDF file.';
    } else if (error.message && error.message.toLowerCase().includes('mammoth')) {
        friendlyMessage = 'Error processing DOCX file. It might be corrupted or an unsupported DOCX variant.';
    }
    return NextResponse.json({ message: friendlyMessage, errorDetails: error.message || 'Unknown server error' }, { status: 500 });
  }
}

