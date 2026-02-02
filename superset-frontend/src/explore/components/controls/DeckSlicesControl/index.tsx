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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css, styled, t, useTheme, SupersetClient } from '@superset-ui/core';
import { useDrag, useDrop } from 'react-dnd';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '@superset-ui/core/components/Tooltip';
import { Checkbox } from '@superset-ui/core/components/Checkbox';
import { Popover } from '@superset-ui/core/components/Popover';
// eslint-disable-next-line no-restricted-imports
import { Button } from '@superset-ui/core/components/Button';
import ControlHeader from 'src/explore/components/ControlHeader';
import {
  DragContainer,
  OptionControlContainer,
  CloseContainer,
  Label,
  LabelsContainer,
  AddControlLabel,
} from '../OptionControls';

const DND_TYPE = 'DeckSliceOption';

interface DeckSliceOption {
  value: number;
  label: string;
}

export interface DeckSliceConfig {
  sliceId: number;
  autozoom: boolean;
  legendCollapsed: boolean;
  initiallyHidden: boolean;
}

export interface DeckSlicesControlProps {
  value: (DeckSliceConfig | number)[] | undefined;
  onChange: (value: DeckSliceConfig[]) => void;
  label?: string;
  description?: string;
  dataEndpoint: string;
}

const LabelText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DropdownContainer = styled.div`
  max-height: 250px;
  overflow-y: auto;
`;

const DropdownOption = styled.div<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  cursor: pointer;
  background-color: ${({ theme, isSelected }) =>
    isSelected ? theme.colorBgLayout : 'transparent'};

  &:hover {
    background-color: ${({ theme }) => theme.colorBgTextHover};
  }
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin-right: ${({ theme }) => theme.sizeUnit}px;
`;

interface DragItem {
  dragIndex: number;
  type: string;
}

interface SelectedSliceRowProps {
  label: string;
  sliceId: number;
  autozoom: boolean;
  legendCollapsed: boolean;
  initiallyHidden: boolean;
  index: number;
  onRemove: (sliceId: number) => void;
  onMoveLabel: (dragIndex: number, hoverIndex: number) => void;
  onToggleAutozoom: (sliceId: number) => void;
  onToggleLegendCollapsed: (sliceId: number) => void;
  onToggleInitiallyHidden: (sliceId: number) => void;
}

const SettingsButton = styled.div`
  display: flex;
  align-items: center;
  margin-left: auto;
  padding: 0 ${({ theme }) => theme.sizeUnit}px;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`;

const SettingsPopoverContent = styled.div`
  min-width: 200px;
`;

const PopoverTitle = styled.span`
  display: block;
  padding-bottom: 8px;
  margin-bottom: -4px;
  border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
`;

const SettingsRow = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.sizeUnit * 0.5}px 0;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.sizeUnit}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const SettingsLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorText};
  margin-left: ${({ theme }) => theme.sizeUnit}px;
  flex: 1;
`;

const InfoIcon = styled.span`
  display: flex;
  align-items: center;
  margin-left: ${({ theme }) => theme.sizeUnit}px;
`;

