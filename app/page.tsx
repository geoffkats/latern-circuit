export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-amber-700 dark:text-amber-300">
        Lantern Circuit
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        A Python game about walking a grid.
      </h1>
      <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        Nia walks the adventure maps. Pebble rolls the robot halls. This build
        is the simulator: the rules that decide a move, a wall, and a win.
        Levels, the Python runner, and the player come next.
      </p>
    </main>
  );
}
