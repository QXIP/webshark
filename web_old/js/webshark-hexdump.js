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
