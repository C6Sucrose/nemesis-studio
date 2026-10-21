/**
 * @vitest-environment jsdom
 */
import './setup';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';

describe('App Studio Workspace', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders Pro Studio by default and allows toggling to Creator Overlay', async () => {
    render(<App />);
    expect(screen.getByText(/Pro Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent Activity/i)).toBeInTheDocument();

    const switchBtn = screen.getByTestId('mode-toggle-btn');
    fireEvent.click(switchBtn);
    expect(screen.getByTestId('creator-overlay-bar')).toBeInTheDocument();
  });

  it('persists mode selection to localStorage', async () => {
    render(<App />);
    const switchBtn = screen.getByTestId('mode-toggle-btn');
    fireEvent.click(switchBtn);
    expect(localStorage.getItem('nemesis_studio_mode')).toBe('creator');

    // Toggling back persists 'pro'
    fireEvent.click(screen.getByTestId('mode-toggle-btn'));
    expect(localStorage.getItem('nemesis_studio_mode')).toBe('pro');
  });

  it('displays real-time agent thought stream in Pro Studio', async () => {
    render(<App />);
    expect(screen.getByText('Director')).toBeInTheDocument();
    expect(screen.getByText('Graphics & SFX')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Search')).toBeInTheDocument();
  });

  it('triggers prompt generation and updates state', async () => {
    render(<App />);
    const promptInput = screen.getByPlaceholderText(/Describe your dream HD-2D JRPG/i);
    const generateBtn = screen.getByRole('button', { name: /Forge JRPG|Generate/i });

    fireEvent.change(promptInput, {
      target: { value: 'Clockwork Chronomancer in a brass clocktower' }
    });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Clockwork/i).length).toBeGreaterThan(0);
    });
  });

  it('triggers native build exporter download', async () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    render(<App />);
    const exportBtn = screen.getByTestId('export-native-btn');
    expect(exportBtn).toBeInTheDocument();
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });

    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });
});