const SelectedSliceRow = ({
  label,
  sliceId,
  autozoom,
  legendCollapsed,
  initiallyHidden,
  index,
  onRemove,
  onMoveLabel,
  onToggleAutozoom,
  onToggleLegendCollapsed,
  onToggleInitiallyHidden,
}: SelectedSliceRowProps) => {
  const theme = useTheme();
  const dropRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Draft state for settings - only applied on Save
  const [draftAutozoom, setDraftAutozoom] = useState(autozoom);
  const [draftLegendCollapsed, setDraftLegendCollapsed] =
    useState(legendCollapsed);
  const [draftInitiallyHidden, setDraftInitiallyHidden] =
    useState(initiallyHidden);

  // Reset draft state when popover opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setDraftAutozoom(autozoom);
      setDraftLegendCollapsed(legendCollapsed);
      setDraftInitiallyHidden(initiallyHidden);
    }
    setSettingsOpen(open);
  };

  // Apply draft changes on Save
  const handleSave = () => {
    if (draftAutozoom !== autozoom) {
      onToggleAutozoom(sliceId);
    }
    if (draftLegendCollapsed !== legendCollapsed) {
      onToggleLegendCollapsed(sliceId);
    }
    if (draftInitiallyHidden !== initiallyHidden) {
      onToggleInitiallyHidden(sliceId);
    }
    setSettingsOpen(false);
  };

  // Close without saving - draft changes are discarded
  const handleClose = () => {
    setSettingsOpen(false);
  };

  const [{ isDragging }, dragRef] = useDrag({
    item: { type: DND_TYPE, dragIndex: index },
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: DND_TYPE,
    hover: (item: DragItem) => {
      if (item.dragIndex !== index) {
        onMoveLabel(item.dragIndex, index);
        // eslint-disable-next-line no-param-reassign
        item.dragIndex = index;
      }
    },
  });

  drop(dropRef);

  const shouldShowTooltip =
    !isDragging &&
    labelRef.current &&
    labelRef.current.scrollWidth > labelRef.current.clientWidth;

  const settingsContent = (
    <SettingsPopoverContent onClick={e => e.stopPropagation()}>
      <SettingsRow>
        <Checkbox
          checked={draftAutozoom}
          onChange={() => setDraftAutozoom(!draftAutozoom)}
        />
        <SettingsLabel>{t('Auto Zoom')}</SettingsLabel>
        <Tooltip
          title={t('Automatically zoom the map to fit this layer')}
          mouseLeaveDelay={0}
        >
          <InfoIcon>
            <Icons.InfoCircleOutlined
              iconSize="s"
              iconColor={theme.colorTextSecondary}
            />
          </InfoIcon>
        </Tooltip>
      </SettingsRow>
      <SettingsRow>
        <Checkbox
          checked={draftLegendCollapsed}
          onChange={() => setDraftLegendCollapsed(!draftLegendCollapsed)}
        />
        <SettingsLabel>{t('Collapse Legend')}</SettingsLabel>
        <Tooltip
          title={t('Start with the legend entry collapsed in the map legend')}
          mouseLeaveDelay={0}
        >
          <InfoIcon>
            <Icons.InfoCircleOutlined
              iconSize="s"
              iconColor={theme.colorTextSecondary}
            />
          </InfoIcon>
        </Tooltip>
      </SettingsRow>
      <SettingsRow>
        <Checkbox
          checked={draftInitiallyHidden}
          onChange={() => setDraftInitiallyHidden(!draftInitiallyHidden)}
        />
        <SettingsLabel>{t('Hidden by Default')}</SettingsLabel>
        <Tooltip
          title={t('Hide this layer when the map first loads')}
          mouseLeaveDelay={0}
        >
          <InfoIcon>
            <Icons.InfoCircleOutlined
              iconSize="s"
              iconColor={theme.colorTextSecondary}
            />
          </InfoIcon>
        </Tooltip>
      </SettingsRow>
      <ButtonRow>
        <Button buttonStyle="secondary" cta onClick={handleClose}>
          {t('Close')}
        </Button>
        <Button buttonStyle="primary" cta onClick={handleSave}>
          {t('Save')}
        </Button>
      </ButtonRow>
    </SettingsPopoverContent>
  );

  return (
    <DragContainer
      ref={dropRef}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <OptionControlContainer data-test="option-label" ref={dragRef}>
        <CloseContainer
          role="button"
          data-test="remove-control-button"
          onClick={e => {
            e.stopPropagation();
            onRemove(sliceId);
          }}
        >
          <Icons.CloseOutlined
            iconSize="m"
            iconColor={theme.colorIcon}
            css={css`
              vertical-align: sub;
              margin: 0 ${theme.sizeUnit}px;
            `}
          />
        </CloseContainer>
        <Label data-test="control-label">
          {shouldShowTooltip ? (
            <Tooltip title={label}>
              <LabelText ref={labelRef}>{label}</LabelText>
            </Tooltip>
          ) : (
            <LabelText ref={labelRef}>{label}</LabelText>
          )}
        </Label>
        <Popover
          title={<PopoverTitle>{t('Layer Properties')}</PopoverTitle>}
          content={settingsContent}
          trigger="click"
          open={settingsOpen}
          onOpenChange={handleOpenChange}
          placement="right"
        >
          <SettingsButton
            onClick={e => {
              e.stopPropagation();
              setSettingsOpen(!settingsOpen);
            }}
          >
            <Tooltip title={t('Layer settings')} mouseEnterDelay={1}>
              <Icons.SettingOutlined iconSize="m" iconColor={theme.colorIcon} />
            </Tooltip>
          </SettingsButton>
        </Popover>
      </OptionControlContainer>
    </DragContainer>
  );
};

