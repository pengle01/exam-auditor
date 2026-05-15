import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const templateSchema = {
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
    totalPoints: { type: "number" },
  },
  required: ["maxPoints", "totalPoints"],
  additionalProperties: false,
};

const testSchema = {
  type: "object",
  properties: {
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
  required: ["awardedPoints", "markerId", "signaturePresent", "writtenTotal", "writtenGrade20"],
  additionalProperties: false,
};

const client = new Anthropic();

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
    const body = await req.json();

    // ── Template extraction mode ──────────────────────────────────────────────
    if (body.templateImage && !body.testImage) {
      const { templateImage } = body;

      if (templateImage.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json({ error: 'Image too large (max 5 MB)' }, { status: 413 });
      }

      const prompt = `You are an expert Exam Auditor. The text is in GREEK.
Extract the maximum points per question from this template / reference key (Υπόδειγμα).
Look for the maximum points (Μέγιστη Βαθμολογία) allocated to each question (e.g., "Ερ1: 10", "Θέμα 1 [10]").
Map each question label and its maximum point value to the 'maxPoints' array.
Also find the total possible score for the exam (the sum of all question maximums, e.g. 100 or 50) and return it as 'totalPoints'.
If not explicitly stated, compute it as the sum of all maxPoints values.
Use numbers only for point values.`;

      console.log("Extracting template maxPoints...");

      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        output_config: {
          format: { type: "json_schema", schema: templateSchema },
        },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: templateImage.split(',')[1] },
            },
          ],
        }],
      });

      if (message.stop_reason === "max_tokens") throw new Error("Model response truncated — too many questions");
      if (message.stop_reason === "refusal") return NextResponse.json({ error: 'Model refused to process the template' }, { status: 422 });

      const textBlock = message.content.find(b => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("No text content in model response");

      console.log("Template response:", textBlock.text);
      return NextResponse.json(JSON.parse(textBlock.text));
    }

    // ── Audit mode ────────────────────────────────────────────────────────────
    const { testImage, maxPoints, totalPoints } = body;

    if (!testImage || !maxPoints || totalPoints == null) {
      return NextResponse.json({ error: 'Missing testImage, maxPoints, or totalPoints' }, { status: 400 });
    }

    if (testImage.length > MAX_IMAGE_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image too large (max 5 MB)' }, { status: 413 });
    }

    type QuestionScore = { question: string; points: number };

    const maxPointsList = maxPoints
      .map((q: QuestionScore) => `  ${q.question}: ${q.points} points`)
      .join('\n');

    const prompt = `You are an expert Exam Auditor. The text is in GREEK.
Extract scoring data from this marked student paper (Γραπτό).

Maximum points per question (from template):
${maxPointsList}

INSTRUCTIONS:
- Find the marks awarded by the teacher next to each question. Use the EXACT question labels listed above.
- A dash "–" or "-" next to a question means the student did not attempt it: record as 0 points.
  WARNING: A dash is a short horizontal stroke. It is NOT the number 1. Do not read a dash as 1.
- Find the Marker ID field (ΒΑΘΜΟΛΟΓΗΤΗΣ/ΒΑΘΜΟΛΟΓΗΤΡΙΑ or ΑΝΑΒΑΘΜΟΛΟΓΗΤΗΣ/ΒΑΘΜΟΛΟΓΗΤΡΙΑ). Return "" if absent.
- Find the handwritten Signature (Υπογραφή) or initials next to the Marker ID.
- Find the Written Total out of 100 (Συνολική Βαθμ:). Return null if the field is blank or absent.
- Find the Written Total out of 20 (Βαθμολογία στην κλίμακα 1-20:). Return null if the field is blank or absent.

DATA RULES:
1. Dash "-" or "–" = 0 points, never 1. A short horizontal line is always a dash.
2. Use null (not 0) only when a total field is genuinely absent or blank.
3. Use numbers only for point values.`;

    console.log("Sending audit request to Claude...");

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      output_config: {
        format: { type: "json_schema", schema: testSchema },
      },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: testImage.split(',')[1] },
          },
        ],
      }],
    });

    if (message.stop_reason === "max_tokens") throw new Error("Model response truncated");
    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: 'Model refused to process the request' }, { status: 422 });
    }

    const textBlock = message.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text content in model response");

    console.log("Claude Response Received:", textBlock.text);
    const response = JSON.parse(textBlock.text);

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
      const max = maxPoints.find((m: QuestionScore) => m.question === q.question);
      return max ? q.points > (max as QuestionScore).points : false;
    });

    const gradeConversion = (awardedSum / totalPoints) * 20;
    const conversionError = !conversionAbsent && !writtenTotalAbsent &&
      Math.abs((response.writtenGrade20 as number) - gradeConversion) > 1.0;

    const auditResult = {
      ...response,
      maxPoints,
      totalPoints,
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
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Rate limited — please try again shortly' }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: 'API error', details: error.message }, { status: 502 });
    }
    return NextResponse.json({
      error: 'Failed to process audit',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
