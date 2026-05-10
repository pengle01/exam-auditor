import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const schema: Schema = {
  description: "Exam audit results",
  type: SchemaType.OBJECT,
  properties: {
    maxPoints: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question: { type: SchemaType.STRING },
          points: { type: SchemaType.NUMBER },
        },
        required: ["question", "points"],
      },
    },
    awardedPoints: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question: { type: SchemaType.STRING },
          points: { type: SchemaType.NUMBER },
        },
        required: ["question", "points"],
      },
    },
    markerId: { type: SchemaType.STRING },
    signaturePresent: { type: SchemaType.BOOLEAN },
    writtenTotal: { type: SchemaType.NUMBER },
  },
  required: ["maxPoints", "awardedPoints", "markerId", "signaturePresent", "writtenTotal"],
};

export const maxDuration = 60; // Increase timeout for AI processing
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Server is reachable' });
}

export async function POST(req: NextRequest) {
  console.log("--- New Audit Request Received ---");

  if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is not set.");
    return NextResponse.json({ 
      error: 'API Key missing. Please add GEMINI_API_KEY=your_key to .env.local and restart the server.' 
    }, { status: 500 });
  }

  try {
    const { templateImage, testImage } = await req.json();
    console.log("Payload parsed. Images received.");

    if (!templateImage || !testImage) {
      console.error("Error: Missing images in payload");
      return NextResponse.json({ error: 'Missing images' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Re-typing to ensure no hidden characters
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const prompt = `
      You are an expert Exam Auditor. The text in the images is in GREEK.
      Your task is to extract scoring data from two images.

      IMAGE 1: Template (Reference Key / "Υπόδειγμα")
      - This is a blank paper or a key. It DOES NOT have a teacher signature or ID.
      - Look for the maximum points (Μέγιστη Βαθμολογία) allocated to each question (e.g., "Ερ1: 10" or "Θέμα 1 [10]").
      - Map these to the 'maxPoints' array.

      IMAGE 2: Student Test (Marked Paper / "Γραπτό")
      - This is the paper that was graded.
      - Look for the marks awarded (Βαθμός) by the teacher next to each question.
      - Map these to the 'awardedPoints' array using the SAME question labels as the template.
      - Find the 'Marker ID' (Αριθμός Εξεταστή) or Teacher Name.
      - Find the handwritten 'Signature' (Υπογραφή) or initials. MANDATORY only on this image.
      - Find the 'Written Total' (Συνολικός Βαθμός).

      DATA QUALITY RULES:
      1. If a question exists in the Template but has no mark in the Test, assume 0 points.
      2. Match question labels EXACTLY (e.g., "Θέμα 1", "Ερώτηση 1").
      3. Use numbers only for point values.
    `;

    console.log("Sending request to Gemini 1.5 Flash...");
    let result;
    try {
      result = await model.generateContent([
        prompt,
        { inlineData: { data: templateImage.split(',')[1], mimeType: "image/jpeg" } },
        { inlineData: { data: testImage.split(',')[1], mimeType: "image/jpeg" } },
      ]);
    } catch (genError: any) {
      if (genError.status === 404) {
        console.warn("Model 1.5-flash not found. Attempting fallback to gemini-1.5-flash-latest...");
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        result = await fallbackModel.generateContent([
          prompt,
          { inlineData: { data: templateImage.split(',')[1], mimeType: "image/jpeg" } },
          { inlineData: { data: testImage.split(',')[1], mimeType: "image/jpeg" } },
        ]);
      } else {
        throw genError;
      }
    }

    const responseText = result.response.text();
    console.log("Gemini Response Received:", responseText);
    const response = JSON.parse(responseText);

    // Native Code Validation
    const awardedSum = response.awardedPoints.reduce((sum: number, q: any) => sum + q.points, 0);
    const additionError = awardedSum !== response.writtenTotal;
    
    const exceededPoints = response.awardedPoints.filter((q: any) => {
      const max = response.maxPoints.find((m: any) => m.question === q.question);
      return max ? q.points > max.points : false;
    });

    const gradeConversion = (awardedSum / 100) * 20;

    const auditResult = {
      ...response,
      calculatedSum: awardedSum,
      additionError,
      exceededPoints: exceededPoints.length > 0,
      exceededQuestions: exceededPoints,
      gradeConversion,
      passed: !additionError && exceededPoints.length === 0 && response.signaturePresent
    };

    return NextResponse.json(auditResult);
  } catch (error) {
    console.error('Audit Error:', error);
    return NextResponse.json({ error: 'Failed to process audit' }, { status: 500 });
  }
}
