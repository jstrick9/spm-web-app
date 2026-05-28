const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.test.tsx';
let code = fs.readFileSync(path, 'utf8');

const additionalTest = `
  it('allows switching to guests tab', () => {
    render(<CanvasPage event={{ id: "test-event", organization_id: "org-1", title: "Test Event" } as any} />);
    
    const guestsTabBtn = screen.getByRole('button', { name: /Guests/i });
    fireEvent.click(guestsTabBtn);
    
    expect(screen.getByText('0 unassigned guests')).toBeInTheDocument();
  });
`;

code = code.replace("});\n", additionalTest + "});\n");

fs.writeFileSync(path, code);
