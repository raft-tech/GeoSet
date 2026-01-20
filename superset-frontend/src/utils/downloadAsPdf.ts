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
import { SyntheticEvent } from 'react';
import domToImage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';
import { kebabCase } from 'lodash';
import { logging, t } from '@superset-ui/core';
import { addWarningToast } from '../components/MessageToasts/actions';

const generateFileStem = (description: string, date = new Date()) =>
  `${kebabCase(description)}-${date.toISOString().replace(/[: ]/g, '-')}`;

/**
 * Create an event handler for downloading an element as PDF
 */
export default function downloadAsPdf(
  selector: string,
  description: string,
  isExactSelector = false,
) {
  return async (event: SyntheticEvent) => {
    const element = isExactSelector
      ? document.querySelector(selector)
      : event.currentTarget.closest(selector);

    if (!element) {
      addWarningToast(t('PDF download failed, please refresh and try again.'));
      return;
    }

    const el = element as HTMLElement;
    const width = el.offsetWidth || el.scrollWidth;
    const height = el.offsetHeight || el.scrollHeight;

    if (width === 0 || height === 0) {
      addWarningToast(t('PDF download failed, please refresh and try again.'));
      return;
    }

    try {
      const filter = (node: Element) =>
        typeof node.className === 'string'
          ? !node.className.includes('mapboxgl-control-container') &&
            !node.className.includes('header-controls')
          : true;

      const dataUrl = await domToImage.toJpeg(element, {
        // eslint-disable-next-line theme-colors/no-literal-colors
        bgcolor: '#ffffff',
        filter,
        quality: 1,
        cacheBust: true,
      });

      // eslint-disable-next-line new-cap
      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      });

      pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
      pdf.save(`${generateFileStem(description)}.pdf`);
    } catch (error) {
      logging.error('Creating PDF failed', error);
      addWarningToast(t('PDF download failed, please refresh and try again.'));
    }
  };
}
