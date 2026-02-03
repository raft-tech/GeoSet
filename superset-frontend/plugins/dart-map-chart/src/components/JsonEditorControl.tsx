/* eslint-disable theme-colors/no-literal-colors */
// src/controls/JsonCodeEditorControl.tsx
import { useState, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import { styled, SupersetTheme, t } from '@superset-ui/core';
import { Popover, Button, Typography } from 'antd';
import {
  InfoCircleOutlined,
  CopyOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

const { Text } = Typography;

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

const PopoverContentWrapper = styled.div`
  width: 380px;
  max-height: 450px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const PopoverHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const TemplateCode = styled.pre(
  ({ theme }) => `
  font-family: ${theme.fontFamilyCode};
  font-size: 11px;
  background: ${theme.colorBgContainer};
  border: 1px solid ${theme.colorBorder};
  border-radius: 4px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  white-space: pre;
  color: ${theme.colorText};
  max-height: 380px;

  .optional-comment {
    color: ${theme.colorTextSecondary};
    font-style: italic;
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

// Template JSON with optional fields marked
const templateJson = `{
  "globalColoring": {
    "fillColor": [40, 147, 179, 255],
    "strokeColor": [0, 0, 0, 255],
    "strokeWidth": 2,
    "pointType": "circle",       // optional
    "pointSize": 6,              // optional
    "lineStyle": "solid",
    "fillPattern": "solid"
  },
  "colorByCategory": {
    "dimension": "category_field",
    "categoricalColors": [
      {
        "example_category_1": {
          "fillColor": [0, 0, 255, 255],
          "legend_entry_name": "category_1"
        }
      },
      {
        "example_category_2": {
          "fillColor": [255, 0, 0, 255],
          "legend_entry_name": "category_2"
        }
      }
    ],
    "defaultLegendName": ["Other", "Unknown"]
  },
  "colorByValue": {
    "valueColumn": "column_metrics_will_be_applied_to",
    "upperBound": null,          // optional
    "lowerBound": null,          // optional
    "startColor": [0, 255, 0, 255],
    "endColor": [255, 0, 0, 255],
    "breakpoints": []
  },
  "legend": {
    "name": "human_readable_legend_chart_title",
    "title": "title_for_legend_section"
  }
}`;

// Clean template (without comments) for copying
const cleanTemplateJson = JSON.stringify(
  {
    globalColoring: {
      fillColor: [40, 147, 179, 255],
      strokeColor: [0, 0, 0, 255],
      strokeWidth: 2,
      pointType: 'circle',
      pointSize: 6,
      lineStyle: 'solid',
      fillPattern: 'solid',
    },
    colorByCategory: {
      dimension: 'category_field',
      categoricalColors: [
        {
          example_category_1: {
            fillColor: [0, 0, 255, 255],
            legend_entry_name: 'category_1',
          },
        },
        {
          example_category_2: {
            fillColor: [255, 0, 0, 255],
            legend_entry_name: 'category_2',
          },
        },
      ],
      defaultLegendName: ['Other', 'Unknown'],
    },
    colorByValue: {
      valueColumn: 'column_metrics_will_be_applied_to',
      upperBound: null,
      lowerBound: null,
      startColor: [0, 255, 0, 255],
      endColor: [255, 0, 0, 255],
      breakpoints: [],
    },
    legend: {
      name: 'human_readable_legend_chart_title',
      title: 'title_for_legend_section',
    },
  },
  null,
  2,
);

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (value != null && value !== '' && value !== localValue) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = (newCode: string) => {
    setLocalValue(newCode);
    onChange?.(newCode);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanTemplateJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = cleanTemplateJson;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Highlight optional comments in the template
  const highlightTemplate = (code: string) => {
    const highlighted = Prism.highlight(code, Prism.languages.json, 'json');
    return highlighted.replace(
      /(\/\/ optional)/g,
      '<span class="optional-comment">$1</span>',
    );
  };

  const popoverContent = (
    <PopoverContentWrapper>
      <PopoverHeader>
        <Text strong>{t('Template Configuration')}</Text>
        <Button
          size="small"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
        >
          {copied ? t('Copied!') : t('Copy')}
        </Button>
      </PopoverHeader>
      <TemplateCode
        dangerouslySetInnerHTML={{
          __html: highlightTemplate(templateJson),
        }}
      />
    </PopoverContentWrapper>
  );

  return (
    <Container>
      {label && (
        <LabelRow>
          <Label id={`${label}-label`}>{label}</Label>
          <Popover
            content={popoverContent}
            trigger="click"
            placement="rightTop"
            overlayStyle={{ maxWidth: 420 }}
          >
            <InfoIcon title={t('View template configuration')} />
          </Popover>
        </LabelRow>
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