// Normalize deck slices (handle legacy number[] format)
const normalizeValue = (
  value: (DeckSliceConfig | number)[] | undefined,
): DeckSliceConfig[] =>
  value?.map(item =>
    typeof item === 'number'
      ? {
          sliceId: item,
          autozoom: true,
          legendCollapsed: false,
          initiallyHidden: false,
        }
      : {
          sliceId: item.sliceId,
          autozoom: item.autozoom ?? true,
          legendCollapsed: item.legendCollapsed ?? false,
          initiallyHidden: item.initiallyHidden ?? false,
        },
  ) ?? [];

const DeckSlicesControl = ({
  value = [],
  onChange,
  dataEndpoint,
  ...props
}: DeckSlicesControlProps) => {
  const theme = useTheme();
  const [options, setOptions] = useState<DeckSliceOption[]>([]);
  const [localValues, setLocalValues] = useState<DeckSliceConfig[]>(() =>
    normalizeValue(value),
  );
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const addButtonRef = useRef<HTMLDivElement>(null);
  const [popoverWidth, setPopoverWidth] = useState<number>(0);

  // Update popover width when dropdown opens
  useEffect(() => {
    if (dropdownVisible && addButtonRef.current) {
      setPopoverWidth(addButtonRef.current.offsetWidth);
    }
  }, [dropdownVisible]);

  // Fetch available slices
  useEffect(() => {
    SupersetClient.get({ endpoint: dataEndpoint })
      .then(response => {
        const data = response.json;
        if (data?.result) {
          const mappedOptions = data.result.map(
            (item: { id: number; slice_name: string }) => ({
              value: item.id,
              label: item.slice_name,
            }),
          );
          setOptions(mappedOptions);
        }
      })
      .catch(() => {
        setOptions([]);
      });
  }, [dataEndpoint]);

  // Sync and sanitize values when props or options change
  useEffect(() => {
    const normalized = normalizeValue(value);
    if (options.length === 0) {
      setLocalValues(normalized);
      return;
    }

    const validSliceIds = new Set(options.map(o => o.value));
    const sanitized = normalized.filter(v => validSliceIds.has(v.sliceId));
    setLocalValues(sanitized);
  }, [value, options]);

  // Memoize derived values
  const selectedSliceIds = useMemo(
    () => localValues.map(v => v.sliceId),
    [localValues],
  );

  const selectedOptions = useMemo(
    () =>
      localValues
        .map(v => {
          const opt = options.find(o => o.value === v.sliceId);
          return opt
            ? {
                ...opt,
                autozoom: v.autozoom,
                legendCollapsed: v.legendCollapsed,
                initiallyHidden: v.initiallyHidden,
              }
            : null;
        })
        .filter(Boolean) as (DeckSliceOption & {
        autozoom: boolean;
        legendCollapsed: boolean;
        initiallyHidden: boolean;
      })[],
    [localValues, options],
  );

  const updateValues = useCallback(
    (newValues: DeckSliceConfig[]) => {
      setLocalValues(newValues);
      onChange(newValues);
    },
    [onChange],
  );

  const handleRemove = (sliceId: number) =>
    updateValues(localValues.filter(v => v.sliceId !== sliceId));

  const handleToggleInDropdown = (sliceId: number) => {
    const isSelected = selectedSliceIds.includes(sliceId);
    updateValues(
      isSelected
        ? localValues.filter(v => v.sliceId !== sliceId)
        : [
            ...localValues,
            {
              sliceId,
              autozoom: true,
              legendCollapsed: false,
              initiallyHidden: false,
            },
          ],
    );
  };

  const handleToggleAutozoom = (sliceId: number) =>
    updateValues(
      localValues.map(v =>
        v.sliceId === sliceId ? { ...v, autozoom: !v.autozoom } : v,
      ),
    );

  const handleToggleLegendCollapsed = (sliceId: number) =>
    updateValues(
      localValues.map(v =>
        v.sliceId === sliceId
          ? { ...v, legendCollapsed: !v.legendCollapsed }
          : v,
      ),
    );

  const handleToggleInitiallyHidden = (sliceId: number) =>
    updateValues(
      localValues.map(v =>
        v.sliceId === sliceId
          ? { ...v, initiallyHidden: !v.initiallyHidden }
          : v,
      ),
    );

  const moveLabel = (dragIndex: number, hoverIndex: number) => {
    const newValues = [...localValues];
    const [removed] = newValues.splice(dragIndex, 1);
    newValues.splice(hoverIndex, 0, removed);
    updateValues(newValues);
  };

  const dropdownContent = (
    <DropdownContainer>
      {options.length === 0 ? (
        <div
          css={css`
            padding: ${theme.sizeUnit * 2}px;
            color: ${theme.colorTextSecondary};
            text-align: center;
          `}
        >
          {t('No charts available')}
        </div>
      ) : (
        options.map(opt => {
          const isSelected = selectedSliceIds.includes(opt.value);
          return (
            <DropdownOption
              key={opt.value}
              isSelected={isSelected}
              onClick={() => handleToggleInDropdown(opt.value)}
            >
              <CheckboxContainer>
                <Checkbox
                  checked={isSelected}
                  onChange={() => handleToggleInDropdown(opt.value)}
                />
              </CheckboxContainer>
              <LabelText>{opt.label}</LabelText>
            </DropdownOption>
          );
        })
      )}
    </DropdownContainer>
  );

  return (
    <div data-test="deck-slices-control">
      <ControlHeader {...props} />
      <LabelsContainer>
        {selectedOptions.map((opt, index) => (
          <SelectedSliceRow
            key={opt.value}
            label={opt.label}
            sliceId={opt.value}
            autozoom={opt.autozoom}
            legendCollapsed={opt.legendCollapsed}
            initiallyHidden={opt.initiallyHidden}
            index={index}
            onRemove={handleRemove}
            onMoveLabel={moveLabel}
            onToggleAutozoom={handleToggleAutozoom}
            onToggleLegendCollapsed={handleToggleLegendCollapsed}
            onToggleInitiallyHidden={handleToggleInitiallyHidden}
          />
        ))}
        <Popover
          content={dropdownContent}
          trigger="click"
          open={dropdownVisible}
          onOpenChange={setDropdownVisible}
          placement="bottomLeft"
          overlayStyle={{
            width: popoverWidth > 0 ? popoverWidth : 'auto',
          }}
        >
          <AddControlLabel ref={addButtonRef}>
            <Icons.PlusOutlined
              iconSize="s"
              iconColor={theme.colorTextSecondary}
              css={css`
                margin-right: ${theme.sizeUnit}px;
              `}
            />
            {t('Add chart')}
          </AddControlLabel>
        </Popover>
      </LabelsContainer>
    </div>
  );
};

export default DeckSlicesControl;
