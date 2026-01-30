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

import { useState } from 'react';
import { SupersetClient, logging, styled, t, css } from '@superset-ui/core';
import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  Typography,
  Icons,
} from '@superset-ui/core/components';

export type SsoHealthStatus = {
  reachable: boolean;
  status_code: number | null;
  error: string | null;
  configured: boolean;
};

interface LoginIssueForm {
  name: string;
  email: string;
  message?: string;
}

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

    // Get public IP from ipify
    let ipAddress = 'Unknown';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      ipAddress = ipData.ip;
    } catch {
      logging.warn('Could not fetch IP from ipify');
    }

    // Report to backend with IP address
    await SupersetClient.post({
      endpoint: '/api/v1/sso/failure',
      jsonPayload: { timezone, localTime, ipAddress },
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
      // reportSsoFailure();
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
    // reportSsoFailure();
    return DEFAULT_ERROR_STATUS;
  }
}

const StyledLabel = styled(Typography.Text)`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export function LoginIssueHelpCard() {
  const [issueForm] = Form.useForm<LoginIssueForm>();
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const onIssueSubmit = (values: LoginIssueForm) => {
    setSubmittingIssue(true);
    // TODO: Wire up to backend endpoint
    console.log('Issue reported:', values);
    setSubmittingIssue(false);
    setShowIssueForm(false);
    issueForm.resetFields();
  };

  return (
    <Flex
      vertical
      gap="middle"
      css={css`
        width: 100%;
        margin-top: 8px;
      `}
    >
      <Alert
        type="warning"
        showIcon
        closable={false}
        css={css`
          padding: 8px 12px;
        `}
        message={
          !showIssueForm ? (
            <>
              {t(
                "If you're seeing 403 Forbidden, make sure you're connected to the VPN.",
              )}{' '}
              <Typography.Link strong onClick={() => setShowIssueForm(true)}>
                {t('Report issue')}
              </Typography.Link>
            </>
          ) : (
            t(
              "If you're seeing 403 Forbidden, make sure you're connected to the VPN.",
            )
          )
        }
      />

      {showIssueForm && (
        <Form
          form={issueForm}
          layout="vertical"
          requiredMark="optional"
          onFinish={onIssueSubmit}
        >
          <Form.Item<LoginIssueForm>
            label={<StyledLabel>{t('Name:')}</StyledLabel>}
            name="name"
            rules={[{ required: true, message: t('Please enter your name') }]}
          >
            <Input
              prefix={<Icons.UserOutlined iconSize="l" />}
              placeholder={t('Your name')}
            />
          </Form.Item>
          <Form.Item<LoginIssueForm>
            label={<StyledLabel>{t('Email:')}</StyledLabel>}
            name="email"
            rules={[
              { required: true, message: t('Please enter your email') },
              { type: 'email', message: t('Please enter a valid email') },
            ]}
          >
            <Input
              prefix={<Icons.MailOutlined iconSize="l" />}
              placeholder={t('your.email@example.com')}
            />
          </Form.Item>
          <Form.Item<LoginIssueForm>
            label={<StyledLabel>{t('Message:')}</StyledLabel>}
            name="message"
          >
            <Input.TextArea
              rows={3}
              placeholder={t('Describe the issue you are experiencing...')}
            />
          </Form.Item>
          <Form.Item label={null}>
            <Flex
              gap="small"
              css={css`
                width: 100%;
              `}
            >
              <Button block onClick={() => setShowIssueForm(false)}>
                {t('Cancel')}
              </Button>
              <Button
                block
                type="primary"
                htmlType="submit"
                loading={submittingIssue}
              >
                {t('Submit')}
              </Button>
            </Flex>
          </Form.Item>
        </Form>
      )}
    </Flex>
  );
}
