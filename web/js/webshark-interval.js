/* webshark-interval.js
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

function WSInterval(opts)
{
	this.mode = opts['mode'];
	this.interval_count = opts['width'];

	this.elem = document.getElementById(opts['contentId']);
	this.descr_elem = document.getElementById(opts['descrId']);

	this.interval = null;
	this.interval_filter = null;
	this.scale = 1;
}

WSInterval.prototype.setDuration = function(duration)
{
	var scale;

	scale = Math.round(duration / this.interval_count);
	if (scale < 1)
		scale = 1;

	this.scale = scale;
};

WSInterval.prototype.setResult = function(filter, data)
{
	if (filter)
	{
		this.interval_filter = data;
	}
	else
	{
		this.interval = data;
		this.interval_filter = null; /* render only main */
	}

	this.render_interval();
};

WSInterval.prototype.getScale = function()
{
	return this.scale;
};

WSInterval.prototype.render_interval = function()
{
	var intervals_data   = this.interval ? this.interval['intervals'] : null;
	var intervals_filter = this.interval_filter ? this.interval_filter['intervals'] : null;
	var intervals_full = [ ];

	var last_one  = this.interval ? this.interval['last'] : this.interval_filter['last'];
	var color_dict = { whole: 'steelblue' };
	var max_value_hack = 10; /* XXX, workaround, to not display mili's */

	var count_idx =
		(this.mode == "bps") ? 2 :
		(this.mode == "fps") ? 1 :
		-1;

	if (count_idx == -1)
		return;

	for (var i = 0; i <= last_one; i++)
		intervals_full[i] = [ (i * this.scale), 0, 0 ];

	if (intervals_data)
	{
		for (var i = 0; i < intervals_data.length; i++)
		{
			var idx = intervals_data[i][0];
			intervals_full[idx][1] += intervals_data[i][count_idx];
			if (intervals_full[idx][1] > 10) max_value_hack = undefined;
		}
	}

	if (intervals_filter)
	{
		for (var i = 0; i < intervals_filter.length; i++)
		{
			var idx = intervals_filter[i][0];
			intervals_full[idx][2] += intervals_filter[i][count_idx];
			if (intervals_full[idx][2] > 10) max_value_hack = undefined;
		}
	}


	if (intervals_filter)
	{
		/* grey out 'main interval', highlight 'filtered interval' */
		color_dict['whole'] = '#ddd';
		color_dict['filtered'] = 'steelblue';

		intervals_full.unshift( [ 'x', 'whole', 'filtered' ] );
	}
	else
	{
		intervals_full.unshift( [ 'x', 'whole' ] );
	}

	/* TODO, put mark of current packet (m_webshark_current_frame) */

	var chart = c3.generate({
		bindto: this.elem,
		size: { width: 620, height: 100 },
		legend: { position: 'inset', hide: true },

		axis: {
			x: {
				tick: {
					fit: false
				}
			},
			y: {
				max: max_value_hack,
				tick: {
					format: d3.format(".0s")
				}
			}
		},

		data: {
			x: 'x',
			rows: intervals_full,
			colors: color_dict,
			type: 'area-spline'
		},

		interaction: {
			enabled: false
		}
	});

	this.descr_elem.innerHTML = this.create_description();
};

WSInterval.prototype.create_description = function()
{
	var descr = "";

	if (this.interval_filter && this.interval)
	{
		var perc100 = Math.floor(100 * (this.interval_filter['frames'] / this.interval['frames']) * 100);

		descr = 'Displaying ' + this.interval_filter['frames'] + ' out of ' + this.interval['frames'] + ' frames (' + (perc100 / 100) + '%)';
	}
	else if (this.interval)
	{
		descr = 'Displaying all ' + this.interval['frames'] + ' frames';
	}
	else if (this.interval_filter)
	{
		descr = 'Displaying filtered ' + this.interval_filter['frames'] + ' frames';
	}

	return descr;
};

exports.WSInterval = WSInterval;
