/* webshark-iograph.js
 *
 * Copyright (C) 2018 Jakub Zawadzki
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

var m_webshark_display_filter_module = require('./webshark-display-filter.js');

var m_style_names =
	{
		"line": "Line",
//		"impulse": "Impulse",
		"bar": "Bar",
//		"sbar": "Stacked Bar",
		"dot": "Dot",
//		"square": "Square",
//		"diamond": "Diamond"
	};

var m_function_names =
	{
		"packets": "Packets",
		"bytes": "Bytes",
		"bits": "Bits",
		"sum:<field>": "SUM(Y Field)",
		"frames:<field>": "COUNT FRAMES(Y Field)",
		"fields:<field>": "COUNT FIELDS(Y Field)",
		"max:<field>": "MAX(Y Field)",
		"min:<field>": "MIN(Y Field)",
		"avg:<field>": "AVG(Y Field)",
		"load:<field>": "LOAD(Y Field)"
	};

function WSIOGraph(opts)
{
	this.elem = document.getElementById(opts['contentId']);
	this.table = document.getElementById(opts['tableId']);

	this.colors = d3.schemeCategory10;

	this.graphs = [ ];
}

WSIOGraph.prototype.addGraph = function()
{
	var idx = this.graphs.length;
	var graph = { };

	var tr = document.createElement("tr");

	// Name
	{
		var td = document.createElement("td");
		td.appendChild(document.createTextNode("Graph #" + idx));
		tr.appendChild(td);
	}

	// Filter
	{
		var td = document.createElement("td");
		var input = document.createElement("input");

		input.type = 'text';
		input.style.width = '550px';

		td.appendChild(input);
		tr.appendChild(td);

		graph['filter'] = input;
		graph['filterC'] = new m_webshark_display_filter_module.WSDisplayFilter({
			contentObj: input
		});
	}

	// Color
	{
		var td = document.createElement("td");
		var div = document.createElement("div");

		div.style.width = "30px";
		div.style.height = "30px";
		div.style['background-color'] = this.colors[idx];

		td.appendChild(div);
		tr.appendChild(td);
	}

	// Style
	{
		var td = document.createElement("td");
		var select = document.createElement("select");

		for (var name in m_style_names)
		{
			var option = document.createElement("option");

			option.value = name;
			option.appendChild(document.createTextNode(m_style_names[name]));
			select.appendChild(option);
		}

		td.appendChild(select);
		tr.appendChild(td);

		graph['style'] = select;
	}

	// Function
	{
		var td = document.createElement("td");
		var select = document.createElement("select");

		for (var name in m_function_names)
		{
			var option = document.createElement("option");

			option.value = name;
			option.appendChild(document.createTextNode(m_function_names[name]));
			select.appendChild(option);
		}

		td.appendChild(select);
		tr.appendChild(td);

		graph['function'] = select;
	}

	// Field
	{
		var td = document.createElement("td");
		var input = document.createElement("input");

		input.type = 'text';
		input.style.width = '350px';

		td.appendChild(input);
		tr.appendChild(td);

		graph['field'] = input;
		graph['fieldC'] = new m_webshark_display_filter_module.WSDisplayFilter({
			contentObj: input,
			singleField: true
		});
	}

	this.table.appendChild(tr);

	this.graphs.push(graph);
};

WSIOGraph.prototype.renderGraph = function()
{
	var graph_names = { };
	var graph_types = { };
	var graph_colors = { };

	for (var i = 0; i < this.graph_data.length; i++)
	{
		var graph_type;

		if (this.graph_style[i] == "dot")
			graph_type = 'scatter';
		else if (this.graph_style[i] == "line")
			graph_type = 'line';
		else if (this.graph_style[i] == "bar")
			graph_type = 'bar';
		else
			alert("internal error, style: " + this.graph_style[i]);

		graph_names[ 'graph' + i ] = "Graph #" + i;
		graph_types[ 'graph' + i ] = graph_type;
		graph_colors[ 'graph' + i ] = this.colors[i];
	}

	this.c3_chart = c3.generate({
		bindto: this.elem,
		size: { height: 300 },

		axis: {
			x: {
				label: {
					text: 'Time (s)',
					position: 'outer-center'
				},
				tick: {
					fit: false
				}
			}
		},

		data: {
			columns: this.graph_data,
			names: graph_names,
			types: graph_types,
			colors: graph_colors
		}
	});
};

WSIOGraph.prototype.setItems = function(graph, data)
{
	data.unshift('graph' + graph);

	this.graph_data[graph] = data;
};

WSIOGraph.prototype.setItemsSparse = function(graph, data)
{
	var real_i = 0;

	var real = [ ];

	for (var i = 0; i < data.length; i++)
	{
		if (typeof(data[i]) == "string")
		{
			var next_i = parseInt(data[i], 16);

			/* assert(real_i < next_i); */

			while (real_i < next_i)
			{
				real[real_i] = 0.0;
				real_i++;
			}
		}
		else
		{
			real[real_i] = data[i];
			real_i++;
		}
	}

	this.setItems(graph, real);
};

WSIOGraph.prototype.update = function()
{
	var graph_req =
		{
			req: 'iograph',
			capture: g_webshark_file
		};

	// graph_req['interval'] = 1;

	for (var i = 0; i < this.graphs.length; i++)
	{
		var graph = this.graphs[i];

		var func = graph['function'].value;
		var field = graph['field'].value;
		var filter = graph['filter'].value;

		var full_filter = null;

		if (filter.length > 0 && field.length > 0)
			full_filter = "(" + filter + ") && (" + field + ")";
		else if (filter.length > 0)
			full_filter = filter;
		else if (field.length > 0)
			full_filter = field;

		if (full_filter)
			graph_req['filter' + i] = full_filter;
		graph_req['graph' + i] = func.replace("<field>", field);
	}

	var that = this;

	window.webshark.webshark_json_get(graph_req,
		function(data)
		{
			var iograph = data['iograph'];

			that.graph_data = [ ];
			that.graph_style = [ ];

			for (var i = 0; i < iograph.length; i++)
			{
				var graph = iograph[i];

				if (graph['errmsg'])
				{
					alert(graph['errmsg']);
					continue;
				}

				that.graph_style[i] = that.graphs[i]['style'].value;
				that.setItemsSparse(i, graph['items']);
			}

			that.renderGraph();
		});
};

exports.WSIOGraph = WSIOGraph;
