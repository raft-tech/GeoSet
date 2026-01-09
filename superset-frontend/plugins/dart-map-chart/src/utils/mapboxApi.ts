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

const MAPBOX_API_ENDPOINT = '/api/v1/dart_map/mapbox_api_key/';

// Cache the key and the in-flight promise to avoid duplicate requests
let cachedKey: string | null = null;
let pendingPromise: Promise<string | null> | null = null;

/**
 * Fetches the Mapbox API key from the backend.
 * Results are cached so subsequent calls return immediately.
 */
export async function fetchMapboxApiKey(): Promise<string | null> {
  // Return cached key immediately if available
  if (cachedKey) {
    return cachedKey;
  }

  // If a fetch is already in progress, return that promise (deduplication)
  if (pendingPromise) {
    return pendingPromise;
  }

  // Start the fetch
  pendingPromise = fetch(MAPBOX_API_ENDPOINT)
    .then(res => res.json())
    .then(data => {
      const key = data?.result?.MAPBOX_API_KEY || null;
      if (key) {
        cachedKey = key;
      }
      return key;
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch Mapbox API key:', err);
      return null;
    })
    .finally(() => {
      pendingPromise = null;
    });

  return pendingPromise;
}

/**
 * Returns the cached key synchronously, or null if not yet fetched.
 */
export function getCachedMapboxApiKey(): string | null {
  return cachedKey;
}

// Pre-fetch the key when the module loads (speeds up initial render)
fetchMapboxApiKey();
