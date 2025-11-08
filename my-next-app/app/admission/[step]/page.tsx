"use server";
import { getSupabaseAdmin } from '../../../src/lib/supabaseServer';

type Props = { params: { step: string } };

export default async function StepPage({ params }: Props) {
  const { step } = params;
  // step is expected to be the UUID id of the admission_steps row
  let stepRow: { id: string; step_order: number; title: string; description: string; checklist?: any } | null = null;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.from('admission_steps').select('*').eq('id', step).limit(1).single();
    if (!error && data) stepRow = data as any;
  } catch (e) {
    console.error('Failed to fetch step', e);
  }

  if (!stepRow) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-bold text-[#006600]">Step not found</h1>
        <p className="text-gray-700">We couldn't find that admission step. Try the Admissions landing page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-4 text-2xl font-bold text-[#006600]">{stepRow.step_order}. {stepRow.title}</h1>
      <p className="mb-6 text-gray-700">{stepRow.description}</p>

      {stepRow.checklist && (
        <div className="prose max-w-none">
          <h3>Checklist</h3>
          <ul>
            {Array.isArray(stepRow.checklist) ? stepRow.checklist.map((it: any, idx: number) => <li key={idx}>{it.item || JSON.stringify(it)}</li>) : <li>{String(stepRow.checklist)}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
