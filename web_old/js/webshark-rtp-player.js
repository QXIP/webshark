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
