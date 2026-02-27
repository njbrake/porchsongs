import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import HowToArticle from '@/pages/marketing/HowToArticle';

function renderArticle(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/how-to/${slug}`]}>
      <Routes>
        <Route path="/how-to/:slug" element={<HowToArticle />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('HowToArticle', () => {
  it('renders markdown headings as HTML instead of literal text', () => {
    renderArticle('getting-started');
    const heading = screen.getByRole('heading', { name: /Step 1/i });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H2');
  });

  it('renders markdown lists as HTML list elements', () => {
    renderArticle('chat-refinement');
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBeGreaterThan(0);
  });

  it('shows not-found message for unknown slug', () => {
    renderArticle('nonexistent');
    expect(screen.getByText('Article not found')).toBeInTheDocument();
  });
});
