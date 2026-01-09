/* eslint-disable eqeqeq */
/* eslint-disable no-plusplus */
/* eslint-disable no-console */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
import geojsonExtent from '@mapbox/geojson-extent';
import {
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  CategoricalColorNamespace,
} from '@superset-ui/core';

import type { Feature, GeoJsonProperties, Geometry } from 'geojson';

import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../../DeckGLContainer';
import { getSvg } from '../../utils/svgs';
import { hexToRGB } from '../../utils/colors';
import { Row } from '../../utilities/flyout';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps } from '../common';
import TooltipRow from '../../TooltipRow';
import fitViewport, { Viewport } from '../../utils/fitViewport';
import { TooltipProps } from '../../components/Tooltip';
import Legend from '../../components/Legend';

const propertyMap: { [index: string]: string } = {
  fillColor: 'fillColor',
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  strokeColor: 'strokeColor',
  'stroke-color': 'strokeColor',
  'stroke-width': 'strokeWidth',
};

const propertyKeys = [...new Set(Object.values(propertyMap))];

const alterProps = (props: JsonObject, propOverrides: JsonObject) => {
  const newProps: JsonObject = {};
  Object.keys(props).forEach(k => {
    if (k in propertyMap) {
      newProps[propertyMap[k]] = props[k];
    } else {
      newProps[k] = props[k];
    }
  });

  if (typeof props.fillColor === 'string') {
    newProps.fillColor = hexToRGB(props.fillColor);
  }
  if (typeof props.strokeColor === 'string') {
    newProps.strokeColor = hexToRGB(props.strokeColor);
  }

  return {
    ...newProps,
    ...propOverrides,
  };
};
let features: JsonObject[];
const recurseGeoJson = (
  node: JsonObject,
  propOverrides: JsonObject,
  extraProps?: JsonObject,
  flyoutProps?: JsonObject,
) => {
  if (node?.features) {
    node.features.forEach((obj: JsonObject) => {
      recurseGeoJson(
        obj,
        propOverrides,
        node.extraProps || extraProps,
        node.flyoutProps || flyoutProps,
      );
    });
  }
  if (node?.geometry) {
    const newNode = {
      ...node,
      properties: alterProps(node.properties, propOverrides),
    } as JsonObject;
    if (!newNode.extraProps) {
      newNode.extraProps = extraProps;
    }
    if (!newNode.flyoutProps) {
      newNode.flyoutProps = flyoutProps;
    }
    features.push(newNode);
  }
};

function setTooltipContent(o: JsonObject) {
  function divify(props: Record<string, any>) {
    const content = Object.keys(props)
      .filter(key => !propertyKeys.includes(key))
      .map((prop, index) => (
        <TooltipRow
          key={`prop-${index}`}
          label={`${prop}: `}
          value={`${props?.[prop]}`}
        />
      ));

    return content.length > 0 ? (
      <div className="deckgl-tooltip">{content}</div>
    ) : null;
  }

  return (
    (o.object?.extraProps && divify(o.object.extraProps)) ||
    (o.object?.properties && divify(o.object.properties)) ||
    null
  );
}

const { getScale } = CategoricalColorNamespace;

function getCategories(fd: QueryFormData, data: JsonObject[]) {
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const colorFn = getScale(fd.color_scheme);
  const categories: Record<string, { color: number[]; enabled: boolean }> = {};
  if (!fd.dimension) return categories;
  data.forEach(d => {
    const dataCat = d.extraProps[fd.dimension];
    if (dataCat != null && !categories.hasOwnProperty(dataCat)) {
      let color: number[];
      if (fd.dimension) {
        color = hexToRGB(colorFn(dataCat, fd.sliceId), c.a * 255);
      } else {
        color = fixedColor;
      }
      categories[dataCat] = { color, enabled: true };
    }
  });

  return categories;
}

function addColor(fd: QueryFormData, data: JsonObject[]) {
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const colorFn = getScale(fd.color_scheme);

  return data.map(d => {
    let color;
    if (fd.dimension) {
      color = hexToRGB(
        colorFn(d.extraProps[fd.dimension], fd.sliceId),
        c.a * 255,
      );

      return { ...d, color };
    }

    return d;
  });
}

