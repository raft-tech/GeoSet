/* eslint-disable theme-colors/no-literal-colors */
// src/controls/JsonCodeEditorControl.tsx
import { useState, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import { styled, SupersetTheme } from '@superset-ui/core';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

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

const Label = styled.span(
  ({ theme }) => `
  font-weight: 500;
  color: ${theme.colorText};
  font-size: 13px;
`,
);

const EditorWrapper = styled.div`
  max-height: 425px;
  width: 100%;
  overflow: auto; /* horizontal and vertical scroll */
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

type JsonEditorControlProps = {
  label?: string;
  value?: string;
  onChange?: (val: string) => void;
  defaultValue: string;
};

export default function JsonEditorControl({
  label,
  value,
  onChange,
  defaultValue,
}: JsonEditorControlProps) {
  const [localValue, setLocalValue] = useState<string>(() => {
    if (value != null && value !== '') return value;
    if (defaultValue != null) return defaultValue;
    return '';
  });

  useEffect(() => {
    if (value != null && value !== '' && value !== localValue) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = (newCode: string) => {
    setLocalValue(newCode);
    onChange?.(newCode);
  };

  return (
    <Container>
      {label && (
        <div
          style={{
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Label id={`${label}-label`}>{label}</Label>
        </div>
      )}
      <EditorWrapper>
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
