import React from 'react';

export const EditorialPageSkeleton: React.FC = () => (
  <main
    aria-busy="true"
    aria-label="Cargando contenido editorial"
    className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-pulse"
  >
    <div className="space-y-3 border-b border-neutral-200 dark:border-neutral-800 pb-6">
      <div className="h-3.5 w-28 rounded bg-neutral-300 dark:bg-neutral-800" />
      <div className="h-9 sm:h-11 w-2/3 rounded bg-neutral-300 dark:bg-neutral-800" />
      <div className="h-4 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800/70" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] overflow-hidden"
        >
          <div className="aspect-[4/3] bg-neutral-200 dark:bg-neutral-800" />
          <div className="p-5 space-y-3">
            <div className="h-3 w-24 rounded bg-neutral-300 dark:bg-neutral-800" />
            <div className="h-6 w-5/6 rounded bg-neutral-300 dark:bg-neutral-800" />
            <div className="h-4 w-full rounded bg-neutral-200 dark:bg-neutral-800/70" />
            <div className="h-3 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800/70" />
          </div>
        </div>
      ))}
    </div>
  </main>
);
