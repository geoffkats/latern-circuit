import Link from "next/link";
import { copy } from "@/lib/copy/en";
import { phase1Levels } from "@/lib/levels/load-level";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-amber-800">
          {copy.productName}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          {copy.productName}
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600">
          {copy.homeLead}
        </p>
      </header>

      <ol className="space-y-3">
        {phase1Levels.map((level, index) => (
          <li key={level.id}>
            <Link
              href={`/play/${level.id}`}
              className="flex items-baseline justify-between gap-4 border-b border-zinc-200 py-3 transition hover:border-amber-700"
            >
              <span className="text-zinc-900">
                <span className="mr-3 text-sm text-zinc-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {level.title}
              </span>
              <span className="text-sm text-amber-800">{copy.play}</span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
