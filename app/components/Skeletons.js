"use client";

export function CardSkeleton({ count = 3 }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-6 bg-slate-200/50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="h-4 w-24 bg-slate-300 dark:bg-zinc-700 rounded-md"></div>
                        <div className="h-8 w-8 bg-slate-300 dark:bg-zinc-700 rounded-xl"></div>
                    </div>
                    <div className="h-8 w-36 bg-slate-300 dark:bg-zinc-700 rounded-lg"></div>
                    <div className="h-3 w-48 bg-slate-300 dark:bg-zinc-700 rounded-md"></div>
                </div>
            ))}
        </div>
    );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
    return (
        <div className="w-full bg-slate-100/50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4 animate-pulse">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 pb-3 border-b border-slate-200 dark:border-zinc-800">
                {Array.from({ length: cols }).map((_, i) => (
                    <div key={i} className="h-4 bg-slate-300 dark:bg-zinc-700 rounded-md"></div>
                ))}
            </div>

            {/* Table Rows */}
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="grid grid-cols-4 gap-4 py-2 border-b border-slate-100 dark:border-zinc-800/50">
                    {Array.from({ length: cols }).map((_, c) => (
                        <div key={c} className="h-4 bg-slate-200 dark:bg-zinc-800 rounded-md"></div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export function HeaderSkeleton() {
    return (
        <div className="flex items-center justify-between p-4 bg-slate-200/40 dark:bg-zinc-800/40 rounded-2xl animate-pulse">
            <div className="space-y-2">
                <div className="h-6 w-48 bg-slate-300 dark:bg-zinc-700 rounded-lg"></div>
                <div className="h-4 w-64 bg-slate-300 dark:bg-zinc-700 rounded-md"></div>
            </div>
            <div className="h-10 w-32 bg-slate-300 dark:bg-zinc-700 rounded-xl"></div>
        </div>
    );
}

export function ListSkeleton({ count = 4 }) {
    return (
        <div className="space-y-3 animate-pulse">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-4 bg-slate-200/50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-slate-300 dark:bg-zinc-700 rounded-full"></div>
                        <div className="space-y-1.5">
                            <div className="h-4 w-32 bg-slate-300 dark:bg-zinc-700 rounded-md"></div>
                            <div className="h-3 w-24 bg-slate-300 dark:bg-zinc-700 rounded-md"></div>
                        </div>
                    </div>
                    <div className="h-6 w-16 bg-slate-300 dark:bg-zinc-700 rounded-lg"></div>
                </div>
            ))}
        </div>
    );
}
