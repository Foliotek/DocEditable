
test("Initialization", function() {
  ok ( typeof DocEditable != "undefined", "DocEditable is initialized on the page" );
});

test("Basic Formatting", function() {

  var div = $("<div />")[0];
  var cm = new CodeMirror(div);
  cm.setValue("Testing\nformatting");

  var wysi = new DocEditable(cm);

  equal (wysi.toHTML(), "Testing<br />formatting");

  wysi.setValue("Testing\nformatting");

  wysi.bold({ line: 0, ch: 0 }, { line: 0, ch: 7 });
  equal (wysi.toHTML(), "<strong>Testing</strong><br />formatting", "Calling bold should mark text");

  wysi.bold({ line: 0, ch: 0 }, { line: 0, ch: 7 });
  equal (wysi.toHTML(), "Testing<br />formatting", "Calling bold again should remove formatting");

  wysi.setValue("Testing\nformatting");

  wysi.bold({ line: 0, ch: 0 }, { line: 0, ch: 7 });
  equal (wysi.toHTML(), "<strong>Testing</strong><br />formatting", "Calling bold should mark text");

  wysi.bold({ line: 0, ch: 1 }, { line: 0, ch: 7 });
  equal (wysi.toHTML(), "<strong>T</strong>esting<br />formatting", "Calling bold again should remove formatting");

  wysi.bold({ line: 0, ch: 1 }, { line: 0, ch: 7 });
  equal (wysi.toHTML(), "<strong>T</strong><strong>esting</strong><br />formatting", "Calling bold again should mark text again");

  
  wysi.setValue("Testing\nformatting");

  wysi.bold({ line: 0, ch: 1 }, { line: 1, ch: 2 });
  equal (wysi.toHTML(), "T<strong>esting</strong><br /><strong>fo</strong>rmatting", "Calling bold should split lines");


  wysi.setValue("Testing\nformatting");

  wysi.italic({ line: 0, ch: 0 }, { line: 1, ch: 2 });
  equal (wysi.toHTML(), "<em>Testing</em><br /><em>fo</em>rmatting", "Calling italic should split lines");

  wysi.italic({ line: 0, ch: 1 }, { line: 0, ch: 3 });
  equal (wysi.toHTML(), "<em>T</em>es<em>ting</em><br /><em>fo</em>rmatting", "Calling italic again should split selection");

});
