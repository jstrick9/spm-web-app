const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/chat/ChatSystem.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "fireEvent.submit(screen.getByRole('button', { name: '' }).closest('form')!);",
  "// trigger form submit by mocking the event directly\n    const form = screen.getByPlaceholderText(/Message #general.../i).closest('form');\n    fireEvent.submit(form!);"
);

fs.writeFileSync(path, code);
