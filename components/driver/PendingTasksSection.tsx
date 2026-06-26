'use client';

import Link from 'next/link';
import type { PendingTask } from '@/lib/driver/pending-tasks';

type PendingTasksSectionProps = {
  tasks: PendingTask[];
  loading?: boolean;
};

function taskAccent(priority: PendingTask['priority']) {
  switch (priority) {
    case 'high':
      return 'bg-amber-50 border-amber-100';
    case 'medium':
      return 'bg-blue-50 border-blue-100';
    default:
      return 'bg-slate-50 border-slate-100';
  }
}

function actionButtonClass(priority: PendingTask['priority']) {
  switch (priority) {
    case 'high':
      return 'bg-amber-600 hover:bg-amber-700';
    case 'medium':
      return 'bg-[#1E3A8A] hover:bg-[#162D6B]';
    default:
      return 'bg-slate-600 hover:bg-slate-700';
  }
}

export default function PendingTasksSection({ tasks, loading }: PendingTasksSectionProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-blue-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-blue-950">Pending Tasks</h2>
        <p className="text-sm text-blue-800">Loading your tasks...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-blue-950">Pending Tasks</h2>
        {tasks.length > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            {tasks.length} remaining
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-center">
          <p className="font-medium text-emerald-900">You&apos;re all caught up.</p>
          <p className="mt-1 text-sm text-emerald-800">
            No missing documents or profile items right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${taskAccent(task.priority)}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-blue-950">{task.title}</p>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
                    {task.kind === 'document' ? 'Document' : 'Profile'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-blue-900/80">{task.description}</p>
              </div>
              <Link
                href={task.href}
                className={`inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${actionButtonClass(task.priority)}`}
              >
                {task.actionLabel}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}