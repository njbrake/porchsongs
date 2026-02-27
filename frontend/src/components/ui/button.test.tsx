import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders with default variant and size', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('px-5');
  });

  it('has focus-visible ring classes', () => {
    render(<Button>Focus me</Button>);
    const btn = screen.getByRole('button', { name: 'Focus me' });
    expect(btn.className).toContain('focus-visible:ring-2');
    expect(btn.className).toContain('focus-visible:ring-primary');
    expect(btn.className).toContain('focus-visible:ring-offset-2');
  });

  it('has active scale for tactile feedback', () => {
    render(<Button>Press me</Button>);
    const btn = screen.getByRole('button', { name: 'Press me' });
    expect(btn.className).toContain('active:scale-[0.98]');
  });

  it('disabled state uses pointer-events-none', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect(btn.className).toContain('disabled:pointer-events-none');
    expect(btn.className).toContain('disabled:opacity-50');
  });

  it('renders sm size', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button', { name: 'Small' });
    expect(btn.className).toContain('px-3');
    expect(btn.className).toContain('text-xs');
  });

  it('renders lg size', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button', { name: 'Large' });
    expect(btn.className).toContain('px-8');
    expect(btn.className).toContain('text-base');
  });

  it('renders icon size', () => {
    render(<Button size="icon" aria-label="Icon button">X</Button>);
    const btn = screen.getByRole('button', { name: 'Icon button' });
    expect(btn.className).toContain('h-10');
    expect(btn.className).toContain('w-10');
  });

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole('button', { name: 'Secondary' });
    expect(btn.className).toContain('bg-primary-light');
    expect(btn.className).toContain('hover:bg-secondary-hover');
  });

  it('renders danger-outline variant', () => {
    render(<Button variant="danger-outline">Delete</Button>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.className).toContain('border-danger');
  });

  it('renders ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button', { name: 'Ghost' });
    expect(btn.className).toContain('bg-transparent');
    expect(btn.className).toContain('hover:bg-panel');
  });

  it('link-inline variant has zero ring offset', () => {
    render(<Button variant="link-inline">Link</Button>);
    const btn = screen.getByRole('button', { name: 'Link' });
    expect(btn.className).toContain('focus-visible:ring-offset-0');
  });

  it('merges custom className', () => {
    render(<Button className="my-custom-class">Custom</Button>);
    const btn = screen.getByRole('button', { name: 'Custom' });
    expect(btn.className).toContain('my-custom-class');
  });
});
