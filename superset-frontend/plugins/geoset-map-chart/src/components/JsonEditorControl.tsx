/* eslint-disable theme-colors/no-literal-colors */
// src/controls/JsonCodeEditorControl.tsx
import { useState, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import { styled, SupersetTheme, t } from '@superset-ui/core';
import { InfoCircleOutlined } from '@ant-design/icons';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import { prettyStringify } from '../utils/safeStringify';

const Container = styled.div(
  ({ theme }: { theme: SupersetTheme }) => `
  font-family: ${theme.fontFamilyCode};
  font-size: 13px;
  background: ${theme.colorBgElevated};
  color: ${theme.colorText};

  .token.property {
    color: ${theme.colorPrimary};
  }
  .token.string {
    color: ${theme.colorSuccess};
  }
  .token.number,
  .token.boolean {
    color: ${theme.colorError};
  }
  .token.null {
    color: ${theme.colorTextSecondary};
  }
`,
);

const LabelRow = styled.div`
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Label = styled.span(
  ({ theme }) => `
  font-weight: 500;
  color: ${theme.colorText};
  font-size: 13px;
`,
);

const InfoIcon = styled(InfoCircleOutlined)(
  ({ theme }) => `
  color: ${theme.colorTextSecondary};
  cursor: pointer;
  font-size: 14px;

  &:hover {
    color: ${theme.colorPrimary};
  }
`,
);

const EditorWrapper = styled.div`
  max-height: 425px;
  width: 100%;
  overflow: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #fff;

  .npm__react-simple-code-editor__textarea,
  .npm__react-simple-code-editor__highlights {
    white-space: pre !important;
    display: inline-block !important;
    min-width: 100%;
  }

  pre {
    white-space: pre !important;
  }
`;

const JSON_CONFIG_SPEC_URL =
  'https://github.com/raft-tech/GeoSet/wiki/JSON-Config-Spec';

type JsonEditorControlProps = {
  label?: string;
  value?: string;
  onChange?: (val: string) => void;
  defaultValue: string;
};

/**
 * Normalize JSON string: parse then re-stringify with prettyStringify
 * so small arrays (like RGBA values) stay on one line.
 * Returns the original string if parsing fails (e.g. invalid JSON while editing).
 */
function normalizeJson(raw: string): string {
  if (!raw || !raw.trim().startsWith('{')) return raw;
  try {
    return prettyStringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

export default function JsonEditorControl({
  label,
  value,
  onChange,
  defaultValue,
}: JsonEditorControlProps) {
  const [localValue, setLocalValue] = useState<string>(() => {
    if (value != null && value !== '') return normalizeJson(value);
    if (defaultValue != null) return defaultValue;
    return '';
  });
  useEffect(() => {
    if (value != null && value !== '' && value !== localValue) {
      setLocalValue(normalizeJson(value));
    }
  }, [value]);

  const handleChange = (newCode: string) => {
    setLocalValue(newCode);
    onChange?.(newCode);
  };

  const handleBlur = () => {
    const normalized = normalizeJson(localValue);
    if (normalized !== localValue) {
      setLocalValue(normalized);
      onChange?.(normalized);
    }
  };

  return (
    <Container>
      {label && (
        <LabelRow>
          <Label id={`${label}-label`}>{label}</Label>
          <a
            href={JSON_CONFIG_SPEC_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <InfoIcon title={t('View JSON Config Spec wiki for full schema')} />
          </a>
        </LabelRow>
      )}
      <EditorWrapper onBlur={handleBlur}>
        <Editor
          value={localValue}
          onValueChange={handleChange}
          highlight={code =>
            Prism.highlight(code, Prism.languages.json, 'json')
          }
          padding={10}
          style={{
            fontFamily: '"Fira Code", monospace',
            fontSize: 13,
            backgroundColor: '#fff',
            color: '#1a1a1a',
            whiteSpace: 'pre',
            display: 'inline-block',
            minWidth: '100%',
          }}
        />
      </EditorWrapper>
    </Container>
  );
}
