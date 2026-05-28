const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/staff.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { api } from './client.js';",
  "import { api } from './client.js';\nimport type { SdkStaffTask } from './types.js';"
);

code = code.replace(
  "listTasks(orgId: string, opts: { eventId?: string; status?: string } = {}) {",
  "listTasks(orgId: string, opts: { eventId?: string; status?: string } = {}): Promise<{ tasks: SdkStaffTask[] }> {"
);
code = code.replace(
  "createTask(orgId: string, input: TaskInput) {",
  "createTask(orgId: string, input: TaskInput): Promise<{ task: SdkStaffTask }> {"
);
code = code.replace(
  "updateTask(taskId: string, patch: Partial<TaskInput>) {",
  "updateTask(taskId: string, patch: Partial<TaskInput>): Promise<{ task: SdkStaffTask }> {"
);
code = code.replace(
  "deleteTask(taskId: string) {",
  "deleteTask(taskId: string): Promise<void> {"
);

fs.writeFileSync(path, code);
