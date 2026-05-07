import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY } from './config'

function getClient() {
  return new Anthropic({ apiKey: ANTHROPIC_API_KEY })
}

export interface GeneratedStep {
  type: 'intro' | 'slide' | 'question' | 'reflection' | 'closing'
  title: string
  content: string
  is_question: boolean
}

export async function generateMeetingFlow(title: string, goal: string, participantCount: number): Promise<GeneratedStep[]> {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are designing an AI-guided meeting flow for Lapendaz, a human-nature-first, education-led happiness ecosystem company.

Meeting Title: "${title}"
Meeting Goal: "${goal}"
Number of Participants: ${participantCount}

Create a structured meeting flow with 6-8 steps. Each step must be one of these types:
- intro: Opening context and framing
- slide: Information/insight to share (no response needed)
- question: A question participants must answer (requires response)
- reflection: A moment for participants to reflect and share
- closing: Summary and next steps

Return ONLY a valid JSON array. No explanation, no markdown, just the JSON array.

Format:
[
  {
    "type": "intro",
    "title": "Step title",
    "content": "Detailed content for this step (2-4 sentences). If type is slide, make it insightful and visually describable. If type is question, make the question clear and thought-provoking.",
    "is_question": false
  }
]

Rules:
- is_question must be true ONLY for type "question" or "reflection"
- Make content rich and relevant to the meeting goal
- Questions should be open-ended and connect to transformation
- The flow should feel like a journey, not a checklist
- Use language that is empowering and forward-looking`
    }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Failed to parse AI response')
  return JSON.parse(jsonMatch[0]) as GeneratedStep[]
}

type AttributionMode = 'named' | 'role' | 'anonymous'
type SessionType = 'Meeting' | 'Workshop' | 'Forum' | 'Training'

function formatAttribution(r: { participant_name: string; participant_role: string }, mode: AttributionMode): string {
  if (mode === 'named') return `${r.participant_name} (${r.participant_role})`
  if (mode === 'role') return r.participant_role
  return 'Participant'
}

function buildResponsesBlock(
  responses: Array<{ participant_name: string; participant_role: string; step_title: string; content: string }>,
  attribution: AttributionMode
): string {
  if (responses.length === 0) return 'No responses collected.'
  return responses.map(r =>
    `[${formatAttribution(r, attribution)}] on "${r.step_title}": ${r.content}`
  ).join('\n')
}

function buildPrompt(
  title: string,
  goal: string,
  sessionType: SessionType,
  attribution: AttributionMode,
  steps: Array<{ title: string; content: string; is_question: number }>,
  responses: Array<{ participant_name: string; participant_role: string; step_title: string; content: string }>
): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const participantCount = new Set(responses.map(r => r.participant_name)).size
  const questionSteps = steps.filter(s => s.is_question)

  // Build per-question response blocks for detailed templates
  const perQuestion = questionSteps.map(step => {
    const stepResponses = responses.filter(r => r.step_title === step.title)
    const lines = stepResponses.map(r =>
      `> "${r.content}" — ${formatAttribution(r, attribution)}`
    ).join('\n')
    return `### ${step.title}\n${lines || '> No responses for this question.'}`
  }).join('\n\n')

  const responsesFlat = buildResponsesBlock(responses, attribution)

  if (sessionType === 'Meeting') {
    return `You are writing formal meeting minutes for Lapendaz.

Session: "${title}"
Date: ${date}
Objective: "${goal}"
Participants: ${participantCount}

All responses collected during the session:
${responsesFlat}

Write the meeting minutes in this exact Markdown structure:

# ${title} — Meeting Minutes
**Date:** ${date} | **Type:** Meeting | **Participants:** ${participantCount}

---

## Executive Summary
[2–3 sentences: what was discussed, key direction reached]

## Key Takeaways
- [takeaway 1]
- [takeaway 2]
- [takeaway 3]

## Discussion Breakdown

${perQuestion || '[No question slides were recorded.]'}

*(For each question above, add a **Synthesis:** line: 1–2 sentences on what emerged.)*

## Decisions Made
- [decision or alignment reached]

## Individual Commitments
| Participant | Commitment Made |
|-------------|----------------|
[Fill one row per participant who expressed a clear commitment. Use ${attribution === 'named' ? 'full name' : attribution === 'role' ? 'role only' : 'anonymous'}.]

## Action Plan
| # | Action | Suggested Owner | Timeline |
|---|--------|-----------------|----------|
| 1 | ... | ... | Next 7 days |
| 2 | ... | ... | ... |

---
*Generated by Lapendaz Infinity*`
  }

  if (sessionType === 'Workshop') {
    return `You are writing a workshop summary for Lapendaz.

Workshop: "${title}"
Date: ${date}
Objective: "${goal}"
Participants: ${participantCount}

Responses collected:
${responsesFlat}

Write in this exact Markdown structure:

# ${title} — Workshop Summary
**Date:** ${date} | **Type:** Workshop | **Participants:** ${participantCount}

---

## Session Takeaways
[2–3 sentences: what participants experienced, learned, or shifted in thinking]

## Key Insights
- [insight 1]
- [insight 2]
- [insight 3]
- [insight 4]

## Activity Highlights

${perQuestion || '[No question slides were recorded.]'}

*(For each activity above: add **Themes:** (comma-separated) and optionally one Notable Response quote with ${attribution === 'named' ? 'full name' : attribution === 'role' ? 'role' : 'no attribution'}.)*

## Overall Group Energy
[1–2 sentences on participation quality, engagement, any surprises]

## Action Plan
- [action 1]
- [action 2]
- [action 3]

---
*Generated by Lapendaz Infinity*`
  }

  if (sessionType === 'Forum') {
    return `You are writing a public forum highlights report for Lapendaz.

Forum: "${title}"
Date: ${date}
Topic: "${goal}"
Audience size: ${participantCount}

Responses collected (all anonymous in this report):
${buildResponsesBlock(responses, 'anonymous')}

Write in this exact Markdown structure:

# ${title} — Forum Highlights
**Date:** ${date} | **Type:** Forum | **Audience:** ${participantCount} participants

---

## Event Overview
[2 sentences: what the forum was about, what it aimed to surface]

## Main Themes
[Top 4–5 themes that emerged across the audience's responses — bullet points]

## Audience Pulse
[1 paragraph: overall sentiment, energy level, recurring concerns or excitement]

## Notable Perspectives
> "[anonymous quote 1]"

> "[anonymous quote 2]"

> "[anonymous quote 3]"

## Key Takeaways
[What the audience collectively expressed, believed, or called for — 3–5 bullets]

## Recommendations
- [what organisers/facilitators should act on based on audience input]
- [follow-up topic or event recommendation]

---
*Generated by Lapendaz Infinity*`
  }

  // Training
  return `You are writing a training session report for Lapendaz.

Training: "${title}"
Date: ${date}
Learning Objective: "${goal}"
Participants: ${participantCount}

Responses collected:
${responsesFlat}

Write in this exact Markdown structure:

# ${title} — Training Report
**Date:** ${date} | **Type:** Training | **Participants:** ${participantCount}

---

## Training Overview
[2 sentences: what was covered, the core skill or mindset being developed]

## Session Takeaways
[The 3–4 most important concepts or skills from this training — bullet points]

## Participant Engagement

${perQuestion || '[No assessment questions were recorded.]'}

*(For each question above: list responses with ${attribution === 'named' ? 'full name' : attribution === 'role' ? 'role' : 'no attribution'}, then add an **Understanding Level:** line: Strong / Mixed / Needs reinforcement)*

## Participation Summary
| Participant | Responses Given | Highlight |
|-------------|-----------------|-----------|
[One row per participant. Use ${attribution === 'named' ? 'full name' : attribution === 'role' ? 'role' : 'anonymous'}.]

## Gaps & Recommended Follow-up
- [concept or skill that needs reinforcement]
- [suggested next training topic]
- [recommended resource or activity]

---
*Generated by Lapendaz Infinity*`
}

export async function generateSummary(
  title: string,
  goal: string,
  steps: Array<{ title: string; content: string; is_question: number }>,
  responses: Array<{ participant_name: string; participant_role: string; step_title: string; content: string }>,
  sessionType: SessionType = 'Meeting',
  attribution: AttributionMode = 'named'
): Promise<string> {
  const prompt = buildPrompt(title, goal, sessionType, attribution, steps, responses)

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}
