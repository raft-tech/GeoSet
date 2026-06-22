declare module '*.css';

declare module '*.svg' {
  const content: string;
  export default content;
}

// Turf packages — types are available at runtime but not resolved by the plugin tsconfig
declare module '@turf/area';
declare module '@turf/boolean-intersects';
declare module '@turf/boolean-point-in-polygon';
declare module '@turf/centroid';
declare module '@turf/helpers';
declare module '@turf/intersect';
declare module '@turf/unkink-polygon';

// deck.gl community editable layers
declare module '@deck.gl-community/editable-layers';
