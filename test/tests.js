
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

  /*
  wysi.setValue("Testing\nformatting");

  wysi.bold({ line: 0, ch: 0 }, { line: 0, ch: 7 });
  equal (wysi.toHTML(), "<strong>Testing</strong><br />formatting", "Calling bold should mark text");

  wysi.bold({ line: 0, ch: 2 }, { line: 0, ch: 7 });
  equal (wysi.toHTML(), "<strong>Te</strong>sting<br />formatting", "Calling bold again should remove formatting");

  wysi.bold({ line: 0, ch: 2 }, { line: 0, ch: 3 });
  equal (wysi.toHTML(), "<strong>Te</strong>s<strong>ting</strong><br />formatting", "Calling bold again should remove formatting");

  wysi.bold({ line: 0, ch: 2 }, { line: 0, ch: 7 });
  equal (wysi.toHTML(), "Testing<br />formatting", "Calling bold again should re-add formatting");
  */

  wysi.setValue("Testing\nformatting");

  wysi.bold({ line: 0, ch: 1 }, { line: 1, ch: 2 });
  equal (wysi.toHTML(), "T<strong>esting<br />fo</strong>rmatting", "Calling bold should span lines");


  wysi.setValue("Testing\nformatting");

  wysi.italic({ line: 0, ch: 0 }, { line: 1, ch: 2 });
  equal (wysi.toHTML(), "<em>Testing<br />fo</em>rmatting");

  wysi.italic({ line: 0, ch: 1 }, { line: 0, ch: 3 });
  equal (wysi.toHTML(), "<em>T</em>es<em>ting<br /></em>formatting");



});