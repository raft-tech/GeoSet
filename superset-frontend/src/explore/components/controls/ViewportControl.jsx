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
import { Component } from 'react';
import { t } from '@superset-ui/core';
import PropTypes from 'prop-types';
import { Popover, FormLabel, Label, Button } from '@superset-ui/core/components';
import { decimal2sexagesimal } from 'geolib';

import TextControl from './TextControl';
import ControlHeader from '../ControlHeader';

export const DEFAULT_VIEWPORT = {
  longitude: 6.85236157047845,
  latitude: 31.222656842808707,
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

const PARAMS = ['longitude', 'latitude', 'zoom', 'bearing', 'pitch'];

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.shape({
    longitude: PropTypes.number,
    latitude: PropTypes.number,
    zoom: PropTypes.number,
    bearing: PropTypes.number,
    pitch: PropTypes.number,
  }),
  default: PropTypes.object,
  name: PropTypes.string.isRequired,
};

const defaultProps = {
  onChange: () => {},
  default: { type: 'fix', value: 5 },
  value: DEFAULT_VIEWPORT,
};

export default class ViewportControl extends Component {
  constructor(props) {
    super(props);
    this.state = {
      popoverVisible: false,
      draftValue: null,
      // Snapshot of props.value when the popover opened.
      // Close reverts to this; Save keeps the current live values.
      openValue: null,
      // Incremented on Capture to force TextControl remount.
      // TextControl has a stale-state bug: it detects prop changes only once
      // in render() but never calls setState, so the next re-render reverts
      // to the old internal value.  Changing the key forces a fresh mount.
      captureKey: 0,
    };
    this.onDraftChange = this.onDraftChange.bind(this);
  }

  onDraftChange(ctrl, value) {
    const num = value === '' || value == null ? null : Number(value);
    const rounded = num != null && !Number.isNaN(num)
      ? Math.round(num * 10000) / 10000
      : null;
    this.setState(
      prevState => ({
        draftValue: {
          ...prevState.draftValue,
          [ctrl]: rounded,
        },
      }),
      () => {
        // Live-update the map only when all fields are valid numbers
        const draft = this.state.draftValue;
        if (draft && PARAMS.every(p => draft[p] != null)) {
          this.props.onChange(draft);
        }
      },
    );
  }

  renderTextControl(ctrl) {
    const raw = (this.state.draftValue || this.props.value)[ctrl];
    const display = raw != null ? Math.round(raw * 10000) / 10000 : raw;
    return (
      <div key={ctrl}>
        <FormLabel>{ctrl}</FormLabel>
        <TextControl
          key={`${ctrl}-${this.state.captureKey}`}
          value={display}
          onChange={this.onDraftChange.bind(this, ctrl)}
          isFloat
        />
      </div>
    );
  }

  renderPopover() {
    return (
      <div id={`filter-popover-${this.props.name}`}>
        {PARAMS.map(ctrl => this.renderTextControl(ctrl))}
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={() => {
              // Revert map to the viewport from when the popover opened
              if (this.state.openValue) {
                this.props.onChange(this.state.openValue);
              }
              this.setState({ popoverVisible: false, draftValue: null, openValue: null });
            }}
            style={{ flex: 1 }}
          >
            {t('Close')}
          </Button>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            onClick={() => {
              // Ensure any null fields fall back to 0 before persisting
              const draft = this.state.draftValue;
              if (draft) {
                const cleaned = { ...draft };
                PARAMS.forEach(p => { if (cleaned[p] == null) cleaned[p] = 0; });
                this.props.onChange(cleaned);
              }
              this.setState({ popoverVisible: false, draftValue: null, openValue: null });
            }}
            style={{ flex: 1 }}
          >
            {t('Save')}
          </Button>
        </div>
      </div>
    );
  }

  renderLabel() {
    const { longitude, latitude } = this.props.value || {};
    if (longitude != null && latitude != null) {
      return `${decimal2sexagesimal(longitude)} | ${decimal2sexagesimal(latitude)}`;
    }
    return 'N/A';
  }

  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        <Popover
          trigger="click"
          placement="right"
          content={this.renderPopover()}
          destroyTooltipOnHide
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('Viewport')}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={e => {
                  e.stopPropagation();
                  const live = this.props.getLiveViewport?.() || this.props.value;
                  this.setState(
                    prev => ({
                      draftValue: { ...live },
                      captureKey: prev.captureKey + 1,
                    }),
                    () => {
                      this.props.onChange(this.state.draftValue);
                    },
                  );
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    const live = this.props.getLiveViewport?.() || this.props.value;
                    this.setState(
                      prev => ({
                        draftValue: { ...live },
                        captureKey: prev.captureKey + 1,
                      }),
                      () => {
                        this.props.onChange(this.state.draftValue);
                      },
                    );
                  }
                }}
                style={{
                  color: '#20A7C9',
                  fontSize: 10,
                  cursor: 'pointer',
                  border: '1px solid #20A7C9',
                  borderRadius: 3,
                  padding: '1px 5px',
                }}
              >
                {t('Capture Map Viewport')}
              </span>
            </div>
          }
          open={this.state.popoverVisible}
          onOpenChange={open => {
            if (open && !this.state.popoverVisible) {
              // Only initialize draft when actually opening (not when already open)
              this.setState({
                popoverVisible: true,
                draftValue: { ...this.props.value },
                openValue: { ...this.props.value },
              });
            } else if (!open) {
              // Clicking outside = revert (same as Close)
              if (this.state.openValue) {
                this.props.onChange(this.state.openValue);
              }
              this.setState({ popoverVisible: false, draftValue: null, openValue: null });
            }
          }}
        >
          <Label className="pointer">{this.renderLabel()}</Label>
        </Popover>
      </div>
    );
  }
}

ViewportControl.propTypes = propTypes;
ViewportControl.defaultProps = defaultProps;
