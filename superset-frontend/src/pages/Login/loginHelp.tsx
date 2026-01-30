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

import { useState, useEffect } from 'react';
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

interface LoginHelpForm {
  name: string;
  email: string;
  message?: string;
}

const StyledLabel = styled(Typography.Text)`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export function LoginHelpCard() {
  const [issueForm] = Form.useForm<LoginHelpForm>();
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [notification, setNotification] = useState<'success' | 'error' | null>(
    null,
  );

  useEffect(() => {
    if (notification) {
      const timeout = notification === 'success' ? 3000 : 5000;
      const timer = setTimeout(() => setNotification(null), timeout);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [notification]);

  const onIssueSubmit = async (values: LoginHelpForm) => {
    setSubmittingIssue(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localTime = new Date().toLocaleString();

      let ipAddress = 'Unknown';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch {
        logging.warn('Could not fetch IP from ipify');
      }

      await SupersetClient.post({
        endpoint: '/api/v1/login/help',
        jsonPayload: {
          name: values.name,
          email: values.email,
          message: values.message,
          ipAddress,
          timezone,
          localTime,
        },
      });

      setNotification('success');
    } catch (error) {
      logging.error('Failed to report issue:', error);
      setNotification('error');
    } finally {
      setSubmittingIssue(false);
      setShowIssueForm(false);
      issueForm.resetFields();
    }
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
        showIcon={false}
        closable={false}
        css={css`
          padding: 12px;
        `}
        message={
          <Flex gap="small">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24"
              viewBox="0 0 24 24"
              width="24"
              fill="#1b1b1b"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <div>
              <strong>{t('Are you having trouble signing in?')}</strong>
              <br />
              <br />
              {t(
                'Ensure you are connected to VPN or ethernet before logging in. If issues persist, ',
              )}
              {!showIssueForm ? (
                <Typography.Link
                  strong
                  underline
                  onClick={() => setShowIssueForm(true)}
                >
                  {t('contact us for assistance')}
                </Typography.Link>
              ) : (
                t('contact us for assistance')
              )}
              .
            </div>
          </Flex>
        }
      />

      {notification && (
        <Alert
          type={notification}
          showIcon
          message={
            notification === 'success'
              ? t('Report sent. Thank you!')
              : t('Failed to send report. Please try again.')
          }
          css={css`
            padding: 6px 12px;
          `}
        />
      )}

      {showIssueForm && (
        <Form
          form={issueForm}
          layout="vertical"
          requiredMark="optional"
          onFinish={onIssueSubmit}
        >
          <Form.Item<LoginHelpForm>
            label={<StyledLabel>{t('Name:')}</StyledLabel>}
            name="name"
            rules={[{ required: true, message: t('Please enter your name') }]}
          >
            <Input
              prefix={<Icons.UserOutlined iconSize="l" />}
              placeholder={t('Your name')}
            />
          </Form.Item>
          <Form.Item<LoginHelpForm>
            label={<StyledLabel>{t('Email:')}</StyledLabel>}
            name="email"
            validateTrigger="onBlur"
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
          <Form.Item<LoginHelpForm>
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
