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
    };
    this.onDraftChange = this.onDraftChange.bind(this);
  }

  onDraftChange(ctrl, value) {
    const rounded = value != null ? Math.round(value * 10000) / 10000 : value;
    this.setState(prevState => ({
      draftValue: {
        ...prevState.draftValue,
        [ctrl]: rounded,
      },
    }));
  }

  renderTextControl(ctrl) {
    const raw = (this.state.draftValue || this.props.value)[ctrl];
    const display = raw != null ? Math.round(raw * 10000) / 10000 : raw;
    return (
      <div key={ctrl}>
        <FormLabel>{ctrl}</FormLabel>
        <TextControl
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
            onClick={() => this.setState({ popoverVisible: false, draftValue: null })}
            style={{ flex: 1 }}
          >
            {t('Close')}
          </Button>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            onClick={() => {
              if (this.state.draftValue) {
                this.props.onChange(this.state.draftValue);
              }
              this.setState({ popoverVisible: false, draftValue: null });
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
    if (this.props.value.longitude && this.props.value.latitude) {
      return `${decimal2sexagesimal(
        this.props.value.longitude,
      )} | ${decimal2sexagesimal(this.props.value.latitude)}`;
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
                onClick={() => {
                  const live = this.props.liveViewport || this.props.value;
                  this.setState({ draftValue: { ...live } });
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const live = this.props.liveViewport || this.props.value;
                    this.setState({ draftValue: { ...live } });
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
            if (open) {
              this.setState({ popoverVisible: true, draftValue: { ...this.props.value } });
            } else {
              this.setState({ popoverVisible: false, draftValue: null });
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
