/* webshark-tap-flow.js
 *
 * Copyright (C) 2016 Jakub Zawadzki
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

function webshark_d3_sequence_diagram(svg, nodes, flows)
{
	svg.append("marker")
         .attr("id", "arr")
         .attr("markerWidth", "10")
         .attr("markerHeight", "10")
         .attr("refX", "6")
         .attr("refY", "3")
         .attr("orient", "auto")
         .attr("markerUnits", "strokeWidth")
         .append("path")
           .attr("d", "M0,0 L0,6 L9,3 z");

	var g = svg.append("g")
         .attr("transform", "translate(10, 10)");

	var color = null;
	if (nodes.length < 10)
		color = d3.schemeCategory10;
	else if (nodes.length < 20)
		color = d3.schemeCategory20;

	for (var i = 0; i < flows.length; i++)
	{
		var posY = 30 + i * 50;

		var nn = flows[i]['n'];

		/* timestamp */
		g.append("text")
		  .attr("class", "seq_ts")
		  .attr("x", 5)
		  .attr("y", posY + 43)
		  .text(flows[i]['t']);

		/* text */
		g.append("text")
		  .attr("class", "seq_label")
		  .attr("x", 500)
		  .attr("y", posY + 43)
		  .text(flows[i]['c']);

		/* line */
		g.append("line")
		  .attr("class", "seq_line")
		  .attr("x1", 100 + nn[0] * 300)
		  .attr("y1", posY + 50)
		  .attr("x2", 100 + nn[1] * 300)
		  .attr("y2", posY + 50)
		  .attr("marker-end", 'url(#arr)')
		  .attr("stroke", (color != null) ? color[nn[0]] : 'black');
	}

	for (var i = 0; i < nodes.length; i++)
	{
		var posX = 100 + 300 * i;
		var endY = 30 + flows.length * 50;

		/* host */
		g.append("text")
		  .attr("class", "seq_host")
		  .attr("x", posX)
		  .attr("y", 10)
		  .text(nodes[i]);

		/* vertical lines */
		g.append("line")
		  .attr("class", "seq_node_line")
		  .attr("x1", posX)
		  .attr("y1", 20)
		  .attr("x2", posX)
		  .attr("y2", endY)
		  .attr("stroke", '#ccc');
	}

	svg.attr("width", Math.max(1000, 120 + (nodes.length) * 300))
		.attr("height", 50 + (flows.length) * 50);

}

function tap_flow_report(tap)
{
	var nodes = tap['nodes'];
	var flows = tap['flows'];

	var svg = d3.select("body").append("svg").remove()
			.attr("style", 'border: 1px solid black;');

	webshark_d3_sequence_diagram(svg, nodes, flows);

	document.getElementById('ws_tap_graph').appendChild(svg.node());
}

exports.tap_report = tap_flow_report;
