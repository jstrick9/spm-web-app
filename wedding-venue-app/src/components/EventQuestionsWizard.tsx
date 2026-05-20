import { useMemo, useState } from 'react';
import type { EventAnswer, EventQuestion, EventQuestionGroup } from '../types';

type VenueCategory =
  | 'reception'
  | 'ceremony'
  | 'cocktail-hour'
  | 'lodging'
  | 'rehearsal-dinner'
  | 'outdoor'
  | 'other';

type AnswerMap = Record<string, string | number | undefined>;
type ErrorMap = Record<string, string | undefined>;

const GROUPS: EventQuestionGroup[] = [
  'Ceremony',
  'Reception',
  'Lodging',
  'Rehearsal Dinner',
  'Other Activities/Events',
];

interface EventQuestionsWizardProps {
  questions: EventQuestion[];
  initialAnswers: EventAnswer[];
  userId: string;
  eventId: string;
  onSaveAnswers: (answers: EventAnswer[]) => void;
  onVenueFilterChange: (categories: string[]) => void;
}

export function EventQuestionsWizard({
  questions,
  initialAnswers,
  userId,
  eventId,
  onSaveAnswers,
  onVenueFilterChange,
}: EventQuestionsWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [showAllLayouts, setShowAllLayouts] = useState(true);
  const [errors, setErrors] = useState<ErrorMap>({});

  const [answers, setAnswers] = useState<AnswerMap>(() => {
    const map: AnswerMap = {};
    initialAnswers.forEach((a) => {
      map[a.questionId] = a.answerValue;
    });
    return map;
  });

  const grouped = useMemo(() => {
    const result: Record<EventQuestionGroup, EventQuestion[]> = {
      Ceremony: [],
      Reception: [],
      Lodging: [],
      'Rehearsal Dinner': [],
      'Other Activities/Events': [],
    };
    questions.forEach((q) => result[q.group].push(q));
    return result;
  }, [questions]);

  const incomingWorkflow = useMemo(() => {
    const map = new Map<string, EventQuestion[]>();
    questions.forEach((q) => {
      (q.workflow || []).forEach((w) => {
        if (!w.nextQuestionId) return;
        const list = map.get(w.nextQuestionId) || [];
        list.push(q);
        map.set(w.nextQuestionId, list);
      });
    });
    return map;
  }, [questions]);

  const isQuestionVisible = (q: EventQuestion) => {
    const parents = incomingWorkflow.get(q.id) || [];
    if (parents.length === 0) return true;

    return parents.some((parent) => {
      const parentAnswer = answers[parent.id];
      if (parentAnswer === undefined || parentAnswer === null || String(parentAnswer).trim() === '') return false;
      const parentWorkflow = (parent.workflow || []).find((w) => w.nextQuestionId === q.id);
      if (!parentWorkflow) return false;
      if (parentWorkflow.whenAnswerEquals === undefined) return true;
      return String(parentAnswer).toLowerCase() === String(parentWorkflow.whenAnswerEquals).toLowerCase();
    });
  };

  const currentGroup = GROUPS[activeStep];
  const visibleQuestions = useMemo(() => grouped[currentGroup].filter(isQuestionVisible), [grouped, currentGroup, answers]);

  const deriveVenueCategories = (answerMap: AnswerMap): VenueCategory[] => {
    const set = new Set<VenueCategory>();
    questions.forEach((q) => {
      const v = answerMap[q.id];
      if (v === undefined || v === null || String(v).trim() === '') return;
      const answer = String(v).toLowerCase();
      const text = q.text.toLowerCase();

      if (q.group === 'Ceremony' && (answer.includes('yes') || answer.includes('use'))) set.add('ceremony');
      if (q.group === 'Reception' && (answer.includes('yes') || answer.includes('use'))) set.add('reception');
      if (q.group === 'Lodging' && (answer.includes('yes') || answer.includes('use'))) set.add('lodging');
      if (q.group === 'Rehearsal Dinner' && (answer.includes('yes') || answer.includes('use'))) set.add('rehearsal-dinner');

      if (text.includes('cocktail') && (answer.includes('yes') || answer.includes('use') || answer.includes('cocktail'))) {
        set.add('cocktail-hour');
      }
      if (answer.includes('outdoor')) set.add('outdoor');
    });
    return [...set];
  };

  const updateAnswer = (q: EventQuestion, value: string | number) => {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    setErrors((prev) => ({ ...prev, [q.id]: undefined }));
    onVenueFilterChange(showAllLayouts ? [] : deriveVenueCategories(next));
  };

  const validateQuestion = (q: EventQuestion) => {
    const value = answers[q.id];
    if (q.required && (value === undefined || String(value).trim() === '')) {
      return 'This field is required.';
    }
    if (q.answerType === 'integer' && value !== undefined && String(value).trim() !== '') {
      if (!Number.isInteger(Number(value))) return 'Please enter a whole number.';
    }
    if (q.answerType === 'dropdown' && q.options?.length && value !== undefined && String(value).trim() !== '') {
      if (!q.options.includes(String(value))) return 'Please select a valid option.';
    }
    return undefined;
  };

  const validateCurrentStep = () => {
    const nextErrors: ErrorMap = {};
    let valid = true;
    visibleQuestions.forEach((q) => {
      const err = validateQuestion(q);
      if (err) {
        valid = false;
        nextErrors[q.id] = err;
      }
    });
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return valid;
  };

  const saveAnswers = () => {
    const payload: EventAnswer[] = Object.entries(answers)
      .filter(([, value]) => value !== undefined && String(value).trim() !== '')
      .map(([questionId, answerValue]) => ({
        userId,
        eventId,
        questionId,
        answerValue: answerValue as string | number,
      }));
    onSaveAnswers(payload);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Event Questions</h3>
            <p className="text-sm text-gray-600">Step-by-step planning questions to tailor venue layouts.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showAllLayouts}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowAllLayouts(checked);
                onVenueFilterChange(checked ? [] : deriveVenueCategories(answers));
              }}
              className="h-4 w-4 rounded border-gray-300 text-[#4A1942] focus:ring-[#4A1942]"
            />
            Show all layouts
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {GROUPS.map((group, idx) => (
            <button
              key={group}
              type="button"
              onClick={() => setActiveStep(idx)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${activeStep === idx ? 'border-[#4A1942] bg-[#4A1942] text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              <div className="text-xs opacity-80">Step {idx + 1}</div>
              <div className="font-medium">{group}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <h4 className="text-base font-semibold text-gray-900">{currentGroup} Questions</h4>

        {visibleQuestions.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
            No active questions in this section.
          </div>
        ) : (
          visibleQuestions.map((q) => (
            <div key={q.id} className="rounded-lg border border-gray-200 p-3">
              <label className="mb-1 block text-sm font-medium text-gray-800">
                {q.text}
                {q.required ? <span className="ml-1 text-red-600">*</span> : null}
              </label>

              {q.answerType === 'text' && (
                <input
                  type="text"
                  value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                  onChange={(e) => updateAnswer(q, e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors[q.id] ? 'border-red-400' : 'border-gray-300'}`}
                />
              )}

              {q.answerType === 'integer' && (
                <input
                  type="number"
                  value={answers[q.id] !== undefined ? String(answers[q.id]) : ''}
                  onChange={(e) => updateAnswer(q, e.target.value === '' ? '' : Number(e.target.value))}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors[q.id] ? 'border-red-400' : 'border-gray-300'}`}
                />
              )}

              {q.answerType === 'dropdown' && (
                <select
                  value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                  onChange={(e) => updateAnswer(q, e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors[q.id] ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select an option</option>
                  {(q.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {errors[q.id] ? <p className="mt-1 text-xs text-red-600">{errors[q.id]}</p> : null}
            </div>
          ))
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700"
            disabled={activeStep === 0}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              if (!validateCurrentStep()) return;
              saveAnswers();
              setActiveStep((s) => Math.min(GROUPS.length - 1, s + 1));
            }}
            className="rounded-md bg-[#4A1942] px-4 py-2 text-sm font-medium text-white hover:bg-[#3b1435]"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
