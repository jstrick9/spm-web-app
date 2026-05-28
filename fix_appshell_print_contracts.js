const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/ui/AppShell.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "export function PageHeader({",
  "export function PageHeader({\n  title,\n  description,\n  actions,\n  back,\n}: {\n  title: ReactNode;\n  description?: ReactNode;\n  actions?: ReactNode;\n  back?: { label: string; href: string };\n}) {\n  return (\n    <div className=\"border-b border-border bg-surface print:hidden\">"
);

// Oh wait, replace is tricky. Let's do it cleanly via regex
code = fs.readFileSync(path, 'utf8');
code = code.replace(
  /<div className="border-b border-border bg-surface">/g,
  '<div className="border-b border-border bg-surface print:hidden">'
);

fs.writeFileSync(path, code);
