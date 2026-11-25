import React from 'react';

export const EditorialPageSkeleton: React.FC = () => (
  <main
    aria-busy="true"
    aria-label="Cargando contenido editorial"
    className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-pulse"
  >
    <div className="space-y-3 border-b border-[var(--editorial-border)] pb-6">
      <div className="h-3.5 w-28 rounded bg-neutral-300/80 dark:bg-neutral-800" />
      <div className="h-9 sm:h-11 w-2/3 rounded bg-neutral-300/80 dark:bg-neutral-800" />
      <div className="h-4 w-1/2 rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden flex flex-col"
        >
          <div className="aspect-[16/10] bg-neutral-200/80 dark:bg-neutral-800" />
          <div className="p-5 space-y-3 flex-1">
            <div className="h-3 w-24 rounded bg-neutral-300/80 dark:bg-neutral-800" />
            <div className="h-6 w-5/6 rounded bg-neutral-300/80 dark:bg-neutral-800" />
            <div className="h-4 w-full rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
            <div className="h-3 w-1/3 rounded bg-neutral-200/80 dark:bg-neutral-800/70 mt-auto" />
          </div>
        </div>
      ))}
    </div>
  </main>
);

export const EditorialHomeSkeleton: React.FC = () => (
  <main
    aria-busy="true"
    aria-label="Cargando edición de portada"
    className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-12 animate-pulse"
  >
    <div className="h-10 w-full rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80" />

    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <div className="lg:col-span-8 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden flex flex-col">
        <div className="aspect-[16/9] w-full bg-neutral-200/80 dark:bg-neutral-800" />
        <div className="p-5 sm:p-7 space-y-3">
          <div className="h-3.5 w-32 rounded bg-neutral-300/80 dark:bg-neutral-800" />
          <div className="h-9 w-11/12 rounded bg-neutral-300/80 dark:bg-neutral-800" />
          <div className="h-5 w-3/4 rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
          <div className="h-3.5 w-48 rounded bg-neutral-200/80 dark:bg-neutral-800/70 pt-2" />
        </div>
      </div>

      <div className="lg:col-span-4 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 flex flex-col justify-between gap-4">
        <div className="h-4 w-36 rounded bg-neutral-300/80 dark:bg-neutral-800" />
        <div className="divide-y divide-[var(--editorial-border)] flex-1 flex flex-col justify-between">
          {[0, 1, 2].map((i) => (
            <div key={i} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
              <div className="h-3 w-24 rounded bg-neutral-300/80 dark:bg-neutral-800" />
              <div className="h-5 w-full rounded bg-neutral-300/80 dark:bg-neutral-800" />
              <div className="h-5 w-4/5 rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
              <div className="h-3 w-28 rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="space-y-4 border-t border-[var(--editorial-border)] pt-8">
      <div className="h-7 w-48 rounded bg-neutral-300/80 dark:bg-neutral-800" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden">
          <div className="aspect-[16/10] bg-neutral-200/80 dark:bg-neutral-800" />
          <div className="p-5 space-y-2.5">
            <div className="h-3 w-24 rounded bg-neutral-300/80 dark:bg-neutral-800" />
            <div className="h-7 w-5/6 rounded bg-neutral-300/80 dark:bg-neutral-800" />
            <div className="h-4 w-full rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
          </div>
        </div>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="lg:col-span-3 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden"
          >
            <div className="aspect-[16/10] bg-neutral-200/80 dark:bg-neutral-800" />
            <div className="p-4 space-y-2.5">
              <div className="h-3 w-20 rounded bg-neutral-300/80 dark:bg-neutral-800" />
              <div className="h-6 w-11/12 rounded bg-neutral-300/80 dark:bg-neutral-800" />
              <div className="h-3.5 w-2/3 rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
            </div>
          </div>
        ))}
      </div>
    </section>
  </main>
);

export const EditorialArticleSkeleton: React.FC = () => (
  <main
    aria-busy="true"
    aria-label="Cargando artículo"
    className="max-w-[1040px] mx-auto px-4 sm:px-6 py-10 space-y-8 animate-pulse"
  >
    <div className="h-4 w-28 rounded bg-neutral-300/80 dark:bg-neutral-800" />
    <div className="space-y-4">
      <div className="h-3.5 w-40 rounded bg-neutral-300/80 dark:bg-neutral-800" />
      <div className="h-12 w-11/12 rounded bg-neutral-300/80 dark:bg-neutral-800" />
      <div className="h-6 w-3/4 rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
    </div>
    <div className="h-16 w-full border-y border-[var(--editorial-border)]" />
    <div className="aspect-[16/9] w-full rounded-2xl bg-neutral-200/80 dark:bg-neutral-800" />
    <div className="max-w-[65ch] mx-auto space-y-4 pt-4">
      <div className="h-5 w-full rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
      <div className="h-5 w-11/12 rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
      <div className="h-5 w-5/6 rounded bg-neutral-200/80 dark:bg-neutral-800/70" />
    </div>
  </main>
);
