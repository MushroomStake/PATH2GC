"use client";
import Link from "next/link";

export default function NavBar() {
  return (
    <header className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#008000]">
            <span className="text-sm font-semibold text-white">PG</span>
          </div>
          <span className="text-lg font-semibold text-[#008000]">Path2GC</span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          <Link href="/" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">Home</Link>
          <Link href="/about" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">About</Link>
          <Link href="/profile" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">Profile</Link>
        </nav>

        {/* Mobile menu button (simple) */}
        <div className="sm:hidden">
          <button aria-label="open menu" className="inline-flex items-center justify-center rounded-md p-2 text-[#006600]">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
