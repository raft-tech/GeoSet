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
import { ReactNode, useRef, useState, useEffect } from 'react';

export type TooltipProps = {
  tooltip:
    | {
        x: number;
        y: number;
        content: ReactNode;
      }
    | null
    | undefined;
  display:
    | {
        width: number;
        height: number;
      }
    | null
    | undefined;
};

const StyledDiv = styled.div<{
  top: number;
  left: number;
}>`
  ${({ theme, top, left }) => `
    position: absolute;
    top: ${top}px;
    left: ${left}px;
    padding: ${theme.sizeUnit * 2}px;
    margin: ${theme.sizeUnit * 2}px;
    background: ${theme.colorBgElevated};
    color: ${theme.colorText};
    maxWidth: 300px;
    fontSize: ${theme.fontSizeSM}px;
    zIndex: 9;
    pointerEvents: none;
    text-align: left;
    border: 1px solid ${theme.colorBorderSecondary};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  `}
`;

export default function Tooltip(props: TooltipProps) {
  const { tooltip, display } = props;
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // This useEffect helps avoid positioning issue within deckgl container.
  useEffect(() => {
    if (tooltipRef.current) {
      const { offsetWidth, offsetHeight } = tooltipRef.current;
      setDimensions({ width: offsetWidth, height: offsetHeight });
    }
  }, [tooltip]);

  if (
    typeof tooltip === 'undefined' ||
    tooltip === null ||
    tooltipRef === null
  ) {
    return null;
  }

  let { x, y } = tooltip;
  const { content } = tooltip;
  const safeContent =
    typeof content === 'string' ? safeHtmlSpan(content) : content;
  const margin = 10;

  const tooltipWidth = dimensions.width;
  const tooltipHeight = dimensions.height;

  if (typeof display !== 'undefined' && display !== null) {
    const { width, height } = display;

    if (x + tooltipWidth + margin > width) {
      x = x - tooltipWidth - 2 * margin;
    }
    if (y + tooltipHeight + margin > height) {
      y = y - tooltipHeight - 2 * margin;
    }
  }

  return (
    <StyledDiv ref={tooltipRef} top={y} left={x}>
      {safeContent}
    </StyledDiv>
  );
}
