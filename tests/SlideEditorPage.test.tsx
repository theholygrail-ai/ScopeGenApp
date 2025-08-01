import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SlideEditorPage from '../src/components/SlideEditorPage';

jest.useFakeTimers();

const mockSlide = { id: 's1', currentHtml: '<p>orig</p>' };
const mockOnUpdate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ slide: { id: 's1', currentHtml: '<p>edited</p>' } })
    })
  );
});

test('debounces rapid input into a single API call and disables button while pending', async () => {
  render(<SlideEditorPage slide={mockSlide as any} onUpdate={mockOnUpdate} />);

  const textarea = screen.getByRole('textbox');
  const button = screen.getByRole('button', { name: /apply/i });

  fireEvent.change(textarea, { target: { value: 'first' } });
  fireEvent.change(textarea, { target: { value: 'second' } });
  fireEvent.change(textarea, { target: { value: 'final instruction' } });

  jest.advanceTimersByTime(500);

  await waitFor(() => expect(button).toBeDisabled());
  expect((global as any).fetch).toHaveBeenCalledTimes(1);

  await waitFor(() => expect(mockOnUpdate).toHaveBeenCalledWith({ id: 's1', currentHtml: '<p>edited</p>' }));

  expect(button).not.toBeDisabled();
});
