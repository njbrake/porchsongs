import { render, screen } from '@testing-library/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';

describe('Dialog', () => {
  it('renders content with animation classes', () => {
    render(
      <Dialog open>
        <DialogContent data-testid="dialog-content">
          <DialogHeader>
            <DialogTitle>Test</DialogTitle>
          </DialogHeader>
          <DialogBody>Body</DialogBody>
          <DialogFooter>Footer</DialogFooter>
        </DialogContent>
      </Dialog>
    );
    const content = screen.getByTestId('dialog-content');
    expect(content.className).toContain('animate-dialog-in');
    expect(content.className).toContain('max-w-lg');
  });

  it('allows overriding max-width via className', () => {
    render(
      <Dialog open>
        <DialogContent data-testid="dialog-content" className="max-w-2xl">
          <DialogTitle>Test</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    const content = screen.getByTestId('dialog-content');
    expect(content.className).toContain('max-w-2xl');
  });

  it('renders title and body', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My Title</DialogTitle>
          </DialogHeader>
          <DialogBody>My body text</DialogBody>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My body text')).toBeInTheDocument();
  });
});