export function getLayerState(
  layer: GeoJsonLayer,
  options: { minZoom: number; maxZoom: number },
) {
  return {
    id: layer.id,
    layer,
    options,
  };
}

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: HandlerFunction,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
  setFlyoutRows: HandlerFunction,
) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  const fillColor = [fc.r, fc.g, fc.b, 255 * fc.a];
  const fillHexColor = `rgb(${fc.r}, ${fc.g}, ${fc.b})`;
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const propOverrides: JsonObject = {};

  const categories = getCategories(fd, payload.data.features);

  let getFillColor = (feature: JsonObject) => feature?.properties?.fillColor;
  const getLineColor = (feature: JsonObject) =>
    feature?.properties?.strokeColor;

  if (fillColor[3] > 0) {
    propOverrides.fillColor = fillColor;
  }
  if (strokeColor[3] > 0) {
    propOverrides.strokeColor = strokeColor;
  }

  features = [];
  recurseGeoJson(payload.data, propOverrides);

  // Add colors from categories or fixed color
  if (fd.dimension) {
    features = addColor(fd, features);
    getFillColor = (feature: JsonObject) => feature?.color;
  }

  let jsFnMutator;
  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    jsFnMutator = sandboxedEval(fd.js_data_mutator);
    features = jsFnMutator(features);
  }

  // Show only categories selected in the legend
  if (fd.dimension) {
    features = features.filter(
      d => categories[d.extraProps[fd.dimension]]?.enabled,
    );
  }

  let svg: string = getSvg('circle', fillHexColor);
  if (fd.hasOwnProperty('icon_type')) {
    svg = getSvg(fd.icon_type, fillHexColor);
  }

  function onSelect(o: JsonObject) {
    if (o != undefined) {
      const keys = Object.keys(o);
      const rows = [];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = Object.values(o)[i];
        rows.push(new Row(key, value));
      }
      setFlyoutRows(rows);
    }
  }

  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new GeoJsonLayer({
    id: `geojson-layer-${fd.slice_id}` as const,
    data: features as Feature<Geometry, GeoJsonProperties>[],
    extruded: fd.extruded,
    filled: fd.filled,
    stroked: fd.stroked,
    getFillColor,
    getLineColor,
    pointType: fd.dimension ? 'circle' : 'icon',
    getLineWidth: fd.line_width || 1,
    getIcon: (d: any) => ({
      url: svgUrl,
      width: 128,
      height: 128,
    }),
    getIconSize: 25,
    pointRadiusScale: 1,
    pointRadiusUnits: 'pixels',
    pointRadiusMinPixels: 5,
    lineWidthUnits: fd.line_width_unit,
    ...commonLayerProps(fd, setTooltip, setTooltipContent, onSelect),
  });
}

export type DeckGLGeoJsonProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
};

const DeckGLGeoJson = (props: DeckGLGeoJsonProps) => {
  const containerRef = useRef<DeckGLContainerHandle>();
  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  const setFlyoutRows = useCallback((rows: Row[]) => {
    const { current } = containerRef;
    if (current) {
      current.setFlyoutRows(rows);
      current.openFlyout(true);
    }
  }, []);

  const { formData, payload, setControlValue, onAddFilter, height, width } =
    props;

  const [categories, setCategories] = useState<JsonObject>(
    getCategories(props.formData, props.payload.data.features || []),
  );
  const [stateFormData, setStateFormData] = useState<JsonObject>(
    props.payload.form_data,
  );

  useEffect(() => {
    if (props.payload.form_data !== stateFormData) {
      const features = props.payload.data.features || [];
      const categories = getCategories(props.formData, features);

      setStateFormData(props.payload.form_data);
      setCategories(categories);
    }
  }, [props, stateFormData]);

  let { minMaxZoomSlider } = formData;
  if (minMaxZoomSlider === undefined) {
    minMaxZoomSlider = [0, 22];
  }

  const viewport: Viewport = useMemo(() => {
    if (formData.autozoom) {
      const points =
        payload?.data?.features?.reduce?.(
          (acc: [number, number, number, number][], feature: any) => {
            const bounds = geojsonExtent(feature);
            if (bounds) {
              return [...acc, [bounds[0], bounds[1]], [bounds[2], bounds[3]]];
            }

            return acc;
          },
          [],
        ) || [];

      if (points.length) {
        return fitViewport(props.viewport, {
          width,
          height,
          points,
        });
      }
    }
    return props.viewport;
  }, [
    formData.autozoom,
    height,
    payload?.data?.features,
    props.viewport,
    width,
  ]);

  const layer = getLayer(
    formData,
    payload,
    onAddFilter,
    setTooltip,
    setFlyoutRows,
  );
  const layerStateOptions = {
    minZoom: minMaxZoomSlider[0],
    maxZoom: minMaxZoomSlider[1],
  };
  const layerState = getLayerState(layer, layerStateOptions);

  const toggleCategory = useCallback(
    (category: string) => {
      const categoryState = categories[category];
      const categoriesExtended = {
        ...categories,
        [category]: {
          ...categoryState,
          enabled: !categoryState.enabled,
        },
      };

      // if all categories are disabled, enable all -- similar to nvd3
      if (Object.values(categoriesExtended).every(v => !v.enabled)) {
        /* eslint-disable no-param-reassign */
        Object.values(categoriesExtended).forEach(v => {
          v.enabled = true;
        });
      }
      setCategories(categoriesExtended);
    },
    [categories],
  );

  const showSingleCategory = useCallback(
    (category: string) => {
      const modifiedCategories = { ...categories };
      Object.values(modifiedCategories).forEach(v => {
        v.enabled = false;
      });
      modifiedCategories[category].enabled = true;
      setCategories(modifiedCategories);
    },
    [categories],
  );

  return (
    <div style={{ position: 'relative' }}>
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        viewport={viewport}
        layerStates={[layerState]}
        mapStyle={formData.mapbox_style}
        setControlValue={setControlValue}
        height={height}
        width={width}
      />
      <Legend
        forceCategorical
        categories={categories}
        format={props.formData.legend_format}
        position={props.formData.legend_position}
        showSingleCategory={showSingleCategory}
        toggleCategory={toggleCategory}
      />
    </div>
  );
};

export default memo(DeckGLGeoJson);
