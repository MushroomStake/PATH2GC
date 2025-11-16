import GetStartedButton from './components/GetStartedButton';

export default function Home() {
  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <main className="mx-auto w-full max-w-6xl px-6 py-12">
        <section className="mb-8 w-full rounded-lg p-6 shadow-sm md:flex md:items-start md:justify-between md:gap-8" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
          <div className="max-w-3xl">
            <h1 className="mb-4 text-3xl sm:text-4xl font-extrabold leading-tight" style={{ color: 'var(--nav-accent)' }}>Gordon College — Admission Guide</h1>
            <p className="mb-6 text-base sm:text-lg" style={{ color: 'var(--foreground)', opacity: 0.9 }}>Find everything you need to apply to Gordon College. Use the assistant to guide you step-by-step.</p>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <GetStartedButton />
              <a href="/about" className="inline-flex items-center justify-center rounded-md border px-5 py-3 text-sm font-medium" style={{ borderColor: 'var(--nav-accent)', color: 'var(--nav-accent)' }}>Learn more</a>
            </div>
          </div>

          <div className="mt-6 w-full md:mt-0 md:w-1/3">
            <div className="rounded border p-4" style={{ borderColor: 'var(--card-border)' }}>
              <h3 className="mb-2 text-lg font-semibold" style={{ color: 'var(--nav-accent)' }}>Announcement / Enrollment Bulletin</h3>
              <div className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.92 }}>
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
          <div className="rounded-lg border p-6" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="mb-3 text-2xl font-bold" style={{ color: 'var(--nav-accent)' }}>Vision</h2>
            <p style={{ color: 'var(--foreground)', opacity: 0.9 }}>A globally recognized local institution committed to innovative academic excellence, holistic and sustainable development, inclusivity, and community engagement.</p>
          </div>
          <div className="rounded-lg border p-6" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="mb-3 text-2xl font-bold" style={{ color: 'var(--nav-accent)' }}>Mission</h2>
            <p style={{ color: 'var(--foreground)', opacity: 0.9 }}>Produce empowered global citizens who create sustainable impact, uphold values of character, excellence, and service, and contribute to academic and societal development.</p>
          </div>
        </section>

        {/* Freshmen Admission quick procedures section removed per request */}
      </main>
    </div>
  );
}
