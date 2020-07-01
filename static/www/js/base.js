$("#content").hide(); 

$(document).ready(function(){
	$('.tooltipped').tooltip({ enterDelay: 250, outDuration: 50 });

	$('#slide-out').sidenav();
	
	var mutationObserver = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			if(mutation["target"]["id"] == "slide-out") {
				$(".nav-wrapper").css({"padding-left": (300 - 300 / 105 * -1 * parseInt(mutation["target"]["style"]["transform"].split("(")[1].split("%")[0])).toString() + "px"});
			}	
		});
	});

	mutationObserver.observe(document.documentElement, {
		attributes: true,
		characterData: true,
		childList: true,
		subtree: true,
		attributeOldValue: true,
		characterDataOldValue: true
	});

	$( window ).resize(function() {
		if($(window).width() > 992) {
			$(".nav-wrapper").css({"padding-left": "300px"});
		} else {
			$(".nav-wrapper").css({"padding-left": "0px"});
		}
	});

	$(document).ready(function(){
		$('.fixed-action-btn').floatingActionButton();
	});

	// Not my best work ngl
	$("._translate").on("click", function() {
		if ($.cookie("language") !== "japanese") {
			$.cookie("language", "japanese");
			setSiteToJapanese();
		} else {
			$.cookie("language", "english");
			setSiteToEnglish();
		}
		$(".text").each(function() {
			scramble($(this));
		});
	});

	if($.cookie("language") === "japanese") {
		setSiteToJapanese();
	} else {
		$.cookie("language", "english");
		setSiteToEnglish();
	}

	setTimeout(function() { 
		$(".text").each(function() {
			scramble($(this));
		});
	}, 1000);

	$(window).on('hashchange', function(e){
		window.history.pushState("", document.title, window.location.pathname);  
	});

	var _loader = document.querySelector('.m-loader');
	setTimeout(function() { _loader.classList.toggle("is-loaded"); }, 0);
	setTimeout(function() { $("#preloader").hide(); $("#content").show(); }, 500);

	$(window).resize(function() {
		fixNavTitleLeft();
	});

	fixNavTitleLeft();

	function fixNavTitleLeft() {
		if($( window ).width() > 992) {
			$("#navTitle").style('left', (($( window ).width() - 378) / $( window ).width() * 100 / 2) + '%', 'important');
		} else {
			$("#navTitle").style('left', '50%', 'important');
		}
	}

	function setSiteToEnglish() {
		$("#translate_icon").removeClass("translate_english");
		$("#translate_icon").addClass("translate_japanese");

		$("#translate_icon_side").removeClass("translate_english");
		$("#translate_icon_side").addClass("translate_japanese");

		$("#translation_navbar_icon").attr('data-tooltip', '日本語');

		// Fast way of determining subdomain
		if(window.location.hostname.split('.')[0] == "scub3d") {
			$("#about_navbar_icon").attr('data-tooltip', 'Home');
			$("#experience_navbar_icon").attr('data-tooltip', 'Experience');
			$("#hackathons_navbar_icon").attr('data-tooltip', 'Hackathons');
			$("#projects_navbar_icon").attr('data-tooltip', 'Projects');
			$("#resume_navbar_icon").attr('data-tooltip', 'Resumé');
		} else if(window.location.hostname.split('.')[0] == "minesweeper") {
			$("#presskit_navbar_icon").attr('data-tooltip', 'Presskit');
			$("#privacy-policy_navbar_icon").attr('data-tooltip', 'Privacy Policy');
			$("#scub3d.io_navbar_icon").attr('data-tooltip', 'Back to website');
		}

	}

	function setSiteToJapanese() {
		$("#translate_icon").removeClass("translate_japanese");
		$("#translate_icon").addClass("translate_english");

		$("#translate_icon_side").removeClass("translate_japanese");
		$("#translate_icon_side").addClass("translate_english");

		$("#translation_navbar_icon").attr('data-tooltip', 'English');

		console.log("heeeee")

		// Fast way of determining subdomain
		if(window.location.hostname.split('.')[0] == "scub3d") {
			$("#about_navbar_icon").attr('data-tooltip', 'ホーム');
			$("#experience_navbar_icon").attr('data-tooltip', '職歴');
			$("#hackathons_navbar_icon").attr('data-tooltip', 'ハッカソン');
			$("#projects_navbar_icon").attr('data-tooltip', 'プロジェクト');
			$("#resume_navbar_icon").attr('data-tooltip', '履歴書');
		} else if(window.location.hostname.split('.')[0] == "minesweeper") {
			$("#presskit_navbar_icon").attr('data-tooltip', 'プレスキット');
			$("#privacy-policy_navbar_icon").attr('data-tooltip', '個人情報保護方針');
			$("#scub3d.io_navbar_icon").attr('data-tooltip', 'ウェブサイトに戻る');
		}
	}
});

(function($) {    
  if ($.fn.style) {
    return;
  }

  // Escape regex chars with \
  var escape = function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  };

  // For those who need them (< IE 9), add support for CSS functions
  var isStyleFuncSupported = !!CSSStyleDeclaration.prototype.getPropertyValue;
  if (!isStyleFuncSupported) {
    CSSStyleDeclaration.prototype.getPropertyValue = function(a) {
      return this.getAttribute(a);
    };
    CSSStyleDeclaration.prototype.setProperty = function(styleName, value, priority) {
      this.setAttribute(styleName, value);
      var priority = typeof priority != 'undefined' ? priority : '';
      if (priority != '') {
        // Add priority manually
        var rule = new RegExp(escape(styleName) + '\\s*:\\s*' + escape(value) +
            '(\\s*;)?', 'gmi');
        this.cssText =
            this.cssText.replace(rule, styleName + ': ' + value + ' !' + priority + ';');
      }
    };
    CSSStyleDeclaration.prototype.removeProperty = function(a) {
      return this.removeAttribute(a);
    };
    CSSStyleDeclaration.prototype.getPropertyPriority = function(styleName) {
      var rule = new RegExp(escape(styleName) + '\\s*:\\s*[^\\s]*\\s*!important(\\s*;)?',
          'gmi');
      return rule.test(this.cssText) ? 'important' : '';
    }
  }

  // The style function
  $.fn.style = function(styleName, value, priority) {
    // DOM node
    var node = this.get(0);
    // Ensure we have a DOM node
    if (typeof node == 'undefined') {
      return this;
    }
    // CSSStyleDeclaration
    var style = this.get(0).style;
    // Getter/Setter
    if (typeof styleName != 'undefined') {
      if (typeof value != 'undefined') {
        // Set style property
        priority = typeof priority != 'undefined' ? priority : '';
        style.setProperty(styleName, value, priority);
        return this;
      } else {
        // Get style property
        return style.getPropertyValue(styleName);
      }
    } else {
      // Get CSSStyleDeclaration
      return style;
    }
  };
})(jQuery);
