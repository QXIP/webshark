/* webshark-capture-files.js
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

var m_webshark_symbols_module = require("./webshark-symbols.js");
var m_webshark_clusterize_module = require("./webshark-clusterize.js");

function webshark_create_file_details(file)
{
	var div = document.createElement('div');
	var p;

	a = document.createElement('a');

	a.appendChild(document.createTextNode('Load'));
	a.setAttribute("href", file['url']);
	div.appendChild(a);

	p = document.createElement('p');
	p.appendChild(document.createTextNode('File: ' + file['_path']));
	div.appendChild(p);

	if (file['size'])
	{
		p = document.createElement('p');
		p.appendChild(document.createTextNode('Size: ' + file['size']));
		div.appendChild(p);
	}

	if (file['analysis'])
	{
		p = document.createElement('p');
		p.appendChild(document.createTextNode('Frames: ' + file['analysis']['frames']));
		div.appendChild(p);

		/* Time */
		var first = file['analysis']['first'];
		var last  = file['analysis']['last'];

		if (first && last)
		{
			var dura  = last - first;

			var format = d3.utcFormat; /* XXX, check if UTC */

			p = document.createElement('p');
			p.appendChild(document.createTextNode('From: ' + format(new Date(first * 1000))));
			div.appendChild(p);

			p = document.createElement('p');
			p.appendChild(document.createTextNode('To: ' + format(new Date(last * 1000))));
			div.appendChild(p);

			p = document.createElement('p');
			p.appendChild(document.createTextNode('Duration: ' + (last - first) + " s"));
			div.appendChild(p);
		}

		/* Protocols */
		var protos = file['analysis']['protocols'];
		if (protos && protos.length > 0)
		{
			var ul = document.createElement('ul')
			ul.className = 'proto';

			div.appendChild(document.createElement('p').appendChild(document.createTextNode('Protocols:')));
			for (var k = 0; k < protos.length; k++)
			{
				var proto_li = document.createElement('li');

				proto_li.appendChild(document.createTextNode(protos[k]));
				proto_li.className = 'proto';

				ul.appendChild(proto_li);
			}
			div.appendChild(ul);
		}
	}

	return div;
}

function WSCaptureFilesTable(opts)
{
	this.files = [ ];
	this.filesFilter = '';
	this.selectedFile = null;

	this.cluster = new m_webshark_clusterize_module.Clusterize({
		rows: [],
		rows_in_block: 50,
		tag: 'tr',
		scrollId: opts['scrollId'],
		contentId: opts['contentId']
	});

	this.fileDetails = document.getElementById(opts['fileDetailsId']);
};

function WSCaptureFilesTable_filter_files(files, filter)
{
	if (!filter || filter.length == 0)
		return files;

	var rules = filter.split(" ");

	var frames_count_min = undefined;
	var frames_count_max = undefined;
	var duration_time_min = undefined;
	var duration_time_max = undefined;
	var filename_contain = [ ];
	var protocols = [ ];

	for (var i = 0; i < rules.length; i++)
	{
		var rule = rules[i];

		if (rule.indexOf('frames>') != -1)
			frames_count_min = rule.slice('frames>'.length);
		else if (rule.indexOf('frames<') != -1)
			frames_count_max = rule.slice('frames<'.length);
		else if (rule.indexOf('duration>') != -1)
			duration_time_min = rule.slice('duration>'.length);
		else if (rule.indexOf('duration<') != -1)
			duration_time_max = rule.slice('duration<'.length);
		else if (rule.indexOf('proto:') != -1)
			protocols.push(rule.slice('proto:'.length));
		else
			filename_contain.push(rule);
	}

	var filtered = files.filter(function(file)
	{
		var anal = file['analysis'];

		// TODO, what to do if there are no analysis?
		if (frames_count_min && (!anal || anal['frames'] <= frames_count_min))
			return false;

		if (frames_count_max && (!anal || anal['frames'] >= frames_count_max))
			return false;

		if (duration_time_min || duration_time_max)
		{
			if (!anal)
				return false;

			// TODO, what to do if there are no time analysis?
			var dura = anal['last'] - anal['first'];

			if (duration_time_min && dura <= duration_time_min)
				return false;

			if (duration_time_max && dura >= duration_time_max)
				return false;
		}

		for (var i = 0; i < filename_contain.length; i++)
		{
			if (file['name'].indexOf(filename_contain[i]) == -1)
				return false;
		}

		for (var i = 0; i < protocols.length; i++)
		{
			var found = false;
			var proto = protocols[i];

			for (var j = 0; found == false && j < (anal ? anal['protocols'].length : 0); j++)
			{
				if (proto == anal['protocols'][j])
					found = true;
			}

			if (found == false)
				return false;
		}

		return true;
	});

	return filtered;
};

WSCaptureFilesTable.prototype._onRowClickHTML = function(click_tr, file)
{
	if (click_tr == this.selectedFile)
	{
		/* TODO: after double(triple?) clicking auto load file? */
		return;
	}

	file['url'] = window.webshark.webshark_create_url(
		{
			file: file['_path']
		});

	if (this.fileDetails != null)
	{
		var div = webshark_create_file_details(file);
		this.fileDetails.innerHTML = "";
		this.fileDetails.appendChild(div);
	}

	/* unselect previous */
	if (this.selectedFile != null)
		this.selectedFile.classList.remove("selected");

	/* select new */
	click_tr.classList.add("selected");
	this.selectedFile = click_tr;
};

