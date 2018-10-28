import { _MODULE } from './../../_shared/utils'
import _STORE from './../_store'
import _MARK from './mark-item'
import _BOOKMARK from './bookmark'
import _SELECTION from './selection'

export default function() {
  // marker module
	return new _MODULE({
		events: {
			ENV: {
				'set:entries': 'updateID',
				'pressed:marker-key': 'onMarkerKey',
        'pressed:hotkey': 'onHotkey',
        'restored:range': 'recreate',
        'finished:all-restorations': 'onFinishedRestoration',
        'ctx:b': 'setBookmark',
        'ctx:-b': 'removeBookmark',
        'ctx:d': 'remove',
        'ctx:m': 'onMarkerKey',
        'ctx:n': 'addNote',
        'updated:note': 'saveNote',
        'removed:note': 'saveNote',
				'changed:note-color': 'saveNote',
				'sidebar:highlight': 'onMarkerKey',
        'sidebar:delete-highlight': 'remove',
        'sidebar:bookmark': 'setBookmark',
        'sidebar:delete-bookmark': 'removeBookmark',
        'sidebar:note': 'addNote',
        'sidebar:save-changes': 'save',
        'sidebar:undo': 'undo',
        'sidebar:redo': 'redo',
        'sidebar:next-mark': 'gotoNextMark',
        'sidebar:scroll-to-bookmark': 'scrollToBookmark',
        'scroll-to-bookmark': 'scrollToBookmark',
        'clicked:mark': 'gotoMark'
			}
		},
		selection: null,
		done: [],
		undone: [],
		visuallyOrderedMarks: [],
    bookmark: null,
    removedBookmark: null,
		idcount: 0,
		markScrollPos: -1,

    updateID(entries) {
      const l = entries.length;
      const locked = _STORE.locked;
      const ids = [];

      for (let i = 0, entry; i < l; i++) {

        entry = entries[i];

        if (!locked && entry.idcount) {
          return this.idcount = entry.idcount;
        } else {
          let marks = (entry.marks || []).concat(entry.lost || []),
              d = marks.length;

          if (d) {
            while (d--) {
              ids.push(marks[d].id);
            }
          }
        }
      }
      this.idcount = Math.max.apply(null, ids);
    },
		mark(key, data) {
			this.undone.length = 0;

			return new _MARK(this, key, data).create();
		},
		undo(noAutosave) {
      if (_STORE.locked) return;

			let done = this.done;

			if (done.length) {
        const mark = this.done.pop();
        const id = mark.id;

        this.undone.push(mark.undo());

        if (this.bookmark) this.undoBookmark();

        this.emit('removed:mark', id);
      }

      noAutosave || this.autosave();
		},
		redo(noAutosave) {
      if (_STORE.locked) return;

      let undone = this.undone;

			if (undone.length) {
        const mark = this.undone.pop();

        this.done.push(mark.redo());

        this.emit('restore:notes', [mark]);
      }

      noAutosave || this.autosave();
		},
    cutOut(i) {
      let marker = this,
          done = this.done,
          l = done.length,
          toBeRemoved = [i],
          indices = [i],
          mark, smallestID;

      function findIndicesOfAffectedMarks(j) {
        for (var x = j + 1; x < l; x++) {
          mark = done[x];

          if (marker.marksIntersect(done[j], mark)) {
            if (!toBeRemoved.includes(x)) toBeRemoved.push(x);
            indices.push(x);
          }
        }
        indices.sort();
        toBeRemoved.sort();
      }
      while (indices.length) {
        findIndicesOfAffectedMarks(indices.shift());
      }
      smallestID = Math.min.apply(null, toBeRemoved);

      while (toBeRemoved.length) {
        this.done.splice(toBeRemoved.pop(), 1)[0].undo();
        this.undone.pop();
      }

      return smallestID;
    },
    remove(id) {
      if (_STORE.locked) return;

      id = id ? id : _STORE.tmid ? _STORE.tmid : '';

      if (!id) return this.undo();

      let mark = this.getById(id.split('_')[0]),
          done = this.done,
          l = done.length,
          position = done.indexOf(mark),
          smallestID, i;

      if (position === l - 1) {
        this.undo();
        this.undone.pop();
      }

      else {
        if (!this.undone.length) {
          smallestID = this.cutOut(position);

          this.done.forEach(function(mark) {
            if (mark.id > smallestID) mark.resume();
          });

          this.autosave();
        } else {
          i = this.undone.length;

          while (this.undone.length) this.redo(true);

          smallestID = this.cutOut(position);

          this.done.forEach(function(mark) {
            if (mark.id > smallestID) mark.resume();
          });

          while (i--) this.undo(true);

          this.autosave();
        }
      }
      this.emit('removed:mark', id[0]);
    },
    save() {
      const iframe = _STORE.iframe;
      const locked = _STORE.locked;

      _STORE.get('naming').then(naming => {
        if (_STORE.isNew || locked) {
          if (!locked && naming === 'custom') {
            this.request('name:entry?').then(granted => {
              if (granted) {
                const sub = iframe ? browser.i18n.getMessage('nm_message_iframe') : '';

                _STORE.name = window.prompt(browser.i18n.getMessage('nm_message', sub));
                if (_STORE.name) this.emit('save:entry?', this.retrieveEntry());
              }
            });
          } else {
            let confirmed = true;
	          if (iframe) confirmed = window.confirm(browser.i18n.getMessage('nm_message_iframe'));
	          if (confirmed) {
              this.emit('save:entry?', this.retrieveEntry());
	          }
          }
        } else {
          this.emit('update:entry?', this.retrieveEntry());
        }
      });
		},
    autosave() {
      _STORE.get('autosave').then(autosave => {
        if (autosave) this.save();
        else this.emit('unsaved-changes');
      });
    },
		store(mark, text, save) {
			this.done.push(mark);
      if (save !== false) this.autosave();
			this.orderMarksVisually();
		},
    recreate(selection, mark) {
      this.selection = selection;
      this.store(this.mark(mark.key, mark), selection.text, false);
    },
    onFinishedRestoration() {
      this.emit('restore:notes', this.done);

      if (_STORE.locked) {
        const mark = this.done[this.done.length - 1];
        if (_STORE.name === mark.keyData.text.trim()) {
          this.gotoMark(mark);
        }
      } else {
        this.sortById();
        this.scrollToBookmark();
      }
    },
    addNote(id) {
      this.emit('add:note', this.findMark(id));
    },
    saveNote(id) {
      this.emit('update:entry?', this.retrieveEntry(this.getById(id)));
    },
    gotoMark(mark) {
      const markElements = this.visuallyOrderedMarks;
      let el, pos;
      if (mark) {
        el = document.querySelector('.textmarker-highlight[data-tm-id="' + mark.id + '_0"]');
        pos = this.markScrollPos = markElements.indexOf(el);
      } else {
        pos = this.markScrollPos;
        el = markElements[pos];
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			el.click();
    },
		gotoNextMark(dir) {
			const l = this.visuallyOrderedMarks.length;

			this.markScrollPos += dir;
			if (this.markScrollPos < 0) this.markScrollPos = l - 1;
			else if (this.markScrollPos >= l) this.markScrollPos = 0;

			this.gotoMark();
		},
    setBookmark(m, save) {
      if (_STORE.locked) return;

      let bookmark = this.bookmark,
          mark = this.findMark(m);

      if (!mark) return false;

      if (bookmark) {
        bookmark.remove();
        this.emit('removed:bookmark');
      }

      this.bookmark = new _BOOKMARK().set(mark);

      this.emit('added:bookmark');
      if (save !== false) this.autosave();
    },
    undoBookmark() {
      this.bookmark = null;
      this.emit('removed:bookmark');
    },
    removeBookmark() {
      if (_STORE.locked) return;

      let bookmark = this.bookmark;

      if (!bookmark) return false;

      bookmark.remove();
      this.bookmark = null;
      this.removedBookmark = bookmark;
      this.emit('removed:bookmark');
      this.autosave();
    },
    scrollToBookmark() {
      let bookmark = this.bookmark;

      if (bookmark) bookmark.scrollIntoView();
    },
    getById(id, pos) {
			let done = this.done,
				  d = done.length,
				  mark;

			while (d--) {
				mark = done[d];

				if (mark.keyData.id == id)
					return pos ? { mark: mark, position: d } : mark;
			}
			return pos ? { mark: null, position: null } : false;
		},
		findMark(x) {
			x = x ? x : _STORE.tmid ? _STORE.tmid : '';

			let mark = !x ?
				this.done[this.done.length - 1] :
					typeof x === 'string' ?
				this.getById(x.split('_')[0]) :
				x;
			return mark;
		},
    sortById() {
      this.done.sort((mark1, mark2) => {
        const id1 = mark1.id;
        const id2 = mark2.id;
        if (id1 === id2) return 0;
        return id1 < id2 ? -1 : 1;
      });
    },
		orderMarksVisually() {
			this.visuallyOrderedMarks = Array.from(document.querySelectorAll('.textmarker-highlight[data-tm-id$="_0"]')).sort((m1, m2) => {
				let bb1 = m1.getBoundingClientRect(),
						bb2 = m2.getBoundingClientRect(),
						top1 = bb1.top,
						top2 = bb2.top;

				if (top1 < top2) return -1;
				else if (top2 < top1) return 1;
				else {
					if (bb1.left < bb2.left) return -1;
					return 1;
				}
			});
		},
    marksIntersect(mark1, mark2) {
			let wrappers1 = mark1.wrappers,
          w1 = wrappers1.length,
          id1 = mark1.id,
          wrappers2 = mark2.wrappers,
          id2 = mark2.id,
          w2, tms, l;

      while (w1--) {
        w2 = wrappers2.length;
        while (w2--) {
          tms = wrappers1[w1].querySelectorAll('[data-tm-id]');
          l = tms.length;
          while (l--) {
            if (tms[l].getAttribute('data-tm-id')[0] == id2)
              return true;
          }
        }
      }
      return false;
		},
    onMarkerKey(e, key) {
			let selection = this.selection = new _SELECTION();

			if (!selection.nodes) return false;

      if (e) {
				if (typeof e === 'string') key = e;
				else this.preventDefault(e);
			} else {
				key = key || 'm';
			}

      _STORE.get('markers').then(markers => {
        this.store(this.mark(key, { style: markers[key] }));
      });
		},
    onHotkey(key) {
      let self = this;
      switch(key) {
        case 'z': self.undo(); break;
        case 'y': self.redo(); break;
        case 's': self.save(); break;
        case 'b': self.setBookmark(); break;
				case 'arrowup': self.gotoNextMark(-1); break;
				case 'arrowdown': self.gotoNextMark(1); break;
				case 'd': self.remove(); break;
      }
    },
    preventDefault(e) {
			if (e && e.preventDefault) {
				e.preventDefault();
				e.stopPropagation();
			}
			return this;
		},
		retrieveEntry(mark) {
      let entry = _STORE.entry || {};

      entry.marks = mark ? [mark.keyData] : this.collectMarks();
			entry.last = new Date().getTime();
      entry.bookmarked = !!this.bookmark;
      entry.title = window.document.title;
			entry.count = entry.marks.length;
			entry.idcount = this.idcount;

      if (_STORE.isNew || _STORE.locked) {
        entry.first = entry.last;
        entry.url = window.document.URL;
        entry.synced = _STORE.area_history === 'sync';
        entry.locked = _STORE.locked;
      }

      entry.name = _STORE.locked ? entry.marks[0].text.trim() : _STORE.isNew ? _STORE.name : entry.name;

			return entry;
		},
    collectMarks() {
      let done = this.done;
      let l = done.length;
      const marks = [];

      if (_STORE.locked) {
        done = [done[l-1]];
      }

      l = done.length;

      for (let m = 0, kD; m < l; m++) {
				kD = done[m].keyData;
				marks.push(kD);
			}
      return marks;
    }
	});
}
