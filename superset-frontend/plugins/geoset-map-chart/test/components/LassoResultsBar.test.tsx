import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { message } from 'antd';
import LassoResultsBar, {
  LassoResultsBarProps,
} from '../../src/components/LassoResultsBar';
import { renderWithTheme } from '../testHelpers';
import { GeoJsonFeature } from '../../src/types';
import { Coordinate } from '../../src/utils/measureDistance';

// Mock the export module so we can verify calls without triggering downloads
jest.mock('../../src/utils/lassoExport', () => ({
  exportToCSV: jest.fn(),
  exportToExcel: jest.fn(() => Promise.resolve()),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { exportToCSV, exportToExcel } from '../../src/utils/lassoExport';

const sampleFeatures: GeoJsonFeature[] = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { name: 'A' },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [1, 1] },
    properties: { name: 'B' },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [2, 2] },
    properties: { name: 'C' },
  },
];

const defaultProps: LassoResultsBarProps = {
  features: sampleFeatures,
  onClear: jest.fn(),
  anchorPosition: { x: 100, y: 200 },
};

function renderBar(overrides: Partial<LassoResultsBarProps> = {}) {
  return renderWithTheme(
    <LassoResultsBar {...defaultProps} {...overrides} />,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('LassoResultsBar', () => {
  it('renders the item count', () => {
    renderBar();
    expect(screen.getByText('3 Items Selected')).toBeInTheDocument();
  });

  it('renders nothing when features is empty and no polygon', () => {
    const { container } = renderBar({ features: [] });
    expect(container.innerHTML).toBe('');
  });

  it('renders when features is empty but lassoPolygon is provided', () => {
    const polygon: Coordinate[] = [
      [-77.0, 38.9],
      [-77.0, 38.91],
      [-76.99, 38.91],
      [-76.99, 38.9],
    ];
    renderBar({ features: [], lassoPolygon: polygon });
    expect(screen.getByText('0 Items Selected')).toBeInTheDocument();
  });

  it('calls onClear when close button is clicked', () => {
    const onClear = jest.fn();
    renderBar({ onClear });
    userEvent.click(screen.getByLabelText('Clear selection'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('opens export menu when kebab button is clicked', () => {
    renderBar();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    userEvent.click(screen.getByLabelText('Export options'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('sets aria-expanded on the export button when menu is open', () => {
    renderBar();
    const btn = screen.getByLabelText('Export options');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders CSV and Excel menu items', () => {
    renderBar();
    userEvent.click(screen.getByLabelText('Export options'));
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Export to .CSV');
    expect(items[1]).toHaveTextContent('Export to Excel');
  });

  it('calls exportToCSV and closes menu when CSV is clicked', () => {
    renderBar();
    userEvent.click(screen.getByLabelText('Export options'));
    userEvent.click(screen.getByText('Export to .CSV'));
    expect(exportToCSV).toHaveBeenCalledWith(sampleFeatures, undefined);
    // Menu should close
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls exportToExcel and closes menu when Excel is clicked', () => {
    renderBar();
    userEvent.click(screen.getByLabelText('Export options'));
    userEvent.click(screen.getByText('Export to Excel'));
    expect(exportToExcel).toHaveBeenCalledWith(sampleFeatures, undefined);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not call onClear after export (user dismisses explicitly)', () => {
    const onClear = jest.fn();
    renderBar({ onClear });
    userEvent.click(screen.getByLabelText('Export options'));
    userEvent.click(screen.getByText('Export to .CSV'));
    expect(onClear).not.toHaveBeenCalled();
  });

  it('positions at anchor when anchorPosition is provided', () => {
    const { container } = renderBar({
      anchorPosition: { x: 50, y: 75 },
    });
    const bar = container.firstChild as HTMLElement;
    // Styled-component applies left/top from the anchor
    expect(bar).toHaveStyle('left: 50px');
    expect(bar).toHaveStyle('top: 75px');
  });

  it('shows success message after CSV export', () => {
    renderBar();
    userEvent.click(screen.getByLabelText('Export options'));
    userEvent.click(screen.getByText('Export to .CSV'));
    expect(message.success).toHaveBeenCalledWith({
      content: 'CSV exported successfully',
      duration: 3,
    });
  });

  it('shows error message when CSV export fails', () => {
    (exportToCSV as jest.Mock).mockImplementationOnce(() => {
      throw new Error('write error');
    });
    renderBar();
    userEvent.click(screen.getByLabelText('Export options'));
    userEvent.click(screen.getByText('Export to .CSV'));
    expect(message.error).toHaveBeenCalledWith({
      content: 'Failed to export CSV',
      duration: 5,
    });
  });

  it('shows success message after Excel export', async () => {
    renderBar();
    userEvent.click(screen.getByLabelText('Export options'));
    userEvent.click(screen.getByText('Export to Excel'));
    // exportToExcel is async — wait for the promise to resolve
    await screen.findByText('3 Items Selected');
    expect(message.success).toHaveBeenCalledWith({
      content: 'Excel exported successfully',
      duration: 3,
    });
  });

  it('shows error message when Excel export fails', async () => {
    (exportToExcel as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('network error')),
    );
    renderBar();
    userEvent.click(screen.getByLabelText('Export options'));
    userEvent.click(screen.getByText('Export to Excel'));
    // Wait for the rejected promise to settle
    await screen.findByText('3 Items Selected');
    expect(message.error).toHaveBeenCalledWith({
      content: 'Failed to export Excel',
      duration: 5,
    });
  });

  it('displays area text when lassoPolygon is provided', () => {
    // ~1 km × 1 km square near the equator → should show acres
    const polygon: Coordinate[] = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01],
    ];
    renderBar({ lassoPolygon: polygon });
    expect(screen.getByText(/Area:/)).toBeInTheDocument();
  });

  it('does not display area text when lassoPolygon is null', () => {
    renderBar({ lassoPolygon: null });
    expect(screen.queryByText(/Area:/)).not.toBeInTheDocument();
  });
});
