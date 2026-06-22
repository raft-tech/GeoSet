import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LassoDropdown, {
  LassoDropdownProps,
} from '../../src/components/LassoDropdown';
import { renderWithTheme } from '../testHelpers';

const layers = [
  { id: '1', name: 'Points' },
  { id: '2', name: 'Polygons' },
];

const defaultProps: LassoDropdownProps = {
  hasMultipleLayers: true,
  layers,
  activeLassoLayerId: '1',
  onLayerSelect: jest.fn(),
  drawMode: 'freehand',
  onDrawModeChange: jest.fn(),
  onClose: jest.fn(),
};

function renderDropdown(overrides: Partial<LassoDropdownProps> = {}) {
  return renderWithTheme(<LassoDropdown {...defaultProps} {...overrides} />);
}

beforeEach(() => jest.clearAllMocks());

describe('LassoDropdown', () => {
  it('renders a dialog with the correct label', () => {
    renderDropdown();
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Lasso options',
    );
  });

  it('shows "Select layer" header when hasMultipleLayers is true', () => {
    renderDropdown();
    expect(screen.getByText('Select layer')).toBeInTheDocument();
  });

  it('shows "Lasso mode" header when hasMultipleLayers is false', () => {
    renderDropdown({ hasMultipleLayers: false });
    expect(screen.getByText('Lasso mode')).toBeInTheDocument();
  });

  it('renders layer radio items with correct aria-checked state', () => {
    renderDropdown();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('does not render layer list when hasMultipleLayers is false', () => {
    renderDropdown({ hasMultipleLayers: false });
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('calls onLayerSelect when a layer is clicked', () => {
    const onLayerSelect = jest.fn();
    renderDropdown({ onLayerSelect });
    userEvent.click(screen.getByText('Polygons'));
    expect(onLayerSelect).toHaveBeenCalledWith('2');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    renderDropdown({ onClose });
    userEvent.click(screen.getByLabelText('Close lasso options'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders draw method toggle buttons with correct aria-pressed', () => {
    renderDropdown({ drawMode: 'polygon' });
    expect(screen.getByText('Click-and-drag')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('Point-to-point')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('calls onDrawModeChange when Point-to-point is clicked', () => {
    const onDrawModeChange = jest.fn();
    renderDropdown({ onDrawModeChange });
    userEvent.click(screen.getByText('Point-to-point'));
    expect(onDrawModeChange).toHaveBeenCalledWith('polygon');
  });

  it('shows shape sub-buttons when in a click-and-drag mode', () => {
    renderDropdown({ drawMode: 'freehand' });
    expect(screen.getByText('Freehand')).toBeInTheDocument();
    expect(screen.getByText('Circle')).toBeInTheDocument();
    expect(screen.getByText('Rectangle')).toBeInTheDocument();
  });

  it('hides shape sub-buttons when in polygon mode', () => {
    renderDropdown({ drawMode: 'polygon' });
    expect(screen.queryByText('Freehand')).not.toBeInTheDocument();
    expect(screen.queryByText('Circle')).not.toBeInTheDocument();
    expect(screen.queryByText('Rectangle')).not.toBeInTheDocument();
  });

  it('calls onDrawModeChange with circle when Circle is clicked', () => {
    const onDrawModeChange = jest.fn();
    renderDropdown({ onDrawModeChange, drawMode: 'freehand' });
    userEvent.click(screen.getByText('Circle'));
    expect(onDrawModeChange).toHaveBeenCalledWith('circle');
  });

  it('calls onDrawModeChange with rectangle when Rectangle is clicked', () => {
    const onDrawModeChange = jest.fn();
    renderDropdown({ onDrawModeChange, drawMode: 'freehand' });
    userEvent.click(screen.getByText('Rectangle'));
    expect(onDrawModeChange).toHaveBeenCalledWith('rectangle');
  });

  it('marks circle shape button as pressed when drawMode is circle', () => {
    renderDropdown({ drawMode: 'circle' });
    expect(screen.getByText('Circle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Freehand')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
