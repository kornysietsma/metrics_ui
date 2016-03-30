import d3 from 'd3';  // seems we have to do this once?
import TreeMap, * as tm from './TreeMap.js';

window.debug_tm = tm;

window.treemap = new TreeMap(tm.defaultConfig);
// window.treemap.render("age");
window.treemap.render("authors");
// window.treemap.render("language");
// window.treemap.render("jscomplexity");

