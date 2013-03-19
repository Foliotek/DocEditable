$(function() {


  var wysi = DocEditable.fromTextArea(document.getElementById("code"), {
    format: 'html'
  });

  window.wysi = wysi;
  window.editor = wysi.editor;

  var outputTimeout = null;
  var outputDesign = document.getElementById("output-design");
  var outputSource = document.getElementById("output-source");


  function onchange() {
      outputDesign.innerHTML = wysi.toHTML();
      outputSource.innerHTML = wysi.toHTML('\n');
  }

  wysi.on("change", function() {
  	clearTimeout(outputTimeout);
  	outputTimeout = setTimeout(onchange, 500);
  });
  onchange();

  $("#output-wrapper .nav a").on('click', function(e) {
  	e.preventDefault();
  	$(this).tab('show');
  });

});