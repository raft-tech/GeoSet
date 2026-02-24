/**
 * Module-level store for live map viewport state.
 *
 * DeckGLContainer syncs the current viewport here every ~250 ms.
 * ViewportControl reads it on-demand when the user clicks "Capture Map Viewport."
 *
 * This intentionally lives OUTSIDE the Redux / Superset control system so that
 * continuous viewport syncs never mark the chart as "Altered" or trigger
 * re-renders.
 */

import { Viewport } from './fitViewport';

let _viewport: Viewport | null = null;

export const setLiveViewport = (v: Viewport) => {
  _viewport = v;
};

export const getLiveViewport = (): Viewport | null => _viewport;
