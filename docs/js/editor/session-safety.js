/**
 * Document-session identity and cancellable asynchronous jobs.
 *
 * The canonical raw XML advances the revision. Replacing a document starts a
 * new session. Either transition aborts every job that was based on the prior
 * snapshot, and a result may commit only while its complete snapshot still
 * matches.
 */

export function createSessionSafety() {
  let sessionId = 0;
  let revision = 0;
  let raw = null;
  const jobs = new Set();

  const facts = () => ({ sessionId, revision, raw });

  function abortAll(reason = "Document state changed") {
    for (const job of jobs) {
      if (!job.controller.signal.aborted) job.controller.abort(reason);
    }
    jobs.clear();
  }

  function replace(nextRaw) {
    abortAll("Document replaced");
    sessionId += 1;
    revision = 0;
    raw = String(nextRaw == null ? "" : nextRaw);
    return facts();
  }

  function sync(nextRaw) {
    const value = String(nextRaw == null ? "" : nextRaw);
    if (value === raw) return facts();
    abortAll("Document revised");
    revision += 1;
    raw = value;
    return facts();
  }

  function snapshot(anchor = null) {
    return Object.freeze({ sessionId, revision, raw, anchor });
  }

  function isSnapshotCurrent(value, currentRaw = raw) {
    return !!value
      && value.sessionId === sessionId
      && value.revision === revision
      && value.raw === raw
      && currentRaw === raw;
  }

  function beginJob(kind, anchor = null) {
    const controller = new AbortController();
    const job = {
      kind: String(kind || "job"),
      controller,
      signal: controller.signal,
      snapshot: snapshot(anchor),
    };
    jobs.add(job);
    return job;
  }

  function isJobCurrent(job, currentRaw = raw) {
    return !!job
      && jobs.has(job)
      && !job.signal.aborted
      && isSnapshotCurrent(job.snapshot, currentRaw);
  }

  function finishJob(job) {
    jobs.delete(job);
  }

  function abortJob(job, reason = "Operation cancelled") {
    if (!job || !jobs.has(job)) return;
    jobs.delete(job);
    if (!job.signal.aborted) job.controller.abort(reason);
  }

  function abortKind(kind, reason = "Operation context changed") {
    for (const job of [...jobs]) {
      if (job.kind === kind) abortJob(job, reason);
    }
  }

  return {
    facts,
    replace,
    sync,
    snapshot,
    isSnapshotCurrent,
    beginJob,
    isJobCurrent,
    finishJob,
    abortJob,
    abortKind,
    abortAll,
  };
}

/** Adopt context provisionally and restore it unless the caller commits. */
export function stageContext(target, key, value) {
  const previous = target[key];
  let settled = false;
  target[key] = value;
  return {
    commit() { settled = true; },
    rollback() {
      if (settled) return;
      if (target[key] === value) target[key] = previous;
      settled = true;
    },
  };
}
