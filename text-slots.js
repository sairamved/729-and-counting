/**
 * Vanilla JS slots-style text animation inspired by calligraph.
 * Each character gets a vertical column that rolls to the target character.
 * Column widths adapt to the font's natural character widths.
 */

(function () {
  const CHARS = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/';
  const CHAR_HEIGHT = 1.2; // em — must match CSS .slot-char height
  const DURATION = 500;

  // Measure character widths from the font
  let charWidths = null;
  function measureWidths(container, force) {
    if (charWidths && !force) return;
    charWidths = {};
    const probe = document.createElement('span');
    probe.style.visibility = 'hidden';
    probe.style.position = 'absolute';
    probe.style.whiteSpace = 'pre';
    probe.style.font = getComputedStyle(container).font;
    document.body.appendChild(probe);
    for (let i = 0; i < CHARS.length; i++) {
      probe.textContent = CHARS[i] === ' ' ? '\u00A0' : CHARS[i];
      charWidths[CHARS[i]] = probe.offsetWidth;
    }
    document.body.removeChild(probe);
  }

  class SlotColumn {
    constructor(char, container) {
      this.el = document.createElement('span');
      this.el.className = 'slot-col';
      this._setWidth(char);

      this.inner = document.createElement('span');
      this.inner.className = 'slot-inner';

      for (let i = 0; i < CHARS.length; i++) {
        const span = document.createElement('span');
        span.className = 'slot-char';
        span.textContent = CHARS[i] === ' ' ? '\u00A0' : CHARS[i];
        this.inner.appendChild(span);
      }

      this.el.appendChild(this.inner);
      container.appendChild(this.el);

      this.currentIndex = CHARS.indexOf(char);
      if (this.currentIndex === -1) this.currentIndex = 0;
      this._setOffset(this.currentIndex, false);
      this.inner.children[this.currentIndex].classList.add('active');
      this.char = char;
    }

    _setWidth(char) {
      const w = charWidths[char] || charWidths['0'];
      this.el.style.width = w + 'px';
    }

    _setOffset(index, animate) {
      const offset = -index * CHAR_HEIGHT;
      if (animate) {
        this.inner.style.transition = `transform ${DURATION}ms cubic-bezier(0.19, 1, 0.22, 1)`;
      } else {
        this.inner.style.transition = 'none';
      }
      this.inner.style.transform = `translateY(${offset}em)`;
    }

    _fadeChars(oldIndex, newIndex) {
      const spans = this.inner.children;
      // Fade out old
      spans[oldIndex].style.transition = `opacity ${DURATION * 0.01}ms ease-out`;
      spans[oldIndex].style.opacity = '0';
      // Fade in new
      spans[newIndex].style.opacity = '0';
      requestAnimationFrame(() => {
        spans[newIndex].style.transition = `opacity ${DURATION * 0.6}ms ease-in ${DURATION * 0.2}ms`;
        spans[newIndex].style.opacity = '1';
      });
    }

    rollTo(char) {
      const targetIndex = CHARS.indexOf(char);
      if (targetIndex === -1 || targetIndex === this.currentIndex) return;
      const oldIndex = this.currentIndex;
      this.inner.children[oldIndex].classList.remove('active');
      this.currentIndex = targetIndex;
      this.inner.children[targetIndex].classList.add('active');
      this.char = char;
      this._setWidth(char);
      this._setOffset(targetIndex, true);
      this._fadeChars(oldIndex, targetIndex);
    }

    destroy() {
      this.el.remove();
    }
  }

  class TextSlots {
    constructor(element) {
      this.container = element;
      this.container.classList.add('text-slots');
      this.container.style.position = 'relative';
      this.container.setAttribute('role', 'text');
      this.container.setAttribute('aria-live', 'polite');
      this.copySpan = document.createElement('span');
      this.copySpan.className = 'text-slots-copy';
      this.container.appendChild(this.copySpan);
      measureWidths(element);
      this.columns = [];
      this.currentText = '';
    }

    remeasure() {
      measureWidths(this.container, true);
      for (let i = 0; i < this.columns.length; i++) {
        this.columns[i]._setWidth(this.columns[i].char);
      }
    }

    update(text) {
      if (text === this.currentText) return;
      const oldText = this.currentText;
      this.currentText = text;
      this.container.setAttribute('aria-label', text);
      this.copySpan.textContent = text;

      const maxLen = Math.max(oldText.length, text.length);

      for (let i = 0; i < maxLen; i++) {
        const newChar = i < text.length ? text[i] : null;

        if (i < this.columns.length) {
          if (newChar === null) {
            this.columns[i].el.style.transition = `opacity ${DURATION * 0.5}ms ease, width ${DURATION * 0.5}ms ease`;
            this.columns[i].el.style.opacity = '0';
            this.columns[i].el.style.width = '0';
            const col = this.columns[i];
            setTimeout(() => col.destroy(), DURATION * 0.5);
          } else {
            this.columns[i].el.style.opacity = '1';
            this.columns[i].rollTo(newChar);
          }
        } else if (newChar !== null) {
          const col = new SlotColumn(newChar, this.container);
          this.columns.push(col);
        }
      }

      this.columns = this.columns.slice(0, text.length);
    }
  }

  window.TextSlots = TextSlots;
})();
