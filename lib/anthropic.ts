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

export async function generateSummary(
  title: string,
  goal: string,
  steps: Array<{ title: string; content: string; is_question: number }>,
  responses: Array<{ participant_name: string; participant_role: string; step_title: string; content: string }>
): Promise<string> {
  const responsesText = responses.map(r =>
    `[${r.participant_role} - ${r.participant_name}] on "${r.step_title}": ${r.content}`
  ).join('\n')

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are summarizing a meeting for Lapendaz (智赛团), an education-led happiness ecosystem company.

Meeting: "${title}"
Goal: "${goal}"

Participant Responses:
${responsesText || 'No responses collected yet.'}

Write a comprehensive meeting summary in this structure:

# ${title} — Meeting Summary

## 🎯 Meeting Objective
[One paragraph on what this meeting aimed to achieve]

## 💡 Key Insights & Themes
[3-5 bullet points of the most important insights from participant responses]

## 👥 Participant Voices
[Quote or paraphrase the most meaningful responses, attributed by role]

## ✅ Collective Consensus
[What the group agreed on or aligned around]

## 🚀 Next Steps
[3-5 concrete action items that emerge from this meeting]

## 🌟 Closing Note
[One empowering paragraph to close]

Write in a tone that is professional, warm, and forward-looking. Use both English and Chinese naturally where appropriate.`
    }]
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}
