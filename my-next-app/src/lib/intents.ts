export type IntentId =
  | 'how_to_apply'
  | 'required_documents'
  | 'deadlines'
  | 'fees'
  | 'scholarships'
  | 'contact_info';

export type IntentMatch = { id: IntentId; confidence: number; reason?: string } | null;

const INTENTS: {
  id: IntentId;
  regexes: RegExp[];
  examples: string[];
  minConfidence: number;
}[] = [
  {
    id: 'how_to_apply',
    regexes: [/how\s+to\s+apply/i, /how\s+do\s+i\s+apply/i, /apply\s+(as|for|to)/i, /application\s+process/i],
    examples: ['How do I apply?', 'What is the application process?'],
    minConfidence: 0.7,
  },
  {
    id: 'required_documents',
    regexes: [/what\s+documents/i, /required\s+documents/i, /what\s+do\s+i\s+need\s+to\s+apply/i, /documents\s+needed/i],
    examples: ['What documents do I need?', 'Required documents for application'],
    minConfidence: 0.7,
  },
  {
    id: 'deadlines',
    regexes: [/deadline/i, /when\s+is\s+the\s+deadline/i, /due\s+date/i],
    examples: ['When is the application deadline?', 'Deadline for admissions?'],
    minConfidence: 0.6,
  },
  {
    id: 'fees',
    regexes: [/fee/i, /how\s+much\s+is\s+the\s+application\s+fee/i, /tuition/i],
    examples: ['How much is the application fee?', 'Application fees and costs'],
    minConfidence: 0.6,
  },
  {
    id: 'scholarships',
    regexes: [/scholarship/i, /financial\s+aid/i, /grants/i],
    examples: ['Are there scholarships?', 'How to apply for financial aid?'],
    minConfidence: 0.6,
  },
  {
    id: 'contact_info',
    regexes: [/contact/i, /office\s+hours/i, /admissions\s+office/i, /phone\s+number/i, /email\s+address/i],
    examples: ['How do I contact admissions?', 'Admissions office phone number'],
    minConfidence: 0.6,
  },
];

// Simple intent matcher: prefers regex hits (high confidence) then falls back to token overlap with examples
export function matchIntent(text: string): IntentMatch {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  if (!t) return null;

  // Regex-first: if any intent regex matches, return with high confidence
  for (const it of INTENTS) {
    for (const r of it.regexes) {
      if (r.test(t)) return { id: it.id, confidence: 0.9, reason: 'regex' };
    }
  }

  // Token overlap with examples as fallback
  const tokenize = (s: string) => (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).filter(w => w.length > 2);
  const qTokens = new Set(tokenize(t));
  if (qTokens.size === 0) return null;

  let best: IntentMatch = null;
  for (const it of INTENTS) {
    let bestScore = 0;
    for (const ex of it.examples) {
      const exTokens = tokenize(ex);
      let matches = 0;
      for (const tok of exTokens) if (qTokens.has(tok)) matches++;
      const score = matches / Math.max(1, exTokens.length);
      if (score > bestScore) bestScore = score;
    }
    // Map score to confidence range (small weight)
    const confidence = Math.min(0.89, 0.2 + bestScore * 0.8);
    if (!best || confidence > best.confidence) {
      best = { id: it.id, confidence, reason: 'examples' };
    }
  }

  // Apply intent's minConfidence threshold
  if (best) {
    const cfg = INTENTS.find(i => i.id === best!.id)!;
    if (best.confidence >= cfg.minConfidence) return best;
  }
  return null;
}

