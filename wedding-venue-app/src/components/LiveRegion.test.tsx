import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveRegion, announce } from './LiveRegion';

describe('LiveRegion', () => {
  it('updates announced text', async () => {
    render(<LiveRegion />);

    await act(async () => {
      announce('Layout saved successfully');
    });

    expect(await screen.findByText('Layout saved successfully')).toBeInTheDocument();
  });
});