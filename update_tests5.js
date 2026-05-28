const fs = require('fs');
const testPath = 'spm-web-app/wedding-app/client/src/screens/events/guests/ImportGuestsDialog.test.tsx';
let code = fs.readFileSync(testPath, 'utf8');

code = `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportGuestsDialog } from './ImportGuestsDialog';
import { guestsSdk } from '../../../sdk/guests';

vi.mock('../../../sdk/guests', () => ({
  guestsSdk: {
    bulkCreate: vi.fn(),
  },
}));

if (typeof File !== 'undefined' && !File.prototype.text) {
  File.prototype.text = function() {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(this);
    });
  };
}

describe('ImportGuestsDialog', () => {
  const onOpenChange = vi.fn();
  const onImported = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderDialog(open = true) {
    return render(
      <ImportGuestsDialog
        eventId="evt-1"
        open={open}
        onOpenChange={onOpenChange}
        onImported={onImported}
      />
    );
  }

  function createCsvFile(content: string, name = 'test.csv') {
    return new File([content], name, { type: 'text/csv' });
  }

  it('renders upload step initially', () => {
    renderDialog();
    expect(screen.getByText('Upload CSV')).toBeInTheDocument();
  });

  it('parses CSV and requires fullName mapping to continue', async () => {
    renderDialog();
    const file = createCsvFile('Email\\njohn@doe.com');
    const input = screen.getByTestId('csv-file-input');
    await userEvent.upload(input, file);
    
    await waitFor(() => {
      expect(screen.getByText('Map Columns')).toBeInTheDocument();
    });

    const continueBtn = screen.getByText(/Continue/i);
    expect(continueBtn).toBeDisabled();
  });

  it('shows validation errors in preview step', async () => {
    renderDialog();
    const file = createCsvFile('fullName,email,rsvpStatus\\n,bad-email,invalid-status');
    const input = screen.getByTestId('csv-file-input');
    await userEvent.upload(input, file);
    
    await waitFor(() => {
      expect(screen.getByText('Map Columns')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Continue/i));
    
    await waitFor(() => {
      expect(screen.getByText('Preview & Resolve')).toBeInTheDocument();
    });

    expect(screen.getByText(/Full Name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Invalid email format/i)).toBeInTheDocument();
    expect(screen.getByText(/Invalid RSVP status/i)).toBeInTheDocument();
    expect(screen.getByTestId('start-import')).toBeDisabled();
  });

  it('submits valid data to the API with collision mode', async () => {
    (guestsSdk.bulkCreate as any).mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 });
    renderDialog();
    const file = createCsvFile('fullName,email\\nJohn Doe,john@doe.com');
    const input = screen.getByTestId('csv-file-input');
    await userEvent.upload(input, file);
    
    await waitFor(() => {
      expect(screen.getByText('Map Columns')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Continue/i));
    
    await waitFor(() => {
      expect(screen.getByText('Preview & Resolve')).toBeInTheDocument();
    });

    const replaceRadio = screen.getByRole('radio', { name: /Replace/i });
    fireEvent.click(replaceRadio);
    fireEvent.click(screen.getByTestId('start-import'));

    await waitFor(() => {
      expect(guestsSdk.bulkCreate).toHaveBeenCalledWith('evt-1', 'replace', [
        { fullName: 'John Doe', email: 'john@doe.com' }
      ]);
    });

    await waitFor(() => {
      expect(screen.getByText('Import Complete')).toBeInTheDocument();
    });
  });
});
`;

fs.writeFileSync(testPath, code);
