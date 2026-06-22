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
import { useEffect, useRef as useReactRef, type RefObject } from 'react';

/**
 * Calls `onClickOutside` when a mousedown event occurs outside the given ref element.
 * The listener is only attached when `isActive` is true.
 *
 * The callback is stored in a ref internally, so callers do not need to
 * stabilise it with `useCallback` — an unstable reference will not cause
 * the listener to be re-attached on every render.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClickOutside: () => void,
  isActive: boolean,
): void {
  const callbackRef = useReactRef(onClickOutside);
  callbackRef.current = onClickOutside;

  useEffect(() => {
    if (!isActive) return undefined;

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callbackRef.current();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isActive, ref]); // callbackRef is a stable useRef — no need to list it
}
