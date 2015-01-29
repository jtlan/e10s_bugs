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
    makeBugChart(trackingvals, function(bug) {
        return bug.cf_tracking_e10s||'---';
    });
    makeBugChart(RESOLUTIONS, function(bug) {
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

function makeBugChart(valuelist, accessor, below_the_fold) {
    weeklyDetails = [];
    bugsOfTheWeek.forEach(function(d) {
        weeklyDetails = weeklyDetails.concat(detailsForWeek(d, valuelist, accessor,  below_the_fold));
    });
    
var margin = {top: 20, right: 20, bottom: 30, left: 40},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var x = d3.time.scale()
    .range([0, width])
    .domain([
        d3.time.week.floor(bugsOfTheWeek[0].bugs[0].creation_time),
        d3.time.week.ceil(bugsOfTheWeek[bugsOfTheWeek.length-1].bugs[0].creation_time)
    ])
    .nice();
var y = d3.scale.linear()
    .range([height, 0])
    .domain([d3.min(weeklyDetails, function(d) {return d.offset}),
            d3.max(weeklyDetails, function(d) {return d.total + d.offset})]);
var color = d3.scale.category20();
valuelist.forEach(function(label) {
    color(label);
});

var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");
var container = d3.select('body').append("div").attr("class", "bugChart");
var svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis);

  var barwidth = x(bugsOfTheWeek[0].end) - x(bugsOfTheWeek[0].start);
  svg.selectAll(".bar")
      .data(weeklyDetails)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) {
          return x(d.start);
      })
      .attr("width", barwidth)
      .attr("y", function(d) {
          return y(d.total + d.offset);
      })
      .attr("height", function(d) {
          return y(d.offset) - y(d.total + d.offset);
      })
      .style("fill", function(d) { return color(d.label); });

var box = 25;
svg = container.append("div").attr("class", "bugLegend").append("svg");
x = d3.scale.ordinal()
    .rangeRoundBands([0, box*valuelist.length], 0.1);
x.domain(valuelist.concat([]).reverse());
svg.attr("height", x.rangeExtent()[1]);
svg.attr("width", 150);
xAxis = d3.svg.axis()
    .scale(x)
    .orient("right");
svg.selectAll(".block")
    .data(valuelist)
        .enter().append("rect")
        .attr("class", "block")
        .attr("width", box). attr("height", box)
        .attr("y", function(d) {
            return x(d);
        })
        .attr("title", function(d) {return d;})
        .attr("x", 0)
        .attr("fill", function(d) {return color(d)});
  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(" + box + ", 0)")
      .call(xAxis);
}
