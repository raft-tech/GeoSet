import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MapControls, {
  MapControlsProps,
} from '../../src/components/MapControls';
import { renderWithTheme } from '../testHelpers';

const defaultProps: MapControlsProps = {
  onZoomIn: jest.fn(),
  onZoomOut: jest.fn(),
  onResetView: jest.fn(),
  onRulerToggle: jest.fn(),
  isRulerActive: false,
  onLassoToggle: jest.fn(),
  isLassoActive: false,
};

function renderMapControls(overrides: Partial<MapControlsProps> = {}) {
  return renderWithTheme(<MapControls {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MapControls', () => {
  it('renders all toolbar buttons', () => {
    renderMapControls();
    expect(screen.getByTitle('Reset view')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Measure distance')).toBeInTheDocument();
    expect(
      screen.getByTitle('Lasso select features'),
    ).toBeInTheDocument();
  });

  it('calls onZoomIn, onZoomOut, onResetView on click', () => {
    const onZoomIn = jest.fn();
    const onZoomOut = jest.fn();
    const onResetView = jest.fn();
    renderMapControls({ onZoomIn, onZoomOut, onResetView });

    userEvent.click(screen.getByTitle('Zoom in'));
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByTitle('Zoom out'));
    expect(onZoomOut).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByTitle('Reset view'));
    expect(onResetView).toHaveBeenCalledTimes(1);
  });

  it('calls onRulerToggle on ruler button click', () => {
    const onRulerToggle = jest.fn();
    renderMapControls({ onRulerToggle });

    userEvent.click(screen.getByTitle('Measure distance'));
    expect(onRulerToggle).toHaveBeenCalledTimes(1);
  });

  it('shows "Exit measure mode" title when ruler is active', () => {
    renderMapControls({ isRulerActive: true });
    expect(
      screen.getByTitle('Exit measure mode (Esc)'),
    ).toBeInTheDocument();
  });
});

describe('Lasso — single-layer (no lassoLayers)', () => {
  it('opens dropdown with "Lasso mode" header on click', () => {
    renderMapControls();

    expect(screen.queryByText('Lasso mode')).not.toBeInTheDocument();

    userEvent.click(screen.getByTitle('Lasso select features'));
    expect(screen.getByText('Lasso mode')).toBeInTheDocument();
  });

  it('shows mode toggle buttons in dropdown', () => {
    renderMapControls();

    userEvent.click(screen.getByTitle('Lasso select features'));
    expect(screen.getByText('Click-and-drag')).toBeInTheDocument();
    expect(screen.getByText('Point-to-point')).toBeInTheDocument();
  });

  it('does not show layer checkboxes', () => {
    renderMapControls();

    userEvent.click(screen.getByTitle('Lasso select features'));
    expect(screen.queryByText('Select layers')).not.toBeInTheDocument();
  });

  it('calls onLassoActivate when close button clicked', () => {
    const onLassoActivate = jest.fn();
    renderMapControls({ onLassoActivate });

    userEvent.click(screen.getByTitle('Lasso select features'));
    userEvent.click(screen.getByLabelText('Close lasso options'));
    expect(onLassoActivate).toHaveBeenCalledTimes(1);
  });

  it('calls onLassoDrawModeChange when mode button clicked', () => {
    const onLassoDrawModeChange = jest.fn();
    renderMapControls({ onLassoDrawModeChange, lassoDrawMode: 'freehand' });

    userEvent.click(screen.getByTitle('Lasso select features'));
    userEvent.click(screen.getByText('Point-to-point'));
    expect(onLassoDrawModeChange).toHaveBeenCalledWith('polygon');
  });
});

describe('Lasso — multi-layer', () => {
  const layers = [
    { id: '1', name: 'Burn Areas' },
    { id: '2', name: 'Program Offices' },
    { id: '3', name: 'Air Quality' },
  ];

  it('opens dropdown with "Select layer" header and layer list', () => {
    renderMapControls({ lassoLayers: layers });

    userEvent.click(screen.getByTitle('Lasso select features'));
    expect(screen.getByText('Select layer')).toBeInTheDocument();
    expect(screen.getByText('Burn Areas')).toBeInTheDocument();
    expect(screen.getByText('Program Offices')).toBeInTheDocument();
    expect(screen.getByText('Air Quality')).toBeInTheDocument();
  });

  it('calls onLassoLayerSelect when a layer is clicked', () => {
    const onLassoLayerSelect = jest.fn();
    renderMapControls({ lassoLayers: layers, onLassoLayerSelect });

    userEvent.click(screen.getByTitle('Lasso select features'));
    userEvent.click(screen.getByText('Program Offices'));
    expect(onLassoLayerSelect).toHaveBeenCalledWith('2');
  });

  it('calls onLassoActivate on close when a layer is selected', () => {
    const onLassoActivate = jest.fn();
    renderMapControls({
      lassoLayers: layers,
      activeLassoLayerId: '2',
      onLassoActivate,
    });

    userEvent.click(screen.getByTitle('Lasso select features'));
    userEvent.click(screen.getByLabelText('Close lasso options'));
    expect(onLassoActivate).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onLassoActivate on close when no layer selected', () => {
    const onLassoActivate = jest.fn();
    renderMapControls({
      lassoLayers: layers,
      onLassoActivate,
    });

    userEvent.click(screen.getByTitle('Lasso select features'));
    userEvent.click(screen.getByLabelText('Close lasso options'));
    expect(onLassoActivate).not.toHaveBeenCalled();
  });

  it('shows mode toggle alongside layer list', () => {
    renderMapControls({ lassoLayers: layers });

    userEvent.click(screen.getByTitle('Lasso select features'));
    expect(screen.getByText('Click-and-drag')).toBeInTheDocument();
    expect(screen.getByText('Point-to-point')).toBeInTheDocument();
  });
});

describe('Lasso — active state', () => {
  it('shows "Exit lasso mode" title when active', () => {
    renderMapControls({ isLassoActive: true });
    expect(
      screen.getByTitle('Exit lasso mode (Esc)'),
    ).toBeInTheDocument();
  });

  it('calls onLassoToggle (deactivate) when button clicked while active', () => {
    const onLassoToggle = jest.fn();
    renderMapControls({ isLassoActive: true, onLassoToggle });

    userEvent.click(screen.getByTitle('Exit lasso mode (Esc)'));
    expect(onLassoToggle).toHaveBeenCalledTimes(1);
  });

  it('does not open dropdown when clicking to deactivate', () => {
    renderMapControls({ isLassoActive: true });

    userEvent.click(screen.getByTitle('Exit lasso mode (Esc)'));
    expect(screen.queryByText('Lasso mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Select layers')).not.toBeInTheDocument();
  });
});
