import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmojiPicker } from './EmojiPicker';

describe('EmojiPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders categories and filters emojis', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(<EmojiPicker onSelect={onSelect} onClose={onClose} />);
    
    // Check categories
    expect(screen.getByText('Wedding')).toBeInTheDocument();
    
    // Default category is Smileys
    expect(screen.getByText('😀')).toBeInTheDocument();
    expect(screen.queryByText('👰')).not.toBeInTheDocument();

    // Click Wedding Category
    fireEvent.click(screen.getByText('Wedding'));
    expect(screen.getByText('👰')).toBeInTheDocument();
    expect(screen.queryByText('😀')).not.toBeInTheDocument();
  });

  it('filters by search text globally', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(<EmojiPicker onSelect={onSelect} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText('Search emojis...');
    fireEvent.change(input, { target: { value: 'cake' } });
    
    // Should cross category to find cake
    expect(screen.getByText('🎂')).toBeInTheDocument();
    
    // Clicking selects and closes
    fireEvent.click(screen.getByText('🎂'));
    expect(onSelect).toHaveBeenCalledWith('🎂');
    expect(onClose).toHaveBeenCalled();
  });
});
