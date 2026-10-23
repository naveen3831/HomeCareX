import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PhotoCapture from '@/components/partner/PhotoCapture';

const png = (size = 100, name = 'start.png'): File => {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], name, { type: 'image/png' });
};

function Harness({ initial = null, error = null }: { initial?: File | null; error?: string | null }) {
  const [file, setFile] = useState<File | null>(initial);
  return <PhotoCapture file={file} onChange={setFile} error={error} />;
}

describe('PhotoCapture', () => {
  const created: string[] = [];
  const revoked: string[] = [];
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => {
      const u = `blob:test-${created.length}`;
      created.push(u);
      return u;
    });
    URL.revokeObjectURL = vi.fn((u: string) => {
      revoked.push(u);
    });
  });
  afterEach(() => {
    created.length = 0;
    revoked.length = 0;
  });

  it('starts empty and offers camera and gallery', () => {
    render(<Harness />);
    expect(screen.getByText(/no photo yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take photo/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /choose from gallery/i })).toBeEnabled();
  });

  it('the camera input asks the phone for the rear camera and only allows jpg/png', () => {
    render(<Harness />);
    const camera = screen.getByTestId('photo-camera-input');
    expect(camera).toHaveAttribute('capture', 'environment');
    expect(camera).toHaveAttribute('accept', 'image/jpeg,image/png');
  });

  it('shows a preview after a valid photo is chosen, then lets the partner retake or remove it', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId('photo-camera-input'), { target: { files: [png(2048, 'door.png')] } });
    expect(await screen.findByRole('img', { name: /preview/i })).toBeInTheDocument();
    expect(screen.getByText(/door\.png/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retake photo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    expect(revoked.length).toBeGreaterThan(0); // the preview URL is released
  });

  it('rejects a non-image file with a message and keeps no photo', async () => {
    render(<Harness />);
    const fake = new File(['hello'], 'notes.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('photo-gallery-input'), { target: { files: [fake] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/JPG or PNG/);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('rejects a photo over 5 MB', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId('photo-gallery-input'), {
      target: { files: [png(5 * 1024 * 1024 + 1, 'big.png')] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/5 MB/);
  });

  it('shows a server error next to the photo', () => {
    render(<Harness error="Photo must be a JPG or PNG image" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/JPG or PNG/);
  });

  it('disables every control while disabled', () => {
    render(<PhotoCapture file={png()} onChange={() => {}} disabled />);
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled();
  });
});
