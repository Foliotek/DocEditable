/*
DocEditable v0.1
https://github.com/foliotek/doceditable
Copyright Foliotek Inc.
May be distributed under the MIT license
*/

window.DocEditable = (function() {

  var LIST_SENTRY = "♂";

  function DocEditable(place, options) {
    if (!(this instanceof DocEditable)) return new DocEditable(place, options);

    if (place instanceof CodeMirror) {
      this.editor = place;
    }
    else {
      this.editor = new CodeMirror(place, options);
    }

    var editor = this.editor;
    editor.setOption("lineNumbers", false);
    editor.setOption("lineWrapping", true);

    this.emitter = $("<div />");
    this.options = options = options || { };

    var json = { value: this.editor.getValue() };

    if (options.format) {
      if (!DocEditable.importers.hasOwnProperty(options.format)) {
        throw "DocEditable: No importer for " + options.format;
      }

      json = DocEditable.importers[options.format](json.value);
    }

    this.loadJSON(json);

    var cloned = { };
    var keyMap = DocEditable.keyMap;
    for (var i in keyMap) {
      cloned[i] = keyMap[i].bind(this);
    }

    this.editor.addKeyMap(cloned);

    this.toolbar = new DocEditableToolbar2(this);

    var wrapper = $(this.editor.getWrapperElement());
    wrapper.wrap("<div class='DocEditable' />");
    wrapper.parent().prepend(this.toolbar.element);

    if (options.debug) {
      wrapper.parent().addClass("debug");
    }

    this.editor.refresh();

    bindListEvents(this);

  }
  

  function bindListEvents(docEditable) {

    var editor = docEditable.editor;
    var lastPos = {line: 0, ch: 0};
    editor.on("cursorActivity", function() {
      docEditable.emitter.trigger("cursorActivity");
      lastPos = docEditable.editor.getCursor("head");
    });

    var isInList = false;
    var isNestingList = false;
    editor.on("change", function() {
      docEditable.emitter.trigger("change");

      if (isInList) {
        docEditable.list();
      }
/*
      if (isNestingList) {
        docEditable.list(undefined, true);
      }
      */
    });

    editor.on("beforeSelectionChange", function(ed, args) {
      var start = args.head;
      var end = { line: args.head.line, ch: args.head.ch + 1};
      var character = editor.getRange(start, end);

      // Remove marked spans that were added but never used
      clearEmptyMarkedSpans(editor.getLineHandle(args.head.line).markedSpans, args.head.ch);

      if (character === LIST_SENTRY) {
        if (posLess(lastPos, args.head)) {
          args.head.ch = args.head.ch + 1;
        }
        else {
          var prevLine = editor.getLineHandle(args.head.line - 1);
          if (prevLine) {
            args.head.line = args.head.line - 1;
            args.head.ch = prevLine.text.length;
          }
        }
      }
    });

    editor.on("beforeChange", function(ed, args) {
      var line = editor.getLineHandle(args.from.line);
      var lineInfo = editor.lineInfo(line);
      var lineClass = lineInfo.textClass || "";

      isInList = false;
      isNestingList = false;
/*
      log(args.text);
      if (args.origin === "+input" && args.text.length == 2) {
        isInList = lineClass.indexOf('li') !== -1;
      }
      else if ((lineClass.indexOf('li') !== -1) && args.text[0] === "\t") {
        isNestingList = true;
      }
*/
      if (args.origin === "+input" && args.text.length == 2) {
        isInList = line.text.indexOf(LIST_SENTRY) !== -1;
      }

      //log(isInList, args, line);
      //log("before " + arguments);
    });



  }
  DocEditable.version = "0.1";

  DocEditable.tagMap = {
    'bold': 'strong',
    'italic': 'em',
    'underline': 'u',
    'list': 'li',
    'annotation': 'annotation'
  };

  DocEditable.prototype = {
    loadJSON: function(json) {
      this.setValue(json.value, json.markers);
    },
    setValue: function(val, markers) {

      log("Loading value from markers: ", val, markers);

      var editor = this.editor;
      editor.setValue(val);
      editor.getAllMarks().forEach(function(m) {
        m.clear();
      });

      if (markers) {
        markers.forEach(function (m) {
          editor.markText(m.start, m.end, {
            className: m.className,
            inclusiveRight: true,
            inclusiveLeft : true,
            startStyle: "wysi-start",
            endStyle: "wysi-end"
          });
        });
      }

    },
    getValue: function() {
      return this.editor.getValue();
    },
    toMarkdown: function() {
      return DocEditable.exporters.markdown(this);
    },
    toHTML: function(lineBreaks) {
      return DocEditable.exporters.html(this, lineBreaks);
    },
  	removeFormatting: function(className, start, end) {

      var editor = this.editor;

      start = start || editor.getCursor("start");
      end = end || editor.getCursor("end");

      var i = start.line;

      // if (!editor.somethingSelected()) {
      //   return;
      // }

      editor.eachLine(start.line, end.line + 1, function(l) {

          var startCh = i === start.line ? start.ch : 0;
          var endCh = i === end.line ? end.ch : l.text.length;

          log("Looking at line " + i, l, "Start ch: " + startCh, "End ch: " + endCh);

          (l.markedSpans || []).forEach(function(m) {

            var matchesClass = !className || m.marker.className === className;
            var markerOpts = m.marker.getOptions();
            var markerOptsNotInclusive = m.marker.getOptions();
            markerOptsNotInclusive.inclusiveLeft = markerOptsNotInclusive.inclusiveRight = false;

            var to = m.to;
            var from = m.from;
            if (m.to === null) {
              to = l.text.length;
            }
            if (m.from === null) {
              from = 0;
            }


            // Ideally we should be able to call detachLine here
            // so that the marker doesn't wipe out other lines.
            // Alternatively, could make sure the original marking splits on lines,
            // so this wouldn't be an issue.
            var outsideOfSelection = startCh > to || endCh < from;

            if (!matchesClass || outsideOfSelection) {
              log("Doesnt match", matchesClass, outsideOfSelection, to, from, m)
              return;
            }

            var selectionStartsBefore = startCh <= from;
            var selectionEndsAfter = endCh >= to;

            log(from, to, startCh, endCh);

            // Selected range encompasses marker.  Delete the marker
            if (selectionStartsBefore && selectionEndsAfter) {
              log("Entirely ");
             // m.marker.clear();
            }

            // Selected range starts before but also ends before marker.
            // Delete the first part of the marker, and add a new one after selection ends
            else if (selectionStartsBefore && !selectionEndsAfter) {
              log("Starting before");
              editor.markText(
                { line: i, ch: endCh },
                { line: i, ch: to },
                m.marker.getOptions()
              );
             // m.marker.clear();
            }

            // Selected range starts after but also ends after marker.
            // Delete the second part of the marker, and add a new one before selection starts
            else if (!selectionStartsBefore && selectionEndsAfter) {
              log("Starting after");
              editor.markText(
                { line: i, ch: from },
                { line: i, ch: startCh },
                markerOptsNotInclusive
              );
              //m.marker.clear();
            }

            // Selected range is entirely inside of marker.
            // Need to split marker into two (before and after selection).
            else {


              log("Splitting Range In Two", endCh, to);

              var opts2 = m.marker.getOptions();
              opts2.inclusiveLeft = false;
              editor.markText(
                { line: i, ch: endCh },
                { line: i, ch: to },
                m.marker.getOptions()
              );

              var opts = m.marker.getOptions();
              opts.inclusiveRight = false;
              editor.markText(
                { line: i, ch: from },
                { line: i, ch: startCh },
                markerOptsNotInclusive
              );

              //m.marker.clear();
            }

            m.marker.shouldRemove = true;
          });
          i++;
      });

      editor.getAllMarks().forEach(function(m) {
        //log(m, m.className, m.shouldRemove);
        if (m.shouldRemove) {
          m.clear();
        }
      });

  	},
    bold: function(start, end) {
      this.formatText("bold", start, end);
    },
    annotate: function() {
      this.formatText("annotation");
    },
    italic: function(start, end) {
      this.formatText("italic", start, end);
    },
    underline: function(start, end) {
      this.formatText("underline", start, end);
    },
    strikethrough: function(start, end) {
      this.formatText("strikethrough", start, end);
    },
    img: function(src) {

      if (!src) {
        throw "DocEditable: img - no src provided"
      }
      var editor = this.editor;
      var img = new Image();

      var start = editor.getCursor("start");

      img.onload = function() {

        editor.addLineWidget(start.line, img);

      };

      img.src = src;
    },

    linesAreList: function(start, end) {
      var allList = true;

      this.editor.eachLine(start.line, end.line + 1, function(l) {

/*
        var lineClass = this.editor.lineInfo(l).textClass || "";
        if (lineClass.indexOf('li') === -1) {
          allList = false;
        }
*/

        if (l.text.indexOf(LIST_SENTRY) === -1) {
          allList = false;
        }
      });

      return allList;
    },

    list: function(type, nest) {
      var editor = this.editor;

      type = type || "unordered";
      var addClass = nest ? "li2" : "li";
      if (nest) {
        log("here", addClass);
      }

      var start = editor.getCursor("start");
      var end = editor.getCursor("end");
      var allList = this.linesAreList(start, end);
      log("ALL? ", allList);

      for (var i = start.line; i <= end.line; i++)   {
        var rep = document.createElement("span");
        rep.innerHTML = "&nbsp;&nbsp;•&nbsp;&nbsp;";

        var line = editor.getLineHandle(i);
        var isList = editor.getLine(i).indexOf(LIST_SENTRY) !== -1;

        if (allList && isList) {
          editor.replaceRange("", { line: i, ch: 0 }, { line: i, ch: 1});
        }
        else if (!allList && !isList) {
         editor.replaceRange(LIST_SENTRY, { line: i, ch: 0 });

          editor.markText({line: i, ch: 0}, {line: i, ch: 1}, {
            replacedWith: rep,
            className: "list"
          });
        }


/*
        var lineInfo = editor.lineInfo(line);
        var isList = (lineInfo.textClass || "").indexOf(addClass) >= 0;

        log('islist', isList);

        if (allList && isList) {
          editor.removeLineClass(i, "text", addClass);
          //editor.indentLine(i, 'subtract');
        }
        else if (!isList) {
          editor.addLineClass(i, "text", addClass);
          //editor.indentLine(i, 'add');
        }
*/

        //editor.addLineClass(i, "text", type);

        /*var span = document.createElement("span");
        span.className = "bullet"
        span.innerText = "hi";
        var widge = editor.addLineWidget(i, span);
        widge.changed();
        editor.refresh();*/
      }
    },

    formatBlock: function(className, start, end) {

      this.unformatBlock();

      var editor = this.editor;
      var start = start || editor.getCursor("start");
      var end = end || editor.getCursor("end");


      for (var i = start.line; i <= end.line; i++) {
        editor.addLineClass(i, "text", className);
      }

      this.addUndoState(
        { line: start.line - 1, ch: 0 },
        { line: end.line + 1, ch: 0 }// editor.getLineHandle(end.line).text.length }
      );

      this.emitter.trigger("cursorActivity");
      this.emitter.trigger("change");
    },
    unformatBlock: function(start, end) {
      var editor = this.editor;
      var start = start || editor.getCursor("start");
      var end = end || editor.getCursor("end");

      for (var i = start.line; i <= end.line; i++)   {
        editor.removeLineClass(i, "text");
      }

      this.emitter.trigger("cursorActivity");
      this.emitter.trigger("change");
    },
    isRangeMarked: function(start, end, className) {

      // This is an inefficient way to check if a range is marked,
      // but it does work... Loop through each character, and if the mark
      // is not found, bail out and return false.
      var editor = this.editor;
      var i = start.line;
      var allChsMarked = true;

      editor.eachLine(start.line, end.line + 1, function(l) {

          if (!allChsMarked) {
            return;
          }

          var startCh = i === start.line ? start.ch : 0;
          var endCh = i === end.line ? end.ch : l.text.length;

          for (var j = startCh; j <= endCh; j++) {
            var chFound = false;
            editor.findMarksAt({ line: i, ch: j }).forEach(function(m) {
              if (!className || m.className === className) {
                chFound = true;
              }
            });

            if (!chFound) {
              allChsMarked = false;
              break;
            }
          }

      });

      return allChsMarked;
    },
    addUndoState: function(start, end) {

      // Temporarily don't do anything on undo.  Markers and line classes
      // are not sticking as expected.
      return;

      var editor = this.editor;
      var hist = editor.getHistory();

      log(hist, start, end);

      // By including one extra character in the undo state it wipes out markers.
      // Not ideal, but it kind of works.  Has bugs when selection starts near line edges
      var customStart = {line: start.line, ch: Math.max(start.ch - 1, 0)};
      var customEnd = {line: end.line, ch: end.ch + 1};

      hist.done.push({
        anchorBefore: editor.getCursor("anchor"),
        anchorAfter: editor.getCursor("anchor"),
        headBefore: editor.getCursor("head"),
        headAfter: editor.getCursor("head"),
        changes:[{
          from: customStart,
          to: customEnd,
          text: editor.getRange(customStart, customEnd).split("\n")
        }]
      });

      editor.setHistory(hist);
    },
    formatText: function(className, start, end) {
      var editor = this.editor;

      start = start || editor.getCursor("start");
      end = end || editor.getCursor("end");

      var markedStart = false;
      var markedEnd = false;

      var shouldRemove = this.isRangeMarked(start, end, className);
      var marker = undefined;

      //log("SHOULD REMOVE?" + shouldRemove);

      if (shouldRemove) {
        this.removeFormatting(className, start, end);
      }
      else {
        var i = start.line;
        var allChsMarked = true;

        var markOpts = {
          className: className,
          inclusiveRight: true,
          startStyle: "wysi-start",
          endStyle: "wysi-end"
        };

        this.removeFormatting(className, start, end);
        var isCollapsed = posEq(start, end);
        //log("%cAbout to mark character.  Is collapsed? " + isCollapsed, "color:red");
        editor.eachLine(start.line, end.line + 1, function(l) {

            var startCh = i === start.line ? start.ch : 0;
            var endCh = i === end.line ? end.ch : l.text.length;


            if (isCollapsed) {

              // Create a blank space, mark that range, then remove the space.  Allow pressing bold when 0 characters are selected.
              markOpts.inclusiveLeft = true;
              editor.replaceRange(" ", { line: i, ch: startCh });
              editor.markText({ line: i, ch: startCh }, { line: i, ch: endCh + 1 }, markOpts);
              editor.replaceRange("", { line: i, ch: startCh },  { line: i, ch: endCh + 1 });
            }
            else {

            marker = editor.markText({line: i, ch: startCh},{line: i, ch: endCh}, markOpts);
          }

          i++;

        });

        /*
        editor.markText(start, end, {
          className: className,
          inclusiveRight: true,
          inclusiveLeft : true,
          startStyle: "wysi-start",
          endStyle: "wysi-end"
        });
        */
      }
      this.addUndoState(start, end);

      this.emitter.trigger("cursorActivity");
      start['after'] = end['after'] = true;
      this.emitter.trigger("markerChange", marker);
      //CodeMirror.signal(this.editor, 'change', this.editor, changeObj);
    },
    getActiveMarks: function() {
      var editor = this.editor;
      var start = editor.getCursor("anchor");
      var marks = [];
      editor.findMarksAt(start).forEach(function(m) {
        marks.push(m.className);
      });
      return marks;
    },
    getActiveBlock: function() {

      var editor = this.editor;
      var start = editor.getCursor("start");
      var end = editor.getCursor("end");
      var textClass = undefined;
      var diff = false;
      for (var i = start.line; i <= end.line; i++)   {
        var info = editor.lineInfo(i);
        if (textClass !== undefined && textClass != info.textClass) {
          diff = true;
          break;
        }

        textClass = info.textClass;

      }

      if (diff) {
        return null;
      }

      return textClass === undefined ? "normal" : textClass;
    },
    on: function(type, f) {this.emitter.on(type, f);},
    off: function(type, f) {this.emitter.off(type, f);}
  };

  DocEditable.fromTextArea = function(textarea, options, cmOptions) {
	  var editor = CodeMirror.fromTextArea(textarea, cmOptions);
    return new DocEditable(editor, options);
  };


  DocEditable.keyMap = {
      "Ctrl-B": function() {
        this.bold();
      },
      "Ctrl-I": function() {
        this.italic();
      },
      "Ctrl-U": function() {
        this.underline();
      },
      "Ctrl-5": function() {
        this.strikethrough();
      },

      "Ctrl-Alt-M": function() {
        this.annotate("test");
      },
      "Ctrl-Space": function() {
        this.removeFormatting();
      },
      "Ctrl-/": function() {
        this.removeFormatting();
      },

      "Ctrl-Alt-1": function() {
        this.formatBlock("h1");
      },
      "Ctrl-Alt-2": function() {
        this.formatBlock("h2");
      },
      "Ctrl-Alt-3": function() {
        this.formatBlock("h3");
      },
      "Ctrl-Alt-4": function() {
        this.formatBlock("h4");
      },
      "Ctrl-Alt-5": function() {
        this.formatBlock("h5");
      },
      "Ctrl-Alt-6": function() {
        this.formatBlock("h6");
      }
  };

  var mac = /Mac/.test(navigator.platform);
  if (mac) {
    var map = { };
    for (var i in DocEditable.keyMap) {
      map[i.replace("Ctrl", "Cmd")] = DocEditable.keyMap[i];
    }
    DocEditable.keyMap = map;
  }


  DocEditable.exporters = {
    html: function(docEditable, lineBreaks) {
      var editor = docEditable.editor;
      var val = editor.getValue();
      var markers = [];
      var out = [];

      editor.getAllMarks().forEach(function(m) {
        var markLocation = m.find();
        var startLine = editor.getLineHandle(markLocation.from.line);
        var endLine = editor.getLineHandle(markLocation.to.line);

        var markerID = guid();
        var tag = DocEditable.tagMap[m.className];

        markers.push({
          id: markerID,
          markerType: m.className,
          tag: '<' + tag + '>',
          pos: markLocation.from
        });

        markers.push({
          id: markerID,
          markerType: m.className,
          tag: '</' + tag + '>',
          pos: markLocation.to
        });
      });


      function getLineMarkers(line) {
        return markers.filter(function(m) {
          return m.pos.line == line;
        }).sort(function(m1, m2) {
          return m1.pos.ch - m2.pos.ch;
        });
      }

      editor.eachLine(function(l) {
        var lineInfo = editor.lineInfo(l);
        var lineMarkers = getLineMarkers(lineInfo.line);
        var offset = 0;
        var lineVal = lineInfo.text;

        if (lineInfo.textClass) {
          var startTag = '<' + lineInfo.textClass + '>';
          var endTag = '</' + lineInfo.textClass + '>';
          lineVal =  startTag + lineVal + endTag;
          offset += startTag.length;
        }

        if (lineMarkers.length > 0) {
          lineMarkers.forEach(function (lm) {
            lineVal = splice(lineVal, lm.pos.ch + offset, lm.tag);
            offset += lm.tag.length;
          });
        }

        out.push(lineVal);
      });

      return out.join(lineBreaks || '<br />');
    },
    markdown: function() {
      throw "Not implemented: exporters.markdown";
    }
  };

  DocEditable.importers = {
    html: function(markup) {
      var el = $("<div />").append(markup)[0];
      var val = '';
      var markers = [];

      function processNode(n) {
        var next = n.childNodes[0];

        while (next != null) {

          if (next.nodeType === 3) {
            val += next.textContent;
          }
          else if (next.nodeType === 1) {

            //if (next.tagName === "P") {val+="\n"; }

            var split = val.split("\n");

            var start =  {
              line: split.length - 1,
              ch: split[split.length - 1].length
            };

            processNode(next);

            split = val.split("\n");

            var end =  {
              line: split.length - 1,
              ch: split[split.length - 1].length
            };

            var className = "";
            if (next.tagName === "STRONG") {className = "bold"; }
            if (next.tagName === "EM") {className = "italic"; }

            if (className) {
              markers.push({
                className: className,
                start: start,
                end: end
              });
            }
          }
          next = next.nextSibling;
        }
      }


      processNode(el);

      return {
        value: val,
        markers: markers
      };
    },
    markdown: function(markup) {
      var markdown = window.markdown;

      if (!markdown.toHTML) {
        throw "DocEditable: markdown module not provided.";
      }

      var html = markdown.toHTML(markup);
      
      return DocEditable.importers.html(html);
    }
  };

  function log(){window.console&&(log=Function.prototype.bind?Function.prototype.bind.call(console.log,console):function(){Function.prototype.apply.call(console.log,console,arguments)},log.apply(this,arguments))};

  function escapeHTMLEncode(str) {
    var div = document.createElement('div');
    var text = document.createTextNode(str);
    div.appendChild(text);
    return div.innerHTML;
  }

  function clearEmptyMarkedSpans(markedSpans, currentCh) {
    (markedSpans || []).forEach(function(m) {
      if (m.from === m.to && m.from !== currentCh) {
        m.marker.clear();
      }
    });
  }
  function posEq(a, b) {
    return a.line == b.line && a.ch == b.ch;
  }
  function posLess(a, b) {
    return a.line < b.line || (a.line == b.line && a.ch < b.ch);
  }
  function intersects(start, end, pos) {
    var intersects = (posEq(start, pos) || posLess(start, pos)) && (posEq(start, pos) || !posLess(pos, end));
    //log(start, end, pos, posLess(start, pos), intersects);
    return intersects;
  }

  function splice (s, idx, str) {
      return (s.slice(0,idx) + str + s.slice(idx));
  }

  function markup (s, start, end, tag) {
    var ret = '';
    ret += s.slice(0, start);
    ret += '<' + tag +'>' + s.slice(start, end) + '</' + tag +'>';
    ret += s.slice(end);
    return ret;
  }

  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  }

  function guid() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  }

  return DocEditable;

})();


