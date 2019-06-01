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
