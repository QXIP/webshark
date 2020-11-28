/* webshark.js
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

var m_webshark_capture_files_module = require("./webshark-capture-files.js");
var m_webshark_display_filter_module = require('./webshark-display-filter.js');
var m_webshark_packet_list_module = require("./webshark-packet-list.js");
var m_webshark_protocol_tree_module = require("./webshark-protocol-tree.js");
var m_webshark_hexdump_module = require('./webshark-hexdump.js');
var m_webshark_interval_module = require("./webshark-interval.js");
var m_webshark_iograph_module = require("./webshark-iograph.js");
var m_webshark_preferences_module = require("./webshark-preferences.js");
var m_webshark_tap_module = require("./webshark-tap.js");
var m_webshark_symbols_module = require("./webshark-symbols.js");

var m_webshark_current_frame = 0;

function Webshark()
{
	this.status = null;
	this.cols = null;
	this.filter = null;

	this.fetch_columns_limit = 120;

	this.ref_frames = [ ];
	this.cached_columns = [ ];
}

Webshark.prototype.load = function(filename, cb)
{
	var req_status =
		{
			req: 'status',
			capture: filename
		};

	var that = this;

	webshark_json_get(req_status,
		function(data)
		{
			data['filename'] = filename; /* we know better */

			that.status = data;
			cb(data);
		});
};

Webshark.prototype.setRefFrame = function(framenum, is_ref)
{
	var done = false;

	for (var i = 0; i < this.ref_frames.length; i++)
	{
		var ref_frame = this.ref_frames[i];

		if (ref_frame == framenum)
		{
			this.ref_frames[i] = (is_ref) ? framenum : 0;
			done = true;
			break;
		}

		if (ref_frame == 0 && is_ref)
		{
			this.ref_frames[i] = framenum;
			done = true;
			break;
		}
	}

	if (!done && is_ref)
	{
		this.ref_frames.push(framenum);
	}

	this.ref_frames.sort(function(a, b)
	{
		return a - b;
	});

	this.invalidCacheFrames();
};

Webshark.prototype.getCurrentFrameNumber = function()
{
	return m_webshark_current_frame;
};

Webshark.prototype.getRefFrame = function(framenum)
{
	var max_ref_frame = 0;

	for (var i = 0; i < this.ref_frames.length; i++)
	{
		var ref_frame = this.ref_frames[i];

		/* skip ref frames bigger than requested frame number */
		if (ref_frame > framenum)
			continue;

		if (max_ref_frame < ref_frame)
			max_ref_frame = ref_frame;
	}

	return max_ref_frame;
};

Webshark.prototype.getRefFrames = function()
{
	var str = "";
	var sepa = "";

	for (var i = 0; i < this.ref_frames.length; i++)
	{
		var ref_frame = this.ref_frames[i];

		if (!ref_frame)
			continue;

		str = str + sepa + ref_frame;
		sepa = ",";
	}

	return str;
};

Webshark.prototype.setColumns = function(user_cols)
{
	this.cols = user_cols;
};

Webshark.prototype.setFilter = function(new_filter)
{
	this.filter = new_filter;
	this.cached_columns = [ ];

	this.update();
};

Webshark.prototype.update = function()
{
	var req_intervals =
		{
			req: 'intervals',
			capture: g_webshark_file
		};

	if (this.filter)
		req_intervals['filter'] = this.filter;

	/* XXX, webshark.load() is not called for taps/ single frames/ ... */
	if (g_webshark_interval && this.status)
	{
		g_webshark_interval.setDuration(this.status.duration);
		req_intervals['interval'] = 1000 * g_webshark_interval.getScale();
	}
	else
	{
		req_intervals['interval'] = 1000 * 60 * 60 * 24;  /* XXX, if interval is not created we don't really care about result data. There is no easy way to get information about number of frames after filtering ;( */
	}

	var that = this;

	/* XXX, first need to download intervals to know how many rows we have, rewrite */
	webshark_json_get(req_intervals,
		function(data)
		{
			if (g_webshark_interval && that.status)
				g_webshark_interval.setResult(that.filter, data);

			that.cached_columns = [ ];
			that.cached_columns.length = data['frames'];
			that.fetchColumns(0, true);
		});
};

