export const geoPoint = ([lon,lat]) => {
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)throw Error('Invalid geographic coordinates.');
  return [(lon+180)*2,(90-lat)*2];
};
export function geoPaths(data) {
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>5000)throw Error('Invalid GeoJSON: expected a FeatureCollection.');
  let count=0;
  return data.features.map((f,i)=>{
    const geometry=f.geometry;
    const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:null;
    if(!Array.isArray(polygons))throw Error('The map accepts Polygon and MultiPolygon.');
    const path=polygons.map(polygon=>polygon.map(ring=>{
      if(!Array.isArray(ring)||ring.length<4)throw Error('Invalid geographic ring.');
      return ring.map((coordinate,index)=>{if(++count>100000)throw Error('Map is too complex.');const [x,y]=geoPoint(coordinate);return `${index?'L':'M'}${x},${y}`;}).join(' ')+'Z';
    }).join(' ')).join(' ');
    return {id:i,name:String(f.properties?.name||f.properties?.NAME||i),path};
  });
}
export function mapView(x,y,zoom) {
  const z=Math.min(16,Math.max(1,Number(zoom)||1)),width=720/z,height=360/z;
  return {x:Math.min(720-width/2,Math.max(width/2,x)),y:Math.min(360-height/2,Math.max(height/2,y)),zoom:z,width,height};
}
