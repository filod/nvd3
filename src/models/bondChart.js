nv.models.scatterChart = function() {
  "use strict";
  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var scatter      = nv.models.scatter()
    , scatterX     = nv.models.scatter()
    , xAxis        = nv.models.axis()
    , yAxis        = nv.models.axis()
    , legend       = nv.models.legend()
    , controls     = nv.models.legend()
    , distX        = nv.models.distribution()
    , distY        = nv.models.distribution()
    ;

  var margin       = {top: 30, right: 20, bottom: 50, left: 75}
    , width        = null
    , height       = null
    , color        = nv.utils.defaultColor()
    , x            = d3.fisheye ? d3.fisheye.scale(d3.scale.linear).distortion(0) : scatter.xScale()
    , y            = d3.fisheye ? d3.fisheye.scale(d3.scale.linear).distortion(0) : scatter.yScale()
    , xPadding     = 0
    , yPadding     = 0
    , showDistX    = false
    , showDistY    = false
    , showLegend   = true
    , showXAxis    = true
    , showYAxis    = true
    , rightAlignYAxis = false
    , showControls = !!d3.fisheye
    , fisheye      = 0
    , brushHeight  = 30
    , pauseFisheye = false
    , tooltips     = true
    , tooltipX     = function(key, x, y) { return '<strong>' + x + '</strong>' }
    , tooltipY     = function(key, x, y) { return '<strong>' + y + '</strong>' }
    , tooltip      = function(key, x, y) { return '<h3>' + key + '</h3>' }
    , state = {}
    , defaultState = null
    , dispatch     = d3.dispatch('tooltipShow', 'tooltipHide', 'stateChange', 'changeState', 'brushend', 'canvasClick')
    , noData       = "No Data Available."
    , transitionDuration = 250
    ;

  scatter
    .xScale(x)
    .yScale(y)
    ;
  scatterX
    .xScale(x)
  xAxis
    .orient('bottom')
    .tickPadding(10)
    ;
  yAxis
    .orient((rightAlignYAxis) ? 'right' : 'left')
    .tickPadding(10)
    ;
  distX
    .axis('x')
    ;
  distY
    .axis('y')
    ;

  controls.updateState(false);

  //============================================================


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var x0, y0;

  var showTooltip = function(e, offsetElement) {
    //TODO: make tooltip style an option between single or dual on axes (maybe on all charts with axes?)

    var left = e.pos[0] + ( offsetElement.offsetLeft || 0 ),
        top = e.pos[1] + ( offsetElement.offsetTop || 0),
        leftX = e.pos[0] + ( offsetElement.offsetLeft || 0 ),
        topX = y.range()[0] + margin.top + ( offsetElement.offsetTop || 0),
        leftY = x.range()[0] + margin.left + ( offsetElement.offsetLeft || 0 ),
        topY = e.pos[1] + ( offsetElement.offsetTop || 0),
        xVal = xAxis.tickFormat()(scatter.x()(e.point, e.pointIndex)),
        yVal = yAxis.tickFormat()(scatter.y()(e.point, e.pointIndex));

      if( tooltipX != null )
          nv.tooltip.show([leftX, topX], tooltipX(e.series.key, xVal, yVal, e, chart), 'n', 1, offsetElement, 'x-nvtooltip');
      if( tooltipY != null )
          nv.tooltip.show([leftY, topY], tooltipY(e.series.key, xVal, yVal, e, chart), 'e', 1, offsetElement, 'y-nvtooltip');
      if( tooltip != null )
          nv.tooltip.show([left, top], tooltip(e.series.key, xVal, yVal, e, chart), e.value < 0 ? 'n' : 's', null, offsetElement);
  };

  var controlsData = [
    { key: 'Magnify', disabled: true }
  ];

  //============================================================


  function chart(selection) {
    selection.each(function(obj) {
      var data = obj.dots
      var lines = []//obj.lines TODO:
      var dLines =[]// obj.dLines
      var xDots = obj.xDots
      var container = d3.select(this),
          that = this;

      var availableWidth = (width  || parseInt(container.style('width')) || 960)
                             - margin.left - margin.right,
          availableHeight = (height || parseInt(container.style('height')) || 400)
                             - margin.top - margin.bottom - brushHeight;

      chart.update = function() { container.transition().duration(transitionDuration).call(chart); };
      chart.container = this;
      chart.updateScale = updateScale
      //set state.disabled
      state.disabled = data.map(function(d) { return !!d.disabled });

      if (!defaultState) {
        var key;
        defaultState = {};
        for (key in state) {
          if (state[key] instanceof Array)
            defaultState[key] = state[key].slice(0);
          else
            defaultState[key] = state[key];
        }
      }

      //------------------------------------------------------------
      // Display noData message if there's nothing to show.

      if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
        var noDataText = container.selectAll('.nv-noData').data([noData]);

        noDataText.enter().append('text')
          .attr('class', 'nvd3 nv-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + availableWidth / 2)
          .attr('y', margin.top + availableHeight / 2)
          .text(function(d) { return d });

        return chart;
      } else {
        container.selectAll('.nv-noData').remove();
      }

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Setup Scales

      x0 = x0 || x;
      y0 = y0 || y;

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap = container.selectAll('.nv-wrap.nv-scatterChart').data([data]);
      var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-scatterChart nv-chart-' + scatter.id());
      var gEnter = wrapEnter.append('g');
      var g = wrap.select('g');
      // background for pointer events
      // gEnter.append('rect').attr('class', 'nv-cross-line-canvas')
      //   .attr('width', availableWidth)
      //   .attr('height', availableHeight)
      gEnter.append('rect').attr('class', 'nvd3 nv-background');

      gEnter.append('g').attr('class', 'nv-x nv-axis');
      gEnter.append('g').attr('class', 'nv-y nv-axis');
      gEnter.append('svg')
        .attr('class', 'nv-main-area')
        .append('g').attr('class', 'nv-scatterWrap')
      gEnter.select('.nv-scatterWrap').append('g').attr('class', 'nv-lineWrap')
      gEnter.append('g').attr('class', 'nv-distWrap');
      gEnter.append('g').attr('class', 'nv-legendWrap');
      gEnter.append('g').attr('class', 'nv-controlsWrap');

      g.select('.nv-main-area')
        .attr('width', availableWidth)
        .attr('height', availableHeight)
      //------------------------------------------------------------
      // Legend

      if (showLegend) {
        var legendWidth = (showControls) ? availableWidth / 2 : availableWidth;
        legend.width(legendWidth);

        wrap.select('.nv-legendWrap')
            .datum(data)
            .call(legend);

        if ( margin.top != legend.height()) {
          margin.top = legend.height();
          availableHeight = (height || parseInt(container.style('height')) || 400)
                             - margin.top - margin.bottom;
        }

        wrap.select('.nv-legendWrap')
            .attr('transform', 'translate(' + (availableWidth - legendWidth) + ',' + (-margin.top) +')');
      }

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Controls

      if (showControls) {
        controls.width(180).color(['#444']);
        g.select('.nv-controlsWrap')
            .datum(controlsData)
            .attr('transform', 'translate(0,' + (-margin.top) +')')
            .call(controls);
      }

      //------------------------------------------------------------


      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      if (rightAlignYAxis) {
          g.select(".nv-y.nv-axis")
              .attr("transform", "translate(" + availableWidth + ",0)");
      }

      //------------------------------------------------------------
      // Main Chart Component(s)

      scatter
          .width(availableWidth)
          .height(availableHeight)
          .color(data.map(function(d,i) {
            return d.color || color(d, i);
          }).filter(function(d,i) { return !data[i].disabled }));

      if (xPadding !== 0)
        scatter.xDomain(null);

      if (yPadding !== 0)
        scatter.yDomain(null);

      wrap.select('.nv-scatterWrap')
       .datum(data.filter(function(d) { return !d.disabled }))
       .call(scatter);
      //Adjust for x and y padding
      if (xPadding !== 0) {
        var xRange = x.domain()[1] - x.domain()[0];
        scatter.xDomain([x.domain()[0] - (xPadding * xRange), x.domain()[1] + (xPadding * xRange)]);
      }

      if (yPadding !== 0) {
        var yRange = y.domain()[1] - y.domain()[0];
        scatter.yDomain([y.domain()[0] - (yPadding * yRange), y.domain()[1] + (yPadding * yRange)]);
      }

      if (yPadding !== 0 || xPadding !== 0) {
        wrap.select('.nv-scatterWrap')
          .datum(data.filter(function(d) { return !d.disabled }))
          .call(scatter);
      }

      //------------------------------------------------------------
      // Setup Axes
      if (showXAxis) {
        xAxis
            .scale(x)
            .ticks( xAxis.ticks() && xAxis.ticks().length ? xAxis.ticks() : availableWidth / 100 )
            .tickSize( -availableHeight , 0);

        g.select('.nv-x.nv-axis')
            .attr('transform', 'translate(0,' + y.range()[0] + ')')
            .call(xAxis);

      }

      if (showYAxis) {
        yAxis
            .scale(y)
            .ticks( yAxis.ticks() && yAxis.ticks().length ? yAxis.ticks() : availableHeight / 36 )
            .tickSize( -availableWidth, 0);

        g.select('.nv-y.nv-axis')
            .call(yAxis);
      }


      if (showDistX) {
        distX
            .getData(scatter.x())
            .scale(x)
            .width(availableWidth)
            .color(data.map(function(d,i) {
              return d.color || color(d, i);
            }).filter(function(d,i) { return !data[i].disabled }));
        gEnter.select('.nv-distWrap').append('g')
            // .attr('width', availableWidth)
            // .attr('height', availableHeight + 8)
            // .append('g')
            .attr('class', 'nv-distributionX')
        g.select('.nv-distributionX')
            .attr('transform', 'translate(0,' + y.range()[0] + ')')
            .datum(data.filter(function(d) { return !d.disabled }))
            .call(distX);
      }

      if (showDistY) {
        distY
            .getData(scatter.y())
            .scale(y)
            .width(availableHeight)
            .color(data.map(function(d,i) {
              return d.color || color(d, i);
            }).filter(function(d,i) { return !data[i].disabled }));
        gEnter.select('.nv-distWrap').append('g')
            // .attr('height', availableHeight)
            // .attr('width', availableWidth)
            // .append('g')
            .attr('class', 'nv-distributionY')
        g.select('.nv-distributionY')
            .attr('transform',
              'translate(' + (rightAlignYAxis ? availableWidth : -distY.size() ) + ',0)')
            .datum(data.filter(function(d) { return !d.disabled }))
            .call(distY);
      }

      //------------------------------------------------------------


      //------------------------------------------------------------
      // cross line
      // gEnter.select('.')
      //   .append('line')
      //   .attr('class', 'nv-cross-line nv-cross-line-X')
      //   .attr('x1', 0)
      //   .attr('x2', availableWidth)
      // gEnter.select('.')
      //   .append('line')
      //   .attr('class', 'nv-cross-line nv-cross-line-Y')
      //   .attr('y1', 0)
      //   .attr('y2', availableHeight)

      g.select('.nv-background')
        .attr('width', availableWidth)
        .attr('height', availableHeight)
        // .on('mousemove', function (d) {
        //   var mouse = d3.mouse(this)
        //   g.select('.nv-cross-line-X').attr('y1', mouse[1]).attr('y2', mouse[1]).attr('x1', 0).attr('x2', availableWidth)
        //   g.select('.nv-cross-line-Y').attr('x1', mouse[0]).attr('x2', mouse[0]).attr('y1', 0).attr('y2', availableHeight)
        // })
        // .on('mouseout', function (d) {
        //   g.select('.nv-cross-line-X').attr('y1', 0).attr('y2', 0).attr('x1', 0).attr('x2', 0)
        //   g.select('.nv-cross-line-Y').attr('y1', 0).attr('y2', 0).attr('x1', 0).attr('x2', 0)
        // })




      //------------------------------------------------------------
      // brush!
      var brushWrap = container.selectAll('.nv-burshWrap').data([xDots])
      var brushWrapEnter = brushWrap.enter().append('g').attr('class', 'nv-burshWrap')
      var brushEnter = brushWrapEnter.append('g')
      var gBrush = brushWrap.select('g')

      gEnter.append('g').attr('class', 'nv-scatterWrap')

      gBrush
        .attr('transform', 'translate(' + margin.left + ',' + (availableHeight + margin.top + brushHeight) +')')
      scatterX
          .width(availableWidth)
          .height(brushHeight)
          .color(xDots.map(function(d,i) {
            return d.color || color(d, i);
          }))
          .xDomain(x.domain())
          .x(scatter.x())
          // .y(function (d) {
          //   return availableHeight
          // })

      var brush = d3.svg.brush()
        .x(x)
        .on("brushend", brushed);
      brushEnter.append('g')
        .attr("class", "x brush")
        .call(brush)

      gBrush//.select('.nv-scatterWrap')
        .datum(xDots)
        .call(scatterX);
      gBrush.selectAll("rect")
        .attr("y", -10)
        .attr("height", brushHeight);
      function brushed () {
        dispatch.brushend('brushed', brush)
      }


      scatterX.dispatch.on('elementMouseover.tooltip', function(e) {
        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top];
        if (tooltips) showTooltip(e, that.parentNode);
      });

      scatterX.dispatch.on('elementMouseout.tooltip', function(e) {
        nv.tooltip.cleanup();
        // d3.select('.nv-chart-' + scatter.id() + ' .nv-series-' + e.seriesIndex + ' .nv-distx-' + e.pointIndex)
        //     .attr('y1', 0);
        // d3.select('.nv-chart-' + scatter.id() + ' .nv-series-' + e.seriesIndex + ' .nv-disty-' + e.pointIndex)
        //     .attr('x2', distY.size());
      });
      //------------------------------------------------------------
      // setup lines
      var getX = scatter.x(), getY = scatter.y()

      var linePaths = g.select('.nv-lineWrap').selectAll('path.nv-line-static')
        .data(lines.map(function (d) {
          return d.Dots
        }));
      var dLinePaths = g.select('.nv-lineWrap').selectAll('path.nv-line-dynamic')
        .data(dLines.map(function (d) {
          return d.Dots
        }))

      linePaths.enter().append('path')
          .attr('class', 'nv-line nv-line-static')
          .attr('d',
            d3.svg.line()
              .interpolate('linear')
              .x(function(d,i) { return x(getX(d,i)) })
              .y(function(d,i) { return y(getY(d,i)) })
          );
      linePaths.exit().selectAll('path.nv-line-static')
          .remove()
      linePaths
          .transition()
          .attr('d',
            d3.svg.line()
              .interpolate('linear')
              .x(function(d,i) { return x(getX(d,i)) })
              .y(function(d,i) { return y(getY(d,i)) })
          );

      dLinePaths.enter().append('path')
          .attr('class', 'nv-line nv-line-dynamic')
          .attr('d',
            d3.svg.line()
              .interpolate('linear')
              .x(function(d,i) { return x(getX(d,i)) })
              .y(function(d,i) { return y(getY(d,i)) })
          );
      dLinePaths.exit().selectAll('path.nv-line-dynamic')
          .remove()
      dLinePaths
          .transition()
          .attr('d',
            d3.svg.line()
              .interpolate('linear')
              .x(function(d,i) { return x(getX(d,i)) })
              .y(function(d,i) { return y(getY(d,i)) })
          );

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      controls.dispatch.on('legendClick', function(d,i) {
        d.disabled = !d.disabled;

        fisheye = d.disabled ? 0 : 2.5;
        g.select('.nv-background') .style('pointer-events', d.disabled ? 'none' : 'all');
        g.select('.nv-point-paths').style('pointer-events', d.disabled ? 'all' : 'none' );

        if (d.disabled) {
          x.distortion(fisheye).focus(0);
          y.distortion(fisheye).focus(0);

          g.select('.nv-scatterWrap').call(scatter);
          g.select('.nv-x.nv-axis').call(xAxis);
          g.select('.nv-y.nv-axis').call(yAxis);
        } else {
          pauseFisheye = false;
        }

        chart.update();
      });

      legend.dispatch.on('stateChange', function(newState) {
        state.disabled = newState.disabled;
        dispatch.stateChange(state);
        chart.update();
      });

      //========================
      // zoom behevior
      //========================
      var redraw = _.debounce(function () {
        // restore scale
        g.select('.nv-scatterWrap')
          .attr('visibility', 'hidden')
          .attr("transform",
            "translate(0,0)"
            + " scale(1)")
        var realScale = zoomer.realScale
        var duration = 0
        g.selectAll('circle.nv-point')
          .transition().duration(duration)
          .attr('cx', function(d,i) { return x(scatter.x()(d,i)) })
          .attr('cy', function(d,i) { return y(scatter.y()(d,i)) })
        gBrush.selectAll('circle.nv-point')
          .transition().duration(duration)
          .attr('cx', function(d,i) { return x(scatter.x()(d,i)) })
        g.selectAll('text.nv-point-text')
          .transition().duration(duration)
          .attr('x', function(d,i) { return x(scatter.x()(d,i)) - 20 })
          .attr('y', function(d,i) { return y(scatter.y()(d,i)) - 10 })
          .style('opacity', function () { return realScale > 2 ? 1 : 0 })
        gBrush.selectAll('text.nv-point-text')
          .transition().duration(duration)
          .attr('x', function(d,i) { return x(scatter.x()(d,i)) - 20 })
          .style('opacity', function () { return realScale > 2 ? 1 : 0 })
        g.select('.nv-distributionX')
          .attr('transform', 'translate(0,' + y.range()[0] + ')')
          .datum(data.filter(function(d) { return !d.disabled }))
          .call(distX);
        g.select('.nv-distributionY')
          .attr('transform', 'translate(-' + distY.size() + ',0)')
          .datum(data.filter(function(d) { return !d.disabled }))
          .call(distY);

        g.select('.nv-lineWrap').selectAll('path.nv-line')
          .attr('d',
            d3.svg.line()
              .x(function(d,i) { return x(getX(d,i)) })
              .y(function(d,i) { return y(getY(d,i)) }))

        g.select('.nv-scatterWrap')
          .attr('visibility', 'visible')
        zoomer.x(x).y(y)
      }, 500)

      function updateScale (duration) {
        var realScale = zoomer.realScale = zoomer.baseDomain  / (x.domain()[1] -  x.domain()[0])
        zoomer.realTranslate = [ zoomer.realTranslate[0] + d3.event.translate[0], zoomer.realTranslate[1] + d3.event.translate[1]]
        duration = duration || 0
        if (d3.event && d3.event.translate && d3.event.scale) {
          var w = scatter.width()
          var h = scatter.height()
          var t = d3.event.translate
          var s = realScale
          t[0] = Math.min(100 * s, Math.max(w * (1 - s) - 100 * s, t[0]))
          t[1] = Math.min(100 * s, Math.max(h * (1 - s) - 100 * s, t[1]))
          zoomer.translate(t);
          g.select('.nv-scatterWrap').attr("transform",
              "translate("+d3.event.translate+")" +
              " scale("+d3.event.scale+")");
        }
        if (!g) return

        g.select('.nv-x.nv-axis')
          .attr('transform', 'translate(0,' + y.range()[0] + ')')
          .call(chart.xAxis);
        g.select('.nv-y.nv-axis')
          .call(chart.yAxis);

        redraw()


        // scatter.updateInteractiveLayer()
      }
      var zoomer = d3.behavior.zoom()
      zoomer.baseDomain = x.domain()[1] - x.domain()[0]
      zoomer.realTranslate = [0, 0]
      zoomer.x(x).y(y)
        // .scaleExtent([1, 12]).on('zoom', _.throttle(updateScale, 100, { trailing: false }))
        .scaleExtent([0, 4])
        // .on('zoomstart', function () {
        //   console.log('zoomstart')
        // })
        .on('zoom', updateScale)
        // .on('zoomend', function (argument) {
        //   console.log('zoomend')
        // })
      wrap.call(zoomer)
      /*
      legend.dispatch.on('legendMouseover', function(d, i) {
        d.hover = true;
        chart(selection);
      });

      legend.dispatch.on('legendMouseout', function(d, i) {
        d.hover = false;
        chart(selection);
      });
      */

      g.select('.nv-background').on('click', function (d) {
        dispatch.canvasClick()
      })
      scatter.dispatch.on('elementMouseover.tooltip', function(e) {
        d3.select('.nv-chart-' + scatter.id() + ' .nv-series-' + e.seriesIndex + ' .nv-distx-' + e.pointIndex)
            .attr('y1', function(d,i) { return e.pos[1] - availableHeight;});
        d3.select('.nv-chart-' + scatter.id() + ' .nv-series-' + e.seriesIndex + ' .nv-disty-' + e.pointIndex)
            .attr('x2', e.pos[0] + distX.size());

        e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top];
        dispatch.tooltipShow(e);
      });

      dispatch.on('tooltipShow', function(e) {
        if (tooltips) showTooltip(e, that.parentNode);
      });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(e) {

        if (typeof e.disabled !== 'undefined') {
          data.forEach(function(series,i) {
            series.disabled = e.disabled[i];
          });

          state.disabled = e.disabled;
        }

        chart.update();
      });

      //============================================================


      //store old scales for use in transitions on update
      x0 = x.copy();
      y0 = y.copy();
      chart.resetZoom = function (duration) {
        zoomer.scale(1)
        zoomer.translate([0, 0])
        updateScale(duration)
      }

    });

    return chart;
  }


  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  scatter.dispatch.on('elementMouseout.tooltip', function(e) {
    dispatch.tooltipHide(e);

    d3.select('.nv-chart-' + scatter.id() + ' .nv-series-' + e.seriesIndex + ' .nv-distx-' + e.pointIndex)
        .attr('y1', 0);
    d3.select('.nv-chart-' + scatter.id() + ' .nv-series-' + e.seriesIndex + ' .nv-disty-' + e.pointIndex)
        .attr('x2', distY.size());
  });

  dispatch.on('tooltipHide', function(e) {
    if (tooltips) {
      nv.tooltip.cleanup();
    }
  });

  //============================================================


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.scatter = scatter;
  chart.scatterX = scatterX;
  chart.legend = legend;
  chart.controls = controls;
  chart.xAxis = xAxis;
  chart.yAxis = yAxis;
  chart.distX = distX;
  chart.distY = distY;

  d3.rebind(chart, scatter, 'id', 'interactive', 'pointActive', 'x', 'y', 'shape', 'size', 'text', 'xScale', 'yScale', 'zScale', 'xDomain', 'yDomain', 'xRange', 'yRange', 'sizeDomain', 'sizeRange', 'forceX', 'forceY', 'forceSize', 'clipVoronoi', 'clipRadius', 'useVoronoi');


  chart.options = nv.utils.optionsFunc.bind(chart);

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = nv.utils.getColor(_);
    legend.color(color);
    distX.color(color);
    distY.color(color);
    return chart;
  };

  chart.showDistX = function(_) {
    if (!arguments.length) return showDistX;
    showDistX = _;
    return chart;
  };

  chart.showDistY = function(_) {
    if (!arguments.length) return showDistY;
    showDistY = _;
    return chart;
  };

  chart.showControls = function(_) {
    if (!arguments.length) return showControls;
    showControls = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) return showLegend;
    showLegend = _;
    return chart;
  };

  chart.showXAxis = function(_) {
    if (!arguments.length) return showXAxis;
    showXAxis = _;
    return chart;
  };

  chart.showYAxis = function(_) {
    if (!arguments.length) return showYAxis;
    showYAxis = _;
    return chart;
  };

  chart.rightAlignYAxis = function(_) {
    if(!arguments.length) return rightAlignYAxis;
    rightAlignYAxis = _;
    yAxis.orient( (_) ? 'right' : 'left');
    return chart;
  };


  chart.fisheye = function(_) {
    if (!arguments.length) return fisheye;
    fisheye = _;
    return chart;
  };

  chart.xPadding = function(_) {
    if (!arguments.length) return xPadding;
    xPadding = _;
    return chart;
  };

  chart.yPadding = function(_) {
    if (!arguments.length) return yPadding;
    yPadding = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) return tooltips;
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) return tooltip;
    tooltip = _;
    return chart;
  };

  chart.tooltipXContent = function(_) {
    if (!arguments.length) return tooltipX;
    tooltipX = _;
    return chart;
  };

  chart.tooltipYContent = function(_) {
    if (!arguments.length) return tooltipY;
    tooltipY = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) return state;
    state = _;
    return chart;
  };

  chart.defaultState = function(_) {
    if (!arguments.length) return defaultState;
    defaultState = _;
    return chart;
  };

  chart.noData = function(_) {
    if (!arguments.length) return noData;
    noData = _;
    return chart;
  };

  chart.transitionDuration = function(_) {
    if (!arguments.length) return transitionDuration;
    transitionDuration = _;
    return chart;
  };

  //============================================================


  return chart;
}