Webshark.prototype.fetchColumns = function(skip, load_first)
{
	var req_frames =
		{
			req: 'frames',
			capture: g_webshark_file
		};

	if (this.fetch_columns_limit != 0)
		req_frames['limit'] = this.fetch_columns_limit;

	if (skip != 0)
		req_frames['skip'] = skip;

	if (this.filter)
		req_frames['filter'] = this.filter;

	for (var i = 0; i < this.fetch_columns_limit && skip + i < this.cached_columns.length; i++)
	{
		if (!this.cached_columns[skip + i])
			this.cached_columns[skip + i] = m_webshark_packet_list_module.m_COLUMN_DOWNLOADING;
	}

	if (this.cols)
	{
		for (var i = 0; i < this.cols.length; i++)
			req_frames['column' + i] = this.cols[i];
	}

	var refs = this.getRefFrames();
	if (refs != "")
		req_frames['refs'] = refs;

	var that = this;

	webshark_json_get(req_frames,
		function(data)
		{
			if (data)
			{
				for (var i = 0; i < data.length; i++)
					that.cached_columns[skip + i] = data[i];
				g_webshark_packet_list.setPackets(that.cached_columns);
			}

			if (load_first && data && data[0])
			{
				var framenum = data[0].num;
				webshark_load_frame(framenum, false);
			}
		});
};

Webshark.prototype.invalidCacheFrames = function()
{
	for (var i = 0; i < this.cached_columns.length; i++)
	{
		this.cached_columns[i] = null;
	}

	g_webshark_packet_list.setPackets(this.cached_columns);
};

Webshark.prototype.invalidCacheFrame = function(framenum)
{
	for (var i = 0; i < this.cached_columns.length; i++)
	{
		if (this.cached_columns[i])
		{
			var cur_framenum = this.cached_columns[i].num;

			if (framenum == cur_framenum)
			{
				this.cached_columns[i] = null;
				this.fetchColumns(i, false);
				return;
			}
		}
	}
};

Webshark.prototype.getComment = function(framenum, func)
{
	webshark_json_get(
		{
			req: 'frame',
			capture: g_webshark_file,
			frame: framenum
		},
		func);
};

Webshark.prototype.setComment = function(framenum, new_comment)
{
	var set_req =
		{
			req: 'setcomment',
			capture: g_webshark_file,
			frame: framenum
		};

	if (new_comment != null && new_comment != "")
	{
		/* NULL or empty comment, means delete comment */
		set_req['comment'] = new_comment;
	}

	var that = this;

	webshark_json_get(set_req,
		function(data)
		{
			/* XXX, lazy, need invalidate cache, to show comment symbol, FIX (notifications?) */
			that.invalidCacheFrame(framenum);

			if (m_webshark_current_frame == framenum)
			{
				m_webshark_current_frame = 0;
				webshark_load_frame(framenum, false);
			}
		});
};

function debug(level, str)
{
	if (console && console.log)
		console.log("<" + level + "> " + str);
}

function popup(url)
{
	var newwindow = window.open(url, url, 'height=500,width=1000');

	if (window.focus)
		newwindow.focus();
}

function popup_on_click_a(ev)
{
	var node;
	var url;

	node = dom_find_node_attr(ev.target, 'href');
	if (node != null)
	{
		url = node['href'];
		if (url != null)
			popup(url);

		ev.preventDefault();
	}
}

function webshark_params_to_uri(params)
{
	var req = null;

	for (var r in params)
	{
		var creq = r + "=" + encodeURIComponent(params[r]);

		if (req)
			req = req + "&" + creq;
		else
			req = '?' + creq;
	}

	if (req == null)
		req = '';

	return req;
}

function webshark_create_url(params)
{
	var base_url = window.location.href.split("?")[0];

	var str_params = webshark_params_to_uri(params);

	return base_url + str_params;
}

