import { memo } from 'react';

export class Row {
  key: string;
  value: string;
  constructor(key: string, value: string) {
    this.key = key
    this.value = value
  }
}
  
export const Flyout = (rows: Row[], setOpen: (open: boolean) => void) => {
    const closeFlyout = () => {setOpen(false)}
    
    const closeDiv = (
      <div 
        key="legend-close"
        style={{
          position: 'absolute',
          top: '2px',
          right: '2px',
          zIndex: '1',
        }}
      >
        <button
          type="button"
          title='Close Flyout'
          style={{
            borderStyle: 'none',
            background: 'none',
          }}
          onClick={closeFlyout}
        >
          X
        </button>
      </div>
    );
  
    const rowsHtml = rows.map(o => {
    
      return (
        <div id={o.key} key={o.key} style={{ display: 'flex', whiteSpace: 'nowrap'}}>
          <div key={o.key} style={{ paddingRight: '5px', fontWeight: 'bold'}}>{o.key}: </div>
          <div key={o.value}>{o.value}</div>
        </div>
      );
    });
  
    return (
      <div key="main-flyout"
        style={{
          position: 'absolute',
          top: '35px',
          right: '5px',
          minHeight: '70px',
          maxHeight: '80%',
          minWidth: '125px',
          width: '25%',
          background: `rgb(255, 255, 255)`,
          overflow: 'hidden',
          display: 'flex',
        }}
      >
         {closeDiv}
        <div
          id="flyout"
          key="flyout"
          style={{
            paddingTop: '23px',
            paddingBottom: '10px',
            paddingLeft: '5px',
            paddingRight: '5px',
            overflow: 'auto',
            flex: '1',
          }}
        >
          {rowsHtml}
        </div>
      </div>
    );
  };
  
  export default memo(Flyout);