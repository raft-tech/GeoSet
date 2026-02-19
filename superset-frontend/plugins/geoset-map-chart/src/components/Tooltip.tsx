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

import { styled, safeHtmlSpan } from '@superset-ui/core';
import { ReactNode, useRef, useState, useLayoutEffect } from 'react';

export type TooltipProps = {
  tooltip:
    | {
        x: number;
        y: number;
        content: ReactNode;
      }
    | null
    | undefined;
  containerWidth?: number;
  containerHeight?: number;
};

// Offset from cursor position
const TOOLTIP_OFFSET = 2;

const StyledDiv = styled.div<{
  $top: number;
  $left: number;
  $anchorRight: boolean;
  $anchorBottom: boolean;
}>`
  ${({ theme, $top, $left, $anchorRight, $anchorBottom }) => `
    position: absolute;
    ${$anchorBottom ? `bottom: ${$top}px;` : `top: ${$top}px;`}
    ${$anchorRight ? `right: ${$left}px;` : `left: ${$left}px;`}
    padding: ${theme.sizeUnit * 2}px;
    background: ${theme.colorBgElevated};
    color: ${theme.colorText};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.sizeUnit}px;
    min-width: 120px;
    width: max-content;
    white-space: nowrap;
    font-size: ${theme.fontSizeSM}px;
    z-index: 9;
    pointer-events: none;
  `}
`;

export default function Tooltip(props: TooltipProps) {
  const { tooltip, containerWidth = 0, containerHeight = 0 } = props;
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });

  // Measure tooltip size after render
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const { offsetWidth, offsetHeight } = tooltipRef.current;
      setTooltipSize({ width: offsetWidth, height: offsetHeight });
    }
  }, [tooltip?.content]);

  if (typeof tooltip === 'undefined' || tooltip === null) {
    return null;
  }

  const { x, y, content } = tooltip;
  const safeContent =
    typeof content === 'string' ? safeHtmlSpan(content) : content;

  // Determine anchor points based on position relative to container edges
  // Add buffer for tooltip size + offset
  const rightEdgeThreshold =
    containerWidth - tooltipSize.width - TOOLTIP_OFFSET;
  const bottomEdgeThreshold =
    containerHeight - tooltipSize.height - TOOLTIP_OFFSET;

  const anchorRight = x > rightEdgeThreshold;
  const anchorBottom = y > bottomEdgeThreshold;

  // Calculate position based on anchor point
  const left = anchorRight
    ? containerWidth - x + TOOLTIP_OFFSET
    : x + TOOLTIP_OFFSET;
  const top = anchorBottom
    ? containerHeight - y + TOOLTIP_OFFSET
    : y + TOOLTIP_OFFSET;

  return (
    <StyledDiv
      ref={tooltipRef}
      $top={top}
      $left={left}
      $anchorRight={anchorRight}
      $anchorBottom={anchorBottom}
    >
      {safeContent}
    </StyledDiv>
  );
}
