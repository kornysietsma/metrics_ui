class LinearScaleStrategy {
    constructor(redish, blueish, domain) {
        this.colorRedToBlueLinearScale = d3.scale.linear()
            .range([redish, blueish]);
        this.darkerRedToBlueLinearScale = this.colorRedToBlueLinearScale
            .copy()
            .range([redish.darker(), blueish.darker()]);
            
        this.colorRedToBlueLinearScale
            .domain(domain);
        this.darkerRedToBlueLinearScale
            .domain(domain);
    }
    
    getFill(d, parentColor) {
        return this.getColor(d, parentColor, this.colorRedToBlueLinearScale);
    }
    
    getStroke(d, parentColor) {
        return this.getColor(d, parentColor, this.darkerRedToBlueLinearScale);
    }
}

class AgeStrategy extends LinearScaleStrategy {
    constructor(redish, blueish) {
        super(redish, blueish, [0, 24]);
        this.maxAge = 24;
    }

    getColor(d, parentColor, scale) {
        if (d.children) {
            return parentColor;
        }

        var inverseAge = 0;
        if (d.data &&
            d.data['code-maat']) {

            var age = 'ageMonths' in d.data['code-maat']
                ? d.data['code-maat'].ageMonths
                : this.maxAge;
            console.log('Name: ' + d.name + ' age: ' + age);
            inverseAge = this.maxAge - (age);
        }
        return scale(inverseAge);
    }

}

class AuthorsStrategy extends LinearScaleStrategy {
    constructor(redish, blueish) {
        super(redish, blueish, [0, 20]);
    }

    getColor(d, parentColor, scale) {
        return d.children
            ? parentColor
            : scale(d.data['code-maat'] && d.data['code-maat'].nAuthors ? d.data['code-maat'].nAuthors : 0);
    }
}

class JsComplexityStrategy extends LinearScaleStrategy {
    constructor(redish, blueish) {
        super(redish, blueish, [0, 14]);
        this.maxComplexity = 14;
        this.nutralColor = d3.rgb('green');
    }

    getColor(d, parentColor, scale) {
        if (d.children) {
            return parentColor;
        }
        
        if (d.data.jscomplexity && 'cyclomatic' in d.data.jscomplexity) {
            return scale(this.maxComplexity - d.data.jscomplexity.cyclomatic);
        } else {
            return this.nutralColor;
        }
    }
    
    getStroke(d, parentColor) {
        if (d.children) {
            return parentColor;
        }
        if (d.data.jscomplexity && 'cyclomatic' in d.data.jscomplexity) {
            return this.getColor(d, parentColor, this.darkerRedToBlueLinearScale);
        } else {
            return this.nutralColor.darker();
        }
    }
}

class LanguageStrategy {
    constructor() {
        this.scale = d3.scale.category20();
        this.strokeColor = d3.rgb("black");
    }
    
    getFill(d, parentColor) {
        if (d.children) {
            return parentColor;
        }
        
        if (d.data && d.data.cloc && d.data.cloc.language) {
            return this.scale(d.data.cloc.language);
        }
        
        return this.scale(0);
    }
    
    getStroke(d, parentColor) {
        if (d.children) {
            return parentColor;
        }
        else {
           return this.strokeColor; 
        }
    }
}

export default class TreeMap {
    constructor(maxTitleDepth = 4, minValueForTitle = 500) {
        this.w = 960;
        this.h = 700;
        this.paddingAllowance = 2;
        this.maxTitleDepth = maxTitleDepth;
        this.minValueForTitle = minValueForTitle;

        //this.color = d3.scale.category10();
        this.redish = d3.rgb("#E60D0D");
        this.blueish = d3.rgb("#0E34E0");
        this.parentStrokeColor = d3.rgb("#4E4545");
        this.parentFillColor = d3.rgb("#7D7E8C");

        this.colorRedToBlueLinearScale = d3.scale.linear()
            .range([this.redish, this.blueish]);
        this.darkerRedToBlueLinearScale = this.colorRedToBlueLinearScale
            .copy()
            .range([this.redish.darker(), this.blueish.darker()]);

        this.treemap = d3.layout.treemap()
            .size([this.w, this.h])
            .padding(d => {
                return this.showTitle(d) ? [16,1,1,1] : 1
            })
            .value(d => d.data.cloc ? d.data.cloc.code : null);

    }

    showTitle(d) {
        if (d.value < this.minValueForTitle) return 0;
        return d.children && d.depth <= this.maxTitleDepth;
    }

    getStragegy(outputType) {
        switch (outputType) {
            case "age":
                return new AgeStrategy(this.redish, this.blueish);
            case 'authors':
                return new AuthorsStrategy(this.redish, this.blueish);
            case 'language':
                return new LanguageStrategy();
            case 'jscomplexity':
                return new JsComplexityStrategy(this.redish, this.blueish);
        }
    }

    //outputType can be "age" or "authors"
    render(outputType) {
        var self = this;

        outputType = outputType || "age";

        var strategy = this.getStragegy(outputType);

        var svg = d3.select("body").append("svg")
            .style("position", "relative")
            .style("width", `${this.w}px`)
            .style("height", `${this.h}px`)
            .append("g")
            .attr("transform", "translate(-.5,-.5)");

        var tooltip = d3
            .select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        d3.json("/data/metrics.json", function(json) {
            var cell = svg.data([json]).selectAll("g")
                .data(self.treemap)
                .enter().append("g")
                .attr("class", "cell")
                .attr("transform", d => "translate(" + d.x + "," + d.y + ")");

            cell.on("mouseover", mouseover)
                .on("mouseout", mouseout);

            cell.append("rect")
                .attr("width", d => d.dx)
                .attr("height", d => d.dy)
                .style("fill", d => getCellFill(d))
                .style("stroke", d => getCellStroke(d))
                .style("z-index", d => -d.depth);

            cell.append("foreignObject")
                .attr("class", "foreignObject")
                .attr("width", d => Math.max(d.dx - self.paddingAllowance, 2))
                .attr("height", d => Math.max(d.dy - self.paddingAllowance, 2))
                .append("xhtml:body")
                .attr("class", "labelbody")
                .append("div")
                .attr("class", "label")
                .text(d => self.showTitle(d) ? d.name : null)
                .attr("text-anchor", "middle");

            function formatTooltip(d) {
                if (d.data) {
                    return `${d.name}<pre>${JSON.stringify(d.data, null, 2)}</pre>`
                } else {
                    console.log(d);
                    const {area, depth, value} = d;
                    const data = {area, depth, value};
                    return `${d.name}<pre>${JSON.stringify(data, null, 2)}</pre>`
                }
            }

            function mouseover(d) {
                //const text = Object.keys(d.data).map(key => `${key}:${d.data[key]}`).join("<br/>");
                tooltip.transition()
                    .duration(200);
                tooltip
                    .style("opacity", 0.9);
                tooltip.html(formatTooltip(d))
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY) + "px");
            }

            function mouseout(d) {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            }

            function getCellStroke(d) {
                return strategy.getStroke(d, self.parentStrokeColor, self.darkerRedToBlueLinearScale);
            }

            function getCellFill(d) {
                return strategy.getFill(d, self.parentFillColor, self.colorRedToBlueLinearScale);
            }
        });
    }
}

