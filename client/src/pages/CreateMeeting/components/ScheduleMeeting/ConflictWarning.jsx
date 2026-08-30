import { AlertTriangle, CheckCircle2, Clock3, Users } from "lucide-react";

const formatTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const ConflictWarning = ({
  focusConflicts = [],
  busyParticipants = [],
  mode = "soft",
  loading = false,
  onModeChange,
  enabled = false,
}) => {
  const hasConflicts = focusConflicts.length > 0 || busyParticipants.length > 0;

  if (!enabled) return null;

  const hardBlock = mode === "hard";

  return (
    <section
      className={`mb-6 rounded-xl border p-4 ${
        hasConflicts
          ? hardBlock
            ? "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
            : "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30"
          : "border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30"
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        {hasConflicts ? (
          <AlertTriangle
            className={
              hardBlock ? "mt-0.5 text-red-600" : "mt-0.5 text-amber-600"
            }
            size={20}
            aria-hidden="true"
          />
        ) : (
          <Clock3
            className="mt-0.5 text-blue-600"
            size={20}
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {loading
              ? "Checking schedule conflicts…"
              : hardBlock
                ? "Scheduling blocked by a conflict"
                : "Schedule conflict detected"}
          </h3>

          {hasConflicts && (
            <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              {focusConflicts.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <Clock3 size={16} aria-hidden="true" />
                    Focus time
                  </div>
                  <ul className="ml-6 list-disc space-y-1">
                    {focusConflicts.map((conflict, index) => {
                      const isStrict =
                        conflict.policy === "block" ||
                        conflict.allowOverride === false;
                      return (
                        <li
                          key={`${conflict._id || conflict.id || "focus"}-${index}`}
                        >
                          {conflict.title || "Protected focus time"} —{" "}
                          {formatTime(conflict.conflictStart)}–
                          {formatTime(conflict.conflictEnd)}
                          {isStrict && (
                            <span className="ml-2 inline-flex items-center rounded-sm bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                              Strict (No Override)
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {busyParticipants.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <Users size={16} aria-hidden="true" />
                    Busy participants
                  </div>
                  <ul className="ml-6 list-disc space-y-1">
                    {busyParticipants.map((participant, index) => (
                      <li key={`${participant.email}-${index}`}>
                        {participant.name || participant.email} (
                        {participant.email}) — {formatTime(participant.start)}–
                        {formatTime(participant.end)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
              <span>Conflict behavior</span>
              <select
                value={mode}
                onChange={(event) => onModeChange?.(event.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-slate-900"
                aria-label="Conflict behavior"
              >
                <option value="soft">Warn only</option>
                <option value="hard">Block scheduling</option>
              </select>
            </label>

            {!hasConflicts && !loading && (
              <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 size={15} aria-hidden="true" />
                No conflicts found
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConflictWarning;
