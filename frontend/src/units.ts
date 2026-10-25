// The API retains its existing metric schema. Convert only at the UI boundary.
export const METERS_PER_MILE=1609.344;
export const METERS_PER_FOOT=.3048;
export const kphToMph=(value:number)=>value/1.609344;
export const mphToKph=(value:number)=>value*1.609344;
export const feet=(meters:number)=>`${Math.round(meters/METERS_PER_FOOT).toLocaleString()} ft`;
export const miles=(meters:number)=>`${(meters/METERS_PER_MILE).toFixed(2)} mi`;
export const distance=(meters:number)=>meters<METERS_PER_MILE*.1?feet(meters):miles(meters);
export const speed=(kph:number)=>`${kphToMph(kph).toFixed(2)} mph`;
