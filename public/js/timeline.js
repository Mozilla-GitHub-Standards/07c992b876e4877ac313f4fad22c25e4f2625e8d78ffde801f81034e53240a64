(function(exports) {
  'use strict';

  function TimelineChart(opts) {
    this.options = opts;
  };
  TimelineChart.prototype = {};

  function drawYAxis(ctx, allSeries, opts) {
    var labelWidth = 0;
    allSeries.forEach(function(series, i) {
      ctx.fillStyle = '#000';
      var width = ctx.measureText(series.label).width;
      if (width > labelWidth) {
        labelWidth = width;
      }
      ctx.fillText(series.label, opts.xOffset, i*opts.rowHeight+25+5);
    });
    opts.xOffset = opts.xOffset + labelWidth + opts.xOffset;
    opts.innerWidth = opts.width - opts.xOffset - 10;
    console.log('drawYAxis: labelWidth: ' + labelWidth, 'xOffset: ' + opts.xOffset, 'innerWidth: ' + opts.innerWidth);

    allSeries.forEach(function(series, i) {
      // draw the center line
      var rowOffset = i * opts.rowHeight;
      if (series.uniqType.endsWith('B')) {
        ctx.fillStyle = '#eee';
        ctx.fillRect(opts.xOffset, rowOffset, opts.width-(opts.xOffset + 10), opts.rowHeight);
      }
      ctx.fillStyle = '#aaa';
      ctx.fillRect(opts.xOffset, rowOffset+25, opts.width-(opts.xOffset + 10), 1);
    });
  }
  TimelineChart.prototype.drawYAxis = drawYAxis;

  function drawXAxisRow(ctx, allSeries, opts) {
    // full range is from start of first day to end of the last day
    var startDateMs = opts.startDate.getTime();
    var endDateMs = opts.endDate.getTime();
    console.log('startDate: '+ opts.startDate.toLocaleString(),
                'endDate: ' + opts.endDate.toLocaleString());
    var totalMs = startDateMs - endDateMs;

    var series = [];
    var d;
    console.log('drawXAxisRow, opts.xOffset: ', opts.xOffset);
    for(var i = startDateMs; i<=endDateMs; i+=util.DAY_MS) {
      d = new Date(i);
      series.push([util.getDateKey(d), d]);
    }
    series.forEach(function(entry) {
      var x = util.getPositionForDate(entry[1], opts.startDate, opts.endDate, opts.innerWidth);
      // console.log('draw x label: ', entry[0], x, 10);
      // grid lines
      var hourDate = util.startOfDay(entry[1]);
      var tickX;
      var origFont = ctx.font;
      ctx.font = "10px sans-serif";
      for(var i=0; i<24; i++) {
        hourDate.setHours(i);
        tickX = util.getPositionForDate(hourDate, opts.startDate, opts.endDate, opts.innerWidth);
        if (i % 4 === 0) {
          ctx.fillStyle = '#999';
          ctx.fillText(i, opts.xOffset+tickX-3, allSeries.length*opts.rowHeight);
        }
        ctx.fillStyle = i % 12 === 0 ? '#999' : '#ccc';
        ctx.fillRect(opts.xOffset+tickX, 10, 1, allSeries.length*opts.rowHeight-20);
      }
      ctx.font = origFont
      // date label
      ctx.fillStyle = opts.seriesStyle.fillStyle;
      ctx.fillText(entry[0], opts.xOffset+x-10, opts.rowOffset+25-10);
    });
    console.log('/drawXAxisRow');
  }
  TimelineChart.prototype.drawXAxisRow = drawXAxisRow;

  function drawDot(ctx, opts) {
    ctx.beginPath();
    ctx.arc(opts.x, opts.y, opts.size/2, 0, 2 * Math.PI, false);
    if (opts.outline) {
      ctx.stroke();
    } else {
      ctx.fillStyle = opts.fillStyle;
      ctx.fill();
    }
  }
  TimelineChart.prototype.drawDot = drawDot;

  function scaleDotSize(value, min, max) {
    if (isNaN(value) || value < min) {
      value = min
    }
    var clampedValue = Math.max(Math.min(value, max), min);
    clampedValue = clampedValue - min*0.75;
    var scaledValue = 4 * Math.pow(clampedValue, 1/3);
    return scaledValue;
  }

  function drawChart(container, allSeries) {
    var opts = this.options;
    this.allSeries = allSeries;
    var canvas = this.canvasNode = document.createElement('canvas');
    var numDays = Math.ceil((opts.endDate.getTime() - opts.startDate.getTime())/util.DAY_MS);
    canvas.width = opts.width = numDays * 24 * opts.xScale;
    console.log('drawChart, numDays: '+ numDays, 'width: ' + canvas.width);
    canvas.height = opts.height;
    container.appendChild(canvas);

    var ctx = this.ctx = canvas.getContext('2d');

    var secondSize = (function() {
      var end = opts.endDate;
      var moment = new Date(end.getTime() - 1000);
      console.log('secondSize, endDate: ' + end.toLocaleString());
      console.log('secondSize, moment: ' + moment.toLocaleString());
      var x = util.getPositionForDate(moment, opts.startDate, opts.endDate, opts.width);
      var maxX = util.getPositionForDate(end, opts.startDate, opts.endDate, opts.width);
      console.log('secondSize, x: ' + x, 'maxX: ' + maxX);
      return maxX - x;
    })()
    opts.secondSize = secondSize;
    console.log('secondSize: ', secondSize);

    this.drawYAxis(ctx, allSeries, opts);

    var xAxisOptions = util.mixin(Object.create(opts), {
      seriesStyle: opts.axisStyle,
      rowOffset: allSeries.length*opts.rowHeight
    });
    this.drawXAxisRow(ctx, allSeries, xAxisOptions);

    allSeries.forEach(function(series, i) {
      var rowOptions = Object.create(opts);
      rowOptions.rowOffset = i*opts.rowHeight;
      rowOptions.seriesStyle = rowOptions.seriesStyles[i];
      // console.log('drawEntries with rowOffset: ' + rowOptions.rowOffset, typeof rowOptions.rowOffset);
      this.drawEntries(ctx, series.data, rowOptions);
    }, this);
  }
  TimelineChart.prototype.draw = drawChart;

  function drawEntries(ctx, series, opts) {
    ctx.fillStyle = opts.seriesStyle.fillStyle;
    this.chartOpts = opts;
    series.forEach((row, i) => {
      var entry = row[2];
      var duration = row[1];
      var x = util.getPositionForDate(row[0], opts.startDate, opts.endDate, opts.innerWidth);
      var rawSize = isNaN(duration) ? 1 : duration;
      var size = scaleDotSize(rawSize, 15, 60*15);
      var type = entry.type;
      var isMissedCall;
      if ((type === 'incomingCall' && duration === 0) ||
          (type === 'outgoingCall' && duration <= opts.missedCallThreshold)) {
         isMissedCall = true;
      }
      // console.log('drawDot at size: ', rawSize, size, size*dotScale, row);
      // console.log('drawDot for data: ', row[0], opts.startDate, x+opts.xOffset, 'y: ' + (opts.rowOffset+25));
      drawDot(ctx, {
        x: opts.xOffset + x,
        y: opts.rowOffset+25,
        fillStyle: opts.seriesStyle.fillStyle,
        size: size,
        outline: isMissedCall
      });
    });
  }
  TimelineChart.prototype.drawEntries = drawEntries;

  var Timeline = exports.Timeline = {
    create: function(opts) {
      var chart = new TimelineChart(opts);
      return chart;
    }
  };
})(window);