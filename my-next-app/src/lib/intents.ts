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

// Regex-first intent matcher, with token-overlap fallback against examples
export function matchIntent(text: string): IntentMatch {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  if (!t) return null;

  for (const it of INTENTS) {
    for (const r of it.regexes) {
      if (r.test(t)) return { id: it.id, confidence: 0.9, reason: 'regex' };
    }
  }

  const tokenize = (s: string) => (s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter(w => w.length > 2);
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
    const confidence = Math.min(0.89, 0.2 + bestScore * 0.8);
    if (!best || confidence > best.confidence) {
      best = { id: it.id, confidence, reason: 'examples' };
    }
  }

  if (best) {
    const cfg = INTENTS.find(i => i.id === best!.id)!;
    if (best.confidence >= cfg.minConfidence) return best;
  }
  return null;
}

// Renderer functions: given DB rows, build a deterministic reply + sources
export function renderIntentResponse(intentId: IntentId, allSteps: any[], topFaqs: any[], completedSteps: number[] = []) {
  const sources: Array<{ type: 'step' | 'faq'; id: any; title: string }> = [];
  const lines: string[] = [];
  let nextStep: any = null;

  // Deduplicate steps and faqs by id early
  const uniqStepsById = (allSteps || []).reduce((acc: Map<any, any>, s: any) => {
    if (s && s.id != null && !acc.has(s.id)) acc.set(s.id, s);
    return acc;
  }, new Map<any, any>());
  const uniqSteps = Array.from(uniqStepsById.values()).slice();
  uniqSteps.sort((a: any, b: any) => (Number(a.step_order) || 0) - (Number(b.step_order) || 0));

  const uniqFaqsById = (topFaqs || []).reduce((acc: Map<any, any>, f: any) => {
    if (f && f.id != null && !acc.has(f.id)) acc.set(f.id, f);
    return acc;
  }, new Map<any, any>());
  const uniqFaqs = Array.from(uniqFaqsById.values());

  switch (intentId) {
    case 'how_to_apply':
      lines.push('To apply, follow these steps:');

      // Collect a deduplicated documents list from step checklists and FAQs
      const docSet = new Set<string>();

      // Limit the number of steps shown and dedupe by title to avoid repeated content
      const maxSteps = 4;
      const seenTitles = new Set<string>();
      const stepsToShow: any[] = [];
      for (const s of uniqSteps) {
        const norm = (s.title || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
        if (!norm) continue;
        if (seenTitles.has(norm)) continue;
        seenTitles.add(norm);
        stepsToShow.push(s);
        if (stepsToShow.length >= maxSteps) break;
      }

      for (const s of stepsToShow) {
        // short description (first sentence) to keep replies concise
        const desc = s.description ? String(s.description).split(/[\.\!\?]\s/)[0] : '';
        const header = `${s.step_order || ''}. ${s.title}${desc ? ` — ${desc}` : ''}`.trim();
        lines.push(header);

        if (s.checklist) {
          const cl = s.checklist;
          const maxItems = 3;
          let added = 0;
          if (Array.isArray(cl)) {
            for (const item of cl) {
              if (added >= maxItems) break;
              let label = '';
              if (typeof item === 'string') label = item;
              else if (item && typeof item === 'object') label = (item.item || item.label || item.name || item.title || item.text || item.description || Object.values(item).find((v: any) => typeof v === 'string') || JSON.stringify(item));
              if (label) {
                lines.push(`  - ${label}`);
                const lower = label.toLowerCase();
                if (lower.includes('birth') || lower.includes('transcript') || lower.includes('certificate') || lower.includes('id') || lower.includes('photo') || lower.includes('report card')) {
                  docSet.add(label);
                }
                added++;
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
      if (uniqFaqs.length) {
        lines.push('\nHelpful FAQs:');
        // limit number of FAQs and keep answers short
        const maxFaqs = 3;
        let fcount = 0;
        for (const f of uniqFaqs) {
          if (fcount >= maxFaqs) break;
          const a = (f.answer || '').toString().split(/\n/).map((s: string) => s.trim()).filter(Boolean).join(' ');
          const shortA = a.split(/[\.\!\?]\s/)[0];
          lines.push(`Q: ${f.question}\nA: ${shortA}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
          try {
            const ans = (f.answer || '').toString();
            const docMatches = ans.match(/(birth certificate|transcript|report card|2x2|2x2 photo|id photo|medical certificate|barangay certificate|application form|online form|certificate of good moral)/ig);
            if (docMatches) for (const d of docMatches) docSet.add(d);
          } catch (e) {
            // ignore
          }
          fcount++;
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

      // compute next step based on completedSteps and available uniqSteps
      try {
        const ordered = uniqSteps.slice().sort((a,b) => (a.step_order || 0) - (b.step_order || 0));
        for (const s of ordered) {
          const n = Number(s.step_order);
          if (!completedSteps.includes(n)) { nextStep = s; break; }
        }
      } catch (e) {
        // ignore
      }
      break;

    case 'required_documents':
      lines.push('Required documents to apply:');
      // Try to extract checklist fields from steps first
      for (const s of uniqSteps) {
        if (s.checklist) {
          const cl = s.checklist;
          lines.push(`- ${s.title}:`);
          if (Array.isArray(cl)) {
            for (const item of cl) {
              if (typeof item === 'string') lines.push(`  - ${item}`);
              else if (item && typeof item === 'object') {
                const label = item.item || item.label || item.name || item.title || item.text || item.description || Object.values(item).find((v: any) => typeof v === 'string') || JSON.stringify(item);
                lines.push(`  - ${label}`);
              } else lines.push(`  - ${String(item)}`);
            }
          } else if (typeof cl === 'string') {
            lines.push(`- ${s.title}: ${cl}`);
          } else {
            lines.push(`- ${s.title}: ${JSON.stringify(cl)}`);
          }
          sources.push({ type: 'step', id: s.id, title: s.title });
        }
      }
      // If none, fallback to FAQs
      if (lines.length === 1 && uniqFaqs.length) {
        for (const f of uniqFaqs) {
          lines.push(`- ${f.question}: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
        }
      }
      if (lines.length === 1) lines.push('We do not have a specific documents list in the database; please check the Admissions page or contact the office.');
      break;

    case 'deadlines':
      if (uniqFaqs.length) {
        lines.push('Deadlines and timing:');
        for (const f of uniqFaqs) {
          lines.push(`- ${f.question}: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
        }
      } else if (uniqSteps && uniqSteps.length) {
        lines.push('Relevant steps with timing:');
        for (const s of uniqSteps) {
          lines.push(`- ${s.step_order}. ${s.title}${s.description ? ` — ${s.description}` : ''}`);
          sources.push({ type: 'step', id: s.id, title: s.title });
        }
      } else {
        lines.push('No deadlines found in the database; please check the Admissions announcements or contact the admissions office.');
      }
      break;

    case 'fees':
      if (uniqFaqs.length) {
        lines.push('Fees and payment information:');
        for (const f of uniqFaqs) {
          lines.push(`- ${f.question}: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
        }
      } else {
        lines.push('Fee details are not available in the database; please consult the Admissions page for fee schedules.');
      }
      break;

    case 'scholarships':
      if (uniqFaqs.length) {
        lines.push('Scholarships and financial aid:');
        for (const f of uniqFaqs) {
          lines.push(`- ${f.question}: ${f.answer}`);
          sources.push({ type: 'faq', id: f.id, title: f.question });
        }
      } else {
        lines.push('No scholarship info found; please check the Scholarships page or contact the financial aid office.');
      }
      break;

    case 'contact_info':
      if (uniqFaqs.length) {
        lines.push('Admissions contact info:');
        for (const f of uniqFaqs) {
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

  const result: any = { reply: lines.join('\n\n'), sources };
  if (nextStep) result.nextStep = { id: nextStep.id, step_order: nextStep.step_order, title: nextStep.title, description: nextStep.description };

  // Remove duplicate paragraphs in the final reply
  try {
    const para = result.reply.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);
    const seen = new Set<string>();
    const uniquePara: string[] = [];
    for (const p of para) {
      if (!seen.has(p)) {
        seen.add(p);
        uniquePara.push(p);
      }
    }
    result.reply = uniquePara.join('\n\n');
  } catch (e) {
    // ignore
  }

  // Build a short one-line TL;DR to surface in the UI
  try {
    let tldr = '';
    if (result.nextStep) {
      tldr = `Next: Step ${result.nextStep.step_order}. ${result.nextStep.title}`;
    } else {
      const substantive = lines.find(l => l && l.trim().length > 20 && !/to apply/i.test(l));
      if (substantive) tldr = substantive.split('\n')[0].replace(/\s+/g, ' ').slice(0, 200);
      else tldr = lines.join(' ').replace(/\s+/g, ' ').slice(0, 200);
    }
    result.tldr = tldr;
  } catch (e) {
    result.tldr = '';
  }

  return result;
}

