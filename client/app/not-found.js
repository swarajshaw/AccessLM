export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0b0f17] text-white flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-white/70">
          The page you are looking for does not exist.
        </p>
        <a
          href="/"
          className="mt-4 block w-full rounded-lg bg-white/90 text-black py-2 text-center text-sm font-semibold hover:bg-white"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
