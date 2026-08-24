/** Proof: document snapshots invalidate and abort stale asynchronous jobs. */

import { createSessionSafety, stageContext } from "../../docs/js/editor/session-safety.js";
import { check, finish, section } from "./_assert.mjs";

section("Session and asynchronous-result safety");

const safety = createSessionSafety();
const first = safety.replace("<TEI>one</TEI>");
check("a document replacement starts a new session at revision zero",
  first.sessionId === 1 && first.revision === 0);

const anchor = {
  documentName: "one.xml",
  folio: { index: 3, start: 100, end: 200, raw: "<pb/>page" },
  cells: [{ id: "w1", start: 120, end: 124, rawText: "word" }],
};
const job = safety.beginJob("proposal", anchor);
check("the job snapshot carries session, revision, raw, folio and cell anchors",
  job.snapshot.sessionId === 1
    && job.snapshot.revision === 0
    && job.snapshot.raw === "<TEI>one</TEI>"
    && job.snapshot.anchor.folio.index === 3
    && job.snapshot.anchor.cells[0].id === "w1");
check("an unchanged job is current", safety.isJobCurrent(job, "<TEI>one</TEI>"));

const replacementToken = safety.snapshot({ kind: "document-replacement" });
safety.sync("<TEI>edited</TEI>");
check("a raw edit advances the revision and aborts the old job",
  safety.facts().revision === 1 && job.signal.aborted);
check("the old job cannot commit against the edited document",
  !safety.isJobCurrent(job, "<TEI>edited</TEI>"));
check("a replacement authorization is bound to its exact revision",
  !safety.isSnapshotCurrent(replacementToken, "<TEI>edited</TEI>"));

const secondJob = safety.beginJob("generation", null);
const second = safety.replace("<TEI>two</TEI>");
check("replacing the document aborts jobs and resets the revision in a new session",
  secondJob.signal.aborted && second.sessionId === 2 && second.revision === 0);

const cancelled = safety.beginJob("proposal", anchor);
safety.abortJob(cancelled, "Cancelled by the operator");
check("explicit cancellation aborts and invalidates the job",
  cancelled.signal.aborted && !safety.isJobCurrent(cancelled));
const pageJob = safety.beginJob("proposal", anchor);
const generationJob = safety.beginJob("generation", anchor);
safety.abortKind("proposal", "Requested page changed");
check("a page-context change aborts proposal work without cancelling generation",
  pageJob.signal.aborted && !generationJob.signal.aborted);
safety.finishJob(generationJob);

const app = { projectFolder: { name: "old" } };
const candidate = { name: "candidate" };
const rejectedContext = stageContext(app, "projectFolder", candidate);
check("a project context is visible only inside the accepted replacement transaction",
  app.projectFolder === candidate);
rejectedContext.rollback();
check("a failed or cancelled replacement restores the complete prior project context",
  app.projectFolder.name === "old");
const acceptedContext = stageContext(app, "projectFolder", candidate);
acceptedContext.commit();
acceptedContext.rollback();
check("a committed replacement retains the new project context", app.projectFolder === candidate);

finish("Stale AI results cannot cross a document session or raw revision.");