window.DocEditableToolbar2 = (function() {

  var markup =
      '<div class="btn-toolbar">' +
      '  <div class="btn-group">' +
      '      <button class="btn wys-mark wys-bold"  data-original-title="Bold - Ctrl+B"><i class="icon-bold"></i></button>' +
      '      <button class="btn wys-mark wys-italic" data-original-title="Italic - Ctrl+I"><i class="icon-italic"></i></button>' +
      '      <button class="btn wys-mark wys-underline" data-original-title="Underline - Ctrl+U"><i class="icon-magnet"></i></button>' +
      '  </div>' +

      '  <div class="btn-group">' +
      '      <button class="btn wys-block wys-h1" data-wysi-command="h1">H1</button>' +
      '      <button class="btn wys-block wys-h2" data-wysi-command="h2">H2</button>' +
      '      <button class="btn wys-block wys-h3" data-wysi-command="h3">H3</button>' +
      '      <button class="btn wys-block wys-normal" data-wysi-command="normal">normal</button>' +
      '  </div>' +

      '  <div class="btn-group">' +
      '      <button class="btn wys-list wys-unordered" data-original-title="Insert List"><i class="icon-list"></i></button>' +
      '  </div>' +

      '  <div class="btn-group">' +
      '      <button class="btn wys-mark wys-remove" data-original-title="Remove Formatting - Ctrl+Space"><i class="icon-remove"></i></button>' +
      '  </div>' +
      '  <div class="btn-group">' +
      '      <button class="btn wys-mark wys-comment" data-original-title="Add Comment - Ctrl+Alt+M"><i class="icon-comment"></i></button>' +
      '  </div>' +
      '  <div class="btn-group">' +
      '    <button class="btn wys-image"><i class="icon-picture"></i></button>' +
      '    <button class="btn wys-image-inline"><i class="icon-picture"></i></button>' +
      '  </div>' +
      '</div>';


  function DocEditableToolbar2(DocEditable) {

    if (!(this instanceof DocEditableToolbar2)) return new DocEditableToolbar2(DocEditable);


    var el = this.el = $(markup);
    var wysi = this.wysi = DocEditable;

    wysi.on("cursorActivity", this.updateUI.bind(this));


    el.on('mousedown', '.wys-bold', function() {
      wysi.bold();
      return false;
    });
    el.on('mousedown', '.wys-italic', function() {
      wysi.italic();
      return false;
    });
    el.on('mousedown', '.wys-underline', function() {
      wysi.underline();
      return false;
    });
    el.on('mousedown', '.wys-comment', function() {
      wysi.annotate();
      return false;
    });
    el.on('mousedown', '.wys-remove', function() {
      wysi.removeFormatting();
      return false;
    });

    el.on('mousedown', '.wys-normal', function() {
      wysi.unformatBlock();
      return false;
    });
    el.on('mousedown', '.wys-h1', function() {
      wysi.formatBlock("h1");
      return false;
    });
    el.on('mousedown', '.wys-h2', function() {
      wysi.formatBlock("h2");
      return false;
    });
    el.on('mousedown', '.wys-h3', function() {
      wysi.formatBlock("h3");
      return false;
    });

    el.on('mousedown', '.wys-unordered', function() {
      wysi.list("unordered");
      return false;
    });



    el.on('mousedown', '.wys-image', function() {
      wysi.img("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThWt73adaSgX55Rgi46CVKmdUWoCRFoUVAANI9q0QOA9f31qSx");
      return false;
    });
    el.on('mousedown', '.wys-image', function() {
      wysi.img("http://i.imgur.com/XpVw3l1.jpg");
      return false;
    });

    this.element = el;
  }


  DocEditableToolbar2.prototype = {
    updateUI: function() {
      var el = this.el;
      var wysi = this.wysi;

      var marks = wysi.getActiveMarks();

      el.find(".wys-mark").removeClass("active");
      for (var i = 0; i < marks.length; i++) {
        el.find(".wys-" + marks[i]).addClass("active");
      }

      var block = wysi.getActiveBlock();
      el.find(".wys-block").removeClass("active");
      if (block) {
        el.find(".wys-" + block).addClass("active");
      }
    }
  };

  return DocEditableToolbar2;

})();

// See toolbar idea here: https://github.com/jhollingworth/bootstrap-wysihtml5/blob/master/src/bootstrap-wysihtml5.js