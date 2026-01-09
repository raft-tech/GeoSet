import { useState } from 'react';
import { Button, Typography } from '@material-ui/core';
import MapIcon from '@material-ui/icons/MapTwoTone';
import { getSvg } from '../utils/svgIcons';
import { LegendItem, toHex } from '../types';

export class Legend {
  name: string;

  icon_type: string;

  fill_color: string;
}

export const DeckLegend = (legends: Record<number, LegendItem[]>) => {
  const [showPopup, setShowPopup] = useState(false);

  const SIZE = 18;
  const names = Object.values(legends);

  const closeDiv = (
    <div
      key="close-legend"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <button
        type="button"
        style={{
          borderStyle: 'none',
          background: 'none',
        }}
        onClick={() => setShowPopup(false)}
      >
        X
      </button>
    </div>
  );

  const nameComps = names.flatMap(arr =>
    arr.map(o => {
      // replace option with your component name
      const svg: string = getSvg(o.type, toHex(o.style.fillColor), SIZE, SIZE);
      return (
        <div id={o.description} key={o.description} style={{ display: 'flex' }}>
          <div
            key="icon-legend"
            style={{
              paddingLeft: '5px',
              paddingRight: '5px',
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div key="text-legend" style={{ paddingRight: '5px' }}>
            {o.description}
          </div>
        </div>
      );
    }),
  );

  return (
    <div key="main-legend">
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          padding: 8,
          zIndex: 1500,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Button
          onClick={() => setShowPopup(true)}
          disableElevation
          variant="outlined"
          style={{
            padding: '10px 15px',
            borderRadius: 8,
            backgroundColor: '#fff',
            zIndex: 1500,
            textTransform: 'none',
            boxShadow: '0px 2px 5px rgba(0,0,0,0.1)',
            display: showPopup ? 'none' : 'block',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            <MapIcon style={{ fontSize: 30, marginBottom: 4 }} />
            <Typography variant="caption">LEGEND</Typography>
          </div>
        </Button>
      </div>
      <div
        id="legends"
        key="legends"
        style={{
          position: 'absolute',
          bottom: '5px',
          left: '5px',
          background: `rgb(255, 255, 255)`,
          minHeight: '70px',
          minWidth: '125px',
          display: showPopup ? 'block' : 'none',
        }}
      >
        {closeDiv}
        {nameComps}
      </div>
    </div>
  );
};
