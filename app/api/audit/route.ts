import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const auditSchema = {
  type: "object",
  properties: {
    maxPoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          points: { type: "number" },
        },
        required: ["question", "points"],
        additionalProperties: false,
      },
    },
    awardedPoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          points: { type: "number" },
        },
        required: ["question", "points"],
        additionalProperties: false,
      },
    },
    markerId: { type: "string" },
    signaturePresent: { type: "boolean" },
    writtenTotal: { anyOf: [{ type: "number" }, { type: "null" }] },
    writtenGrade20: { anyOf: [{ type: "number" }, { type: "null" }] },
  },
  required: ["maxPoints", "awardedPoints", "markerId", "signaturePresent", "writtenTotal", "writtenGrade20"],
  additionalProperties: false,
};

// Module-level singleton
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

// 5 MB base64 limit per image (~3.75 MB binary); client compresses to ~1024px JPEG before sending
const MAX_IMAGE_BASE64_LENGTH = 5 * 1024 * 1024;

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Server is reachable' });
}

export async function POST(req: NextRequest) {
  console.log("--- New Audit Request Received ---");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("CRITICAL: ANTHROPIC_API_KEY is not set.");
    return NextResponse.json({
      error: 'API Key missing. Please add ANTHROPIC_API_KEY=your_key to .env.local and restart the server.'
    }, { status: 500 });
  }

  try {
    const { templateImage, testImage } = await req.json();
    console.log("Payload parsed. Images received.");

    if (!templateImage || !testImage) {
      return NextResponse.json({ error: 'Missing images' }, { status: 400 });
    }

    if (templateImage.length > MAX_IMAGE_BASE64_LENGTH || testImage.length > MAX_IMAGE_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image too large (max 5 MB each)' }, { status: 413 });
    }

    const prompt = `You are an expert Exam Auditor. The text in the images is in GREEK.
Your task is to extract scoring data from two images.

IMAGE 1 (first image): Template (Reference Key / "Υπόδειγμα")
- This is a blank paper or a key. It DOES NOT have a teacher signature or ID.
- Look for the maximum points (Μέγιστη Βαθμολογία) allocated to each question (e.g., "Ερ1: 10" or "Θέμα 1 [10]").
- Map these to the 'maxPoints' array.

IMAGE 2 (second image): Student Test (Marked Paper / "Γραπτό")
- This is the paper that was graded.
- Look for the marks awarded (Βαθμός) by the teacher next to each question.
- Map these to the 'awardedPoints' array using the SAME question labels as the template.
- Find the 'Marker ID' printed field 'ΒΑΘΜΟΛΟΓΗΤΗΣ/ΒΑΘΜΟΛΟΓΗΤΡΙΑ' or 'ΑΝΑΒΑΘΜΟΛΟΓΗΤΗΣ/ΒΑΘΜΟΛΟΓΗΤΡΙΑ'. Return empty string "" if absent.
- Find the handwritten 'Signature' (Υπογραφή) or initials. MANDATORY and should be next to Marker ID.
- Find the 'Written Total out of 100' (Συνολική Βαθμ:). This is out of 100. Return null if the field is blank or absent.
- Find the 'Written Total out of 20' (Βαθμολογία στην κλίμακα 1-20:). This is out of 20. Return null if the field is blank or absent.

DATA QUALITY RULES:
1. If a question exists in the Template but has no mark in the Test, assume 0 points.
2. Match question labels EXACTLY (e.g., "1", "2"). An exercise for each square.
3. Use numbers only for point values. Use null (not 0) when a total field is genuinely absent.`;

    console.log("Sending request to Claude...");

    const message = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: auditSchema },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: templateImage.split(',')[1],
              },
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: testImage.split(',')[1],
              },
            },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: 'Model refused to process the request' }, { status: 422 });
    }

    const textBlock = message.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in model response");
    }

    console.log("Claude Response Received:", textBlock.text);
    const response = JSON.parse(textBlock.text);

    type QuestionScore = { question: string; points: number };

    const awardedSum = response.awardedPoints.reduce(
      (sum: number, q: QuestionScore) => sum + q.points,
      0
    );

    const markerIdMissing = !response.markerId || response.markerId.trim() === '';
    const writtenTotalAbsent = response.writtenTotal === null;
    const conversionAbsent = response.writtenGrade20 === null;

    // Tolerance of 0.01 avoids false positives from floating-point drift
    const additionError = !writtenTotalAbsent && Math.abs(awardedSum - (response.writtenTotal as number)) > 0.01;

    const exceededPoints = response.awardedPoints.filter((q: QuestionScore) => {
      const max = response.maxPoints.find((m: QuestionScore) => m.question === q.question);
      return max ? q.points > max.points : false;
    });

    const gradeConversion = (awardedSum / 100) * 20;
    const conversionError = !conversionAbsent && !writtenTotalAbsent &&
      Math.abs((response.writtenGrade20 as number) - gradeConversion) > 1.0;

    const auditResult = {
      ...response,
      calculatedSum: awardedSum,
      markerIdMissing,
      writtenTotalAbsent,
      additionError,
      exceededPoints: exceededPoints.length > 0,
      exceededQuestions: exceededPoints,
      gradeConversion,
      conversionAbsent,
      conversionError,
      passed: !markerIdMissing && !writtenTotalAbsent && !additionError &&
              exceededPoints.length === 0 && response.signaturePresent &&
              !conversionAbsent && !conversionError,
    };

    return NextResponse.json(auditResult);
  } catch (error) {
    console.error('Audit Error:', error);
    return NextResponse.json({
      error: 'Failed to process audit',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
