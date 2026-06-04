// @ts-nocheck
import React, { useState } from 'react';
import { EventQuestion, EventQuestionGroup, EventQuestionAnswerType } from '../../types';
import { Config } from '../../config';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';
import type { AdminCommonProps } from './AdminTabTypes';

interface EventQuestionsManagementProps {
  eventQuestions: EventQuestion[];
  config: Config;
  onSaveQuestions: (questions: EventQuestion[]) => void;
}

export function EventQuestionsManagement({ eventQuestions, config, onSaveQuestions }: EventQuestionsManagementProps) {
  const [newQuestion, setNewQuestion] = useState({ text: '', group: 'Ceremony' as EventQuestionGroup, answerType: 'text' as EventQuestionAnswerType });

  const handleAdd = () => {
    if (!newQuestion.text.trim()) return;
    const q: EventQuestion = {
      id: `eq-${Date.now()}`,
      text: newQuestion.text.trim(),
      group: newQuestion.group,
      answerType: newQuestion.answerType,
      options: newQuestion.answerType === 'dropdown' ? [] : undefined,
      workflow: []
    };
    onSaveQuestions([...eventQuestions, q]);
    setNewQuestion({ text: '', group: 'Ceremony', answerType: 'text' });
  };

  return (
    <div className="space-y-4">
      <BrandedSectionHeader icon="❓" title="Event Questions" description="Dynamic questionnaire for events" config={config} />

      <div className="bg-white p-4 rounded-xl border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" placeholder="Question text" value={newQuestion.text} onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })} className="border rounded px-3 py-2" />
          <select value={newQuestion.group} onChange={(e) => setNewQuestion({ ...newQuestion, group: e.target.value as any })} className="border rounded px-3 py-2">
            <option value="Ceremony">Ceremony</option>
            <option value="Reception">Reception</option>
            <option value="Lodging">Lodging</option>
          </select>
          <button onClick={handleAdd} className="bg-[#4A1942] text-white rounded px-4">Add Question</button>
        </div>
      </div>

      <div className="space-y-3">
        {eventQuestions.map(q => (
          <div key={q.id} className="bg-white p-4 rounded-xl border">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{q.text}</p>
                <span className="text-xs bg-indigo-100 px-2 py-0.5 rounded">{q.group}</span>
              </div>
              <button onClick={() => onSaveQuestions(eventQuestions.filter(x => x.id !== q.id))} className="text-red-500">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}