import type { EventAnswer } from '../types';
import type { EventSubmission } from '../models/SubmissionWorkflow';

interface SubmissionStatusPanelProps {
  eventName: string;
  selectedVenueIds: string[];
  answers: EventAnswer[];
  submission: EventSubmission | null;
  onSubmit: () => void;
}

const badgeClass: Record<NonNullable<EventSubmission['status']>, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  changes_requested: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

export function SubmissionStatusPanel({
  eventName,
  selectedVenueIds,
  answers,
  submission,
  onSubmit,
}: SubmissionStatusPanelProps) {
  const status = submission?.status ?? 'pending';
  const canSubmit = selectedVenueIds.length > 0 && answers.length > 0;
  const needsResubmit = submission?.status === 'changes_requested' || submission?.status === 'rejected';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Submission Workflow</h3>
          <p className="text-xs text-gray-600">Event: {eventName || 'General'}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass[status]}`}>
          {status.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border border-gray-200 p-2">
          <p className="text-xs text-gray-500">Answered Questions</p>
          <p className="font-semibold">{answers.length}</p>
        </div>
        <div className="rounded-md border border-gray-200 p-2">
          <p className="text-xs text-gray-500">Selected Layouts</p>
          <p className="font-semibold">{selectedVenueIds.length}</p>
        </div>
      </div>

      {submission?.adminComment && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <strong>Admin feedback:</strong> {submission.adminComment}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-md bg-[#4A1942] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {needsResubmit ? 'Resubmit for Approval' : 'Submit for Approval'}
        </button>
      </div>
      {!canSubmit && (
        <p className="mt-2 text-xs text-red-600">
          Complete questionnaire answers and select at least one layout before submitting.
        </p>
      )}
    </div>
  );
}
