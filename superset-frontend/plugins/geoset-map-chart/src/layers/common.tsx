/* eslint-disable no-restricted-syntax */
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
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { ReactNode } from 'react';
import * as d3arrayModule from 'd3-array';
import { JsonObject, JsonValue, QueryFormData } from '@superset-ui/core';
import sandboxedEval from '../utils/sandbox';
import { TooltipProps } from '../components/Tooltip';

export const CURRENT_VERSION = 4;

const d3array: Record<string, any> = d3arrayModule as Record<string, any>;

// Throttle hover tooltip updates to avoid React re-renders on every mouse move.
// deck.gl fires onHover up to 60x/sec; we only need tooltip updates every ~100ms.
const HOVER_THROTTLE_MS = 100;
let lastHoverTime = 0;

export function commonLayerProps(
  formData: QueryFormData,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
  setTooltipContent: (content: JsonObject) => ReactNode,
  onSelect?: (value: JsonValue) => void,
) {
  const fd = formData;
  let onHover;
  let tooltipContentGenerator = setTooltipContent;
  if (fd.js_tooltip) {
    tooltipContentGenerator = sandboxedEval(fd.js_tooltip);
  }
  if (tooltipContentGenerator) {
    onHover = (o: JsonObject) => {
      // When the mouse leaves a feature, clear tooltip immediately
      if (!o.picked) {
        setTooltip(null);
        return true;
      }
      // Throttle tooltip updates while hovering over features
      const now = Date.now();
      if (now - lastHoverTime < HOVER_THROTTLE_MS) return true;
      lastHoverTime = now;

      const content = tooltipContentGenerator(o);
      setTooltip(
        content !== null
          ? { content, x: (o.x as number) + 5, y: (o.y as number) + 5 }
          : null,
      );
      return true;
    };
  }
  let onClick;
  if (fd.js_onclick_href) {
    onClick = (o: any) => {
      const href = sandboxedEval(fd.js_onclick_href)(o);
      window.open(href);
      return true;
    };
  } else if (fd.table_filter && onSelect !== undefined) {
    onClick = (o: any) => {
      onSelect(o.object[fd.line_column]);
      return true;
    };
  }

  return {
    onClick,
    onHover,
    pickable: Boolean(onHover),
  };
}

const percentiles = {
  p1: 0.01,
  p5: 0.05,
  p95: 0.95,
  p99: 0.99,
};

/* Get a stat function that operates on arrays, aligns with control=js_agg_function  */
export function getAggFunc(
  type: keyof typeof percentiles | keyof typeof d3array | 'count' = 'sum',
  accessor: ((object: any) => number | undefined) | null = null,
) {
  if (type === 'count') {
    return (arr: number[]) => arr.length;
  }

  let d3func: (
    iterable: Array<unknown>,
    accessor?: (object: JsonObject) => number | undefined,
  ) => number[] | number | undefined;

  if (type in percentiles) {
    d3func = (arr, acc: (object: JsonObject) => number | undefined) => {
      let sortedArr;
      if (accessor) {
        sortedArr = arr.sort((o1: JsonObject, o2: JsonObject) =>
          d3array.ascending(accessor(o1), accessor(o2)),
        );
      } else {
        sortedArr = arr.sort(d3array.ascending);
      }

      return d3array.quantile(
        sortedArr,
        percentiles[type as keyof typeof percentiles],
        acc,
      );
    };
  } else if (type in d3array) {
    d3func = d3array[type];
  } else {
    throw new Error(`Unsupported aggregation type: ${type}`);
  }

  if (!accessor) {
    return (arr: JsonObject[]) => d3func(arr);
  }

  return (arr: JsonObject[]) => d3func(arr.map(x => accessor(x)));
}
