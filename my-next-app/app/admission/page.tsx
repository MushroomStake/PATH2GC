"use server";
import Link from 'next/link';
import { getSupabaseAdmin } from '../../src/lib/supabaseServer';

export default async function AdmissionLanding() {
  // Fetch admission steps server-side (requires SUPABASE_SERVICE_ROLE)
  let steps: Array<{ id: string; step_order: number; title: string; description: string }> = [];
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.from('admission_steps').select('id,step_order,title,description').order('step_order', { ascending: true });
    if (!error && data) {
      steps = data as any;
    }
  } catch (e) {
    console.error('Failed to load admission steps', e);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-4 text-3xl font-bold text-[#006600]">Admission — Freshmen Guide</h1>
  <p className="mb-6 text-gray-700">Follow the steps below to complete your application. If you need help, consult the FAQs or contact the admissions office.</p>

      <ol className="space-y-4">
        {steps.map((s) => (
          <li key={s.id} className="rounded-md border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{s.step_order}. {s.title}</h3>
                <p className="text-sm text-gray-600">{s.description.slice(0, 200)}{s.description.length > 200 ? '...' : ''}</p>
              </div>
              <div>
                <Link href={`/admission/${s.id}`} className="inline-flex items-center rounded-md border border-[#008000] px-3 py-2 text-sm font-medium text-[#008000]">View</Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
