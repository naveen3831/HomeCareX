import React, { useEffect, useState } from 'react';

export interface JobTimerProps {
  startedAt?: string | null;
  className?: string;
  isCompleted?: boolean;
}

export function formatElapsed(seconds: number): string {
  if (seconds < 0 || !Number.isFinite(seconds)) {
    return '00:00:00';
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

export const JobTimer: React.FC<JobTimerProps> = ({
  startedAt,
  className = '',
  isCompleted = false,
}) => {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (isCompleted || !startedAt) return;
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [startedAt, isCompleted]);

  if (!startedAt) {
    return (
      <div className={`job-timer ${className}`} role="timer" aria-label="Job timer: not started">
        <span className="job-timer-display tabular-nums font-mono">--:--:--</span>
        <span className="job-timer-label text-xs text-muted">Not started</span>
      </div>
    );
  }

  const startTime = new Date(startedAt).getTime();
  if (Number.isNaN(startTime)) {
    return (
      <div className={`job-timer ${className}`} role="timer" aria-label="Job timer: invalid start time">
        <span className="job-timer-display tabular-nums font-mono">--:--:--</span>
        <span className="job-timer-label text-xs text-muted">Invalid time</span>
      </div>
    );
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
  const formatted = formatElapsed(elapsedSeconds);

  return (
    <div
      className={`job-timer ${className}`}
      role="timer"
      aria-label={`Elapsed service time: ${formatted}`}
      aria-live="off"
    >
      <span className="job-timer-display tabular-nums font-bold">
        {formatted}
      </span>
      <span className="job-timer-sub sr-only">
        {isCompleted ? 'Duration' : 'Elapsed'}
      </span>
    </div>
  );
};

export default JobTimer;
