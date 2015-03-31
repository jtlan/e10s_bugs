/* global d3, Plottable */

var e10s_start = new Date(2014,02,11);
var bugs, plots, newbugs, bugsOfTheWeek, trackingvals;
var weeklyDetails;
var RESOLUTIONS = ["INCOMPLETE", "WORKSFORME", "INVALID", "WONTFIX", "DUPLICATE", "FIXED", ""];
d3.json('data/bug-data.json', function(err, data) {
    bugs = [];
    var bug, stoneset = d3.set();
    for (var bug_id in data) {
        bug = data[bug_id];
        bug.creation_time = new Date(bug.creation_time);
        bug.monday = d3.time.monday(bug.creation_time);
        bugs.push(bug);
        if (bug.cf_tracking_e10s && bug.cf_tracking_e10s[0] === 'm') {
            stoneset.add(bug.cf_tracking_e10s);
        }
    }
    bugs.sort(function(l, r) {
       if (l.creation_time < r.creation_time) {
           return -1;
       }
       return 1;
    });
    document.querySelector("#bugCount").textContent = bugs.length;
    var reporterByDate = (function() {
        var creators = {};
        var c_count = 0;
        function _rpbd(d) {
            var creator = d.creator;
            if (creator in creators) {
                creators[creator] += 1;
            }
            else {
                creators[creator] = 1;
                ++c_count;
            }
            d.reporters = c_count;
        }
        return _rpbd;

    })();
    bugs.forEach(reporterByDate);
    newbugs = bugs.filter(function(b){return b.creation_time > e10s_start});
    bugsOfTheWeek = [];
    var lastweek, item;
    for (var i=0, ii=newbugs.length; i<ii; ++i) {
        bug = newbugs[i];
        var this_monday = bug.monday.toISOString();
        if (this_monday != lastweek) {
            if (item) {
                bugsOfTheWeek.push(item);
            }
            item = {
                week: d3.time.thursday.ceil(bug.monday),
                start: d3.time.monday.floor(bug.creation_time),
                end: d3.time.monday.ceil(bug.creation_time),
                creators: {},
                bugs:[]
            };
        }
        item.creators[bug.creator] = true;
        item.bugs.push(bug);
        lastweek = this_monday;
    }
    if (item) {
        bugsOfTheWeek.push(item);
    }
    trackingvals = stoneset.values().sort();
    trackingvals.splice(0, 0, '-', '---', '?', '+');
    trackingvals.push('later');
    makeReporterChart();

    makeBugChartPlottable(d3.select("#bugs-trackage"), trackingvals, function(bug) {
        return bug.cf_tracking_e10s||'---';
    });
    makeBugChartPlottable(d3.select("#bugs-resolution"), RESOLUTIONS, function(bug) {
        return bug.resolution;
    }, 5);
});

function makeReporterChart() {
    var xScale = new Plottable.Scale.Time();
    var yTotalScale = new Plottable.Scale.Linear();
    var xAxis = new Plottable.Axis.Time(xScale, "bottom");
    var yTotalAxis = new Plottable.Axis.Numeric(yTotalScale, "left");
    var colorScale = new Plottable.Scale.Color();

    var totalplot = new Plottable.Plot.Line(xScale, yTotalScale);
    totalplot.addDataset(newbugs);
    function getXDataValue(d) {
      return d.creation_time;
    }
    totalplot.project("x", getXDataValue, xScale);
    function getYDataValue(d) {
      return d.reporters;
    }
    totalplot.project("y", getYDataValue, yTotalScale);
    totalplot.project("stroke", colorScale.scale(0));
    var yWeeklyScale = new Plottable.Scale.Linear();
    var weeklyplot = new Plottable.Plot.Line(xScale, yWeeklyScale);
    weeklyplot.addDataset(bugsOfTheWeek);
    weeklyplot.project("x", function(item) {
      return item.week;
    }, xScale);
    weeklyplot.project("y", function(item) {
      return Object.keys(item.creators).length;
    }, yWeeklyScale);
    weeklyplot.project("stroke", colorScale.scale(1));
    var yWeeklyAxis = new Plottable.Axis.Numeric(yWeeklyScale, "right");
    plots = new Plottable.Component.Group([totalplot, weeklyplot]);
    var chart = new Plottable.Component.Table([
      [yTotalAxis, plots, yWeeklyAxis],
      [null,  xAxis, null]
    ]);
    chart.renderTo("#reporterChart");
}

