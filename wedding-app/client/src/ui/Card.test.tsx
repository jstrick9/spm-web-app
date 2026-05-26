import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';

describe('Card subcomponents', () => {
  it('renders title + description + content + footer', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
          <CardDescription>World</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('interactive prop adds hover affordance class', () => {
    const { container } = render(<Card interactive>x</Card>);
    expect(container.firstChild).toHaveClass('cursor-pointer');
  });
});
