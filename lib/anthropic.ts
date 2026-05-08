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
  host: string,
  sessionType: SessionType,
  attribution: AttributionMode,
  steps: Array<{ title: string; content: string; type: string; is_question: number }>,
  responses: Array<{ participant_name: string; participant_role: string; step_title: string; content: string }>,
  participants: Array<{ name: string; role: string }>
): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const questionSteps = steps.filter(s => s.is_question)
  const contentSteps = steps.filter(s => s.type !== 'question' && s.type !== 'reflection')

  const perQuestion = questionSteps.map(step => {
    const stepResponses = responses.filter(r => r.step_title === step.title)
    const lines = stepResponses.map(r =>
      `> "${r.content}" — ${formatAttribution(r, attribution)}`
    ).join('\n')
    return `### ${step.title}\n${lines || '> *No responses collected.*'}\n\n**Synthesis:** [write 1–2 sentences on what emerged, or note if no responses]`
  }).join('\n\n---\n\n')

  const responsesFlat = buildResponsesBlock(responses, attribution)

  const attendanceLines = participants.length > 0
    ? participants.map(p => `- ${p.name} (${p.role}) — Present`).join('\n')
    : '- No participants recorded'

  const contentSlidesBlock = contentSteps.map(s =>
    `SLIDE "${s.title}":\n${s.content}`
  ).join('\n\n')

  if (sessionType === 'Meeting') {
    return `You are writing formal, professional meeting minutes for Lapendaz.

SESSION DETAILS:
- Title: "${title}"
- Date: ${date}
- Host: ${host || 'N/A'}
- Objective: "${goal}"
- Participants who attended: ${participants.length}

ATTENDANCE LIST:
${attendanceLines}

CONTENT SLIDES (for Event Contents Summary — these are the slides presented, NOT questions):
${contentSlidesBlock}

DISCUSSION QUESTIONS WITH RESPONSES:
${perQuestion || '[No question slides recorded.]'}

ALL RESPONSES (flat):
${responsesFlat}

Write the meeting minutes in this EXACT Markdown structure. Do not add or remove any sections.

# ${title} — Meeting Minutes
**Date:** ${date} | **Type:** Meeting | **Host:** ${host || 'N/A'}

---

## Attendance
${attendanceLines}

---

## Executive Summary
[2–3 sentences: what was presented, who attended, and what direction or outcome was reached]

---

## Event Contents Summary
*Key knowledge points covered in this session (questions and reflections excluded).*

[Organise the CONTENT SLIDES into 4–6 logical thematic groups. For each group use this format:

### [Group Theme Title]
- [concise key point]
- [concise key point]
- [concise key point]

Base the groups strictly on the CONTENT SLIDES provided above. Do NOT include question or reflection content here.]

---

## Discussion Breakdown

${perQuestion || '### [No question slides were recorded in this session.]'}

---

## Key Takeaways

### Knowledge Covered
[3–5 bullets: most important concepts from the content slides that participants should remember and apply]

### Participant Outcomes
[2–4 bullets: what participants committed to, identified, or walked away with — based on their responses. If no responses, note what the session intended for participants to achieve.]

### Facilitator Observations
[2–3 bullets: observations about group engagement, learning gaps, or recommendations for next session]

---

## Decisions Made
[Bullet list of decisions or alignments reached. If none clearly stated, note what was implicitly agreed upon.]

---

## Individual Commitments
| Participant | Commitment Made |
|-------------|----------------|
[One row per participant who expressed a clear commitment. Use ${attribution === 'named' ? 'full name' : attribution === 'role' ? 'role only' : 'anonymous'}. If none recorded, write a single row with "—" and "No commitments recorded."]

---

## Action Plan
| # | Action | Owner | Timeline |
|---|--------|-------|----------|
[Generate 3–5 specific, actionable items based on the session content and participant responses. Be concrete.]

---
*Generated by Lapendaz Infinity*`
  }

  if (sessionType === 'Workshop') {
    const pCount = participants.length
    return `You are writing a workshop summary for Lapendaz.

Workshop: "${title}"
Date: ${date}
Host: ${host || 'N/A'}
Objective: "${goal}"
Participants: ${pCount}

Responses collected:
${responsesFlat}

Write in this exact Markdown structure:

# ${title} — Workshop Summary
**Date:** ${date} | **Type:** Workshop | **Host:** ${host || 'N/A'} | **Participants:** ${pCount}

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
    const pCount = participants.length
    return `You are writing a public forum highlights report for Lapendaz.

Forum: "${title}"
Date: ${date}
Host: ${host || 'N/A'}
Topic: "${goal}"
Audience size: ${pCount}

Responses collected (all anonymous in this report):
${buildResponsesBlock(responses, 'anonymous')}

Write in this exact Markdown structure:

# ${title} — Forum Highlights
**Date:** ${date} | **Type:** Forum | **Host:** ${host || 'N/A'} | **Audience:** ${pCount} participants

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
- [what organisers/hostors should act on based on audience input]
- [follow-up topic or event recommendation]

---
*Generated by Lapendaz Infinity*`
  }

  // Training
  const pCount = participants.length
  return `You are writing a training session report for Lapendaz.

Training: "${title}"
Date: ${date}
Host: ${host || 'N/A'}
Learning Objective: "${goal}"
Participants: ${pCount}

Responses collected:
${responsesFlat}

Write in this exact Markdown structure:

# ${title} — Training Report
**Date:** ${date} | **Type:** Training | **Host:** ${host || 'N/A'} | **Participants:** ${pCount}

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
  steps: Array<{ title: string; content: string; type: string; is_question: number }>,
  responses: Array<{ participant_name: string; participant_role: string; step_title: string; content: string }>,
  participants: Array<{ name: string; role: string }> = [],
  sessionType: SessionType = 'Meeting',
  attribution: AttributionMode = 'named',
  host: string = ''
): Promise<string> {
  const prompt = buildPrompt(title, goal, host, sessionType, attribution, steps, responses, participants)

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}
