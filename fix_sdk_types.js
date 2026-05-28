const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/types.ts';
let code = fs.readFileSync(path, 'utf8');

const additionalTypes = `
export interface SdkStaffTask {
  id: string;
  organization_id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  phase: 'pre-event' | 'during-event' | 'post-event';
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_at: string | null;
  estimated_minutes: number | null;
  completed_at: string | null;
  completed_by: string | null;
  assigned_staff: string[];
  assigned_areas: string[];
  tags: string[];
  checklist: { id: string; label: string; completed: boolean }[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SdkStaffArea {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  venue_id: string | null;
  assigned_staff: string[];
  created_at: string;
  updated_at: string;
}

export interface SdkStaffShift {
  id: string;
  organization_id: string;
  staff_id: string;
  area_id: string | null;
  event_id: string | null;
  role: 'coordinator' | 'setup' | 'cleaning' | 'parking' | 'other';
  starts_at: string;
  ends_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
`;

code = code + "\n" + additionalTypes;

fs.writeFileSync(path, code);