WSCaptureFilesTable.prototype._createFileRowHTML = function(file, row_no)
{
	var that = this;

	var tr = document.createElement("tr");

	var si_format = d3.format('.2s');

	var stat = file['status'];

	var data = [
		file['name'],
		file['dir'] ? "[DIR]" : (si_format(file['size']) + "B"),
		file['desc'] ? file['desc'] : "",
	];

	var a_href = document.createElement("a");
	if (file['dir'])
	{
		data[0] = file['_path'];

		a_href.setAttribute("href", window.webshark.webshark_create_url(
			{
				dir: file['_path']
			}));
		a_href.addEventListener("click",
			function(ev)
			{
				var dir = file['_path'];

				that.loadFiles(dir);
				ev.preventDefault();
			});
	}
	else
	{
		a_href.setAttribute("href", window.webshark.webshark_create_url(
			{
				file: file['_path']
			}));
	}
	a_href.appendChild(document.createTextNode(data[0]));

	for (var j = 0; j < data.length; j++)
	{
		var td = document.createElement("td");

		if (j == 0) /* before filename */
		{
			var glyph = null;

			if (file['pdir'])
			{
				glyph = m_webshark_symbols_module.webshark_glyph_img('pfolder', 16);
				glyph.setAttribute('alt', 'Open Directory');
				glyph.setAttribute('title', 'Open Directory');
			}
			else if (file['dir'])
			{
				glyph = m_webshark_symbols_module.webshark_glyph_img('folder', 16);
				glyph.setAttribute('alt', 'Directory');
				glyph.setAttribute('title', 'Directory');
			}
			else if (stat && stat['online'])
			{
				glyph = m_webshark_symbols_module.webshark_glyph_img('play', 16);
				glyph.setAttribute('alt', 'Running');
				glyph.setAttribute('title', 'Running ...');
			}
			else
			{
				glyph = m_webshark_symbols_module.webshark_glyph_img('stop', 16);
				glyph.setAttribute('alt', 'Stopped');
				glyph.setAttribute('title', 'Stopped');
			}
			if (glyph)
				td.appendChild(glyph);
			td.appendChild(document.createTextNode(' '));
		}

		if (j == 0)
			td.appendChild(a_href);
		else
			td.appendChild(document.createTextNode(data[j]));
		tr.appendChild(td);
	}

	if (file['cdir'] == true)
	{
		tr.style['background-color'] = '#ffffb0';
	}
	else if (stat && stat['online'] == true)
	{
		tr.style['background-color'] = 'lightblue';
	}
	else
	{
		tr.style['background-color'] = '#ccc';
	}

	tr.addEventListener("click", this._onRowClickHTML.bind(this, tr, file));

	return tr;
};

WSCaptureFilesTable.prototype.updateDisplay = function()
{
	var files = WSCaptureFilesTable_filter_files(this.files, this.filesFilter);
	var that = this;

	this.cluster.options.callbacks.createHTML = function(file, row_no)
	{
		return that._createFileRowHTML(file, row_no);
	};
	this.cluster.setData(files);
};

WSCaptureFilesTable.prototype.loadFiles = function(dir)
{
	var that = this;

	var files_req =
		{
			req: 'files'
		};

	if (dir)
		files_req['dir'] = dir;

	window.webshark.webshark_json_get(files_req,
		function(data)
		{
			var pwd = data['pwd'];
			var fullpwd;
			var files = data['files'];

			if (pwd == '.' || pwd == '/')
			{
				pwd = '/';
				fullpwd = '/';
			}
			else
			{
				pwd = '/' + pwd;
				fullpwd = pwd + '/';
			}

			for (var i = 0; i < files.length; i++)
			{
				var item = files[i];

				item['_path'] = fullpwd + item['name'];
			}

			files.sort(function(a, b)
			{
				var sta = a['status'], stb = b['status'];
				var ona, onb;

				/* first directory */
				ona = (a['dir'] == true) ? 1 : 0;
				onb = (b['dir'] == true) ? 1 : 0;
				if (ona != onb)
					return ona < onb ? 1 : -1;

				/* than online */
				ona = (sta && sta['online'] == true) ? 1 : 0;
				onb = (stb && stb['online'] == true) ? 1 : 0;
				if (ona != onb)
					return ona < onb ? 1 : -1;

				/* and than by filename */
				return a['name'] > b['name'] ? 1 : -1;
			});

			/* some extra directories always on top */
			files.unshift({ cdir: true, pdir: true, name: fullpwd, _path: fullpwd, 'dir': true, 'desc': '' });

			while (pwd != '/' && pwd != '')
			{
				var parentdir = pwd.substring(0, pwd.lastIndexOf('/'));

				if (parentdir.length != 0)
					files.unshift({ pdir: true, name: parentdir, _path: parentdir, 'dir': true, 'desc': '' });

				pwd = parentdir;
			}

			if (fullpwd != '/')
				files.unshift({ pdir: true, name: '/', _path: '/', 'dir': true, 'desc': '' });

			that.files = files;
			that.updateDisplay();
		});
};

WSCaptureFilesTable.prototype.setFilesFilter = function(filter)
{
	this.filesFilter = filter;
	this.updateDisplay();
};

exports.WSCaptureFilesTable = WSCaptureFilesTable;
exports.webshark_create_file_details = webshark_create_file_details;
