var _ = require('lodash');

export const defaultConfig = {
    maxAge: 24,
    maxAuthors: 20,
    maxComplexity: 14,
    badColour: d3.rgb("#E60D0D"),
    goodColour: d3.rgb("#0E34E0"),
    neutralColour: d3.rgb("green"),
    defaultStrokeColour: d3.rgb("black"),
    parentStrokeColour: d3.rgb("#4E4545"),
    parentFillColour: d3.rgb("#7D7E8C")
};

function codeMaatDataFn(d) {
    return _.get(d,["data","code-maat","ageMonths"]);
}

function authorsDataFn(d) {
    return _.get(d, ["data","code-maat","nAuthors"]);
}

function languageDataFn(d) {
    return _.get(d, ["data","cloc","language"]);
}

function jsComplexityDataFn(d) {
    return _.get(d, ["data","jscomplexity","cyclomatic"]);
}

function buildScaledNodeColourFn(dataFn, parentColour, defaultColour, colourScale) {
    return d => {
        if (d.children) {
            return parentColour;
        }
        const value = dataFn(d);

        return value === undefined ? defaultColour : colourScale(value);
    }
}

export function strategies(config) {
    const badGoodScale = d3.scale.linear().range([config.badColour, config.goodColour]);
    const darkerBadGoodScale = d3.scale.linear().range([config.badColour.darker(), config.goodColour.darker()]);
    return {
        age: {
            fillFn: buildScaledNodeColourFn(codeMaatDataFn,
                config.parentFillColour,
                config.badColour,
                badGoodScale.copy().domain([config.maxAge, 0])),
            strokeFn: buildScaledNodeColourFn(codeMaatDataFn,
                config.parentStrokeColour,
                config.badColour.darker(),
                darkerBadGoodScale.copy().domain([config.maxAge, 0]))
        },
        authors: {
            fillFn: buildScaledNodeColourFn(authorsDataFn,
                config.parentFillColour,
                config.badColour,
                badGoodScale.copy().domain([0,config.maxAuthors])),
            strokeFn: buildScaledNodeColourFn(authorsDataFn,
                config.parentStrokeColour,
                config.badColour.darker(),
                darkerBadGoodScale.copy().domain([0,config.maxAuthors]))
        },
        language: {
            fillFn: buildScaledNodeColourFn(languageDataFn,
                config.parentFillColour,
                config.neutralColour,
                d3.scale.category20()),
            strokeFn: d => config.defaultStrokeColour
        },
        jscomplexity: {
            fillFn: buildScaledNodeColourFn(jsComplexityDataFn,
                config.parentFillColour,
                config.neutralColour,
                badGoodScale.copy().domain([config.maxComplexity, 0])),
            strokeFn: buildScaledNodeColourFn(jsComplexityDataFn,
                config.parentStrokeColour,
                config.neutralColour.darker(),
                darkerBadGoodScale.copy().domain([config.maxComplexity, 0]))
        }
    }
}


export default class TreeMap {
    constructor(config, maxTitleDepth = 4, minValueForTitle = 500) {
        this.config = config;
        this.strategies = strategies(this.config);
        this.w = 960;
        this.h = 700;
        this.paddingAllowance = 2;
        this.maxTitleDepth = maxTitleDepth;
        this.minValueForTitle = minValueForTitle;

        this.treemap = d3.layout.treemap()
            .size([this.w, this.h])
            .padding(d => this.padding(d))
            .value(d => d.data.cloc ? d.data.cloc.code : null);
        
    }

    padding(d) {
        return this.showTitle(d) ? [16, 1, 1, 1] : 1
    }

    showTitle(d) {
        if (d.value < this.minValueForTitle) return 0;
        return d.children && d.depth <= this.maxTitleDepth;
    }

    mouseOver(d) {
        this.tooltip.transition()
            .duration(200);
        this.tooltip
            .style("opacity", 0.9);
        this.tooltip.html(this.formatTooltip(d))
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY) + "px");
    }


    mouseOut(d) {
        this.tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }

    formatTooltip(d) {
        if (d.data) {
            return `${d.name}<pre>${JSON.stringify(d.data, null, 2)}</pre>`
        } else {
            // TODO: can we use lodash for this:
            const {area, depth, value} = d;
            const data = {area, depth, value};
            return `${d.name}<pre>${JSON.stringify(data, null, 2)}</pre>`
        }
    }

    //outputType can be any valid strategy
    render(outputType) {
        // TODO: render has all sorts of side effects - and there's no clean-up
        // needs thought on modularity, and the meaning of calling render multiple times.
        // the real goal would be to be able to render once, then use d3 magic to re-render
        //  with a different strategy, different root note, all the rest.
        
        var strategy = this.strategies[outputType];
        
        this.tooltip = d3
            .select("body")
            .append("div")
            .attr("class", "tooltip");

        this.svg = d3.select("body").append("svg")
            .style("position", "relative")
            .style("width", `${this.w}px`)
            .style("height", `${this.h}px`)
            .append("g")
            .attr("transform", "translate(-.5,-.5)");


        d3.json("/data/metrics.json", (json) => {
            var cell = this.svg.data([json]).selectAll("g")
                .data(this.treemap)
                .enter().append("g")
                .attr("class", "cell")
                .attr("transform", d => "translate(" + d.x + "," + d.y + ")");

            cell.on("mouseover", d => this.mouseOver(d))
                .on("mouseout", d => this.mouseOut(d));

            cell.append("rect")
                .attr("width", d => d.dx)
                .attr("height", d => d.dy)
                .style("fill", strategy.fillFn)
                .style("stroke", strategy.strokeFn)
                .style("z-index", d => -d.depth);

            cell.append("foreignObject")
                .attr("class", "foreignObject")
                .attr("width", d => Math.max(d.dx - this.paddingAllowance, 2))
                .attr("height", d => Math.max(d.dy - this.paddingAllowance, 2))
                .append("xhtml:body")
                .attr("class", "labelbody")
                .append("div")
                .attr("class", "label")
                .text(d => this.showTitle(d) ? d.name : null)
                .attr("text-anchor", "middle");

        });
    }
}

