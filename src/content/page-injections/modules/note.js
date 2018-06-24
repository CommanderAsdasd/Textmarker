import { _DOMMODULE } from './../../_shared/utils'
import _STORE from './../_store'

export default function(mark) {

  const BODY = window.document.body;

  return new _DOMMODULE({
		events: {
      DOM: {
        click: {
          'tmnotedelete': '_delete',
          'tmnoteminimize': 'hide',
          'tmnotecustomize': 'togglePalette',
          'tmnotecolor': 'changeColor',
          'textarea': 'bringUpFront'
        },
        keyup: {
          'textarea': 'attemptUpdate'
        }
      }
		},
    addListenersManually: true,
    el: null,
    mark: mark,
    markClickHandler: null,
    text: '',
    visible: false,
    recentlyUpdated: false,
    settingsMode: false,
    color: 'yellow',

    autoinit() {
      this.adjustNoteDataObject();
      this.createNoteElement();
      this.addListeners();
      this.addMarkListeners();
    },

    adjustNoteDataObject() {
      const noteData = this.mark.keyData.note;
      if (typeof noteData === 'string') {
        this.mark.keyData.note = { text: noteData, color: 'yellow' };
      }
    },
    createNoteElement() {
      const note = this.el = document.createElement('tmnote');
      const del = this.del = document.createElement('tmnotedelete');
      const min = this.min = document.createElement('tmnoteminimize');
      const gear = document.createElement('tmnotecustomize');
      const palette = this.palette = document.createElement('tmnotepalette');
      const p = this.textElement = document.createElement('textarea');
      const text = this.mark.keyData.note.text;
      const color = this.color = this.mark.keyData.note.color || 'yellow';

      const delText = document.createTextNode(String.fromCharCode(10005));
      const minText = document.createTextNode(String.fromCharCode(0x2013));
      const gearText = document.createTextNode(String.fromCharCode(0x2699));

      ['green', 'white', 'yellow', 'orange', 'red', 'pink', 'blue', 'turquoise'].forEach(c => {
        let color = document.createElement('tmnotecolor');
        color.className = 'tmnotecolor--' + c;
        color.setAttribute('data-color', c);
        palette.appendChild(color);
      });

      p.setAttribute('data-tm-note', true);
      del.appendChild(delText);
      min.appendChild(minText);
      gear.appendChild(gearText);
      note.appendChild(gear);
      note.appendChild(del);
      note.appendChild(min);
      note.appendChild(p);
      note.classList.add('tmnote--' + color);
      if (text) p.value = text;

      p.addEventListener('blur', e => this.attemptUpdate(e, e.target, true), false);
    },
    _delete() {
      this.remove();
      this.mark.keyData.note = '';
    },
    remove() {
      this.hide();
      this.removeMarkListeners();
      this.emit('removed:note', this.mark.id);
    },
    attemptUpdate(e, el, force) {
      if (force) {
        this.update(el);
      }
      else if (!this.recentlyUpdated) {
        this.recentlyUpdated = true;
        window.setTimeout(() => this.update(el), 3000);
      }
    },
    update(el) {
      this.mark.keyData.note.text = el.value;
      this.emit('updated:note');
      this.recentlyUpdated = false;
    },
    show() {
      const el = this.el;
      const pos = this.getPosition();
      const innerWindowWidth = window.innerWidth;
      let left = pos.left;
      if (left + 340 > innerWindowWidth) {
        left = innerWindowWidth - 340;
      }
      BODY.appendChild(el);
      el.setAttribute('style', 'display:block;top:' + (pos.top + pos.offset) + 'px;left:' + left + 'px;');
      this.visible = true;
    },
    bringUpFront() {
      Array.from(BODY.getElementsByTagName('tmnote')).forEach(note => {
        if (note === this.el) note.style.zIndex = 2147483647;
        else note.style.zIndex = 2147483646;
      });
    },
    hide() {
      BODY.removeChild(this.el);
      this.visible = false;
    },
    togglePalette() {
      if (this.settingsMode) {
        this.el.removeChild(this.palette);
      } else {
        this.el.appendChild(this.palette);
      }
      this.settingsMode = !this.settingsMode;
    },
    changeColor(e, el) {
      this.el.classList.remove('tmnote--' + this.color);
      const color = this.color = el.getAttribute('data-color');
      this.el.classList.add('tmnote--' + color);
      this.mark.keyData.note.color = color;
      this.togglePalette();
      this.emit('changed:note-color');
    },
    addMarkListeners() {
      _STORE.get('noteonclick').then(noteonclick => {
        if (noteonclick) {
          const handler = this.markClickHandler = () => this.show();

          for (let wrapper of this.mark.wrappers) {
            wrapper.addEventListener('click', handler, false);
            wrapper.setAttribute('title', browser.i18n.getMessage('toggle_note'));
          }
        }
      });
    },
    removeMarkListeners() {
      if (!this.markClickHandler) return;
      for (let wrapper of this.mark.wrappers) {
        wrapper.removeEventListener('click', this.markClickHandler, false);
        wrapper.removeAttribute('title');
      }
    },
    getPosition() {
      const rect = this.mark.wrappers[this.mark.wrappers.length - 1].getBoundingClientRect();
      return {
        top: rect.top + window.pageYOffset - BODY.clientTop,
        left: rect.left + window.pageXOffset - BODY.clientLeft,
        offset: rect.height
      };
    }
	});
}
