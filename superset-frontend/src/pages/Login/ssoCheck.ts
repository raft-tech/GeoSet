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

import { SupersetClient, logging } from '@superset-ui/core';

export type SsoHealthStatus = {
  reachable: boolean;
  status_code: number | null;
  error: string | null;
  configured: boolean;
};

const DEFAULT_ERROR_STATUS: SsoHealthStatus = {
  reachable: false,
  status_code: null,
  error: 'Failed to check SSO connectivity',
  configured: true,
};

async function reportSsoFailure(): Promise<void> {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localTime = new Date().toLocaleString();
    await SupersetClient.post({
      endpoint: '/api/v1/sso/failure',
      jsonPayload: { timezone, localTime },
    });
  } catch (error) {
    logging.error('Failed to report SSO failure:', error);
  }
}

const SSO_URL = 'https://sso.management.acf.gov';

export async function checkSsoHealth(): Promise<SsoHealthStatus> {
  try {
    const response = await fetch(SSO_URL, { method: 'HEAD' });
    if (!response.ok) {
      logging.error('SSO health check failed with status:', response.status);
      reportSsoFailure();
      return {
        reachable: false,
        status_code: response.status,
        error: `SSO returned ${response.status}`,
        configured: true,
      };
    }
    return {
      reachable: true,
      status_code: response.status,
      error: null,
      configured: true,
    };
  } catch (error) {
    logging.error('SSO health check error:', error);
    reportSsoFailure();
    return DEFAULT_ERROR_STATUS;
  }
}
