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
