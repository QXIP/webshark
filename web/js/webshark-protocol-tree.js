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
