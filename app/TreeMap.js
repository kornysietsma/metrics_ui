var _ = require('lodash');
var $ = require('jquery');

export const defaultConfig = {
    maxAge: 24,
    maxAuthors: 5, // i.e. if a file has 5 authors or more, it's ok
    maxComplexity: 14,
    maxIndentComplexity: 8,
    maxCoupling: 1200,  // this is broken, should be scanning data for max coupling. Though d3.js in my example breaks this!
    badColour: d3.rgb("#E60D0D"),
    goodColour: d3.rgb("#0E34E0"),
    neutralColour: d3.rgb("green"),
    defaultStrokeColour: d3.rgb("black"),
    parentStrokeColour: d3.rgb("#4E4545"),
    parentFillColour: d3.rgb("#7D7E8C"),
    maxTitleDepth:4,
    minValueForTitle: 500
};

function codeMaatDataFn(d) {
    return _.get(d,["data","code-maat","ageMonths"]) || _.get(d,["data","code-maat","age-months"]);
}

function authorsDataFn(d) {
    return _.get(d, ["data","code-maat","nAuthors"]) || _.get(d, ["data","code-maat","n-authors"]);
}

function languageDataFn(d) {
    return _.get(d, ["data","cloc","language"]);
}

function jsComplexityDataFn(d) {
    return _.get(d, ["data","jscomplexity","cyclomatic"]) || _.get(d, ["data","complexity-report","worst-cyclomatic"]);
}

function couplingDataFn(d) {
    return _.get(d, ["data","code-maat","soc"]);
}

function indentComplexityDataFn(d) {
    return _.get(d, ["data","indents","stats","percentiles","90"]);
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
    const oneAuthorColour = badGoodScale(0.25); // it's pretty bad to have one author - but not nearly as bad as 0
    const twoAuthorColour = badGoodScale(0.5);  // it's not great to have two authors - but not nearly as bad as 1
    const authorScale = d3.scale.linear().range([config.badColour, oneAuthorColour, twoAuthorColour, config.goodColour]);
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
                authorScale.copy().domain([0,1,2,config.maxAuthors])),
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
        },
        coupling: {
            fillFn: buildScaledNodeColourFn(couplingDataFn,
                config.parentFillColour,
                config.neutralColour,
                badGoodScale.copy().domain([config.maxCoupling, 0])),
            strokeFn: buildScaledNodeColourFn(couplingDataFn,
                config.parentStrokeColour,
                config.neutralColour.darker(),
                darkerBadGoodScale.copy().domain([config.maxCoupling, 0]))
        },
        complexity: {
            fillFn: buildScaledNodeColourFn(indentComplexityDataFn,
                config.parentFillColour,
                config.neutralColour,
                badGoodScale.copy().domain([config.maxIndentComplexity, 0])),
            strokeFn: buildScaledNodeColourFn(indentComplexityDataFn,
                config.parentStrokeColour,
                config.neutralColour.darker(),
                darkerBadGoodScale.copy().domain([config.maxIndentComplexity, 0]))
        },
    }
}

function pathName(node) {
    if (node.parent && node.parent.parent) return `${pathName(node.parent)}/${node.name}`
    else return node.name;
}

export default class TreeMap {
    constructor(config, strategySelector) {
        this.config = config;
        this.strategies = strategies(this.config);
        this.strategySelectorEl = $(strategySelector);

        this.strategySelectorEl.on('change', () => this.update());
        this.w = 960;
        this.h = 700;
        this.paddingAllowance = 2;

        this.treemap = d3.layout.treemap()
            .size([this.w, this.h])
            .padding(d => this.padding(d))
            .value(d => d.data.cloc ? d.data.cloc.code : null);

        this.tooltip = d3.select(".tooltip");

        this.status = d3.select("#status");

        this.svg = d3.select("#tree");
    }

    padding(d) {
        return this.showTitle(d) ? [16, 1, 1, 1] : 1
    }

    showTitle(d) {
        if (d.value < this.config.minValueForTitle) {
            return 0;
        } else {
            return d.children && d.depth <= this.config.maxTitleDepth;
        }
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

    click(d) {
        this.status.html(this.formatStatus(d));
    }


    mouseOut(d) {
        this.tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }

    formatTooltip(d) {
        return `${pathName(d)}<br/>loc: ${d.value}`
    }

    formatStatus(d) {
        if (d.data) {
            return `${pathName(d)}<pre>${JSON.stringify(d.data, null, 2)}</pre>`
        } else {
            // TODO: can we use lodash for this:
            const {area, depth, value} = d;
            const data = {area, depth, value};
            return `${pathName(d)}<pre>${JSON.stringify(data, null, 2)}</pre>`
        }
    }

    render() {
        const strategyName = this.strategySelectorEl.val();
        const strategy = this.strategies[strategyName];

        console.log(`rendering strategy ${strategyName}`);

        d3.json("/data/metrics.json", (root) => {

            var cell = this.svg.datum(root).selectAll("g")
                .data(this.treemap.nodes)
                .enter().append("g")
                .attr("class", "cell")
                .attr("transform", d => "translate(" + d.x + "," + d.y + ")");

            cell.on("mouseover", d => this.mouseOver(d))
                .on("mouseout", d => this.mouseOut(d))
                .on("click", d => this.click(d));

            cell.append("rect")
                .attr("class", "treerect")
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

    update() {
        const strategyName = this.strategySelectorEl.val();
        const strategy = this.strategies[strategyName];

        console.log(`rendering strategy ${strategyName}`);

        this.svg.selectAll(".treerect")
            .style("fill", strategy.fillFn)
            .style("stroke", strategy.strokeFn);

    }
}

