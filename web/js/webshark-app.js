(function(modules, cache, entry) {
	window.webshark = req(entry);
	function req(name) {
	  if (cache[name]) return cache[name].exports;
	  var m = cache[name] = {exports: {}};
	  modules[name][0].call(m.exports, modRequire, m, m.exports, window);
	  return m.exports;
	  function modRequire(alias) {
		var id = modules[name][1][alias];
		if (!id) throw new Error("Cannot find module " + alias);
		return req(id);
	  }
	}
  })({0: [function(require,module,exports,global){
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
  
  }, {"./webshark-display-filter.js":1,"./webshark-capture-files.js":2,"./webshark-packet-list.js":3,"./webshark-protocol-tree.js":4,"./webshark-hexdump.js":5,"./webshark-interval.js":6,"./webshark-iograph.js":7,"./webshark-preferences.js":8,"./webshark-tap.js":9,"./webshark-symbols.js":10}],1: [function(require,module,exports,global){
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
  
  }, {"./webshark-awesomplete.js":11}],2: [function(require,module,exports,global){
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
  
  }, {"./webshark-symbols.js":10,"./webshark-clusterize.js":12}],3: [function(require,module,exports,global){
  /* webshark-packet-list.js
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
  
  var m_COLUMN_DOWNLOADING = 42;
  
  function webshark_create_frame_row_html(frame, row_no)
  {
	  var tr = document.createElement("tr");
  
	  if (!frame)
	  {
		  g_webshark.fetchColumns(row_no, false);
		  return tr;
	  }
  
	  if (frame == m_COLUMN_DOWNLOADING)
		  return tr;
  
	  var cols = frame['c'];
	  var fnum = frame['num'];
  
	  for (var j = 0; j < cols.length; j++)
	  {
		  var td = document.createElement("td");
  
		  if (j == 0)
		  {
			  /* XXX, check if first column is equal to frame number, if so assume it's frame number column, and create link */
			  if (cols[0] == fnum)
			  {
				  var a = document.createElement('a');
  
				  a.appendChild(document.createTextNode(cols[j]))
  
				  a.setAttribute("target", "_blank");
				  a.setAttribute("href", window.webshark.webshark_create_url(
					  {
						  file: g_webshark_file,
						  frame: fnum
					  }));
				  a.addEventListener("click", window.webshark.popup_on_click_a);
  
				  td.appendChild(a);
			  }
  
			  if (frame['ct'])
			  {
				  var a = document.createElement('a');
  
				  var comment_glyph = m_webshark_symbols_module.webshark_glyph_img('comment', 14);
				  comment_glyph.setAttribute('alt', 'Comment');
				  comment_glyph.setAttribute('title', 'Comment');
  
				  a.setAttribute("target", "_blank");
				  a.setAttribute("href", window.webshark.webshark_create_url(
					  {
						  file: g_webshark_file,
						  frame: fnum
					  }));
				  a.addEventListener("click", window.webshark.webshark_frame_comment_on_click);
				  a.addEventListener("mouseover", window.webshark.webshark_frame_comment_on_over);
  
				  a.appendChild(comment_glyph);
				  td.appendChild(a);
			  }
		  }
		  else
		  {
			  td.appendChild(document.createTextNode(cols[j]));
		  }
  
		  tr.appendChild(td);
	  }
  
	  if (frame['bg'])
		  tr.style['background-color'] = '#' + frame['bg'];
  
	  if (frame['fg'])
		  tr.style['color'] = '#' + frame['fg'];
  
	  if (fnum == g_webshark.getCurrentFrameNumber())
		  tr.classList.add('selected');
  
	  tr.id = 'packet-list-frame-' + fnum;
	  tr.data_ws_frame = fnum;
	  tr.addEventListener("click", window.webshark.webshark_load_frame.bind(null, fnum, false));
  
	  return tr;
  }
  
  function WSPacketList(opts)
  {
	  this.headerElem = document.getElementById(opts['headerId']);
	  this.headerFakeElem = document.getElementById(opts['headerFakeId']);
  
	  this.cluster = new m_webshark_clusterize_module.Clusterize({
		  rows: [],
		  rows_in_block: 25,
		  tag: 'tr',
		  scrollId: opts['scrollId'],
		  contentId: opts['contentId']
	  });
  
	  this.cluster.options.callbacks.createHTML = webshark_create_frame_row_html;
  }
  
  WSPacketList.prototype.setColumns = function(cols, widths)
  {
	  /* real header */
	  var tr = document.createElement("tr");
  
	  for (var i = 0; i < cols.length; i++)
	  {
		  var th = document.createElement("th");
  
		  if (widths && widths[i])
			  th.style.width = widths[i] + 'px';
  
		  th.appendChild(document.createTextNode(cols[i]));
		  tr.appendChild(th);
	  }
  
	  this.headerElem.innerHTML = tr.outerHTML;
  
	  /* fake header */
	  var tr = document.createElement("tr");
	  for (var i = 0; i < cols.length; i++)
	  {
		  var th = document.createElement("th");
  
		  if (widths && widths[i])
			  th.style.width = widths[i] + 'px';
  
		  tr.appendChild(th);
	  }
  
	  this.headerFakeElem.innerHTML = tr.outerHTML;
  };
  
  WSPacketList.prototype.setPackets = function(packets)
  {
	  // don't work this.cluster.scroll_elem.scrollTop = 0;
	  this.cluster.setData(packets);
  };
  
  exports.m_COLUMN_DOWNLOADING = m_COLUMN_DOWNLOADING;
  exports.WSPacketList = WSPacketList;
  
  }, {"./webshark-symbols.js":10,"./webshark-clusterize.js":12}],4: [function(require,module,exports,global){
  /* webshark-protocol-tree.js
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
  
  var m_PROTO_TREE_PADDING_PER_LEVEL = 20;
  
  function webshark_tree_sync(subtree)
  {
	  if (subtree['expanded'] == false)
	  {
		  subtree['tree'].style.display = 'none';
		  subtree['exp'].style.display = 'none';
		  subtree['col'].style.display = 'inline';
	  }
	  else
	  {
		  subtree['tree'].style.display = 'block';
		  subtree['exp'].style.display = 'inline';
		  subtree['col'].style.display = 'none';
	  }
  }
  
  function webshark_tree_on_click(clicked_tree_node)
  {
	  var tree_node;
  
	  tree_node = window.webshark.dom_find_node_attr(clicked_tree_node, 'data_ws_subtree');
	  if (tree_node)
	  {
		  var subtree = tree_node.data_ws_subtree;
  
		  subtree['expanded'] = !subtree['expanded'];
		  webshark_tree_sync(subtree);
  
		  if (subtree['ett'])
			  sessionStorage.setItem("ett-" + subtree['ett'], subtree['expanded'] ? '1' : '0');
	  }
  }
  
  function ProtocolTree(opts)
  {
	  this.selected_field = null;
	  this.tree = null;
	  this.field_filter = null;
	  this.elem = document.getElementById(opts['contentId']);
  }
  
  ProtocolTree.prototype.node_on_click = function(clicked_node, field)
  {
	  if (this.selected_field == clicked_node)
		  webshark_tree_on_click(clicked_node);
  
	  /* unselect previous */
	  if (this.selected_field != null)
		  this.selected_field.classList.remove("selected");
  
	  if (this.onFieldSelect)
		  this.onFieldSelect(field);
  
	  /* select new */
	  this.selected_field = clicked_node;
	  clicked_node.classList.add('selected');
  };
  
  ProtocolTree.prototype.create_subtree = function(tree, proto_tree, level)
  {
	  var ul = document.createElement("ul");
  
	  for (var i = 0; i < tree.length; i++)
	  {
		  var finfo = tree[i];
  
		  if (this.checkFieldFilter(finfo) == false)
			  continue;
  
		  var li = document.createElement("li");
		  var txt_node = document.createTextNode(finfo['l']);
  
		  if (finfo['s'])
			  li.className = 'ws_cell_expert_color_' + finfo['s'];
		  else if (finfo['t'] == "proto")
			  li.className = 'ws_cell_protocol';
		  else if (finfo['t'] == "url")
		  {
			  // TODO: url in finfo['url'] but not trusted, so don't generate link.
			  li.className = 'ws_cell_link';
		  }
		  else if (finfo['t'] == "framenum")
		  {
			  var a = document.createElement('a');
  
			  a.appendChild(txt_node);
  
			  a.setAttribute("target", "_blank");
			  a.setAttribute("href", window.webshark.webshark_create_url(
				  {
					  file: g_webshark_file,
					  frame: finfo['fnum']
				  }));
			  a.addEventListener("click", window.webshark.webshark_frame_goto);
  
			  a.data_ws_frame = finfo['fnum'];
  
			  txt_node = a;
		  }
  
		  li.appendChild(txt_node);
		  ul.appendChild(li);
  
		  if (level > 1 && proto_tree['h'] != undefined)
		  {
			  finfo['p'] = proto_tree['h'];
			  finfo['p_ds'] = proto_tree['ds'];
		  }
  
		  li.addEventListener("click", this.node_on_click.bind(this, li, finfo));
  
		  li.style['padding-left'] = (level * m_PROTO_TREE_PADDING_PER_LEVEL) + "px";
  
		  if (finfo['f'])
		  {
			  var filter_a = document.createElement('a');
  
			  filter_a.setAttribute("target", "_blank");
			  filter_a.setAttribute("style", "float: right;");
			  filter_a.setAttribute("href", window.webshark.webshark_create_url(
				  {
					  file: g_webshark_file,
					  filter: finfo['f']
				  }));
			  filter_a.addEventListener("click", window.webshark.popup_on_click_a);
			  /* filter_a.addEventListener("click", webshark_tap_row_on_click_filter.bind(null, finfo['f'])); */
  
			  var glyph = m_webshark_symbols_module.webshark_glyph_img('filter', 12);
			  glyph.setAttribute('alt', 'Filter: ' + finfo['f']);
			  glyph.setAttribute('title', 'Filter: ' + finfo['f']);
  
			  filter_a.appendChild(glyph);
  
			  li.appendChild(filter_a);
		  }
  
		  if (finfo['n'])
		  {
			  var expander = document.createElement("span");
			  expander.className = "tree_expander";
  
			  var img_collapsed = m_webshark_symbols_module.webshark_glyph_img('collapsed', 16);
			  img_collapsed.setAttribute('alt', 'Expand');
			  img_collapsed.setAttribute('title', 'Click to expand');
			  expander.appendChild(img_collapsed);
  
			  var img_expanded = m_webshark_symbols_module.webshark_glyph_img('expanded', 16);
			  img_expanded.setAttribute('alt', 'Collapse');
			  img_expanded.setAttribute('title', 'Click to collapse');
			  expander.appendChild(img_expanded);
  
			  if (level == 1)
				  proto_tree = finfo; /* XXX, verify */
  
			  var subtree = this.create_subtree(finfo['n'], proto_tree, level + 1);
			  ul.appendChild(subtree);
  
			  li.insertBefore(expander, li.firstChild);
  
			  var ett_expanded = false;
			  if (finfo['e'] && sessionStorage.getItem("ett-" + finfo['e']) == '1')
				  ett_expanded = true;
			  if (this.field_filter)
				  ett_expanded = true;
  
			  li.data_ws_subtree = { ett: finfo['e'], expanded: ett_expanded, tree: subtree, exp: img_expanded, col: img_collapsed };
  
			  webshark_tree_sync(li.data_ws_subtree);
			  expander.addEventListener("click", webshark_tree_on_click.bind(null, li));
		  }
	  }
  
	  /* TODO: it could be set to expand by user */
	  if (level > 1)
		  ul.style.display = 'none';
  
	  return ul;
  };
  
  ProtocolTree.prototype.checkFieldFilter = function(finfo)
  {
	  if (this.field_filter == null)
		  return true;
  
	  var x = this.field_filter;
	  if (finfo['f'] && finfo['f'].indexOf(x) != -1)
		  return true;
  
	  if (finfo['l'] && finfo['l'].indexOf(x) != -1)
		  return true;
  
	  var subtree = finfo['n'];
	  if (subtree)
	  {
		  for (var i = 0; i < subtree.length; i++)
			  if (this.checkFieldFilter(subtree[i]))
				  return true;
	  }
  
	  return false;
  };
  
  ProtocolTree.prototype.setFieldFilter = function(new_filter)
  {
	  this.field_filter = new_filter;
  
	  this.render_tree();
  };
  
  ProtocolTree.prototype.render_tree = function()
  {
	  var d = this.create_subtree(this.tree, null, 1);
  
	  this.elem.innerHTML = "";
	  this.elem.appendChild(d);
  };
  
  exports.ProtocolTree = ProtocolTree;
  
  }, {"./webshark-symbols.js":10}],5: [function(require,module,exports,global){
  /* webshark-hexdump.js
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
  
  function chtoa(ch)
  {
	  return (ch > 0x1f && ch < 0x7f) ? String.fromCharCode(ch) : '.';
  }
  
  function ch_escape(ch)
  {
	  switch (ch)
	  {
		  case '&': return '&amp;';
		  case '<': return '&lt;';
		  case '>': return '&gt;';
	  }
  
	  return ch;
  }
  
  function xtoa(hex, pad)
  {
	  var str = hex.toString(16);
  
	  while (str.length < pad)
		  str = "0" + str;
  
	  return str;
  }
  
  function WSHexdump(opts)
  {
	  this.datas = null;
	  this.active= -1;
	  this.base  = opts['base'];
  
	  this.elem      = document.getElementById(opts['contentId']);
	  this.tabs_elem = document.getElementById(opts['tabsId']);
  
	  this.highlights = [ ];
	  this.tabs_btns = [ ];
  }
  
  WSHexdump.prototype.switch_tab = function(new_active, do_render)
  {
	  var prev_active = this.active;
	  var btn;
  
	  if (prev_active == new_active)
		  return;
  
	  this.active = new_active;
	  if (do_render)
		  this.render_hexdump();
  
  
	  btn = this.tabs_btns[prev_active];
	  if (btn)
		  btn.classList.remove('selected');
  
	  btn = this.tabs_btns[new_active];
	  if (btn)
		  btn.classList.add('selected');
  };
  
  WSHexdump.prototype.create_tabs = function(datas, names)
  {
	  this.datas = datas;
  
  
	  this.tabs_btns = [ ];
	  this.tabs_elem.innerHTML = '';
  
  //	if (names.length <= 1)
  //		return;
  
	  for (var i = 0; i < names.length; i++)
	  {
		  var btn = document.createElement('button');
  
		  btn.className = 'wsbutton';
		  if (i == 0)
			  btn.classList.add('selected');
		  btn.appendChild(document.createTextNode(names[i]));
  
		  btn.addEventListener("click", this.switch_tab.bind(this, i, true));
  
		  this.tabs_btns.push(btn);
		  this.tabs_elem.appendChild(btn);
	  }
  };
  
  WSHexdump.prototype.render_hexdump = function()
  {
	  var s, line;
  
	  var pkt = this.datas[this.active];
  
	  var padcount = (this.base == 2) ? 8 : (this.base == 16) ? 2 : 0;
	  var limit = (this.base == 2) ? 8 : (this.base == 16) ? 16 : 0;
  
	  var emptypadded = "  ";
	  while (emptypadded.length < padcount)
		  emptypadded = emptypadded + emptypadded;
  
	  if (limit == 0)
		  return;
  
	  var full_limit = limit;
  
	  s = "";
	  for (var i = 0; i < pkt.length; i += full_limit)
	  {
		  var str_off = "<span class='hexdump_offset'>" + xtoa(i, 4) + " </span>";
		  var str_hex = "";
		  var str_ascii = "";
  
		  var prev_class = "";
  
		  if (i + limit > pkt.length)
			  limit = pkt.length - i;
  
		  for (var j = 0; j < limit; j++)
		  {
			  var ch = pkt.charCodeAt(i + j);
  
			  var cur_class = "";
  
			  for (var k = 0; k < this.highlights.length; k++)
			  {
				  if (this.highlights[k].tab == this.active && this.highlights[k].start <= (i + j) && (i + j) < this.highlights[k].end)
				  {
					  cur_class = this.highlights[k].style;
					  break;
				  }
			  }
  
			  if (prev_class != cur_class)
			  {
				  if (prev_class != "")
				  {
					  /* close span for previous class */
					  str_ascii += "</span>";
					  str_hex += "</span>";
				  }
  
				  if (cur_class != "")
				  {
					  /* open span for new class */
					  str_hex += "<span class='" + cur_class + "'>";
					  str_ascii += "<span class='" + cur_class + "'>";
				  }
  
				  prev_class = cur_class;
			  }
  
			  str_ascii += ch_escape(chtoa(ch));
  
			  var numpad = ch.toString(this.base);
			  while (numpad.length < padcount)
				  numpad = '0' + numpad;
  
			  str_hex += numpad + " ";
		  }
  
		  if (prev_class != "")
		  {
			  str_ascii += "</span>";
			  str_hex += "</span>";
		  }
  
		  for (var j = limit; j < full_limit; j++)
		  {
			  str_hex += emptypadded + " ";
			  str_ascii += " ";
		  }
  
		  line = str_off + " " + str_hex + " " + str_ascii + "\n";
		  s += line;
	  }
  
	  this.elem.innerHTML = s;
  };
  
  exports.WSHexdump = WSHexdump;
  exports.xtoa = xtoa;
  
  }, {}],6: [function(require,module,exports,global){
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
  
  }, {}],7: [function(require,module,exports,global){
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
  
  }, {"./webshark-display-filter.js":1}],8: [function(require,module,exports,global){
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
  
  }, {"./webshark-clusterize.js":12}],9: [function(require,module,exports,global){
  /* webshark-tap.js
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
  
  var m_webshark_rtp_player_module = require("./webshark-rtp-player.js");
  var m_webshark_hexdump_module = require('./webshark-hexdump.js');
  var m_webshark_symbols_module = require("./webshark-symbols.js");
  
  var m_prev_tap_selected_on_click = null;
  
  function dom_create_label_span(str)
  {
	  var label = document.createElement("span");
  
	  label.appendChild(document.createTextNode(str));
  
	  return label;
  }
  
  function prec_trunc(x, num)
  {
	  var xnum = x * num;
	  return Math.round(xnum) / x;
  }
  
  function webshark_tap_row_on_click_common_select(node)
  {
	  if (m_prev_tap_selected_on_click)
		  m_prev_tap_selected_on_click.classList.remove("selected");
  
	  node.classList.add("selected");
	  m_prev_tap_selected_on_click = node;
  }
  
  function webshark_tap_row_on_click_analyse(node, anal)
  {
	  webshark_tap_row_on_click_common_select(node);
  
	  var tap_req =
		  {
			  req: 'tap',
			  capture: g_webshark_file,
			  tap0: anal
		  };
  
	  window.webshark.webshark_json_get(tap_req,
		  function(data)
		  {
			  var tap_table = document.getElementById('ws_tap_table');
			  var tap_extra = document.getElementById('ws_tap_details');
  
			  tap_extra.style.display = 'block';
			  tap_extra.innerHTML = "";
  
			  /* XXX< hacky, add parameters to webshark_render_tap() */
			  tap_table.id = '';
			  tap_extra.id = 'ws_tap_table';
  
			  for (var i = 0; i < data['taps'].length; i++)
				  webshark_render_tap(data['taps'][i]);
  
			  tap_table.id = 'ws_tap_table';
			  tap_extra.id = 'ws_tap_details';
		  });
  }
  
  function webshark_tap_row_on_click_filter(node, filter)
  {
	  webshark_tap_row_on_click_common_select(node);
  
	  document.getElementById('ws_packet_list_view').style.display = 'block';
	  g_webshark.setFilter(filter);
  }
  
  function webshark_tap_row_on_click_wlan(node, data_wlan_details)
  {
	  webshark_tap_row_on_click_common_select(node);
  
	  var details = data_wlan_details[0];
	  var item    = data_wlan_details[1];
  
	  var tap_table = document.getElementById('ws_tap_table');
	  var tap_extra = document.getElementById('ws_tap_details');
  
	  tap_extra.style.display = 'block';
	  tap_extra.innerHTML = "";
  
	  /* XXX< hacky, add parameters to webshark_render_tap() */
	  tap_table.id = '';
	  tap_extra.id = 'ws_tap_table';
  
	  var data =
		  {
			  type: 'fake-wlan-details',
			  items: details,
			  orig_item: item
		  };
  
	  webshark_render_tap(data);
  
	  tap_table.id = 'ws_tap_table';
	  tap_extra.id = 'ws_tap_details';
  }
  
  function webshark_tap_row_on_click_rtp(node, rtp_str, rtp_pos)
  {
	  /* don't call webshark_tap_row_on_click_common_select() wavesurfer seek callback will take care about highlighting */
  
	  var wave = m_webshark_rtp_player_module.get_from_name(rtp_str);
	  if (wave)
	  {
		  var pos = rtp_pos / wave.getDuration();
		  wave.seekAndCenter(pos);
	  }
  }
  
  var m_webshark_stat_fields =
  {
	  'name': 'Topic / Item',
	  'count': 'Count',
	  'avg': 'Average',
	  'min': 'Min val',
	  'max': 'Max val',
	  'rate': 'Rate (ms)',
	  'perc': 'Percent',
	  'burstcount': 'Burst count',
	  'burstrate': 'Burst rate',
	  'bursttime': 'Burst start'
  };
  
  var m_webshark_conv_fields =
  {
	  'saddr': 'Address A',
	  'sport': 'Port A',
	  'daddr': 'Address B',
	  'dport': 'Port B',
	  '_packets': 'Packets',
	  '_bytes': 'Bytes',
	  'txf': 'Packets A -> B',
	  'txb': 'Bytes A -> B',
	  'rxf': 'Packets A <- B',
	  'rxb': 'Bytes A <- B',
	  'start': 'Rel start',
	  '_duration': 'Duration',
	  '_rate_tx': 'bps A->B',
	  '_rate_rx': 'bps A<-B'
  };
  
  var m_webshark_host_fields =
  {
	  'host': 'Address',
	  'port': 'Port',
	  '_packets' : 'Packets',
	  '_bytes': 'Bytes',
	  'txf': 'TX Packets',
	  'txb': 'TX Bytes',
	  'rxf': 'RX Packets',
	  'rxb': 'RX Bytes'
  };
  
  var m_webshark_host_fields_geo =
  {
	  'host': 'Address',
	  'port': 'Port',
	  '_packets' : 'Packets',
	  '_bytes': 'Bytes',
	  'txf': 'TX Packets',
	  'txb': 'TX Bytes',
	  'rxf': 'RX Packets',
	  'rxb': 'RX Bytes',
	  'geoip_country': 'GeoIP Country',
	  'geoip_city': 'GeoIP City',
	  'geoip_org': 'GeoIP ORG',
	  'geoip_isp': 'GeoIP ISP',
	  'geoip_as': 'GeoIP AS',
	  'geoip_lat': 'GeoIP Lat',
	  'geoip_lon': 'GeoIP Lon'
  };
  
  var m_webshark_eo_fields =
  {
	  'pkt': 'Packet number',
	  'hostname': 'Hostname',
	  'type': 'Content Type',
	  'filename': 'Filename',
	  'len': 'Length'
  };
  
  var m_webshark_rtp_streams_fields =
  {
	  'saddr': 'Src addr',
	  'sport': 'Src port',
	  'daddr': 'Dst addr',
	  'dport': 'Dst port',
	  '_ssrc': 'SSRC',
	  'payload': 'Payload',
	  'pkts':    'Packets',
	  '_lost': 'Lost',
	  'max_delta': 'Max Delta (ms)',
	  'max_jitter': 'Max Jitter (ms)',
	  'mean_jitter': 'Mean Jitter (ms)',
	  '_pb': 'Pb?'
  };
  
  var m_webshark_rtp_analyse_fields =
  {
	  '_frame_time': 'Packet (Time)',
	  'sn': 'Sequence',
	  'd': 'Delta (ms)',
	  'j': 'Filtered jitter (ms)',
	  'sk': 'Skew (ms)',
	  'bw': 'IP BW (kbps)',
	  '_marker_str': 'Marker',
	  '_status': 'Status'
  };
  
  var m_webshark_rtd_fields =
  {
	  'type':    'Type',
	  'num':     'Messages',
	  '_min':    'Min SRT [ms]',
	  '_max':    'Max SRT [ms]',
	  '_avg':    'AVG SRT [ms]',
	  'min_frame': 'Min in Frame',
	  'max_frame': 'Max in Frame',
  
  /* optional */
	  'open_req': 'Open Requests',
	  'disc_rsp': 'Discarded Responses',
	  'req_dup':  'Duplicated Requests',
	  'rsp_dup':  'Duplicated Responses'
  };
  
  var m_webshark_srt_fields =
  {
	  'n':       'Procedure',
	  'num':     'Calls',
	  '_min':     'Min SRT [ms]',
	  '_max':     'Max SRT [ms]',
	  '_avg':    'Avg SRT [ms]'
  };
  
  var m_webshark_voip_calls_fields =
  {
	  'start':   'Start Time',
	  'stop':    'Stop Time',
	  'initial': 'Initial Speaker',
	  'from':    'From',
	  'to':      'To',
	  'proto':   'Protocol',
	  'pkts':    'Packets',
	  'state':   'State',
	  'comment': 'Comments'
  };
  
  var m_webshark_expert_fields =
  {
	  'f': 'No',
	  's': 'Severity',
	  'g': 'Group',
	  'p': 'Protocol',
	  'm': 'Summary'
  };
  
  var m_webshark_wlan_fields =
  {
	  '_bssid': "BSSID",
	  'chan':  "Ch.",
	  'ssid':  "SSID",
	  '_perc':  "% Packets",
	  't_beacon': "Beacons",
	  't_data':    "Data Packets",
	  't_probe_req': "Probe Req",
	  't_probe_resp': "Probe Resp",
	  't_auth': "Auth",
	  't_deauth': "Deauth",
	  't_other': "Other",
	  'protection': "Protection"
  };
  
  var m_webshark_wlan_details_fields =
  {
	  'araw': 'Address',
	  '_perc': '% Packets',
	  't_data_sent': 'Data Sent',
	  't_data_recv': 'Data Received',
	  't_probe_req': 'Probe Req',
	  't_probe_rsp': 'Probe Resp',
	  't_auth': 'Auth',
	  't_deauth': 'Deauth',
	  't_other': 'Other',
	  '_comment': 'Comment'
  };
  
  function webshark_create_tap_table_data_common(fields, table, data)
  {
	  for (var i = 0; i < data.length; i++)
	  {
		  var val = data[i];
  
		  var tr = document.createElement('tr');
  
		  tr.appendChild(webshark_create_tap_action_common(val));
  
		  for (var col in fields)
		  {
			  var value = val[col];
  
			  /* TODO, hide fields which are undefined for whole table */
			  if (value == undefined)
				  value = '-';
  
			  var td = document.createElement('td');
			  td.appendChild(document.createTextNode(value));
			  td.className = "ws_border";
			  tr.appendChild(td);
		  }
  
		  if (val['_css_class'])
		  {
			  tr.className = val['_css_class'];
		  }
  
		  if (val['_wlan_extra_data'] != undefined)
		  {
			  tr.addEventListener("click", webshark_tap_row_on_click_wlan.bind(null, tr, val['_wlan_extra_data']));
		  }
		  else if (val['_rtp_goto'] != undefined)
		  {
			  var node_rtp = window.webshark.dom_find_node_attr(table, 'data_ws_rtp_name');
  
			  if (node_rtp)
			  {
				  var rtp_str = node_rtp['data_ws_rtp_name'];
  
				  tr.addEventListener("click", webshark_tap_row_on_click_rtp.bind(null, tr, rtp_str, val['_rtp_goto']));
			  }
		  }
		  else if (val['_analyse'])
		  {
			  tr.addEventListener("click", webshark_tap_row_on_click_analyse.bind(null, tr, val['_analyse']));
		  }
		  else if (val['_filter'])
		  {
			  tr.addEventListener("click", webshark_tap_row_on_click_filter.bind(null, tr, val['_filter']));
		  }
  
		  table.appendChild(tr);
	  }
  }
  
  function webshark_create_tap_action_common(data)
  {
	  var td = document.createElement('td');
  
	  if (data['_analyse'])
	  {
		  var anal_a = document.createElement('a');
  
		  anal_a.setAttribute("target", "_blank");
		  anal_a.setAttribute("href", window.webshark.webshark_create_url(
			  {
				  file: g_webshark_file,
				  tap: data['_analyse']
			  }));
		  anal_a.addEventListener("click", window.webshark.popup_on_click_a);
  
		  var glyph = m_webshark_symbols_module.webshark_glyph_img('analyse', 16);
		  glyph.setAttribute('alt', 'Details: ' + data['_analyse']);
		  glyph.setAttribute('title', 'Details: ' + data['_analyse']);
  
		  anal_a.appendChild(glyph);
		  td.appendChild(anal_a);
	  }
  
	  if (data['_filter'])
	  {
		  var filter_a = document.createElement('a');
  
		  filter_a.setAttribute("target", "_blank");
		  filter_a.setAttribute("href", window.webshark.webshark_create_url(
			  {
				  file: g_webshark_file,
				  filter: data['_filter']
			  }));
		  filter_a.addEventListener("click", window.webshark.popup_on_click_a);
  
		  var glyph = m_webshark_symbols_module.webshark_glyph_img('filter', 16);
		  glyph.setAttribute('alt', 'Filter: ' + data['_filter']);
		  glyph.setAttribute('title', 'Filter: ' + data['_filter']);
  
		  filter_a.appendChild(glyph);
		  td.appendChild(filter_a);
	  }
  
	  if (data['_goto_frame'])
	  {
		  var show_a = document.createElement('a');
  
		  show_a.setAttribute("target", "_blank");
		  show_a.setAttribute("href", window.webshark.webshark_create_url(
			  {
				  file: g_webshark_file,
				  frame: data['_goto_frame']
			  }));
		  show_a.addEventListener("click", window.webshark.popup_on_click_a);
  
		  var glyph = m_webshark_symbols_module.webshark_glyph_img('analyse', 16);
		  glyph.setAttribute('alt', 'Load frame: ' + data['_filter']);
		  glyph.setAttribute('title', 'Load frame: ' + data['_filter']);
  
		  show_a.appendChild(glyph);
		  td.appendChild(show_a);
	  }
  
	  if (data['_download'])
	  {
		  var down_a = document.createElement('a');
  
		  down_a.setAttribute("target", "_blank");
		  down_a.setAttribute("href", window.webshark.webshark_create_api_url(
			  {
				  req: 'download',
				  capture: g_webshark_file,
				  token: data['_download']
			  }));
		  down_a.addEventListener("click", window.webshark.popup_on_click_a);
  
		  var glyph = m_webshark_symbols_module.webshark_glyph_img('download', 16);
		  glyph.setAttribute('alt', 'Download: ' + data['_download']);
		  glyph.setAttribute('title', 'Download: ' + data['_download']);
  
		  down_a.appendChild(glyph);
		  td.appendChild(down_a);
	  }
  
	  if (data['_play'])
	  {
		  var down_a = document.createElement('a');
  
		  var descr = data['_play_descr'];
		  if (!descr)
			  descr = data['_play'];
  
		  down_a.setAttribute("target", "_blank");
		  down_a["ws_title"] = descr;
		  down_a["ws_rtp"] = data['_play'];
		  down_a.setAttribute("href", window.webshark.webshark_create_api_url(
			  {
				  req: 'download',
				  capture: g_webshark_file,
				  token: data['_play']
			  }));
		  down_a.addEventListener("click", m_webshark_rtp_player_module.play_on_click_a);
  
		  var glyph = m_webshark_symbols_module.webshark_glyph_img('play', 16);
		  glyph.setAttribute('alt', 'Load and play RTP: ' + descr);
		  glyph.setAttribute('title', 'Load and play RTP: ' + descr);
  
		  down_a.appendChild(glyph);
		  td.appendChild(down_a);
	  }
  
	  td.className = "ws_border";
  
	  return td;
  }
  
  function webshark_create_tap_table_common(fields)
  {
	  var table = document.createElement('table');
	  var tr;
  
	  tr = document.createElement('tr');
  
	  {
		  var td = document.createElement('td');
  
		  td.appendChild(document.createTextNode('Actions'));
		  td.className = "ws_border";
		  tr.appendChild(td);
	  }
  
	  for (var col in fields)
	  {
		  var td = document.createElement('td');
  
		  td.appendChild(document.createTextNode(fields[col]));
		  td.className = "ws_border";
		  tr.appendChild(td);
	  }
	  tr.className = "header";
  
	  table.className = "ws_border";
	  table.setAttribute('width', '100%');
  
	  table.appendChild(tr);
	  return table;
  }
  
  function webshark_create_tap_stat(table, stats, level)
  {
	  for (var i = 0; i < stats.length; i++)
	  {
		  var stat = stats[i];
		  var val = stat['vals'];
  
		  var tr = document.createElement('tr');
  
		  tr.appendChild(webshark_create_tap_action_common(stat));
  
		  for (var col in m_webshark_stat_fields)
		  {
			  var value = stat[col];
  
			  /* TODO, hide fields which are undefined for whole table */
			  if (value == undefined)
				  value = '-';
			  else if (col == 'perc')
				  value = value + '%';
  
			  var td = document.createElement('td');
			  td.appendChild(document.createTextNode(value));
			  tr.appendChild(td);
			  td.className = "ws_border";
		  }
  
		  {
			  var td = document.createElement('td');
			  td.appendChild(document.createTextNode(level));
			  tr.appendChild(td);
		  }
  
		  table.appendChild(tr);
  
		  if (stat['sub'])
			  webshark_create_tap_stat(table, stat['sub'], level + 1);
	  }
  }
  
  function webshark_render_tap(tap)
  {
	  if (tap['type'] == 'stats')
	  {
		  var table = webshark_create_tap_table_common(m_webshark_stat_fields);
  
		  webshark_create_tap_stat(table, tap['stats'], 0);
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label("Stats TAP: " + tap['name']));
		  document.getElementById('ws_tap_table').appendChild(table);
  
		  var tg_stat = tap['stats'][0];
  
  //		TODO: generate more graphs tg_stat = tg_stat['sub'][0];
  
		  var chart_width = Math.max(800, 50 * tg_stat['sub'].length);
  
		  var div = document.createElement('div');
		  document.getElementById('ws_tap_graph').appendChild(div);
  
		  var f_count = tg_stat['count'];
		  if (f_count > 0)
		  {
			  for (var i = 0; i < tg_stat['sub'].length; i++)
			  {
				  var item = tg_stat['sub'][i];
  
				  item['_perc'] = item['count'] / f_count;
			  }
		  }
  
		  var chart = c3.generate({
			  bindto: div,
			  size: { width: chart_width, height: 400 },
			  legend: { position: 'inset', hide: true },
  
			  title: { text: tg_stat['name'] },
			  data: {
				  json: tg_stat['sub'],
  
				  keys: {
					  x: 'name',
					  value: [ '_perc', 'count' ]
				  },
				  names: {
					  _perc: 'Count',
					  count: 'Count'
				  },
				  colors: {
					  _perc: 'steelblue',
					  count: 'steelblue'
				  },
				  axes: {
					  _perc: 'y',
					  count: 'y2'
				  },
				  type: 'bar',
				  hide: [ 'count' ]
			  },
			  axis: {
				  x: {
					  type: 'category'
				  },
				  y: {
					  // XXX, it was so easy in d3: d3.axisLeft(y).ticks(10, '%')
					  // max: 1,
					  tick: {
						  format: d3.format('.0%'),
						  values: [0.0, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00 ]
						  // count: 12
					  }
				  },
				  y2: {
					  show: true
				  }
			  },
			  tooltip: {
				  format: {
					  value: function (value, ratio, id) {
						  var format = d3.format('%');
						  var real_value = (value * f_count); // XXX, find a better way.
						  return real_value + " (" +  format(value) + ")";
					  }
				  }
			  }
		  });
  
		  div.style.border = '1px solid black';
		  div.style.width = (chart_width + 10) + "px";
	  }
	  else if (tap['type'] == 'conv')
	  {
		  var table = webshark_create_tap_table_common(m_webshark_conv_fields);
		  var convs = tap['convs'];
  
		  for (var i = 0; i < convs.length; i++)
		  {
			  var conv = convs[i];
  
			  if (conv['sport'])
			  {
				  conv['_sname'] = conv['saddr'] + ':' + conv['sport'];
				  conv['_dname'] = conv['daddr'] + ':' + conv['dport'];
			  }
			  else
			  {
				  conv['_sname'] = conv['saddr'];
				  conv['_dname'] = conv['daddr'];
			  }
  
			  conv['_name'] = conv['_sname'] + " <===>" + conv['_dname'];
  
			  conv['_packets']  = conv['rxf'] + conv['txf'];
			  conv['_bytes']    = conv['rxb'] + conv['txb'];
			  conv['_duration'] = conv['stop'] - conv['start'];
			  conv['_rate_tx'] = (8 * conv['txb']) / conv['_duration'];
			  conv['_rate_rx'] = (8 * conv['rxb']) / conv['_duration'];
  
			  conv['_filter'] = conv['filter'];
		  }
  
		  webshark_create_tap_table_data_common(m_webshark_conv_fields, table, convs);
		  if (tap['geoip'] == true)
		  {
			  /* From http://dev.maxmind.com/geoip/geoip2/geolite2/ */
			  var p = document.createElement('p');
			  p.innerHTML = 'Webshark includes GeoLite2 data created by MaxMind, available from <a href="http://www.maxmind.com">http://www.maxmind.com</a>.';
  
			  document.getElementById('ws_tap_table').appendChild(p);
  
			  var link = "ipmap.html#" + window.btoa(JSON.stringify({'c': convs}));
			  var iframe = document.createElement('iframe');
			  iframe.frameBorder = 0;
			  iframe.setAttribute("src", link);
			  iframe.height = "100%";
			  iframe.width = "100%";
  
			  document.getElementById('ws_tap_extra').style.display = 'block';
			  document.getElementById('ws_tap_extra').appendChild(iframe);
		  }
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label(tap['proto'] + ' Conversations (' + convs.length + ')'));
		  document.getElementById('ws_tap_table').appendChild(table);
  
		  var divs = document.createElement('div');
		  document.getElementById('ws_tap_graph').appendChild(divs);
  
		  var div = document.createElement('div');
		  divs.appendChild(div);
  
		  var charts_width = Math.max(500, 220 * convs.length);
  
		  var chart = c3.generate({
			  bindto: div,
			  size: { width: charts_width, height: 400 },
			  legend: { position: 'inset', hide: true },
  
			  title: { text: tap['proto'] + ' Conversations - Frames Count' },
			  data: {
				  json: convs,
				  keys: {
					  x: '_name',
					  value: ['rxf', 'txf']
				  },
				  names: {
					  rxf: 'RX frames',
					  txf: 'TX frames'
				  },
				  colors: {
					  rxf: '#d62728',
					  txf: '#2ca02c'
				  },
				  axes: {
					  rxf: 'y2',
					  txf: 'y2'
				  },
				  type: 'bar'
			  },
			  axis: {
				  x: {
					  type: 'category'
				  },
				  y: {
					  show: false
				  },
				  y2: {
					  show: true
				  }
			  }
		  });
		  div.style.border = '1px solid black';
		  div.style.width = (charts_width + 10) + "px";
		  div.style.float = 'left';
  
		  var div = document.createElement('div');
		  divs.appendChild(div);
  
		  var chart = c3.generate({
			  bindto: div,
			  size: { width: charts_width, height: 400 },
			  legend: { position: 'inset', hide: true },
  
			  title: { text: tap['proto'] + ' Conversations - Bytes Count' },
			  data: {
				  json: convs,
				  keys: {
					  x: '_name',
					  value: ['rxb', 'txb']
				  },
				  names: {
					  rxb: 'RX bytes',
					  txb: 'TX bytes'
				  },
				  colors: {
					  rxb: '#d62728',
					  txb: '#2ca02c'
				  },
				  type: 'bar'
			  },
			  axis: {
				  x: {
					  type: 'category'
				  }
			  }
		  });
		  div.style.border = '1px solid black';
		  div.style.width = (charts_width + 10) + "px";
		  div.style.float = 'left';
	  }
	  else if (tap['type'] == 'host')
	  {
		  var host_fields = (tap['geoip'] == true) ? m_webshark_host_fields_geo : m_webshark_host_fields;
  
		  var table = webshark_create_tap_table_common(host_fields);
		  var hosts = tap['hosts'];
  
		  for (var i = 0; i < hosts.length; i++)
		  {
			  var host = hosts[i];
			  if (host['port'])
				  host['_name'] = host['host'] + ':' + host['port'];
			  else
				  host['_name'] = host['host'];
  
			  host['_packets']  = host['rxf'] + host['txf'];
			  host['_bytes']    = host['rxb'] + host['txb'];
			  host['_filter']   = host['filter'];
		  }
  
		  webshark_create_tap_table_data_common(host_fields, table, hosts);
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label(tap['proto'] + ' Endpoints (' + hosts.length + ')'));
		  if (tap['geoip'] == true)
		  {
			  /* From http://dev.maxmind.com/geoip/geoip2/geolite2/ */
			  var p = document.createElement('p');
			  p.innerHTML = 'Webshark includes GeoLite2 data created by MaxMind, available from <a href="http://www.maxmind.com">http://www.maxmind.com</a>.';
  
			  document.getElementById('ws_tap_table').appendChild(p);
  
			  var link = "ipmap.html#" + window.btoa(JSON.stringify({'h': hosts}));
			  var iframe = document.createElement('iframe');
			  iframe.frameBorder = 0;
			  iframe.setAttribute("src", link);
			  iframe.height = "100%";
			  iframe.width = "100%";
  
			  document.getElementById('ws_tap_extra').style.display = 'block';
			  document.getElementById('ws_tap_extra').appendChild(iframe);
		  }
  
		  document.getElementById('ws_tap_table').appendChild(table);
  
		  var divs = document.createElement('div');
		  document.getElementById('ws_tap_graph').appendChild(divs);
  
		  var div = document.createElement('div');
		  divs.appendChild(div);
  
		  var charts_width = Math.max(400, 110 * hosts.length);
  
		  var chart = c3.generate({
			  bindto: div,
			  size: { width: charts_width, height: 400 },
			  legend: { position: 'inset', hide: true },
  
			  title: { text: tap['proto'] + ' Endpoints - Frames Count' },
			  data: {
				  json: hosts,
				  keys: {
					  x: '_name',
					  value: ['rxf', 'txf']
				  },
				  names: {
					  rxf: 'RX frames',
					  txf: 'TX frames'
				  },
				  colors: {
					  rxf: '#d62728',
					  txf: '#2ca02c'
				  },
				  axes: {
					  rxf: 'y2',
					  txf: 'y2'
				  },
				  type: 'bar'
			  },
			  axis: {
				  x: {
					  type: 'category'
				  },
				  y: {
					  show: false
				  },
				  y2: {
					  show: true
				  }
			  }
		  });
		  div.style.border = '1px solid black';
		  div.style.width = (charts_width + 10) + "px";
		  div.style.float = 'left';
  
		  var div = document.createElement('div');
		  divs.appendChild(div);
  
		  var chart = c3.generate({
			  bindto: div,
			  size: { width: charts_width, height: 400 },
			  legend: { position: 'inset', hide: true },
  
			  title: { text: tap['proto'] + ' Endpoints - Bytes Count' },
			  data: {
				  json: hosts,
				  keys: {
					  x: '_name',
					  value: ['rxb', 'txb']
				  },
				  names: {
					  rxb: 'RX bytes',
					  txb: 'TX bytes'
				  },
				  colors: {
					  rxb: '#d62728',
					  txb: '#2ca02c'
				  },
				  type: 'bar'
			  },
			  axis: {
				  x: {
					  type: 'category'
				  }
			  }
		  });
		  div.style.border = '1px solid black';
		  div.style.width = (charts_width + 10) + "px";
		  div.style.float = 'left';
	  }
	  else if (tap['type'] == 'flow')
	  {
		  var webshark_tap_flow = require("./webshark-tap-flow.js");
  
		  webshark_tap_flow.tap_report(tap);
	  }
	  else if (tap['type'] == 'nstat')
	  {
		  var nstat_fields = tap['fields'];
		  var nstat_tables = tap['tables'];
  
		  var fields = { };
  
		  for (var i = 0; i < nstat_fields.length; i++)
		  {
			  fields['' + i] = nstat_fields[i]['c'];
		  }
  
		  for (var i = 0; i < nstat_tables.length; i++)
		  {
			  var nstat_table = tap['tables'][i];
  
			  var table = webshark_create_tap_table_common(fields);
  
			  webshark_create_tap_table_data_common(fields, table, nstat_table['i']);
  
			  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label('Statistics (' + nstat_table['t'] + ') '));
  
			  document.getElementById('ws_tap_table').appendChild(table);
		  }
  
	  }
	  else if (tap['type'] == 'rtd')
	  {
		  var table = webshark_create_tap_table_common(m_webshark_rtd_fields);
  
		  var rtd_stats = tap['stats'];
  
		  for (var i = 0; i < rtd_stats.length; i++)
		  {
			  var row = rtd_stats[i];
  
			  row['_min'] = prec_trunc(100, row['min'] * 1000.0);
			  row['_max'] = prec_trunc(100, row['max'] * 1000.0);
			  row['_avg'] = prec_trunc(100, (row['tot'] / row['num']) * 1000.0);
  
			  /* TODO: calculate % if row['open_req'] */
		  }
  
		  webshark_create_tap_table_data_common(m_webshark_rtd_fields, table, rtd_stats);
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label('Response Time Delay (' + tap['tap'] + ') '));
  
		  if (tap['open_req'] != undefined)
		  {
			  var rdiv = document.createElement('div');
			  rdiv.appendChild(dom_create_label_span("Open Requests: " + tap['open_req']));
			  rdiv.appendChild(dom_create_label_span(", Discarded Responses: " + tap['disc_rsp']));
			  rdiv.appendChild(dom_create_label_span(", Duplicated Requests: " + tap['req_dup']));
			  rdiv.appendChild(dom_create_label_span(", Duplicated Responses: " + tap['rsp_dup']));
  
			  document.getElementById('ws_tap_table').appendChild(rdiv);
		  }
  
		  document.getElementById('ws_tap_table').appendChild(table);
  
	  }
	  else if (tap['type'] == 'srt')
	  {
		  var srt_tables = tap['tables'];
  
		  for (var i = 0; i < srt_tables.length; i++)
		  {
			  var rows = srt_tables[i]['r'];
			  var filter = srt_tables[i]['f'];
  
			  var table = webshark_create_tap_table_common(m_webshark_srt_fields);
  
			  for (var j = 0; j < rows.length; j++)
			  {
				  var row = rows[j];
  
				  row['_min'] = prec_trunc(100, row['min'] * 1000.0);
				  row['_max'] = prec_trunc(100, row['max'] * 1000.0);
				  row['_avg'] = prec_trunc(100, (row['tot'] / row['num']) * 1000);
  
				  if (filter)
				  {
					  row['_filter'] = filter + ' == ' + row['idx'];
				  }
			  }
  
			  webshark_create_tap_table_data_common(m_webshark_srt_fields, table, rows);
  
			  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label('Service Response Time (' + tap['tap'] + ') ' + srt_tables[i]['n']));
			  document.getElementById('ws_tap_table').appendChild(table);
		  }
	  }
	  else if (tap['type'] == 'eo')
	  {
		  var table = webshark_create_tap_table_common(m_webshark_eo_fields);
		  var objects = tap['objects'];
  
		  webshark_create_tap_table_data_common(m_webshark_eo_fields, table, objects);
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label("Export " + tap['proto'] + " object (" + objects.length + ')'));
		  document.getElementById('ws_tap_table').appendChild(table);
	  }
	  else if (tap['type'] == 'voip-calls')
	  {
		  var table = webshark_create_tap_table_common(m_webshark_voip_calls_fields);
		  var calls = tap['calls'];
  
		  for (var i = 0; i < calls.length; i++)
		  {
			  var call = calls[i];
  
			  /* TODO, generate comment for VOIP_ISUP, VOIP_H323 */
  
			  call['_filter'] = call['filter'];
		  }
  
		  webshark_create_tap_table_data_common(m_webshark_voip_calls_fields, table, calls);
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label("VoIP calls (" + calls.length + ')'));
		  document.getElementById('ws_tap_table').appendChild(table);
	  }
	  else if (tap['type'] == 'expert')
	  {
		  var table = webshark_create_tap_table_common(m_webshark_expert_fields);
		  var details = tap['details'];
  
		  for (var i = 0; i < details.length; i++)
		  {
			  var item = details[i];
  
			  if (item['s'])
			  {
				  item['_css_class'] = 'ws_cell_expert_color_' + item['s'];
			  }
  
			  item['_goto_frame'] = item['f'];
		  }
  
		  webshark_create_tap_table_data_common(m_webshark_expert_fields, table, details);
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label("Expert information (" + details.length + ')'));
		  document.getElementById('ws_tap_table').appendChild(table);
	  }
	  else if (tap['type'] == 'wlan')
	  {
		  var table = webshark_create_tap_table_common(m_webshark_wlan_fields);
		  var list = tap['list'];
  
		  list.sort(function(a, b)
		  {
			  var pkta = a['packets'], pktb = b['packets'];
  
			  return pkta < pktb ? 1 : -1;
		  });
  
		  for (var i = 0; i < list.length; i++)
		  {
			  var item = list[i];
  
			  item['_bssid']  = (item['bname'] ? item['bname'] : item['braw']);
			  item['_filter'] = "wlan.bssid == " + item['braw'];
			  item['_perc']  = prec_trunc(100, 100 * (item['packets'] / tap['packets'])) + '%';
  
			  item['_wlan_extra_data'] = [ item['details'], item ];
		  }
  
		  webshark_create_tap_table_data_common(m_webshark_wlan_fields, table, list);
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label("WLAN Traffic Statistics"));
		  document.getElementById('ws_tap_table').appendChild(table);
	  }
	  else if (tap['type'] == 'fake-wlan-details')
	  {
		  var list = tap['items'];
		  var orig_item = tap['orig_item'];
  
		  var orig_item_packet_total = orig_item['packets'] - orig_item['t_beacon'];
  
		  list.sort(function(a, b)
		  {
			  var pkta = a['packets'], pktb = b['packets'];
  
			  return pkta < pktb ? 1 : -1;
		  });
  
		  for (var i = 0; i < list.length; i++)
		  {
			  var item = list[i];
  
			  if (orig_item_packet_total)
				  item['_perc'] = prec_trunc(100, 100 * (item['packets'] / orig_item_packet_total)) + '%';
			  else
				  item['_perc'] = prec_trunc(100, 0) + '%';
  
			  if (item['araw'] == 'ff:ff:ff:ff:ff:ff')
				  item['_comment'] = 'Broadcast';
			  else if (orig_item['braw'] == item['araw'])
				  item['_comment'] = 'Base station';
			  else
				  item['_comment'] = '';
		  }
  
		  var table = webshark_create_tap_table_common(m_webshark_wlan_details_fields);
  
		  webshark_create_tap_table_data_common(m_webshark_wlan_details_fields, table, list);
  
		  document.getElementById('ws_tap_table').appendChild(table);
	  }
	  else if (tap['type'] == 'rtp-streams')
	  {
		  var table = webshark_create_tap_table_common(m_webshark_rtp_streams_fields);
		  var streams = tap['streams'];
  
		  for (var i = 0; i < streams.length; i++)
		  {
			  var stream = streams[i];
  
			  stream['_ssrc'] = "0x" + m_webshark_hexdump_module.xtoa(stream['ssrc'], 0);
			  stream['_pb'] = stream['problem'] ? "X" : "";
  
			  var lost = stream['expectednr'] - stream['totalnr'];
  
			  stream['_lost'] = "" + lost + "(" + 100 * (lost / stream['expectednr']) + " %)";
  
			  var ipstr = "ip";
			  if (stream['ipver'] == 6) ipstr = "ipv6";
  
			  var rtp_str = stream['saddr'] + '_' + stream['sport'] + '_' + stream['daddr'] + '_' + stream['dport'] + '_' + m_webshark_hexdump_module.xtoa(stream['ssrc'], 0);
  
			  stream['_analyse'] = 'rtp-analyse:' + rtp_str;
			  stream['_download'] = 'rtp:' + rtp_str;
			  stream['_play'] = stream['_download'];
			  stream['_play_descr'] = '[' + stream['saddr'] + ']:' + stream['sport'] + ' -> [' + stream['daddr'] + ']:' + stream['dport'] + " SSRC: " + stream['_ssrc'] + ' ' + stream['payload'];
  
			  stream['_filter'] = "(" + ipstr + ".src == " + stream['saddr'] + " && udp.srcport == " + stream['sport'] + " && " +
										ipstr + ".dst == " + stream['daddr'] + " && udp.dstport == " + stream['dport'] + " && " +
										"rtp.ssrc == " + stream['_ssrc'] +
								  ")";
		  }
  
		  var wave_div = document.createElement('div');
		  wave_div.id = 'ws_rtp_playback';
		  m_webshark_rtp_player_module.ws_rtp_playback_control_create(wave_div, null);
  
		  webshark_create_tap_table_data_common(m_webshark_rtp_streams_fields, table, streams);
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label("RTP streams (" + streams.length + ')'));
		  document.getElementById('ws_tap_table').appendChild(table);
		  document.getElementById('ws_tap_table').appendChild(wave_div);
	  }
	  else if (tap['type'] == 'rtp-analyse')
	  {
		  var table = webshark_create_tap_table_common(m_webshark_rtp_analyse_fields);
		  var items = tap['items'];
  
		  var rtp_str = "rtp:" + tap['tap'].slice(12);
  
		  for (var i = 0; i < items.length; i++)
		  {
			  var item = items[i];
  
			  item['_frame_time'] = item['f'] + ' (' + item['o'] + ')';
			  item['_marker_str'] = (item['mark'] == 1) ? "Set" : "";
  
			  if (item['s'])
				  item['_status'] = item['s'];
			  else
				  item['_status'] = '[ OK ]';
  
			  item['_rtp_goto'] = item['o'];
			  item['_goto_frame'] = item['f'];
		  }
  
		  table['data_ws_rtp_name'] = rtp_str;
  
		  m_webshark_rtp_player_module.set_in_table(rtp_str, [ items, table, null ]);
		  webshark_create_tap_table_data_common(m_webshark_rtp_analyse_fields, table, items);
  
		  document.getElementById('ws_tap_table').appendChild(window.webshark.dom_create_label("RTP analysis"));
		  {
			  var rdiv = document.createElement('div');
  
			  rdiv.appendChild(dom_create_label_span("SSRC: 0x" + m_webshark_hexdump_module.xtoa(tap['ssrc'], 0)));
  
			  rdiv.appendChild(dom_create_label_span(", Max Delta: " + tap['max_delta'] + ' ms @ ' + tap['max_delta_nr']));
			  rdiv.appendChild(dom_create_label_span(", Max Jitter: " + tap['max_jitter'] + " ms"));
			  rdiv.appendChild(dom_create_label_span(", Mean Jitter: " + tap['mean_jitter'] + " ms"));
			  rdiv.appendChild(dom_create_label_span(", Max Skew: " + tap['max_skew'] + " ms"));
			  rdiv.appendChild(dom_create_label_span(", RTP Packets: " + tap['total_nr']));
			  rdiv.appendChild(dom_create_label_span(", Seq Errs: " + tap['seq_err']));
			  rdiv.appendChild(dom_create_label_span(", Duration: " + prec_trunc(1000, tap['duration'] / 1000) + " s"));
			  document.getElementById('ws_tap_table').appendChild(rdiv);
		  }
		  document.getElementById('ws_tap_table').appendChild(table);
	  }
  }
  
  function webshark_load_tap(taps)
  {
	  var tap_req =
		  {
			  req: 'tap',
			  capture: g_webshark_file
		  };
  
	  for (var i = 0; i < taps.length; i++)
		  tap_req["tap" + i] = taps[i];
  
	  window.webshark.webshark_json_get(tap_req,
		  function(data)
		  {
			  for (var i = 0; i < data['taps'].length; i++)
				  webshark_render_tap(data['taps'][i]);
		  });
  }
  
  exports.webshark_load_tap = webshark_load_tap;
  
  }, {"./webshark-rtp-player.js":13,"./webshark-hexdump.js":5,"./webshark-symbols.js":10,"./webshark-tap-flow.js":14}],10: [function(require,module,exports,global){
  /* webshark-symbols.js
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
  
  var m_glyph_cache = { };
  
  function webshark_glyph(what)
  {
	  if (m_glyph_cache[what])
		  return m_glyph_cache[what];
  
	  var fa_paths =
	  {
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/eye.svg */
		  'analyse': "M1664 960q-152-236-381-353 61 104 61 225 0 185-131.5 316.5t-316.5 131.5-316.5-131.5-131.5-316.5q0-121 61-225-229 117-381 353 133 205 333.5 326.5t434.5 121.5 434.5-121.5 333.5-326.5zm-720-384q0-20-14-34t-34-14q-125 0-214.5 89.5t-89.5 214.5q0 20 14 34t34 14 34-14 14-34q0-86 61-147t147-61q20 0 34-14t14-34zm848 384q0 34-20 69-140 230-376.5 368.5t-499.5 138.5-499.5-139-376.5-368q-20-35-20-69t20-69q140-229 376.5-368t499.5-139 499.5 139 376.5 368q20 35 20 69z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/comment-o.svg */
		  'comment': 'M896 384q-204 0-381.5 69.5t-282 187.5-104.5 255q0 112 71.5 213.5t201.5 175.5l87 50-27 96q-24 91-70 172 152-63 275-171l43-38 57 6q69 8 130 8 204 0 381.5-69.5t282-187.5 104.5-255-104.5-255-282-187.5-381.5-69.5zm896 512q0 174-120 321.5t-326 233-450 85.5q-70 0-145-8-198 175-460 242-49 14-114 22h-5q-15 0-27-10.5t-16-27.5v-1q-3-4-.5-12t2-10 4.5-9.5l6-9 7-8.5 8-9q7-8 31-34.5t34.5-38 31-39.5 32.5-51 27-59 26-76q-157-89-247.5-220t-90.5-281q0-174 120-321.5t326-233 450-85.5 450 85.5 326 233 120 321.5z',
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/clock-o.svg */
		  'timeref': 'M1024 544v448q0 14-9 23t-23 9h-320q-14 0-23-9t-9-23v-64q0-14 9-23t23-9h224v-352q0-14 9-23t23-9h64q14 0 23 9t9 23zm416 352q0-148-73-273t-198-198-273-73-273 73-198 198-73 273 73 273 198 198 273 73 273-73 198-198 73-273zm224 0q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z',
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/caret-right.svg */
		  'collapsed': "M1152 896q0 26-19 45l-448 448q-19 19-45 19t-45-19-19-45v-896q0-26 19-45t45-19 45 19l448 448q19 19 19 45z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/caret-down.svg */
		  'expanded': "M1408 704q0 26-19 45l-448 448q-19 19-45 19t-45-19l-448-448q-19-19-19-45t19-45 45-19h896q26 0 45 19t19 45z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/filter.svg */
		  'filter': "M1595 295q17 41-14 70l-493 493v742q0 42-39 59-13 5-25 5-27 0-45-19l-256-256q-19-19-19-45v-486l-493-493q-31-29-14-70 17-39 59-39h1280q42 0 59 39z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/files-o.svg */
		  'files': "M1696 384q40 0 68 28t28 68v1216q0 40-28 68t-68 28h-960q-40 0-68-28t-28-68v-288h-544q-40 0-68-28t-28-68v-672q0-40 20-88t48-76l408-408q28-28 76-48t88-20h416q40 0 68 28t28 68v328q68-40 128-40h416zm-544 213l-299 299h299v-299zm-640-384l-299 299h299v-299zm196 647l316-316v-416h-384v416q0 40-28 68t-68 28h-416v640h512v-256q0-40 20-88t48-76zm956 804v-1152h-384v416q0 40-28 68t-68 28h-416v640h896z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/folder-o.svg */
		  'folder': "M1600 1312v-704q0-40-28-68t-68-28h-704q-40 0-68-28t-28-68v-64q0-40-28-68t-68-28h-320q-40 0-68 28t-28 68v960q0 40 28 68t68 28h1216q40 0 68-28t28-68zm128-704v704q0 92-66 158t-158 66h-1216q-92 0-158-66t-66-158v-960q0-92 66-158t158-66h320q92 0 158 66t66 158v32h672q92 0 158 66t66 158z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/folder-open-o.svg */
		  'pfolder': "M1845 931q0-35-53-35h-1088q-40 0-85.5 21.5t-71.5 52.5l-294 363q-18 24-18 40 0 35 53 35h1088q40 0 86-22t71-53l294-363q18-22 18-39zm-1141-163h768v-160q0-40-28-68t-68-28h-576q-40 0-68-28t-28-68v-64q0-40-28-68t-68-28h-320q-40 0-68 28t-28 68v853l256-315q44-53 116-87.5t140-34.5zm1269 163q0 62-46 120l-295 363q-43 53-116 87.5t-140 34.5h-1088q-92 0-158-66t-66-158v-960q0-92 66-158t158-66h320q92 0 158 66t66 158v32h544q92 0 158 66t66 158v160h192q54 0 99 24.5t67 70.5q15 32 15 68z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/play.svg */
		  'play': "M1576 927l-1328 738q-23 13-39.5 3t-16.5-36v-1472q0-26 16.5-36t39.5 3l1328 738q23 13 23 31t-23 31z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/stop.svg */
		  'stop': "M1664 192v1408q0 26-19 45t-45 19h-1408q-26 0-45-19t-19-45v-1408q0-26 19-45t45-19h1408q26 0 45 19t19 45z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/sliders.svg */
		  'settings': "M480 1408v128h-352v-128h352zm352-128q26 0 45 19t19 45v256q0 26-19 45t-45 19h-256q-26 0-45-19t-19-45v-256q0-26 19-45t45-19h256zm160-384v128h-864v-128h864zm-640-512v128h-224v-128h224zm1312 1024v128h-736v-128h736zm-960-1152q26 0 45 19t19 45v256q0 26-19 45t-45 19h-256q-26 0-45-19t-19-45v-256q0-26 19-45t45-19h256zm640 512q26 0 45 19t19 45v256q0 26-19 45t-45 19h-256q-26 0-45-19t-19-45v-256q0-26 19-45t45-19h256zm320 128v128h-224v-128h224zm0-512v128h-864v-128h864z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/upload.svg */
		  'upload': "M1344 1472q0-26-19-45t-45-19-45 19-19 45 19 45 45 19 45-19 19-45zm256 0q0-26-19-45t-45-19-45 19-19 45 19 45 45 19 45-19 19-45zm128-224v320q0 40-28 68t-68 28h-1472q-40 0-68-28t-28-68v-320q0-40 28-68t68-28h427q21 56 70.5 92t110.5 36h256q61 0 110.5-36t70.5-92h427q40 0 68 28t28 68zm-325-648q-17 40-59 40h-256v448q0 26-19 45t-45 19h-256q-26 0-45-19t-19-45v-448h-256q-42 0-59-40-17-39 14-69l448-448q18-19 45-19t45 19l448 448q31 30 14 69z",
		  /* https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/black/svg/download.svg */
		  'download': "M1344 1344q0-26-19-45t-45-19-45 19-19 45 19 45 45 19 45-19 19-45zm256 0q0-26-19-45t-45-19-45 19-19 45 19 45 45 19 45-19 19-45zm128-224v320q0 40-28 68t-68 28h-1472q-40 0-68-28t-28-68v-320q0-40 28-68t68-28h465l135 136q58 56 136 56t136-56l136-136h464q40 0 68 28t28 68zm-325-569q17 41-14 70l-448 448q-18 19-45 19t-45-19l-448-448q-31-29-14-70 17-39 59-39h256v-448q0-26 19-45t45-19h256q26 0 45 19t19 45v448h256q42 0 59 39z"
	  };
  
	  var svg;
	  switch (what)
	  {
		  case 'analyse':
		  case 'comment':
		  case 'timeref':
		  case 'collapsed':
		  case 'expanded':
		  case 'filter':
		  case 'files':
		  case 'folder':
		  case 'pfolder':
		  case 'play':
		  case 'stop':
		  case 'settings':
		  case 'upload':
		  case 'download':
		  {
			  svg = d3.select("body").append("svg").remove()
				 .attr("width", 1792)
				 .attr("height", 1792)
				 .attr("viewBox", "0 0 1792 1792")
				 .attr("xmlns", "http://www.w3.org/2000/svg");
  
			  svg.append("svg:path")
				  .attr("d", fa_paths[what])
				  .style("fill", "#191970");
			  break;
		  }
	  }
  
	  var str = 'data:image/svg+xml;base64,' + window.btoa(svg.node().outerHTML);
	  m_glyph_cache[what] = str;
	  return str;
  }
  
  function webshark_glyph_img(what, width)
  {
	  var img = document.createElement('img');
  
	  img.setAttribute('src', webshark_glyph(what));
	  img.setAttribute('width', width);
	  return img;
  }
  
  exports.webshark_glyph_img = webshark_glyph_img;
  
  }, {}],11: [function(require,module,exports,global){
  /**
   * Simple, lightweight, usable local autocomplete library for modern browsers
   * Because there werenâ€™t enough autocomplete scripts in the world? Because Iâ€™m completely insane and have NIH syndrome? Probably both. :P
   * @author Lea Verou http://leaverou.github.io/awesomplete
   * MIT license
   */
  
  (function () {
  
  var _ = function (input, o) {
	  var me = this;
  
	  // Setup
  
	  this.isOpened = false;
  
	  this.input = $(input);
	  this.input.setAttribute("autocomplete", "off");
	  this.input.setAttribute("aria-autocomplete", "list");
  
	  o = o || {};
  
	  configure(this, {
		  minChars: 2,
		  maxItems: 10,
		  maxHeight: undefined,
		  autoFirst: false,
		  data: _.DATA,
		  filter: _.FILTER_CONTAINS,
		  getvalue: _.GET_VALUE,
		  item: _.ITEM,
		  replace: _.REPLACE
	  }, o);
  
	  this.index = -1;
  
	  // Create necessary elements
  
	  this.container = $.create("div", {
		  className: "awesomplete",
		  around: input
	  });
  
	  this.ul = $.create("ul", {
		  hidden: "hidden",
		  inside: this.container
	  });
  
	  if (this.maxItems == 0 && this.maxHeight) {
		  this.ul.style.overflowY = 'auto';
		  this.ul.style.maxHeight = this.maxHeight;
	  }
  
	  this.status = $.create("span", {
		  className: "visually-hidden",
		  role: "status",
		  "aria-live": "assertive",
		  "aria-relevant": "additions",
		  inside: this.container
	  });
  
	  // Bind events
  
	  $.bind(this.input, {
		  "input": this.evaluate.bind(this),
		  "blur": this.close.bind(this, { reason: "blur" }),
		  "keydown": function(evt) {
			  var c = evt.keyCode;
  
			  // If the dropdown `ul` is in view, then act on keydown for the following keys:
			  // Enter / Esc / Up / Down
			  if(me.opened) {
				  if (c === 13 && me.selected) { // Enter
					  evt.preventDefault();
					  me.select();
				  }
				  else if (c === 27) { // Esc
					  me.close({ reason: "esc" });
				  }
				  else if (c === 38 || c === 40) { // Down/Up arrow
					  evt.preventDefault();
					  me[c === 38? "previous" : "next"]();
				  }
			  }
		  }
	  });
  
	  $.bind(this.input.form, {"submit": this.close.bind(this, { reason: "submit" })});
  
	  $.bind(this.ul, {"mousedown": function(evt) {
		  var li = evt.target;
  
		  if (li !== this) {
  
			  while (li && !/li/i.test(li.nodeName)) {
				  li = li.parentNode;
			  }
  
			  if (li && evt.button === 0) {  // Only select on left click
				  evt.preventDefault();
				  me.select(li, evt.target);
			  }
		  }
	  }});
  
	  if (this.input.hasAttribute("list")) {
		  this.list = "#" + this.input.getAttribute("list");
		  this.input.removeAttribute("list");
	  }
	  else {
		  this.list = this.input.getAttribute("data-list") || o.list || [];
	  }
  
	  _.all.push(this);
  };
  
  _.prototype = {
	  set list(list) {
  
		  if (Array.isArray(list)) {
			  this._list = list;
		  }
		  else if (typeof list === "string" && list.indexOf(",") > -1) {
				  this._list = list.split(/\s*,\s*/);
		  }
		  else { // Element or CSS selector
			  list = $(list);
  
			  if (list && list.children) {
				  var items = [];
				  slice.apply(list.children).forEach(function (el) {
					  if (!el.disabled) {
						  var text = el.textContent.trim();
						  var value = el.value || text;
						  var label = el.label || text;
						  if (value !== "") {
							  items.push({ label: label, value: value });
						  }
					  }
				  });
				  this._list = items;
			  }
		  }
  
		  if (document.activeElement === this.input) {
			  this.evaluate();
		  }
	  },
  
	  get selected() {
		  return this.index > -1;
	  },
  
	  get opened() {
		  return this.isOpened;
	  },
  
	  close: function (o) {
		  if (!this.opened) {
			  return;
		  }
  
		  this.ul.setAttribute("hidden", "");
		  this.isOpened = false;
		  this.index = -1;
  
		  $.fire(this.input, "awesomplete-close", o || {});
	  },
  
	  open: function () {
		  this.ul.removeAttribute("hidden");
		  this.isOpened = true;
  
		  if (this.autoFirst && this.index === -1) {
			  this.goto(0);
		  }
  
		  $.fire(this.input, "awesomplete-open");
	  },
  
	  next: function () {
		  var count = this.suggestions.length;
		  this.goto(this.index < count - 1 ? this.index + 1 : (count ? 0 : -1) );
	  },
  
	  previous: function () {
		  var count = this.suggestions.length;
		  var pos = this.index - 1;
  
		  this.goto(this.selected && pos !== -1 ? pos : count - 1);
	  },
  
	  // Should not be used, highlights specific item without any checks!
	  goto: function (i) {
		  var lis = this.ul.children;
  
		  if (this.selected) {
			  lis[this.index].setAttribute("aria-selected", "false");
		  }
  
		  this.index = i;
  
		  if (i > -1 && lis.length > 0) {
			  lis[i].setAttribute("aria-selected", "true");
			  this.status.textContent = lis[i].textContent;
  
			  $.fire(this.input, "awesomplete-highlight", {
				  text: this.suggestions[this.index]
			  });
		  }
	  },
  
	  select: function (selected, origin) {
		  if (selected) {
			  this.index = $.siblingIndex(selected);
		  } else {
			  selected = this.ul.children[this.index];
		  }
  
		  if (selected) {
			  var suggestion = this.suggestions[this.index];
  
			  var allowed = $.fire(this.input, "awesomplete-select", {
				  text: suggestion,
				  origin: origin || selected
			  });
  
			  if (allowed) {
				  this.replace(suggestion);
				  this.close({ reason: "select" });
				  $.fire(this.input, "awesomplete-selectcomplete", {
					  text: suggestion
				  });
			  }
		  }
	  },
  
	  evaluate: function() {
		  var me = this;
		  var value = this.getvalue(this.input);
  
		  if (value.length >= this.minChars && this._list.length > 0) {
			  this.index = -1;
			  // Populate list with options that match
			  this.ul.innerHTML = "";
  
			  this.suggestions = this._list
				  .map(function(item) {
					  return new Suggestion(me.data(item, value));
				  })
				  .filter(function(item) {
					  return me.filter(item, value);
				  });
  
			  var total_count = this.suggestions.length;
			  if (this.maxItems > 0 && total_count > this.maxItems)
				  this.suggestions = this.suggestions.slice(0, this.maxItems);
  
			  this.suggestions.forEach(function(text) {
					  me.ul.appendChild(me.item(text, value));
				  });
  
			  if (this.maxItems > 0 && total_count > this.maxItems) {
				  var rest = total_count - this.maxItems;
				  me.ul.appendChild($.create("li", { innerHTML: rest + ' items more...', className: 'truncated' }));
			  }
  
			  if (this.ul.children.length === 0) {
				  this.close({ reason: "nomatches" });
			  } else {
				  this.open();
			  }
		  }
		  else {
			  this.close({ reason: "nomatches" });
		  }
	  }
  };
  
  // Static methods/properties
  
  _.all = [];
  
  _.GET_VALUE = function (text) {
	  return text.value;
  };
  
  _.FILTER_CONTAINS = function (text, input) {
	  return RegExp($.regExpEscape(input.trim()), "i").test(text);
  };
  
  _.FILTER_STARTSWITH = function (text, input) {
	  return RegExp("^" + $.regExpEscape(input.trim()), "i").test(text);
  };
  
  _.ITEM = function (text, input) {
	  var html = input === '' ? text : text.replace(RegExp($.regExpEscape(input.trim()), "gi"), "<mark>$&</mark>");
	  return $.create("li", {
		  innerHTML: html,
		  "aria-selected": "false"
	  });
  };
  
  _.REPLACE = function (text) {
	  this.input.value = text.value;
  };
  
  _.DATA = function (item/*, input*/) { return item; };
  
  // Private functions
  
  function Suggestion(data) {
	  this.label = data.label || data.value;
	  this.value = data.value;
	  this.descr = data.descr;
  }
  Object.defineProperty(Suggestion.prototype = Object.create(String.prototype), "length", {
	  get: function() { return this.label.length; }
  });
  Suggestion.prototype.toString = Suggestion.prototype.valueOf = function () {
	  return "" + this.label;
  };
  
  function configure(instance, properties, o) {
	  for (var i in properties) {
		  var initial = properties[i],
			  attrValue = instance.input.getAttribute("data-" + i.toLowerCase());
  
		  if (typeof initial === "number") {
			  instance[i] = parseInt(attrValue);
		  }
		  else if (initial === false) { // Boolean options must be false by default anyway
			  instance[i] = attrValue !== null;
		  }
		  else if (initial instanceof Function) {
			  instance[i] = null;
		  }
		  else {
			  instance[i] = attrValue;
		  }
  
		  if (!instance[i] && instance[i] !== 0) {
			  instance[i] = (i in o)? o[i] : initial;
		  }
	  }
  }
  
  // Helpers
  
  var slice = Array.prototype.slice;
  
  function $(expr, con) {
	  return typeof expr === "string"? (con || document).querySelector(expr) : expr || null;
  }
  
  function $$(expr, con) {
	  return slice.call((con || document).querySelectorAll(expr));
  }
  
  $.create = function(tag, o) {
	  var element = document.createElement(tag);
  
	  for (var i in o) {
		  var val = o[i];
  
		  if (i === "inside") {
			  $(val).appendChild(element);
		  }
		  else if (i === "around") {
			  var ref = $(val);
			  ref.parentNode.insertBefore(element, ref);
			  element.appendChild(ref);
		  }
		  else if (i in element) {
			  element[i] = val;
		  }
		  else {
			  element.setAttribute(i, val);
		  }
	  }
  
	  return element;
  };
  
  $.bind = function(element, o) {
	  if (element) {
		  for (var event in o) {
			  var callback = o[event];
  
			  event.split(/\s+/).forEach(function (event) {
				  element.addEventListener(event, callback);
			  });
		  }
	  }
  };
  
  $.fire = function(target, type, properties) {
	  var evt = document.createEvent("HTMLEvents");
  
	  evt.initEvent(type, true, true );
  
	  for (var j in properties) {
		  evt[j] = properties[j];
	  }
  
	  return target.dispatchEvent(evt);
  };
  
  $.regExpEscape = function (s) {
	  return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
  };
  
  $.siblingIndex = function (el) {
	  /* eslint-disable no-cond-assign */
	  for (var i = 0; el = el.previousElementSibling; i++);
	  return i;
  };
  
  // Initialization
  
  function init() {
	  $$("input.awesomplete").forEach(function (input) {
		  new _(input);
	  });
  }
  
  // Are we in a browser? Check for Document constructor
  if (typeof Document !== "undefined") {
	  // DOM already loaded?
	  if (document.readyState !== "loading") {
		  init();
	  }
	  else {
		  // Wait for it
		  document.addEventListener("DOMContentLoaded", init);
	  }
  }
  
  _.$ = $;
  _.$$ = $$;
  
  module.exports = _;
  
  return _;
  
  }());
  
  }, {}],12: [function(require,module,exports,global){
  /*! Clusterize.js - v0.16.1 - 2016-08-16
  * http://NeXTs.github.com/Clusterize.js/
  * Copyright (c) 2015 Denis Lukov; Licensed GPLv3 */
  
  ;(function(name, definition) {
	  if (typeof module != 'undefined') module.exports.Clusterize = definition();
	  else if (typeof define == 'function' && typeof define.amd == 'object') define(definition);
	  else this[name] = definition();
  }('Clusterize', function() {
	"use strict"
  
	var is_mac = navigator.platform.toLowerCase().indexOf('mac') + 1;
	var Clusterize = function(data) {
	  if( ! (this instanceof Clusterize))
		return new Clusterize(data);
	  var self = this;
  
	  var defaults = {
		item_height: 0,
		block_height: 0,
		rows_in_block: 50,
		rows_in_cluster: 0,
		cluster_height: 0,
		blocks_in_cluster: 4,
		tag: null,
		content_tag: null,
		callbacks: {},
		scroll_top: 0
	  }
  
	  // public parameters
	  self.options = {};
	  var options = ['rows_in_block', 'blocks_in_cluster', 'tag', 'callbacks'];
	  for(var i = 0, option; option = options[i]; i++) {
		self.options[option] = typeof data[option] != 'undefined' && data[option] != null
		  ? data[option]
		  : defaults[option];
	  }
  
	  var elems = ['scroll', 'content'];
	  for(var i = 0, elem; elem = elems[i]; i++) {
		self[elem + '_elem'] = data[elem + 'Id']
		  ? document.getElementById(data[elem + 'Id'])
		  : data[elem + 'Elem'];
		if( ! self[elem + '_elem'])
		  throw new Error("Error! Could not find " + elem + " element");
	  }
  
	  // private parameters
	  var rows = data.rows,
		cache = {data: '', bottom: 0},
		scroll_top = self.scroll_elem.scrollTop;
  
	  // get row height
	  self.exploreEnvironment(rows);
  
	  // append initial data
	  self.insertToDOM(rows, cache);
  
	  // restore the scroll position
	  self.scroll_elem.scrollTop = scroll_top;
  
	  // adding scroll handler
	  var last_cluster = false,
	  scroll_debounce = 0,
	  pointer_events_set = false,
	  scrollEv = function() {
		// fixes scrolling issue on Mac #3
		if (is_mac) {
			if( ! pointer_events_set) self.content_elem.style.pointerEvents = 'none';
			pointer_events_set = true;
			clearTimeout(scroll_debounce);
			scroll_debounce = setTimeout(function () {
				self.content_elem.style.pointerEvents = 'auto';
				pointer_events_set = false;
			}, 50);
		}
		if (last_cluster != (last_cluster = self.getClusterNum()))
		  self.insertToDOM(rows, cache);
		if (self.options.callbacks.scrollingProgress)
		  self.options.callbacks.scrollingProgress(self.getScrollProgress());
	  },
	  resize_debounce = 0,
	  resizeEv = function() {
		clearTimeout(resize_debounce);
		resize_debounce = setTimeout(self.refresh, 100);
	  }
	  on('scroll', self.scroll_elem, scrollEv);
	  on('resize', window, resizeEv);
  
	  self.refresh = function() {
		self.getRowsHeight(rows) && self.update(rows);
	  }
	  self.setData = function(data) {
		self.data = data;
		var rows = Array();
		rows.length = data.length;
		self.update(rows);
	  }
	  self.update = function(new_rows) {
		rows = new_rows;
		var scroll_top = self.scroll_elem.scrollTop;
		// fixes #39
		if(rows.length * self.options.item_height < scroll_top) {
		  self.scroll_elem.scrollTop = 0;
		  last_cluster = 0;
		}
		self.insertToDOM(rows, cache);
		self.scroll_elem.scrollTop = scroll_top;
	  }
	  self.getScrollProgress = function() {
		return this.options.scroll_top / (rows.length * this.options.item_height) * 100 || 0;
	  }
	}
  
	Clusterize.prototype = {
	  constructor: Clusterize,
	  // get tag name, content tag name, tag height, calc cluster height
	  exploreEnvironment: function(rows) {
		var opts = this.options;
		opts.content_tag = this.content_elem.tagName.toLowerCase();
		if( ! rows.length) return;
		if(this.content_elem.children.length <= 1) this.html([rows[0], rows[0], rows[0]]);
		this.getRowsHeight(rows);
	  },
	  getRowsHeight: function(rows) {
		var opts = this.options,
		  prev_item_height = opts.item_height;
		opts.cluster_height = 0
		if( ! rows.length) return;
		var nodes = this.content_elem.children;
		opts.item_height = nodes[Math.floor(nodes.length / 2)].offsetHeight;
		// consider table's border-spacing
		if(opts.tag == 'tr' && getStyle('borderCollapse', this.content_elem) != 'collapse')
		  opts.item_height += parseInt(getStyle('borderSpacing', this.content_elem), 10) || 0;
		opts.block_height = opts.item_height * opts.rows_in_block;
		opts.rows_in_cluster = opts.blocks_in_cluster * opts.rows_in_block;
		opts.cluster_height = opts.blocks_in_cluster * opts.block_height;
		return prev_item_height != opts.item_height;
	  },
	  // get current cluster number
	  getClusterNum: function () {
		this.options.scroll_top = this.scroll_elem.scrollTop;
		return Math.floor(this.options.scroll_top / (this.options.cluster_height - this.options.block_height)) || 0;
	  },
	  createRows: function (rows, start, end) {
		  var cb = this.options.callbacks.createHTML;
  
		  if (!cb || !this.data) return;
  
		  while (start < end) {
			  if (!rows[start]) rows[start] = cb(this.data[start], start);
			  start++;
		  }
	  },
	  // generate cluster for current scroll position
	  generate: function (rows, cluster_num) {
		var opts = this.options,
		  rows_len = rows.length;
		if (rows_len < opts.rows_in_block) {
		  this.createRows(rows, 0, rows_len);
		  return {
			top_offset: 0,
			bottom_offset: 0,
			rows_above: 0,
			rows: rows
		  }
		}
		if( ! opts.cluster_height) {
		  this.createRows(rows, 0, 1);
		  this.exploreEnvironment(rows);
		}
		var items_start = Math.max((opts.rows_in_cluster - opts.rows_in_block) * cluster_num, 0),
		  items_end = items_start + opts.rows_in_cluster,
		  top_offset = Math.max(items_start * opts.item_height, 0),
		  bottom_offset = Math.max((rows_len - items_end) * opts.item_height, 0),
		  this_cluster_rows = [],
		  rows_above = items_start;
		if(top_offset < 1) {
		  rows_above++;
		}
  
		if (rows_len < items_end) items_end = rows_len;
  
		this.createRows(rows, items_start, items_end);
		for (var i = items_start; i < items_end; i++) {
		  rows[i] && this_cluster_rows.push(rows[i]);
		}
		return {
		  top_offset: top_offset,
		  bottom_offset: bottom_offset,
		  rows_above: rows_above,
		  rows: this_cluster_rows
		}
	  },
	  renderExtraTag: function(class_name, height) {
		var tag = document.createElement(this.options.tag);
		tag.className = class_name;
		height && (tag.style.height = height + 'px');
		return tag;
	  },
	  // if necessary verify data changed and insert to DOM
	  insertToDOM: function(rows, cache) {
		var data = this.generate(rows, this.getClusterNum()),
		  this_cluster_rows = data.rows,
		  this_cluster_content_changed = this.checkChanges('data', this_cluster_rows, cache),
		  only_bottom_offset_changed = this.checkChanges('bottom', data.bottom_offset, cache),
		  layout = [];
  
		if(this_cluster_content_changed) {
		  if(data.top_offset) {
			layout.push(this.renderExtraTag('clusterize-top-space', data.top_offset));
		  }
		  for (var i = 0; i < this_cluster_rows.length; i++)
			 layout.push(this_cluster_rows[i]);
		  data.bottom_offset && layout.push(this.renderExtraTag('clusterize-bottom-space', data.bottom_offset));
		  this.html(layout);
		  this.options.content_tag == 'ol' && this.content_elem.setAttribute('start', data.rows_above);
		} else if(only_bottom_offset_changed) {
		  this.content_elem.lastChild.style.height = data.bottom_offset + 'px';
		}
	  },
  
	  html: function(data) {
		var content_elem = this.content_elem;
		  var last;
		  while((last = content_elem.lastChild)) {
			content_elem.removeChild(last);
		  }
  
		  for (var i = 0; i < data.length; i++) {
			content_elem.appendChild(data[i]);
		  }
	  },
	  checkChanges: function(type, value, cache) {
		var changed = value != cache[type];
		cache[type] = value;
		return changed;
	  }
	}
  
	// support functions
	function on(evt, element, fnc) {
	  return element.addEventListener ? element.addEventListener(evt, fnc, false) : element.attachEvent("on" + evt, fnc);
	}
	function getStyle(prop, elem) {
	  return window.getComputedStyle ? window.getComputedStyle(elem)[prop] : elem.currentStyle[prop];
	}
  
	return Clusterize;
  }));
  
  }, {}],13: [function(require,module,exports,global){
  /* webshark-rtp-player.js
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
  
  var m_webshark_rtps_players = { };
  var m_webshark_rtps_players_name = { };
  var m_webshark_rtps_table = { };
  
  function play_on_click_a(ev)
  {
	  var node;
	  var url;
  
	  node = window.webshark.dom_find_node_attr(ev.target, 'href');
	  if (node != null)
	  {
		  url = node['href'];
		  if (url != null)
		  {
			  var wavesurfer = m_webshark_rtps_players[url];
  
			  if (wavesurfer)
			  {
				  wavesurfer.play();
				  ev.preventDefault();
				  return;
			  }
  
			  var div = document.createElement('div');
			  {
				  var pdiv = document.getElementById('ws_rtp_playback');
				  var s = new Date().getTime();
				  div.id = 'wv' + s + "_" + Math.floor(Math.random() * 65535) + '_' + Math.floor(Math.random() * 255);
				  pdiv.appendChild(div);
  
				  div.style.border = '2px solid blue';
			  }
  
			  var wavesurfer = WaveSurfer.create({
				  container: '#' + div.id,
				  progressColor: '#0080FF',
				  waveColor: '#aaa'
			  });
  
			  ws_rtp_playback_control_create(div, wavesurfer);
  
			  var label = null;
			  if (node['ws_title'])
				  label = window.webshark.dom_create_label("Stream: " + node['ws_title']);
			  else
				  label = window.webshark.dom_create_label("URL: " + url);
  
			  div.insertBefore(label, div.firstChild);
  
			  if (node['ws_rtp'])
			  {
				  wavesurfer.on("audioprocess", function () {
					  var ts = wavesurfer.getCurrentTime();
  
					  player_sync_view(node['ws_rtp'], ts);
				  });
  
				  wavesurfer.on("seek", function () {
					  var ts = wavesurfer.getCurrentTime();
  
					  player_sync_view(node['ws_rtp'], ts);
				  });
  
				  m_webshark_rtps_players_name[node['ws_rtp']] = wavesurfer;
			  }
  
			  wavesurfer.on('ready', function () {
				  wavesurfer.play();
			  });
  
			  wavesurfer.load(url);
  
			  m_webshark_rtps_players[url] = wavesurfer;
		  }
  
		  ev.preventDefault();
	  }
  }
  
  function player_sync_view(x, ts)
  {
	  var t = m_webshark_rtps_table[x];
  
	  if (t)
	  {
		  var items = t[0];
		  var table = t[1];
		  var prev_node = t[2];
  
		  if (prev_node)
			  prev_node.classList.remove("selected");
  
		  var idx = player_find_index(items, ts);
		  if (idx != -1)
		  {
			  var current_node = table.childNodes[1 + idx];
			  current_node.classList.add("selected");
			  current_node.scrollIntoView(false);
  
			  t[2] = current_node;
		  }
	  }
  }
  
  function player_find_index(tap, ts)
  {
	  // TODO, optimize with binary search
  
	  for (var i = 0; i < tap.length; i++)
	  {
		  var off = tap[i]['o'];
  
		  if (off >= ts)
			  return i;
	  }
  
	  return -1;
  }
  
  function ws_rtp_playback_control_play_pause(wave, x)
  {
	  for (var w in m_webshark_rtps_players)
	  {
		  var wv = m_webshark_rtps_players[w];
  
		  if (!wave || wave == wv)
		  {
			  if (x == 'toggle') wv.playPause();
			  if (x == 'start') wv.play(0);
		  }
	  }
  }
  
  function ws_rtp_playback_control_skip(wave, x)
  {
	  for (var w in m_webshark_rtps_players)
	  {
		  var wv = m_webshark_rtps_players[w];
  
		  if (!wave || wave == wv)
			  wv.skip(x);
	  }
  }
  
  function ws_rtp_playback_control_speed(wave, x)
  {
	  for (var w in m_webshark_rtps_players)
	  {
		  var wv = m_webshark_rtps_players[w];
  
		  if (!wave || wave == wv)
			  wv.setPlaybackRate(x);
	  }
  }
  
  function ws_rtp_playback_control_create(pdiv, wave)
  {
	  var control_div = document.createElement('div');
	  var btn;
  
	  if (wave == null)
		  control_div.appendChild(window.webshark.dom_create_label("All loaded streams"));
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "Play from start";
	  control_div.appendChild(btn);
	  btn.onclick = function() { ws_rtp_playback_control_play_pause(wave, 'start'); }
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "Backward 10s";
	  btn.onclick = function() { ws_rtp_playback_control_skip(wave, -10); }
	  control_div.appendChild(btn);
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "Backward 5s";
	  btn.onclick = function() { ws_rtp_playback_control_skip(wave, -5); }
	  control_div.appendChild(btn);
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "Play/Pause";
	  control_div.appendChild(btn);
	  btn.onclick = function() { ws_rtp_playback_control_play_pause(wave, 'toggle'); }
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "Forward 5s";
	  btn.onclick = function() { ws_rtp_playback_control_skip(wave, 5); }
	  control_div.appendChild(btn);
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "Forward 10s";
	  btn.onclick = function() { ws_rtp_playback_control_skip(wave, 10); }
	  control_div.appendChild(btn);
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "0.5x";
	  control_div.appendChild(btn);
	  btn.onclick = function() { ws_rtp_playback_control_speed(wave, 0.5); }
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "1.0x";
	  control_div.appendChild(btn);
	  btn.onclick = function() { ws_rtp_playback_control_speed(wave, 1); }
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "1.5x";
	  control_div.appendChild(btn);
	  btn.onclick = function() { ws_rtp_playback_control_speed(wave, 1.5); }
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "2.0x";
	  control_div.appendChild(btn);
	  btn.onclick = function() { ws_rtp_playback_control_speed(wave, 2); }
  
	  btn = document.createElement("button");
	  btn.className = "btn btn-primary";
	  btn.innerHTML = "4.0x";
	  control_div.appendChild(btn);
	  btn.onclick = function() { ws_rtp_playback_control_speed(wave, 4); }
  
  /*
	  if (wave != null)
	  {
		  var span = document.createElement("span");
		  span.innerHTML = " Loading";
		  control_div.appendChild(span);
	  }
   */
  
  /*
	  <button class="btn btn-primary" onclick="wavesurfer.toggleMute()">
		<i class="fa fa-volume-off"></i>
		Toggle Mute
	  </button>
  */
  
	  control_div.setAttribute('align', 'center');
  
	  pdiv.insertBefore(control_div, pdiv.firstChild);
  }
  
  exports.play_on_click_a = play_on_click_a;
  exports.ws_rtp_playback_control_create = ws_rtp_playback_control_create;
  
  exports.set_in_table = function(rtp_str, arr)
  {
	  m_webshark_rtps_table[rtp_str] = arr;
  };
  
  exports.get_from_name = function(rtp_str)
  {
	  return m_webshark_rtps_players_name[rtp_str];
  };
  
  }, {}],14: [function(require,module,exports,global){
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
  
  }, {}],}, {}, 0);
