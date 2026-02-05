'use client';

export default function Error({ error, reset }) {
  return (
    <div className="min-h-screen bg-[#0b0f17] text-white flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/70">
          {error?.message || 'An unexpected error occurred while rendering this page.'}
        </p>
        <button
          onClick={() => reset()}
          className="mt-4 w-full rounded-lg bg-white/90 text-black py-2 text-sm font-semibold hover:bg-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
