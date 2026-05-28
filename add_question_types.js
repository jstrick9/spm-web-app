const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/sdk/types.ts';
let code = fs.readFileSync(path, 'utf8');

const additionalTypes = `
export interface SdkEventQuestion {
  id: string;
  organization_id: string;
  question: string;
  group_name: string;
  answer_type: 'dropdown' | 'integer' | 'text' | 'date' | 'boolean' | 'multiselect';
  options: string; // JSON array
  workflow: string; // JSON object
  required: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SdkEventAnswer {
  id: string;
  event_id: string;
  question_id: string;
  answer: string | null;
  answered_by: string | null;
  answered_at: string;
}
`;

code = code + "\n" + additionalTypes;
fs.writeFileSync(path, code);
