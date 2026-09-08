"use client";

/**
 * Request-time fallback for the authenticated shell. Turns a DB / setup failure
 * (no DATABASE_URL, migrations not run, empty database) into a legible page
 * instead of a raw 500 — the build itself never touches the database, so any
 * error here is an environment problem, not a code one.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDbSetup =
    /DATABASE_URL|No tenant found|db:migrate|PGlite|ECONNREFUSED|relation .* does not exist/i.test(
      error.message,
    );

  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="eyebrow mb-2">
        {isDbSetup ? "Database not configured" : "Something went wrong"}
      </div>
      <h1 className="display-lg mb-3 text-[24px]">
        {isDbSetup ? "This deployment needs a database" : "Unexpected error"}
      </h1>
      {isDbSetup ? (
        <div className="meta flex flex-col gap-3 leading-relaxed">
          <p>
            Set <code>DATABASE_URL</code> to a Postgres connection string (Vercel
            Postgres, Neon, Supabase, RDS…), then apply migrations and seed:
          </p>
          <pre className="card overflow-x-auto p-3 text-[12px] text-[var(--fg)]">
{`DATABASE_URL=postgres://…  npm run db:migrate
DATABASE_URL=postgres://…  npm run seed`}
          </pre>
          <p>
            The embedded PGlite fallback is for local development only — managed
            hosts have no persistent writable filesystem.
          </p>
        </div>
      ) : (
        <p className="meta leading-relaxed">{error.message}</p>
      )}
      <button
        onClick={reset}
        className="mt-6 rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
        style={{ background: "var(--color-violet-600)" }}
      >
        Try again
      </button>
    </div>
  );
}
