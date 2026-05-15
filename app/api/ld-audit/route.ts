import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ldSchema = {
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
    q6SignaturePresent: { type: "boolean" },
    q7SignaturePresent: { type: "boolean" },
    q11SignaturePresent: { type: "boolean" },
    q11CrossedOut: { type: "boolean" },
    markerId: { type: "string" },
    signaturePresent: { type: "boolean" },
    writtenGrade20: { anyOf: [{ type: "number" }, { type: "null" }] },
  },
  required: [
    "awardedPoints",
    "q6SignaturePresent",
    "q7SignaturePresent",
    "q11SignaturePresent",
    "q11CrossedOut",
    "markerId",
    "signaturePresent",
    "writtenGrade20",
  ],
  additionalProperties: false,
};

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
const MAX_IMAGE_BASE64_LENGTH = 5 * 1024 * 1024;

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API Key missing.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { ldTestImage, maxPoints, totalPoints } = body;

    if (!ldTestImage || !maxPoints || totalPoints == null) {
      return NextResponse.json(
        { error: 'Missing ldTestImage, maxPoints, or totalPoints' },
        { status: 400 }
      );
    }

    if (ldTestImage.length > MAX_IMAGE_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image too large (max 5 MB)' }, { status: 413 });
    }

    type QuestionScore = { question: string; points: number };

    const q6Label  = (maxPoints[5]  as QuestionScore | undefined)?.question ?? 'Q6';
    const q7Label  = (maxPoints[6]  as QuestionScore | undefined)?.question ?? 'Q7';
    const q8Label  = (maxPoints[7]  as QuestionScore | undefined)?.question ?? 'Q8';
    const q9Label  = (maxPoints[8]  as QuestionScore | undefined)?.question ?? 'Q9';
    const q10Label = (maxPoints[9]  as QuestionScore | undefined)?.question ?? 'Q10';
    const q11Label = (maxPoints[10] as QuestionScore | undefined)?.question ?? 'Q11';

    const maxPointsList = (maxPoints as QuestionScore[])
      .map(q => `  ${q.question}: ${q.points} points`)
      .join('\n');

    const prompt = `You are an expert Exam Auditor. The text is in GREEK.
This is a paper for a student with learning difficulties (Μαθησιακές Δυσκολίες).

Special marking rules applied to this paper:
- "${q6Label}" and "${q7Label}" have been CROSSED OUT and REMARKED with new dictation scores written nearby. Read the NEW remarked value only, not the crossed-out original.
- "${q11Label}" has been CROSSED OUT entirely — record it as 0 points and set q11CrossedOut=true if you see it crossed out.
- "${q8Label}", "${q9Label}", "${q10Label}" retain their ORIGINAL marks (no change on paper).
- All other questions retain their original marks.

Check for:
- A handwritten Signature (Υπογραφή/initials) next to "${q6Label}" → q6SignaturePresent
- A handwritten Signature next to "${q7Label}" → q7SignaturePresent
- A handwritten Signature next to "${q11Label}" → q11SignaturePresent
- The Marker ID field (ΒΑΘΜΟΛΟΓΗΤΗΣ/ΒΑΘΜΟΛΟΓΗΤΡΙΑ or ΑΝΑΒΑΘΜΟΛΟΓΗΤΗΣ). Return "" if absent.
- The overall marker Signature present on the paper → signaturePresent
- The Written Total out of 20 (Βαθμολογία στην κλίμακα 1-20). Return null if absent.

Maximum points per question (from template):
${maxPointsList}

DATA RULES:
1. Dash "-" or "–" = 0 points, never 1. A short horizontal line is always a dash.
2. Use null only when the /20 total field is genuinely absent or blank.
3. "${q11Label}" → always 0 in awardedPoints.
4. "${q6Label}" and "${q7Label}" → use the NEW remarked value only.`;

    console.log("Sending LD audit request to Claude...");

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      output_config: {
        format: { type: 'json_schema', schema: ldSchema },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: ldTestImage.split(',')[1],
            },
          },
        ],
      }],
    });

    if (message.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'Model refused to process the request' }, { status: 422 });
    }

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text content in model response');

    console.log("LD Claude Response:", textBlock.text);
    const response = JSON.parse(textBlock.text);

    const scaledLabels = new Set([q8Label, q9Label, q10Label]);
    const skippedLabels = new Set([q11Label]);

    let ldSum = 0;
    for (const q of response.awardedPoints as QuestionScore[]) {
      if (skippedLabels.has(q.question)) {
        // Q11 crossed out — skip
      } else if (scaledLabels.has(q.question)) {
        ldSum += q.points * (40 / 36);
      } else {
        ldSum += q.points;
      }
    }

    const ldGrade20 = (ldSum / totalPoints) * 20;
    const markerIdMissing = !response.markerId || response.markerId.trim() === '';
    const conversionAbsent = response.writtenGrade20 === null;
    const conversionError = !conversionAbsent &&
      Math.abs((response.writtenGrade20 as number) - ldGrade20) > 1.0;

    const ldResult = {
      ...response,
      maxPoints,
      totalPoints,
      q6Label,
      q7Label,
      q11Label,
      ldCalculatedSum: ldSum,
      ldGrade20,
      markerIdMissing,
      q6SignatureMissing: !response.q6SignaturePresent,
      q7SignatureMissing: !response.q7SignaturePresent,
      q11SignatureMissing: !response.q11SignaturePresent,
      q11NotCrossedOut: !response.q11CrossedOut,
      conversionAbsent,
      conversionError,
      passed:
        !markerIdMissing &&
        response.signaturePresent &&
        response.q6SignaturePresent &&
        response.q7SignaturePresent &&
        response.q11SignaturePresent &&
        response.q11CrossedOut &&
        !conversionAbsent &&
        !conversionError,
    };

    return NextResponse.json(ldResult);
  } catch (error) {
    console.error('LD Audit Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process LD audit',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
