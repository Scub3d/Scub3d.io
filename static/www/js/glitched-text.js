class TextGlitch { // Based off: https://codepen.io/soulwire/pen/mErPAK
	constructor(el) {
		this.el = el
		this.chars = '!<>-_\\/[]{}—=+*^?#_______&#*+%?£@§$abcdefghijklmnopqrstuvwxyz1234567890!あえいうおかきくけこさしすせそたちつてとをになぬねのまめむみもはふへほ'
		this.update = this.update.bind(this)
		this.isException = this.el.hasClass("exception") ? true : false;
	}

	setText(language) {
		const oldText = this.el.children("span.displayText").text()
		const newText = this.isException ? language !== "japanese" ? this.el.children("span.englishText").text() : this.el.children("span.japaneseText").text() : this.el.children("span." + language + "Text").text()
		const length = Math.max(oldText.length, newText.length)
		const promise = new Promise((resolve) => this.resolve = resolve)
		this.queue = []

		for (let i = 0; i < length; i++) {
			const from = oldText[i] || ''
			const to = newText[i] || ''
			const start = Math.floor(Math.random() * 40)
			const end = start + Math.floor(Math.random() * 40)

			this.queue.push({
				from,
				to,
				start,
				end
			})
		}

		cancelAnimationFrame(this.frameRequest)
		this.frame = 0
		this.update(language)
		return promise
	}

	update(language) {
		let output = ''
		let complete = 0

		for (let i = 0, n = this.queue.length; i < n; i++) {
			let {
				from,
				to,
				start,
				end,
				char
			} = this.queue[i]

			if (this.frame >= end) {
				complete++
				output += to
			} else if (this.frame >= start) {
				if (!char || Math.random() < 0.28) {
					char = this.randomChar()
					this.queue[i].char = char
				}

				output += `<span class="dud">${char}</span>`
			} else {
				output += from
			}
		}

		this.el.children("span.displayText").html(output)
		this.el.removeClass("english japanese");
		this.isException ? language !== "japanese" ? this.el.addClass("japanese") : this.el.addClass("english") : this.el.addClass(language)

		if (complete === this.queue.length) {
			this.resolve()
		} else {
			this.frameRequest = requestAnimationFrame(this.update)
			this.frame+=2
		}
	}

	randomChar() {
		return this.chars[Math.floor(Math.random() * this.chars.length)]
	}
}

function glitchText(element, language) {
	var textGlitchFX = new TextGlitch(element);
	textGlitchFX.setText(language);
}