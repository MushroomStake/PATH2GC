import GetStartedButton from './components/GetStartedButton';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <main className="mx-auto w-full max-w-6xl px-6 py-20">
        <section className="mb-10 flex w-full items-start justify-between gap-8 rounded-lg bg-white p-8 shadow-sm">
          <div className="max-w-3xl">
            <h1 className="mb-4 text-4xl font-extrabold leading-tight text-[#006600]">Gordon College — Freshmen Admission Guide</h1>
            <p className="mb-6 text-lg text-gray-700">Find everything you need to apply to Gordon College as a freshman. Use the assistant to guide you step-by-step.</p>
            <div className="flex gap-4">
              <GetStartedButton />
              <a href="/admission" className="inline-flex items-center rounded-md border border-[#008000] px-5 py-3 text-sm font-medium text-[#008000]">Learn more</a>
            </div>
          </div>

          <div className="w-1/3 shrink-0">
            <div className="rounded border p-4">
              <h3 className="mb-2 text-lg font-semibold text-[#006600]">Announcement / Enrollment Bulletin</h3>
              <div className="text-sm text-gray-700">
                <p><strong>GCAT Online Application (First Semester A.Y. 2025-2026):</strong> Dec 18, 2024 — Mar 14, 2025.</p>
                <p className="mt-2"><strong>GCAT starts:</strong> March 3, 2025.</p>
                <hr className="my-2" />
                <p className="text-sm"><strong>Application Requirements:</strong></p>
                <ul className="list-disc pl-5 text-sm">
                  <li>Recent Good Moral Character Certificate</li>
                  <li>PSA Authenticated Birth Certificate</li>
                  <li>Senior High School ID or Any Valid ID Card</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <h2 className="mb-3 text-2xl font-bold text-[#006600]">Vision</h2>
            <p className="text-gray-700">A globally recognized local institution committed to innovative academic excellence, holistic and sustainable development, inclusivity, and community engagement.</p>
          </div>
          <div className="rounded-lg border p-6">
            <h2 className="mb-3 text-2xl font-bold text-[#006600]">Mission</h2>
            <p className="text-gray-700">Produce empowered global citizens who create sustainable impact, uphold values of character, excellence, and service, and contribute to academic and societal development.</p>
          </div>
        </section>

        <section className="mt-10 rounded-lg border p-6">
          <h3 className="mb-3 text-xl font-semibold text-[#006600]">Freshmen Admission — Quick Procedures</h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>STEP 1 — CREATE ONLINE PORTAL ACCOUNT</strong></p>
            <ol className="list-decimal pl-5">
              <li>Go to Gordon College Admission Portal: <a className="text-[#006600]" href="https://gordoncollege.edu.ph/gca/student/">https://gordoncollege.edu.ph/gca/student/</a></li>
              <li>Click “Create Account” and register with your email and personal details. Use a valid email and don’t create multiple accounts.</li>
            </ol>

            <p className="mt-3"><strong>STEP 2 — LOG ON TO YOUR ACCOUNT</strong></p>
            <ol className="list-decimal pl-5">
              <li>Log in using your registered email and password; the Dashboard shows application status.</li>
            </ol>

            <p className="mt-3"><strong>STEP 3 — PROFILING</strong></p>
            <ol className="list-decimal pl-5">
              <li>Upload a recent 2x2 colored photo (white background). No eyeglasses or accessories; formal collared top.</li>
              <li>Complete all profile forms (Personal Info, Family Background, Desired Programs) and accept the Data Privacy Notice.</li>
            </ol>

            <p className="mt-3"><strong>STEP 4 — UPLOADING OF DOCUMENTS</strong></p>
            <ol className="list-decimal pl-5">
              <li>Upload scanned documents (2MB or less): Good Moral Certificate, PSA Birth Certificate, Senior High School ID or any valid ID.</li>
              <li>Submit uploads to finalize.</li>
            </ol>

            <p className="mt-3"><strong>STEP 5 — GCAT SCHEDULE</strong></p>
            <ol className="list-decimal pl-5">
              <li>Check your portal for the GCAT schedule. Download the GCAT schedule slip and Student Information Sheet when posted.</li>
            </ol>

            <p className="mt-4"><strong>What to bring on test day:</strong></p>
            <ul className="list-disc pl-5">
              <li>GCAT Schedule Slip</li>
              <li>Student Information Sheet</li>
              <li>Senior High School or any valid ID Card</li>
              <li>Pencil and Pen</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
