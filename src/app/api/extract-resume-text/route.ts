
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

    if (file.type === 'application/pdf') {
      const data = await pdf(fileBuffer);
      textContent = data.text.trim();
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      textContent = result.value.trim();
    } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
       // Should ideally be handled client-side, but as a fallback server can do it too.
       textContent = fileBuffer.toString('utf8').trim();
    }
     else {
      return NextResponse.json({ message: `Unsupported file type: ${file.type}. Please upload PDF, DOCX, TXT, or MD files.` }, { status: 400 });
    }

    return NextResponse.json({ text: textContent });

  } catch (error: any) {
    console.error('Error extracting text from file:', error);
    let friendlyMessage = 'Error processing file.';
    if (error.message && error.message.includes('Invalid PDF')) {
         friendlyMessage = 'Invalid or corrupted PDF file.';
    } else if (error.message && error.message.toLowerCase().includes('mammoth')) {
        friendlyMessage = 'Error processing DOCX file. It might be corrupted or an unsupported DOCX variant.';
    }
    return NextResponse.json({ message: friendlyMessage, error: error.message || 'Unknown error' }, { status: 500 });
  }
}
