import d3 from 'd3';  // seems we have to do this once?
import TreeMap, * as tm from './TreeMap.js';

window.debug_tm = tm;

window.treemap = new TreeMap(tm.defaultConfig,"#strategy");
window.treemap.render();

