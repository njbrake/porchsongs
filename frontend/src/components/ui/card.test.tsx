import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

describe('Card', () => {
  it('renders with border and shadow', () => {
    render(<Card data-testid="card">content</Card>);
    const el = screen.getByTestId('card');
    expect(el.className).toContain('bg-card');
    expect(el.className).toContain('border');
    expect(el.className).toContain('shadow-sm');
  });
});

describe('CardHeader', () => {
  it('uses sentence-case styling (no uppercase)', () => {
    render(<CardHeader data-testid="header">Chat Workshop</CardHeader>);
    const el = screen.getByTestId('header');
    expect(el.className).not.toContain('uppercase');
    expect(el.className).not.toContain('tracking-wide');
  });

  it('uses text-sm with foreground color', () => {
    render(<CardHeader data-testid="header">Title</CardHeader>);
    const el = screen.getByTestId('header');
    expect(el.className).toContain('text-sm');
    expect(el.className).toContain('text-foreground');
    expect(el.className).toContain('font-semibold');
  });

  it('has bottom border for separation', () => {
    render(<CardHeader data-testid="header">Title</CardHeader>);
    const el = screen.getByTestId('header');
    expect(el.className).toContain('border-b');
    expect(el.className).toContain('border-border');
  });

  it('merges custom className', () => {
    render(<CardHeader data-testid="header" className="bg-card">Title</CardHeader>);
    const el = screen.getByTestId('header');
    expect(el.className).toContain('bg-card');
  });
});

describe('CardContent', () => {
  it('renders with padding', () => {
    render(<CardContent data-testid="content">body</CardContent>);
    const el = screen.getByTestId('content');
    expect(el.className).toContain('p-4');
  });
});