function webshark_create_api_url(params)
{
	var base_url = g_webshark_url;

	var str_params = webshark_params_to_uri(params);

	return base_url + str_params;
}

function webshark_get_params_url()
{
	var query = window.location.href.split("?")[1];

	var result = { };

	if (query)
	{
		var opts = query.split("&");
		for (var i = 0; i < opts.length; i++)
		{
			var arr = opts[i].split("=");
			result[arr[0]] = decodeURIComponent(arr[1]);
		}
	}

	return result;
}

function dom_clear(p)
{
	p.innerHTML = "";
}

function dom_set_child(p, ch)
{
	dom_clear(p);
	p.appendChild(ch);
}

function dom_create_label(str)
{
	var label = document.createElement("p");

	label.setAttribute('align', 'center');
	label.appendChild(document.createTextNode(str));

	return label;
}

function dom_find_node_attr(n, attr)
{
	while (n != null)
	{
		if (n[attr] != undefined)
			return n;

		n = n.parentNode;
	}

	return null;
}

async function webshark_json_get(req_data, cb)
{

        if(req_data.capture){
            console.log('File Data Request',req_data.capture);
            try {
            var filename = req_data.capture;
            if( filename.startsWith('http') && filename.endsWith('.pcap') ){
                var file = filename.split('/').pop().split('#')[0].split('?')[0];
                console.log('---------------- found remote pcap url', filename, file);
                var cors = "http://cors-anywhere.herokuapp.com/";
                var pcap = await fetch(cors+filename, { method: 'GET', mode: 'cors'})
                                .then(response => response.blob())
                console.log('---------------- downloaded remote pcap', file, pcap);
                if(pcap.size == 0) { console.log('zero size'); return; }
                var formData = new FormData();
                formData.append('f', pcap, file);
                var res = await fetch("/webshark/upload", { method: 'POST', body: formData });
                console.log('---------------- uploaded remote pcap', res, file);
                req_data.capture = file;
                console.log('---------------- new req',req_data);
            }
            } catch(e) { console.log(e); }
        }

	var http = new XMLHttpRequest();

	var url = webshark_create_api_url(req_data);

	var req = JSON.stringify(req_data);

	debug(3, " webshark_json_get(" + req + ") sending request");

	http.open("GET", url, true);
	http.onreadystatechange =
		function()
		{
			if (http.readyState == 4 && http.status == 200)
			{
				debug(3, " webshark_json_get(" + req + ") got 200 len = " + http.responseText.length);

				var js = JSON.parse(http.responseText);
				cb(js);
			}
		};

	http.send(null);
}

function webshark_frame_comment_on_over(ev)
{
	var node;

	node = dom_find_node_attr(ev.target, 'data_ws_frame');
	if (node != null)
	{
		var framenum = node.data_ws_frame;

		g_webshark.getComment(framenum,
			function(data)
			{
				var tgt = ev.target;
				if (tgt)
				{
					var frame_comment = data['comment'];

					if (frame_comment)
					{
						tgt.setAttribute('alt', 'Edit Comment: ' + frame_comment);
						tgt.setAttribute('title', 'Edit Comment: ' + frame_comment);
					}
					else
					{
						tgt.setAttribute('alt', 'New Comment');
						tgt.setAttribute('title', 'New Comment');
					}
				}
			});
	}

	ev.preventDefault();
}

function webshark_frame_timeref_on_click(ev)
{
	var node;

	node = dom_find_node_attr(ev.target, 'data_ws_frame');
	if (node != null)
	{
		var framenum = node.data_ws_frame;
		var timeref = (g_webshark.getRefFrame(framenum) == framenum);

		g_webshark.setRefFrame(framenum, !timeref);
	}

	ev.preventDefault();
}

function webshark_frame_comment_on_click(ev)
{
	var node;

	node = dom_find_node_attr(ev.target, 'data_ws_frame');
	if (node != null)
	{
		var framenum = node.data_ws_frame;

		g_webshark.getComment(framenum,
			function(data)
			{
				var prev_comment = data['comment'];

				var comment = window.prompt("Please enter new comment for frame #" + framenum, prev_comment);
				if (comment != null)
					g_webshark.setComment(framenum, comment);
			});
	}

	ev.preventDefault();
}