// Renderer functions: given DB rows, build a deterministic reply + sources
export function renderIntentResponse(intentId: IntentId, topSteps: any[], topFaqs: any[]) {
  const sources: Array<{ type: 'step' | 'faq'; id: any; title: string }> = [];
  const lines: string[] = [];
  switch (intentId) {
    case 'how_to_apply':
      lines.push('To apply, follow these steps:');

      // Collect a deduplicated documents list from step checklists and FAQs
      const docSet = new Set<string>();

      for (const s of topSteps) {
        let header = `${s.step_order}. ${s.title}`;
        if (s.description) header += ` — ${s.description}`;
        lines.push(header);

        // If step has checklist, render items and collect documents where applicable
        if (s.checklist) {
          const cl = s.checklist;
          if (Array.isArray(cl)) {
            for (const item of cl) {
              let label = '';
              if (typeof item === 'string') label = item;
              else if (item && typeof item === 'object') label = (item.item || item.label || item.name || item.title || item.text || item.description || Object.values(item).find(v => typeof v === 'string') || JSON.stringify(item));
              if (label) {
                lines.push(`  - ${label}`);
                // heuristics to capture common document keywords
                const lower = label.toLowerCase();
                if (lower.includes('birth') || lower.includes('transcript') || lower.includes('certificate') || lower.includes('id') || lower.includes('photo') || lower.includes('report card')) {
                  docSet.add(label);
                }
              }
            }
          } else if (typeof cl === 'string') {
            lines.push(`  - ${cl}`);
            const lower = cl.toLowerCase();
            if (lower.includes('birth') || lower.includes('transcript') || lower.includes('certificate') || lower.includes('id') || lower.includes('photo') || lower.includes('report card')) docSet.add(cl);
          }
        }

        sources.push({ type: 'step', id: s.id, title: s.title });
      }

      // Helpful FAQs: include concise Q/A and harvest any document mentions
      if (topFaqs.length) {
        lines.push('\nHelpful FAQs:');
        for (const f of topFaqs) {
          lines.push(`Q: ${f.question}\nA: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
          try {
            const ans = (f.answer || '').toString();
            const docMatches = ans.match(/(birth certificate|transcript|report card|2x2|2x2 photo|id photo|medical certificate|barangay certificate|application form|online form|certificate of good moral)/ig);
            if (docMatches) for (const d of docMatches) docSet.add(d);
          } catch (e) {
            // ignore
          }
        }
      }

      // Suggested next steps to guide the applicant
      lines.push('\nSuggested next steps:');
      lines.push('- Create an account on the Admissions portal (if required) and keep your login details safe.');
      if (docSet.size) {
        lines.push(`- Prepare the following documents for upload or submission:`);
        for (const d of Array.from(docSet)) lines.push(`  - ${d}`);
      } else {
        lines.push('- Gather common documents: birth certificate, transcript/report card, Barangay residency certificate, 2x2 ID photo, medical certificate, and Certificate of Good Moral Character.');
      }
      lines.push('- Complete the online application form and attach scanned copies of your documents.');
      lines.push('- Pay any required application fees (if applicable) and keep the payment receipt.');
      lines.push('- Monitor your email for confirmation and further instructions (exams, interview schedules).');
      lines.push('- If unsure, contact the Admissions office for clarification and exact requirements.');
      break;
    case 'required_documents':
      lines.push('Required documents to apply:');
      // Try to extract checklist fields from steps first
      for (const s of topSteps) {
        if (s.checklist) {
          // checklist may be a string, array of strings, or array of objects. Render cleanly.
          const cl = s.checklist;
          if (Array.isArray(cl)) {
            lines.push(`- ${s.title}:`);
            for (const item of cl) {
              if (typeof item === 'string') {
                lines.push(`  - ${item}`);
              } else if (item && typeof item === 'object') {
                // try common fields (include 'item' and 'description')
                const label = item.item || item.label || item.name || item.title || item.text || item.description || Object.values(item).find(v => typeof v === 'string') || JSON.stringify(item);
                lines.push(`  - ${label}`);
              } else {
                lines.push(`  - ${String(item)}`);
              }
            }
          } else if (typeof cl === 'string') {
            lines.push(`- ${s.title}: ${cl}`);
          } else {
            // fallback to JSON
            lines.push(`- ${s.title}: ${JSON.stringify(cl)}`);
          }
          sources.push({ type: 'step', id: s.id, title: s.title });
        }
      }
      // If none, fallback to FAQs
      if (lines.length === 1 && topFaqs.length) {
        for (const f of topFaqs) {
          lines.push(`- ${f.question}: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
        }
      }
      if (lines.length === 1) lines.push('We do not have a specific documents list in the database; please check the Admissions page or contact the office.');
      break;
    case 'deadlines':
      if (topFaqs.length) {
        lines.push('Deadlines and timing:');
        for (const f of topFaqs) {
          lines.push(`- ${f.question}: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
        }
      } else if (topSteps.length) {
        lines.push('Relevant steps with timing:');
        for (const s of topSteps) {
          lines.push(`- ${s.step_order}. ${s.title} — ${s.description}`);
          sources.push({ type: 'step', id: s.id, title: s.title });
        }
      } else {
        lines.push('No deadlines found in the database; please check the Admissions announcements or contact the admissions office.');
      }
      break;
    case 'fees':
      if (topFaqs.length) {
        lines.push('Fees and payment information:');
        for (const f of topFaqs) {
          lines.push(`- ${f.question}: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
        }
      } else {
        lines.push('Fee details are not available in the database; please consult the Admissions page for fee schedules.');
      }
      break;
    case 'scholarships':
      if (topFaqs.length) {
        lines.push('Scholarships and financial aid:');
        for (const f of topFaqs) {
          lines.push(`- ${f.question}: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
        }
      } else {
        lines.push('No scholarship info found; please check the Scholarships page or contact the financial aid office.');
      }
      break;
    case 'contact_info':
      if (topFaqs.length) {
        lines.push('Admissions contact info:');
        for (const f of topFaqs) {
          lines.push(`- ${f.question}: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
        }
      } else {
        lines.push('Contact the Admissions office via the Admissions page for phone numbers and office hours.');
      }
      break;
    default:
      lines.push('I can help with admissions questions.');
  }

  return { reply: lines.join('\n\n'), sources };
}
