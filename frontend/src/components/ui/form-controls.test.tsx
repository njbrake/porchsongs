import { render, screen } from '@testing-library/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

describe('Input', () => {
  it('has focus-visible ring classes', () => {
    render(<Input aria-label="test input" />);
    const el = screen.getByRole('textbox', { name: 'test input' });
    expect(el.className).toContain('focus-visible:ring-2');
    expect(el.className).toContain('focus-visible:ring-primary/30');
    expect(el.className).toContain('focus-visible:ring-offset-1');
  });

  it('uses pointer-events-none when disabled', () => {
    render(<Input aria-label="test input" disabled />);
    const el = screen.getByRole('textbox', { name: 'test input' });
    expect(el.className).toContain('disabled:pointer-events-none');
  });

  it('merges custom className', () => {
    render(<Input aria-label="test input" className="my-class" />);
    const el = screen.getByRole('textbox', { name: 'test input' });
    expect(el.className).toContain('my-class');
  });
});

describe('Textarea', () => {
  it('has focus-visible ring classes', () => {
    render(<Textarea aria-label="test textarea" />);
    const el = screen.getByRole('textbox', { name: 'test textarea' });
    expect(el.className).toContain('focus-visible:ring-2');
    expect(el.className).toContain('focus-visible:ring-primary/30');
    expect(el.className).toContain('focus-visible:ring-offset-1');
  });

  it('defaults to monospace font', () => {
    render(<Textarea aria-label="test textarea" />);
    const el = screen.getByRole('textbox', { name: 'test textarea' });
    expect(el.className).toContain('font-mono');
  });

  it('allows overriding font via className', () => {
    render(<Textarea aria-label="test textarea" className="font-ui" />);
    const el = screen.getByRole('textbox', { name: 'test textarea' });
    expect(el.className).toContain('font-ui');
  });

  it('uses pointer-events-none when disabled', () => {
    render(<Textarea aria-label="test textarea" disabled />);
    const el = screen.getByRole('textbox', { name: 'test textarea' });
    expect(el.className).toContain('disabled:pointer-events-none');
  });
});

describe('Select', () => {
  it('has focus-visible ring classes', () => {
    render(
      <Select aria-label="test select">
        <option value="a">A</option>
      </Select>
    );
    const el = screen.getByRole('combobox', { name: 'test select' });
    expect(el.className).toContain('focus-visible:ring-2');
    expect(el.className).toContain('focus-visible:ring-primary/30');
    expect(el.className).toContain('focus-visible:ring-offset-1');
  });

  it('uses pointer-events-none when disabled', () => {
    render(
      <Select aria-label="test select" disabled>
        <option value="a">A</option>
      </Select>
    );
    const el = screen.getByRole('combobox', { name: 'test select' });
    expect(el.className).toContain('disabled:pointer-events-none');
  });
});