function webshark_frame_goto(ev)
{
	var node;

	node = dom_find_node_attr(ev.target, 'data_ws_frame');
	if (node != null)
	{
		webshark_load_frame(node.data_ws_frame, true);
	}

	ev.preventDefault();
}

function webshark_on_field_select_highlight_bytes(node)
{
	var hls = [ ];

	var ds_idx = node['ds'];
	if (ds_idx == undefined)
		ds_idx = 0;

	if (node['h'] != undefined) /* highlight */
		hls.push({ tab: ds_idx, start: node['h'][0], end: (node['h'][0] + node['h'][1] ), style: 'selected_bytes' });

	if (node['i'] != undefined) /* appendix */
		hls.push({ tab: ds_idx, start: node['i'][0], end: (node['i'][0] + node['i'][1] ), style: 'selected_bytes' });

	if (node['p'] != undefined) /* protocol highlight */
	{
		var p_ds_idx = node['p_ds'];
		if (p_ds_idx == undefined)
			p_ds_idx = 0;

		hls.push({ tab: p_ds_idx, start: node['p'][0], end: (node['p'][0] + node['p'][1] ), style: 'selected_proto' });
	}

	g_webshark_hexdump.switch_tab(ds_idx, false);

	g_webshark_hexdump.active = ds_idx;
	g_webshark_hexdump.highlights = hls;
	g_webshark_hexdump.render_hexdump();
}

function webshark_load_frame(framenum, scroll_to, cols)
{
	/* frame content should not change -> skip requests for frame like current one */
	if (framenum == m_webshark_current_frame)
		return;

	/* unselect previous */
	if (m_webshark_current_frame != 0)
	{
		var obj = document.getElementById('packet-list-frame-' + m_webshark_current_frame);
		if (obj)
			obj.classList.remove("selected");
	}

	var load_req =
		{
			req: 'frame',
			bytes: 'yes',
			proto: 'yes',
			capture: g_webshark_file,
			frame: framenum
		};

	var ref_framenum = g_webshark.getRefFrame(framenum);
	if (ref_framenum)
		load_req['ref_frame'] = ref_framenum;
	load_req['prev_frame'] = framenum - 1;   /* TODO */

	webshark_json_get(load_req,
		function(data)
		{
			var bytes_names = [ ];
			var bytes_data = [ ];

			g_webshark_prototree_html.onFieldSelect = webshark_on_field_select_highlight_bytes;
			g_webshark_prototree_html.tree = data['tree'];
			g_webshark_prototree_html.render_tree();

			var fol = data['fol'];

			for (var i = 0; i < g_ws_follow.length; i++)
			{
				var it = document.getElementById('menu_tap_' + g_ws_follow[i].tap);

				if (it)
				{
					it.style.display = 'none';
				}
			}

			if (fol)
			{
				for (var i = 1; i < fol.length; i++)
				{
					var it = document.getElementById('menu_tap_follow:' + fol[i][0]);

					if (it)
					{
						it.setAttribute("href", webshark_create_url(
							{
								file: g_webshark_file,
								follow: fol[i][0],
								filter: fol[i][1]
							}));
						it.style.display = 'inline';
					}
				}
			}

			bytes_data.push(window.atob(data['bytes']));
			bytes_names.push('Frame (' + bytes_data[0].length + ' bytes)');

			/* multiple data sources? */
			if (data['ds'])
			{
				for (var i = 0; i < data['ds'].length; i++)
				{
					bytes_data.push(window.atob(data['ds'][i]['bytes']));
					bytes_names.push(data['ds'][i]['name']);
				}
			}

			g_webshark_hexdump.create_tabs(bytes_data, bytes_names);

			g_webshark_hexdump.active = 0;
			g_webshark_hexdump.highlights = [ ];
			g_webshark_hexdump.render_hexdump();

			if (g_webshark_on_frame_change != null)
			{
				g_webshark_on_frame_change(framenum, data);
			}

			m_webshark_current_frame = framenum;

			/* select new */
			var obj = document.getElementById('packet-list-frame-' + framenum);
			if (obj)
			{
				obj.classList.add('selected');
				if (scroll_to)
					obj.scrollIntoView(false);
			}

		});
}

