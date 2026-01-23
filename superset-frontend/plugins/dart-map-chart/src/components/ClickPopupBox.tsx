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
import { styled } from '@superset-ui/core';

// MapControls: top 12px + height 32px + padding 12px = 56px from top
const MAP_CONTROLS_OFFSET = 56;

const StyledPopup = styled.div<{ $position: 'left' | 'right' }>`
  ${({ theme, $position }) => `
    position: absolute;
    top: ${MAP_CONTROLS_OFFSET}px;
    ${$position === 'left' ? `left: ${theme.sizeUnit * 3}px;` : `right: ${theme.sizeUnit * 3}px;`}
    width: 280px;
    max-height: 400px;
    background: ${theme.colorBgElevated};
    box-shadow: 0 0 ${theme.sizeUnit}px ${theme.colorBorderSecondary};
    border-radius: 6px;
    z-index: 1000;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    font-size: ${theme.fontSize}px;
  `}
`;

const PopupHeader = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    background: ${theme.colorBgContainer};
  `}
`;

const PopupTitle = styled.span`
  ${({ theme }) => `
    font-weight: 600;
    font-size: ${theme.fontSize}px;
    color: ${theme.colorText};
  `}
`;

const CloseButton = styled.button`
  ${({ theme }) => `
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    color: ${theme.colorTextSecondary};

    &:hover {
      color: ${theme.colorText};
    }
  `}
`;

const PopupContent = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 3}px;
    overflow-y: auto;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const PropertyRow = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: space-between;
    padding: ${theme.sizeUnit}px 0;
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    &:last-child {
      border-bottom: none;
    }
  `}
`;

const PropertyKey = styled.span`
  ${({ theme }) => `
    font-weight: 500;
    color: ${theme.colorTextSecondary};
    margin-right: ${theme.sizeUnit * 2}px;
  `}
`;

const PropertyValue = styled.span`
  ${({ theme }) => `
    text-align: right;
    word-break: break-word;
    color: ${theme.colorText};
  `}
`;

const EmptyMessage = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    font-style: italic;
  `}
`;

export interface ClickedFeatureInfo {
  properties: Record<string, any>;
}

export interface ClickPopupBoxProps {
  feature: ClickedFeatureInfo;
  onClose: () => void;
  hoverColumnNames?: string[];
  position?: 'left' | 'right';
}

export default function ClickPopupBox({
  feature,
  onClose,
  hoverColumnNames,
  position = 'right',
}: ClickPopupBoxProps) {
  const props = feature.properties || {};

  // Only show columns specified in hoverColumnNames
  const entries = Object.entries(props).filter(([key]) =>
    hoverColumnNames?.includes(key),
  );

  return (
    <StyledPopup $position={position}>
      <PopupHeader>
        <PopupTitle>Feature Info</PopupTitle>
        <CloseButton type="button" onClick={onClose}>
          ✕
        </CloseButton>
      </PopupHeader>
      <PopupContent>
        {entries.length === 0 ? (
          <EmptyMessage>No properties available</EmptyMessage>
        ) : (
          entries.map(([key, value]) => (
            <PropertyRow key={key}>
              <PropertyKey>{key}:</PropertyKey>
              <PropertyValue>{String(value ?? '')}</PropertyValue>
            </PropertyRow>
          ))
        )}
      </PopupContent>
    </StyledPopup>
  );
}