function makeBugChartPlottable(svg, valuelist, accessor, below_the_fold) {
    weeklyDetails = [];
    bugsOfTheWeek.forEach(function(d) {
        weeklyDetails = weeklyDetails.concat(detailsForWeek(d, valuelist, accessor, below_the_fold));
    });
    var xScale = new Plottable.Scale.Time();
    var yScale = new Plottable.Scale.Linear();
    var colorScale = new Plottable.Scale.Color("20");
    var xAxis = new Plottable.Axis.Time(xScale, "bottom");
    var yAxis = new Plottable.Axis.Numeric(yScale, "left");
    yAxis.formatter(function(d) { return String(Math.abs(d)); });

    var bars = new Plottable.Plot.StackedBar(xScale, yScale, true);
    bars.barAlignment("left");

    var label2Data = {};
    valuelist.forEach(function(label) {
        label2Data[label] = [];
    });
    weeklyDetails.forEach(function(detail) {
        label2Data[detail.label].push(detail);
    });

    below_the_fold = below_the_fold || 0;
    var legendOrder = [];
    // below the fold
    for(var i = below_the_fold - 1; i >= 0; i--) {
        var label = valuelist[i];
        bars.addDataset(label, label2Data[label]);
        legendOrder.push(label);
    }
    // above the fold
    for(var i = below_the_fold; i < valuelist.length; i++) {
        var label = valuelist[i];
        bars.addDataset(label, label2Data[label]);
        legendOrder.unshift(label);
    }

    var legend = new Plottable.Component.Legend(colorScale);
    legend.sortFunction(function(a, b) {
        return legendOrder.indexOf(a) - legendOrder.indexOf(b);
    });
    legend.yAlign("center");

    bars.project("x", "start", xScale);
    bars.project("width", function(d) { return xScale.scale(d.end) - xScale.scale(d.start); });
    bars.project("y", function(d, i, u, p) {
        if (valuelist.indexOf(p.datasetKey) < below_the_fold) {
            return -d.total;
        } else {
            return d.total;
        }
    }, yScale);
    bars.project("fill", function(d, i, u, p) { return p.datasetKey; } , colorScale);

    var center = new Plottable.Component.Group([bars, legend]);

    var chart = new Plottable.Component.Table([
        [yAxis, bars , legend],
        [null,  xAxis, null  ]
    ]);

    chart.renderTo(svg);
}


function detailsForWeek(d, valuelist, accessor, below_the_fold) {
    var details = [];
    var detail_proto = {
        start: d.start,
        end: d.end
    };
    var matrix = d3.map();
    valuelist.forEach(function(label) {
        matrix.set(label, {total: 0});
    });
    d.bugs.forEach(function(bug) {
        matrix.get(accessor(bug)).total++;
    });
    var offset = 0;
    valuelist.forEach(function(label, i) {
        if (below_the_fold && i == below_the_fold) {
            // move the details up to here below the fold
            details.forEach(function(detail) {
               detail.offset -= offset;
            });
            offset = 0;
        }
        var total = matrix.get(label).total;
        if (!total) {
            // nothing to do, skip
            return;
        }
        var detail = Object.create(detail_proto);
        detail.total = total;
        detail.offset = offset;
        detail.label = label;
        offset += detail.total;
        details.push(detail);
    });
    return details;
}
