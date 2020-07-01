$(document).ready(function(){
	fixColumns($(window).width());

	$(window).resize(function() {
		fixColumns($( window ).width());
	});

	// Lmao
	function fixColumns(width)  {
		$(".hackathon-card").each(function() {
			$(this).removeClass();
			if(775 > width && width > 584) {
				$(this).addClass("hackathon-card col s12 m6 l4");
			} else if(1549 > width && width > 1275)  {
				$(this).addClass("hackathon-card col s12 m4 l5ths");
			} else if(1276 > width && width > 1050) {
				$(this).addClass("hackathon-card col s12 m4 l3");
			} else if(1051 > width) {
				$(this).addClass("hackathon-card col s12 m4 l4");
			} else if(width > 1550) {
				$(this).addClass("hackathon-card col s12 m4 l2");
			} else {
				$(this).addClass("hackathon-card col s12 m4 l2");
			}
		});
	}
});
