/* webshark-preferences.js
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

var m_webshark_clusterize_module = require("./webshark-clusterize.js");

function WSPreferencesTable(opts)
{
	var that = this;

	this.prefs_array = [ ];
	this.pref_filter = '';

	this.selected_option = null;

	this.capture_filename = opts['filename'];

	this.cluster = new m_webshark_clusterize_module.Clusterize({
		rows: [],
		rows_in_block: 50,
		tag: 'tr',
		scrollId: opts['scrollId'],
		contentId: opts['contentId']
	});

	this.cluster.options.callbacks.createHTML = function(option, row)
	{
		return that.createOptionRowHTML(option, row);
	};
}

WSPreferencesTable.prototype.optionRowOnClick = function (option_node)
{
	if (this.selected_option != null)
		this.selected_option.classList.remove("selected");

	/* select new */
	option_node.classList.add("selected");
	this.selected_option = option_node;
};

WSPreferencesTable.prototype.createOptionRowHTML = function(option, row)
{
	var tr = document.createElement("tr");

	/* name */
	var td = document.createElement("td");
	td.appendChild(document.createTextNode(option['name']));
	tr.appendChild(td);

	/* type */
	var td = document.createElement("td");
	if (option['bool'] != undefined)
		td.appendChild(document.createTextNode('bool'));
	else if (option['str'] != undefined)
		td.appendChild(document.createTextNode('string'));
	else if (option['uint'] != undefined)
		td.appendChild(document.createTextNode('uint'));
	else if (option['enum'] != undefined)
		td.appendChild(document.createTextNode('enum'));
	else if (option['range'] != undefined)
		td.appendChild(document.createTextNode('range'));
	else if (option['table'] != undefined)
		td.appendChild(document.createTextNode('table'));
	else
		td.appendChild(document.createTextNode('unknown'));
	tr.appendChild(td);

	/* value */
	var td = document.createElement("td");
	if (option['bool'] != undefined)
	{
		var val = option['bool'] ? true : false;

		var inp = document.createElement('input');
		inp.setAttribute('type', 'checkbox');
		if (val)
			inp.setAttribute('checked', 'checked');

		td.appendChild(inp);
	}
	else if (option['str'] != undefined)
	{
		var val = option['str'];

		var inp = document.createElement('input');
		inp.setAttribute('type', 'text');
		inp.setAttribute('value', val);

		td.appendChild(inp);
	}
	else if (option['uint'] != undefined)
	{
		var val = option['uint'];

		var inp = document.createElement('input');
		inp.setAttribute('type', 'text');
		inp.setAttribute('value', val);

		td.appendChild(inp);
	}
	else if (option['enum'] != undefined)
	{
		var inp = document.createElement('select');
		for (var i = 0; i < option['enum'].length; i++)
		{
			var e = option['enum'][i];

			var opt = document.createElement('option');
			opt.setAttribute('value', e['v']);
			opt.appendChild(document.createTextNode(e['d']));

			if (e['s'] != undefined)
				opt.setAttribute('selected', 'selected');

			inp.appendChild(opt);
		}

		td.appendChild(inp);
	}
	else if (option['range'] != undefined)
	{
		var val = option['range'];

		var inp = document.createElement('input');
		inp.setAttribute('type', 'text');
		inp.setAttribute('value', val);

		td.appendChild(inp);
	}
	else if (option['table'] != undefined)
	{
		/* TODO */
	}
	tr.appendChild(td);

	tr.addEventListener("click", this.optionRowOnClick.bind(this, tr));

	return tr;
};

WSPreferencesTable.prototype.loadPrefs = function()
{
	var that = this;

	var dumpconf_req =
		{
			req: 'dumpconf'
		};

	if (this.capture_filename)
		dumpconf_req['capture'] = this.capture_filename;

	window.webshark.webshark_json_get(dumpconf_req,
		function(data)
		{
			var prefs = data['prefs'];

			var prefs_arr = [ ];
			var pref_names = [ ];

			for (var x in prefs)
			{
				var pref = prefs[x];

				var p = { name: x };

				p['bool'] = pref['b'];
				p['str']  = pref['s'];
				p['uint'] = pref['u'];
				p['enum'] = pref['e'];
				p['range'] = pref['r'];
				p['table'] = pref['t'];

				prefs_arr.push(p);
			}

			that.prefs_array = prefs_arr;
			that.updateDisplay();
		});
};

WSPreferencesTable.prototype.setPrefFilter = function(filter)
{
	this.pref_filter = filter;
	this.updateDisplay();
};

WSPreferencesTable.prototype.updateDisplay = function()
{
	var that = this;

	var prefs_arr = this.prefs_array.filter(function(data)
		{
			if (that.pref_filter == '') return true;

			/* starts with */
			return (data['name'].indexOf(that.pref_filter) == 0);
		});

	this.cluster.setData(prefs_arr);
};

exports.WSPreferencesTable = WSPreferencesTable;
