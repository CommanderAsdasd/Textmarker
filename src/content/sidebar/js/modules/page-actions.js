import { _DOMMODULE } from './../../../utils'
import { _GET_ACTIVE_TAB } from './../../../utils'
import _STORE from './../_store'

new _DOMMODULE({
  el: document.getElementById('page-actions'),
  events: {
    ENV: {
      'started:app': 'update',
      'updated:settings': 'update',
      'toggled:sync-settings': 'update',
      'updated:entry': 'deactivateSave',
      'saved:entry': 'deactivateSave',
      'unsaved-changes': 'activateSave',
      'added:bookmark': 'activateBookmark',
      'removed:bookmark': 'deactivateBookmark',
      'added:note': 'activateNotes',
      'removed:last-note': 'deactivateNotes'
    },
    DOM: {
      click: {
        '.switch-toggle': 'onAutosaveSwitch',
        '.page-action': 'pageAction'
      }
    }
  },

  autoinit() {
    _STORE.get('autosave').then(autosave => this.toggleAutosave(autosave));
  },
  update() {

  },
  onAutosaveSwitch(e, el) {
    el = el.id === 'autosave-switch' ? el : el.parentNode;
    const autosave = !el.classList.contains('active');
    this.toggleAutosave(autosave);
    this.emit('sidebar:toggle-autosave', autosave);
  },
  toggleAutosave(on) {
    const meth = on ? 'add' : 'remove';
    document.getElementById('autosave-switch').classList[meth]('active');
    document.getElementById('page-action-box--save').classList[meth]('none');
  },
  activateSave() {
    this.activate('save', true);
  },
  deactivateSave() {
    this.activate('save', false);
  },
  activateBookmark() {
    this.activate('scroll', true);
  },
  deactivateBookmark() {
    this.activate('scroll', false);
  },
  activateNotes() {
    this.activate('notes', true);
  },
  deactivateNotes() {
    this.activate('notes', false);
  },
  activate(type, on) {
    const btn = document.getElementById('page-action--' + type);
    if (on) btn.removeAttribute('disabled');
    else btn.setAttribute('disabled', true);
  },
  pageAction(e, el) {
    _GET_ACTIVE_TAB().then(tab => this.emit('sidebar:' + el.getAttribute('data-action'), { tab: tab.id }));
  }
});
