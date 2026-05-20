import { useState } from 'react';
import type { EventSubmission } from '../models/SubmissionWorkflow';

interface AdminSubmissionQueueProps {
  submissions: EventSubmission[];
  pendingCount: number;
  adminUserId: string;
  adminName: string;
  onReview: (
    submissionId: string,
    action: 'approve' | 'request_changes' | 'reject',
    reviewerUserId: string,
    reviewerName: string,
    comment?: string,
  ) => void;
}

const statusClass: Record<EventSubmission['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  changes_requested: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

export function AdminSubmissionQueue({
  submissions,
  pendingCount,
  adminUserId,
  adminName,
  onReview,
}: AdminSubmissionQueueProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Pending Approvals</h4>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          {pendingCount} pending
        </span>
      </div>

      {submissions.length === 0 ? (
        <p className="text-sm text-gray-500">No submissions yet.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionRow
              key={s.id}
              submission={s}
              adminUserId={adminUserId}
              adminName={adminName}
              onReview={onReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({
  submission,
  adminUserId,
  adminName,
  onReview,
}: {
  submission: EventSubmission;
  adminUserId: string;
  adminName: string;
  onReview: (
    submissionId: string,
    action: 'approve' | 'request_changes' | 'reject',
    reviewerUserId: string,
    reviewerName: string,
    comment?: string,
  ) => void;
}) {
  const [comment, setComment] = useState('');

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{submission.eventName}</p>
          <p className="text-xs text-gray-600">by {submission.masterUserName}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass[submission.status]}`}>
          {submission.status.replace('_', ' ')}
        </span>
      </div>

      <p className="mt-2 text-xs text-gray-600">
        Answers: {submission.answers.length} • Layouts: {submission.selectedVenueIds.length}
      </p>

      <input
        type="text"
        placeholder="Optional comment"
        className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onReview(submission.id, 'approve', adminUserId, adminName, comment)}
          className="rounded-md bg-green-600 px-2 py-1 text-xs text-white"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => onReview(submission.id, 'request_changes', adminUserId, adminName, comment)}
          className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
        >
          Request Changes
        </button>
        <button
          type="button"
          onClick={() => onReview(submission.id, 'reject', adminUserId, adminName, comment)}
          className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
