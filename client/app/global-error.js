'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body className="min-h-screen bg-[#0b0f17] text-white flex items-center justify-center p-8">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">AccessLM encountered an error</h1>
          <p className="mt-2 text-sm text-white/70">
            {error?.message || 'A global error occurred while loading the app.'}
          </p>
          <button
            onClick={() => reset()}
            className="mt-4 w-full rounded-lg bg-white/90 text-black py-2 text-sm font-semibold hover:bg-white"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
