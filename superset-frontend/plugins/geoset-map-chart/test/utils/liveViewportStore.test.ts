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
import {
  setLiveViewport,
  getLiveViewport,
} from '../../src/utils/liveViewportStore';
import { Viewport } from '../../src/utils/fitViewport';

describe('liveViewportStore', () => {
  it('stores and retrieves a viewport', () => {
    const viewport: Viewport = {
      longitude: -77.0369,
      latitude: 38.9072,
      zoom: 10,
      bearing: 0,
      pitch: 0,
    };
    setLiveViewport(viewport);
    expect(getLiveViewport()).toBe(viewport);
  });

  it('overwrites previous viewport on subsequent set', () => {
    const vp1: Viewport = {
      longitude: 0,
      latitude: 0,
      zoom: 1,
      bearing: 0,
      pitch: 0,
    };
    const vp2: Viewport = {
      longitude: 10,
      latitude: 20,
      zoom: 5,
      bearing: 45,
      pitch: 30,
    };

    setLiveViewport(vp1);
    setLiveViewport(vp2);
    expect(getLiveViewport()).toBe(vp2);
  });
});