function webshark_load_follow(follow, filter)
{
	webshark_json_get(
		{
			req: 'follow',
			capture: g_webshark_file,
			follow: follow,
			filter: filter
		},
		function(data)
		{
			var f = data;
			var server_to_client_string_tag = f['shost'] + ':' + f['sport'] + ' --> ' + f['chost'] + ':' + f['cport'];
			var client_to_server_string_tag = f['chost'] + ':' + f['cport'] + ' --> ' + f['shost'] + ':' + f['sport'];

			var server_to_client_string = server_to_client_string_tag + ' (' + f['sbytes'] + ' bytes)';
			var client_to_server_string = client_to_server_string_tag + ' (' + f['cbytes'] + ' bytes)';

			var div = document.createElement('div');

			if (f['payloads'])
			{
				var p = f['payloads'];

				for (var i = 0; i < p.length; i++)
				{
					var f_txt = window.atob(p[i]['d']);
					var f_no = p[i]['n'];
					var f_server = (p[i]['s'] != undefined);

					var load_frame_func = webshark_load_frame.bind(null, f_no, true);

					var pre = document.createElement('pre');
					pre.appendChild(document.createTextNode('Frame #' + f_no + ': ' + (f_server ? server_to_client_string_tag : client_to_server_string_tag) +' (' + f_txt.length+ ' bytes)'));
					pre.className = 'follow_frame_no';
					pre.addEventListener("click", load_frame_func);
					div.appendChild(pre);

					var pre = document.createElement('pre');
					pre.appendChild(document.createTextNode(f_txt));
					pre.className = f_server ? 'follow_server_tag' : 'follow_client_tag';
					pre.addEventListener("click", load_frame_func);
					div.appendChild(pre);
				}
			}

			document.getElementById('ws_tap_table').appendChild(div);

			document.getElementById('ws_packet_list_view').style.display = 'block';
			g_webshark.setFilter(filter);

		});
}

exports.ProtocolTree = m_webshark_protocol_tree_module.ProtocolTree;
exports.WSCaptureFilesTable = m_webshark_capture_files_module.WSCaptureFilesTable;
exports.WSDisplayFilter = m_webshark_display_filter_module.WSDisplayFilter;
exports.WSHexdump = m_webshark_hexdump_module.WSHexdump;
exports.WSInterval = m_webshark_interval_module.WSInterval;
exports.WSIOGraph = m_webshark_iograph_module.WSIOGraph;
exports.WSPacketList = m_webshark_packet_list_module.WSPacketList;
exports.WSPreferencesTable = m_webshark_preferences_module.WSPreferencesTable;
exports.webshark_load_tap = m_webshark_tap_module.webshark_load_tap;
exports.webshark_create_file_details = m_webshark_capture_files_module.webshark_create_file_details;
exports.webshark_glyph_img = m_webshark_symbols_module.webshark_glyph_img;

exports.Webshark = Webshark;
exports.webshark_json_get = webshark_json_get;

exports.webshark_create_url = webshark_create_url;
exports.webshark_create_api_url = webshark_create_api_url;
exports.webshark_get_params_url = webshark_get_params_url;
exports.webshark_frame_goto = webshark_frame_goto;
exports.webshark_load_frame = webshark_load_frame;
exports.popup_on_click_a = popup_on_click_a;

exports.dom_create_label = dom_create_label;
exports.dom_set_child = dom_set_child;
exports.dom_find_node_attr = dom_find_node_attr;

exports.webshark_load_follow = webshark_load_follow;
exports.webshark_frame_comment_on_over = webshark_frame_comment_on_over;
exports.webshark_frame_timeref_on_click = webshark_frame_timeref_on_click;
exports.webshark_frame_comment_on_click = webshark_frame_comment_on_click;
