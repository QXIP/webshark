/* webshark-filter.js
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

var m_webshark_awesomplete_module = require('./webshark-awesomplete.js');

var m_field_complete_cache = { };

function input_extractor(filter)
{
	var txt = filter.value;

	var pos_end = filter.selectionStart;
	var pos_start = pos_end;

	while (pos_start > 0)
	{
		var ch = txt.charAt(--pos_start);

		var ch_field = ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || (ch == '.') || (ch == '_') || (ch == '-'));

		if (!ch_field)
		{
			pos_start++;
			break;
		}
	}

	var result =
	[
		/* current text, before current, after current */
		txt.slice(pos_start, pos_end),
		txt.slice(0, pos_start),
		txt.slice(pos_end)
	];

	return result;
}

function complete_field_cache(field, fun)
{
	var field_with_dot = (field.indexOf('.') != -1);

	var str = field;

	if (field_with_dot)
	{
		while (str.indexOf('.') != -1)
		{
			var data = m_field_complete_cache[str];
			if (data)
				return fun(data);

			str = str.slice(0, str.length - 1);
		}
	}
	else
	{
		while (str.length > 0)
		{
			var data = m_field_complete_cache[str];
			if (data)
				return fun(data);

			str = str.slice(0, str.length - 1);
		}
	}

	window.webshark.webshark_json_get(
		{
			req: 'complete',
			field: field
		},
		function(data)
		{
			data = data['field'];
			if (data == undefined)
				return;

			data.sort(function(a, b) { return a['f'] < b['f'] ? -1 : 1; });

			m_field_complete_cache[field] = data;

			fun(data);
		});
}

function WSDisplayFilter(opts)
{
	var that = this;

	this.elem = opts['contentObj'];
	if (!this.elem)
		this.elem = document.getElementById(opts['contentId']);

	this.mode = 'filter';
	if (opts['singleField'] == true)
		this.mode = 'field';

	this.complete = new m_webshark_awesomplete_module(this.elem,
		{
			filter: m_webshark_awesomplete_module.FILTER_STARTSWITH,
			getvalue: function(f) { return input_extractor(f)[0]; },
			maxItems: 0,
			maxHeight: '250px',

			replace: function (text)
			{
				that.setFilter(text.value);
			},

			item: function (text, input)
			{
				var html = input === '' ?
					text :
					text.replace(RegExp("^" + m_webshark_awesomplete_module.$.regExpEscape(input.trim()), "gi"), "<mark>$&</mark>");

				if (text['descr'])
					html += "<span style='float: right; font-size: 12px;'>" + text['descr'] + "</span>";

				return m_webshark_awesomplete_module.$.create("li",
				{
					innerHTML: html,
					"aria-selected": "false"
				});
			}
		});

	this.elem.addEventListener("input", function()
	{
		that.checkfilter();
	});
}

WSDisplayFilter.prototype.checkfilter = function()
{
	var el = this.elem;

	var that = this;

	if (el.value.length >= 2)
	{
		var fields = input_extractor(el);

		complete_field_cache(fields[0],
			function(data)
			{
				var list = [ ];

				for (var i = 0; i < data.length; i++)
				{
					var field_name = data[i]['f'];
					var field_descr = "";

					if (data[i]['n'])
						field_descr = data[i]['n'] + ' (' + g_ws_ftypes[data[i]['t']] + ')';

					list[i] =
					{
						label: field_name,
						descr: field_descr,
						value: fields[1] + field_name + fields[2]
					};
				}

				that.complete.list = list;
				// that.complete.evaluate();
			});
	}

	if (el.value == '')
	{
		el.className = '';
		return;
	}

	var check_req =
		{
			req: 'check'
		};

	if (this.mode == 'field')
		check_req['field'] = el.value;
	else
		check_req['filter'] = el.value;

	window.webshark.webshark_json_get(check_req,
		function(data)
		{
			var txt = data['filter'];

			if (that.mode == 'field')
				txt = data['field'];

			if (txt == 'ok')
				el.className = 'ws_gui_text_valid';
			else if (txt == 'deprecated')
				el.className = 'ws_gui_text_deprecated';
			else
				el.className = 'ws_gui_text_invalid';
		});
}


WSDisplayFilter.prototype.setFilter = function(filter)
{
	this.elem.value = filter;
	this.checkfilter();
}

exports.WSDisplayFilter = WSDisplayFilter;
